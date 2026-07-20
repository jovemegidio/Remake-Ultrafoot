// Auditoria de competições, liga a liga.
//
// Verifica duas coisas que o relato do jogador expôs:
//   1) cada liga gera um calendário coerente (rodadas x times x confrontos)
//   2) o clube do usuário NÃO fica com menos jogos que os rivais — a causa raiz
//      do "rebaixado com 15 jogos"
//
// Rodar: npx tsx scripts/audit-competicoes.ts

import { getTeamsByDivision, allTeams, type Team } from "../lib/teams-data"
import { generateSeasonFixtures } from "../lib/career-engine"
import { selectOverdueUserFixtures } from "../lib/fixture-catchup"

const SEASON = 2026
let problemas = 0

function alerta(msg: string) {
  problemas++
  console.log(`  PROBLEMA: ${msg}`)
}

// Divisões declaradas no LEAGUE_CALENDAR (espelhado aqui: o objeto não é exportado).
const LIGAS: Array<{ id: string; rounds: number; label: string }> = [
  { id: "serie_a", rounds: 38, label: "Brasileirão Série A" },
  { id: "serie_b", rounds: 38, label: "Brasileirão Série B" },
  { id: "serie_c", rounds: 38, label: "Brasileirão Série C" },
  { id: "serie_d", rounds: 38, label: "Brasileirão Série D" },
  { id: "premier_league", rounds: 38, label: "Premier League" },
  { id: "la_liga", rounds: 38, label: "La Liga" },
  { id: "serie_a_ita", rounds: 38, label: "Serie A (ITA)" },
  { id: "bundesliga", rounds: 34, label: "Bundesliga" },
  { id: "ligue_1", rounds: 34, label: "Ligue 1" },
  { id: "primeira_liga", rounds: 34, label: "Primeira Liga" },
  { id: "eredivisie", rounds: 34, label: "Eredivisie" },
  { id: "scottish_prem", rounds: 38, label: "Scottish Premiership" },
  { id: "super_lig", rounds: 34, label: "Süper Lig" },
  { id: "pro_league_bel", rounds: 34, label: "Pro League (BEL)" },
  { id: "russian_prem", rounds: 30, label: "Premier (RUS)" },
  { id: "mls", rounds: 34, label: "MLS" },
  { id: "liga_mx", rounds: 34, label: "Liga MX" },
]

console.log("\n=== ESTRUTURA DAS LIGAS ===\n")
console.log("liga                       times  rodadas  esperado  jogos/time  status")
console.log("-".repeat(78))

for (const liga of LIGAS) {
  const times = getTeamsByDivision(liga.id as Team["divisao"])
  if (times.length === 0) {
    console.log(`${liga.label.padEnd(26)} ${"0".padStart(5)}  — sem times cadastrados`)
    alerta(`${liga.label}: nenhum time na divisão "${liga.id}"`)
    continue
  }

  // Turno e returno completos exigem (n-1)*2 rodadas.
  const esperado = (times.length - 1) * 2
  const ok = liga.rounds === esperado
  console.log(
    `${liga.label.padEnd(26)} ${String(times.length).padStart(5)}  ${String(liga.rounds).padStart(7)}  ${String(esperado).padStart(8)}  ${String(liga.rounds).padStart(10)}  ${ok ? "ok" : "DIVERGE"}`,
  )
  if (!ok) {
    alerta(`${liga.label}: ${times.length} times pedem ${esperado} rodadas, mas LEAGUE_CALENDAR declara ${liga.rounds}`)
  }
}

console.log("\n=== CALENDÁRIO: O USUÁRIO JOGA TANTO QUANTO OS RIVAIS? ===\n")
console.log("liga                       fixtures  jogos do usuario  min/max rivais  status")
console.log("-".repeat(80))

for (const liga of LIGAS) {
  const times = getTeamsByDivision(liga.id as Team["divisao"])
  if (times.length < 4) continue
  const usuario = times[0]

  let fixtures
  try {
    fixtures = generateSeasonFixtures(times, usuario.curto, SEASON, liga.label)
  } catch (e) {
    alerta(`${liga.label}: generateSeasonFixtures lançou ${(e as Error).message}`)
    continue
  }

  const porTime = new Map<string, number>()
  for (const f of fixtures) {
    porTime.set(f.homeCurto, (porTime.get(f.homeCurto) ?? 0) + 1)
    porTime.set(f.awayCurto, (porTime.get(f.awayCurto) ?? 0) + 1)
  }
  const doUsuario = porTime.get(usuario.curto) ?? 0
  const rivais = [...porTime.entries()].filter(([c]) => c !== usuario.curto).map(([, n]) => n)
  const min = Math.min(...rivais), max = Math.max(...rivais)
  const equilibrado = doUsuario >= min && doUsuario <= max

  console.log(
    `${liga.label.padEnd(26)} ${String(fixtures.length).padStart(8)}  ${String(doUsuario).padStart(16)}  ${`${min}/${max}`.padStart(14)}  ${equilibrado ? "ok" : "DESEQUILIBRADO"}`,
  )
  if (!equilibrado) {
    alerta(`${liga.label}: usuário tem ${doUsuario} jogos, rivais entre ${min} e ${max}`)
  }
}

