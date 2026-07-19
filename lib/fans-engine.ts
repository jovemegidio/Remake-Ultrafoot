// PHASE 19 — Torcida
// Status: skeleton — confiança, protesto, apoio, vaias, mosaico, campanha demissão,
// pressão de clássico.

export interface FansState {
  confidence: number               // 0..100
  attendance: number               // 0..1 (fill rate)
  loyalty: number                  // 0..100
  ultras: number                   // 0..100 (intensidade da torcida organizada)
  pressureLevel: number            // 0..100
  campaigns: FanCampaign[]
}

export type FanCampaignType =
  | "boycott"                      // boicote estádio
  | "fire_coach"                   // demissão técnica
  | "fire_president"
  | "support_team"                 // apoio incondicional
  | "memorial"                     // homenagem

export interface FanCampaign {
  id: string
  type: FanCampaignType
  intensity: number                // 0..100
  startedAt: number                // week
  endsAt: number
  triggerEvent?: string
}

/** Atualiza estado da torcida após resultado/evento. */
export function update(_state: FansState, _event: { type: string; magnitude: number }): FansState {
  const direction = /win|title|promotion|signing|support/.test(_event.type) ? 1 : /loss|releg|scandal|delay/.test(_event.type) ? -1 : 0
  const delta = direction * Math.max(0, Math.min(20, _event.magnitude))
  const confidence = Math.max(0, Math.min(100, _state.confidence + delta))
  return { ..._state, confidence, attendance: Math.max(.15, Math.min(1, _state.attendance + delta / 250)), pressureLevel: Math.max(0, Math.min(100, _state.pressureLevel - delta)) }
}

/** Calcula attendance esperado pra próximo jogo em casa. */
export function calcAttendance(_state: FansState, _stadiumCap: number, _isClasico: boolean): number {
  const campaignPenalty = _state.campaigns.some(c => c.type === "boycott") ? .55 : 1
  const rate = Math.max(.1, Math.min(1, (_state.attendance * .55 + _state.confidence / 250 + _state.loyalty / 500 + (_isClasico ? .18 : 0)) * campaignPenalty))
  return Math.round(Math.max(0, _stadiumCap) * rate)
}

/** Detecta deflagração de campanha (ex: 4 derrotas seguidas → fire_coach). */
export function detectCampaign(_state: FansState, _recentResults: ("W"|"D"|"L")[]): FanCampaign | null {
  const losses = _recentResults.slice(-5).filter(result => result === "L").length
  if (losses < 4 || _state.confidence > 35) return null
  const type: FanCampaignType = _state.confidence < 18 ? "fire_coach" : "boycott"
  return { id: `fans_${type}_${_recentResults.join("")}`, type, intensity: Math.min(100, 45 + losses * 10 + _state.pressureLevel / 3), startedAt: 0, endsAt: 4, triggerEvent: `${losses} derrotas nos últimos 5 jogos` }
}
