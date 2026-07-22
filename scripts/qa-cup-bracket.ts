// QA do chaveamento de copa: caminho pelo regulamento, eliminacao e semanas.
import { caminhoDaCopa, passouNoConfronto, passouNoGrupo } from "../lib/cup-bracket"
import { generateUserCupMatches, getUserCupPlan } from "../lib/use-game-manager"
import { getTeamByShort } from "../lib/teams-data"
import type { MatchResult } from "../lib/game-engine"

let falhas = 0
const checar = (ok: boolean, msg: string) => {
  if (!ok) { falhas++; console.log("  FALHOU:", msg) } else console.log("  ok:", msg)
}

console.log("CAMINHOS DO REGULAMENTO")
const cdb = caminhoDaCopa("copa_brasil", "Copa do Brasil", "cup", true)
checar(cdb.length === 5, `Copa do Brasil (Serie A) tem 5 etapas — tem ${cdb.length}`)
checar(cdb[0].stage === "quinta_fase", "entra na 5a fase (regulamento CBF 2026)")
checar(cdb[0].jogos === 2 && cdb[3].jogos === 2, "5a fase ate semifinal em ida e volta")
checar(cdb[4].stage === "final" && cdb[4].jogos === 1, "FINAL em jogo unico")
checar(cdb.reduce((s, e) => s + e.jogos, 0) === 9, "caminho completo = 9 partidas")

const cdbBaixo = caminhoDaCopa("copa_brasil", "Copa do Brasil", "cup", false)
checar(cdbBaixo.length === 9, `clube fora da 1a divisao passa por 9 fases — ${cdbBaixo.length}`)
checar(cdbBaixo.slice(0, 4).every(e => e.jogos === 1), "1a a 4a fase em jogo unico")

const lib = caminhoDaCopa("libertadores", "CONMEBOL Libertadores", "continental", true)
checar(lib[0].tipo === "grupo" && lib[0].jogos === 6, "Libertadores comeca com 6 jogos de grupo")
checar(lib[lib.length - 1].jogos === 1, "final da Libertadores em jogo unico")

console.log("\nRESOLUCAO DE CONFRONTO")
checar(passouNoConfronto([{ golsPro: 2, golsContra: 0 }, { golsPro: 0, golsContra: 1 }], 2, "x") === true, "2x0 e 0x1 = passa por 2 a 1")
checar(passouNoConfronto([{ golsPro: 0, golsContra: 2 }, { golsPro: 1, golsContra: 0 }], 2, "x") === false, "0x2 e 1x0 = cai por 2 a 1")
checar(passouNoConfronto([{ golsPro: 1, golsContra: 1 }], 2, "x") === null, "confronto incompleto ainda nao decide")
const a = passouNoConfronto([{ golsPro: 1, golsContra: 1 }, { golsPro: 0, golsContra: 0 }], 2, "semente-fixa")
const b = passouNoConfronto([{ golsPro: 1, golsContra: 1 }, { golsPro: 0, golsContra: 0 }], 2, "semente-fixa")
checar(a === b, "penaltis sao deterministicos (mesma semente, mesmo resultado)")

console.log("\nELIMINACAO NO CALENDARIO")
const time = getTeamByShort("COR")!
const plano = getUserCupPlan(time).find(p => /Copa do Brasil/i.test(p.competition.name))!
const semResultado = generateUserCupMatches(time, plano, 2026, new Set())
checar(semResultado.length === 9, `sem resultados: 9 vagas no calendario — ${semResultado.length}`)
// ATUALIZADO em 22/07/2026. Antes se cobrava que TODAS as 9 partidas ja
// existissem no calendario. Isso estava errado e o jogador viu: a FINAL da copa
// aparecia marcada antes de o clube passar pelas oitavas. So a fase corrente
// pode estar visivel; as seguintes sao vagas vazias ate a classificacao.
const visiveis = semResultado.filter(m => m !== null)
checar(visiveis.length === 2, `sem resultados, so a 5a fase visivel (2 jogos) — ${visiveis.length}`)
checar(visiveis.every(m => m!.stage === "quinta_fase"), "nenhuma fase alem da atual aparece")
checar(!visiveis.some(m => m!.stage === "final"), "a FINAL nao aparece antes de classificar")
checar(semResultado[0]?.stage === "quinta_fase", "a primeira etapa e a do regulamento")

const derrota: MatchResult[] = [0, 1].map(i => ({
  week: 10 + i, season: 2026, competition: plano.competition.name,
  homeTeam: i === 1 ? time.curto : "XXX", awayTeam: i === 1 ? "XXX" : time.curto,
  homeScore: i === 1 ? 0 : 3, awayScore: i === 1 ? 3 : 0, events: [],
}))
const aposCair = generateUserCupMatches(time, plano, 2026, new Set(), derrota)
checar(aposCair.length === 9, "o vetor mantem o tamanho (semanas nao se deslocam)")
checar(aposCair.slice(0, 2).every(m => m !== null), "as duas partidas da 5a fase continuam")
checar(aposCair.slice(2).every(m => m === null), "eliminado: nenhuma partida depois da 5a fase")

const vitoria: MatchResult[] = [0, 1].map(i => ({
  week: 10 + i, season: 2026, competition: plano.competition.name,
  homeTeam: i === 1 ? time.curto : "XXX", awayTeam: i === 1 ? "XXX" : time.curto,
  homeScore: i === 1 ? 3 : 0, awayScore: i === 1 ? 0 : 3, events: [],
}))
const aposPassar = generateUserCupMatches(time, plano, 2026, new Set(), vitoria)
checar(aposPassar.slice(2, 4).every(m => m !== null), "quem passa tem as oitavas no calendario")
checar(aposPassar[2]?.stage === "oitavas", "a fase seguinte e oitavas")

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
