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
  {id:"first_title",category:"title",name:"Primeiro troféu",description:"Conquiste um título.",hidden:false,rarity:"raro",iconKey:"trophy",pointsValue:50},
  {id:"promotion",category:"promotion",name:"Rumo à elite",description:"Conquiste um acesso.",hidden:false,rarity:"raro",iconKey:"arrow-up",pointsValue:40},
  {id:"unbeaten_10",category:"unbeaten",name:"Invencível",description:"Fique 10 jogos sem perder.",hidden:false,rarity:"epico",iconKey:"shield",pointsValue:75},
  {id:"big_sale",category:"big_sale",name:"Venda histórica",description:"Venda um atleta por pelo menos 50 milhões.",hidden:false,rarity:"epico",iconKey:"coins",pointsValue:75},
  {id:"clasico_win",category:"clasico_win",name:"Dono do clássico",description:"Vença um rival histórico.",hidden:false,rarity:"comum",iconKey:"flame",pointsValue:25},
]

/** Verifica conquistas a partir de evento (resultado, fim de temporada, transferência, etc). */
export function checkAchievements(
  eventType: string,
  eventPayload: Record<string, unknown>,
  alreadyUnlocked: PlayerAchievement[],
): Achievement[] {
  const ids = new Set(alreadyUnlocked.map(a=>a.achievementId)), result:string[] = []
  if (eventType === "season_end" && eventPayload.champion === true) result.push("first_title")
  if (eventType === "season_end" && eventPayload.promoted === true) result.push("promotion")
  if (eventType === "match" && Number(eventPayload.unbeatenStreak ?? 0) >= 10) result.push("unbeaten_10")
  if (eventType === "transfer" && Number(eventPayload.value ?? 0) >= 50_000_000) result.push("big_sale")
  if (eventType === "match" && eventPayload.isClasico === true && eventPayload.won === true) result.push("clasico_win")
  return ACHIEVEMENTS.filter(a=>result.includes(a.id) && !ids.has(a.id))
}

/** Desbloqueia conquista. */
export function unlock(achievementId: string, season: number): PlayerAchievement {
  if (!ACHIEVEMENTS.some(a=>a.id === achievementId)) throw new Error(`Conquista desconhecida: ${achievementId}`)
  return { achievementId, season, unlockedAt:Date.now() }
}
