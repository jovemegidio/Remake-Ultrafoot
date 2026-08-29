// ELENCOS REAIS DO FUTEBOL FEMININO.
//
// A 1.0.322 trouxe 21 ligas femininas com 282 clubes e ZERO atleta real: os
// elencos eram inteiramente gerados, e a tela de criação dizia isso. Este script
// preenche o buraco.
//
// POR QUE WIKIPEDIA, e não Transfermarkt (que é a fonte do masculino): medido em
// 15/08/2026, a busca do TM em pt-BR **não indexa clube feminino** — as consultas
// "Corinthians Feminino", "Corinthians (F)" e "Corinthians Frauen" voltam vazias,
// e os códigos de competição feminina redirecionam para o índice nacional. A
// Wikipedia tem a página do clube feminino com o elenco em `{{fs player}}`, uma
// API estável e sem bloqueio de robô.
//
// AS TRÊS TRAVAS CONTRA IMPORTAR O CLUBE ERRADO (este projeto já juntou clubes
// distintos por casamento de nome frouxo — ver os homônimos do import do TM):
//   1. o título da página tem de conter o NÚCLEO do nome do clube;
//   2. a página tem de ser reconhecidamente feminina (título com "women"/
//      "feminino"/"féminines"/"frauen" ou categoria de futebol feminino);
//   3. o elenco tem de ter ao menos 11 atletas E um goleiro — página de clube
//      masculino homônimo raramente passa nas três ao mesmo tempo, e o que não
//      passa fica de fora com o motivo registrado no relatório.
//
// Uso:
//   node scripts/import-elencos-femininos.mjs --limit 10    (teste)
//   node scripts/import-elencos-femininos.mjs               (tudo, retomando)
//
// Seguro para interromper: grava a cada clube e retoma de onde parou.

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const SAIDA = path.resolve("data/seeds/elencos-femininos.json")
const RELATORIO = path.resolve("data/seeds/elencos-femininos-relatorio.json")
const UA = "UltrafootBot/1.0 (import de elencos do futebol feminino; contato via github.com/jovemegidio/Ultrafoot)"
/** Sobe quando o parser muda: clube gravado com versão antiga é refeito. */
const PARSER_V = 1

const args = process.argv.slice(2)
const limite = Number(args[args.indexOf("--limit") + 1]) || Infinity
const somente = args.includes("--clube") ? args[args.indexOf("--clube") + 1] : null

// ─── Fonte dos clubes: o próprio cadastro do jogo ────────────────────────────
//
// Ler o cadastro em vez de repetir a lista aqui é o que impede as duas listas de
// divergirem — clube novo em `lib/futebol-feminino.ts` entra na importação sem
// ninguém lembrar de editar este arquivo.
async function clubesDoCadastro() {
  const fonte = await readFile(path.resolve("lib/futebol-feminino.ts"), "utf-8")
  const clubes = []
  let liga = null
  for (const linha of fonte.split("\n")) {
    const cabecalho = linha.match(/id:\s*"([a-z0-9_]+)",\s*nome:\s*"([^"]+)"/)
    if (cabecalho) { liga = { id: cabecalho[1], nome: cabecalho[2] } }
    const pais = linha.match(/pais:\s*"([^"]+)",\s*codigoPais/)
    if (pais && liga) liga.pais = pais[1]
    const clube = linha.match(/\{\s*nome:\s*"([^"]+)",\s*cidade:\s*"([^"]+)"/)
    if (clube && liga) {
      clubes.push({
        nome: clube[1], cidade: clube[2], liga: liga.id, ligaNome: liga.nome, pais: liga.pais ?? "",
        // `base` = existe clube MASCULINO de mesmo nome no catálogo. Muda a
        // trava do casamento (ver `acharPagina`).
        temMasculino: /\bbase:\s*"/.test(linha),
      })
    }
  }
  return clubes
}

// ─── Wikipedia ──────────────────────────────────────────────────────────────

