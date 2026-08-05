// CRIA CLUBES no catalogo curado a partir do Transfermarkt, com elenco real.
//
//   node scripts/importar-clubes-tm.mjs --lote coreia --ensaio
//   node scripts/importar-clubes-tm.mjs --lote coreia --gravar
//
// Existe porque ligar uma divisao nova as vezes exige CLUBE, e nao so
// configuracao: a K League 2 estava declarada, com nome, premio e acesso, e o
// pool nao tinha um unico clube coreano livre para preenche-la.
//
// O que ele grava, quando `--gravar`:
//   1. as linhas de `Team` prontas para `lib/international-teams.ts` (num arquivo
//      a parte — colar e trabalho de quem revisa, nao do script);
//   2. o ELENCO REAL em `data/seeds/real-squads-tm.json`, na chave
//      `CURTO|nome normalizado`, que e como `getRealSquad` procura.
//
// ⚠️ O overall NAO vem do TM (que nao tem esse conceito) — e derivado do valor
// de mercado pela MESMA curva de `apply-tm-real-overalls.mjs`, com os mesmos
// ajustes de idade e de goleiro. Duplicar a formula aqui seria criar uma segunda
// verdade; ela e copiada com este aviso ate alguem extrai-la para um modulo.

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseSquad } from "./import-tm-squads.mjs"

const RAIZ = path.resolve(import.meta.dirname, "..")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
const args = process.argv.slice(2)
const opt = n => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const gravar = args.includes("--gravar")
const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Igual a `normalizeTeamName` de players-data: e ela que forma a chave. */
const nomeChave = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// ── Overall a partir do valor (copia de apply-tm-real-overalls.mjs) ──────────
function ajusteIdade(idade) {
  if (idade == null) return 0
  if (idade <= 19) return -5
  if (idade === 20) return -4
  if (idade === 21) return -3
  if (idade === 22) return -2
  if (idade === 23) return -1
  if (idade <= 29) return 0
  if (idade === 30) return 1
  if (idade === 31) return 2
  if (idade === 32) return 3
  if (idade === 33) return 4
  return 5
}
function overallDoValor(valor, idade, pos) {
  if (!valor || valor < 10000) return null
  let ov = 10 * Math.log10(valor) + 9
  ov += ajusteIdade(idade)
  if (pos === "GOL" || pos === "GL") ov += 2
  return Math.max(45, Math.min(91, Math.round(ov)))
}

/** "€ 1,20 mi" / "€ 350 mil" -> euros. */
function valorEmEuros(txt) {
  const m = (txt ?? "").match(/€\s*([\d.,]+)\s*(mi|mil|bi)?/i)
  if (!m) return null
  const n = Number(m[1].replace(/\./g, "").replace(",", "."))
  if (!Number.isFinite(n)) return null
  const u = (m[2] ?? "").toLowerCase()
  return Math.round(n * (u === "bi" ? 1e9 : u === "mi" ? 1e6 : u === "mil" ? 1e3 : 1))
}

