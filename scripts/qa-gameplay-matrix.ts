import { suspensaoPorCartoes } from "../lib/player-realism"
import { resolveDivisionChange } from "../lib/league-pyramid"
import { completeTransfer, createOffer, runDeadlineDay } from "../lib/transfer-engine"
import { DEFAULT_STATE, createFreshCareerState } from "../lib/save-system"

const fail = (message: string): never => { throw new Error(message) }
// ⚠️ ATE A 1.0.351 ESTE BLOCO TESTAVA `lib/discipline-engine`, QUE O JOGO NAO
// USA. O modulo tinha zero importadores fora daqui: o gate ficava verde
// provando o comportamento de um codigo que nenhuma partida executa, enquanto a
// disciplina de verdade (`suspensaoPorCartoes` -> `suspendedMatches`, aplicada
// em lib/game-engine) nao tinha teste nenhum. Gate sobre codigo morto e pior que
// gate nenhum: ele CONVENCE. Agora o teste e sobre quem manda.
const quintoAmarelo = suspensaoPorCartoes(4, 1, false)
if (quintoAmarelo.suspender !== 1) fail("quinto amarelo não gerou suspensão")
if (quintoAmarelo.amarelosRestantes !== 0) fail("acúmulo de amarelos não zerou ao suspender")
const quartoAmarelo = suspensaoPorCartoes(3, 1, false)
if (quartoAmarelo.suspender !== 0 || quartoAmarelo.amarelosRestantes !== 4) fail("quarto amarelo não deveria suspender")
const vermelhoDireto = suspensaoPorCartoes(0, 0, true, 3)
if (vermelhoDireto.suspender !== 3) fail("vermelho direto não aplicou a pena do tribunal")

// ⚠️ Estas quatro linhas vinham de `lib/promotion-relegation`, que NINGUEM
// executa (ver scripts/qa-promotion-relegation.ts). Alem de provar codigo morto,
// elas afirmavam numeros que divergiam do jogo E da realidade: que a Serie C
// rebaixa 2 e que o 6o da Serie D sobe. A piramide viva usa 4 e 4.
if (resolveDivisionChange("serie_a", 17, 20).nextDivision !== "serie_b") fail("rebaixamento Série A")
if (resolveDivisionChange("serie_b", 4, 20).nextDivision !== "serie_a") fail("acesso Série B")
if (resolveDivisionChange("serie_c", 19, 20).nextDivision !== "serie_d") fail("rebaixamento Série C")
if (resolveDivisionChange("serie_d", 4, 20).nextDivision !== "serie_c") fail("acesso Série D")

const career = createFreshCareerState(DEFAULT_STATE, {
  managerName: "Matriz QA", selectedTeamShort: "FLA", season: 2026, week: 12, balance: 100_000_000,
  squadPlayers: [{ id: "p1", name: "Comprado", position: "ATA", age: 22, overall: 78, potential: 84, value: 20_000_000 }],
})
const offer = createOffer({ playerId: "p2", playerName: "Reforço", fromClub: "PAL", toClub: "FLA", fee: 10_000_000, monthlySalary: 100_000, signOnBonus: 500_000 })
const transferred = completeTransfer(career, offer)
if (!transferred.squadPlayers?.some(player => player.id === "p2")) fail("contratação não persistiu no elenco")
if (!transferred.transfers?.some(item => item.playerName === "Reforço")) fail("histórico da transferência ausente")
if (runDeadlineDay(transferred).events.length === 0) fail("último dia da janela sem eventos")

const otherCareer = createFreshCareerState(transferred, { managerName: "Carreira isolada", selectedTeamShort: "PAL" })
if (otherCareer.selectedTeamShort !== "PAL" || otherCareer.squadPlayers?.some(player => player.id === "p2")) fail("nova carreira herdou elenco anterior")

console.log("OK jogabilidade: cartões, suspensões, transferências, deadline, acesso/rebaixamento e isolamento de carreira")
