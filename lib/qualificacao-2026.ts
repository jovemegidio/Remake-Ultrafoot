// CLASSIFICADOS REAIS para as competições continentais de 2026.
//
// O jogo decidia a continental do clube pela POSICAO no ranking de prestígio da
// liga — um chute razoável, mas que não corresponde à realidade. Na temporada
// inicial (2026) os classificados já estão definidos pelo que aconteceu em 2025,
// e o jogador reconhece na hora quando está errado: o Corinthians foi campeão da
// Copa do Brasil 2025 e por isso está na Libertadores 2026; o Flamengo entrou
// como campeão da Libertadores 2025.
//
// Isto vale SÓ para a temporada inicial. A partir de 2027 quem decide é o que
// aconteceu dentro do jogo (posição na liga + títulos), como deve ser.
//
// Fonte: CBF/CONMEBOL — divulgação das vagas após a final da Copa do Brasil 2025.

/** Competição continental de um clube na temporada 2026, por nome do clube. */
export interface Qualificacao2026 {
  /** "libertadores" | "sulamericana" | "champions_league" | "europa_league" | "conference_league" */
  competicao: string
  /** Entra direto na fase de grupos ou vem das preliminares. */
  fase: "grupos" | "preliminar"
  motivo: string
}

const norm = (s: string) => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "")

// ── CONMEBOL 2026 (Brasil) ───────────────────────────────────────────────
const BRASIL: Record<string, Qualificacao2026> = {
  flamengo:    { competicao: "libertadores", fase: "grupos", motivo: "Campeão da Libertadores 2025" },
  corinthians: { competicao: "libertadores", fase: "grupos", motivo: "Campeão da Copa do Brasil 2025" },
  palmeiras:   { competicao: "libertadores", fase: "grupos", motivo: "Classificado pelo Brasileirão 2025" },
  cruzeiro:    { competicao: "libertadores", fase: "grupos", motivo: "Classificado pelo Brasileirão 2025" },
  mirassol:    { competicao: "libertadores", fase: "grupos", motivo: "Classificado pelo Brasileirão 2025" },
  fluminense:  { competicao: "libertadores", fase: "grupos", motivo: "Classificado pelo Brasileirão 2025" },
  botafogo:    { competicao: "libertadores", fase: "preliminar", motivo: "Fase preliminar da Libertadores 2026" },
  bahia:       { competicao: "libertadores", fase: "preliminar", motivo: "Fase preliminar da Libertadores 2026" },
  // Os seguintes do Brasileirão 2025 caem na Sul-Americana.
  vasco:          { competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
  vascodagama:    { competicao: "sulamericana", fase: "grupos", motivo: "Vice da Copa do Brasil 2025" },
  saopaulo:       { competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
  gremio:         { competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
  atleticomineiro:{ competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
  atleticomg:     { competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
  internacional:  { competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
  bragantino:     { competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
  rbbragantino:   { competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
  ceara:          { competicao: "sulamericana", fase: "grupos", motivo: "Vaga na Sul-Americana 2026" },
}

const TABELA: Record<string, Qualificacao2026> = { ...BRASIL }

/** A TEMPORADA em que estes dados valem. Depois disso, quem manda é o jogo. */
export const TEMPORADA_QUALIFICACAO = 2026

/**
 * Competição continental REAL do clube em 2026, ou null quando ele não se
 * classificou (ou a temporada já não é a inicial).
 */
export function qualificacaoReal2026(
  nomeDoClube: string,
  temporada: number,
): Qualificacao2026 | null {
  if (temporada !== TEMPORADA_QUALIFICACAO) return null
  return TABELA[norm(nomeDoClube)] ?? null
}

/** O clube tem vaga continental definida para 2026? */
export function temVagaContinental2026(nomeDoClube: string, temporada: number): boolean {
  return qualificacaoReal2026(nomeDoClube, temporada) !== null
}
