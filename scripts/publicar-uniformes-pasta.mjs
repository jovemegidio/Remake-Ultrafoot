// Publica UNIFORMES de uma pasta pelo canal de atualizacao.
//
// Irmao de publicar-escudos-pasta.mjs e publicar-fotos-catalogo.mjs: le a pasta,
// descobre o clube e a variante pelo NOME DO ARQUIVO, reduz a arte e exporta o
// pacote que o carregar-uniformes.py grava no banco da VPS.
//
//   node scripts/publicar-uniformes-pasta.mjs --pasta "C:\\...\\Portuguesa" \
//     [--clube portuguesa_bra] [--divisoes b,c,d] [--exportar uniformes.json]
//
// ⚠️ SO RODA DE UM DIRETORIO COM node_modules (C:\Ultrafoot) — o `sharp` nao
// existe no G:. Editar aqui e copiar para la, como os outros dois.
//
// ─── DUAS CONVENCOES DE NOME, porque as duas pastas reais usam uma cada ──────
//
//   "Portuguesa 1 Casa.png"  -> palavra da variante no fim
//   "abcrn_1.png" / "acgoianiense1.png" -> SLUG do clube + numero (1/2/3)
//
// A variante vem do FIM do nome nos dois casos. Sem isso a arte de fora entraria
// como principal e o clube jogaria a temporada inteira com o uniforme errado,
// sem erro nenhum.
//
// ⚠️ O SLUG NAO E O fileKey. "abcrn" e `abcrn_bra`, "oeste" e `oestesp_bra` (que
// no seed se chama "Osasco Sporting"), "novorizontino" e `novorinzontino_sp`
// (typo no proprio seed). O casamento e por CAMADAS de prova, da mais forte para
// a mais fraca, e para no primeiro nivel que devolve UM candidato:
//
//   1. fileKey inteiro           ("santos" -> `santos`)
//   2. fileKey sem o `_bra`      ("bragantino" -> `bragantino_bra`)
//   3. nome do clube (+ UF)      ("saoluizrs" -> `saoluiz_rs`)
//   4. nome sem palavra de sociedade   (o mais fraco: "ferroviaria")
//
// A camada 1 nao precisa de prova de origem; a 4 casa clubes DIFERENTES com
// facilidade ("Vitoria Sport Clube" x "Vitoria"), por isso vem por ultimo e so
// vale quando e unica. Empate em qualquer camada NAO e chutado: o clube sai no
// relatorio como ambiguo e resolve-se no MAPA_MANUAL ou com --clube.

