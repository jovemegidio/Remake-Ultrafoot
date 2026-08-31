// O PORTAO DAS SUPERCOPAS NACIONAIS (1.0.381).
//
//   node node_modules/tsx/dist/cli.mjs scripts/qa-supercopas-nacionais.ts
//
// ⚠️ POR QUE ELE EXISTE. Ate a 1.0.380 NENHUM pais tinha supercopa jogavel: so
// existiam as cinco continentais/globais (Supercopa do Brasil, Recopa,
// Supercopa da UEFA, Mundial, Intercontinental). Nomes como "Supercopa de
// Espanha", "Supercoppa Italiana" e "DFL-Supercup" apareciam em
// `international-competitions` como TEXTO e nao geravam partida nenhuma — o
// mesmo "arte sem jogo" que o cabecalho do `super-cups.ts` descreve para a
// Supercopa do Brasil antes de ela existir de verdade.
//
// Um jogador perguntou "falta a Supercopa Rei?" e a resposta medida foi maior:
// faltavam TODAS as nacionais.
//
// O que este portao cobra:
//   1. campeao da LIGA no ano passado disputa a supercopa do pais dele;
//   2. campeao da COPA nacional tambem disputa;
//   3. o NOME e o do pais — Community Shield na Inglaterra, nao um generico;
//   4. quem nao ganhou nada NAO disputa;
//   5. pais sem supercopa (Escocia) nao ganha uma inventada;
//   6. o BRASIL nao recebe duas — ele ja tem a dele pela via continental.

import { berthsForSeason } from "../lib/super-cups"
import { getCountryCompetitions } from "../lib/country-competitions"
import type { SeasonRecord } from "../lib/career-types"
import { competitionsByLeague } from "../lib/international-competitions"
import { readFileSync } from "node:fs"

let falhas = 0
const ok = (m: string) => console.log(`ok   ${m}`)
const erro = (m: string) => { console.log(`FALHA ${m}`); falhas++ }

const registro = (competicao: string, clube: string, season: number): SeasonRecord => ({
  season,
  competition: competicao,
  teamCurto: clube,
  teamNome: clube,
  position: 1,
  won: 25, drawn: 8, lost: 5,
  goalsFor: 70, goalsAgainst: 30,
  points: 83,
  champion: clube,
  managerName: "Tecnico",
  // ⚠️ O MOCK TEM DE SER COMPLETO. A primeira versao omitia `promoted` e
  // `relegated` e usava `as SeasonRecord` para calar o compilador — o `tsc` da
  // bateria reprovou, e com razao: mock que mente sobre a forma do dado testa
  // um tipo que nao existe no jogo.
  promoted: false,
  relegated: false,
})

const nacional = (vagas: ReturnType<typeof berthsForSeason>) =>
  vagas.find(v => v.id === "supercopa_nacional")

// ── 1 e 3. Campeao da liga disputa, e com o nome do pais ────────────────────
for (const [divisao, liga, esperado] of [
  ["premier_league", "Premier League", "Community Shield"],
  ["serie_a_ita", "Serie A", "Supercoppa Italiana"],
  ["la_liga", "La Liga", "Supercopa de Espanha"],
  ["bundesliga", "Bundesliga", "DFL-Supercup"],
] as const) {
  const vagas = berthsForSeason([registro(liga, "AAA", 2026)], "AAA", 2027, divisao)
  const v = nacional(vagas)
  if (!v) erro(`${divisao}: campeao da liga nao ganhou vaga na supercopa`)
  else if (v.name !== esperado) erro(`${divisao}: supercopa chamada "${v.name}", esperava "${esperado}"`)
  else ok(`${divisao}: campeao da liga disputa a ${v.name}`)
}

// ── 2. Campeao da COPA nacional tambem disputa ──────────────────────────────
{
  const copa = getCountryCompetitions("la_liga").domesticCup
  const vagas = berthsForSeason([registro(copa, "BBB", 2026)], "BBB", 2027, "la_liga")
  if (!nacional(vagas)) erro(`campeao da ${copa} nao ganhou vaga na supercopa`)
  else ok(`campeao da ${copa} disputa a supercopa`)
}

