import type { Player } from "@/lib/game-engine"

export type SquadRole = "estrela" | "titular" | "rotacao" | "promessa" | "reserva"
export type SquadConcern = "tempo_de_jogo" | "papel_reduzido" | "moral_baixa" | null

export interface PlayerDynamics {
  playerId: number
  role: SquadRole
  expectedMinuteShare: number
  actualMinuteShare: number
  observedTeamMatches: number
  satisfaction: number
  concern: SquadConcern
}

export interface SquadDynamics {
  players: PlayerDynamics[]
  satisfaction: number
  concerns: number
  unsettledLeaders: number
}

const EXPECTED_SHARE: Record<SquadRole, number> = {
  estrela: 0.78,
  titular: 0.62,
  rotacao: 0.34,
  promessa: 0.2,
  reserva: 0.1,
}

const MORALE_POINTS: Record<Player["morale"], number> = {
  Feliz: 82,
  Motivado: 70,
  Normal: 55,
  Insatisfeito: 35,
  Infeliz: 18,
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

export function roleLabel(role: SquadRole): string {
  return ({
    estrela: "Jogador-chave",
    titular: "Titular",
    rotacao: "Rotação",
    promessa: "Promessa",
    reserva: "Reserva",
  } satisfies Record<SquadRole, string>)[role]
}

function rolesByPlayer(players: readonly Player[]): Map<number, SquadRole> {
  const available = [...players]
    .filter(player => !player.loanedOut)
    .sort((a, b) => b.overall - a.overall || b.potential - a.potential || a.age - b.age)

  return new Map(available.map((player, index) => {
    const role: SquadRole = index < 3
      ? "estrela"
      : index < 11
        ? "titular"
        : player.age <= 21 && player.potential >= player.overall + 5
          ? "promessa"
          : index < 18
            ? "rotacao"
            : "reserva"
    return [player.id, role]
  }))
}

/**
 * Retrato derivado da dinâmica do elenco. Não cria uma segunda fonte de verdade:
 * o papel sai da qualidade relativa e a satisfação sai dos minutos, moral e forma
 * que já vivem no save.
 */
export function analyseSquadDynamics(players: readonly Player[]): SquadDynamics {
  if (players.length === 0) return { players: [], satisfaction: 55, concerns: 0, unsettledLeaders: 0 }

  const roles = rolesByPlayer(players)
  const teamMatches = Math.max(0, ...players.map(player => player.seasonStats?.matchesPlayed ?? 0))
  const possibleMinutes = Math.max(90, teamMatches * 90)

  const dynamics = players.map(player => {
    const role = roles.get(player.id) ?? "reserva"
    const expectedMinuteShare = EXPECTED_SHARE[role]
    const actualMinuteShare = clamp((player.seasonStats?.minutesPlayed ?? 0) / possibleMinutes, 0, 1)
    const morale = player.moralePoints ?? MORALE_POINTS[player.morale] ?? 55
    const playingTimeImpact = teamMatches >= 4 ? (actualMinuteShare - expectedMinuteShare) * 62 : 0
    const formImpact = clamp((player.form - 60) * 0.18, -7, 7)
    const satisfaction = Math.round(clamp(58 + (morale - 55) * 0.42 + playingTimeImpact + formImpact))

    let concern: SquadConcern = null
    if (!player.injury && teamMatches >= 5) {
      const shortfall = expectedMinuteShare - actualMinuteShare
      if ((role === "estrela" || role === "titular") && shortfall >= 0.28) concern = "tempo_de_jogo"
      else if (role === "rotacao" && shortfall >= 0.24) concern = "papel_reduzido"
    }
    if (!concern && morale <= 30) concern = "moral_baixa"

    return { playerId: player.id, role, expectedMinuteShare, actualMinuteShare, observedTeamMatches: teamMatches, satisfaction, concern }
  })

  const satisfaction = Math.round(dynamics.reduce((sum, item) => sum + item.satisfaction, 0) / dynamics.length)
  return {
    players: dynamics,
    satisfaction,
    concerns: dynamics.filter(item => item.concern).length,
    unsettledLeaders: dynamics.filter(item => item.concern && (item.role === "estrela" || item.role === "titular")).length,
  }
}

function moraleLabel(points: number): Player["morale"] {
  if (points >= 76) return "Feliz"
  if (points >= 63) return "Motivado"
  if (points >= 43) return "Normal"
  if (points >= 26) return "Insatisfeito"
  return "Infeliz"
}

/**
 * Consequência semanal de cumprir (ou ignorar) o papel no elenco. Uma ausência
 * isolada não derruba moral: a cobrança começa após cinco partidas e é limitada
 * a dois pontos por semana para não criar uma espiral impossível de recuperar.
 */
export function applyWeeklyPlayingTimeMorale(
  player: Player,
  dynamics: PlayerDynamics,
  minutesThisWeek: number,
  teamMatchesThisWeek: number,
  /**
   * `moralSemanal` de `lib/efeito-do-treinador.ts` — o atributo MOTIVAÇÃO do
   * técnico, mais a habilidade "Motivação no Vestiário". Neutro em 0.
   *
   * Este é o único canal de moral por MINUTAGEM que existe, e é onde o
   * motivador tem de aparecer: quem sabe conversar segura o reserva insatisfeito
   * (delta negativo vira zero) e quem não sabe perde o grupo mais rápido.
   */
  ajusteDoTecnico = 0,
): Player {
  if (teamMatchesThisWeek <= 0 || player.injury || player.calledUp) return player

  if (dynamics.observedTeamMatches < 5) return player

  const expectedWeeklyMinutes = dynamics.expectedMinuteShare * teamMatchesThisWeek * 90
  const difference = minutesThisWeek - expectedWeeklyMinutes
  let delta = 0

  if (difference <= -65 && (dynamics.role === "estrela" || dynamics.role === "titular")) delta = -2
  else if (difference <= -40 && dynamics.role === "rotacao") delta = -1
  else if (difference >= 15 && dynamics.satisfaction < 72) delta = 1

  if (delta === 0) return player
  // ⚠️ O AJUSTE NÃO PODE INVERTER O SINAL. Um técnico motivador deixando o
  // reserva insatisfeito FELIZ por ficar no banco seria o oposto do modelo — o
  // que ele faz é segurar a queda. Por isso o resultado é aparado contra zero,
  // e não simplesmente somado.
  const ajustado = delta < 0
    ? Math.min(0, Math.max(-3, delta + ajusteDoTecnico))
    : Math.max(0, Math.min(2, delta + ajusteDoTecnico))
  if (ajustado === 0) return player
  const current = player.moralePoints ?? MORALE_POINTS[player.morale] ?? 55
  const moralePoints = Math.round(clamp(current + ajustado))
  return { ...player, moralePoints, morale: moraleLabel(moralePoints) }
}
