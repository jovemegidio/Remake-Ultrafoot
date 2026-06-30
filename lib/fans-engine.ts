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
  throw new Error("fans-engine.update: not implemented")
}

/** Calcula attendance esperado pra próximo jogo em casa. */
export function calcAttendance(_state: FansState, _stadiumCap: number, _isClasico: boolean): number {
  throw new Error("fans-engine.calcAttendance: not implemented")
}

/** Detecta deflagração de campanha (ex: 4 derrotas seguidas → fire_coach). */
export function detectCampaign(_state: FansState, _recentResults: ("W"|"D"|"L")[]): FanCampaign | null {
  throw new Error("fans-engine.detectCampaign: not implemented")
}
