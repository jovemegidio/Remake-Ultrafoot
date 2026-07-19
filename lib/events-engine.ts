// PHASE 21 — Eventos dinâmicos
// Status: skeleton — lesões em massa, atraso salário, proposta inesperada, polêmica,
// invasão treino, patrocinador ameaça, venda sem autorização, chuva forte.

import type { GameState } from "@/lib/save-system"

export type DynamicEventId =
  | "mass_injuries"
  | "salary_delay"
  | "surprise_offer"
  | "player_polemic"
  | "training_invasion"
  | "sponsor_threat"
  | "unauthorized_sale"
  | "heavy_rain"
  | "stadium_issue"
  | "transport_strike"

export interface DynamicEvent {
  id: string
  type: DynamicEventId
  triggeredAt: number              // week
  season: number
  context: Record<string, unknown>
  resolved: boolean
  options?: { id: string; text: string; outcome: Record<string, unknown> }[]
}

/** Decide se evento será disparado nessa semana (probabilidade baseada em estado). */
export function rollEvents(state: GameState, week: number): DynamicEvent[] {
  const result:DynamicEvent[]=[]
  if (week>0 && week%13===0 && (state.balance??0)<0) result.push({id:`${state.season}-${week}-salary`,type:"salary_delay",triggeredAt:week,season:state.season,context:{balance:state.balance},resolved:false,options:[{id:"inject",text:"Cobrir os salários",outcome:{balanceDelta:-500000,moraleDelta:4}},{id:"explain",text:"Conversar com o elenco",outcome:{moraleDelta:-3}}]})
  if (week>0 && week%17===0) result.push({id:`${state.season}-${week}-rain`,type:"heavy_rain",triggeredAt:week,season:state.season,context:{},resolved:false,options:[{id:"adapt",text:"Adaptar o treino",outcome:{moraleDelta:1}},{id:"maintain",text:"Manter programação",outcome:{moraleDelta:-1}}]})
  return result
}

/** Aplica resolução escolhida pelo usuário. */
export function resolveEvent(
  state: GameState,
  eventId: string,
  optionId: string,
): GameState {
  const next=structuredClone(state)
  const morale=optionId==="inject"?4:optionId==="explain"?-3:optionId==="adapt"?1:-1
  next.teamMorale=Math.max(0,Math.min(100,(next.teamMorale??65)+morale)); if(optionId==="inject")next.balance=(next.balance??0)-500000;next.updatedAt=Date.now();void eventId;return next
}
