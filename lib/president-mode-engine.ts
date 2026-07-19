// PHASE 28 — Modo Presidente / Diretor
// Status: skeleton — contratar técnico, orçamento, estádio, patrocinador, finanças.
// Visão complementar do GameState — sem controlar tática/escalação.

import type { GameState } from "@/lib/save-system"

export type PresidentialAction =
  | "hire_coach"
  | "fire_coach"
  | "set_budget"
  | "approve_signing"
  | "reject_signing"
  | "request_facility_upgrade"
  | "negotiate_sponsor"
  | "set_ticket_price"

export interface CoachCandidate {
  name: string
  reputation: number               // 0..100
  identity: string                 // ver tactics-engine.TacticalIdentity
  monthlyWage: number
  contractMonths: number
  achievements: string[]
}

/** Inicia carreira no modo presidente. */
export function startPresidentMode(state: GameState): GameState {
  return{...structuredClone(state),managerName:`Presidente ${state.managerName}`,updatedAt:Date.now()}
}

/** Lista candidatos a técnico. */
export function listCoachCandidates(clubPrestigio: number): CoachCandidate[] {
  return["Marcelo Reis","André Costa","Paulo Menezes","Ricardo Alves"].map((name,i)=>{const reputation=Math.max(35,Math.min(95,clubPrestigio+8-i*7));return{name,reputation,identity:["posse","pressao_alta","contra_ataque","equilibrado"][i],monthlyWage:Math.round((30000+reputation*3500)/1000)*1000,contractMonths:24,achievements:reputation>=80?["Campeão nacional"]:reputation>=65?["Acesso de divisão"]:[]}})
}

/** Aplica ação presidencial. */
export function applyAction(
  state: GameState,
  action: PresidentialAction,
  payload: Record<string, unknown>,
): GameState {
  const next=structuredClone(state);if(action==="hire_coach")next.managerName=String(payload.name??next.managerName);if(action==="fire_coach")next.managerName="Cargo vago";if(action==="set_budget")next.balance=Math.max(0,Number(payload.value??next.balance??0));if(action==="approve_signing")next.balance=(next.balance??0)-Math.max(0,Number(payload.value??0));if(action==="negotiate_sponsor")next.balance=(next.balance??0)+Math.max(0,Number(payload.advance??0));next.updatedAt=Date.now();return next
}