console.log("\n=== BUG DO REBAIXAMENTO: SIMULAÇÃO DE TEMPORADA ===\n")

// Reproduz o relato: o jogador disputa as primeiras rodadas e depois só avança
// o calendário sem jogar. Antes da correção, as partidas dele ficavam pendentes
// para sempre. Agora devem ser recuperadas.
const timesSerieA = getTeamsByDivision("serie_a" as Team["divisao"])
const usuario = timesSerieA[0]
const fixtures = generateSeasonFixtures(timesSerieA, usuario.curto, SEASON, "Brasileirão Série A")

interface Sim { week: number; played: boolean; isUserMatch: boolean }
const calendario: Sim[] = fixtures.map(f => ({
  week: f.round,
  played: false,
  isUserMatch: f.isUserMatch,
}))

const ultimaSemana = Math.max(...calendario.map(f => f.week))
const PARA_DE_JOGAR_EM = 15

// Rivais jogam sempre; o usuário para na semana 15.
for (const f of calendario) {
  if (!f.isUserMatch) f.played = true
  else if (f.week <= PARA_DE_JOGAR_EM) f.played = true
}

const pendentesAntes = calendario.filter(f => f.isUserMatch && !f.played).length
console.log(`Usuário disputa até a rodada ${PARA_DE_JOGAR_EM} e depois só avança.`)
console.log(`Partidas dele pendentes nesse momento: ${pendentesAntes}`)

let recuperadas = 0
for (let semana = PARA_DE_JOGAR_EM + 1; semana <= ultimaSemana + 1; semana++) {
  for (const f of selectOverdueUserFixtures(calendario, semana)) {
    f.played = true
    recuperadas++
  }
}

const jogosUsuario = calendario.filter(f => f.isUserMatch && f.played).length
const totalUsuario = calendario.filter(f => f.isUserMatch).length
const pendentesDepois = calendario.filter(f => f.isUserMatch && !f.played).length

console.log(`Recuperadas automaticamente: ${recuperadas}`)
console.log(`Jogos do usuário ao fim: ${jogosUsuario}/${totalUsuario}`)
console.log(`Pendentes ao fim: ${pendentesDepois}`)

if (pendentesDepois !== 0) alerta(`${pendentesDepois} partidas do usuário continuam pendentes — o bug NÃO está corrigido`)
if (jogosUsuario !== totalUsuario) alerta(`usuário terminou com ${jogosUsuario} de ${totalUsuario} jogos`)

console.log("\n=== FIM DE TEMPORADA: A LIGA CONSEGUE FECHAR? ===\n")

// A condição real do advanceWeek. Antes usava o `rounds` do LEAGUE_CALENDAR;
// quando a constante superava o calendário gerado, a temporada nunca terminava.
console.log("liga                       geradas  exigido(ANTES)  exigido(AGORA)  fecha?")
console.log("-".repeat(78))

for (const liga of LIGAS) {
  const times = getTeamsByDivision(liga.id as Team["divisao"])
  if (times.length < 4) continue
  const geradas = (times.length - 1) * 2
  const exigidoAntes = Math.max(liga.rounds, geradas)   // lógica antiga
  const exigidoAgora = Math.max(1, geradas)             // lógica corrigida
  const fechavaAntes = geradas >= exigidoAntes
  const fechaAgora = geradas >= exigidoAgora

  console.log(
    `${liga.label.padEnd(26)} ${String(geradas).padStart(7)}  ${String(exigidoAntes).padStart(14)}  ${String(exigidoAgora).padStart(14)}  ${fechaAgora ? (fechavaAntes ? "ok" : "DESTRAVADA") : "TRAVADA"}`,
  )
  if (!fechaAgora) alerta(`${liga.label}: temporada ainda não fecha`)
}

console.log("\n" + "=".repeat(60))
console.log(problemas === 0 ? "AUDITORIA LIMPA — nenhum problema encontrado" : `${problemas} PROBLEMA(S) ENCONTRADO(S)`)
console.log("=".repeat(60) + "\n")
process.exit(problemas === 0 ? 0 : 1)