const IDIOMA_POR_PAIS = {
  Brasil: "pt", Portugal: "pt", Espanha: "es", Mexico: "es", Colombia: "es",
  Argentina: "es", Chile: "es", Franca: "fr", Italia: "it", Alemanha: "de",
}

async function api(idioma, params) {
  const url = `https://${idioma}.wikipedia.org/w/api.php?${new URLSearchParams({ ...params, format: "json", formatversion: "2" })}`
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const resposta = await fetch(url, { headers: { "User-Agent": UA } })
      if (resposta.status === 429) { await esperar(4000 * (tentativa + 1)); continue }
      if (!resposta.ok) return null
      return await resposta.json()
    } catch { await esperar(1500 * (tentativa + 1)) }
  }
  return null
}

const esperar = ms => new Promise(r => setTimeout(r, ms))

const semAcento = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Palavras que não identificam clube nenhum — não servem para conferir o casamento. */
const RUIDO = new Set([
  "fc", "cf", "sc", "ec", "ac", "afc", "cd", "ud", "club", "clube", "de", "da", "do",
  "the", "futebol", "football", "feminino", "femenino", "women", "frauen", "city", "united",
  "atletico", "athletic", "sporting", "real", "deportivo", "deportes",
])

function nucleoDoNome(nome) {
  return semAcento(nome).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(p => p.length > 2 && !RUIDO.has(p))
}

const MARCAS_FEMININAS = ["women", "feminino", "femenino", "feminina", "feminines", "féminines", "frauen", "femminile", "damer", "kvinner", "(f)", "vrouwen"]

function pareceFeminina(titulo) {
  const t = semAcento(titulo)
  return MARCAS_FEMININAS.some(m => t.includes(semAcento(m)))
}

/**
 * Titulos que NUNCA sao a pagina de elenco de um clube.
 *
 * ⚠️ ISTO NASCEU DE TRES CASAMENTOS ERRADOS MEDIDOS EM 28/08/2026, todos
 * aprovados pelas travas 1 e 2 porque tinham o nucleo do nome E a marca
 * feminina no titulo:
 *
 *   Arsenal                -> "Arsenal Women 11-1 Bristol City Women"  (sumula)
 *   Athletico Paranaense   -> "Campeonato Paranaense de Futebol Feminino"  (competicao)
 *   Valencia               -> "Valencia Basket (women)"  (BASQUETE)
 *
 * As travas cuidavam de "e feminino?" e "e este clube?" — e nenhuma perguntava
 * "isto e um clube?". O Arsenal tem pagina de elenco com 34 atletas em
 * "Arsenal W.F.C."; ele so nunca foi tentado.
 */
function paginaImprestavel(titulo) {
  const t = semAcento(titulo)
  return (
    /\d+\s*[-–]\s*\d+/.test(titulo) ||          // sumula: "11-1", "3–2"
    / vs\.? /i.test(titulo) ||
    t.startsWith("list of") || t.includes("seasons") ||
    /\b(campeonato|championship|league|liga|copa|cup|torneio|tournament|supercopa)\b/i.test(t) ||
    /\b(basket|basquete|handball|volleyball|voleibol|futsal|rugby|hockey)\b/i.test(t)
  )
}

/**
 * Os titulos que a en.wikipedia usa para clube feminino, tentados ANTES da
 * busca. Sao exatos e baratos: se "Arsenal W.F.C." existe, nao ha por que
 * peneirar oito resultados de busca e ficar com uma sumula de jogo.
 */
function titulosDiretos(nome) {
  return [`${nome} W.F.C.`, `${nome} Women`, `${nome} (women)`]
}

/**
 * Acha a página do clube FEMININO. Devolve `{ idioma, titulo }` ou null.
 *
 * ⚠️ INGLÊS PRIMEIRO, mesmo para clube brasileiro. Medido em 15/08/2026: a
 * pt.wikipedia do Corinthians feminino resolve certo (o título está correto) e
 * simplesmente **não tem seção de elenco** — cinco dos seis primeiros clubes
 * caíram por "elenco curto (0)". A en.wikipedia usa `{{Fs player}}` de forma
 * consistente em praticamente todo clube feminino do mundo. O idioma local fica
 * como segunda tentativa, para o que o inglês não cobrir.
 */
