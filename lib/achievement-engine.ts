// PHASE 30 — Conquistas
// Status: skeleton — títulos, acessos, invencibilidade, revelação jovem,
// venda milionária, clássico ganho.

export type AchievementCategory =
  | "title"
  | "promotion"
  | "unbeaten"
  | "youth_breakthrough"
  | "big_sale"
  | "clasico_win"
  | "career_milestone"
  | "challenge_complete"

export interface Achievement {
  id: string
  category: AchievementCategory
  name: string
  description: string
  hidden: boolean                  // só desbloqueia ao completar
  rarity: "comum" | "raro" | "epico" | "lendario"
  iconKey: string
  pointsValue: number
}

export interface PlayerAchievement {
  achievementId: string
  unlockedAt: number               // timestamp
  season: number
  context?: Record<string, unknown>
}

export const ACHIEVEMENTS: Achievement[] = [
  // TODO: catálogo completo
]

/** Verifica conquistas a partir de evento (resultado, fim de temporada, transferência, etc). */
export function checkAchievements(
  _eventType: string,
  _eventPayload: Record<string, unknown>,
  _alreadyUnlocked: PlayerAchievement[],
): Achievement[] {
  throw new Error("achievement-engine.checkAchievements: not implemented")
}

/** Desbloqueia conquista. */
export function unlock(_achievementId: string, _season: number): PlayerAchievement {
  throw new Error("achievement-engine.unlock: not implemented")
}
