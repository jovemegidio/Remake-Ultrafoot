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
  pitchFrequencyMultiplier?: number
  pitchDurationMultiplier?: number
}): { risk: number; type?: InjuryType } {
  const ctx = _ctx
  const risk = Math.max(0, Math.min(95,(
    1.5 + Math.max(0, ctx.age - 28) * 0.35 + ctx.fatigue * 0.22 +
    ctx.matchIntensity * 0.12 + Math.max(0, 7 - ctx.pitchLevel) * 1.4 -
    ctx.medicalLevel * 0.8 + ctx.recentInjuries * 4) * (ctx.pitchFrequencyMultiplier??1),
  ))
  const type: InjuryType = risk >= 55 ? "ligamento" : risk >= 38 ? "grave" : risk >= 22 ? "muscular" : "leve"
  return { risk: Math.round(risk * 10) / 10, ...(risk >= 8 ? { type } : {}) }
}

export function recoveryWeeksForSurface(baseWeeks:number,durationMultiplier=1):number{return Math.max(1,Math.ceil(baseWeeks*durationMultiplier))}

/** Adiciona lesão ao roster. */
export function inflictInjury(_injury: Omit<Injury, "id">): Injury {
  return { ..._injury, id: `inj_${_injury.playerId}_${_injury.occurredAt}_${_injury.type}` }
}

/** Avança 1 semana de recuperação (medico/fisio aceleram). */
export function tickRecovery(_injury: Injury, _medicalLevel: number, _physioLevel: number): Injury {
  const acceleration = Math.min(1.5, Math.max(0, _medicalLevel) * 0.06 + Math.max(0, _physioLevel) * 0.09)
  const recovered = Math.max(1, Math.floor(1 + acceleration))
  return { ..._injury, remainingWeeks: Math.max(0, _injury.remainingWeeks - recovered), isPlayingThrough: _injury.remainingWeeks - recovered > 0 ? _injury.isPlayingThrough : false }
}

/** Sacrifício: força jogar — risco de recaída sobe. */
export function playThrough(_injury: Injury): Injury {
  if (_injury.remainingWeeks <= 0) return _injury
  return {
    ..._injury,
    isPlayingThrough: true,
    riskOfRecurrence: Math.min(100, _injury.riskOfRecurrence + 30),
    remainingWeeks: Math.min(_injury.recoveryWeeks * 2, _injury.remainingWeeks + 1),
  }
}
