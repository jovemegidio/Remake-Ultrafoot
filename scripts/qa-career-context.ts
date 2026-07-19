import { calcSeasonObjective, generateJobOffers } from "../lib/board-engine"

const notCheckpoint = generateJobOffers(95, 1, 60, [
  { curto: "BAR", nome: "Barcelona", prestigio: 95, divisao: "la_liga" },
], { currentWeek: 12, currentDivision: "serie_d" })
if (notCheckpoint.length) throw new Error("Proposta fora da avaliacao trimestral")

const earned = generateJobOffers(92, 1, 60, [
  { curto: "BAR", nome: "Barcelona", prestigio: 95, divisao: "la_liga" },
  { curto: "SERB", nome: "Clube da Serie B", prestigio: 70, divisao: "serie_b" },
  { curto: "SERC", nome: "Clube da Serie C", prestigio: 65, divisao: "serie_c" },
], { currentWeek: 13, currentDivision: "serie_d", experienceSeasons: 0, careerTitles: 0 })
if (earned.length !== 1 || earned[0].clubShort !== "SERC") throw new Error("Salto de carreira irreal")

const newcastle = calcSeasonObjective({
  nome: "Newcastle United", curto: "NEW", cor1: "#000", cor2: "#fff",
  prestigio: 82, saldo: 0, divisao: "premier_league", pais: "Inglaterra",
  fileKey: "newcastle", estadio: "St James' Park",
})
if (!newcastle.description.includes("UEFA Champions League") || newcastle.description.includes("Libertadores")) {
  throw new Error("Meta do Newcastle nao esta contextualizada")
}

console.log("OK carreira: propostas por mérito e metas por país/competição")
