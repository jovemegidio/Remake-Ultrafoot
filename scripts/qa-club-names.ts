import { allTeams, allPoolTeams } from "../lib/teams-data"

const teams = [...allTeams, ...allPoolTeams]
const broken = teams.filter(team =>
  !team.nome.trim() || /[ÃÄÅŒŸ]|^\d+$/.test(team.nome) || team.nome.length > 80
)
const seen = new Set<string>()
const duplicates: string[] = []
for (const team of teams) {
  const key = `${team.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}:${team.pais ?? team.estado ?? team.divisao}`
  if (seen.has(key)) duplicates.push(`${team.nome} (${team.pais ?? team.divisao})`)
  seen.add(key)
}

console.log(`clubes auditados=${teams.length} nomes quebrados=${broken.length} duplicatas exatas=${duplicates.length}`)
if (broken.length || duplicates.length) {
  console.error([...broken.map(team => team.nome), ...duplicates].slice(0, 50).join("\n"))
  process.exit(1)
}
console.log("OK — nomes de clubes normalizados e sem duplicatas exatas")
