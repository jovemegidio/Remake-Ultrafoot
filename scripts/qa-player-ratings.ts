import { allPoolTeams } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

const ratings = allPoolTeams.flatMap(team => getPlayersForTeam(team).map(player => player.base))
if (!ratings.length) throw new Error("Banco de jogadores vazio")
const min = Math.min(...ratings)
const max = Math.max(...ratings)
const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length
if (min < 40 || max > 91) throw new Error(`Overall fora da escala: ${min}-${max}`)
if (average < 50 || average > 80) throw new Error(`Media global incoerente: ${average}`)
console.log(`OK overall: ${ratings.length} registros calibrados, faixa ${min}-${max}, média ${average.toFixed(1)}`)
