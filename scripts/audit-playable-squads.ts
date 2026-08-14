import { competitionsByLeague } from "../lib/international-competitions"
import { completarLigaComPool, type Team } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

const clubs = new Map<string, Team>()
for (const division of Object.keys(competitionsByLeague)) {
  for (const team of completarLigaComPool(division)) clubs.set(team.file_key, team)
}

let completeReal = 0
let provisionalClubs = 0
let provisionalPlayers = 0
let emptySource = 0
let errors = 0

for (const team of clubs.values()) {
  const squad = getPlayersForTeam(team, { raw: true })
  const provisional = squad.filter(player => player.generatedOrigin === "provisional").length
  const sourced = squad.length - provisional
  if (provisional === 0 && sourced >= 18) completeReal++
  if (provisional > 0) {
    provisionalClubs++
    provisionalPlayers += provisional
  }
  if (sourced === 0) emptySource++
  if (squad.length < 18) {
    console.error(`FALHA: ${team.nome} tem ${squad.length} atletas`)
    errors++
  }
  const normalized = squad.map(player => player.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
  if (new Set(normalized).size !== normalized.length) {
    console.error(`FALHA: ${team.nome} tem nomes duplicados`)
    errors++
  }
}

console.log(`clubes jogáveis auditados: ${clubs.size}`)
console.log(`elencos 100% provenientes de fonte (>=18): ${completeReal}`)
console.log(`clubes com complemento provisório: ${provisionalClubs}`)
console.log(`atletas provisórios ainda necessários: ${provisionalPlayers}`)
console.log(`clubes sem nenhum atleta de fonte: ${emptySource}`)
if (errors) process.exit(1)
