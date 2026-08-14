// GATE: o manifesto de qualidade das ligas ainda descreve a realidade?
//
// A tela de nova carreira promete "elenco real completo em N de M clubes" lendo
// `data/seeds/qualidade-das-ligas.json`. Esse arquivo é DERIVADO. Se alguém
// importar elencos, mexer numa pirâmide ou trocar clubes de divisão sem
// regerá-lo, a tela passa a mentir — e mentir a favor, que é o pior caso.
//
//   npx tsx scripts/qa-qualidade-das-ligas.ts

import { readFileSync } from "node:fs"
import { competitionsByLeague } from "../lib/international-competitions"
import { promotionCount, relegationCount } from "../lib/league-pyramid"
import { completarLigaComPool } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

const gravado = JSON.parse(readFileSync("data/seeds/qualidade-das-ligas.json", "utf-8")) as Record<string, {
  clubes: number; clubesComElencoReal: number; elenco: string; piramide: string; sobe: number; desce: number
}>

const divergencias: string[] = []

for (const divisao of Object.keys(competitionsByLeague)) {
  const times = completarLigaComPool(divisao)
  const linha = gravado[divisao]
  if (!times.length) {
    if (linha) divergencias.push(`${divisao}: está no manifesto mas não tem clube nenhum`)
    continue
  }
  if (!linha) {
    divergencias.push(`${divisao}: tem ${times.length} clubes e NÃO está no manifesto`)
    continue
  }

  let comElencoReal = 0
  for (const time of times) {
    const elenco = getPlayersForTeam(time, { raw: true })
    const reais = elenco.length - elenco.filter(p => p.generatedOrigin === "provisional").length
    if (reais >= 18) comElencoReal++
  }
  const sobe = promotionCount(divisao)
  const desce = relegationCount(divisao)

  if (linha.clubes !== times.length) divergencias.push(`${divisao}: manifesto diz ${linha.clubes} clubes, hoje são ${times.length}`)
  if (linha.clubesComElencoReal !== comElencoReal) divergencias.push(`${divisao}: manifesto diz ${linha.clubesComElencoReal} clubes com elenco real, hoje são ${comElencoReal}`)
  if (linha.sobe !== sobe || linha.desce !== desce) divergencias.push(`${divisao}: manifesto diz sobe ${linha.sobe}/desce ${linha.desce}, hoje é sobe ${sobe}/desce ${desce}`)
}

if (divergencias.length) {
  console.error(`FALHA: ${divergencias.length} divergências entre o manifesto e a realidade.`)
  console.error("Rode: npx tsx scripts/gerar-qualidade-das-ligas.ts")
  for (const d of divergencias.slice(0, 25)) console.error(`  ${d}`)
  process.exit(1)
}

console.log(`OK: manifesto de qualidade confere com as ${Object.keys(gravado).length} ligas jogáveis.`)
