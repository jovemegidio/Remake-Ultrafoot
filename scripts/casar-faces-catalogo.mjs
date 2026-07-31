// CASAR OS ROSTOS DO CATÁLOGO DF11 COM OS ATLETAS DO JOGO.
//
//   node scripts/casar-faces-catalogo.mjs              # só mede, não grava
//   node scripts/casar-faces-catalogo.mjs --gravar     # grava o face-id-map
//
// POR QUE ESTE SCRIPT EXISTE (e por que ele é MELHOR que o mapear-faces-fm).
//
// O `mapear-faces-fm.mjs` resolvia o problema difícil do facepack: o pack tem
// 243 mil PNGs chamados `<FM ID>.png` e NÃO diz de quem é nenhum rosto. Ele
// descobria isso raspando a página de cada clube no sortitoutsi — milhares de
// requisições, cache de 60 MB, e ainda assim parcial.
//
// A pasta `DF11 Catalogo` é o RESULTADO daquele trabalho, já materializado:
//
//     País / Clube / Nome do Jogador (FM ID).png
//
// Ou seja, cada arquivo já carrega as três coisas que o casamento precisa —
// nome, clube e ID. Não há mais rede envolvida, e o casamento passa a ser feito
// contra a informação completa em vez de contra o que a varredura alcançou.
//
// AS TRÊS ARMADILHAS que colaram rosto errado antes continuam valendo, e o
// casamento aqui as respeita:
//
//   1. NOME ÚNICO NÃO É PROVA. Só casa dentro do MESMO clube. Um "Mauro Silva"
//      solto não vira rosto de ninguém.
//   2. O clube é escrito diferente nos dois lados ("RB Leipzig" x
//      "RasenBallsport Leipzig"). Casar por uma PALAVRA PRÓPRIA de 5+ letras,
//      ignorando genéricos (Club/Atlético/Sport/FC/City...), recupera centenas.
//   3. Sem clube em comum, NÃO casa. É melhor silhueta do que a cara de outra
//      pessoa — foi assim que o Florentino Pérez virou atleta uma vez.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const CATALOGO = process.env.DF11_CATALOGO ?? "C:/Users/SnyX/Downloads/DF11 Catalogo"
const SAIDA_MAPA = path.join(RAIZ, "data/seeds/face-id-map.json")
const SAIDA_ORIGEM = path.join(RAIZ, "data/faces-fm/origem-do-rosto.json")
const RELATORIO = path.join(RAIZ, "data/faces-fm/casamento-catalogo.json")

const gravar = process.argv.includes("--gravar")

// ─── Normalização ────────────────────────────────────────────────────────────

const semAcento = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

