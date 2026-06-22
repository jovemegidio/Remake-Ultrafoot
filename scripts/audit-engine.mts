import { simulateFullMatch, type MatchConfig } from "../lib/match-engine"
import type { Team } from "../lib/teams-data"

// Time minimo (so os campos usados pelo motor importam de fato)
function team(curto: string): Team {
  return { nome: curto, curto, divisao: 1 } as unknown as Team
}

function pct(arr: number[], p: number) {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) * p)]
}
function avg(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

const N = 500
const ratings: [number, number][] = [
  [85, 82], // dois fortes
  [78, 70], // medio x medio-fraco
  [90, 62], // forte x fraco
  [68, 68], // dois fracos
]

for (const [hr, ar] of ratings) {
  const goals: number[] = []
  const shots: number[] = []
  const onTarget: number[] = []
  const xg: number[] = []
  const fouls: number[] = []
  let homeWin = 0, draw = 0, awayWin = 0

  for (let i = 0; i < N; i++) {
    const cfg: MatchConfig = {
      homeTeam: team("CASA"),
      awayTeam: team("FORA"),
      homeRating: hr,
      awayRating: ar,
    }
    const st = simulateFullMatch(cfg)
    const totalGoals = st.home.goals + st.away.goals
    goals.push(totalGoals)
    shots.push(st.home.shots + st.away.shots)
    onTarget.push(st.home.shotsOnTarget + st.away.shotsOnTarget)
    xg.push(st.home.xG + st.away.xG)
    fouls.push(st.home.fouls + st.away.fouls)
    if (st.home.goals > st.away.goals) homeWin++
    else if (st.home.goals < st.away.goals) awayWin++
    else draw++
  }

  console.log(`\n=== Ratings ${hr} (casa) x ${ar} (fora) — ${N} jogos ===`)
  console.log(`Gols/jogo   media ${avg(goals).toFixed(2)}  | p95 ${pct(goals, 0.95)}  max ${Math.max(...goals)}`)
  console.log(`Chutes      media ${avg(shots).toFixed(1)}  | p95 ${pct(shots, 0.95)}  max ${Math.max(...shots)}`)
  console.log(`No alvo     media ${avg(onTarget).toFixed(1)}`)
  console.log(`xG total    media ${avg(xg).toFixed(2)}  | p95 ${pct(xg, 0.95).toFixed(2)}`)
  console.log(`Faltas      media ${avg(fouls).toFixed(1)}  | p95 ${pct(fouls, 0.95)}  max ${Math.max(...fouls)}`)
  console.log(`Resultados  casa ${(homeWin / N * 100).toFixed(0)}%  empate ${(draw / N * 100).toFixed(0)}%  fora ${(awayWin / N * 100).toFixed(0)}%`)
}
