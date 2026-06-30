// PHASE 3 — Modo Desafios
// Status: skeleton — define a API. Cenários: salvar do rebaixamento, subir divisão,
// estadual pequeno, sub-23, copa sem contratar, classificar continental,
// reconstruir gigante, reduzir folha salarial.

import type { GameState } from "@/lib/save-system"

export type ChallengeId =
  | "save_relegation"
  | "promote_division"
  | "small_state"
  | "u23_only"
  | "cup_no_signings"
  | "qualify_continental"
  | "rebuild_giant"
  | "cut_payroll"

export type ChallengeDifficulty = "facil" | "medio" | "dificil" | "lendario"

export interface ChallengeGoal {
  id: string
  description: string
  metric: "league_position" | "title" | "promotion" | "stay_above" | "qualify_continental" | "max_payroll" | "no_signings" | "u23_starts"
  target: number | string
  currentValue?: number | string
  completed: boolean
}

export interface ChallengeConfig {
  id: ChallengeId
  nome: string
  descricao: string
  difficulty: ChallengeDifficulty
  startTeamCurto?: string         // sugestão de time
  durationSeasons: number         // 1, 3, 5
  goals: ChallengeGoal[]
  reward: { prestigio: number; saldo: number; achievementId?: string }
}

export interface ChallengeProgress {
  challengeId: ChallengeId
  startedAt: number
  startSeason: number
  currentSeason: number
  goals: ChallengeGoal[]
  failed: boolean
  completed: boolean
}

export const CHALLENGES: ChallengeConfig[] = [
  // TODO: popular com 8 desafios definidos no prompt
]

/** Inicia desafio: aplica setup específico no GameState (orçamento, elenco, etc). */
export function startChallenge(_id: ChallengeId, _state: GameState): GameState {
  throw new Error("challenge-engine.startChallenge: not implemented")
}

/** Avalia progresso do desafio após cada rodada/temporada. */
export function evaluateChallenge(_progress: ChallengeProgress, _state: GameState): ChallengeProgress {
  throw new Error("challenge-engine.evaluateChallenge: not implemented")
}

/** Aplica recompensa quando completado. */
export function claimReward(_progress: ChallengeProgress, _state: GameState): GameState {
  throw new Error("challenge-engine.claimReward: not implemented")
}
