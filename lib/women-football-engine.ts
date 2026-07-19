// PHASE 27 — Futebol feminino (estrutura para expansão futura)
// Status: skeleton — clubes, carreira, competições femininas. Espelha career-engine
// mas mantém séries/calendário/ratings independentes.

export interface WomenClubMeta {
  curto: string
  nome: string
  hostClubCurto?: string           // se vinculado ao masculino (ex: "FLA-F" → "FLA")
  prestigio: number
  liga: "brasileirao_feminino_a1" | "brasileirao_feminino_a2"
}

export interface WomenCareerOptions {
  separateSave: boolean            // save independente
  unifiedManager: boolean          // mesmo técnico dos dois?
}
let configured:WomenCareerOptions|null=null

/** Inicializa modo feminino (cria save separado). */
export function initWomenCareer(opts: WomenCareerOptions): void {
  configured={...opts};void configured
}

/** Lista clubes femininos disponíveis. */
export function listClubs(): WomenClubMeta[] {
  return []
}
