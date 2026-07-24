// MUNDIAL DE CLUBES (32) e COPA INTERCONTINENTAL.
//
// Antes: o Mundial era uma "supercopa" de 2 clubes, sem regulamento nem
// chaveamento, e disputada TODO ano contra um adversario do proprio pais. A
// Intercontinental simplesmente nao existia.

import { berthsForSeason, temMundialNaTemporada, superCupMatchCount } from "../lib/super-cups"
import { caminhoDaCopa } from "../lib/cup-bracket"
import { COMPETITION_REGULATIONS_2026 } from "../lib/competition-regulations-2026"
import { getIntroForCompetition } from "../lib/competition-intro"
import type { SeasonRecord } from "../lib/career-types"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

function titulo(competition: string, curto: string, season: number): SeasonRecord {
  return {
    season, competition, position: 1, points: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, champion: curto, managerName: "T",
    promoted: false, relegated: false, teamCurto: curto, teamNome: curto,
  }
}

// ── 1. Mundial acontece de 4 em 4 anos ─────────────────────────────────────
{
  console.log(`   anos com Mundial: ${[2025, 2026, 2027, 2028, 2029, 2030].filter(temMundialNaTemporada).join(", ")}`)
  checar("Mundial em 2025 e 2029", temMundialNaTemporada(2025) && temMundialNaTemporada(2029))
  checar("SEM Mundial em 2026/2027/2028", ![2026, 2027, 2028].some(temMundialNaTemporada))
}

// ── 2. Vaga pelo ciclo de 4 anos (nao so pelo ano anterior) ────────────────
{
  // Campeao da Libertadores em 2026; o Mundial e em 2029 (dentro do ciclo).
  const hist = [titulo("CONMEBOL Libertadores", "GRE", 2026)]
  const vagas2029 = berthsForSeason(hist, "GRE", 2029)
  checar("campeao continental no ciclo tem vaga no Mundial",
    vagas2029.some(v => v.id === "mundial_clubes"), vagas2029.map(v => v.id).join(", "))

  // Em 2027 nao ha Mundial nenhum.
  const vagas2027 = berthsForSeason(hist, "GRE", 2027)
  checar("nao ha Mundial em ano fora do ciclo", !vagas2027.some(v => v.id === "mundial_clubes"))

  // Titulo velho demais (fora da janela de 4 anos) nao vale.
  const antigo = [titulo("CONMEBOL Libertadores", "GRE", 2020)]
  checar("titulo fora da janela nao da vaga",
    !berthsForSeason(antigo, "GRE", 2029).some(v => v.id === "mundial_clubes"))
}

// ── 3. Intercontinental e ANUAL, para o campeao continental ────────────────
{
  const liber = berthsForSeason([titulo("CONMEBOL Libertadores", "FLA", 2026)], "FLA", 2027)
  const champ = berthsForSeason([titulo("UEFA Champions League", "LIV", 2026)], "LIV", 2027)
  checar("campeao da Libertadores disputa a Intercontinental",
    liber.some(v => v.id === "copa_intercontinental"), liber.map(v => v.id).join(", "))
  checar("campeao da Champions disputa a Intercontinental",
    champ.some(v => v.id === "copa_intercontinental"))
  checar("quem nao foi campeao continental nao disputa",
    !berthsForSeason([titulo("Brasileirão Série A", "SAO", 2026)], "SAO", 2027)
      .some(v => v.id === "copa_intercontinental"))
}

// ── 4. Formato: Mundial tem grupos + mata-mata (7 jogos) ───────────────────
{
  const caminho = caminhoDaCopa("mundial_clubes", "Mundial de Clubes FIFA", "cup", false)
  const jogos = caminho.reduce((s, e) => s + e.jogos, 0)
  const temGrupo = caminho.some(e => e.tipo === "grupo")
  console.log(`   Mundial: ${caminho.map(e => `${e.stage}(${e.jogos})`).join(" ")} = ${jogos} jogos`)
  checar("Mundial tem fase de GRUPOS", temGrupo)
  checar("Mundial vai ate a final passando por oitavas e quartas",
    caminho.some(e => e.stage === "oitavas") && caminho.some(e => e.stage === "quartas"))
  checar("Mundial soma 7 jogos (3 de grupo + 4 de mata-mata)", jogos === 7, `${jogos}`)

  const inter = caminhoDaCopa("copa_intercontinental", "Copa Intercontinental", "cup", false)
  console.log(`   Intercontinental: ${inter.map(e => `${e.stage}(${e.jogos})`).join(" ")}`)
  checar("Intercontinental e semifinal + final em jogo unico",
    inter.length === 2 && inter.every(e => e.jogos === 1))
}

// ── 5. Regulamento e arte proprios ─────────────────────────────────────────
{
  const rm = COMPETITION_REGULATIONS_2026["mundial_clubes"]
  const ri = COMPETITION_REGULATIONS_2026["copa_intercontinental"]
  checar("Mundial tem regulamento com 32 participantes", rm?.participants === 32, `${rm?.participants}`)
  checar("Mundial tem 8 grupos", rm?.groups === 8)
  checar("Intercontinental tem regulamento", Boolean(ri))

  const introInter = getIntroForCompetition("Copa Intercontinental")
  const introUefa = getIntroForCompetition("Supercopa da UEFA")
  checar("Intercontinental tem intro propria", introInter?.id === "copa_intercontinental", introInter?.id)
  checar("Supercopa da UEFA nao usa mais a arte do Brasil",
    introUefa?.id === "supercopa_uefa", introUefa?.id)
}

// ── 6. Contagem de jogos do catalogo bate com o chaveamento ────────────────
{
  const vagas = berthsForSeason([titulo("CONMEBOL Libertadores", "GRE", 2026)], "GRE", 2029)
  const mundial = vagas.find(v => v.id === "mundial_clubes")
  checar("catalogo declara 7 jogos para o Mundial", mundial?.matchCount === 7, `${mundial?.matchCount}`)
  checar("superCupMatchCount soma corretamente", superCupMatchCount(vagas) >= 7)
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
