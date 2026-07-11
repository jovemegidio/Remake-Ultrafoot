// QA — realismo estatístico do motor de partida.
// Roda N simulações e compara médias com faixas reais do futebol profissional.
// Uso: pnpm exec tsx scripts/qa-sim-stats.ts

import { allTeams } from "../lib/teams-data"
import { simulateFullMatch, createMatchModifiers } from "../lib/match-engine"

const N = 400
const teams = allTeams.filter(t => t.prestigio >= 60)

let goals = 0, shots = 0, sot = 0, xg = 0, corners = 0, fouls = 0
let yellows = 0, reds = 0, homeWins = 0, draws = 0, awayWins = 0
let zeroZero = 0, bigScores = 0, assists = 0, goalsTotal = 0

for (let i = 0; i < N; i++) {
  const home = teams[i % teams.length]
  const away = teams[(i * 13 + 7) % teams.length]
  if (home.curto === away.curto) continue

  const st = simulateFullMatch({
    homeTeam: home,
    awayTeam: away,
    homeRating: Math.max(50, Math.min(95, home.prestigio)),
    awayRating: Math.max(50, Math.min(95, away.prestigio)),
    modifiers: createMatchModifiers(),
  })

  const g = st.home.goals + st.away.goals
  goals += g
  goalsTotal += g
  shots += st.home.shots + st.away.shots
  sot += st.home.shotsOnTarget + st.away.shotsOnTarget
  xg += st.home.xG + st.away.xG
  corners += st.home.corners + st.away.corners
  fouls += st.home.fouls + st.away.fouls
  yellows += st.home.yellows + st.away.yellows
  reds += st.home.reds + st.away.reds
  if (st.home.goals > st.away.goals) homeWins++
  else if (st.home.goals === st.away.goals) draws++
  else awayWins++
  if (g === 0) zeroZero++
  if (g >= 6) bigScores++
  assists += st.events.filter(e => e.type === "goal" && e.assist).length
}

const pct = (v: number) => ((v / N) * 100).toFixed(1) + "%"
const avg = (v: number, d = 2) => (v / N).toFixed(d)

console.log(`\n=== ESTATÍSTICAS DE ${N} SIMULAÇÕES ===\n`)
console.log(`Gols/jogo:        ${avg(goals)}   (real: 2.5-2.9)`)
console.log(`Chutes/jogo:      ${avg(shots, 1)}  (real: 22-28)`)
console.log(`No alvo/jogo:     ${avg(sot, 1)}   (real: 8-10)`)
console.log(`xG/jogo:          ${avg(xg)}   (real: 2.4-3.0)`)
console.log(`Escanteios/jogo:  ${avg(corners, 1)}   (real: 9-11)`)
console.log(`Faltas/jogo:      ${avg(fouls, 1)}  (real: 22-28)`)
console.log(`Amarelos/jogo:    ${avg(yellows)}   (real: 3.5-5)`)
console.log(`Vermelhos/jogo:   ${avg(reds)}   (real: 0.15-0.25)`)
console.log(`\nMandante vence:   ${pct(homeWins)}  (real: 44-47%)`)
console.log(`Empates:          ${pct(draws)}  (real: 25-28%)`)
console.log(`Visitante vence:  ${pct(awayWins)}  (real: 27-30%)`)
console.log(`0x0:              ${pct(zeroZero)}   (real: 7-9%)`)
console.log(`6+ gols:          ${pct(bigScores)}   (real: 3-5%)`)
console.log(`Assistências/gol: ${(assists / Math.max(1, goalsTotal) * 100).toFixed(0)}%  (real: 65-80%)`)
console.log()
