import { performance } from "node:perf_hooks"
import { useGameEngine } from "../lib/game-engine"
import { allTeams } from "../lib/teams-data"
import { createMatchModifiers, simulateFullMatch } from "../lib/match-engine"

const MAX_RSS_MB = 900
const MAX_HEAP_MB = 512
const MAX_CAMPAIGN_MS = 60_000
const MAX_MATCH_BATCH_MS = 30_000
const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10

const engine = useGameEngine.getState()
engine.initializeGame("BGT")

const campaignStart = performance.now()
for (let season = 0; season < 20; season++) {
  for (let week = 0; week < 52; week++) useGameEngine.getState().advanceWeek()
  const state = useGameEngine.getState()
  useGameEngine.getState().processSeasonEnd(state.currentSeason + 1, state.serieAStandings, state.serieAStandings)
}
const campaignMs = Math.round(performance.now() - campaignStart)

const teams = allTeams.filter(team => team.prestigio >= 55)
if (teams.length < 2) throw new Error("Base insuficiente para benchmark")
const matchStart = performance.now()
for (let index = 0; index < 500; index++) {
  const home = teams[index % teams.length]
  let away = teams[(index * 17 + 3) % teams.length]
  if (away.curto === home.curto) away = teams[(index * 17 + 4) % teams.length]
  simulateFullMatch({
    homeTeam: home,
    awayTeam: away,
    homeRating: Math.max(50, Math.min(95, home.prestigio)),
    awayRating: Math.max(50, Math.min(95, away.prestigio)),
    modifiers: createMatchModifiers(),
  })
}
const matchBatchMs = Math.round(performance.now() - matchStart)
const memory = process.memoryUsage()
const rssMb = mb(memory.rss)
const heapMb = mb(memory.heapUsed)

if (campaignMs > MAX_CAMPAIGN_MS) throw new Error(`Campanha de 20 temporadas excedeu ${MAX_CAMPAIGN_MS} ms: ${campaignMs} ms`)
if (matchBatchMs > MAX_MATCH_BATCH_MS) throw new Error(`500 partidas excederam ${MAX_MATCH_BATCH_MS} ms: ${matchBatchMs} ms`)
if (rssMb > MAX_RSS_MB) throw new Error(`RSS excedeu ${MAX_RSS_MB} MB: ${rssMb} MB`)
if (heapMb > MAX_HEAP_MB) throw new Error(`Heap excedeu ${MAX_HEAP_MB} MB: ${heapMb} MB`)

console.log(JSON.stringify({
  profile: "Intel 3rd gen / 4 GB equivalent engine budget",
  nodeHeapLimitMb: 512,
  seasons: 20,
  campaignMs,
  simulatedMatches: 500,
  matchBatchMs,
  rssMb,
  heapMb,
  status: "PASS",
}, null, 2))
