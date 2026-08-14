import realClubs from "../data/seeds/real-clubs-stage1-lower-europe.json"
import { allTeams, completarLigaComPool } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

let failures = 0
const check = (condition: boolean, message: string) => {
  if (!condition) {
    failures++
    console.error(`FALHA: ${message}`)
  }
}

const expectedCounts: Record<string, number> = {
  eliteserien_nor: 15,
  obos_ligaen: 16,
  superliga_den: 11,
  betinia_liga: 12,
  second_div_cyp: 16,
}
const expectedLeagueSizes: Record<string, number> = {
  eliteserien_nor: 16,
  obos_ligaen: 16,
  superliga_den: 12,
  betinia_liga: 12,
  protathlima_cyp: 14,
  second_div_cyp: 16,
}

check(realClubs.length === 70, `o lote deveria conter 70 clubes, contém ${realClubs.length}`)
check(new Set(realClubs.map(club => club.file_key)).size === realClubs.length, "há file_key repetido no lote")

for (const [division, expected] of Object.entries(expectedCounts)) {
  check(realClubs.filter(club => club.divisao === division).length === expected, `${division}: quantidade de cadastros divergente`)
}
for (const [division, expected] of Object.entries(expectedLeagueSizes)) {
  const league = completarLigaComPool(division)
  check(league.length === expected, `${division}: deveria jogar com ${expected} clubes, joga com ${league.length}`)
  const countries = new Set(league.map(club => String(club.pais ?? club.estado)))
  check(countries.size === 1, `${division}: contém clubes de países diferentes (${[...countries].join(", ")})`)
  check(new Set(league.map(club => club.file_key)).size === league.length, `${division}: contém clube duplicado`)
}

const official2026: Record<string, string[]> = {
  eliteserien_nor: ["brann_nor", "kfum_nor", "kristiansund_nor", "viking_nor", "sarpsborg_nor", "rosenborg_nor", "molde_nor", "tromso_nor", "valerenga_nor", "hamkam_nor", "sandefjord_nor", "fredrikstad", "aalesund", "lillestrom", "start_nor", "bodo_glimt"],
  obos_ligaen: ["stromsgodset_nor", "kongsvinger", "haugesund_nor", "oddgrenland_nor", "stabaek", "ranheim", "hodd", "moss_fk", "egersund", "sogndal", "bryne", "sandnes_ulf", "lyn_1896", "raufoss", "asane", "strommen"],
  superliga_den: ["brondby_din", "nordsjaelland_din", "odense_din", "midtjylland_din", "sonderjyske_din", "silkeborg_din", "viborg", "agf", "lyngby", "horsens_din", "randers", "copenhagen"],
  betinia_liga: ["ab_gladsaxe", "esbjerg_din", "fredericia", "hb_koge", "hillerod", "hobro_din", "hvidovre", "kolding", "vejle", "vendsyssel", "aalborg_din", "aarhus_fremad"],
  protathlima_cyp: ["aek_larnaca", "aellimassol_cyp", "als_omonia_29m", "anorthosis", "apoel_chp", "apollonlemesos_chp", "arislimassol_chp", "nea_salamina", "karmiotissa", "olympiakos_nicosia", "omonia_aradippou", "omonianicosia_chp", "eny_ypsonas", "pafos_fc"],
  second_div_cyp: ["aep_polemidion", "akritas_chlorakas", "anagennisi_deryneia", "ayia_napa", "apea_akrotiri", "asil_lysi", "digenis_morphou", "doxa_katokopias", "ethnikos_achnas", "en_paralimni", "ermis_aradippou", "iraklis_gerolakkou", "meap_nisou", "paeek", "spartakos_kitiou", "chalkanoras"],
}
for (const [division, expectedKeys] of Object.entries(official2026)) {
  const actual = completarLigaComPool(division).map(club => club.file_key).sort()
  check(JSON.stringify(actual) === JSON.stringify([...expectedKeys].sort()), `${division}: composição oficial 2026/27 divergente`)
}

const recoveredSquads = [
  "brann_nor", "kfum_nor", "kristiansund_nor", "viking_nor", "sarpsborg_nor", "rosenborg_nor",
  "molde_nor", "tromso_nor", "valerenga_nor", "hamkam_nor", "sandefjord_nor",
  "stromsgodset_nor", "haugesund_nor", "oddgrenland_nor",
  "brondby_din", "nordsjaelland_din", "odense_din", "midtjylland_din", "sonderjyske_din", "silkeborg_din", "horsens_din",
  "esbjerg_din", "hobro_din", "aalborg_din",
]
for (const fileKey of recoveredSquads) {
  const team = allTeams.find(club => club.file_key === fileKey)
  check(Boolean(team), `${fileKey}: clube não entrou no catálogo`)
  if (!team) continue
  const squad = getPlayersForTeam(team, { raw: true })
  check(squad.length >= 18, `${fileKey}: elenco tem apenas ${squad.length} atletas`)
  check(!squad.some(player => /^Reserva\s/i.test(player.nome)), `${fileKey}: elenco usa jogadores Reserva`)
}

if (failures) process.exit(1)
console.log("stage1-lower-europe: 70 clubes, 3 segundas divisões e 24 elencos reais recuperados")