/** Quantas páginas tentar por clube antes de desistir. */
const MAXIMO_DE_CANDIDATOS = 4

async function acharPagina(clube) {
  const idiomas = ["en", IDIOMA_POR_PAIS[clube.pais] ?? "en"].filter((v, i, a) => a.indexOf(v) === i)
  const nucleo = nucleoDoNome(clube.nome)
  // ⚠️ DEVOLVE UMA LISTA, NÃO UMA PÁGINA. Antes esta função entregava o PRIMEIRO
  // resultado que passasse nas travas, e o chamador desistia do clube se aquela
  // página não tivesse elenco — sem nunca tentar a segunda. Era assim que o
  // Arsenal ficava de fora tendo 34 atletas publicadas em "Arsenal W.F.C.".
  const achados = titulosDiretos(clube.nome).map(titulo => ({ idioma: "en", titulo }))
  for (const idioma of idiomas) {
    const consultas = idioma === "en"
      ? [`${clube.nome} women`, `${clube.nome} women's football club`]
      : [`${clube.nome} futebol feminino`, `${clube.nome} feminino`, `${clube.nome} femenino`]
    for (const consulta of consultas) {
      const dados = await api(idioma, { action: "query", list: "search", srsearch: consulta, srlimit: "8" })
      for (const achado of dados?.query?.search ?? []) {
        const titulo = achado.title
        // TRAVA 2 — e a exceção que a primeira rodada obrigou a escrever.
        //
        // Exigir "women"/"feminino" no TÍTULO protege contra importar o elenco
        // masculino do clube homônimo. Só que **clube que só existe no futebol
        // feminino não tem homônimo nenhum** — e o título dele não traz a
        // marca: a NWSL inteira ("Portland Thorns FC", "Kansas City Current"),
        // o Fleury 91, o UAI Urquiza. Resultado medido na primeira rodada: 14
        // clubes da NWSL rejeitados por uma trava que ali não protegia de nada.
        //
        // A trava vale, então, para quem TEM clube masculino no catálogo. Para
        // os outros sobra a trava 3 (elenco com 11+ atletas e uma goleira), que
        // é a que realmente separa página de elenco de página de qualquer coisa.
        if (clube.temMasculino && !pareceFeminina(titulo)) continue
        // TRAVA 1: o núcleo do nome tem de estar no título.
        const t = semAcento(titulo)
        if (nucleo.length && !nucleo.some(p => t.includes(p))) continue
        // TRAVA 4 (1.0.379): não é súmula, competição, lista nem outro esporte.
        if (paginaImprestavel(titulo)) continue
        if (!achados.some(a => a.titulo === titulo)) achados.push({ idioma, titulo })
        if (achados.length >= MAXIMO_DE_CANDIDATOS) return achados
      }
      await esperar(180)
    }
  }
  return achados
}

// ─── Parser do elenco ───────────────────────────────────────────────────────

/** `{{fs player|no=9|nat=BRA|name=Fulana|pos=FW|other=...}}` */
function extrairElenco(wikitext) {
  const atletas = []
  const regex = /\{\{\s*fs\s*player\s*\|([^}]*)\}\}/gi
  let m
  while ((m = regex.exec(wikitext))) {
    const campos = {}
    for (const parte of m[1].split("|")) {
      const [chave, ...resto] = parte.split("=")
      if (!resto.length) continue
      campos[chave.trim().toLowerCase()] = resto.join("=").trim()
    }
    const nome = limparNome(campos.name ?? campos.player ?? "")
    if (!nome) continue
    atletas.push({
      n: nome,
      p: mapearPosicao(campos.pos ?? ""),
      c: (campos.nat ?? "").toUpperCase().slice(0, 3) || undefined,
      no: Number(campos.no) || undefined,
    })
  }
  return atletas
}

