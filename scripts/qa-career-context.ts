import { calcSeasonObjective, generateJobOffers } from "../lib/board-engine"

// A avaliacao e MENSAL (semana >= 5 e multipla de 4), nao trimestral. Este
// arquivo ainda checava a cadencia antiga de 13 semanas: pedia proposta na
// semana 13 (13 % 4 = 1 -> nunca sai) e proibia na 12 (que hoje E checkpoint).
// As duas assercoes contradiziam a regra em vigor, entao o script morria antes
// de chegar nas metas — e como ele nao esta no package.json, ninguem via.
const foraDoCheckpoint = generateJobOffers(95, 1, 60, [
  { curto: "BAR", nome: "Barcelona", prestigio: 95, divisao: "la_liga" },
], { currentWeek: 13, currentDivision: "serie_d" })
if (foraDoCheckpoint.length) throw new Error("Proposta fora da avaliacao mensal")

// Semana 5 ainda e o comeco absoluto: antes disso o mercado e mudo.
const cedoDemais = generateJobOffers(95, 1, 60, [
  { curto: "BAR", nome: "Barcelona", prestigio: 95, divisao: "la_liga" },
], { currentWeek: 4, currentDivision: "serie_d" })
if (cedoDemais.length) throw new Error("Proposta antes da semana 5")

// Reputacao 92 na Serie D abre a Serie C — nao o Barcelona. O teto de
// prestigio e o limite de salto de divisao existem justamente para isso.
const earned = generateJobOffers(92, 1, 60, [
  { curto: "BAR", nome: "Barcelona", prestigio: 95, divisao: "la_liga" },
  { curto: "SERB", nome: "Clube da Serie B", prestigio: 70, divisao: "serie_b" },
  { curto: "SERC", nome: "Clube da Serie C", prestigio: 65, divisao: "serie_c" },
], { currentWeek: 12, currentDivision: "serie_d", experienceSeasons: 0, careerTitles: 0 })
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
