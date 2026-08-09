import type { Player, TeamTactics } from "@/lib/game-engine"

export type SquadDecision = "manter" | "renovar" | "emprestar" | "vender" | "substituir"

export interface SquadPlanEntry {
  playerId: number
  decision: SquadDecision
  targetSeason: number
  note: string
}

export interface PhaseTactic {
  /** Formação usada apenas para montar o XI antes da partida. */
  formation: string
  inPossession: Pick<TeamTactics, "passingStyle" | "tempo" | "buildUp" | "chanceCreation" | "crossingStyle" | "shootFromDistance" | "playThroughBalls"> & { formation: string }
  outOfPossession: Pick<TeamTactics, "defensiveLine" | "pressingIntensity" | "markingStyle" | "offsideTrap" | "counterPress"> & { formation: string }
  transition: Pick<TeamTactics, "counterAttack" | "holdPosition">
}

export interface PerformanceCenterState {
  squadPlan: SquadPlanEntry[]
  phaseTactic: PhaseTactic
  medicalRestrictions: Record<number, "liberado" | "minutos" | "sem-contato" | "afastado">
}

export interface PlayerProjection {
  playerId: number
  seasons: { season: number; age: number; overall: number; status: "pico" | "evolucao" | "declinio" | "estavel" }[]
}

export interface ProjectionInput { playerId: number; age: number; overall: number; potential: number }

export const DEFAULT_PHASE_TACTIC: PhaseTactic = {
  formation: "4-3-3",
  inPossession: { formation: "3-2-5", passingStyle: "curto", tempo: "normal", buildUp: "curto", chanceCreation: "misto", crossingStyle: "misto", shootFromDistance: false, playThroughBalls: true },
  outOfPossession: { formation: "4-1-4-1", defensiveLine: "alta", pressingIntensity: "alta", markingStyle: "zonal", offsideTrap: true, counterPress: true },
  transition: { counterAttack: false, holdPosition: false },
}

export const DEFAULT_PERFORMANCE_STATE: PerformanceCenterState = {
  squadPlan: [], phaseTactic: DEFAULT_PHASE_TACTIC, medicalRestrictions: {},
}

/** Migra planos da primeira versão do Performance Center, que possuíam uma
 * formação só, sem apagar decisões de elenco ou restrições médicas. */
export function normalizePerformanceState(raw: Partial<PerformanceCenterState> | null | undefined): PerformanceCenterState {
  const phase = raw?.phaseTactic
  return {
    squadPlan: Array.isArray(raw?.squadPlan) ? raw.squadPlan : [],
    medicalRestrictions: raw?.medicalRestrictions ?? {},
    phaseTactic: {
      ...DEFAULT_PHASE_TACTIC,
      ...(phase ?? {}),
      inPossession: {
        ...DEFAULT_PHASE_TACTIC.inPossession,
        ...(phase?.inPossession ?? {}),
        formation: phase?.inPossession?.formation ?? phase?.formation ?? DEFAULT_PHASE_TACTIC.inPossession.formation,
      },
      outOfPossession: {
        ...DEFAULT_PHASE_TACTIC.outOfPossession,
        ...(phase?.outOfPossession ?? {}),
        formation: phase?.outOfPossession?.formation ?? phase?.formation ?? DEFAULT_PHASE_TACTIC.outOfPossession.formation,
      },
      transition: { ...DEFAULT_PHASE_TACTIC.transition, ...(phase?.transition ?? {}) },
    },
  }
}

export function projectSquad(players: ProjectionInput[], startSeason: number, years = 5): PlayerProjection[] {
  return players.map(player => ({
    playerId: player.playerId,
    seasons: Array.from({ length: years }, (_, index) => {
      const age = player.age + index
      let projected = player.overall
      let previous = player.overall
      for (let step = 1; step <= index; step++) {
        const stepAge = player.age + step
        const growth = stepAge <= 19 ? 2.1 : stepAge <= 21 ? 1.6 : stepAge <= 23 ? 1.05 : stepAge <= 26 ? 0.3 : 0
        const decline = stepAge >= 34 ? 1.8 : stepAge >= 32 ? 1.25 : stepAge >= 30 ? 0.55 : 0
        previous = projected
        projected = Math.max(35, Math.min(player.potential, projected + growth) - decline)
      }
      const overall = Math.round(projected)
      const previousOverall = Math.round(previous)
      const status = overall > previousOverall ? "evolucao" : overall < previousOverall ? "declinio" : age >= 26 && age <= 30 ? "pico" : "estavel"
      return { season: startSeason + index, age, overall, status }
    }),
  }))
}

export async function projectSquadNative(players: ProjectionInput[], startSeason: number): Promise<{ projections: PlayerProjection[]; engine: "rust" | "typescript" }> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      const projections = await invoke<PlayerProjection[]>("project_squad", { players, startSeason, years: 5 })
      return { projections, engine: "rust" }
    } catch { /* O navegador e builds antigos continuam funcionais durante a migracao. */ }
  }
  return { projections: projectSquad(players, startSeason), engine: "typescript" }
}

