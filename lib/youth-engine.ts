// PHASE 5 — Base e jovens
// Status: skeleton — sub-17, sub-20, peneiras, olheiros, potencial,
// personalidade, empréstimos, promoção, torneios base, joias raras, relatórios.

import type { GameState } from "@/lib/save-system"
import type { SquadPlayer } from "@/lib/save-system"

export type YouthCategory = "sub17" | "sub20"

export type Personality =
  | "lider"
  | "ambicioso"
  | "calmo"
  | "polemico"
  | "profissional"
  | "preguicoso"
  | "leal"
  | "mercenario"
  | "estrela"

export interface YouthPlayer extends SquadPlayer {
  category: YouthCategory
  personality: Personality
  potentialMin: number             // potencial faixa min (40-99)
  potentialMax: number             // potencial faixa max
  hiddenAttributes: boolean        // olheiro precisa avaliar
  monthsInAcademy: number
  promoted: boolean                // foi promovido pro elenco principal
  loanedTo?: string                // curto do clube emprestado
}

export interface YouthIntake {
  season: number
  qualityRoll: number              // 1-100, baseado em infra base
  players: YouthPlayer[]
  rareGem?: YouthPlayer            // joia rara aleatória
}

export interface YouthMonthlyReport {
  season: number
  month: number
  totalPlayers: number
  promotions: number
  releases: number
  highlights: { playerId: string; reason: string }[]
}

/** Roda peneira: gera novos jovens conforme infra/categoria. */
export function runTryout(state: GameState, category: YouthCategory): YouthIntake {
  const prestige = state.selectedTeam?.prestigio ?? 60
  const qualityRoll = Math.max(1, Math.min(100, Math.round(prestige * 0.7 + Math.random() * 30)))
  const count = category === "sub17" ? 5 : 4
  const players = generateYouthBatch(state.season, count, prestige).map((player, index): YouthPlayer => ({
    ...player,
    id: `youth_${category}_${state.season}_${Date.now()}_${index}`,
    age: category === "sub17" ? 15 + Math.floor(Math.random() * 3) : 17 + Math.floor(Math.random() * 4),
    category,
    personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
    potentialMin: Math.max(player.overall, player.potential - 8),
    potentialMax: player.potential,
    hiddenAttributes: true,
    monthsInAcademy: 0,
    promoted: false,
  }))
  return {
    season: state.season,
    qualityRoll,
    players,
    rareGem: players.find(player => player.potentialMax >= 88),
  }
}

/** Promove jovem ao elenco principal. */
export function promoteYouth(state: GameState, playerId: string): GameState {
  const player = (state.youthPlayers ?? []).find(item => item.id === playerId)
  if (!player) return state
  return {
    ...state,
    updatedAt: Date.now(),
    youthPlayers: (state.youthPlayers ?? []).filter(item => item.id !== playerId),
    squadPlayers: [...(state.squadPlayers ?? []), { ...player, fromTeam: "Categoria de Base", seasonSigned: state.season }],
  }
}

/** Empresta jovem para outro clube (ganho de minutos). */
export function loanYouth(state: GameState, playerId: string, toClub: string): GameState {
  return {
    ...state,
    updatedAt: Date.now(),
    youthPlayers: (state.youthPlayers ?? []).map(player => player.id === playerId
      ? { ...player, fromTeam: `Emprestado ao ${toClub}` }
      : player),
  }
}

/** Avança 1 mês de evolução: experiência, atributos, lesões da base. */
export function advanceYouthMonth(state: GameState): { state: GameState; report: YouthMonthlyReport } {
  const highlights: YouthMonthlyReport["highlights"] = []
  const youthPlayers = (state.youthPlayers ?? []).map(player => {
    if (player.overall >= player.potential || Math.random() > 0.35) return player
    highlights.push({ playerId: player.id, reason: "Evoluiu após um bom mês de treinamento na base." })
    return { ...player, overall: Math.min(player.potential, player.overall + 1), trend: "up" as const }
  })
  const nextState = { ...state, youthPlayers, updatedAt: Date.now() }
  return {
    state: nextState,
    report: {
      season: state.season,
      month: Math.floor((state.week ?? 0) / 4) + 1,
      totalPlayers: youthPlayers.length,
      promotions: 0,
      releases: 0,
      highlights,
    },
  }
}

// ─── MVP funcional: prospectos da base ─────────────────────────────────────────
// 4 jovens gerados por temporada, idade 16-19, base 55-72 com potencial alto.
// Usuario pode promover ao elenco profissional pagando taxa de R$200k.

const YOUTH_FIRST_NAMES = [
  "Lucas","João","Pedro","Gabriel","Rafael","Diego","Mateus","Thiago","Felipe","Vinicius",
  "André","Bruno","Carlos","Daniel","Eduardo","Fábio","Gustavo","Henrique","Ítalo","Júlio",
  "Kauã","Léo","Marcos","Nathan","Otávio","Paulo","Rodrigo","Samuel","Tiago","Vitor",
]
const YOUTH_LAST_NAMES = [
  "Silva","Santos","Oliveira","Souza","Lima","Pereira","Costa","Almeida","Nascimento","Rodrigues",
  "Ribeiro","Carvalho","Gomes","Martins","Araujo","Barbosa","Cardoso","Rocha","Dias","Mendes",
]
const YOUTH_POSITIONS: Array<"GOL" | "ZAG" | "VOL" | "MEI" | "ATA"> = ["GOL","ZAG","ZAG","VOL","MEI","MEI","ATA","ATA"]
const PERSONALITIES: Personality[] = ["lider", "ambicioso", "calmo", "profissional", "leal", "estrela", "polemico", "preguicoso", "mercenario"]

function randomYouthName(): string {
  const f = YOUTH_FIRST_NAMES[Math.floor(Math.random() * YOUTH_FIRST_NAMES.length)]
  const l = YOUTH_LAST_NAMES[Math.floor(Math.random() * YOUTH_LAST_NAMES.length)]
  return `${f} ${l}`
}

/** Gera 4 jovens prospectos da base para a temporada. */
export function generateYouthBatch(
  season: number,
  count = 4,
  prestige = 70,
): SquadPlayer[] {
  const result: SquadPlayer[] = []
  for (let i = 0; i < count; i++) {
    const age = 16 + Math.floor(Math.random() * 4) // 16-19
    const baseOverall = 50 + Math.floor(Math.random() * 23) + Math.floor(prestige * 0.05) // 55-72 ajustado por prestigio
    const overall = Math.min(75, baseOverall)
    const potentialBonus = 6 + Math.floor(Math.random() * 14) // +6..+19
    const potential = Math.min(99, overall + potentialBonus)
    const pos = YOUTH_POSITIONS[Math.floor(Math.random() * YOUTH_POSITIONS.length)]
    result.push({
      id: `youth_${season}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: randomYouthName(),
      position: pos,
      age,
      overall,
      potential,
      value: 200000,  // taxa de promoção fixa
      pace: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      shooting: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      passing: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      dribbling: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      defending: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      physical: Math.max(40, Math.min(99, overall + Math.floor(Math.random() * 8) - 4)),
      fromTeam: "Categoria de Base",
      trend: 'up',
      seasonSigned: season,
    })
  }
  return result
}

/** Identifica joias (potencial >=85) entre os prospectos. */
export function findYouthGems(youth: SquadPlayer[]): SquadPlayer[] {
  return youth.filter(p => p.potential >= 85)
}
