// Copas regionais brasileiras: Copa do Nordeste e Copa Verde.
//
// Ausência real confirmada em 2026-07-20: nenhuma das duas existia em lugar
// nenhum do código (zero ocorrências). A elegibilidade vem do ESTADO do clube —
// o mesmo campo que os estaduais já usam, então o dado existe e é confiável.

export interface RegionalCup {
  id: string
  name: string
  /** UFs elegíveis. */
  states: readonly string[]
  /** Partidas do usuário na campanha (modelo simplificado de mata-mata). */
  matchCount: number
}

export const COPA_NORDESTE: RegionalCup = {
  id: "copa_nordeste",
  name: "Copa do Nordeste",
  states: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  matchCount: 4,
}

/**
 * A Copa Verde reúne o Norte + MT, MS, DF e ES — é assim no regulamento real
 * da CBF, ainda que o ES geograficamente destoe.
 */
export const COPA_VERDE: RegionalCup = {
  id: "copa_verde",
  name: "Copa Verde",
  states: ["AC", "AM", "AP", "PA", "RO", "RR", "TO", "MT", "MS", "DF", "ES"],
  matchCount: 4,
}

const TODAS: readonly RegionalCup[] = [COPA_NORDESTE, COPA_VERDE]

/**
 * A copa regional que o clube disputa, pelo estado. `null` para estados fora
 * das duas regiões (SP, RJ, MG, RS, PR, SC, GO) — como na vida real.
 */
export function regionalCupForState(estado: string | undefined | null): RegionalCup | null {
  if (!estado) return null
  return TODAS.find(cup => cup.states.includes(estado)) ?? null
}
