// PHASE 15 — Pós-jogo
// Status: skeleton — melhores momentos, estatísticas (xG, posse, notas),
// impacto moral/tabela, coletiva, notícias.

import type { MatchEvent, MatchState } from "@/lib/match-engine"
import type { MatchResult } from "@/lib/career-types"

export interface MatchStats {
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
  homePossession: number           // 0..100
  awayPossession: number
  homeXG: number
  awayXG: number
  homeCorners: number
  awayCorners: number
  homeFouls: number
  awayFouls: number
  homeYellowCards: number
  awayYellowCards: number
  homeRedCards: number
  awayRedCards: number
}

export interface PlayerRating {
  playerId: string
  playerName: string
  position: string
  rating: number                   // 0..10
  goals: number
  assists: number
  highlights: string[]
}

export interface MatchHighlight {
  minute: number
  type: "goal" | "save" | "miss" | "card" | "decisive"
  description: string
  eventId: string
}

export interface PressConferencePrompt {
  id: string
  question: string
  options: { text: string; impact: { moral: number; press: number; fans: number } }[]
}

/** Calcula estatísticas finais a partir do MatchState. */
export function calcStats(state: MatchState): MatchStats {
  return{homeShots:state.home.shots,awayShots:state.away.shots,homeShotsOnTarget:state.home.shotsOnTarget,awayShotsOnTarget:state.away.shotsOnTarget,homePossession:state.home.possession,awayPossession:state.away.possession,homeXG:state.home.xG,awayXG:state.away.xG,homeCorners:state.home.corners,awayCorners:state.away.corners,homeFouls:state.home.fouls,awayFouls:state.away.fouls,homeYellowCards:state.home.yellows,awayYellowCards:state.away.yellows,homeRedCards:state.home.reds,awayRedCards:state.away.reds}
}

/** Atribui notas (0..10) por jogador baseado em eventos. */
export function calcPlayerRatings(state: MatchState): PlayerRating[] {
  const players=new Map<string,PlayerRating>();for(const e of state.events){if(!e.player)continue;const p=players.get(e.player)??{playerId:e.player.toLowerCase().replace(/\W+/g,"-"),playerName:e.player,position:"",rating:6.5,goals:0,assists:0,highlights:[]};if(e.type==="goal"){p.goals++;p.rating+=1.2;p.highlights.push(e.text)}else if(e.type==="save"){p.rating+=.35;p.highlights.push(e.text)}else if(e.type==="red_card")p.rating-=1.5;else if(e.type==="yellow_card")p.rating-=.25;players.set(e.player,p)}return[...players.values()].map(p=>({...p,rating:Math.max(1,Math.min(10,Math.round(p.rating*10)/10))})).toSorted((a,b)=>b.rating-a.rating)
}

/** Extrai melhores momentos pro replay. */
export function extractHighlights(events: MatchEvent[]): MatchHighlight[] {
  return events.filter(e=>e.important||["goal","save","miss","red_card","penalty"].includes(e.type)).map(e=>({minute:e.minute,type:e.type==="goal"?"goal":e.type==="save"?"save":e.type==="miss"?"miss":e.type.includes("card")?"card":"decisive",description:e.text,eventId:e.id}))
}

/** Gera prompts pra coletiva pós-jogo. */
export function generatePressConference(result: MatchResult): PressConferencePrompt[] {
  const draw=result.homeGoals===result.awayGoals,homeWon=result.homeGoals>result.awayGoals;return[{id:`result-${result.id}`,question:draw?"O empate foi um resultado justo?":`Qual foi o fator decisivo para a vitória do ${homeWon?result.homeNome:result.awayNome}?`,options:[{text:"O coletivo fez a diferença.",impact:{moral:3,press:2,fans:2}},{text:"Ainda temos muito a melhorar.",impact:{moral:-1,press:3,fans:0}},{text:"Prefiro analisar com calma.",impact:{moral:0,press:-2,fans:-1}}]}]
}
