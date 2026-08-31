// A CATRACA DE PROFUNDIDADE — "cada atualizacao mais perto" virou numero.
//
//   node scripts/qa-paridade.mjs
//   node scripts/qa-paridade.mjs --detalhe
//
// ⚠️ POR QUE ELE EXISTE, E O QUE ELE NAO E.
//
// "Deixar o jogo pareio com o FM26" nao e uma tarefa: e um desejo sem borda,
// impossivel de concluir e impossivel de MEDIR — e o que nao se mede volta a
// ser opiniao na versao seguinte. Este portao troca o desejo por uma conta:
// quantas divisoes tem copa, quantas tem segunda copa, quantas tem supercopa,
// quantos clubes femininos tem elenco de verdade.
//
// Ele NAO diz que o jogo esta perto do FM26 — nenhum numero diria. Ele diz uma
// coisa mais util e verificavel: **esta versao nao entregou menos profundidade
// que a anterior**. E uma catraca, igual a da traducao: os pisos so SOBEM.
//
// ⚠️ COMO USAR SEM SE ENGANAR. Subir um piso e o registro de um ganho REAL,
// depois de o conteudo existir. Editar um piso para o portao passar e o mesmo
// que baixar o teto da traducao para caber — o numero fica bonito e o jogo fica
// igual. Se um piso incomoda, o caminho e entregar o conteudo.
//
// ⚠️ E ELE MEDE O QUE O JOGO FAZ, NAO O QUE ELE DECLARA. Uma competicao so
// conta quando VIRA PARTIDA. Foi assim que se descobriu, na 1.0.381, que
// nenhum pais tinha supercopa jogavel e que a segunda copa da Inglaterra era
// declarada e descartada pelo calendario: os nomes existiam ha versoes.

import { readFileSync } from "node:fs"
import { LEAGUE_COMPETITIONS } from "../lib/country-competitions"
import { competitionsByLeague } from "../lib/international-competitions"

const detalhe = process.argv.includes("--detalhe")

/**
 * ⚠️ PISOS — SO SOBEM. Medidos na 1.0.381. Cada um so muda quando o conteudo
 * correspondente existir de verdade e o portao confirmar.
 */
const PISO = {
  divisoes: 154,
  paises: 72,
  comCopaNacional: 154,
  comSegundaCopa: 6,
  comSupercopa: 18,
  clubesFemininosComElencoReal: 194,
}


/**
 * Divisoes de PRIMEIRA linha que, na vida real, nao disputam supercopa — ou ja
 * disputam a delas por outro caminho.
 *
 * ⚠️ LISTA EXPLICITA, NAO ADIVINHACAO. A primeira versao filtrava so por padrao
 * de nome e a fila saiu com 101 itens, varios deles impossiveis: "Estados
 * Unidos sem supercopa" nunca vai virar trabalho, porque a MLS nao tem uma.
 * Fila com ruido e fila que ninguem usa.
 */
const SEM_SUPERCOPA_NA_VIDA_REAL = new Set([
  "scottish_prem",   // A Escocia nao disputa supercopa.
  "mls",             // A MLS nao tem; o mais proximo e a Campeoes Cup, continental.
  "liga_mx",         // O Campeon de Campeones existe, mas e disputado no formato de playoff.
  "k_league_1",      // A Coreia teve a dela ate 2006 e nao a retomou.
  "serie_a",         // Brasil: ja disputa a Supercopa do Brasil pela via continental.
])

/**
 * Segunda divisao (e abaixo) nao disputa supercopa nem costuma ter copa da
 * liga. O sufixo/prefixo denuncia: `_2`, `serie_b`, `championship`...
 */
function ehPrimeiraDivisao(divisao: string): boolean {
  return !/(_2$|_2_|_b$|serie_b|serie_c|serie_d|championship|league_one|league_two|national_league|_federacion|liga_3|segunda|primera_b|obos|superettan|tff_1|tff_2|challenger|first_national|k_league_2|j2_|china_league|_lig$|first_div|_first$|eerste|betplay|simon_bolivar|liga_2|intermedia|_champ$)/i.test(divisao)
}

