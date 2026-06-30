// PHASE 39 — Notícias dinâmicas
// Status: skeleton — gera notícias automáticas: contratação, venda, lesão, crise,
// título, clássico, técnico pressionado. Alimenta a tela de mensagens e dashboard.

import type { GameState } from "@/lib/save-system"
import type { CareerMessage } from "@/lib/career-types"

export type NewsCategory =
  | "transfer"
  | "injury"
  | "crisis"
  | "title"
  | "clasico"
  | "coach_pressure"
  | "youth_breakthrough"
  | "scandal"
  | "press_speculation"
  | "stadium"
  | "sponsor"

export interface NewsItem {
  id: string
  category: NewsCategory
  headline: string
  body: string
  publishedAt: number              // week
  season: number
  involvedClubs: string[]          // curtos
  involvedPlayers: string[]        // ids
  importance: "low" | "medium" | "high" | "breaking"
  imageKey?: string
}

/** Detecta gatilhos no GameState e gera notícias. */
export function generateNews(_state: GameState, _week: number): NewsItem[] {
  throw new Error("news-engine.generateNews: not implemented")
}

/** Converte NewsItem em CareerMessage pra caixa de entrada. */
export function toCareerMessage(_news: NewsItem): CareerMessage {
  throw new Error("news-engine.toCareerMessage: not implemented")
}

/** Lista notícias da semana ordenadas por importância. */
export function listForWeek(_news: NewsItem[], _week: number, _season: number): NewsItem[] {
  return _news
    .filter(n => n.season === _season && n.publishedAt === _week)
    .sort((a, b) => {
      const order = { breaking: 0, high: 1, medium: 2, low: 3 } as const
      return order[a.importance] - order[b.importance]
    })
}
