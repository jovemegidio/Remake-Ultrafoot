import { allTeams } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

const wanted = [
  "FC Porto", "SC Braga", "AFC Ajax", "Rangers FC", "Celtic", "Colo Colo",
  "Club América", "León", "Sporting CP", "Benfica", "PSV", "Feyenoord",
  "Zenit", "Spartak Moscow", "Universidad de Chile",
]
let ok = 0, bad = 0
for (const n of wanted) {
  const t = allTeams.find((x) => x.nome === n)
  if (!t) { console.log(`${n.padEnd(22)} (nao no jogo)`); continue }
  const squad = getPlayersForTeam(t)
  const first = squad[0]?.nome ?? "-"
  const real = squad.length >= 11 && !/^Reserva/.test(first)
  if (real) ok++; else bad++
  console.log(`${n.padEnd(22)} ${squad.length} jog | 1o: ${first} ${real ? "" : "  <-- GENERICO"}`)
}
console.log(`\nreal: ${ok} | generico/faltando: ${bad}`)
