import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { allTeams } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"
import { createMatchModifiers, simulateFullMatch } from "../lib/match-engine"
import { useGameEngine } from "../lib/game-engine"

type CheckResult = { name: string; ok: boolean; details?: string }

const root = process.cwd()
const results: CheckResult[] = []

function check(name: string, condition: boolean, details?: string) {
  results.push({ name, ok: condition, details })
}

function publicFileExists(publicPath: string) {
  return existsSync(path.join(root, "public", publicPath.replace(/^\//, "")))
}

const teamsWithoutLocalCrest = allTeams.filter((team) => !team.escudo_url.startsWith("/escudos/") || !publicFileExists(team.escudo_url))
check("escudos locais de todos os times", teamsWithoutLocalCrest.length === 0, teamsWithoutLocalCrest.map((team) => team.nome).join(", "))

const squadSizes = allTeams.map((team) => ({ team, players: getPlayersForTeam(team) }))
const shortSquads = squadSizes.filter(({ players }) => players.length < 18)
const squadsWithoutGoalkeeper = squadSizes.filter(({ players }) => !players.some((player) => player.pos === "GOL"))
check("elencos jogaveis com pelo menos 18 atletas", shortSquads.length === 0, shortSquads.map(({ team, players }) => `${team.nome}:${players.length}`).join(", "))
check("todos os elencos tem goleiro", squadsWithoutGoalkeeper.length === 0, squadsWithoutGoalkeeper.map(({ team }) => team.nome).join(", "))

const simulatedMatches = allTeams.slice(0, 40).map((home, index) => {
  const away = allTeams[(index + 7) % allTeams.length]
  return simulateFullMatch({
    homeTeam: home,
    awayTeam: away,
    homeRating: Math.max(50, Math.min(95, home.prestigio)),
    awayRating: Math.max(50, Math.min(95, away.prestigio)),
    modifiers: createMatchModifiers(),
  })
})
check(
  "simulacao rapida de partidas termina",
  simulatedMatches.every((match) => match.phase === "fulltime" && match.minute === 90),
  simulatedMatches.map((match) => `${match.phase}:${match.minute}`).join(", "),
)

const tracksPath = path.join(root, "music", "tracks.json")
if (existsSync(tracksPath)) {
  const tracks = JSON.parse(readFileSync(tracksPath, "utf8").replace(/^\uFEFF/, "")) as Array<{ title: string; src: string }>
  const missingTracks = tracks.filter((track) => !existsSync(path.join(root, decodeURIComponent(track.src.replace(/^\/music\//, "music/")))))
  check("tracks.json aponta para arquivos de musica existentes", tracks.length > 0 && missingTracks.length === 0, `tracks=${tracks.length}, missing=${missingTracks.length}`)
} else {
  check("tracks.json presente (opcional)", true, "ausente neste ambiente - opcional")
}

useGameEngine.getState().initializeGame("BGT")
const engine = useGameEngine.getState()
const firstPlayer = engine.squadPlayers[0]
const squadCountBefore = engine.squadPlayers.length
const balanceBefore = engine.balance

if (firstPlayer) {
  const buyTarget = { ...firstPlayer, id: 990001, name: "QA Compra", marketValue: 1000000 }
  engine.buyPlayer(buyTarget, 1000000)
  const afterBuy = useGameEngine.getState()
  check("compra de jogador atualiza elenco e saldo", afterBuy.squadPlayers.length === squadCountBefore + 1 && afterBuy.balance === balanceBefore - 1000000)

  const loanTarget = { ...firstPlayer, id: 990002, name: "QA Emprestimo", marketValue: 500000 }
  afterBuy.loanPlayer(loanTarget, 26, 15000)
  const afterLoan = useGameEngine.getState()
  check("emprestimo adiciona jogador emprestado", afterLoan.squadPlayers.some((player) => player.name === "QA Emprestimo" && player.isLoanedIn))

  afterLoan.renewContract(firstPlayer.id, (firstPlayer.contract?.salary ?? 50000) + 1000, 104)
  const afterRenew = useGameEngine.getState()
  check("renovacao de contrato atualiza salario", afterRenew.squadPlayers.some((player) => player.id === firstPlayer.id && player.contract?.salary === (firstPlayer.contract?.salary ?? 50000) + 1000))

  afterRenew.sellPlayer(990001)
  const afterSell = useGameEngine.getState()
  check("venda remove jogador comprado", !afterSell.squadPlayers.some((player) => player.id === 990001))
}

const weekBeforeAdvance = useGameEngine.getState().currentWeek
for (let i = 0; i < 60; i++) {
  useGameEngine.getState().advanceWeek()
}
const afterSeasonAdvance = useGameEngine.getState()
check("avanco de semanas no engine nao trava", afterSeasonAdvance.currentWeek === weekBeforeAdvance + 60, `week ${weekBeforeAdvance} -> ${afterSeasonAdvance.currentWeek}`)
useGameEngine.getState().simulateOtherMatches()
check("simulacao de outros jogos gera resultados", useGameEngine.getState().matchResults.length > 0)

useGameEngine.getState().processSeasonEnd(afterSeasonAdvance.currentSeason + 1, [], afterSeasonAdvance.serieAStandings)
const afterSeasonEnd = useGameEngine.getState()
check("processSeasonEnd reseta semana e avanca temporada", afterSeasonEnd.currentSeason === afterSeasonAdvance.currentSeason + 1 && afterSeasonEnd.currentWeek === 0, `season ${afterSeasonAdvance.currentSeason} -> ${afterSeasonEnd.currentSeason}, week=${afterSeasonEnd.currentWeek}`)

const failed = results.filter((result) => !result.ok)
for (const result of results) {
  console.log(`${result.ok ? "OK" : "FAIL"} ${result.name}${result.details ? ` - ${result.details}` : ""}`)
}

if (failed.length > 0) {
  process.exitCode = 1
} else {
  console.log(`QA smoke finalizado: ${results.length} checks passaram.`)
}

setTimeout(() => process.exit(process.exitCode ?? 0), 0)
