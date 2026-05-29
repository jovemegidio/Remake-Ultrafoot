// Sistema de save offline (localStorage). Brasfoot-like: tudo persiste localmente.

"use client"

import { useEffect, useState } from "react"
import { allTeams, getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import type { NationalCompetitionState } from "@/lib/national-competitions"

const STORAGE_KEY = "ultrafoot:save"
const VERSION = 4

// ============================================
// ARVORE DE HABILIDADES DO TREINADOR
// ============================================

export type CoachSkillId =
  | "fechamento_casinha"     // Resiliencia defensiva nos ultimos 10 min
  | "motivacao_vestiario"    // Discurso pre-jogo da uma moral extra
  | "gestao_crise"           // Reduz impacto de eventos negativos
  | "olho_clinico"           // Descobre atributos ocultos dos jogadores mais rapido
  | "fidelizador"            // Jogadores felizes renovam por salarios menores
  | "mestre_tatico"          // Mudancas de formacao em jogo tem mais efeito
  | "identificacao_talentos" // Base gera jovens com maior potencial
  | "negociador_nato"        // Negocia transferencias com desconto de 10%
  | "psicologia_aplicada"    // Traumas curam 50% mais rapido
  | "lideranca_carismo"      // Capitaes tem 50% mais influencia no vestiario

export interface CoachSkill {
  id: CoachSkillId
  name: string
  description: string
  effect: string // descricao do efeito em jogo
  xpCost: number // XP necessario para desbloquear
  unlocked: boolean
  unlockedSeason: number | null
  // Evento que desbloqueia (Just-in-Time)
  unlockTrigger: {
    type: "crisis_resolved" | "win_streak" | "title_won" | "youth_breakout" | "manual"
    threshold: number
    description: string
  }
}

export const COACH_SKILL_CATALOG: CoachSkill[] = [
  {
    id: "fechamento_casinha", name: "Fechamento de Casinha",
    description: "Seu time fica mais resistente nos minutos finais.",
    effect: "+8% rendimento defensivo nos últimos 10 min.",
    xpCost: 100,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "crisis_resolved", threshold: 3, description: "Supere 3 viradas sofridas" }
  },
  {
    id: "motivacao_vestiario", name: "Motivação no Vestiário",
    description: "Discurso pré-jogo eleva o nível de entrega.",
    effect: "+5% moral do elenco antes de cada partida.",
    xpCost: 80,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "win_streak", threshold: 5, description: "Vença 5 jogos seguidos" }
  },
  {
    id: "gestao_crise", name: "Gestão de Crise",
    description: "Você mantém o barco estável em momentos difíceis.",
    effect: "Eventos negativos causam 30% menos impacto na moral.",
    xpCost: 150,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "crisis_resolved", threshold: 5, description: "Supere 5 eventos de crise sem demissão" }
  },
  {
    id: "olho_clinico", name: "Olho Clínico",
    description: "Você enxerga potencial onde outros não veem.",
    effect: "Atributos de jogadores descobertos são revelados 50% mais rápido.",
    xpCost: 120,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "youth_breakout", threshold: 2, description: "Revele 2 jovens com potencial >= 85" }
  },
  {
    id: "fidelizador", name: "Fidelizador",
    description: "Jogadores contentes não querem sair.",
    effect: "Renovações de contrato custam 15% menos quando moral está alta.",
    xpCost: 100,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "win_streak", threshold: 3, description: "Mantenha moral acima de 80 por 10 semanas" }
  },
  {
    id: "mestre_tatico", name: "Mestre Tático",
    description: "Suas mudanças táticas no intervalo fazem diferença real.",
    effect: "+10% eficácia das substituições e ajustes de formação.",
    xpCost: 180,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "manual", threshold: 0, description: "Ganhe 20 pontos acima da expectativa em uma temporada" }
  },
  {
    id: "identificacao_talentos", name: "Identificação de Talentos",
    description: "A base produz jogadores acima da média.",
    effect: "+5 overall e +8 potencial em jovens gerados pela categoria de base.",
    xpCost: 160,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "youth_breakout", threshold: 5, description: "Revele 5 jovens com potencial >= 82" }
  },
  {
    id: "negociador_nato", name: "Negociador Nato",
    description: "Você sempre fecha o melhor negócio.",
    effect: "-10% em taxas de transferência e comissões de agentes.",
    xpCost: 140,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "manual", threshold: 0, description: "Complete 10 transferências em uma temporada" }
  },
  {
    id: "psicologia_aplicada", name: "Psicologia Aplicada",
    description: "Você entende o lado humano dos atletas.",
    effect: "Traumas e crises de confiança curam 50% mais rápido.",
    xpCost: 130,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "crisis_resolved", threshold: 8, description: "Cure 8 status effects negativos de jogadores" }
  },
  {
    id: "lideranca_carismo", name: "Liderança e Carisma",
    description: "Sua presença inspira os líderes do vestiário.",
    effect: "Capitães têm 50% mais influência sobre companheiros.",
    xpCost: 200,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "title_won", threshold: 1, description: "Conquiste um título" }
  },
]

