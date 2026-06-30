// PHASE 16 — Moral e personalidade
// Status: skeleton — personalidades afetam moral, renovação, desempenho, clássicos, críticas.

import type { Personality } from "@/lib/youth-engine"

export interface PlayerMorale {
  playerId: string
  level: number                    // 0..100
  trend: "rising" | "stable" | "falling"
  recentEvents: MoraleEvent[]
}

export interface MoraleEvent {
  id: string
  type:
    | "win"
    | "loss"
    | "draw"
    | "scored"
    | "missed_penalty"
    | "benched"
    | "subbed_off_early"
    | "captain_chosen"
    | "press_praise"
    | "press_criticism"
    | "fan_chant"
    | "fan_boo"
    | "salary_late"
    | "renewal_offer"
    | "training_excellent"
    | "lost_clasico"
    | "won_clasico"
  delta: number                    // -20..+20
  week: number
  season: number
}

export interface SquadMorale {
  average: number                  // média geral 0..100
  byPersonality: Record<Personality, number>
  cliques: { players: string[]; cohesion: number }[]
}

/** Aplica evento de moral em jogador. */
export function applyEvent(_morale: PlayerMorale, _event: MoraleEvent): PlayerMorale {
  throw new Error("morale-engine.applyEvent: not implemented")
}

/** Calcula moral média do elenco. */
export function calcSquadMorale(_player: PlayerMorale[]): SquadMorale {
  throw new Error("morale-engine.calcSquadMorale: not implemented")
}

/** Personalidades reagem diferente a mesmo evento. */
export function adjustForPersonality(_event: MoraleEvent, _personality: Personality): MoraleEvent {
  throw new Error("morale-engine.adjustForPersonality: not implemented")
}

// ─── MVP: moral coletivo do time ───────────────────────────────────────────────
// Modelo simples: um único número 0-100 representando o "vestiário" do time do usuário.
// Atualizado por resultados, lesões, mensagens, conquistas. Modula performance em campo.

/** Moral inicial saudável. */
export const DEFAULT_TEAM_MORALE = 70

/** Limites e zonas qualitativas. */
export function moraleZone(value: number): {
  level: 'critica' | 'baixa' | 'normal' | 'alta' | 'eufórica'
  color: string
  description: string
} {
  if (value <= 25) return { level: 'critica', color: '#ef4444', description: 'Vestiario em crise. Jogadores desconfiados, técnico pressionado.' }
  if (value <= 45) return { level: 'baixa', color: '#f97316', description: 'Clima ruim. Resultados ruins corroem a confiança.' }
  if (value <= 65) return { level: 'normal', color: '#fbbf24', description: 'Clima estável. Sem grande oscilação.' }
  if (value <= 85) return { level: 'alta', color: '#22c55e', description: 'Vestiário motivado. Jogadores confiantes.' }
  return { level: 'eufórica', color: '#1db954', description: 'Eufória total. Times confiantes vencem rivais maiores.' }
}

/** Modificador aplicado em probabilidades de partida (1.0 = neutro). */
export function moraleMatchModifier(morale: number): number {
  // 50 = neutro; cada 10 pontos acima = +2% ataque/defesa; cada 10 pontos abaixo = -2.5%
  if (morale >= 50) return 1 + ((morale - 50) / 10) * 0.02
  return 1 - ((50 - morale) / 10) * 0.025
}

/** Aplica clamp 0-100 e arredonda. */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

/** Atualiza moral baseado em delta. */
export function applyMoraleDelta(current: number, delta: number): number {
  return clamp(current + delta)
}

/** Reação a resultado da partida do usuário. */
export function moraleAfterMatch(
  current: number,
  userGoals: number,
  oppGoals: number,
  isClassico = false,
): number {
  let delta = 0
  if (userGoals > oppGoals) delta = isClassico ? +12 : +6
  else if (userGoals === oppGoals) delta = isClassico ? -2 : 0
  else delta = isClassico ? -14 : -8
  // Bônus por gols a mais (goleada motiva, goleada sofrida desmotiva)
  const diff = userGoals - oppGoals
  if (diff >= 3) delta += 3
  if (diff <= -3) delta -= 4
  return applyMoraleDelta(current, delta)
}

/** Reação a lesão de jogador titular. */
export function moraleAfterInjury(current: number, severity: 'leve' | 'moderada' | 'grave'): number {
  const delta = severity === 'leve' ? -2 : severity === 'moderada' ? -4 : -7
  return applyMoraleDelta(current, delta)
}

/** Recuperação semanal (regressão à média 70). */
export function moraleWeeklyRegression(current: number): number {
  if (current === 70) return current
  if (current > 70) return applyMoraleDelta(current, -1)
  return applyMoraleDelta(current, +1)
}

/** Reação a evento positivo (contratação importante, vitória em clássico, título). */
export function moraleAfterPositiveEvent(current: number, magnitude: 'pequeno' | 'medio' | 'grande'): number {
  const delta = magnitude === 'pequeno' ? +3 : magnitude === 'medio' ? +6 : +12
  return applyMoraleDelta(current, delta)
}
