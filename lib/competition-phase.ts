// Rótulo legível da FASE de uma partida (grupos, mata-mata, final) e sinal de
// jogo decisivo — para o jogador saber em que ponto do regulamento está e para
// o office/pré-office ficar temático numa final.
//
// O dado já existe na fixture (`stage`), mas nenhuma tela o traduzia: mostrava
// só "Rodada N", sem dizer se é fase de grupos, ida/volta de mata-mata ou final.

export interface FaseInfo {
  /** Ex: "Fase de grupos", "Oitavas de final", "FINAL". */
  label: string
  /** Confronto eliminatório (mata-mata) — ida/volta ou jogo único. */
  isKnockout: boolean
  /** É a decisão do título. */
  isFinal: boolean
}

const STAGE_LABEL: Record<string, string> = {
  fase_classificatoria: "Fase de grupos",
  grupos: "Fase de grupos",
  fase_grupos: "Fase de grupos",
  primeira_fase: "Primeira fase",
  segunda_fase: "Segunda fase",
  terceira_fase: "Terceira fase",
  playoff: "Playoff",
  playoffs: "Playoffs",
  repescagem: "Repescagem",
  "32avos": "32 avos de final",
  "16avos": "16 avos de final",
  oitavas: "Oitavas de final",
  quartas: "Quartas de final",
  semis: "Semifinal",
  semifinal: "Semifinal",
  final: "FINAL",
}

const KNOCKOUT = new Set([
  "32avos", "16avos", "oitavas", "quartas", "semis", "semifinal", "final",
  "playoff", "playoffs", "repescagem", "mata_mata", "mata-mata",
])

/** Deriva a fase a partir do stage da fixture (e do texto da competição). */
export function faseDaPartida(fixture?: { stage?: string; competition?: string } | null): FaseInfo | null {
  if (!fixture) return null
  const raw = (fixture.stage ?? "").toLowerCase().replace(/\s+/g, "_")
  const comp = (fixture.competition ?? "").toLowerCase()

  // Alguns geradores marcam a final só no texto da competição.
  const finalNoTexto = /\bfinal\b/.test(comp) && !/semi/.test(comp)
  const isFinal = raw === "final" || finalNoTexto
  if (!raw && !isFinal) return null

  const label = STAGE_LABEL[raw] ?? (isFinal ? "FINAL" : null)
  if (!label) return null

  return { label, isKnockout: isFinal || KNOCKOUT.has(raw), isFinal }
}
