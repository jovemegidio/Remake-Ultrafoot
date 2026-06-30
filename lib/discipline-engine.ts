// PHASE 36 — Disciplina
// Status: skeleton — cartões, suspensão, multa, indisciplina, briga no treino.

export interface DisciplinaryRecord {
  playerId: string
  yellowCards: number              // acumulados na temporada
  redCards: number
  suspensions: Suspension[]
  fines: Fine[]
  internalIncidents: InternalIncident[]
}

export interface Suspension {
  id: string
  reason: "yellow_card_threshold" | "red_card" | "violent_conduct" | "racism" | "doping"
  matchesRemaining: number
  competition: string
}

export interface Fine {
  id: string
  amount: number
  reason: string
  paid: boolean
}

export interface InternalIncident {
  id: string
  type: "training_fight" | "missed_training" | "club_disrepute" | "social_media"
  severity: "minor" | "major" | "severe"
  fineSuggested: number
  resolved: boolean
}

/** Aplica cartão (atualiza acumulação e dispara suspensão se necessário). */
export function applyCard(_record: DisciplinaryRecord, _card: "yellow" | "red", _competition: string): DisciplinaryRecord {
  throw new Error("discipline-engine.applyCard: not implemented")
}

/** Resolve suspensão (decrementa partidas restantes). */
export function tickSuspensions(_record: DisciplinaryRecord, _matchesPlayed: number, _competition: string): DisciplinaryRecord {
  throw new Error("discipline-engine.tickSuspensions: not implemented")
}

/** Detecta incidentes internos via roll baseado em personalidade. */
export function detectInternalIncidents(_playerIds: string[], _personalities: Record<string, string>): InternalIncident[] {
  throw new Error("discipline-engine.detectInternalIncidents: not implemented")
}
