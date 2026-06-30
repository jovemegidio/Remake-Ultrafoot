// PHASE 12 — Tática avançada
// Status: skeleton — instruções com/sem bola, blocos, pressão, saída, jogo direto,
// amplitude, linha defensiva, marcação. Identidade tática influencia IA do clube.

export type Formation =
  | "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "4-1-4-1" | "5-3-2" | "3-4-3" | "4-3-1-2"

export type DefensiveBlock = "alto" | "medio" | "baixo"
export type PressIntensity = "nenhuma" | "moderada" | "alta" | "tudo_ou_nada"
export type BuildUp = "curta" | "mista" | "direta"
export type Width = "estreita" | "media" | "ampla"
export type DefenseLine = "baixa" | "media" | "alta" | "muito_alta"
export type MarkingType = "zona" | "individual" | "mista"

export type TacticalIdentity =
  | "ofensivo"
  | "retranca"
  | "posse"
  | "pressao_alta"
  | "contra_ataque"
  | "bola_aerea"
  | "base_forte"

export interface TacticConfig {
  formation: Formation
  identity: TacticalIdentity

  // Com bola
  buildUp: BuildUp
  width: Width
  tempo: "lento" | "medio" | "rapido"
  passingStyle: "curto" | "misto" | "direto"

  // Sem bola
  defensiveBlock: DefensiveBlock
  press: PressIntensity
  postLossPress: boolean
  defenseLine: DefenseLine
  marking: MarkingType
  offsideTrap: boolean

  // Bola parada
  setPieceTaker?: { freeKick: string; corner: string; penalty: string }
}

/** Tática default por identidade. */
export function defaultTacticForIdentity(_id: TacticalIdentity): TacticConfig {
  throw new Error("tactics-engine.defaultTacticForIdentity: not implemented")
}

/** IA do clube respeita identidade ao montar tática. */
export function aiTacticForClub(_clubCurto: string, _identity: TacticalIdentity): TacticConfig {
  throw new Error("tactics-engine.aiTacticForClub: not implemented")
}

/** Aplica tática ao motor de partida (modificadores de rating/eventos). */
export function applyTacticModifiers(_tactic: TacticConfig): {
  attackBoost: number
  defenseBoost: number
  pressureBoost: number
  injuryRisk: number
  fatigueRate: number
} {
  throw new Error("tactics-engine.applyTacticModifiers: not implemented")
}