// ============================================
// LEGADO ENTRE CARREIRAS (ROGUELIKE)
// ============================================

export interface CareerRecord {
  teamShort: string
  teamName: string
  seasons: number
  titles: string[]
  bestPosition: number
  youthAcademyLevelLeft: number // nivel que o clube ficou quando saiu
  startedSeason: number
  endedSeason: number
  endReason: "demitido" | "aposentado" | "novo_desafio"
}

export interface CoachLegacy {
  totalSeasons: number
  totalTitles: number
  careerRecords: CareerRecord[]
  // Bonus que persistem entre carreiras
  legacySkills: CoachSkillId[] // skills desbloqueadas em carreiras anteriores
  reputationLevel: number // 0-5 — desbloqueia times maiores
  legacyXP: number
}

// ============================================
// CONFIGURACAO DE CONFIGURACOES
// ============================================

// Configuracao de um tecnico/jogador
export interface ManagerProfile {
  id: string
  name: string
  teamShort: string
  color: string // Cor de identificacao do jogador
  controllerIndex: number // -1 = teclado, 0-3 = controles
}

// ============================================
// SELECAO NACIONAL
// ============================================

export interface NationalOffer {
  nationalTeamId: string
  nationalTeamName: string
  code: string
  confederation: string
  strength: number
  createdSeason: number
}

export interface NationalTitle {
  competition: string
  season: number
}

// Janela FIFA ativa: quando o jogo desvia para a Selecao durante o calendario
// do clube. Rastreia quantos jogos faltam disputar antes de voltar ao clube.
export interface NationalWindow {
  season: number
  month: number
  competitionId: string
  /** Jogos do usuario ja disputados na competicao quando a janela comecou. */
  gamesAtStart: number
  /** Quantos jogos disputar nesta janela (alto = torneio em bloco unico). */
  gamesTarget: number
  isFinalTournament: boolean
  label: string
}

export interface NationalCareer {
  nationalTeamId: string | null
  nationalTeamName: string | null
  acceptedSeason: number | null
  titles: NationalTitle[]
  worldCupQualifications: number
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  currentCompetition: NationalCompetitionState | null
  completedThisSeason: string[]
  /** Janelas FIFA ja cumpridas (chave temporada-mes), para nao repetir. */
  completedWindows: string[]
  /** Janela FIFA em andamento (null fora de uma janela). */
  activeWindow: NationalWindow | null
}

export const DEFAULT_NATIONAL_CAREER: NationalCareer = {
  nationalTeamId: null,
  nationalTeamName: null,
  acceptedSeason: null,
  titles: [],
  worldCupQualifications: 0,
  matchesPlayed: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  currentCompetition: null,
  completedThisSeason: [],
}

export interface GameState {
  version: number
  selectedTeamShort: string | null
  managerName: string
  season: number
  week: number
  language: string
  selectedUniform: "home" | "away" | "third"
  createdAt: number
  updatedAt: number
  // Multiplayer
  multiplayerEnabled: boolean
  managers: ManagerProfile[]
  activeManagerId: string | null
  // Configuracoes de controle
  controllerType: "xbox" | "playstation"
  controllerBindings: Record<string, Record<string, string>> // context -> button -> action
  // Arvore de habilidades do treinador (Just-in-Time)
  coachSkills: CoachSkill[]
  coachXP: number
  coachCrisisCount: number   // quantas crises resolvidas (gatilho de habilidades)
  coachWinStreak: number     // sequencia atual de vitorias
  coachTotalTitles: number
  // Legado entre carreiras (Roguelike)
  coachLegacy: CoachLegacy
  // Selecao nacional
  nationalCareer: NationalCareer
  pendingNationalOffers: NationalOffer[]
  declinedNationalTeamIds: string[]
  lastNationalOfferSeason: number | null
}

export const DEFAULT_COACH_LEGACY: CoachLegacy = {
  totalSeasons: 0,
  totalTitles: 0,
  careerRecords: [],
  legacySkills: [],
  reputationLevel: 0,
  legacyXP: 0,
}

