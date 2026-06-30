// PHASE 35 — Lesões
// Status: skeleton — leve, muscular, grave, recaída, sacrifício.

export type InjuryType = "leve" | "muscular" | "grave" | "recaida" | "fratura" | "ligamento"

export interface Injury {
  id: string
  playerId: string
  type: InjuryType
  occurredAt: number               // week
  recoveryWeeks: number
  remainingWeeks: number
  riskOfRecurrence: number         // 0..100 (chama recaida se voltar cedo)
  source: "match" | "training" | "fatigue" | "concussion" | "challenge_gone_wrong"
  description: string
  isPlayingThrough?: boolean       // sacrifício (jogar machucado, piora estado)
}

/** Avalia risco de lesão por jogador (idade, fadiga, intensidade, gramado, médico). */
export function rollInjuryRisk(_ctx: {
  age: number
  fatigue: number
  matchIntensity: number
  pitchLevel: number
  medicalLevel: number
  recentInjuries: number
}): { risk: number; type?: InjuryType } {
  throw new Error("injury-engine.rollInjuryRisk: not implemented")
}

/** Adiciona lesão ao roster. */
export function inflictInjury(_injury: Omit<Injury, "id">): Injury {
  throw new Error("injury-engine.inflictInjury: not implemented")
}

/** Avança 1 semana de recuperação (medico/fisio aceleram). */
export function tickRecovery(_injury: Injury, _medicalLevel: number, _physioLevel: number): Injury {
  throw new Error("injury-engine.tickRecovery: not implemented")
}

/** Sacrifício: força jogar — risco de recaída sobe. */
export function playThrough(_injury: Injury): Injury {
  throw new Error("injury-engine.playThrough: not implemented")
}
