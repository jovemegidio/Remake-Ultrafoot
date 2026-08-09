/**
 * Estado social persistente dos clubes controlados pela IA.
 *
 * O resultado de uma sequência agora deixa memória: afeta moral, coesão,
 * confiança no técnico, pressão externa e, por consequência, o rendimento do
 * próximo jogo. A função é pura e determinística para que recarregar um save
 * não altere o mundo.
 */

export type AIClubAtmosphere = "unido" | "estavel" | "tenso" | "fraturado"

export interface AIClubSocialState {
  morale: number
  cohesion: number
  managerTrust: number
  supporterMood: number
  pressure: number
  atmosphere: AIClubAtmosphere
  unbeatenRun: number
  winlessRun: number
  lastUpdated: number
}

export interface AIClubSocialUpdate {
  state: AIClubSocialState
  atmosphereChanged: boolean
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export function initialAIClubSocialState(prestige = 60): AIClubSocialState {
  const expectation = Math.max(-5, Math.min(8, (prestige - 60) / 5))
  return {
    morale: 55,
    cohesion: 58,
    managerTrust: clamp(62 - expectation),
    supporterMood: 55,
    pressure: clamp(38 + expectation),
    atmosphere: "estavel",
    unbeatenRun: 0,
    winlessRun: 0,
    lastUpdated: 0,
  }
}

function atmosphereFor(morale: number, cohesion: number, trust: number, pressure: number): AIClubAtmosphere {
  const health = morale * 0.35 + cohesion * 0.3 + trust * 0.25 + (100 - pressure) * 0.1
  if (health >= 70) return "unido"
  if (health >= 49) return "estavel"
  if (health >= 32) return "tenso"
  return "fraturado"
}

/** Evolui o retrato social usando até os cinco resultados mais recentes. */
export function evolveAIClubSocialState(
  previous: AIClubSocialState | undefined,
  recentResults: readonly ("W" | "D" | "L")[],
  absoluteWeek: number,
  prestige = 60,
): AIClubSocialUpdate {
  const base = previous ?? initialAIClubSocialState(prestige)
  if (base.lastUpdated === absoluteWeek) return { state: base, atmosphereChanged: false }

  const results = recentResults.slice(-5)
  const wins = results.filter(result => result === "W").length
  const draws = results.filter(result => result === "D").length
  const losses = results.filter(result => result === "L").length
  const pointsPerGame = results.length ? (wins * 3 + draws) / results.length : 1.5
  const performance = (pointsPerGame - 1.45) * 8

  let unbeatenRun = 0
  for (let index = results.length - 1; index >= 0 && results[index] !== "L"; index--) unbeatenRun++
  let winlessRun = 0
  for (let index = results.length - 1; index >= 0 && results[index] !== "W"; index--) winlessRun++

  // Prestígio aumenta a expectativa: a mesma campanha mediana pressiona mais
  // um candidato ao título que um clube apontado para lutar pela permanência.
  const expectationPressure = Math.max(-2, Math.min(4, (prestige - 65) / 12))
  const morale = clamp(base.morale * 0.72 + 15.4 + performance + (unbeatenRun >= 4 ? 4 : 0) - (winlessRun >= 4 ? 5 : 0))
  const cohesion = clamp(base.cohesion + performance * 0.28 + (wins >= 4 ? 2 : 0) - (losses >= 4 ? 3 : 0))
  const managerTrust = clamp(base.managerTrust + performance * 0.52 - expectationPressure - (losses >= 4 ? 4 : 0))
  const supporterMood = clamp(base.supporterMood * 0.55 + 24 + performance * 1.45 - expectationPressure)
  const pressure = clamp(base.pressure * 0.65 + 13 - performance * 1.25 + expectationPressure + (winlessRun >= 4 ? 6 : 0))
  const atmosphere = atmosphereFor(morale, cohesion, managerTrust, pressure)

  return {
    state: {
      morale,
      cohesion,
      managerTrust,
      supporterMood,
      pressure,
      atmosphere,
      unbeatenRun,
      winlessRun,
      lastUpdated: absoluteWeek,
    },
    atmosphereChanged: atmosphere !== base.atmosphere,
  }
}

/** Pequeno efeito esportivo do ambiente, limitado para não substituir elenco/tática. */
export function aiClubSocialMatchModifier(state: AIClubSocialState | undefined): number {
  if (!state) return 0
  const raw = (state.morale - 55) / 13
    + (state.cohesion - 58) / 18
    + (state.managerTrust - 55) / 28
    - (state.pressure - 45) / 32
  return Math.max(-4, Math.min(3, Number(raw.toFixed(2))))
}

