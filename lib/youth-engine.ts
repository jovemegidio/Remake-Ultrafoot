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
export function runTryout(_state: GameState, _category: YouthCategory): YouthIntake {
  throw new Error("youth-engine.runTryout: not implemented")
}

/** Promove jovem ao elenco principal. */
export function promoteYouth(_state: GameState, _playerId: string): GameState {
  throw new Error("youth-engine.promoteYouth: not implemented")
}

/** Empresta jovem para outro clube (ganho de minutos). */
export function loanYouth(_state: GameState, _playerId: string, _toClub: string): GameState {
  throw new Error("youth-engine.loanYouth: not implemented")
}

/** Avança 1 mês de evolução: experiência, atributos, lesões da base. */
export function advanceYouthMonth(_state: GameState): { state: GameState; report: YouthMonthlyReport } {
  throw new Error("youth-engine.advanceYouthMonth: not implemented")
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