export function medicalRisk(player: Player, chronicFatigue = 0): { score: number; label: "baixo" | "moderado" | "alto" | "critico" } {
  if (player.injury) return { score: 100, label: "critico" }
  const ageRisk = Math.max(0, player.age - 28) * 2
  const loadRisk = Math.max(0, 75 - player.energy) * 0.75
  const formRisk = Math.max(0, 55 - player.form) * 0.2
  const score = Math.round(Math.min(99, ageRisk + loadRisk + chronicFatigue * 0.55 + formRisk))
  return { score, label: score >= 70 ? "critico" : score >= 45 ? "alto" : score >= 22 ? "moderado" : "baixo" }
}

/** Traduz a decisão do departamento médico para elegibilidade e condição de
 * partida. Afastamento remove o atleta; limite e treino sem contato reduzem a
 * energia disponível sem alterar definitivamente o save. */
export function applyMedicalRestrictionsForMatch(
  players: readonly Player[],
  restrictions: PerformanceCenterState["medicalRestrictions"],
): Player[] {
  return players
    .filter(player => restrictions[player.id] !== "afastado")
    .map(player => {
      const restriction = restrictions[player.id]
      if (restriction === "minutos") return { ...player, energy: Math.min(player.energy, 68) }
      if (restriction === "sem-contato") return { ...player, energy: Math.min(player.energy, 84) }
      return player
    })
}

export function mergePhaseTactic(current: TeamTactics, plan: PhaseTactic): TeamTactics {
  const { formation: _inShape, ...inPossession } = plan.inPossession
  const { formation: _outShape, ...outOfPossession } = plan.outOfPossession
  return {
    ...current,
    ...inPossession,
    ...outOfPossession,
    ...plan.transition,
    inPossessionFormation: plan.inPossession.formation,
    outOfPossessionFormation: plan.outOfPossession.formation,
  }
}

export interface DataHubMatch {
  scored: number
  conceded: number
  home: boolean
  xG?: number
  xGA?: number
  shots?: number
  shotsAgainst?: number
  shotsOnTarget?: number
  possession?: number
  passAccuracy?: number
}

export interface DataHubSummary {
  played: number
  wins: number
  draws: number
  losses: number
  pointsPerGame: number
  goalsForPerGame: number
  goalsAgainstPerGame: number
  xGPerGame: number | null
  xGAgainstPerGame: number | null
  xGDPerGame: number | null
  shotConversion: number | null
  shotAccuracy: number | null
  averagePossession: number | null
  averagePassAccuracy: number | null
  cleanSheetRate: number
  homePPG: number | null
  awayPPG: number | null
  form: ("W" | "D" | "L")[]
  sampleWithAdvancedData: number
}

const average = (values: number[]): number | null => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null

/** Métricas derivadas somente de súmulas persistidas. Nenhum valor avançado é
 * inventado quando um save antigo não possui xG ou finalizações. */
export function buildDataHub(matches: readonly DataHubMatch[]): DataHubSummary {
  let wins = 0, draws = 0
  const points = (match: DataHubMatch) => match.scored > match.conceded ? 3 : match.scored === match.conceded ? 1 : 0
  for (const match of matches) {
    if (match.scored > match.conceded) wins++
    else if (match.scored === match.conceded) draws++
  }
  const advanced = matches.filter(match => match.xG != null && match.xGA != null)
  const shots = matches.reduce((sum, match) => sum + (match.shots ?? 0), 0)
  const shotsOnTarget = matches.reduce((sum, match) => sum + (match.shotsOnTarget ?? 0), 0)
  const goals = matches.reduce((sum, match) => sum + match.scored, 0)
  const ppg = (slice: readonly DataHubMatch[]) => slice.length
    ? slice.reduce((sum, match) => sum + points(match), 0) / slice.length
    : null
  const played = matches.length
  const xG = average(advanced.map(match => match.xG!))
  const xGA = average(advanced.map(match => match.xGA!))
  return {
    played,
    wins,
    draws,
    losses: played - wins - draws,
    pointsPerGame: ppg(matches) ?? 0,
    goalsForPerGame: played ? goals / played : 0,
    goalsAgainstPerGame: played ? matches.reduce((sum, match) => sum + match.conceded, 0) / played : 0,
    xGPerGame: xG,
    xGAgainstPerGame: xGA,
    xGDPerGame: xG != null && xGA != null ? xG - xGA : null,
    shotConversion: shots ? goals / shots * 100 : null,
    shotAccuracy: shots ? shotsOnTarget / shots * 100 : null,
    averagePossession: average(matches.flatMap(match => match.possession == null ? [] : [match.possession])),
    averagePassAccuracy: average(matches.flatMap(match => match.passAccuracy == null ? [] : [match.passAccuracy])),
    cleanSheetRate: played ? matches.filter(match => match.conceded === 0).length / played * 100 : 0,
    homePPG: ppg(matches.filter(match => match.home)),
    awayPPG: ppg(matches.filter(match => !match.home)),
    form: matches.slice(-5).map(match => points(match) === 3 ? "W" : points(match) === 1 ? "D" : "L"),
    sampleWithAdvancedData: advanced.length,
  }
}

export function performanceStorageKey(teamShort: string, season: number) {
  return `ultrafoot:performance-center:v1:${teamShort}:${season}`
}