import { readFile, readdir, writeFile } from "node:fs/promises"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const args = process.argv.slice(2)
const opt = (nome) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : null)
const pasta = opt("--pasta")
const clubeForcado = opt("--clube")
const exportar = opt("--exportar")
// Divisoes pedidas (b,c,d). Vazio = todas.
const divisoesPedidas = (opt("--divisoes") ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
if (!pasta) {
  console.error('uso: node scripts/publicar-uniformes-pasta.mjs --pasta "<pasta>" [--clube <fileKey>] [--divisoes b,c,d] [--exportar <arquivo.json>]')
  process.exit(1)
}

// 256x256 webp com transparencia: o MESMO formato de public/kits-imported, que
// e o que o jogo ja desenha. A arte de origem vem em ~450x560 e pesa 240 KB;
// assim cada variante fica em ~10 KB e o manifesto nao incha.
const LADO = 256

const RAIZ = path.resolve(import.meta.dirname, "..")

// ⚠️ SLUG QUE SO A PESSOA DECODIFICA. Sigla nao diz o nome, e adivinhar poe a
// camisa no clube errado. Cada linha aqui foi conferida a mao.
const MAPA_MANUAL = new Map(Object.entries({
  acgoianiense: "atleticogo_bra",     // Atletico Goianiense
  athparanaense: "atleticopr_bra",    // Athletico Paranaense
  atleticomineiro: "atleticomg_bra",
  alagoinhas: "atleticoalagoinhas_bra",
  novorizontino: "novorinzontino_sp", // typo no seed, nao no arquivo
  oeste: "oestesp_bra",               // no seed se chama "Osasco Sporting"
  santacruzpe: "santa",               // Santa Cruz-PE
  tremap: "ap_trem",
  juventudesamas: "juventudema_bra",  // Juventude Samas-MA
  anapolisfc: "anapolisgo_bra",
  fccascavel: "cascavel_pr",
  lagarto: "lagarto_se",              // no seed o nome virou o do estadio ("Barretão")
}))

const VARIANTES_POR_PALAVRA = [
  [/^(casa|home|principal|1)$/i, "home"],
  [/^(fora|away|visitante|reserva|2)$/i, "away"],
  [/^(terceiro|third|3)$/i, "third"],
]

/**
 * Variante + slug do clube, a partir do nome do arquivo.
 *
 * ⚠️ O NUMERO PODE VIR COLADO: "acgoianiense1.png" nao tem separador, e testar o
 * nome inteiro contra /1/ acusaria "home" em qualquer arquivo com 1 no nome.
 * Por isso o numero final e arrancado como token proprio, antes de tudo.
 *
 * ⚠️ E O QUE SOBRA AINDA PODE TER ANO: "saoluizrs_22_1.png" deixa "saoluizrs_22".
 * Dois digitos no fim, depois de underscore, sao temporada — nunca clube.
 */
function partes(arquivo) {
  const base = arquivo.replace(/\.[a-z0-9]+$/i, "")
  // O DIGITO FINAL vem primeiro, com ou sem separador — e o caso dominante
  // ("goias1.png", "abcrn_1.png"). Sem esta regra propria, um `([a-z0-9]+)$`
  // engole o nome inteiro e nenhum arquivo colado tem variante.
  let m = base.match(/^(.*?)[\s_-]*(\d)$/)
  let ultimo = m?.[2] ?? null
  if (!m) {
    // Palavra no fim, separada ("Portuguesa 1 Casa.png").
    m = base.match(/^(.*?)[\s_-]+([a-z]+)$/i)
    ultimo = m?.[2] ?? base
  }
  let variante = null
  if (m) for (const [re, v] of VARIANTES_POR_PALAVRA) if (re.test(m[2])) { variante = v; break }
  if (!variante) return { slug: null, variante: null, ultimo }
  // ⚠️ O QUE SOBRA AINDA PODE TER ANO: "saoluizrs_22_1.png" deixa "saoluizrs_22".
  // Dois digitos no fim, depois de separador, sao temporada — nunca clube.
  const slug = m[1].replace(/[\s_-]+(19|20)?\d{2}$/, "").replace(/[\s_-]+$/, "")
  return { slug: slug || m[1], variante }
}

const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"])

const semAcento = (s) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const norm = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "")

// ⚠️ SO PALAVRA INTEIRA, e "atletico" NAO entra: no Brasil ela e o nome, e sem
// ela Atletico-GO/-MG/-PR ficam com a mesma chave. (Mesma lista do script de
// escudos, pelo mesmo motivo.)
const SOCIEDADE = new Set([
  "fc", "ac", "sc", "ec", "cf", "cd", "ca", "afc", "cfc", "ad", "sd", "ud",
  "as", "us", "ss", "aa", "clube", "club", "futebol", "esporte", "esportivo",
  "esportiva", "sociedade", "associacao", "desportivo", "desportiva",
  "recreativo", "recreativa", "de", "da", "do", "e",
])

/** Nome comparavel sem as palavras de sociedade. O hifen SEPARA palavra (o seed
 *  escreve "Botafogo-PB"); o ponto, nao ("A.C Monza"). */
function chaveNome(nome) {
  const palavras = semAcento(nome ?? "").split(/[\s\u2013-]+/)
    .map(p => p.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean)
  const uteis = palavras.filter(p => !SOCIEDADE.has(p))
  return (uteis.length ? uteis : palavras).join("")
}

