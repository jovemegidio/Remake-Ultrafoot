// Acesso e rebaixamento — a regra que faltava.
//
// A auditoria dos regulamentos mostrou: promocao/rebaixamento eram CALCULADOS (endSeason
// devolvia campeao/rebaixados) mas NUNCA aplicados. A divisao do clube vinha de
// teams-data (estatico) e nada a mudava — terminar em ultimo na Serie A e continuar na
// Serie A na temporada seguinte.
//
// Este modulo e a logica PURA (sem estado, testavel): dada a divisao e a posicao final,
// diz para qual divisao o clube vai. O save guarda um `divisionOverride`; a resolucao da
// liga passa a prefe-lo sobre a divisao estatica.

/** Escada das divisoes brasileiras, de cima para baixo. */
const BR_LADDER = ["serie_a", "serie_b", "serie_c", "serie_d"] as const

/** Movimentos oficiais usados na temporada 2026. Série C cai com dois clubes e a
 * nova Série D (96 participantes) promove seis. Esses números ficam no motor,
 * não apenas no texto do regulamento. */
const BR_RULES: Record<string, { up: number; down: number; size: number }> = {
  serie_a: { up: 0, down: 4, size: 20 }, // topo: ninguem sobe, 4 caem
  serie_b: { up: 4, down: 4, size: 20 },
  serie_c: { up: 4, down: 2, size: 20 },
  serie_d: { up: 6, down: 0, size: 96 },
}

export interface DivisionOutcome {
  /** Divisao para a proxima temporada (pode ser a mesma). */
  nextDivision: string
  /** "promoted" | "relegated" | "stay" */
  movement: "promoted" | "relegated" | "stay"
  message: string
}

/**
 * Decide a divisao do clube na proxima temporada.
 *
 * @param division  divisao atual (ex.: "serie_a")
 * @param position  posicao final na tabela (1 = campeao)
 * @param teamName  nome do clube (para a mensagem)
 */
export function resolveDivisionChange(
  division: string,
  position: number,
  teamName = "Seu clube",
): DivisionOutcome {
  const idx = BR_LADDER.indexOf(division as (typeof BR_LADDER)[number])
  const rules = BR_RULES[division]

  // Divisao fora da escada conhecida (ligas estrangeiras): sem acesso/rebaixamento aqui.
  if (idx === -1 || !rules) {
    return { nextDivision: division, movement: "stay", message: "" }
  }

  // Rebaixado: entre os ultimos `down`.
  if (rules.down > 0 && position > rules.size - rules.down) {
    const below = BR_LADDER[idx + 1]
    if (below) {
      return {
        nextDivision: below,
        movement: "relegated",
        message: `${teamName} foi REBAIXADO para a ${divisionLabel(below)} (terminou em ${position}º).`,
      }
    }
  }

  // Promovido: entre os primeiros `up`.
  if (rules.up > 0 && position <= rules.up) {
    const above = BR_LADDER[idx - 1]
    if (above) {
      return {
        nextDivision: above,
        movement: "promoted",
        message: `${teamName} foi PROMOVIDO para a ${divisionLabel(above)} (terminou em ${position}º)!`,
      }
    }
  }

  return { nextDivision: division, movement: "stay", message: "" }
}

export function divisionLabel(division: string): string {
  const map: Record<string, string> = {
    serie_a: "Série A", serie_b: "Série B", serie_c: "Série C", serie_d: "Série D",
  }
  return map[division] ?? division
}
