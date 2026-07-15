// Verifica se os times alemaes CURADOS (os que o jogo exibe) recebem elenco real.
import { allTeams, getTeamsByDivision } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

// Times alemaes por divisao (curados). Descobrimos a divisao olhando quem tem liga alema.
const de = allTeams.filter((t) => /alemanha|german/i.test(t.pais ?? "") || ["Bundesliga", "2. Bundesliga"].includes((t as unknown as { liga?: string }).liga ?? ""))
console.log("times alemaes curados (allTeams):", de.length)

let real = 0
let fake = 0
for (const t of de.slice(0, 45)) {
  const squad = getPlayersForTeam(t)
  // Heuristica: elenco real tem nomes especificos; o seed generico repete padroes.
  const first = squad[0]?.nome ?? "-"
  const hasReal = squad.length >= 11
  if (hasReal) real++
  else fake++
  console.log(`${(t.nome ?? "?").padEnd(28)} div=${(t.divisao ?? "?").padEnd(12)} ${squad.length} jog | 1o: ${first}`)
}
console.log(`\ncom elenco(>=11): ${real} | sem: ${fake}`)
