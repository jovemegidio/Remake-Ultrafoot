import { existsSync } from "node:fs"
import path from "node:path"
import { allTeams, getCamisaUrl, getLocalCamisaPath } from "../lib/teams-data"
import importedBF2026 from "../data/seeds/imported-bf2026.json"

let mappedClubs = 0
let mappedVariants = 0
const broken: string[] = []

for (const team of allTeams) {
  let clubMapped = false
  for (const variant of ["home", "away", "third"] as const) {
    const url = getCamisaUrl(team.file_key, variant, team.nome)
    if (!url.startsWith("/kits-imported/")) continue
    clubMapped = true
    mappedVariants++
    const file = path.resolve("public", url.replace(/^\//, ""))
    if (!existsSync(file)) broken.push(`${team.nome}:${variant}:${url}`)
  }
  if (clubMapped) mappedClubs++
}

const importedTeams = (importedBF2026 as { teams: Array<{ nome: string; fileKey: string }> }).teams
for (const team of importedTeams) {
  let clubMapped = false
  for (const variant of ["home", "away", "third"] as const) {
    const url = getCamisaUrl(team.fileKey, variant, team.nome)
    if (!url.startsWith("/kits-imported/")) continue
    clubMapped = true
    mappedVariants++
    const file = path.resolve("public", url.replace(/^\//, ""))
    if (!existsSync(file)) broken.push(`${team.nome}:${variant}:${url}`)
  }
  if (clubMapped) mappedClubs++
}

const athletic = getCamisaUrl("athletic_bilbao", "home", "Athletic Bilbao")
if (!existsSync(path.resolve("public", athletic.replace(/^\//, ""))))
  broken.push(`Athletic Bilbao resolveu para arquivo ausente: ${athletic}`)

// Clubes citados no relato: quando nao ha entrada confiavel no mapeamento novo,
// precisam resolver para o pacote legado local — nunca para um slot inexistente.
for (const [fileKey, name] of [
  ["arsenal", "Arsenal"],
  ["manchester_city", "Manchester City"],
  ["manchester_united", "Manchester United"],
] as const) {
  for (const variant of ["home", "away", "third"] as const) {
    const local = getLocalCamisaPath(fileKey, variant)
    const file = path.resolve("public", local.replace(/^\//, ""))
    if (!existsSync(file)) broken.push(`${name}:${variant}:pacote local ausente (${local})`)
  }
}

const realMadrid = getCamisaUrl("real_madrid", "home", "Real Madrid")
if (!existsSync(path.resolve("public", realMadrid.replace(/^\//, ""))))
  broken.push(`Real Madrid resolveu para arquivo ausente: ${realMadrid}`)

console.log(`clubes com kits importados=${mappedClubs}/${allTeams.length + importedTeams.length} variantes=${mappedVariants}`)
if (broken.length) {
  console.error(`kits quebrados=${broken.length}\n${broken.slice(0, 30).join("\n")}`)
  process.exit(1)
}
console.log("OK — todos os kits mapeados apontam para arquivos existentes")