function limparNome(cru) {
  return cru
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")   // [[Página|Nome]] -> Nome
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Códigos da Wikipedia -> posições do jogo. */
function mapearPosicao(cru) {
  const p = cru.toUpperCase().replace(/[^A-Z]/g, "")
  if (p.startsWith("GK")) return "GOL"
  if (p === "DF" || p === "CB") return "ZAG"
  if (p === "RB" || p === "RWB") return "LD"
  if (p === "LB" || p === "LWB") return "LE"
  if (p === "DM" || p === "CDM") return "VOL"
  if (p === "MF" || p === "CM" || p === "AM") return "MEI"
  if (p === "RW" || p === "RM") return "PD"
  if (p === "LW" || p === "LM") return "PE"
  if (p === "FW" || p === "CF" || p === "ST") return "ATA"
  return "MEI"
}

// ─── Execução ───────────────────────────────────────────────────────────────

async function main() {
  const clubes = (await clubesDoCadastro()).filter(c => !somente || c.nome === somente)
  console.log(`clubes no cadastro: ${clubes.length}`)

  const acervo = existsSync(SAIDA) ? JSON.parse(await readFile(SAIDA, "utf-8")) : {}
  const relatorio = existsSync(RELATORIO) ? JSON.parse(await readFile(RELATORIO, "utf-8")) : {}

  let feitos = 0, novos = 0, semPagina = 0, curtos = 0
  for (const clube of clubes) {
    if (feitos >= limite) break
    const chave = `${clube.liga}|${clube.nome}`
    if (acervo[chave]?.v === PARSER_V) continue
    feitos++

    const candidatos = await acharPagina(clube)
    if (!candidatos.length) {
      relatorio[chave] = { motivo: "sem pagina feminina na wikipedia" }
      semPagina++
      continue
    }

    // Tenta uma a uma até alguma trazer elenco de verdade. A TRAVA 3 (11+
    // atletas com goleira) deixa de ser um veredito sobre o clube e passa a ser
    // o que sempre deveria ter sido: o teste que diz se ESTA página serve.
    let escolhida = null
    let elenco = []
    const tentadas = []
    for (const pagina of candidatos) {
      const dados = await api(pagina.idioma, { action: "parse", page: pagina.titulo, prop: "wikitext" })
      const wikitext = dados?.parse?.wikitext ?? ""
      const achado = extrairElenco(wikitext)
      tentadas.push(`${pagina.titulo} (${achado.length})`)
      if (achado.length >= 11 && achado.some(a => a.p === "GOL")) {
        escolhida = pagina
        elenco = achado
        break
      }
      await esperar(180)
    }

    if (!escolhida) {
      relatorio[chave] = { motivo: `elenco curto`, tentadas }
      curtos++
      continue
    }
    const pagina = escolhida

    acervo[chave] = { v: PARSER_V, fonte: `${pagina.idioma}.wikipedia:${pagina.titulo}`, atletas: elenco }
    relatorio[chave] = { ok: elenco.length, pagina: pagina.titulo, tentadas }
    novos++
    if (novos % 5 === 0) {
      await mkdir(path.dirname(SAIDA), { recursive: true })
      await writeFile(SAIDA, JSON.stringify(acervo))
      await writeFile(RELATORIO, JSON.stringify(relatorio, null, 2))
      console.log(`  ... ${novos} elencos importados`)
    }
    await esperar(220)
  }

  await mkdir(path.dirname(SAIDA), { recursive: true })
  await writeFile(SAIDA, JSON.stringify(acervo))
  await writeFile(RELATORIO, JSON.stringify(relatorio, null, 2))
  const total = Object.keys(acervo).length
  console.log(`\nimportados agora: ${novos} | sem pagina: ${semPagina} | elenco curto: ${curtos}`)
  console.log(`acervo total: ${total} clubes com elenco real`)
}

main()