/** Chave de pessoa: "Gabriel Barbosa" -> "gabriel barbosa". */
const chaveNome = (s) =>
  semAcento(String(s ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// Palavras que aparecem em metade dos clubes do mundo e não identificam nada.
const GENERICO = new Set([
  "club", "clube", "atletico", "athletic", "atlhetico", "sport", "sporting", "sports",
  "futebol", "football", "futbol", "fc", "cf", "sc", "ac", "ec", "se", "cd", "ca", "ud",
  "city", "united", "town", "real", "deportivo", "deportes", "associacao", "association",
  "sociedade", "socidade", "esporte", "esportivo", "clb", "de", "do", "da", "dos", "das",
  "the", "and", "e", "y", "and", "calcio", "spa", "srl", "ssd", "asd", "us", "as", "ss",
  "if", "fk", "sk", "nk", "hk", "bk", "ik", "gk", "sv", "tsv", "vfb", "vfl", "fsv", "bsc",
  "team", "clubes", "cska", "sd", "rc", "rcd", "afc", "cfc", "mfc",
])

/** Palavras próprias do nome do clube (5+ letras, não genéricas). */
function marcasDoClube(nome) {
  return chaveNome(nome)
    .split(" ")
    .filter((p) => p.length >= 5 && !GENERICO.has(p))
}

// ─── Índice do catálogo ──────────────────────────────────────────────────────

/**
 * Percorre País/Clube/*.png e devolve:
 *   porClube: marca do clube -> [ {fmId, nome, chave, clube, pais, arquivo} ]
 */
function indexarCatalogo() {
  if (!existsSync(CATALOGO)) throw new Error(`catálogo não encontrado: ${CATALOGO}`)
  const entradas = []
  let ignorados = 0

  for (const pais of readdirSync(CATALOGO)) {
    const dirPais = path.join(CATALOGO, pais)
    if (!statSync(dirPais).isDirectory()) continue
    for (const clube of readdirSync(dirPais)) {
      const dirClube = path.join(dirPais, clube)
      let arquivos
      try {
        if (!statSync(dirClube).isDirectory()) continue
        arquivos = readdirSync(dirClube)
      } catch { continue }
      for (const arq of arquivos) {
        if (!arq.toLowerCase().endsWith(".png")) continue
        // "Adam Kölle (2000197396).png"
        const m = /^(.*?)\s*\((\d+)\)\.png$/i.exec(arq)
        if (!m) { ignorados++; continue }
        const nome = m[1].trim()
        entradas.push({
          fmId: m[2],
          nome,
          chave: chaveNome(nome),
          clube,
          pais,
          arquivo: path.join(dirClube, arq),
        })
      }
    }
  }
  return { entradas, ignorados }
}

// ─── Atletas do jogo ─────────────────────────────────────────────────────────

/**
 * Lê os elencos do jogo direto dos seeds — sem TypeScript, sem bundler.
 * Devolve [{ id, nome, chave, clube }].
 *
 * Duas fontes, na mesma ordem de prioridade que o jogo usa:
 *   real-squads-tm.json  — elencos reais por clube (o que o jogo de fato monta)
 *   imported-bf2026.json — o pool importado
 */
function atletasDoJogo() {
  const fora = []
  const push = (id, nome, clube) => {
    const chave = chaveNome(nome)
    // SEM ID NÃO ENTRA. `lib/player-photos.ts` consulta o manifesto por ID do
    // atleta primeiro e só depois por nome; registrar sem id significaria
    // chavear por nome, e aí um xará rouba o rosto (foi assim que o Mauro Silva
    // do Corinthians virou o Mauro Silva do Atlético Roraima).
    if (!chave || !clube || !id) return
    fora.push({ id: String(id), nome, chave, clube })
  }

  /**
   * ID DO ATLETA NO JOGO = `tm_<id do Transfermarkt>`, extraído do campo `f`
   * ("371247-1780359299" -> tm_371247). Descoberto conferindo o face-id-map já
   * publicado e os arquivos em disco: os 7.323 rostos atuais são todos
   * `df11-tm_<id>.webp`, e o manifesto é chaveado igual.
   *
   * ⚠️ Quem NÃO tem `f` não tem id estável e fica de fora — são 27.816 dos
   * 45.857 atletas de elenco real. Não é limitação deste casamento: é o jogo
   * que não sabe identificá-los individualmente.
   */
  const idDoJogo = (f) => {
    const bruto = String(f ?? "").split("-")[0].trim()
    return bruto ? `tm_${bruto}` : ""
  }

  const real = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/real-squads-tm.json"), "utf-8"))
  for (const [clube, elenco] of Object.entries(real)) {
    // A chave do clube vem como "SANTOS|santos" — o nome legível é o 1º campo.
    const nomeClube = String(clube).split("|")[0]
    for (const p of elenco ?? []) push(idDoJogo(p.f), p.n, nomeClube)
  }

  const bf = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8"))
  for (const t of bf.teams ?? []) {
    const clube = t.nome ?? t.name ?? ""
    for (const j of t.jogadores ?? []) push(idDoJogo(j.ft), j.nome, clube)
  }
  return fora
}

// ─── Casamento ───────────────────────────────────────────────────────────────

function casar() {
  const { entradas, ignorados } = indexarCatalogo()
  const jogadores = atletasDoJogo()

  // Índice: marca do clube -> nome -> entradas
  const porMarca = new Map()
  for (const e of entradas) {
    for (const marca of marcasDoClube(e.clube)) {
      let porNome = porMarca.get(marca)
      if (!porNome) { porNome = new Map(); porMarca.set(marca, porNome) }
      const lista = porNome.get(e.chave)
      if (lista) lista.push(e); else porNome.set(e.chave, [e])
    }
  }

  const mapa = {}          // fmId -> id do atleta
  const origem = {}        // fmId -> "df11"
  const usados = new Set() // um rosto por atleta
  let casados = 0, semClube = 0, semNome = 0, ambiguos = 0

  for (const j of jogadores) {
    if (usados.has(j.id)) continue
    const marcas = marcasDoClube(j.clube)
    if (marcas.length === 0) { semClube++; continue }

    let achado = null
    let colisao = false
    for (const marca of marcas) {
      const porNome = porMarca.get(marca)
      if (!porNome) continue
      const lista = porNome.get(j.chave)
      if (!lista || lista.length === 0) continue
      // Mais de um rosto para o mesmo nome DENTRO do mesmo clube é o caso raro
      // em que não dá para decidir — deixa passar em branco em vez de chutar.
      if (lista.length > 1) { colisao = true; break }
      achado = lista[0]
      break
    }

    if (colisao) { ambiguos++; continue }
    if (!achado) { semNome++; continue }

    mapa[achado.fmId] = j.id
    origem[achado.fmId] = "df11"
    usados.add(j.id)
    casados++
  }

  return { entradas, jogadores, mapa, origem, ignorados, casados, semClube, semNome, ambiguos }
}

// ─── Execução ────────────────────────────────────────────────────────────────

const t0 = Date.now()
const r = casar()
const seg = ((Date.now() - t0) / 1000).toFixed(1)

const mapaAntigo = existsSync(SAIDA_MAPA) ? JSON.parse(readFileSync(SAIDA_MAPA, "utf-8")) : {}
const novos = Object.keys(r.mapa).filter((k) => !(k in mapaAntigo)).length

console.log(`catálogo:   ${r.entradas.length} rostos (${r.ignorados} nomes fora do padrão)`)
console.log(`jogo:       ${r.jogadores.length} atletas com clube`)
console.log("")
console.log(`CASADOS:    ${r.casados}  (${(r.casados / r.jogadores.length * 100).toFixed(1)}% dos atletas)`)
console.log(`  sem rosto no clube : ${r.semNome}`)
console.log(`  clube sem marca    : ${r.semClube}`)
console.log(`  ambíguos (2+)      : ${r.ambiguos}`)
console.log("")
console.log(`mapa atual: ${Object.keys(mapaAntigo).length} vínculos  ->  novo: ${Object.keys(r.mapa).length} (${novos} inéditos)`)
console.log(`tempo: ${seg}s`)

if (!gravar) {
  console.log("\nNada gravado. Rode com --gravar para valer.")
} else {
  // UNIÃO com o mapa existente: o que a varredura antiga achou e este casamento
  // não alcançou continua valendo — perder rosto já publicado seria regressão.
  const uniao = { ...mapaAntigo, ...r.mapa }
  const origemAntiga = existsSync(SAIDA_ORIGEM) ? JSON.parse(readFileSync(SAIDA_ORIGEM, "utf-8")) : {}
  writeFileSync(SAIDA_MAPA, JSON.stringify(uniao, null, 0))
  writeFileSync(SAIDA_ORIGEM, JSON.stringify({ ...origemAntiga, ...r.origem }, null, 0))
  writeFileSync(RELATORIO, JSON.stringify({
    geradoEm: new Date().toISOString(),
    catalogo: r.entradas.length,
    atletas: r.jogadores.length,
    casados: r.casados,
    semRostoNoClube: r.semNome,
    clubeSemMarca: r.semClube,
    ambiguos: r.ambiguos,
    totalNoMapa: Object.keys(uniao).length,
  }, null, 2))
  console.log(`\ngravado: ${path.relative(RAIZ, SAIDA_MAPA)} (${Object.keys(uniao).length} vínculos)`)
}
