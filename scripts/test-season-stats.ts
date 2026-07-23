// AS ESTATISTICAS DA TEMPORADA PRECISAM ACUMULAR.
//
// Relato (2026-07-23, print do perfil): JOGOS/GOLS/ASSIST/AMARELOS/VERMELHOS/
// CRAQUE todos em 0. Causa: nenhum caminho acumulava seasonStats —
// processarDesempenhoPartida so gravava nota/moral/craque, e updatePlayerStats
// (que gravaria o resto) nunca era chamado. Simular a carreira idem.

import { useGameEngine, type Player } from "../lib/game-engine"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

function jogadorBase(id: number, name: string, position: string, overall: number, isStarter: boolean): Player {
  return {
    id, name, position: position as Player["position"], age: 25, overall, potential: overall,
    pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70,
    energy: 100, form: 70, morale: "Normal", isStarter,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
  } as unknown as Player
}

function montarElenco(): Player[] {
  return [
    jogadorBase(1, "Goleiro Titular", "GOL", 78, true),
    jogadorBase(2, "Zagueiro A", "ZAG", 75, true),
    jogadorBase(3, "Zagueiro B", "ZAG", 74, true),
    jogadorBase(4, "Lateral D", "LD", 72, true),
    jogadorBase(5, "Lateral E", "LE", 72, true),
    jogadorBase(6, "Volante", "VOL", 74, true),
    jogadorBase(7, "Meia A", "MEI", 78, true),
    jogadorBase(8, "Meia B", "MEI", 76, true),
    jogadorBase(9, "Ponta D", "PD", 79, true),
    jogadorBase(10, "Ponta E", "PE", 77, true),
    jogadorBase(11, "Centroavante", "ATA", 82, true),
    jogadorBase(12, "Reserva GOL", "GOL", 68, false),
    jogadorBase(13, "Reserva ATA", "ATA", 70, false),
  ]
}

const st = () => useGameEngine.getState()
const seasonDe = (id: number) => st().squadPlayers.find(p => p.id === id)!.seasonStats

// ── 1. JOGO AO VIVO: eventos reais viram estatistica ───────────────────────
{
  useGameEngine.setState({ squadPlayers: montarElenco() })
  // Centroavante marca 2, Meia A da 1 assistencia, Volante leva amarelo.
  const events = [
    { minute: 20, type: "goal" as const, playerId: 11, playerName: "Centroavante", assistPlayerId: 7, assistPlayerName: "Meia A" },
    { minute: 70, type: "goal" as const, playerId: 11, playerName: "Centroavante" },
    { minute: 55, type: "yellow" as const, playerId: 6, playerName: "Volante" },
  ]
  st().processarDesempenhoPartida(2, 0, events as never)

  checar("ao vivo: centroavante com 1 jogo", seasonDe(11).matchesPlayed === 1)
  checar("ao vivo: centroavante marcou 2", seasonDe(11).goals === 2, `${seasonDe(11).goals}`)
  checar("ao vivo: meia A com 1 assistencia", seasonDe(7).assists === 1, `${seasonDe(7).assists}`)
  checar("ao vivo: volante com 1 amarelo", seasonDe(6).yellowCards === 1)
  checar("ao vivo: goleiro com clean sheet (0 sofridos)", seasonDe(1).cleanSheets === 1)
  checar("ao vivo: reserva NAO ganhou jogo", seasonDe(13).matchesPlayed === 0)
  checar("ao vivo: zagueiro jogou mas nao marcou", seasonDe(2).matchesPlayed === 1 && seasonDe(2).goals === 0)
}

// ── 2. JOGO SIMULADO: placar distribuido entre os titulares ────────────────
{
  useGameEngine.setState({ squadPlayers: montarElenco() })
  st().acumularEstatisticasSimuladas(3, 1) // marcou 3, sofreu 1

  const titulares = st().squadPlayers.filter(p => p.isStarter)
  const todosJogaram = titulares.every(p => p.seasonStats.matchesPlayed === 1)
  checar("simulado: todo titular com 1 jogo", todosJogaram)

  const totalGols = st().squadPlayers.reduce((s, p) => s + p.seasonStats.goals, 0)
  checar("simulado: gols distribuidos somam o placar (3)", totalGols === 3, `${totalGols}`)

  const reservaJogou = st().squadPlayers.find(p => p.id === 13)!.seasonStats.matchesPlayed
  checar("simulado: reserva NAO ganhou jogo", reservaJogou === 0)

  const gkClean = st().squadPlayers.find(p => p.id === 1)!.seasonStats.cleanSheets
  checar("simulado: goleiro SEM clean sheet (sofreu 1)", gkClean === 0)
}

// ── 3. ACUMULA entre partidas (nao sobrescreve) ────────────────────────────
{
  useGameEngine.setState({ squadPlayers: montarElenco() })
  for (let i = 0; i < 5; i++) st().acumularEstatisticasSimuladas(2, 0)
  const titular = st().squadPlayers.find(p => p.id === 11)!
  checar("acumulo: 5 jogos simulados = 5 partidas", titular.seasonStats.matchesPlayed === 5, `${titular.seasonStats.matchesPlayed}`)
  const gk = st().squadPlayers.find(p => p.id === 1)!
  checar("acumulo: goleiro com 5 clean sheets (0 sofridos sempre)", gk.seasonStats.cleanSheets === 5, `${gk.seasonStats.cleanSheets}`)
}

// ── 4. Distribuicao pondera posicao (atacantes marcam mais no agregado) ────
{
  useGameEngine.setState({ squadPlayers: montarElenco() })
  for (let i = 0; i < 40; i++) st().acumularEstatisticasSimuladas(3, 1)
  const ataque = st().squadPlayers.filter(p => ["ATA", "PE", "PD"].includes(p.position))
    .reduce((s, p) => s + p.seasonStats.goals, 0)
  const defesa = st().squadPlayers.filter(p => ["ZAG", "LD", "LE", "GOL"].includes(p.position))
    .reduce((s, p) => s + p.seasonStats.goals, 0)
  checar("distribuicao: ataque marca mais que a defesa em 40 jogos", ataque > defesa, `ataque=${ataque} defesa=${defesa}`)
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)