const paises = new Set()
let divisoes = 0, comCopaNacional = 0, comSegundaCopa = 0, comSupercopa = 0
const semSupercopa = []
const semSegundaCopa = []

for (const [divisao, c] of Object.entries(LEAGUE_COMPETITIONS)) {
  if (!c.country || c.country === "Internacional") continue
  divisoes++
  paises.add(c.country)
  if (c.domesticCup && c.domesticCup !== "Copa Nacional") comCopaNacional++
  if (c.superCup) comSupercopa++
  // ⚠️ SEGUNDA DIVISAO NAO TEM SUPERCOPA em lugar nenhum do mundo, e listar
  // "Serie B sem supercopa" como lacuna e ruido que faz a fila parecer maior do
  // que e. A fila so vale se tudo nela for trabalho real.
  else if (ehPrimeiraDivisao(divisao) && !SEM_SUPERCOPA_NA_VIDA_REAL.has(divisao)) semSupercopa.push(`${c.country} (${divisao})`)
  const copas = (competitionsByLeague[divisao] ?? []).filter(x => x.type === "cup")
  if (copas.length > 1) comSegundaCopa++
  else semSegundaCopa.push(`${c.country} (${divisao})`)
}

type ClubeFeminino = { atletas?: unknown[] }
const seed = JSON.parse(readFileSync("data/seeds/elencos-femininos.json", "utf8")) as Record<string, ClubeFeminino>
const clubesFemininosComElencoReal = Object.values(seed)
  .filter(v => (v?.atletas?.length ?? 0) >= 11).length

type Medida = keyof typeof PISO
const medido: Record<Medida, number> = {
  divisoes, paises: paises.size, comCopaNacional, comSegundaCopa, comSupercopa, clubesFemininosComElencoReal,
}

const ROTULO: Record<Medida, string> = {
  divisoes: "divisoes jogaveis",
  paises: "paises",
  comCopaNacional: "divisoes com copa nacional",
  comSegundaCopa: "divisoes com SEGUNDA copa (copa da liga)",
  comSupercopa: "divisoes com supercopa nacional",
  clubesFemininosComElencoReal: "clubes femininos com elenco real",
}

console.log("\n  PROFUNDIDADE DO ULTRAFOOT\n")
let falhas = 0
for (const [chave, piso] of Object.entries(PISO) as [Medida, number][]) {
  const valor = medido[chave]
  const ok = valor >= piso
  if (!ok) falhas++
  const sinal = valor > piso ? `  (+${valor - piso} desde o piso)` : ok ? "" : `  ← ABAIXO do piso ${piso}`
  console.log(`  ${ok ? "ok  " : "FALHA"} ${ROTULO[chave].padEnd(42)} ${String(valor).padStart(4)}${sinal}`)
}

if (detalhe) {
  console.log(`\n  onde ainda falta supercopa (${semSupercopa.length}):`)
  for (const p of semSupercopa.slice(0, 15)) console.log(`    ${p}`)
  if (semSupercopa.length > 15) console.log(`    ... e mais ${semSupercopa.length - 15}`)
  console.log(`\n  onde ainda falta segunda copa (${semSegundaCopa.length}):`)
  for (const p of semSegundaCopa.slice(0, 15)) console.log(`    ${p}`)
  if (semSegundaCopa.length > 15) console.log(`    ... e mais ${semSegundaCopa.length - 15}`)
}

const subiu = (Object.entries(PISO) as [Medida, number][]).filter(([k, v]) => medido[k] > v)
if (subiu.length > 0) {
  console.log(`\n  ⚠️ ${subiu.length} medida(s) acima do piso — SUBA O PISO neste arquivo para travar o ganho:`)
  for (const [k] of subiu) console.log(`     ${k}: ${PISO[k]} -> ${medido[k]}`)
}

console.log(falhas === 0
  ? "\nPROFUNDIDADE OK — nenhuma medida regrediu.\n"
  : `\n${falhas} medida(s) regrediram: esta versao entrega MENOS que a anterior.\n`)
process.exit(falhas === 0 ? 0 : 1)