export const DEFAULT_STATE: GameState = {
  version: VERSION,
  selectedTeamShort: null,
  managerName: "Tecnico",
  season: 2026,
  week: 0,
  language: "pt-BR",
  selectedUniform: "home",
  createdAt: 0,
  updatedAt: 0,
  // Multiplayer
  multiplayerEnabled: false,
  managers: [],
  activeManagerId: null,
  // Controles
  controllerType: "playstation",
  controllerBindings: {},
  // Treinador
  coachSkills: COACH_SKILL_CATALOG.map(s => ({ ...s })),
  coachXP: 0,
  coachCrisisCount: 0,
  coachWinStreak: 0,
  coachTotalTitles: 0,
  // Legado
  coachLegacy: DEFAULT_COACH_LEGACY,
  // Selecao nacional
  nationalCareer: DEFAULT_NATIONAL_CAREER,
  pendingNationalOffers: [],
  declinedNationalTeamIds: [],
  lastNationalOfferSeason: null,
}

function safeParse(raw: string | null): GameState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GameState
    // Migra version 2 para a atual (adiciona campos de treinador e legado)
    if (parsed.version === 2) {
      return {
        ...DEFAULT_STATE,
        ...parsed,
        version: VERSION,
        coachSkills: DEFAULT_STATE.coachSkills,
        coachXP: 0,
        coachCrisisCount: 0,
        coachWinStreak: 0,
        coachTotalTitles: 0,
        coachLegacy: DEFAULT_COACH_LEGACY,
        nationalCareer: DEFAULT_NATIONAL_CAREER,
        pendingNationalOffers: [],
        declinedNationalTeamIds: [],
        lastNationalOfferSeason: null,
      }
    }
    // Migra version 3 para a atual (adiciona campos de selecao nacional)
    if (parsed.version === 3) {
      return {
        ...DEFAULT_STATE,
        ...parsed,
        version: VERSION,
        nationalCareer: DEFAULT_NATIONAL_CAREER,
        pendingNationalOffers: [],
        declinedNationalTeamIds: [],
        lastNationalOfferSeason: null,
      }
    }
    if (parsed.version !== VERSION) return null
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return null
  }
}

export function loadGameState(): GameState {
  if (typeof window === "undefined") return DEFAULT_STATE
  return safeParse(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_STATE
}

export function saveGameState(state: GameState): void {
  if (typeof window === "undefined") return
  const next = { ...state, version: VERSION, updatedAt: Date.now() }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
}

export function clearGameState(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
}

export function clearAllGameData(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem("ultrafoot-game-engine")
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
}

export function hasSave(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) !== null
}

/**
 * React hook: state do jogo + sincronia com outras abas.
 * SSR-safe (retorna DEFAULT_STATE no servidor, hidrata no client).
 */
export function useGameState(): {
  state: GameState
  hydrated: boolean
  setState: (next: Partial<GameState>) => void
  reset: () => void
} {
  const [state, setStateInternal] = useState<GameState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Carrega estado inicial de forma sincrona
    const saved = loadGameState()
    setStateInternal(saved)
    setHydrated(true)
  }, [])

  useEffect(() => {
    // Listener separado para sincronizar entre abas
    if (!hydrated) return
    
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== STORAGE_KEY) return
      // Usa setTimeout para evitar setState durante render
      setTimeout(() => {
        setStateInternal(loadGameState())
      }, 0)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [hydrated])

  const setState = (next: Partial<GameState>) => {
    setStateInternal(prev => {
      const merged = { ...prev, ...next }
      // Salva de forma assincrona para nao bloquear
      queueMicrotask(() => saveGameState(merged))
      return merged
    })
  }

  const reset = () => {
    clearGameState()
    setStateInternal(DEFAULT_STATE)
  }

  return { state, hydrated, setState, reset }
}

/**
 * Time atual escolhido pelo usuario. Cai num default razoavel ate o save existir
 * (evita hydration mismatch ao retornar sempre o mesmo valor no SSR).
 */
const FALLBACK_TEAM: Team =
  serieATeams[0] ?? allTeams[0]

export function useUserTeam(): { team: Team; hydrated: boolean } {
  const { state, hydrated } = useGameState()
  const team = state.selectedTeamShort
    ? getTeamByShort(state.selectedTeamShort) ?? FALLBACK_TEAM
    : FALLBACK_TEAM
  return { team, hydrated }
}

export function selectTeam(shortName: string, managerName?: string): void {
  const current = loadGameState()
  saveGameState({
    ...current,
    selectedTeamShort: shortName,
    managerName: managerName?.trim() || current.managerName || "Tecnico",
    season: current.season || 2026,
    week: 0,
    createdAt: current.createdAt || Date.now(),
  })
}
