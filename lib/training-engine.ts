// PHASE 11 — Treino semanal
// Status: skeleton — finalização, defesa, posse, contra-ataque, bola parada,
// físico, recuperação, entrosamento, jovens. Impactos: moral, energia, lesão, evolução.

import type { GameState } from "@/lib/save-system"

export type TrainingType =
  | "finalizacao"
  | "defesa"
  | "posse"
  | "contra_ataque"
  | "bola_parada"
  | "fisico"
  | "recuperacao"
  | "entrosamento"
  | "jovens"

export type TrainingIntensity = "leve" | "media" | "alta"

export interface TrainingSession {
  type: TrainingType
  intensity: TrainingIntensity
  durationDays: number
  focusPlayerIds?: string[]
}

export interface TrainingWeekPlan {
  weekStart: number                // round
  sessions: TrainingSession[]      // ~5 por semana
  restDays: number
}

export interface TrainingResult {
  attributeGains: { playerId: string; attr: string; delta: number }[]
  moraleDelta: number              // -10..+10 médio do elenco
  energyDelta: number              // -20..0
  injuries: { playerId: string; severity: "leve" | "muscular" | "grave" }[]
  cohesionDelta: number            // entrosamento tático
}

/** Cria plano de treino padrão da semana. */
export function defaultWeekPlan(round: number): TrainingWeekPlan {
  return { weekStart: round, restDays: 2, sessions: [
    { type: "recuperacao", intensity: "leve", durationDays: 1 },
    { type: "posse", intensity: "media", durationDays: 1 },
    { type: "defesa", intensity: "media", durationDays: 1 },
    { type: "finalizacao", intensity: "media", durationDays: 1 },
    { type: "entrosamento", intensity: "leve", durationDays: 1 },
  ] }
}

/** Aplica plano semanal: atualiza atributos, moral, energia, gera lesões. */
export function applyWeek(state: GameState, plan: TrainingWeekPlan): {
  state: GameState
  result: TrainingResult
} {
  const next = structuredClone(state)
  const players = next.squadPlayers ?? []
  const gains: TrainingResult["attributeGains"] = []
  const injuries: TrainingResult["injuries"] = []
  const weight = { leve: .25, media: .55, alta: .9 }
  const attr: Record<TrainingType, string> = { finalizacao:"shooting", defesa:"defending", posse:"passing", contra_ataque:"pace", bola_parada:"shooting", fisico:"physical", recuperacao:"overall", entrosamento:"passing", jovens:"potential" }
  for (const session of plan.sessions) {
    const selected = session.focusPlayerIds?.length ? players.filter(p => session.focusPlayerIds!.includes(p.id)) : players
    for (const player of selected) {
      const delta = Math.max(0, Math.round(weight[session.intensity] * session.durationDays * (player.age <= 23 ? 1.35 : .8) * 10) / 10)
      const key = attr[session.type]
      if (key !== "overall" && key !== "potential") (player as unknown as Record<string, unknown>)[key] = Math.min(99, Number((player as unknown as Record<string, unknown>)[key] ?? player.overall) + delta)
      // Teto rígido de 99 além do potencial: o overall JAMAIS passa de 99, mesmo
      // que um potencial corrompido fosse maior (relato "overall 99+").
      if (session.type === "jovens" || session.type === "fisico") player.overall = Math.min(99, Math.min(player.potential, player.overall + delta * .15))
      gains.push({ playerId: player.id, attr: key, delta })
      const roll = (([...`${player.id}:${plan.weekStart}:${session.type}`].reduce((a,c)=>a+c.charCodeAt(0),0) * 9301 + 49297) % 10000) / 10000
      if (roll < injuryRisk(session, player.id)) injuries.push({ playerId: player.id, severity: session.intensity === "alta" ? "muscular" : "leve" })
    }
  }
  const load = plan.sessions.reduce((n,s)=>n + weight[s.intensity] * s.durationDays, 0)
  const energyDelta = Math.round(Math.min(0, plan.restDays * 2 - load * 3))
  const moraleDelta = Math.max(-10, Math.min(10, Math.round(plan.restDays - Math.max(0, load - 3))))
  next.teamMorale = Math.max(0, Math.min(100, (next.teamMorale ?? 65) + moraleDelta))
  next.playerFatigue = { ...(next.playerFatigue ?? {}) }
  for (const p of players) next.playerFatigue[p.id] = Math.max(0, Math.min(100, (next.playerFatigue[p.id] ?? 0) - energyDelta))
  return { state: next, result: { attributeGains: gains, moraleDelta, energyDelta, injuries, cohesionDelta: plan.sessions.some(s=>s.type === "entrosamento") ? 2 : 0 } }
}

/** Avalia risco de lesão de uma sessão. */
export function injuryRisk(session: TrainingSession, _playerId: string): number {
  const base = { leve: .002, media: .006, alta: .018 }[session.intensity]
  return Math.min(.08, base * session.durationDays * (session.type === "fisico" ? 1.5 : session.type === "recuperacao" ? .25 : 1))
}
