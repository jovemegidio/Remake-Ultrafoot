// PHASE 14 — Narração textual estilo rádio
// Status: skeleton — gera linhas de comentário a partir de eventos do match-engine.
// Compatível com múltiplos narradores via packs (ver pack-engine).

import type { MatchEvent } from "@/lib/match-engine"

export type CommentaryEventType =
  | "kickoff"
  | "goal"
  | "shot_on_target"
  | "shot_off_target"
  | "save"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "corner"
  | "foul"
  | "free_kick"
  | "penalty"
  | "offside"
  | "pressure"
  | "counter_attack"
  | "halftime"
  | "fulltime"
  | "derby_intro"

export type CommentaryIntensity = "calm" | "excited" | "explosive"

export interface CommentaryLine {
  id: string
  text: string
  intensity: CommentaryIntensity
  audioKey?: string                // chave do clipe de áudio (audio-commentary)
  durationMs?: number              // estimado
}

export interface CommentaryPack {
  id: string
  name: string
  language: string                 // "pt-br"
  variant: string                  // "default", "fanatico", "academico", etc
  templates: Record<CommentaryEventType, string[]> // texto com placeholders {player}, {team}, {score}
  audioBasePath?: string           // /audio/commentary/pt-br/<variant>/
}

/** Renderiza um evento de partida em linha de comentário. */
export function renderEvent(event: MatchEvent, pack: CommentaryPack): CommentaryLine {
  const type=(event.type==="shot"||event.type==="miss"?"shot_off_target":event.type==="sub"?"substitution":event.type) as CommentaryEventType
  const templates=pack.templates[type]??[event.text||"A partida continua."];const text=templates[Math.abs(event.minute)%templates.length].replaceAll("{player}",event.player??"o jogador").replaceAll("{team}",event.side==="home"?"mandante":"visitante")
  const explosive=type==="goal"||type==="red_card"||type==="penalty";return{id:`comment-${event.id}`,text:`${event.minute}' ${text}`,intensity:explosive?"explosive":event.important?"excited":"calm",audioKey:`${pack.variant}/${type}`,durationMs:Math.max(1800,text.length*55)}
}

/** Pack default em pt-BR. */
export const DEFAULT_PACK: CommentaryPack = {
  id: "default-pt-br",
  name: "Narração padrão",
  language: "pt-br",
  variant: "default",
  templates: {kickoff:["Bola rolando!"],goal:["GOOOL! {player} balança a rede!"],shot_on_target:["Finalização perigosa de {player}."],shot_off_target:["{player} manda para fora."],save:["Grande defesa do goleiro!"],yellow_card:["Cartão amarelo para {player}."],red_card:["Expulso! Vermelho para {player}."],substitution:["Mudança no {team}."],corner:["Escanteio para o {team}."],foul:["Falta marcada pelo árbitro."],free_kick:["Boa chance em cobrança de falta."],penalty:["Pênalti marcado!","O árbitro aponta para a marca da cal!","Infração dentro da área: é pênalti!","A torcida prende a respiração: penalidade máxima!","Decisão confirmada, o {team} terá a cobrança!"],offside:["Impedimento assinalado."],pressure:["O {team} aumenta a pressão."],counter_attack:["Contra-ataque veloz!"],halftime:["Fim do primeiro tempo."],fulltime:["Fim de jogo."],derby_intro:["Clássico de grande rivalidade hoje!"]},
}

/** Carrega pack de narração (custom ou default). */
export function loadPack(packId: string): CommentaryPack {
  if(packId===DEFAULT_PACK.id||packId==="default")return structuredClone(DEFAULT_PACK)
  return {...structuredClone(DEFAULT_PACK),id:packId,name:`Narração ${packId}`,variant:packId}
}
