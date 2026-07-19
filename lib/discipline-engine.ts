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
  const next = { ..._record, suspensions: [..._record.suspensions], fines: [..._record.fines], internalIncidents: [..._record.internalIncidents] }
  if (_card === "yellow") {
    next.yellowCards++
    if (next.yellowCards % 3 === 0) next.suspensions.push({ id: `susp_y_${next.playerId}_${next.yellowCards}_${_competition}`, reason: "yellow_card_threshold", matchesRemaining: 1, competition: _competition })
  } else {
    next.redCards++
    next.suspensions.push({ id: `susp_r_${next.playerId}_${next.redCards}_${_competition}`, reason: "red_card", matchesRemaining: 1, competition: _competition })
  }
  return next
}

/** Resolve suspensão (decrementa partidas restantes). */
export function tickSuspensions(_record: DisciplinaryRecord, _matchesPlayed: number, _competition: string): DisciplinaryRecord {
  return { ..._record, suspensions: _record.suspensions.map(s => s.competition === _competition ? { ...s, matchesRemaining: Math.max(0, s.matchesRemaining - Math.max(0, _matchesPlayed)) } : s).filter(s => s.matchesRemaining > 0) }
}

/** Detecta incidentes internos via roll baseado em personalidade. */
export function detectInternalIncidents(_playerIds: string[], _personalities: Record<string, string>): InternalIncident[] {
  return _playerIds.flatMap((playerId, index) => {
    const personality = (_personalities[playerId] ?? "profissional").toLowerCase()
    if (!/polemico|preguicoso|agressivo/.test(personality) || (playerId.length + index) % 7 !== 0) return []
    const type: InternalIncident["type"] = personality.includes("preguicoso") ? "missed_training" : "training_fight"
    return [{ id: `incident_${playerId}_${index}`, type, severity: "minor", fineSuggested: 5000, resolved: false }]
  })
}
