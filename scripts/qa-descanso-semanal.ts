// DESCANSO ENTRE SEMANAS — o relato: "ao terminar uma partida, de uma semana
// para outra o jogador nao se descansa/recupera".
//
// Eram DOIS defeitos somados, e este teste cobre os dois pelo motor (o
// qa-curva-energia cobre o modelo puro):
//
//   1. `minutosJogados` saia de `p.isStarter ? 90 : 0`. `isStarter` e um ESTADO
//      ("esta no XI"), nao um evento ("jogou"): semana SEM partida cobrava os
//      mesmos 90 minutos de quem passou a semana descansando. Descansar era
//      literalmente impossivel para um titular.
//   2. A recuperacao base (13) mal cobria o desgaste, entao mesmo a semana de
//      folga rendia quase nada.
//
//   npx tsx scripts/qa-descanso-semanal.ts     (so roda em C:\Ultrafoot — o G:
//                                               nao resolve `zustand`)
import assert from "node:assert/strict"
import { useGameEngine, type Player } from "../lib/game-engine"

const base: Player = {
  id: 1, name: "Titular Cansado", position: "MEI", age: 26, nationality: "Brasil",
  overall: 78, potential: 82, pace: 70, shooting: 70, passing: 78, dribbling: 74,
  defending: 60, physical: 70,
  energy: 55, morale: "Feliz", form: 70,
  contract: { salary: 20_000, endDate: 400, releaseClause: null, signedWeek: 1, signedSeason: 2026 },
  injury: null,
  seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
  training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
  nationalTeam: null, calledUp: false, marketValue: 10_000_000,
  joinedClubWeek: 0, joinedClubSeason: 2026, isLoanedIn: false, statusEffects: [],
  isStarter: true,
}

function montar(energia: number, minutosAcumulados: number) {
  useGameEngine.setState({
    currentWeek: 10, currentSeason: 2026,
    squadPlayers: [{
      ...base,
      energy: energia,
      seasonStats: { ...base.seasonStats, minutesPlayed: minutosAcumulados },
    }],
    fadigaCronica: {},
    // Retrato da virada anterior: e a diferenca contra ele que vira "minutos da
    // semana". Igual ao acumulado = ninguem jogou nada desde a ultima virada.
    minutosNaViradaDaSemana: { 1: minutosAcumulados },
    pendingIncomingTransfers: [],
  })
}

const energiaDoAtleta = () => useGameEngine.getState().squadPlayers[0].energy

// ─── 1. SEMANA SEM PARTIDA: o titular TEM de se recuperar ────────────────────
//
// Este e o caso do relato. Antes da correcao ele perdia energia aqui, porque
// `isStarter` cobrava 90 minutos que nunca foram jogados.
montar(55, 900)
useGameEngine.getState().advanceWeek()
const aposFolga = energiaDoAtleta()
console.log(`folga (0 min jogados): 55% -> ${aposFolga}%`)
assert.ok(aposFolga > 55, `titular deveria RECUPERAR na semana sem jogo, foi para ${aposFolga}`)
assert.ok(aposFolga - 55 >= 12, `recuperacao fraca demais na folga: +${aposFolga - 55}`)

// ─── 2. SEMANA COM PARTIDA: jogar custa ──────────────────────────────────────
//
// Mesmo atleta, mesma energia, so que os 90 minutos foram REALMENTE creditados.
montar(55, 900)
useGameEngine.setState(s => ({
  squadPlayers: s.squadPlayers.map(p => ({
    ...p, seasonStats: { ...p.seasonStats, minutesPlayed: 990 },
  })),
}))
useGameEngine.getState().advanceWeek()
const aposJogo = energiaDoAtleta()
console.log(`um jogo (90 min):      55% -> ${aposJogo}%`)
assert.ok(aposJogo < aposFolga, "a semana com jogo tem de render menos que a de folga")

// ─── 3. RODIZIO IMPORTA: dois jogos na semana derrubam ───────────────────────
montar(55, 900)
useGameEngine.setState(s => ({
  squadPlayers: s.squadPlayers.map(p => ({
    ...p, seasonStats: { ...p.seasonStats, minutesPlayed: 1080 },
  })),
}))
useGameEngine.getState().advanceWeek()
const aposDois = energiaDoAtleta()
console.log(`dois jogos (180 min):  55% -> ${aposDois}%`)
assert.ok(aposDois < 55, "semana de dois jogos deveria DERRUBAR a energia")

// ─── 4. O RETRATO SE ATUALIZA ────────────────────────────────────────────────
//
// Sem isto a diferenca seria recontada toda semana e o atleta pagaria os mesmos
// minutos para sempre — trocaria um bug pelo outro.
assert.equal(useGameEngine.getState().minutosNaViradaDaSemana[1], 1080)
useGameEngine.getState().advanceWeek()
const aposFolgaSeguinte = energiaDoAtleta()
console.log(`semana seguinte parado: ${aposDois}% -> ${aposFolgaSeguinte}%`)
assert.ok(aposFolgaSeguinte > aposDois, "sem jogar de novo, a energia tem de voltar a subir")

// ─── 5. SAVE ANTIGO NAO PODE LEVAR PUNICAO POR ATUALIZAR ─────────────────────
//
// Saves anteriores a esta versao nao tem `minutosNaViradaDaSemana`. Se a
// ausencia virasse zero, a primeira virada cobraria os minutos da TEMPORADA
// INTEIRA de uma vez (900 min = 144 de desgaste) e zeraria a energia do elenco
// inteiro de quem so instalou a atualizacao.
useGameEngine.setState({
  currentWeek: 10, currentSeason: 2026,
  squadPlayers: [{
    ...base,
    energy: 80,
    seasonStats: { ...base.seasonStats, minutesPlayed: 1800 }, // meia temporada
  }],
  fadigaCronica: {},
  minutosNaViradaDaSemana: undefined as unknown as Record<number, number>, // save antigo
  pendingIncomingTransfers: [],
})
useGameEngine.getState().advanceWeek()
const aposMigracao = energiaDoAtleta()
console.log(`save antigo (1800 min acumulados): 80% -> ${aposMigracao}%`)
assert.ok(
  aposMigracao >= 80,
  `save antigo foi punido na primeira virada: 80% -> ${aposMigracao}%`,
)
assert.equal(useGameEngine.getState().minutosNaViradaDaSemana[1], 1800)

console.log("\nOK descanso: folga repoe, jogo cobra, minutos nao sao cobrados duas vezes e save antigo nao apanha")
