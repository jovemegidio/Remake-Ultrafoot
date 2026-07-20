// Carreira do técnico (hall da fama).
//
// O hall-of-fame-engine existia desde a fase 32 e nunca foi consumido. Pior: o
// `seasonHistory` do save era inicializado como [] e NUNCA recebia nada, então
// mesmo se alguém o chamasse leria um array vazio para sempre. Isso também
// afetava museu do clube, contagem de títulos da bilheteria e os desafios que
// checam promoção/posição final.
//
// Rodar: npx tsx scripts/test-hall-of-fame.ts

import { buildCareerStats, rankInHistory } from "../lib/hall-of-fame-engine"
import type { SeasonRecord } from "../lib/career-types"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const temporada = (over: Partial<SeasonRecord>): SeasonRecord => ({
  season: 2026, competition: "Brasileirão Série A", position: 5, points: 60,
  won: 17, drawn: 9, lost: 12, goalsFor: 55, goalsAgainst: 45,
  champion: "OUTRO", managerName: "Técnico", promoted: false, relegated: false,
  teamCurto: "FLA", teamNome: "Flamengo", ...over,
})

console.log("\nAgregação da carreira\n")

const historico: SeasonRecord[] = [
  temporada({ season: 2026, won: 17, drawn: 9, lost: 12 }),
  temporada({ season: 2027, won: 24, drawn: 8, lost: 6, position: 1, champion: "FLA" }),
  temporada({ season: 2028, won: 20, drawn: 10, lost: 8, position: 3, teamCurto: "PAL", teamNome: "Palmeiras" }),
]

const stats = buildCareerStats(historico)

check("soma as temporadas", stats.totalSeasons === 3, String(stats.totalSeasons))
check("soma as partidas", stats.totalMatches === 114, String(stats.totalMatches))
check("soma as vitórias", stats.totalWins === 61, String(stats.totalWins))
check("calcula pontos (3xV + E)", stats.totalPoints === 61 * 3 + 27, String(stats.totalPoints))
check("aproveitamento em %", stats.winRate > 50 && stats.winRate < 55, String(stats.winRate))

console.log("\nTítulos e clubes\n")

check("conta 1 título", stats.trophies.length === 1, `${stats.trophies.length} títulos`)
check("título vai para o clube certo", stats.trophies[0]?.clubCurto === "FLA", stats.trophies[0]?.clubCurto)
check("identifica 2 clubes", stats.clubs.length === 2, `${stats.clubs.length} clubes`)

const fla = stats.clubs.find(c => c.clubCurto === "FLA")
check("agrupa temporadas do mesmo clube", fla?.fromSeason === 2026 && fla?.toSeason === 2027,
  `${fla?.fromSeason}-${fla?.toSeason}`)

console.log("\nReputação e ranking\n")

check("reputação entre 0 e 100", stats.reputation >= 0 && stats.reputation <= 100, String(stats.reputation))

const vencedor = buildCareerStats(
  Array.from({ length: 8 }, (_, i) => temporada({ season: 2026 + i, position: 1, champion: "FLA", won: 28, drawn: 6, lost: 4 })),
)
const fraco = buildCareerStats([temporada({ position: 18, won: 6, drawn: 8, lost: 24, relegated: true })])

check("carreira vencedora tem reputação maior", vencedor.reputation > fraco.reputation,
  `${vencedor.reputation} vs ${fraco.reputation}`)
check("carreira vencedora ranqueia melhor",
  rankInHistory(vencedor).position < rankInHistory(fraco).position,
  `${rankInHistory(vencedor).position}º vs ${rankInHistory(fraco).position}º`)

console.log("\nCarreira vazia (save novo)\n")

const vazio = buildCareerStats([])
check("não quebra com histórico vazio", vazio.totalMatches === 0 && vazio.trophies.length === 0)
check("aproveitamento 0 sem divisão por zero", vazio.winRate === 0, String(vazio.winRate))

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}\n`)
process.exit(falhas === 0 ? 0 : 1)
