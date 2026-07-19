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
export function generateNews(state: GameState, week: number): NewsItem[] {
  const club=state.selectedTeamShort??"CLUBE",items:NewsItem[]=[]
  for(const t of (state.transfers??[]).filter(t=>t.week===week&&t.season===state.season))items.push({id:`news-${t.id}`,category:"transfer",headline:`${t.playerName} muda de clube`,body:`${t.fromTeam} e ${t.toTeam} fecharam a negociação por ${t.value.toLocaleString("pt-BR")}.`,publishedAt:week,season:state.season,involvedClubs:[t.fromTeam,t.toTeam],involvedPlayers:[t.playerName],importance:t.value>=50000000?"breaking":"medium"})
  if((state.teamMorale??65)<35)items.push({id:`news-${state.season}-${week}-crisis`,category:"crisis",headline:`Crise no vestiário do ${club}`,body:"A sequência recente aumentou a pressão sobre o elenco e a comissão.",publishedAt:week,season:state.season,involvedClubs:[club],involvedPlayers:[],importance:"high"})
  return items
}

/** Converte NewsItem em CareerMessage pra caixa de entrada. */
export function toCareerMessage(news: NewsItem): CareerMessage {
  return{id:`message-${news.id}`,from:"Central de Notícias",subject:news.headline,preview:news.body.slice(0,120),fullContent:news.body,date:`Temporada ${news.season}, semana ${news.publishedAt}`,read:false,starred:news.importance==="breaking",archived:false,deleted:false,category:news.category==="transfer"?"mercado":news.category==="title"?"competicao":"staff",week:news.publishedAt,season:news.season}
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