const seed = JSON.parse(await readFile(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf8"))
const times = (seed.teams ?? []).filter(t => t.fileKey && t.nome)
const porFileKey = new Map(times.map(t => [t.fileKey, t]))

// ─── O CATALOGO CURADO, e por que ele decide se a camisa aparece ─────────────
//
// ⚠️ ESTE E O ERRO QUE CUSTOU UM LOTE INTEIRO. O universo de casamento e o POOL
// (imported-bf2026, ~3 mil clubes), mas quem a TELA desenha nas Series A/B/C/D
// sao os arrays CURADOS de lib/teams-data.ts — e o mesmo clube costuma existir
// nos dois, com chaves DIFERENTES: "Santa Cruz" e `santa` no pool e
// `santacruz_pe` no curado; "Trem" e `ap_trem` e `trem_ap`. Publicando so na
// chave do pool, 17 dos 83 clubes do primeiro lote receberam uma camisa que o
// jogo nunca consulta — sem erro nenhum, como sempre.
//
// O pool NAO e inutil: clube que so existe la e mostrado por essa chave mesmo
// (`completarLigaComPool`). Por isso a saida leva as DUAS chaves quando as duas
// existem, em vez de trocar uma pela outra.
const fonteCurada = await readFile(path.join(RAIZ, "lib/teams-data.ts"), "utf8")
  + "\n" + await readFile(path.join(RAIZ, "lib/international-teams.ts"), "utf8")
const curadoPorNome = new Map()
const chavesCuradas = new Set()
// Cada clube curado e um objeto sem chaves aninhadas — `{...}` sem `{` dentro basta.
for (const m of fonteCurada.matchAll(/\{[^{}]*\}/g)) {
  const fk = m[0].match(/file_key:\s*"([^"]+)"/)
  const nm = m[0].match(/(?:^|[\s,{])nome:\s*"([^"]+)"/) // `estadio_nome` tambem casa "nome:"
  if (!fk || !nm) continue
  chavesCuradas.add(fk[1])
  const k = norm(nm[1])
  if (!curadoPorNome.has(k)) curadoPorNome.set(k, fk[1])
}

/** A chave curada equivalente a este clube do pool, se houver e for outra. */
function gemeoCurado(time) {
  if (chavesCuradas.has(time.fileKey)) return null
  const g = curadoPorNome.get(norm(time.nome))
  return g && g !== time.fileKey ? g : null
}

// ─── Divisao ─────────────────────────────────────────────────────────────────
//
// ⚠️ O CAMPO `divisao` DO SEED NAO SERVE: TODO clube esta gravado como "Série A"
// (os 2.994). Quem sabe a divisao de 2026 e data/seeds/division_overrides_2026,
// que lista os clubes POR NOME.
const DIVISOES = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/division_overrides_2026.json"), "utf8"))
const divisaoDoNome = new Map()
for (const [chave, nomes] of Object.entries(DIVISOES)) {
  const letra = chave.replace("serie_", "")
  for (const n of nomes) divisaoDoNome.set(norm(n), letra)
}
// ⚠️ O SLUG DO ARQUIVO E A SEGUNDA CHANCE. Dezenas de clubes do pool tem o campo
// `nome` trocado pelo do estadio — `lagarto_se` se chama "Barretão" —, e como o
// override lista por nome, esses clubes cairiam como "sem divisao" e o uniforme
// deles nunca sairia, sem nada acusar. O slug do arquivo ("lagarto") acha.
const divisaoDe = (time, slug) =>
  divisaoDoNome.get(norm(time.nome)) ?? (slug ? divisaoDoNome.get(norm(slug)) ?? null : null)

// ⚠️ PROVA DE BRASILIDADE, usada SO PARA DESEMPATAR homonimo (Guarani-SP x
// Guarani do Paraguai, Portuguesa x Portuguesa da Venezuela).
//
// ⚠️ NAO SERVE DE FILTRO GERAL: o campo `pais` do seed guarda lixo em dezenas de
// clubes brasileiros ("CAXIAS", "JUVENTUDE", "FORTALEZA", "SANTA"), e exigir
// esta prova de todo mundo derrubou 16 clubes de B/C/D que estavam certos.
// Tampouco da para usar a DIVISAO como indicio de brasilidade: o override casa
// por nome e o xara paraguaio saia classificado como Serie C.
const ehBrasileiro = (t) =>
  norm(t.pais) === "brasil" || /_bra$/i.test(t.fileKey) || UFS.has((t.estado || t.pais || "").toUpperCase())

// ─── Camadas de casamento ────────────────────────────────────────────────────
const camadas = [
  { nome: "fileKey", chave: (t) => [norm(t.fileKey)] },
  { nome: "fileKey sem pais", chave: (t) => [norm(t.fileKey.replace(/_bra$/i, ""))] },
  {
    nome: "nome",
    chave: (t) => {
      const uf = norm(t.estado || ((t.pais ?? "").length === 2 ? t.pais : ""))
      return uf ? [norm(t.nome), norm(t.nome) + uf] : [norm(t.nome)]
    },
  },
  {
    nome: "nome sem sociedade",
    chave: (t) => {
      const uf = norm(t.estado || ((t.pais ?? "").length === 2 ? t.pais : ""))
      return uf ? [chaveNome(t.nome), chaveNome(t.nome) + uf] : [chaveNome(t.nome)]
    },
  },
].map(c => {
  const mapa = new Map()
  for (const t of times) {
    for (const k of c.chave(t)) {
      if (!k || k.length < 3) continue
      if (!mapa.has(k)) mapa.set(k, [])
      if (!mapa.get(k).includes(t)) mapa.get(k).push(t)
    }
  }
  return { ...c, mapa }
})

/** Devolve { time } | { ambiguo: [...] } | { nada: true } */
function acharClube(slug) {
  if (clubeForcado) {
    const t = porFileKey.get(clubeForcado)
    if (!t) throw new Error(`--clube ${clubeForcado} nao existe no seed`)
    return { time: t }
  }
  const manual = MAPA_MANUAL.get(norm(slug))
  if (manual) {
    const t = porFileKey.get(manual)
    if (!t) throw new Error(`MAPA_MANUAL aponta para ${manual}, que nao existe no seed`)
    return { time: t, via: "mapa manual" }
  }
  const alvo = norm(slug)
  let ambiguo = null
  for (const camada of camadas) {
    const c = camada.mapa.get(alvo)
    if (!c?.length) continue
    if (c.length === 1) return { time: c[0], via: camada.nome }
    // ⚠️ PASTA BRASILEIRA: homonimo estrangeiro nao e candidato. E o que separa
    // Portuguesa da Venezuela, Guarani do Paraguai e Santos Laguna.
    const br = c.filter(ehBrasileiro)
    if (br.length === 1) return { time: br[0], via: `${camada.nome} (so o brasileiro)` }
    ambiguo = ambiguo ?? (br.length ? br : c)
  }
  return ambiguo ? { ambiguo } : { nada: true }
}

// ─── Leitura da pasta ────────────────────────────────────────────────────────
const arquivos = (await readdir(pasta)).filter(f => /\.(png|jpe?g|webp)$/i.test(f))
if (arquivos.length === 0) {
  console.error("pasta sem imagem")
  process.exit(1)
}

const porClube = new Map()
const semVariante = []
const semClube = []
const ambiguos = []
const foraDaDivisao = new Map()
const duplicados = []

for (const arquivo of arquivos.sort()) {
  const { slug, variante, ultimo } = partes(arquivo)
  if (!variante) { semVariante.push(`${arquivo}${ultimo ? ` (fim: "${ultimo}")` : ""}`); continue }

  let achado
  try {
    achado = acharClube(slug)
  } catch (e) {
    semClube.push(`${arquivo}: ${e.message}`)
    continue
  }
  if (achado.ambiguo) {
    ambiguos.push(`${slug}: ${achado.ambiguo.map(t => `${t.fileKey}[${t.nome}/${t.estado || t.pais}]`).join("  ")}`)
    continue
  }
  if (achado.nada) { semClube.push(`${arquivo} (slug "${slug}")`); continue }

  const time = achado.time
  const div = divisaoDe(time, slug)
  if (divisoesPedidas.length && !divisoesPedidas.includes(div ?? "")) {
    const chave = `${time.fileKey} [${time.nome}] — ${div ? `Serie ${div.toUpperCase()}` : "sem divisao no override"}`
    foraDaDivisao.set(chave, (foraDaDivisao.get(chave) ?? 0) + 1)
    continue
  }

  if (!porClube.has(time.fileKey)) porClube.set(time.fileKey, { time, div, via: achado.via, kits: {} })
  const alvo = porClube.get(time.fileKey)
  const origem = path.join(pasta, arquivo)
  const quando = statSync(origem).mtimeMs
  const anterior = alvo.kits[variante]
  if (anterior) {
    // ⚠️ DOIS ARQUIVOS PARA A MESMA VARIANTE: a pasta tem "amazonas1.png" E
    // "amazonas_1.png", que sao o MESMO clube em temporadas diferentes (2024 e
    // 2022). Vence o mais RECENTE — a ordem alfabetica acertava por acaso,
    // porque "1" vem antes de "_" na tabela, e erraria na primeira pasta que
    // usasse outra convencao.
    const fica = quando > anterior.quando ? { arquivo, origem, quando } : anterior
    const sai = fica === anterior ? arquivo : anterior.arquivo
    duplicados.push(`${time.fileKey}/${variante}: fica "${fica.arquivo}" (${new Date(fica.quando).toISOString().slice(0, 10)}), ignorado "${sai}"`)
    alvo.kits[variante] = fica
    continue
  }
  alvo.kits[variante] = { arquivo, origem, quando }
}

// ─── Conversao ───────────────────────────────────────────────────────────────
const clubes = []
const comGemeo = []
for (const { time, div, via, kits } of [...porClube.values()].sort((a, b) => a.time.nome.localeCompare(b.time.nome))) {
  const saida = {}
  const linhas = []
  for (const [v, k] of Object.entries(kits)) {
    // trim antes do resize: a margem transparente varia por arquivo e sem tirar
    // ela cada variante fica com a camisa de um tamanho na tela.
    const buf = await sharp(k.origem)
      .trim()
      .resize(LADO, LADO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toBuffer()
    saida[v] = { data: `data:image/webp;base64,${buf.toString("base64")}` }
    linhas.push(`${v} ${(buf.length / 1024).toFixed(0)}KB`)
  }
  const gemeo = gemeoCurado(time)
  console.log(`  ${time.nome} (${time.fileKey}${gemeo ? " + " + gemeo : ""}) ${div ? "[" + div.toUpperCase() + "]" : ""}: ${linhas.join(" | ")}   ← ${via}`)
  clubes.push({ file_key: time.fileKey, kits: saida })
  // A MESMA arte na chave curada: e ela que a tela consulta nas divisoes.
  if (gemeo) { clubes.push({ file_key: gemeo, kits: saida }); comGemeo.push(`${time.fileKey} + ${gemeo} [${time.nome}]`) }
}

console.log(`\n${clubes.length} chaves (${clubes.length - comGemeo.length} clubes) | ${clubes.reduce((s, c) => s + Object.keys(c.kits).length, 0)} pecas`)
if (comGemeo.length) {
  console.log(`\nPUBLICADO NAS DUAS CHAVES — pool + curada (${comGemeo.length}):`)
  for (const g of comGemeo) console.log("  = " + g)
}
if (duplicados.length) { console.log("\nARQUIVO REPETIDO PARA A MESMA VARIANTE:"); for (const d of duplicados) console.log("  ! " + d) }
if (ambiguos.length) { console.log("\nAMBIGUO (resolva no MAPA_MANUAL ou com --clube):"); for (const a of ambiguos) console.log("  ? " + a) }
if (semClube.length) { console.log("\nSEM CLUBE NO SEED:"); console.log("  " + semClube.join("\n  ")) }
if (semVariante.length) { console.log("\nSEM VARIANTE RECONHECIVEL:"); console.log("  " + semVariante.join("\n  ")) }
if (foraDaDivisao.size) {
  console.log(`\nFORA DAS DIVISOES PEDIDAS (${divisoesPedidas.join(",")}): ${foraDaDivisao.size} clubes`)
  for (const [k, n] of foraDaDivisao) console.log(`  - ${k} (${n} arquivos)`)
}

if (!exportar) {
  console.log("\nEnsaio. Use --exportar <arquivo> para gravar o pacote.")
} else {
  await writeFile(path.resolve(exportar), JSON.stringify({ clubes }, null, 1), "utf8")
  console.log(`\nExportado para ${path.resolve(exportar)}`)
}
