// PHASE 4 — Reconstrução de clube (cenários iniciais)
// Status: skeleton — cenários: gigante em crise, clube endividado, rebaixado,
// envelhecido, formador, pequeno, recém-promovido. Cada um tem metas por temporada.

import type { SavedTeam, GameState } from "@/lib/save-system"

export type RebuildScenarioId =
  | "giant_crisis"
  | "indebted"
  | "relegated"
  | "aging_squad"
  | "youth_developer"
  | "small_club"
  | "newly_promoted"

export interface SeasonGoal {
  season: number
  esportiva: { metric: string; target: string | number }
  financeira: { metric: string; target: number }
  base: { metric: string; target: string | number }
}

export interface RebuildScenario {
  id: RebuildScenarioId
  nome: string
  descricao: string
  modifiers: {
    saldoMultiplier?: number
    saldoOverride?: number
    debt?: number
    averageAge?: "young" | "old"
    moraleStart?: number
    boardPatience?: "low" | "medium" | "high"
  }
  goals: SeasonGoal[]
  durationSeasons: number
}

export const REBUILD_SCENARIOS: RebuildScenario[] = [
  {id:"giant_crisis",nome:"Gigante em crise",descricao:"Recupere resultados e confiança.",modifiers:{saldoMultiplier:.6,moraleStart:38,boardPatience:"low"},goals:[],durationSeasons:3},{id:"indebted",nome:"Clube endividado",descricao:"Equilibre as contas.",modifiers:{saldoOverride:-20000000,debt:20000000},goals:[],durationSeasons:3},{id:"relegated",nome:"Queda inesperada",descricao:"Retorne à divisão superior.",modifiers:{moraleStart:42},goals:[],durationSeasons:2},{id:"aging_squad",nome:"Fim de ciclo",descricao:"Renove um elenco envelhecido.",modifiers:{averageAge:"old"},goals:[],durationSeasons:3},{id:"youth_developer",nome:"Clube formador",descricao:"Construa pela base.",modifiers:{averageAge:"young",boardPatience:"high"},goals:[],durationSeasons:5},{id:"small_club",nome:"Davi contra Golias",descricao:"Faça um pequeno crescer.",modifiers:{saldoMultiplier:.5},goals:[],durationSeasons:5},{id:"newly_promoted",nome:"Recém-promovido",descricao:"Consolide-se na nova divisão.",modifiers:{moraleStart:72},goals:[],durationSeasons:3},
]

/** Aplica modifiers do cenário no GameState inicial. */
export function applyScenario(id: RebuildScenarioId, team: SavedTeam, state: GameState): GameState {
  const s=REBUILD_SCENARIOS.find(x=>x.id===id);if(!s)throw new Error(`Cenário inválido: ${id}`);const next=structuredClone(state),base=next.balance??team.saldo;next.balance=s.modifiers.saldoOverride??Math.round(base*(s.modifiers.saldoMultiplier??1))-(s.modifiers.debt??0);next.teamMorale=s.modifiers.moraleStart??next.teamMorale;next.selectedTeam=structuredClone(team);next.updatedAt=Date.now();return next
}

/** Avalia metas anuais do cenário. */
export function evaluateGoals(id: RebuildScenarioId, state: GameState): {
  esportivaCompleted: boolean
  financeiraCompleted: boolean
  baseCompleted: boolean
} {
  const last=state.seasonHistory?.at(-1),youth=(state.squadPlayers??[]).filter(p=>p.age<=23).length;return{esportivaCompleted:id==="relegated"?!!last?.promoted:!!last&&last.position<=12,financeiraCompleted:(state.balance??-1)>=0,baseCompleted:youth>=5}
}