// ── 4. Quem nao ganhou nada nao disputa ─────────────────────────────────────
{
  const semTitulo = { ...registro("Premier League", "CCC", 2026), position: 7, champion: "OUTRO" } as SeasonRecord
  const vagas = berthsForSeason([semTitulo], "CCC", 2027, "premier_league")
  if (nacional(vagas)) erro("clube sem titulo ganhou vaga na supercopa")
  else ok("quem nao foi campeao nao disputa a supercopa")
}

// ── 5. Pais sem supercopa nao ganha uma inventada ───────────────────────────
{
  const comps = getCountryCompetitions("scottish_prem")
  if (comps.superCup) {
    erro(`a Escocia recebeu a supercopa "${comps.superCup}", e ela nao existe no futebol escoces`)
  } else {
    const vagas = berthsForSeason([registro("Scottish Premiership", "DDD", 2026)], "DDD", 2027, "scottish_prem")
    if (nacional(vagas)) erro("pais sem supercopa gerou vaga mesmo assim")
    else ok("pais sem supercopa nao ganha uma inventada")
  }
}

// ── 6. O Brasil nao recebe DUAS supercopas ──────────────────────────────────
{
  const vagas = berthsForSeason([registro("Brasileirao Serie A", "EEE", 2026)], "EEE", 2027, "serie_a")
  const supers = vagas.filter(v => v.id === "supercopa_brasil" || v.id === "supercopa_nacional")
  if (supers.length !== 1) {
    erro(`o Brasil gerou ${supers.length} supercopas: ${supers.map(v => v.name).join(", ")}`)
  } else if (supers[0].id !== "supercopa_brasil") {
    erro("a supercopa do Brasil deixou de vir pela via continental")
  } else {
    ok("o Brasil disputa UMA supercopa, a dele")
  }
}

// ── As continentais continuam funcionando sem a divisao ────────────────────
{
  const vagas = berthsForSeason([registro("UEFA Champions League", "FFF", 2026)], "FFF", 2027)
  if (!vagas.some(v => v.id === "supercopa_uefa")) erro("chamada sem divisao perdeu a Supercopa da UEFA")
  else ok("chamador antigo (sem divisao) continua ganhando as continentais")
}

// ── A SEGUNDA COPA NACIONAL (1.0.381) ──────────────────────────────────────
//
// ⚠️ ELA ERA DECLARADA E DESCARTADA. `nationalCups` sempre foi um array
// ordenado por prestigio, e o calendario so jogava `[0]`: a Inglaterra tem FA
// Cup E EFL Cup (Carabao) no dado, e o jogador so disputava a FA Cup. Nao era
// dado faltando — era dado ignorado, que e mais dificil de ver.
{
  const comps = competitionsByLeague["premier_league"] ?? []
  const copas = comps.filter(c => c.type === "cup").sort((a, b) => b.prestige - a.prestige)
  if (copas.length < 2) {
    erro(`a Inglaterra declara ${copas.length} copa(s) nacional(is); esperava FA Cup e EFL Cup`)
  } else {
    ok(`Inglaterra: ${copas.length} copas declaradas (${copas.map(c => c.shortName ?? c.name).join(", ")})`)
  }

  // O que o calendario faz com elas e o que importa. A prova direta e o codigo
  // do planejador; aqui cobramos a CONDICAO que ele passou a respeitar.
  const planejador = readFileSync("lib/use-game-manager.ts", "utf8")
  if (!planejador.includes("nationalCups.length > 1")) {
    erro("o calendario voltou a jogar so a copa de maior prestigio")
  } else {
    ok("o calendario joga a segunda copa nacional quando ela existe")
  }
}

console.log(falhas === 0
  ? "\nSUPERCOPAS OK — cada pais disputa a sua, com o nome dela."
  : `\n${falhas} problema(s) nas supercopas nacionais.`)
process.exit(falhas === 0 ? 0 : 1)
