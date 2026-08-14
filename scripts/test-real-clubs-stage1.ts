import realClubsStage1 from "../data/seeds/real-clubs-stage1.json"
import { allTeams, completarLigaComPool } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

let failures = 0
const check = (condition: boolean, message: string) => {
  if (!condition) {
    failures++
    console.error(`FALHA: ${message}`)
  }
}

const expectedAdditions: Record<string, number> = {
  fortuna_liga_cze: 15,
  premyer_liqa_aze: 11,
  protathlima_cyp: 13,
  premier_liga_kaz: 15,
}

const expectedLeagueSizes: Record<string, number> = {
  fortuna_liga_cze: 16,
  premyer_liqa_aze: 12,
  protathlima_cyp: 14,
  premier_liga_kaz: 16,
}

check(realClubsStage1.length === 54, `o lote deveria conter 54 clubes, contém ${realClubsStage1.length}`)
check(new Set(realClubsStage1.map(club => club.file_key)).size === realClubsStage1.length, "há file_key repetido no lote")

for (const [division, expected] of Object.entries(expectedAdditions)) {
  const additions = realClubsStage1.filter(club => club.divisao === division)
  check(additions.length === expected, `${division}: esperava ${expected} novos clubes, encontrou ${additions.length}`)
}

for (const [division, expected] of Object.entries(expectedLeagueSizes)) {
  const league = completarLigaComPool(division)
  check(league.length === expected, `${division}: deveria jogar com ${expected} clubes, joga com ${league.length}`)
  const countries = new Set(league.map(club => String(club.pais ?? club.estado)))
  check(countries.size === 1, `${division}: contém clubes de países diferentes (${[...countries].join(", ")})`)
}

// Estes cadastros foram ligados às chaves já existentes na base de jogadores.
// A trava impede uma troca de slug de apagar silenciosamente os elencos reais.
const clubsWithRecoveredSquads = [
  "sparta_tch", "jablonec_tch",
  "zira_azb", "neftci_aze", "sabah_azb", "gabala_azb", "sumqayit_azb",
  "aellimassol_cyp", "apoel_chp", "apollonlemesos_chp", "arislimassol_chp", "omonianicosia_chp",
  "astana_caz", "tobylkostanai_caz", "kaisar_caz", "ordabasy_caz",
]
for (const fileKey of clubsWithRecoveredSquads) {
  const team = allTeams.find(club => club.file_key === fileKey)
  check(Boolean(team), `${fileKey}: clube não entrou no catálogo`)
  if (!team) continue
  const squad = getPlayersForTeam(team, { raw: true })
  check(squad.length >= 18, `${fileKey}: elenco tem apenas ${squad.length} atletas`)
  check(!squad.some(player => /^Reserva\s/i.test(player.nome)), `${fileKey}: elenco voltou a usar jogadores Reserva`)
}

if (failures) process.exit(1)
console.log("real-clubs-stage1: 54 cadastros, 4 elites completas e 16 elencos reais recuperados")