/** O valor de mercado por atleta, que o parseSquad nao le. */
function valoresPorTmId(html) {
  const mapa = new Map()
  for (const linha of html.split(/<tr class="(?:odd|even)[^"]*">/).slice(1)) {
    const id = linha.match(/\/profil\/spieler\/(\d+)"/)
    if (!id) continue
    const v = linha.match(/<td class="rechts hauptlink">[\s\S]*?>([^<]*€[^<]*)</)
      ?? linha.match(/(€\s*[\d.,]+\s*(?:mi|mil|bi)?)/)
    if (v) mapa.set(id[1], valorEmEuros(v[1]))
  }
  return mapa
}

/**
 * Nome e capacidade do estadio, da propria pagina do clube.
 *
 * ⚠️ O rotulo e a "Estádio:" SOLTO dentro de um `<li class="data-header__label">`
 * — nao ha `</span>` antes dele, e o nome so aparece no `<a href=".../stadion/">`
 * seguinte. Procurando `Estádio:</span>` o nome vinha sempre nulo e cada clube
 * entrava com um "<Cidade> Stadium" inventado, enquanto a capacidade (que vem do
 * `<span class="tabellenplatz">` logo depois) chegava certa — ou seja, o defeito
 * passava batido no relatorio.
 */
function estadioDaPagina(html) {
  const bloco = html.match(/Est[aá]dio:[\s\S]{0,400}?<a[^>]*\/stadion\/[^"]*"[^>]*>([^<]+)<\/a>[\s\S]{0,120}?([\d.]+)\s*lugares/i)
  if (bloco) return { nome: bloco[1].trim(), cap: Number(bloco[2].replace(/\./g, "")) }
  const nome = html.match(/<a[^>]*\/stadion\/verein\/\d+"[^>]*>([^<]+)</i)
  const cap = html.match(/([\d.]{4,})\s*lugares/i)
  return {
    nome: nome ? nome[1].trim() : null,
    cap: cap ? Number(cap[1].replace(/\./g, "")) : null,
  }
}

// ── Lotes ────────────────────────────────────────────────────────────────────
//
// Cada entrada traz o que o TM NAO da (cores, prestigio, torcida, caixa) e o
// endereco de onde vem o resto. Prestigio e caixa seguem a escala das divisoes
// vizinhas do proprio jogo, nao um chute solto.
const LOTES = {
  coreia: [
    // K League 1 — os tres que faltavam para os 12 da edicao real
    { nome: "Gangwon FC", curto: "GAN", cidade: "Chuncheon", cor1: "#F47920", cor2: "#1D1D1B", prestigio: 62, torcida: 8000000, saldo: 14000000, file_key: "gangwon_fc", divisao: "k_league_1", tm: "gangwon-fc/startseite/verein/21459" },
    { nome: "FC Anyang", curto: "ANY", cidade: "Anyang", cor1: "#5A2D82", cor2: "#FFFFFF", prestigio: 58, torcida: 5000000, saldo: 10000000, file_key: "fc_anyang", divisao: "k_league_1", tm: "fc-anyang/startseite/verein/38898" },
    { nome: "Bucheon FC 1995", curto: "BUC", cidade: "Bucheon", cor1: "#E4032E", cor2: "#000000", prestigio: 56, torcida: 4000000, saldo: 9000000, file_key: "bucheon_fc", divisao: "k_league_1", tm: "bucheon-fc-1995/startseite/verein/35759" },
    // K League 2 — a divisao inteira
    { nome: "Suwon FC", curto: "SWF", cidade: "Suwon", cor1: "#0B5CA5", cor2: "#FFFFFF", prestigio: 55, torcida: 6000000, saldo: 9000000, file_key: "suwon_fc", divisao: "k_league_2", tm: "suwon-fc/startseite/verein/31622" },
    { nome: "Busan IPark", curto: "BUS", cidade: "Busan", cor1: "#E4032E", cor2: "#000000", prestigio: 54, torcida: 9000000, saldo: 8000000, file_key: "busan_ipark", divisao: "k_league_2", tm: "busan-ipark/startseite/verein/2582" },
    { nome: "Seoul E-Land", curto: "SEL", cidade: "Seul", cor1: "#00A0E9", cor2: "#000000", prestigio: 52, torcida: 4000000, saldo: 8000000, file_key: "seoul_eland", divisao: "k_league_2", tm: "seoul-e-land/startseite/verein/46292" },
    { nome: "Jeonnam Dragons", curto: "JND", cidade: "Gwangyang", cor1: "#F5A623", cor2: "#000000", prestigio: 53, torcida: 5000000, saldo: 8000000, file_key: "jeonnam_dragons", divisao: "k_league_2", tm: "jeonnam-dragons/startseite/verein/6503" },
    { nome: "Gyeongnam FC", curto: "GYE", cidade: "Changwon", cor1: "#E4032E", cor2: "#FFFFFF", prestigio: 50, torcida: 3000000, saldo: 7000000, file_key: "gyeongnam_fc", divisao: "k_league_2", tm: "gyeongnam-fc/startseite/verein/16696" },
    { nome: "Chungnam Asan", curto: "CNA", cidade: "Asan", cor1: "#0B4DA2", cor2: "#FFFFFF", prestigio: 49, torcida: 2000000, saldo: 6000000, file_key: "chungnam_asan", divisao: "k_league_2", tm: "chungnam-asan/startseite/verein/78388" },
    { nome: "Ansan Greeners", curto: "ANS", cidade: "Ansan", cor1: "#00A651", cor2: "#FFFFFF", prestigio: 47, torcida: 1500000, saldo: 6000000, file_key: "ansan_greeners", divisao: "k_league_2", tm: "ansan-greeners/startseite/verein/57434" },
    { nome: "Chungbuk Cheongju", curto: "CBC", cidade: "Cheongju", cor1: "#8DC63F", cor2: "#000000", prestigio: 46, torcida: 1200000, saldo: 5000000, file_key: "chungbuk_cheongju", divisao: "k_league_2", tm: "cheongju-fc/startseite/verein/39418" },
    { nome: "Cheonan City", curto: "CHC", cidade: "Cheonan", cor1: "#00539F", cor2: "#FFFFFF", prestigio: 45, torcida: 1200000, saldo: 5000000, file_key: "cheonan_city", divisao: "k_league_2", tm: "cheonan-city/startseite/verein/31168" },
    { nome: "Gimpo FC", curto: "GMP", cidade: "Gimpo", cor1: "#F9B233", cor2: "#000000", prestigio: 46, torcida: 1000000, saldo: 5000000, file_key: "gimpo_fc", divisao: "k_league_2", tm: "gimpo-citizen/startseite/verein/39429" },
    { nome: "Hwaseong FC", curto: "HWS", cidade: "Hwaseong", cor1: "#003DA5", cor2: "#FFD200", prestigio: 44, torcida: 800000, saldo: 4500000, file_key: "hwaseong_fc", divisao: "k_league_2", tm: "hwaseong-fc/startseite/verein/43177" },
    { nome: "Gimhae FC", curto: "GMH", cidade: "Gimhae", cor1: "#C8102E", cor2: "#FFFFFF", prestigio: 43, torcida: 700000, saldo: 4500000, file_key: "gimhae_fc", divisao: "k_league_2", tm: "gimhae-fc/startseite/verein/35761" },
    { nome: "Yongin FC", curto: "YON", cidade: "Yongin", cor1: "#0072BC", cor2: "#FFFFFF", prestigio: 42, torcida: 600000, saldo: 4000000, file_key: "yongin_fc", divisao: "k_league_2", tm: "yongin-fc/startseite/verein/135830" },
    { nome: "Paju Citizen", curto: "PAJ", cidade: "Paju", cor1: "#00843D", cor2: "#FFFFFF", prestigio: 42, torcida: 500000, saldo: 4000000, file_key: "paju_citizen", divisao: "k_league_2", tm: "paju-citizen/startseite/verein/43095" },
  ],
  maldonado: [
    { nome: "Deportivo Maldonado", curto: "DMA", cidade: "Maldonado", cor1: "#0B4DA2", cor2: "#FFFFFF", prestigio: 49, torcida: 700000, saldo: 3500000, file_key: "dep_maldonado_ury", divisao: "primera_div_ury", tm: "cd-maldonado/startseite/verein/18075" },
  ],
  sulamerica: [
    // Uruguai — os tres que faltavam para os 16 da Primera Division de 2026
    { nome: "Albion FC", curto: "ALB", cidade: "Montevideu", cor1: "#E30613", cor2: "#FFFFFF", prestigio: 50, torcida: 1200000, saldo: 4000000, file_key: "albion_ury", divisao: "primera_div_ury", tm: "albion-fc/startseite/verein/42149" },
    { nome: "Central Espanol", curto: "CES", cidade: "Montevideu", cor1: "#E30613", cor2: "#000000", prestigio: 48, torcida: 900000, saldo: 3500000, file_key: "central_espanol_ury", divisao: "primera_div_ury", tm: "central-espanol/startseite/verein/10960" },
    { nome: "Deportivo Maldonado", curto: "DMA", cidade: "Maldonado", cor1: "#0B4DA2", cor2: "#FFFFFF", prestigio: 49, torcida: 700000, saldo: 3500000, file_key: "dep_maldonado_ury", divisao: "primera_div_ury", tm: "cd-maldonado/startseite/verein/18075" },
    // Argentina — os dois que faltavam para os 30 da Liga Profesional de 2026
    { nome: "Gimnasia Mendoza", curto: "GYM", cidade: "Mendoza", cor1: "#FFFFFF", cor2: "#000000", prestigio: 58, torcida: 3000000, saldo: 7000000, file_key: "gimnasia_mendoza", divisao: "liga_argentina", tm: "gimnasia-y-esgrima-de-mendoza/startseite/verein/14687" },
    { nome: "Estudiantes Rio Cuarto", curto: "ERC", cidade: "Rio Cuarto", cor1: "#0B4DA2", cor2: "#FFFFFF", prestigio: 56, torcida: 1500000, saldo: 6000000, file_key: "estudiantes_rio_cuarto", divisao: "liga_argentina", tm: "aa-estudiantes-de-rio-cuarto/startseite/verein/14602" },
  ],
  chile: [
    { nome: "Universidad de Concepcion", curto: "UDC", cidade: "Concepcion", cor1: "#F5C518", cor2: "#003DA5", prestigio: 55, torcida: 4000000, saldo: 7000000, file_key: "u_de_concepcion", divisao: "primera_div_chi", tm: "universidad-concepcion/startseite/verein/5622" },
    { nome: "Deportes Concepcion", curto: "DCO", cidade: "Concepcion", cor1: "#663399", cor2: "#FFFFFF", prestigio: 52, torcida: 5000000, saldo: 6000000, file_key: "dep_concepcion", divisao: "primera_div_chi", tm: "deportes-concepcion/startseite/verein/14604" },
  ],
}

const lote = LOTES[opt("--lote") ?? ""]
if (!lote) {
  console.error(`uso: --lote <${Object.keys(LOTES).join("|")}> [--gravar]`)
  process.exit(1)
}

const linhasTs = []
const squads = {}
let semElenco = 0

for (const c of lote) {
  const url = `https://www.transfermarkt.com.br/${c.tm}`
  let html = ""
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } })
    html = r.ok ? await r.text() : ""
  } catch { /* rede: cai no relatorio abaixo */ }

  const elenco = html ? parseSquad(html) : []
  const valores = html ? valoresPorTmId(html) : new Map()
  const est = html ? estadioDaPagina(html) : { nome: null, cap: null }

  if (!elenco.length) { semElenco++; console.log(`  ! ${c.nome}: sem elenco (HTTP/parse)`) }

  const roster = elenco.map(p => ({
    n: p.nome,
    p: p.posicao ?? "MEI",
    c: p.nacionalidade ?? "-",
    ...(p.foto ? { f: p.foto.split("/").pop().replace(/\.(jpg|png).*$/i, "") } : {}),
    i: p.idade ?? 24,
    o: overallDoValor(valores.get(p.tmId), p.idade, p.posicao) ?? 55,
    ...(valores.get(p.tmId) != null ? { valor: valores.get(p.tmId) } : {}),
  }))
  squads[`${c.curto}|${nomeChave(c.nome)}`] = roster

  const estadio = est.nome ?? `${c.cidade} Stadium`
  const cap = est.cap ?? 15000
  linhasTs.push(
    `  { nome: ${JSON.stringify(c.nome)}, curto: ${JSON.stringify(c.curto)}, cidade: ${JSON.stringify(c.cidade)}, ` +
    `estado: ${JSON.stringify(c.divisao.startsWith("k_league") ? "Coreia do Sul" : c.divisao.includes("_ury") ? "Uruguai" : c.divisao.includes("argentina") ? "Argentina" : "Chile")}, cor1: "${c.cor1}", cor2: "${c.cor2}", ` +
    `prestigio: ${c.prestigio}, torcida: ${c.torcida}, estadio_cap: ${cap}, saldo: ${c.saldo}, ` +
    `file_key: ${JSON.stringify(c.file_key)}, estadio_nome: ${JSON.stringify(estadio)}, patrocinador: ${JSON.stringify(c.nome.split(" ")[0])}, ` +
    `escudo_url: getIntlEscudo(${JSON.stringify(c.file_key)}), divisao: ${JSON.stringify(c.divisao)}, ` +
    `regiao: ${JSON.stringify(c.divisao.startsWith("k_league") ? "asia" : "americas")}, pais: ${JSON.stringify(c.divisao.startsWith("k_league") ? "Coreia do Sul" : c.divisao.includes("_ury") ? "Uruguai" : c.divisao.includes("argentina") ? "Argentina" : "Chile")} },`)

  console.log(`  ${c.nome.padEnd(24)} ${String(roster.length).padStart(2)} atletas | ${estadio} (${cap})`)
  // ⚠️ O TM bloqueia rajada e a falha e MUDA: devolve pagina sem elenco em vez
  // de erro. Quatro clubes entraram com zero atleta assim, e so o relatorio
  // acusou. 4s entre paginas e o que se mostrou estavel.
  await sleep(4000)
}

console.log(`\n${lote.length} clubes | ${Object.values(squads).reduce((s, r) => s + r.length, 0)} atletas | sem elenco: ${semElenco}`)

if (!gravar) {
  console.log("\nEnsaio. Use --gravar para escrever o real-squads-tm.json e o arquivo de clubes.")
} else {
  const alvo = path.join(RAIZ, "data/seeds/real-squads-tm.json")
  const atual = JSON.parse(await readFile(alvo, "utf8"))
  let novos = 0
  for (const [k, v] of Object.entries(squads)) { if (!atual[k]) novos++; atual[k] = v }
  await writeFile(alvo, JSON.stringify(atual), "utf8")
  const saidaTs = path.join(RAIZ, `scripts/saida-clubes-${opt("--lote")}.ts.txt`)
  await writeFile(saidaTs, linhasTs.join("\n") + "\n", "utf8")
  console.log(`\nreal-squads-tm.json: ${novos} chaves novas`)
  console.log(`linhas de Team: ${saidaTs}`)
}
