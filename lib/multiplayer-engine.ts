// PHASE 29 — Multiplayer local
// Status: skeleton — 2-4 técnicos no mesmo save, turnos semanais,
// disputa de mercado, tabela compartilhada.

import { DEFAULT_STATE, type GameState, type SavedTeam } from "@/lib/save-system"

export interface MultiplayerSlot {
  slotId: number                   // 1..4
  managerName: string
  team: SavedTeam
  isAI: boolean
  ready: boolean                   // marcou turno como concluído?
  pendingDecisions: string[]       // ids de eventos pendentes
}

export interface MultiplayerSession {
  id: string
  slots: MultiplayerSlot[]
  sharedState: GameState
  currentTurn: number              // round
  turnOwner: number                // 1..4 (alternância) ou -1 = todos simultâneo
  marketLockedBy?: number
  createdAt: number
}

/** Cria sessão local com N humanos. */
export function createSession(humans: { managerName: string; team: SavedTeam }[]): MultiplayerSession {
  if(humans.length<2||humans.length>4)throw new Error("Uma sessão local requer de 2 a 4 técnicos.");const now=Date.now();return{id:`local-${now}`,slots:humans.map((h,i)=>({slotId:i+1,managerName:h.managerName,team:structuredClone(h.team),isAI:false,ready:false,pendingDecisions:[]})),sharedState:{...structuredClone(DEFAULT_STATE),multiplayerEnabled:true,createdAt:now,updatedAt:now,selectedTeam:structuredClone(humans[0].team),selectedTeamShort:humans[0].team.curto},currentTurn:0,turnOwner:-1,createdAt:now}
}

/** Avança turno só quando todos slots ready=true. */
export function advanceTurnIfReady(session: MultiplayerSession): MultiplayerSession {
  const next=structuredClone(session);if(next.slots.every(s=>s.ready&&s.pendingDecisions.length===0)){next.currentTurn++;next.sharedState.week++;next.slots.forEach(s=>s.ready=false)}return next
}

/** Disputa de mercado: 2 humanos miram mesmo jogador. */
export function resolveMarketDispute(
  session: MultiplayerSession,
  playerId: string,
): { winnerSlotId: number; reason: string } {
  const eligible=session.slots.filter(s=>s.pendingDecisions.includes(`transfer:${playerId}`));if(!eligible.length)throw new Error("Nenhum técnico disputa este jogador.");const winner=eligible.toSorted((a,b)=>b.team.prestigio-a.team.prestigio||b.team.saldo-a.team.saldo||a.slotId-b.slotId)[0];return{winnerSlotId:winner.slotId,reason:"Melhor combinação de projeto esportivo e capacidade financeira."}
}
