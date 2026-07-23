"use client"

import Link from "next/link"
import { safeLocalSet } from "@/lib/safe-storage"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeft,
  Activity,
  Users,
  Goal,
  Target as TargetIcon,
  Flag,
  AlertTriangle,
  Sparkles,
  Zap,
  ArrowLeftRight,
  Timer,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  BarChart3,
  Heart,
  Star,
  Settings2,
  ArrowDownUp,
  Triangle,
  ChevronDown,
  ChevronUp,
  Square,
  Hand,
  Stethoscope,
  Circle,
} from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { loadGameState, saveGameStateAndFlush, useGameState, useUserTeam } from "@/lib/save-system"
import { calcularEfeitoColetiva } from "@/lib/press-effects"
import { useNotifications } from "@/components/notifications-system"
import { getPlayersForTeam, type Player } from "@/lib/players-data"
import { assignPlayersToFormation, pickStartingXI } from "@/lib/formations"
import { clearMatchContext, loadMatchContext } from "@/lib/match-context"
import { useMatchSimulation } from "@/hooks/use-match-simulation"
import { getActionForButton, type GameContext } from "@/lib/gamepad-controls"
import { useGamepad, type GamepadButtonName } from "@/hooks/use-gamepad"
import { useGameManager, getStateChampRounds } from "@/lib/use-game-manager"
import { outrosEstaduaisDaRodada } from "@/lib/parallel-rounds"
import { useDiscordRPC } from "@/hooks/use-discord-rpc"
import { useTranslation } from "@/lib/i18n"
import { persistGameEngineNow, useGameEngine, shootingForPosition, type Player as EnginePlayer } from "@/lib/game-engine"
import { flushPersistentStore } from "@/lib/persistent-store"
import { hardNavigate } from "@/lib/hard-navigation"
import {
  type MatchSpeed,
  type MatchEvent,
  type MatchState,
} from "@/lib/match-engine"
import { LivePitch } from "@/components/match/live-pitch"
import { SubstitutionModal, type MatchPlayer, type SubstitutionChange } from "@/components/match/substitution-modal"
import { MatchResultModal } from "@/components/match/match-result-modal"
import { RoundResultsModal } from "@/components/match/round-results-modal"
import { PostMatchPress } from "@/components/match/post-match-press"
import { EventAnimation, type AnimatableEvent } from "@/components/match/event-animations"
import { PenaltyTakerModal } from "@/components/match/penalty-taker-modal"
import { MatchRadar } from "@/components/match/match-radar"
import { getKitColors } from "@/components/match/kit-image"
import { useMatchSounds } from "@/hooks/use-match-sounds"
import { clearQueue as clearCommentary, enqueueEvent, initAudio } from "@/lib/audio-commentary"
import { applyPlayedYouthMatch } from "@/lib/youth-career-engine"

// ─────────────────────────────────────────────────────────────────────────────
// Mock players - usados como elenco padrao quando nao houver squad real
// ─────────────────────────────────────────────────────────────────────────────

const buildSquad = (offset = 0, prefix = ""): MatchPlayer[] => [
  { id: offset + 1, name: `${prefix}Silva`, number: 1, position: "GOL", rating: 78, stamina: 100, defending: 75, physical: 70, pace: 50, shooting: 25, passing: 60, dribbling: 35 },
  { id: offset + 2, name: `${prefix}Santos`, number: 2, position: "LD", rating: 74, stamina: 95, pace: 82, shooting: 55, passing: 70, dribbling: 72, defending: 74, physical: 70 },
  { id: offset + 3, name: `${prefix}Oliveira`, number: 3, position: "ZAG", rating: 77, stamina: 92, pace: 68, shooting: 45, passing: 60, dribbling: 55, defending: 80, physical: 82 },
  { id: offset + 4, name: `${prefix}Costa`, number: 4, position: "ZAG", rating: 76, stamina: 90, pace: 70, shooting: 42, passing: 58, dribbling: 52, defending: 78, physical: 80 },
  { id: offset + 5, name: `${prefix}Ferreira`, number: 6, position: "LE", rating: 73, stamina: 88, pace: 85, shooting: 58, passing: 72, dribbling: 75, defending: 70, physical: 68 },
  { id: offset + 6, name: `${prefix}Souza`, number: 5, position: "VOL", rating: 76, stamina: 82, pace: 72, shooting: 60, passing: 75, dribbling: 72, defending: 76, physical: 75 },
  { id: offset + 7, name: `${prefix}Almeida`, number: 8, position: "MEI", rating: 78, stamina: 78, pace: 75, shooting: 70, passing: 80, dribbling: 78, defending: 60, physical: 70 },
  { id: offset + 8, name: `${prefix}Rodrigues`, number: 10, position: "MEI", rating: 82, stamina: 75, pace: 80, shooting: 75, passing: 80, dribbling: 82, defending: 55, physical: 68 },
  { id: offset + 9, name: `${prefix}Lima`, number: 7, position: "PE", rating: 79, stamina: 76, pace: 88, shooting: 72, passing: 70, dribbling: 80, defending: 35, physical: 65 },
  { id: offset + 10, name: `${prefix}Pereira`, number: 9, position: "ATA", rating: 84, stamina: 72, pace: 85, shooting: 86, passing: 68, dribbling: 80, defending: 32, physical: 76 },
  { id: offset + 11, name: `${prefix}Martins`, number: 11, position: "PD", rating: 78, stamina: 78, pace: 90, shooting: 70, passing: 72, dribbling: 82, defending: 32, physical: 62 },
]

const buildBench = (offset = 100, prefix = ""): MatchPlayer[] => [
  { id: offset + 1, name: `${prefix}Gomes`, number: 12, position: "GOL", rating: 70, stamina: 100, defending: 70, physical: 68 },
  { id: offset + 2, name: `${prefix}Ribeiro`, number: 13, position: "ZAG", rating: 71, stamina: 100, pace: 65, shooting: 40, passing: 58, dribbling: 50, defending: 75, physical: 78 },
  { id: offset + 3, name: `${prefix}Araujo`, number: 14, position: "VOL", rating: 73, stamina: 100, pace: 70, shooting: 55, passing: 72, dribbling: 68, defending: 74, physical: 75 },
  { id: offset + 4, name: `${prefix}Barbosa`, number: 15, position: "MEI", rating: 74, stamina: 100, pace: 72, shooting: 68, passing: 76, dribbling: 75, defending: 50, physical: 65 },
  { id: offset + 5, name: `${prefix}Carvalho`, number: 16, position: "ATA", rating: 76, stamina: 100, pace: 82, shooting: 80, passing: 65, dribbling: 75, defending: 30, physical: 72 },
  { id: offset + 6, name: `${prefix}Tavares`, number: 17, position: "PD", rating: 72, stamina: 100, pace: 86, shooting: 65, passing: 68, dribbling: 78, defending: 30, physical: 62 },
  { id: offset + 7, name: `${prefix}Mendes`, number: 18, position: "MEI", rating: 71, stamina: 100, pace: 70, shooting: 65, passing: 72, dribbling: 70, defending: 55, physical: 65 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Converte jogadores reais para o formato MatchPlayer
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_NUMBER_MAP: Record<string, number> = {
  GOL: 1, ZAG: 3, LD: 2, LE: 6, VOL: 5, MEI: 8, ATA: 9, PE: 7, PD: 11,
}

// Hash determinístico por nome de jogador — elimina Math.random() nos atributos
function playerHash(name: string, seed: number): number {
  let h = seed
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Aloca números de camisa ÚNICOS por time: tenta o número real do jogador, senão o típico
// da posição, senão o próximo livre. Sem isto todo LD virava 2, todo ZAG 3, LE 6 — vários
// jogadores com o mesmo número na tela (foi o bug reportado na tela de pênalti).
function makeNumberAllocator() {
  const used = new Set<number>()
  return (prefer: number | undefined, pos: string): number => {
    for (const c of [prefer, POSITION_NUMBER_MAP[pos]]) {
      if (typeof c === "number" && c > 0 && !used.has(c)) { used.add(c); return c }
    }
    for (let n = 1; n <= 99; n++) { if (!used.has(n)) { used.add(n); return n } }
    return 0
  }
}

function playersToMatchSquad(players: Player[], idOffset = 0): { starters: MatchPlayer[]; bench: MatchPlayer[] } {
  // XI encaixado na formacao (garante defesa/meio/ATAQUE completos, nao corta o centroavante).
  const { starters: xi, bench: benchPool } = pickStartingXI(players, (p) => p.pos, (p) => p.base)
  const num = makeNumberAllocator()
  const starters: MatchPlayer[] = xi.map((p, i) => {
    const h = (seed: number) => playerHash(p.nome, seed)
    const isGK = p.pos === "GOL"
    const isAtt = ["ATA", "PE", "PD", "SA", "CA"].includes(p.pos)
    return {
      id: idOffset + i + 1,
      name: p.nome,
      number: num(undefined, p.pos),
      position: p.pos,
      rating: p.base,
      stamina: 100,
      // Atributos EDITADOS (editor de jogador) tem prioridade; senao sintetiza do overall.
      pace:      p.pace      ?? (isGK ? 50 : 65 + (h(1) % 25)),
      shooting:  p.shooting  ?? shootingForPosition(p.base, p.pos),
      passing:   p.passing   ?? (55 + (h(3) % 30)),
      dribbling: p.dribbling ?? (isGK ? 30 : 50 + (h(4) % 35)),
      defending: p.defending ?? (isAtt ? 30 + (h(5) % 20) : 60 + (h(6) % 25)),
      physical:  p.physical  ?? (60 + (h(7) % 25)),
    }
  })
  const bench: MatchPlayer[] = benchPool.map((p, i) => ({
    id: idOffset + 100 + i + 1,
    name: p.nome,
    number: num(undefined, p.pos),
    position: p.pos,
    rating: p.base,
    stamina: 100,
  }))
  return { starters, bench }
}

// Converte jogadores do game-engine para MatchPlayer
function enginePlayersToMatchSquad(
  players: EnginePlayer[],
  idOffset = 0,
  formation = "4-3-3",
  /** Posicoes que o tecnico arrastou no campinho, por NOME (como o motor guarda). */
  posicoesDoTecnico: Record<string, { x: number; y: number }> = {},
): { starters: MatchPlayer[]; bench: MatchPlayer[] } {
  // SUSPENSO nao entra em campo (realismo FM): fica fora ate cumprir a punicao.
  const available = players.filter(p => !p.injury && !p.calledUp && (p.suspendedMatches ?? 0) <= 0)

  // Se o usuario montou a escalacao (isStarter), RESPEITA o XI dele. Senao, encaixa na
  // formacao (defesa/meio/ataque completos) em vez de "os 11 primeiros por posicao".
  const manual = available.filter(p => p.isStarter === true)
  let xi: EnginePlayer[]
  let benchPool: EnginePlayer[]
  if (manual.length >= 11) {
    // A escalação manual é uma decisão do treinador, não um ranking de overall.
    // Ordenamos os MESMOS 11 pelos slots da formação, preservando o titular e a
    // posição que ele deve ocupar no campo/radar.
    const declared = manual.slice(0, 11)
    xi = assignPlayersToFormation(declared, formation).map(player => player as EnginePlayer)
    const xiIds = new Set(xi.map(player => player.id))
    benchPool = available.filter(player => !xiIds.has(player.id))
  } else {
    const picked = pickStartingXI(available, (p) => p.position, (p) => p.overall, formation)
    xi = picked.starters
    benchPool = picked.bench
  }

  const num = makeNumberAllocator()
  // assignPlayersToFormation ja aceitava posicoes customizadas, mas ninguem
  // passava: o motor guarda por NOME e a funcao espera por ID. Era por isso que
  // arrastar o jogador no campinho nao refletia na partida nem no radar.
  const porId: Record<number, { x: number; y: number }> = {}
  for (const p of xi) {
    const custom = posicoesDoTecnico[p.name]
    if (custom) porId[p.id] = custom
  }
  const slotted = assignPlayersToFormation(xi, formation, porId)
  const starters: MatchPlayer[] = slotted.map((p, i) => ({
    id: idOffset + i + 1,
    name: p.name,
    number: num(p.shirtNumber, p.position),
    position: p.position,
    rating: p.overall,
    stamina: p.energy,
    pace: p.pace,
    shooting: p.shooting,
    passing: p.passing,
    dribbling: p.dribbling,
    defending: p.defending,
    physical: p.physical,
    tacticalSlot: i,
    formationPosition: p.slotPos,
    fieldX: p.x,
    fieldY: p.y,
  }))

  const bench: MatchPlayer[] = benchPool.map((p, i) => ({
    id: idOffset + 100 + i + 1,
    name: p.name,
    number: num(p.shirtNumber, p.position),
    position: p.position,
    rating: p.overall,
    stamina: p.energy,
    pace: p.pace,
    shooting: p.shooting,
    passing: p.passing,
    dribbling: p.dribbling,
    defending: p.defending,
    physical: p.physical,
  }))

  return { starters, bench }
}

// ─────────────────────────────────────────────────────────────────────────────
// Velocidades de simulacao
// ─────────────────────────────────────────────────────────────────────────────

const SPEEDS: { id: MatchSpeed; label: string; sublabel: string }[] = [
  { id: "slow", label: "0.5x", sublabel: "Lento" },
  { id: "normal", label: "1x", sublabel: "Normal" },
  { id: "fast", label: "2x", sublabel: "Rapido" },
  { id: "ultra", label: "5x", sublabel: "Ultra" },
  { id: "hyper", label: "10x", sublabel: "Hyper" },
]

// ─────────────────────────────────────────────────────────────────────────────
// Utilitarios
// ─────────────────────────────────────────────────────────────────────────────

function ratioFor(home: number, away: number) {
  if (home + away === 0) return 50
  return Math.round((home / (home + away)) * 100)
}

function deriveFormation(squad: MatchPlayer[]): string {
  const def = squad.filter(p => ["LD", "LE", "ZAG"].includes(p.position)).length
  const mid = squad.filter(p => ["VOL", "MEI"].includes(p.position)).length
  const att = squad.filter(p => ["PE", "PD", "ATA", "SA"].includes(p.position)).length
  return `${def}-${mid}-${att}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares - Estilo EA FC
// ─────────────────────────────────────────────────────────────────────────────

// Stat lateral grande - estilo EA FC
function BigStat({ label, value, side }: { label: string; value: string | number; side: "left" | "right" }) {
  // Garante que o valor nunca seja NaN ou undefined
  let displayValue: string | number = value
  if (typeof value === "number") {
    displayValue = isNaN(value) || value === undefined || value === null ? 0 : Math.round(value)
  }
  return (
    <div className={cn("flex flex-col", side === "left" ? "items-start" : "items-end")}>
      <span className="text-[#00ffc8] text-xs font-medium tracking-wider uppercase mb-1">{label}</span>
      <span className="text-white text-6xl sm:text-7xl lg:text-8xl font-black tabular-nums leading-none">{displayValue}</span>
    </div>
  )
}

// Barra de estatistica comparativa - estilo EA FC
function StatBar({ label, homeValue, awayValue, suffix = "" }: { 
  label: string
  homeValue: number
  awayValue: number
  suffix?: string
}) {
  const total = (homeValue || 0) + (awayValue || 0)
  const homePercent = total > 0 ? ((homeValue || 0) / total) * 100 : 50
  const awayPercent = total > 0 ? ((awayValue || 0) / total) * 100 : 50
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white font-bold tabular-nums">{homeValue ?? 0}{suffix}</span>
        <span className="text-white/50 uppercase tracking-wider text-[10px]">{label}</span>
        <span className="text-white font-bold tabular-nums">{awayValue ?? 0}{suffix}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/10">
        <div 
          className="bg-[#00ffc8] transition-all duration-500"
          style={{ width: `${homePercent}%` }}
        />
        <div 
          className="bg-white/40 transition-all duration-500"
          style={{ width: `${awayPercent}%` }}
        />
      </div>
    </div>
  )
}

// Evento de substituicao na timeline
function SubstitutionEvent({ 
  minute, 
  playerOut, 
  playerIn, 
  side 
}: { 
  minute: number
  playerOut: string
  playerIn: string
  side: "home" | "away"
}) {
  const isHome = side === "home"
  return (
    <div className={cn("flex items-center gap-3", isHome ? "flex-row" : "flex-row-reverse")}>
      <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
        <span className="text-white/90 text-sm font-medium">{playerOut}</span>
        <span className="text-white/50 text-xs">{playerIn}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ArrowDownUp className="w-3.5 h-3.5 text-[#00ffc8]" />
      </div>
      <span className="text-white/60 text-sm font-bold tabular-nums">{minute}&apos;</span>
    </div>
  )
}

// Componente generico de evento na timeline
function TimelineEvent({ event, homeTeam, awayTeam }: { 
  event: { 
    minute: number
    type: string
    side: "home" | "away"
    player?: string
    playerOut?: string
    playerIn?: string
    text?: string
  }
  homeTeam: string
  awayTeam: string
}) {
  const isHome = event.side === "home"
  const teamName = isHome ? homeTeam : awayTeam
  
  // Icone e cor baseados no tipo de evento
  const getEventIcon = () => {
    switch (event.type) {
      case "goal":
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
              <circle cx="12" cy="12" r="4" fill="currentColor"/>
            </svg>
          </div>
        )
      case "yellow_card":
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <div className="w-3 h-4 bg-yellow-400 rounded-sm" />
          </div>
        )
      case "red_card":
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <div className="w-3 h-4 bg-red-500 rounded-sm" />
          </div>
        )
      case "substitution":
        return (
          <div className="w-8 h-8 rounded-full bg-[#00ffc8]/20 flex items-center justify-center flex-shrink-0">
            <ArrowDownUp className="w-4 h-4 text-[#00ffc8]" />
          </div>
        )
      case "penalty":
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-400 text-xs font-bold">PEN</span>
          </div>
        )
      case "var":
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-400 text-xs font-bold">VAR</span>
          </div>
        )
      default:
        return null
    }
  }
  
  // Texto do evento
  const getEventText = () => {
    switch (event.type) {
      case "goal":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-emerald-400 text-sm font-bold uppercase">GOL!</span>
            <span className="text-white/90 text-sm font-medium">{event.player || teamName}</span>
          </div>
        )
      case "yellow_card":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-yellow-400 text-sm font-bold">Cartao Amarelo</span>
            <span className="text-white/70 text-xs">{event.player || teamName}</span>
          </div>
        )
      case "red_card":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-red-400 text-sm font-bold">Cartao Vermelho</span>
            <span className="text-white/70 text-xs">{event.player || teamName}</span>
          </div>
        )
      case "substitution":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-[#00ffc8] text-xs font-medium uppercase">Substituição</span>
            <span className="text-white/90 text-sm">{event.playerOut || "Saiu"}</span>
            <span className="text-white/50 text-xs">{event.playerIn || "Entrou"}</span>
          </div>
        )
      case "penalty":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-amber-400 text-sm font-bold">Pênalti</span>
            <span className="text-white/70 text-xs">{event.player || teamName}</span>
          </div>
        )
      case "var":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-blue-400 text-sm font-bold">Revisao VAR</span>
            <span className="text-white/70 text-xs">{event.text || "Checando..."}</span>
          </div>
        )
      default:
        return null
    }
  }
  
  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-4",
      isHome ? "justify-start" : "justify-end"
    )}>
      {isHome && (
        <>
          <span className="text-white/50 text-sm font-bold tabular-nums w-10">{event.minute}&apos;</span>
          {getEventIcon()}
          {getEventText()}
        </>
      )}
      {!isHome && (
        <>
          {getEventText()}
          {getEventIcon()}
          <span className="text-white/50 text-sm font-bold tabular-nums w-10 text-right">{event.minute}&apos;</span>
        </>
      )}
    </div>
  )
}

// Tab button estilo EA FC
function TabButton({ 
  label, 
  active, 
  onClick, 
  shortcut 
}: { 
  label: string
  active?: boolean
  onClick?: () => void
  shortcut?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium transition-colors relative",
        active 
          ? "text-white" 
          : "text-white/40 hover:text-white/60"
      )}
    >
      {shortcut && (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">
          {shortcut}
        </span>
      )}
      {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export default function PartidaAoVivoPage() {
  const { state: savedGame, setState: setSavedGame } = useGameState()
  const { addNotification } = useNotifications()
  const { team: _userTeamHook } = useUserTeam()
  const userTeamId = _userTeamHook.curto
  const { currentMatch, registerUserMatchResult, advanceWeek } = useGameManager()
  const { squadPlayers: enginePlayers, formation: savedFormation, teamTactics, tacticalPlayerPositions, processarDesempenhoPartida } = useGameEngine()
  const engineMatchResults = useGameEngine(s => s.matchResults)
  const engineSeason = useGameEngine(s => s.currentSeason)
  const engineSetPieceTakers = useGameEngine(s => s.setPieceTakers)
  const engineTacticalAssignments = useGameEngine(s => s.tacticalAssignments)
  // Mantém a identidade da partida encerrada mesmo depois de advanceWeek trocar o
  // próximo confronto; o modal da rodada precisa dessa chave estável.
  const [finalMatch, setFinalMatch] = useState<{ home: Team; away: Team; userSide: "home" | "away" } | null>(null)
  // Resultados de todas as competicoes que rodaram nesta rodada (para a tela pos-jogo)
  /**
   * Resultados da rodada que ACABOU de ser jogada.
   *
   * BUG que isto corrige ("a tela de resultados da rodada nao funciona"): o filtro era
   *
   *     r.season === engineSeason && r.week === engineWeek
   *
   * mas o jogo tem DOIS contadores de semana diferentes — `saveState.week` (save) e
   * `gameEngine.currentWeek` (engine) — e o resultado e GRAVADO com `saveState.week + 1`
   * (ver registerUserMatchResult). Filtrar pelo contador do engine quase nunca casava com
   * a semana em que o resultado foi salvo, entao roundResults vinha VAZIO: o modal abria
   * em branco, o que na pratica e o mesmo que nao funcionar.
   *
   * Em vez de tentar sincronizar os dois contadores (fragil), derivamos a rodada dos
   * PROPRIOS resultados: a que acabou de ser jogada e a de maior semana registrada.
   */
  const roundResults = useMemo(() => {
    const targetHome = finalMatch?.home.curto ?? currentMatch?.homeTeam.curto
    const targetAway = finalMatch?.away.curto ?? currentMatch?.awayTeam.curto
    if (!targetHome || !targetAway) return []
    const daTemporada = engineMatchResults.filter(r => r.season === engineSeason)
    const userResult = [...daTemporada].reverse().find(result =>
      result.homeTeam === targetHome && result.awayTeam === targetAway,
    )
    if (!userResult) return []
    return daTemporada
      // TODAS as competicoes que rodaram nesta semana, nao so a que eu disputei.
      // O filtro tinha `&& r.competition === userResult.competition`, entao a
      // tela chamada "Resultados da Rodada" mostrava apenas o Paulista enquanto
      // Brasileirao, Copa do Brasil e Sul-Americana corriam no mesmo periodo e
      // ficavam invisiveis.
      .filter(r => r.week === userResult.week)
      // Um clube joga UMA vez por rodada. Se outro resultado da mesma rodada
      // envolver o meu time, ele nao pode ser meu — e uma partida que o motor
      // resolveu por engano — e mostrar os dois foi o relato "ao terminar a
      // partida, exibe o resultado de outra partida". A que vale e a que acabou
      // de ser disputada.
      .filter(r => r === userResult || (r.homeTeam !== targetHome && r.homeTeam !== targetAway
        && r.awayTeam !== targetHome && r.awayTeam !== targetAway))
      .map(r => ({
        competition: r.competition,
        homeTeam: r.homeTeam,
        awayTeam: r.awayTeam,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      }))
      // Os demais estaduais correm na mesma janela do ano e o motor nao os
      // simula. Sem eles a tela dizia "Resultados da Rodada" mostrando um
      // campeonato so, como se o resto do pais nao estivesse jogando.
      .concat(outrosEstaduaisDaRodada({
        season: engineSeason,
        week: userResult.week,
        estadoDoUsuario: _userTeamHook.estado ?? "",
        semanasDeEstadual: getStateChampRounds(_userTeamHook.curto),
      }))
  }, [engineMatchResults, engineSeason, finalMatch, currentMatch, _userTeamHook.estado, _userTeamHook.curto])

  const resultRegistered = useRef(false)
  const t = useTranslation()

  // Hydration guard
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  // Carrega contexto da partida salva ou usa valores padrao
  const matchCtx = useMemo(() => loadMatchContext(), [])

  // Determina times a partir do contexto salvo. AMISTOSO tem prioridade sobre o jogo da
  // rodada (currentMatch), senao o amistoso acabaria jogando contra o adversario do fixture.
  const homeTeam = useMemo(() => {
    if ((matchCtx.friendly || matchCtx.youth) && matchCtx.homeShort) return getTeamByShort(matchCtx.homeShort) ?? serieATeams[0]
    if (currentMatch) return currentMatch.homeTeam
    if (matchCtx.homeShort) return getTeamByShort(matchCtx.homeShort) ?? serieATeams[0]
    return getTeamByShort(userTeamId ?? "") ?? serieATeams[0]
  }, [currentMatch, matchCtx.friendly, matchCtx.youth, matchCtx.homeShort, userTeamId])

  const awayTeam = useMemo(() => {
    if ((matchCtx.friendly || matchCtx.youth) && matchCtx.awayShort) return getTeamByShort(matchCtx.awayShort) ?? serieATeams[1]
    if (currentMatch) return currentMatch.awayTeam
    if (matchCtx.awayShort) return getTeamByShort(matchCtx.awayShort) ?? serieATeams[1]
    return serieATeams.find(t => t.curto !== homeTeam.curto) ?? serieATeams[1]
  }, [currentMatch, matchCtx.friendly, matchCtx.youth, matchCtx.awayShort, homeTeam.curto])

  const displayCompetition = matchCtx.friendly ? "Amistoso" : (matchCtx.youth ? matchCtx.competition : (currentMatch?.competition || matchCtx.competition || "Brasileirao Serie A"))
  const displayRound = matchCtx.youth ? matchCtx.round : (currentMatch ? `Rodada ${currentMatch.round}` : (matchCtx.round || "Rodada 1"))
  const homeKitColors = useMemo(() => getKitColors(homeTeam, matchCtx.homeKit ?? "home"), [homeTeam, matchCtx.homeKit])
  const awayKitColors = useMemo(() => getKitColors(awayTeam, matchCtx.awayKit ?? "away"), [awayTeam, matchCtx.awayKit])

  // Determina qual lado e o do usuario
  const userTeam = useMemo(() => {
    return getTeamByShort(userTeamId ?? "") ?? serieATeams[0]
  }, [userTeamId])
  
  const isHome = homeTeam.curto === userTeam.curto
  const userSide: "home" | "away" = isHome ? "home" : "away"

  // Squads
  const [homeSquad, setHomeSquad] = useState<MatchPlayer[]>([])
  const [awaySquad, setAwaySquad] = useState<MatchPlayer[]>([])
  const [homeBench, setHomeBench] = useState<MatchPlayer[]>([])
  const [awayBench, setAwayBench] = useState<MatchPlayer[]>([])

  useEffect(() => {
    // Monta um lado a partir dos dados reais (players-data), com fallback generico.
    const buildSideFromData = (team: typeof homeTeam, offset: number, prefix: string) => {
      const players = getPlayersForTeam(team)
      if (players.length >= 11) return playersToMatchSquad(players, offset)
      return { starters: buildSquad(offset, prefix), bench: buildBench(offset + 100, prefix) }
    }

    // O game-engine so fornece o elenco do time do usuario. O adversario sempre
    // vem dos dados reais, garantindo que AMBOS os lados sejam preenchidos
    // (radar, condicao fisica e notas dependem disso).
    if (matchCtx.youth && savedGame.youthPlayers?.length) {
      const selectedIds = new Set(savedGame.youthCareer?.startingPlayerIds ?? savedGame.youthPlayers.slice(0, 11).map(player => player.id))
      const ordered = [...savedGame.youthPlayers.filter(player => selectedIds.has(player.id)), ...savedGame.youthPlayers.filter(player => !selectedIds.has(player.id))]
      const converted = ordered.map((player, index) => ({ id: index + 1, name: player.name, position: player.position, overall: player.overall, energy: 100, pace: player.pace ?? player.overall, shooting: player.shooting ?? shootingForPosition(player.overall, player.position), passing: player.passing ?? player.overall, dribbling: player.dribbling ?? player.overall, defending: player.defending ?? player.overall, physical: player.physical ?? player.overall, isStarter: selectedIds.has(player.id), shirtNumber: index + 1, injury: null, calledUp: false } as unknown as EnginePlayer))
      const youthSquad = enginePlayersToMatchSquad(converted, isHome ? 0 : 200, savedFormation ?? "4-3-3")
      const opponent = buildSideFromData(isHome ? awayTeam : homeTeam, isHome ? 200 : 0, "SUB20_")
      if (isHome) { setHomeSquad(youthSquad.starters); setHomeBench(youthSquad.bench); setAwaySquad(opponent.starters); setAwayBench(opponent.bench) }
      else { setAwaySquad(youthSquad.starters); setAwayBench(youthSquad.bench); setHomeSquad(opponent.starters); setHomeBench(opponent.bench) }
    } else if (enginePlayers && enginePlayers.length > 0) {
      const userSquad = enginePlayersToMatchSquad(enginePlayers, isHome ? 0 : 200, savedFormation ?? "4-3-3", tacticalPlayerPositions ?? {})
      if (isHome) {
        const opp = buildSideFromData(awayTeam, 200, "A_")
        setHomeSquad(userSquad.starters)
        setHomeBench(userSquad.bench)
        setAwaySquad(opp.starters)
        setAwayBench(opp.bench)
      } else {
        const opp = buildSideFromData(homeTeam, 0, "H_")
        setAwaySquad(userSquad.starters)
        setAwayBench(userSquad.bench)
        setHomeSquad(opp.starters)
        setHomeBench(opp.bench)
      }
    } else {
      // Fallback para players-data nos dois times
      const home = buildSideFromData(homeTeam, 0, "H_")
      const away = buildSideFromData(awayTeam, 200, "A_")
      setHomeSquad(home.starters)
      setHomeBench(home.bench)
      setAwaySquad(away.starters)
      setAwayBench(away.bench)
    }
  }, [enginePlayers, homeTeam.curto, awayTeam.curto, isHome, matchCtx.youth, savedGame.youthPlayers, savedGame.youthCareer?.startingPlayerIds, savedFormation])

  const toSquadPlayer = (p: MatchPlayer) => ({
    nome: p.name,
    pos: p.position,
    rating: p.rating,
    stamina: p.stamina,
    shooting: p.shooting,
    passing: p.passing,
    pace: p.pace,
    defending: p.defending,
    physical: p.physical,
    dribbling: p.dribbling,
  })

  // Mentalidade do time do USUARIO, mudavel DURANTE a partida (o motor le config ao vivo,
  // entao vale ja no proximo lance / no 2o tempo). Ofensivo = mais ataque, menos solidez.
  const initialMentality = teamTactics.mentality === "muito_defensivo" ? "defensivo" : teamTactics.mentality === "muito_ofensivo" ? "ofensivo" : teamTactics.mentality
  const [userMentality, setUserMentality] = useState<"defensivo" | "equilibrado" | "ofensivo">(initialMentality)
  // A formação pode ser alterada durante a partida sem alterar a escalação salva
  // para a próxima rodada. O radar e o plano de jogo leem este estado ao vivo.
  const [liveFormation, setLiveFormation] = useState(savedFormation ?? "4-3-3")
  const [liveTacticNotice, setLiveTacticNotice] = useState<string | null>(null)

  const applyLiveFormation = (formation: string) => {
    setLiveFormation(formation)
    setLiveTacticNotice(`${formation} aplicado em campo`)
    window.setTimeout(() => setLiveTacticNotice(null), 2600)
  }

  const tacticalForces = useMemo(() => {
    const base = { attack: 0, defense: 0, midfield: 0 }
    if (teamTactics.playingStyle === "posse_bola") return { ...base, midfield: 5, attack: 1 }
    if (teamTactics.playingStyle === "contra_ataque") return { ...base, attack: 4, defense: 3, midfield: -2 }
    if (teamTactics.playingStyle === "pressao_alta") return { ...base, attack: 3, midfield: 3, defense: -1 }
    if (teamTactics.playingStyle === "jogo_direto") return { ...base, attack: 2, midfield: -1 }
    return { ...base, attack: 1, midfield: 2 }
  }, [teamTactics.playingStyle])

  // Config da simulacao
  const config = useMemo(() => ({
    homeTeam,
    awayTeam,
    // A IA recebe apenas um pequeno ganho de preparo; a diferença principal continua
    // vindo do elenco. Isso aumenta a dificuldade sem manipular placares.
    homeRating: homeTeam.prestigio + (userSide === "away" ? 2 : 0),
    awayRating: awayTeam.prestigio + (userSide === "home" ? 2 : 0),
    homeSquad: homeSquad.map(toSquadPlayer),
    awaySquad: awaySquad.map(toSquadPlayer),
    durationMinutes: matchCtx.duration,
    // Diz ao motor qual lado e o do usuario: no penalti dele, o motor PARA e espera
    // a escolha do batedor em vez de cobrar sozinho.
    userSide,
    // Cobradores designados. PONTE que faltava: a aba Atribuições do
    // gerenciamento grava em tacticalAssignments e a partida só lia
    // setPieceTakers (da aba Bola Parada) — dois cofres, e o que o técnico
    // escolhia no gerenciamento nunca chegava ao jogo. Atribuições prevalece;
    // Bola Parada é o fallback.
    userSetPieceTakers: {
      corner: engineTacticalAssignments?.corner || engineSetPieceTakers?.corner,
      freeKick: engineTacticalAssignments?.freeKickRight || engineTacticalAssignments?.freeKick
        || engineTacticalAssignments?.freeKickLeft || engineSetPieceTakers?.freeKick,
      penalty: engineTacticalAssignments?.penalty || engineSetPieceTakers?.penalty,
    },
    // Mentalidade aplicada ao lado do usuario (afeta a simulacao ao vivo).
    homeMentality: userSide === "home" ? userMentality : undefined,
    awayMentality: userSide === "away" ? userMentality : undefined,
    homeAttack: userSide === "home" ? homeTeam.prestigio + tacticalForces.attack : undefined,
    homeDefense: userSide === "home" ? homeTeam.prestigio + tacticalForces.defense : undefined,
    homeMidfield: userSide === "home" ? homeTeam.prestigio + tacticalForces.midfield : undefined,
    awayAttack: userSide === "away" ? awayTeam.prestigio + tacticalForces.attack : undefined,
    awayDefense: userSide === "away" ? awayTeam.prestigio + tacticalForces.defense : undefined,
    awayMidfield: userSide === "away" ? awayTeam.prestigio + tacticalForces.midfield : undefined,
  }), [homeTeam, awayTeam, homeSquad, awaySquad, matchCtx.duration, userSide, userMentality, tacticalForces, engineSetPieceTakers, engineTacticalAssignments])

  const sim = useMatchSimulation(config)
  const { state, speed, isRunning, start, pause, resume, reset, setSpeed, fastForward, addEvent, takePenalty } = sim

  useEffect(() => {
    // Antes do apito inicial a formação deve sempre refletir a última tática salva.
    if (state.phase === "pre") setLiveFormation(savedFormation ?? "4-3-3")
  }, [savedFormation, state.phase])

  useEffect(() => {
    initAudio({
      enabled: savedGame.commentaryEnabled ?? true,
      volume: (savedGame.commentaryVolume ?? 80) / 100,
      mute: !(savedGame.commentaryEnabled ?? true),
      preload: true,
      fallbackToText: true,
      pack: savedGame.commentaryVoice ?? "padrao",
      language: "pt-br",
    })
    return clearCommentary
  }, [savedGame.commentaryEnabled, savedGame.commentaryVolume, savedGame.commentaryVoice])

  // Penalti a favor do usuario: o motor parou e esta esperando o batedor.
  // Isto substitui a deteccao pelo evento (que nunca funcionava — o gol ja vinha por cima).
  useEffect(() => {
    if (state.pendingPenalty) {
      pause()
      setShowPenaltyModal(true)
    }
  }, [state.pendingPenalty, pause])

  // Discord Rich Presence
  useDiscordRPC(state, homeTeam, awayTeam)

  // Sons da partida
  const { play: playSound } = useMatchSounds()
  const lastSoundEventId = useRef<string | null>(null)
  const lastDismissalEventId = useRef<string | null>(null)
  const lastSideFoulEventId = useRef<string | null>(null)
  const sideFoulTimer = useRef<number | null>(null)
  const lastPhase = useRef<string | null>(null)

  // Som por mudança de fase (apito de início/intervalo/fim)
  useEffect(() => {
    if (!hydrated) return
    if (lastPhase.current === state.phase) return
    lastPhase.current = state.phase
    if (state.phase === "first") playSound("apito_inicio")
    else if (state.phase === "halftime") { playSound("apito_intervalo"); enqueueEvent("intervalo") }
    else if (state.phase === "fulltime") { playSound("apito_fim"); enqueueEvent("fimjogo") }
  }, [state.phase, hydrated, playSound])

  // Som por evento (gol, falta, cartão, etc.)
  useEffect(() => {
    if (state.events.length === 0) return
    // O motor PREPENDE os eventos ([novo, ...events]), entao o mais recente e o
    // indice 0. Antes lia events[length-1] = o mais ANTIGO (o kickoff), e por isso
    // nenhum som de gol/cartao/penalti tocava depois do primeiro evento.
    const last = state.events[0]
    const id = `snd-${last.id}`
    if (lastSoundEventId.current === id) return
    lastSoundEventId.current = id
    switch (last.type) {
      case "goal":    playSound("gol"); enqueueEvent("gol1"); break
      case "foul":    playSound("apito_falta"); break
      case "yellow_card": playSound("cartao_amarelo"); break
      case "red_card":    playSound("cartao_vermelho"); enqueueEvent("expulsao"); break
      case "penalty":     playSound("penalti"); enqueueEvent("penalty"); break
      case "sub":         playSound("substituicao"); break
    }
  }, [state.events, playSound])

  // Vermelho precisa retirar o atleta do radar/campo, não apenas reduzir a força do time.
  useEffect(() => {
    const dismissal = state.events.find(event => event.type === "red_card")
    if (!dismissal?.player || dismissal.id === lastDismissalEventId.current) return
    lastDismissalEventId.current = dismissal.id
    const normalized = dismissal.player.trim().toLocaleLowerCase("pt-BR")
    const remove = (players: MatchPlayer[]) => players.filter(player => player.name.trim().toLocaleLowerCase("pt-BR") !== normalized)
    if (dismissal.side === "home") setHomeSquad(remove)
    else setAwaySquad(remove)
  }, [state.events])

  // Contexto atual
  const gameContext: GameContext = state.phase === "pre" 
    ? "match_preview" 
    : state.phase === "fulltime" 
      ? "menu"
      : isRunning 
        ? "match_live" 
        : "match_paused"

  // Modal substituicao
  const [showSubModal, setShowSubModal] = useState(false)
  const [subsRemaining, setSubsRemaining] = useState(5)

  // Tab ativa
  const [activeTab, setActiveTab] = useState<"pitch" | "fitness" | "ratings" | "stats" | "gameplan" | "narration">("narration")

  // Estado para animacoes de eventos
  const [currentAnimation, setCurrentAnimation] = useState<{
    type: AnimatableEvent
    team?: typeof homeTeam
    player?: string
    minute?: number
  } | null>(null)
  const [sideFoul, setSideFoul] = useState<MatchEvent | null>(null)

  // Estado para modal de penalti
  const [showPenaltyModal, setShowPenaltyModal] = useState(false)
  const [pendingPenalty, setPendingPenalty] = useState<{
    side: "home" | "away"
    minute: number
  } | null>(null)

  // Ref para rastrear ultimo evento processado
  const lastProcessedEventId = useRef<string | null>(null)

  // Monitora eventos para mostrar animacoes
  useEffect(() => {
    if (state.events.length === 0) return
    
    // Mesmo bug do handler de som: o motor prepende, entao o evento novo e o [0].
    // Lendo [length-1] o efeito ficava preso no kickoff e NUNCA disparava as
    // animacoes de gol/cartao/falta nem o modal de batedor de penalti.
    const lastEvent = state.events[0]
    const eventId = lastEvent.id

    // Evita processar o mesmo evento duas vezes
    if (lastProcessedEventId.current === eventId) return
    lastProcessedEventId.current = eventId

    const animatableTypes: AnimatableEvent[] = ["goal", "penalty", "yellow_card", "red_card", "var"]
    
    if (animatableTypes.includes(lastEvent.type as AnimatableEvent)) {
      const eventTeam = lastEvent.side === "home" ? homeTeam : awayTeam
      
      // Penalti do usuario NAO e tratado aqui: o motor agora para e sinaliza via
      // state.pendingPenalty (efeito abaixo). Antes isto dependia do evento "penalty"
      // estar no topo da lista — mas o motor ja tinha empilhado o gol por cima dele.
      if (lastEvent.type === "penalty" && lastEvent.side === userSide) {
        // no-op: o modal abre pelo pendingPenalty
      } else {
        // Mostra animacao normal
        pause()
        setCurrentAnimation({
          type: lastEvent.type as AnimatableEvent,
          team: eventTeam,
          player: lastEvent.player,
          minute: lastEvent.minute
        })
      }
    }
  }, [state.events, homeTeam, awayTeam, userSide, pause])

  // Faltas são avisos contextuais e não devem pausar/cobrir o placar. Exibe o lance
  // por alguns segundos na coluna lateral direita, reservada a informações ao vivo.
  useEffect(() => {
    const foul = state.events.find(event => event.type === "foul")
    if (!foul || foul.id === lastSideFoulEventId.current) return
    lastSideFoulEventId.current = foul.id
    setSideFoul(foul)
    if (sideFoulTimer.current !== null) window.clearTimeout(sideFoulTimer.current)
    sideFoulTimer.current = window.setTimeout(() => setSideFoul(current => current?.id === foul.id ? null : current), 6500)
  }, [state.events])

  useEffect(() => () => {
    if (sideFoulTimer.current !== null) window.clearTimeout(sideFoulTimer.current)
  }, [])

  // Cobra o penalti com o batedor escolhido e DEVOLVE o desfecho, para o modal narrar
  // ("La vai Fulano... foi na paradinha... chutou... eeeee... GOOOL!").
  // A escolha IMPORTA: o motor usa o shooting deste jogador na taxa de conversao.
  const handlePenaltyTaker = (player: MatchPlayer) => {
    return takePenalty(toSquadPlayer(player))
  }

  // Narracao terminou: fecha o modal e devolve a partida ao relogio.
  const handlePenaltyFinish = () => {
    setShowPenaltyModal(false)
    setPendingPenalty(null)
    resume()
  }

  // Handler para fechar animacao
  const handleAnimationComplete = () => {
    setCurrentAnimation(null)
    // Resume a partida apos a animacao
    if (state.phase !== "fulltime" && state.phase !== "pre") {
      resume()
    }
  }

  // Handler de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (state.phase === "pre") { start(); return }
      }
      if (e.key.toLowerCase() === "x" && state.phase !== "fulltime") {
        e.preventDefault()
        fastForward()
        return
      }
      // Atalho exibido nas configuracoes e no rodape da partida.
      if (e.key.toLowerCase() === "t" && state.phase !== "pre" && state.phase !== "fulltime") {
        e.preventDefault()
        if (subsRemaining > 0) {
          pause()
          setShowSubModal(true)
        }
        return
      }
      if (e.key === "Escape") {
        if (state.phase !== "pre" && state.phase !== "fulltime") {
          if (isRunning) pause()
          else resume()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [fastForward, isRunning, pause, resume, start, state.phase, subsRemaining])

  // Handler de gamepad
  useEffect(() => {
    const handleGamepadButton = (e: CustomEvent<{ button: GamepadButtonName }>) => {
      const button = e.detail.button
      const action = getActionForButton(button, gameContext)
      if (!action) return
      switch (action) {
        case "pause_resume":
          if (state.phase !== "pre" && state.phase !== "fulltime") {
            if (isRunning) pause()
            else resume()
          }
          break
        case "fast_forward":
          if (speed === "slow") setSpeed("normal")
          else if (speed === "normal") setSpeed("fast")
          else if (speed === "fast") setSpeed("ultra")
          else if (speed === "ultra") setSpeed("hyper")
          break
        case "substitute":
          if (subsRemaining > 0 && state.phase !== "fulltime") {
            setShowSubModal(true)
          }
          break
        case "skip_to_result":
          fastForward()
          break
        case "confirm":
          if (state.phase === "pre") start()
          break
        case "back":
          if (showSubModal) setShowSubModal(false)
          break
      }
    }
    window.addEventListener("gamepad:button" as any, handleGamepadButton)
    return () => window.removeEventListener("gamepad:button" as any, handleGamepadButton)
  }, [fastForward, gameContext, isRunning, pause, resume, speed, setSpeed, start, subsRemaining, state.phase, showSubModal])

  // Modal de fim
  const [showResult, setShowResult] = useState(false)
  const [showRoundResults, setShowRoundResults] = useState(false)
  const [showPressConference, setShowPressConference] = useState(false)
  const [isLeagueChampion, setIsLeagueChampion] = useState(false)
  const postMatchAdvance = useRef<Promise<unknown> | null>(null)
  // Congela os times do confronto no apito final, ANTES de advanceWeek mudar o
  // currentMatch para a proxima partida (senao o modal mostra o adversario errado).

  // A partida do usuario precisa aparecer mesmo enquanto o Zustand ainda propaga o
  // resultado recém-registrado. Sem este fallback a tela intermediaria podia ficar vazia.
  const postMatchRoundResults = useMemo(() => {
    if (roundResults.length > 0) return roundResults
    if (state.phase !== "fulltime") return []
    return [{
      competition: matchCtx.competition || "Partida",
      homeTeam: (finalMatch?.home ?? homeTeam).curto,
      awayTeam: (finalMatch?.away ?? awayTeam).curto,
      homeScore: state.home.goals,
      awayScore: state.away.goals,
    }]
  }, [roundResults, state.phase, state.home.goals, state.away.goals, matchCtx.competition, finalMatch, homeTeam, awayTeam])

  useEffect(() => {
    if (state.phase === "fulltime" && !showResult) {
      if (!resultRegistered.current) {
        resultRegistered.current = true
        // Snapshot dos times ANTES de avancar a semana (que troca o currentMatch)
        setFinalMatch({ home: homeTeam, away: awayTeam, userSide })
        // AMISTOSO: e so treino — NAO registra resultado, NAO mexe na tabela nem avanca a
        // semana. So mostra o placar. (Sem isto, um amistoso contaria como jogo oficial.)
        if (matchCtx.friendly) {
          clearMatchContext()
        } else if (matchCtx.youth) {
          const userGoals = userSide === "home" ? state.home.goals : state.away.goals
          const opponentGoals = userSide === "home" ? state.away.goals : state.home.goals
          setSavedGame(applyPlayedYouthMatch(savedGame, userGoals, opponentGoals))
          clearMatchContext()
        } else {
          const events = state.events
            .filter(e => e.type === "goal")
            .map(e => ({
              minute: e.minute,
              type: "goal" as const,
              playerId: 0,
              playerName: e.player || (e.side === "home" ? homeTeam.curto : awayTeam.curto),
            }))
          registerUserMatchResult(
            homeTeam.curto,
            awayTeam.curto,
            state.home.goals,
            state.away.goals,
            events
          )

          // REALISMO: nota por jogador + cartoes->suspensao. Mapeia os eventos do
          // MEU lado (nome -> id do elenco do motor) e processa o desempenho.
          try {
            const meuLado = userSide // "home" | "away"
            const porNome = new Map<string, number>()
            for (const p of enginePlayers) porNome.set(p.name.trim().toLowerCase(), p.id)
            const idDe = (nome?: string) => (nome ? porNome.get(nome.trim().toLowerCase()) : undefined)
            const evJogador: { minute: number; type: "goal" | "assist" | "yellow" | "red"; playerId: number; playerName: string; assistPlayerId?: number; assistPlayerName?: string }[] = []
            for (const e of state.events) {
              if (e.side !== meuLado) continue
              const tipo: "goal" | "yellow" | "red" | null = e.type === "goal" ? "goal"
                : e.type === "yellow_card" ? "yellow"
                : e.type === "red_card" ? "red" : null
              if (!tipo) continue
              const id = idDe(e.player)
              if (id === undefined) continue
              evJogador.push({
                minute: e.minute, type: tipo, playerId: id, playerName: e.player ?? "",
                assistPlayerId: idDe(e.assist), assistPlayerName: e.assist,
              })
            }
            const golsPro = meuLado === "home" ? state.home.goals : state.away.goals
            const golsContra = meuLado === "home" ? state.away.goals : state.home.goals
            processarDesempenhoPartida(golsPro, golsContra, evJogador)
          } catch { /* nota e um extra: nunca deve travar o fim da partida */ }

          clearMatchContext()
          // Título de mata-mata (estadual/copa) é detectado pelo
          // registerUserMatchResult acima, que grava o pending-champion. Sem
          // esta checagem o botão CERIMÔNIA só aparecia para a liga.
          if (typeof window !== "undefined" && localStorage.getItem("ultrafoot-pending-champion")) {
            setIsLeagueChampion(true)
          }
          postMatchAdvance.current = advanceWeek().then(result => {
            if (result && "leagueChampion" in result && result.leagueChampion) {
              const champ = result.leagueChampion
              safeLocalSet("ultrafoot-pending-champion", JSON.stringify({
                competition: champ.competition,
                season: champ.season,
                type: "league",
                stats: champ.stats,
              }))
              setIsLeagueChampion(true)
            }
          }).catch(() => undefined)
        }
      }
      const t = setTimeout(() => setShowResult(true), 1200)
      return () => clearTimeout(t)
    }
  }, [state.phase, showResult, state.events, state.home.goals, state.away.goals, homeTeam.curto, awayTeam.curto, registerUserMatchResult, advanceWeek, matchCtx.friendly, matchCtx.youth, savedGame, setSavedGame, userSide])

  // Stamina drena por minuto.
  // Dois bugs do relato ("até o goleiro cansou kk" + print "5.4000000000012%"):
  // 1) dreno FIXO de 1.1 para todos — 90' zeravam qualquer atleta, goleiro
  //    incluído. GK agora drena ~20% do ritmo de linha.
  // 2) subtração de floats acumulava lixo binário que vazava para a tela.
  //    Arredonda a 1 casa a cada tick.
  useEffect(() => {
    if (state.phase !== "first" && state.phase !== "second") return
    const drena = (p: { position: string; stamina: number }) => {
      const taxa = p.position === "GOL" ? 0.22 : 0.62
      return Math.max(0, Math.round((p.stamina - taxa) * 10) / 10)
    }
    setHomeSquad(prev => prev.map(p => ({ ...p, stamina: drena(p) })))
    setAwaySquad(prev => prev.map(p => ({ ...p, stamina: drena(p) })))
  }, [state.minute, state.phase])

  // Mantém FC Hub e Discord Rich Presence sincronizados com o jogo ao vivo.
  // É um evento local e leve; não envia dados para servidor próprio.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("ultrafoot:live-presence", { detail: {
      home: homeTeam.nome,
      away: awayTeam.nome,
      homeGoals: state.home.goals,
      awayGoals: state.away.goals,
      minute: state.minute,
      phase: state.phase,
      competition: displayCompetition,
    } }))
  }, [homeTeam.nome, awayTeam.nome, state.home.goals, state.away.goals, state.minute, state.phase, displayCompetition])

  // Substituição
  const userStarters = userSide === "home" ? homeSquad : awaySquad
  const userBench = userSide === "home" ? homeBench : awayBench
  const userTeamForSub = userSide === "home" ? homeTeam : awayTeam

  const handleSub = (requestedChanges: SubstitutionChange[]) => {
    const changes = requestedChanges.slice(0, subsRemaining)
    if (changes.length === 0) return
    const setStarters = userSide === "home" ? setHomeSquad : setAwaySquad
    const setBenchSet = userSide === "home" ? setHomeBench : setAwayBench
    // Quem entra herda o slot de quem sai. Assim uma substituição não rearranja
    // Pulgar, Arrascaeta e os demais titulares no radar.
    const replacements = new Map(changes.map(change => [
      change.out.id,
      { ...change.inPlayer, tacticalSlot: change.out.tacticalSlot, formationPosition: change.out.formationPosition },
    ]))
    const incoming = new Set(changes.map(change => change.inPlayer.id))
    setStarters(prev => prev.map(player => replacements.get(player.id) ?? player))
    setBenchSet(prev => prev.filter(player => !incoming.has(player.id)))
    setSubsRemaining(current => Math.max(0, current - changes.length))
    changes.forEach(change => addEvent({
      type: "sub",
      side: userSide,
      text: `Substituição: ${change.inPlayer.name} entra no lugar de ${change.out.name}`,
      player: change.inPlayer.name,
      important: true,
    }))
    setShowSubModal(false)
  }

  // Filtra eventos importantes (gols, cartoes, substituicoes)
  const importantEvents = state.events.filter(e =>
    e.type === "goal" ||
    e.type === "yellow_card" ||
    e.type === "red_card" ||
    e.type === "sub" ||
    e.type === "penalty" ||
    e.type === "var"
  ).sort((a, b) => b.minute - a.minute) // Mais recentes primeiro

  if (!hydrated) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center text-white/40 text-sm">
        Carregando partida...
      </div>
    )
  }

  const isMatchInProgress = state.phase === "first" || state.phase === "second" || state.phase === "halftime"

  // Acréscimos: mostra +N quando o addedTime for não-zero (acréscimo ativo)
  const extraTime = (() => {
    if (state.phase === "first" && state.addedTime > 0) {
      const n = state.minute - 45
      return n > 0 ? `+${n}` : null
    }
    if (state.phase === "second" && state.addedTime > 0) {
      const n = state.minute - 90
      return n > 0 ? `+${n}` : null
    }
    return null
  })()

  return (
    <div className={cn(
      // fixed inset-0 (era h-[100dvh]): no WebView2 o dvh calculava menor que a
      // janela e o body vazava como FAIXA PRETA abaixo do rodapé (2 prints do
      // usuário). Fixando aos 4 cantos, a tela cobre o viewport sempre.
      "fixed inset-0 overflow-hidden flex flex-col",
      "bg-gradient-to-br from-[#1a3d3d] via-[#0d2626] to-[#051515]"
    )} data-match-end={state.phase === "fulltime" ? "true" : undefined}>

      {/* Overlay de pré-jogo — fase "pre" */}
      {state.phase === "pre" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="relative w-[480px] max-w-[92vw] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0c0c14]">
            {/* Faixa de cores dos times */}
            <div
              className="h-1 w-full"
              style={{ background: `linear-gradient(to right, ${homeTeam.cor1 || "#00ffc8"} 50%, ${awayTeam.cor1 || "#ffffff"} 50%)` }}
            />

            {/* Header da competição */}
            <div className="flex flex-col items-center py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-white/70 text-[11px] font-bold uppercase tracking-[0.2em]">
                {displayCompetition}
              </span>
              <span className="text-white/35 text-[10px] mt-0.5 tracking-wider">
                {displayRound}
              </span>
            </div>

            {/* Times */}
            <div className="flex items-center justify-between px-8 py-8 gap-4">
              {/* Time da casa */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <div
                    className="absolute inset-0 blur-2xl opacity-40 scale-150 rounded-full"
                    style={{ backgroundColor: homeTeam.cor1 || "#00ffc8" }}
                  />
                  <TeamCrest team={homeTeam} size="3xl" className="relative drop-shadow-xl" />
                </div>
                <span className="text-white text-sm font-bold text-center leading-tight">{homeTeam.nome}</span>
              </div>

              {/* VS central */}
              <div className="flex flex-col items-center shrink-0 px-2">
                <span className="text-white/20 text-4xl font-black tracking-tight select-none">VS</span>
              </div>

              {/* Time visitante */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <div
                    className="absolute inset-0 blur-2xl opacity-40 scale-150 rounded-full"
                    style={{ backgroundColor: awayTeam.cor1 || "#ffffff" }}
                  />
                  <TeamCrest team={awayTeam} size="3xl" className="relative drop-shadow-xl" />
                </div>
                <span className="text-white text-sm font-bold text-center leading-tight">{awayTeam.nome}</span>
              </div>
            </div>

            {/* Botão e hint */}
            <div className="px-6 pb-6 flex flex-col items-center gap-3 border-t border-white/[0.04] pt-5">
              <button
                onClick={start}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-[#00ffc8] text-black font-black text-base hover:bg-[#00e6b5] transition-all shadow-lg shadow-[#00ffc8]/25 active:scale-[0.98]"
              >
                <Play className="h-5 w-5 fill-current" />
                INICIAR PARTIDA
              </button>

              <p className="text-white/30 text-xs">
                Pressione <kbd className="bg-white/10 px-2 py-0.5 rounded text-white/50">Enter</kbd> ou o botão A do controle
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conteudo Principal - Estilo EA FC */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">

        {/* Liga Badge - Topo Central */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a]/80 backdrop-blur-sm border border-white/10">
            <span className="text-white text-sm font-bold">{displayCompetition}</span>
          </div>
        </div>

        {/* Header do Placar */}
        <header className="relative z-10 shrink-0 pt-16 pb-4 px-4 sm:px-8">
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {/* Time Casa */}
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="text-white text-lg sm:text-xl font-semibold">{homeTeam.nome}</span>
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <TeamCrest team={homeTeam} size="lg" className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>

            {/* Placar Central */}
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-3 sm:gap-4">
                <span className="text-white text-5xl sm:text-7xl font-black tabular-nums">{state.home.goals}</span>
                <span className="text-white/30 text-3xl sm:text-5xl font-light">:</span>
                <span className="text-white text-5xl sm:text-7xl font-black tabular-nums">{state.away.goals}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-white/80 text-sm font-bold tabular-nums">
                  {(state.phase === "first" && state.addedTime > 0) ? "45" :
                   (state.phase === "second" && state.addedTime > 0) ? "90" :
                   state.minute}&apos;00
                </span>
                {extraTime && (
                  <span className="text-[#00ffc8] text-sm font-bold">{extraTime}&apos;</span>
                )}
              </div>
            </div>

            {/* Time Fora */}
            <div className="flex items-center gap-3 sm:gap-4">
              <TeamCrest team={awayTeam} size="lg" className="w-12 h-12 sm:w-16 sm:h-16" />
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <span className="text-white text-lg sm:text-xl font-semibold">{awayTeam.nome}</span>
            </div>
          </div>
        </header>

        {/* Area Principal - 3 Colunas */}
        <div className="flex-1 min-h-0 flex px-4 sm:px-8 pb-4 gap-4 sm:gap-8">
          
  {/* Coluna Esquerda - Stats Casa */}
  <div className="hidden lg:flex flex-col justify-center gap-8 w-48">
  <BigStat label="Posse" value={state.home?.possession ?? 50} side="left" />
  <BigStat label="Chutes" value={state.home?.shots ?? 0} side="left" />
  <BigStat label="No alvo" value={state.home?.shotsOnTarget ?? 0} side="left" />
  </div>

          {/* Coluna Central - Conteudo baseado na Tab ativa */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 rounded-2xl bg-[#1a2a2a]/60 backdrop-blur-sm border border-white/[0.06] overflow-hidden flex flex-col">

              {/* Conteudo da Tab */}
              <div className={cn("flex-1 min-h-0 p-4", activeTab === "pitch" ? "flex flex-col" : "overflow-y-auto")}>
                {activeTab === "stats" && (
                  <div className="space-y-4">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">{t.match.live.sectionStats}</h3>
                    
  {/* Stats Comparativas */}
  <div className="space-y-3">
  <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[10px] font-bold uppercase tracking-wider text-white/40">
  <span>{homeTeam.curto}</span>
  <span className="px-2 text-white/20">{t.match.live.statLabel}</span>
  <span className="text-right">{awayTeam.curto}</span>
  </div>
  <StatBar label="Posse de Bola" homeValue={state.home?.possession ?? 50} awayValue={state.away?.possession ?? 50} suffix="%" />
  <StatBar label="Chutes" homeValue={state.home?.shots ?? 0} awayValue={state.away?.shots ?? 0} />
  <StatBar label="Chutes no Alvo" homeValue={state.home?.shotsOnTarget ?? 0} awayValue={state.away?.shotsOnTarget ?? 0} />
  <StatBar label="Escanteios" homeValue={state.home?.corners ?? 0} awayValue={state.away?.corners ?? 0} />
  <StatBar label="Faltas" homeValue={state.home?.fouls ?? 0} awayValue={state.away?.fouls ?? 0} />
  <StatBar label="Passes" homeValue={state.home?.passes ?? 0} awayValue={state.away?.passes ?? 0} />
  <StatBar label="xG" homeValue={Math.round((state.home?.xG ?? 0) * 10) / 10} awayValue={Math.round((state.away?.xG ?? 0) * 10) / 10} />
  </div>
                  </div>
                )}

                {activeTab === "narration" && (
                  <div className="space-y-3">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Narração ao vivo</h3>
                    {state.events.length === 0 ? (
                      <p className="text-white/30 text-sm py-8 text-center">O jogo vai começar...</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {state.events.map((e) => {
                          const color =
                            e.type === "goal" ? "text-emerald-400 font-semibold"
                            : e.type === "red_card" ? "text-red-400 font-semibold"
                            : e.type === "yellow_card" ? "text-yellow-400"
                            : e.type === "penalty" ? "text-orange-400 font-semibold"
                            : e.type === "save" || e.type === "post" ? "text-cyan-300"
                            : e.type === "fulltime" || e.type === "halftime" || e.type === "kickoff" ? "text-white/80 font-semibold"
                            : "text-white/55"
                          const EventIcon =
                            e.type === "goal" ? Goal
                            : e.type === "red_card" || e.type === "yellow_card" ? Square
                            : e.type === "penalty" ? TargetIcon
                            : e.type === "corner" ? Flag
                            : e.type === "injury" ? Stethoscope
                            : e.type === "save" ? Hand
                            : e.type === "sub" ? ArrowLeftRight
                            : Circle
                          const iconClass =
                            e.type === "red_card" ? "fill-red-500 text-red-500"
                            : e.type === "yellow_card" ? "fill-yellow-400 text-yellow-400"
                            : e.type === "goal" ? "text-emerald-400"
                            : e.type === "penalty" ? "text-orange-400"
                            : e.type === "corner" ? "text-rose-300"
                            : e.type === "injury" ? "text-red-300"
                            : e.type === "save" ? "text-cyan-300"
                            : "text-white/40"
                          const min = e.addedTime ? `${e.minute}+${e.addedTime}'` : `${e.minute}'`
                          return (
                            <li key={e.id} className="flex items-start gap-2 text-sm leading-snug">
                              <span className="shrink-0 tabular-nums text-white/40 w-10 text-right">{min}</span>
                              <EventIcon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconClass)} aria-hidden="true" />
                              <span className={color}>{e.text}</span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === "pitch" && (
                  <div className="flex flex-1 min-h-0 flex-col gap-3">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider shrink-0">{t.match.live.sectionPitch}</h3>
                    <MatchRadar
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      homeSquad={homeSquad}
                      awaySquad={awaySquad}
                      ball={state.ball}
                      homePossession={state.home?.possession ?? 50}
                      minute={state.minute}
                      phase={state.phase}
                      homeFormation={userSide === "home" ? liveFormation : undefined}
                      awayFormation={userSide === "away" ? liveFormation : undefined}
                      homeColor={homeKitColors.body}
                      awayColor={awayKitColors.body}
                    />
                  </div>
                )}

                {activeTab === "fitness" && (
                  <div className="space-y-3">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">{t.match.live.sectionFitness}</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                      {/* Time da Casa */}
                      <div>
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.06]">
                          <TeamCrest team={homeTeam} size="xs" />
                          <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">{homeTeam.curto}</span>
                        </div>
                        {homeSquad.slice(0, 11).map((player) => {
                          const staminaVal = Math.round(player.stamina ?? 100)
                          return (
                            <div key={player.id} className="flex items-center gap-1.5 py-[5px]">
                              <span className="text-white/30 text-[10px] w-4 tabular-nums shrink-0">{player.number}</span>
                              <span className="text-white text-[11px] flex-1 truncate min-w-0">{player.name}</span>
                              <div className="w-10 h-1 bg-white/10 rounded-full overflow-hidden shrink-0">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    staminaVal > 70 ? "bg-emerald-500" :
                                    staminaVal > 40 ? "bg-amber-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${staminaVal}%` }}
                                />
                              </div>
                              <span className="text-white/50 text-[10px] w-7 text-right tabular-nums shrink-0">{staminaVal}%</span>
                            </div>
                          )
                        })}
                      </div>
                      {/* Time Visitante */}
                      <div>
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.06]">
                          <TeamCrest team={awayTeam} size="xs" />
                          <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">{awayTeam.curto}</span>
                        </div>
                        {awaySquad.slice(0, 11).map((player) => {
                          const staminaVal = Math.round(player.stamina ?? 100)
                          return (
                            <div key={player.id} className="flex items-center gap-1.5 py-[5px]">
                              <span className="text-white/30 text-[10px] w-4 tabular-nums shrink-0">{player.number}</span>
                              <span className="text-white text-[11px] flex-1 truncate min-w-0">{player.name}</span>
                              <div className="w-10 h-1 bg-white/10 rounded-full overflow-hidden shrink-0">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    staminaVal > 70 ? "bg-emerald-500" :
                                    staminaVal > 40 ? "bg-amber-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${staminaVal}%` }}
                                />
                              </div>
                              <span className="text-white/50 text-[10px] w-7 text-right tabular-nums shrink-0">{staminaVal}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "ratings" && (
                  <div className="space-y-3">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">{t.match.live.sectionRatings}</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                      {/* Time da Casa */}
                      <div>
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.06]">
                          <TeamCrest team={homeTeam} size="xs" />
                          <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">{homeTeam.curto}</span>
                        </div>
                        {homeSquad.slice(0, 11).map((player) => {
                          const rating = Math.round(player.rating ?? 70)
                          return (
                            <div key={player.id} className="flex items-center gap-1.5 py-[5px]">
                              <span className="text-white/30 text-[10px] w-4 tabular-nums shrink-0">{player.number}</span>
                              <span className="text-white text-[11px] flex-1 truncate min-w-0">{player.name}</span>
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums shrink-0",
                                rating >= 80 ? "bg-emerald-500/20 text-emerald-400" :
                                rating >= 70 ? "bg-amber-500/20 text-amber-400" :
                                "bg-red-500/20 text-red-400"
                              )}>
                                {rating}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      {/* Time Visitante */}
                      <div>
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.06]">
                          <TeamCrest team={awayTeam} size="xs" />
                          <span className="text-white/70 text-[11px] font-semibold uppercase tracking-wider">{awayTeam.curto}</span>
                        </div>
                        {awaySquad.slice(0, 11).map((player) => {
                          const rating = Math.round(player.rating ?? 70)
                          return (
                            <div key={player.id} className="flex items-center gap-1.5 py-[5px]">
                              <span className="text-white/30 text-[10px] w-4 tabular-nums shrink-0">{player.number}</span>
                              <span className="text-white text-[11px] flex-1 truncate min-w-0">{player.name}</span>
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums shrink-0",
                                rating >= 80 ? "bg-emerald-500/20 text-emerald-400" :
                                rating >= 70 ? "bg-amber-500/20 text-amber-400" :
                                "bg-red-500/20 text-red-400"
                              )}>
                                {rating}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "gameplan" && (
                  <div className="space-y-4">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">{t.match.live.sectionGameplan}</h3>

                    {/* Campo tático e mudança real de formação durante a partida. */}
                    <div className="rounded-xl border border-[#00ffc8]/20 bg-[#071817]/75 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-white">Escalação em campo</p>
                          <p className="mt-0.5 text-[11px] text-white/45">A formação é aplicada imediatamente ao radar e à partida.</p>
                        </div>
                        <span className="rounded-md bg-[#00ffc8]/15 px-2 py-1 text-sm font-black text-[#00ffc8]">{liveFormation}</span>
                      </div>
                      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                        {["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2"].map(formation => (
                          <button
                            key={formation}
                            type="button"
                            onClick={() => applyLiveFormation(formation)}
                            className={cn(
                              "rounded-md border px-1.5 py-2 text-[11px] font-bold transition-colors",
                              liveFormation === formation
                                ? "border-[#00ffc8] bg-[#00ffc8]/15 text-[#00ffc8]"
                                : "border-white/10 bg-black/20 text-white/60 hover:border-white/30 hover:text-white",
                            )}
                          >
                            {formation}
                          </button>
                        ))}
                      </div>
                      {liveTacticNotice && <p className="mb-2 text-[11px] font-semibold text-[#00ffc8]" role="status">{liveTacticNotice}</p>}
                      <div className="h-44 overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:h-52">
                        <MatchRadar
                          homeTeam={homeTeam}
                          awayTeam={awayTeam}
                          homeSquad={homeSquad}
                          awaySquad={awaySquad}
                          ball={state.ball}
                          homePossession={state.home?.possession ?? 50}
                          minute={state.minute}
                          phase={state.phase}
                          homeFormation={userSide === "home" ? liveFormation : undefined}
                          awayFormation={userSide === "away" ? liveFormation : undefined}
                          homeColor={homeKitColors.body}
                          awayColor={awayKitColors.body}
                        />
                      </div>
                    </div>

                    {/* Mentalidade AO VIVO do time do usuario — muda a simulacao na hora. */}
                    <div className="mb-4 rounded-lg border border-[#00ffc8]/20 bg-[#00ffc8]/[0.04] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Sua mentalidade</span>
                        <span className="text-white/30 text-[10px]">muda em tempo real</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ["defensivo", "Defensivo", "+ solidez"],
                          ["equilibrado", "Equilibrado", "neutro"],
                          ["ofensivo", "Ofensivo", "+ ataque"],
                        ] as const).map(([val, label, hint]) => (
                          <button
                            key={val}
                            onClick={() => setUserMentality(val)}
                            className={cn(
                              "rounded-lg border px-2 py-2 text-center transition-all",
                              userMentality === val
                                ? "border-[#00ffc8] bg-[#00ffc8]/15 text-[#00ffc8]"
                                : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                            )}
                          >
                            <div className="text-xs font-bold">{label}</div>
                            <div className="text-[9px] opacity-70">{hint}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Decisões do técnico — efeito temporizado no momentum, que é
                        a mesma grandeza que o motor usa para decidir quem cria
                        chance. Complementa a mentalidade: ela é o ajuste contínuo,
                        estas são intervenções pontuais. */}
                    <div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Decisões do técnico</span>
                        {sim.suggestedDecision && (
                          <span className="text-[10px] text-amber-300">auxiliar sugere</span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          ["gritar", "Gritar"],
                          ["acalmar", "Acalmar"],
                          ["pressionar", "Pressionar"],
                          ["recuar", "Recuar"],
                          ["tudo_ou_nada", "Tudo ou nada"],
                          ["segurar_resultado", "Segurar"],
                          ["bola_longa", "Bola longa"],
                          ["sub_sugerida", "Poupar"],
                        ] as const).map(([id, label]) => {
                          const active = sim.activeDecisions.some(d => d.id === id)
                          const suggested = sim.suggestedDecision === id
                          return (
                            <button
                              key={id}
                              onClick={() => sim.applyCoachDecision(id)}
                              className={cn(
                                "rounded-lg border px-1.5 py-2 text-center text-[10px] font-bold transition-all",
                                active
                                  ? "border-amber-400 bg-amber-400/20 text-amber-200"
                                  : suggested
                                    ? "border-amber-300/60 bg-amber-300/10 text-amber-200"
                                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                              )}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                      {sim.activeDecisions.length > 0 && (
                        <p className="mt-2 text-[10px] text-white/40">
                          Em vigor: {sim.activeDecisions.map(d => `${d.id.replace(/_/g, " ")} (até ${d.appliedAtMinute + d.effect.durationMinutes}')`).join(" · ")}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Formacao Casa */}
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <TeamCrest team={homeTeam} size="xs" />
                          <span className="text-white text-sm font-medium">{homeTeam.curto}</span>
                        </div>
                        <div className="text-[#00ffc8] text-lg font-bold">{userSide === "home" ? liveFormation : "4-4-2"}</div>
                        <div className="text-white/40 text-xs mt-1">Posse: Equilibrado</div>
                        <div className="text-white/40 text-xs">Mentalidade: Normal</div>
                      </div>

                      {/* Formacao Fora */}
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <TeamCrest team={awayTeam} size="xs" />
                          <span className="text-white text-sm font-medium">{awayTeam.curto}</span>
                        </div>
                        <div className="text-[#00ffc8] text-lg font-bold">{userSide === "away" ? liveFormation : "4-4-2"}</div>
                        <div className="text-white/40 text-xs mt-1">Posse: Equilibrado</div>
                        <div className="text-white/40 text-xs">Mentalidade: Normal</div>
                      </div>
                    </div>

                    {/* Substituicoes */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white/40 text-xs uppercase tracking-wider">{t.match.live.substitutions}</span>
                        <span className="text-[#00ffc8] text-xs font-bold">{t.match.live.subsRemaining(subsRemaining)}</span>
                      </div>
                      {state.events.filter(e => e.type === "sub" && e.side === "home").length > 0 ? (
                        <div className="space-y-1">
                          {state.events
                            .filter(e => e.type === "sub" && e.side === "home")
                            .map((sub, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs bg-white/5 rounded p-2">
                                <span className="text-white/40">{sub.minute}&apos;</span>
                                <ArrowDownUp className="h-3 w-3 text-amber-400" />
                                <span className="text-white">{sub.player}</span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-white/30 text-xs">{t.match.live.noSubs}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs no rodape do card */}
              <div className="border-t border-white/[0.06] bg-[#0d1a1a]/50">
                <div className="flex items-center justify-start overflow-x-auto px-4 py-2 scrollbar-thin scrollbar-thumb-white/15">
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40 mr-2">L1</span>
                  <TabButton label="Narração" active={activeTab === "narration"} onClick={() => setActiveTab("narration")} />
                  <TabButton label={t.match.live.tabPitch} active={activeTab === "pitch"} onClick={() => setActiveTab("pitch")} />
                  <TabButton label={t.match.live.tabFitness} active={activeTab === "fitness"} onClick={() => setActiveTab("fitness")} />
                  <TabButton label={t.match.live.tabRatings} active={activeTab === "ratings"} onClick={() => setActiveTab("ratings")} />
                  <TabButton label={t.match.live.tabStats} active={activeTab === "stats"} onClick={() => setActiveTab("stats")} />
                  <TabButton label={t.match.live.tabGameplan} active={activeTab === "gameplan"} onClick={() => setActiveTab("gameplan")} />
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40 ml-2">R1</span>
                </div>
              </div>
            </div>

          </div>

  {/* Coluna Direita - Stats Fora */}
  <div className="hidden lg:flex flex-col justify-center gap-6 w-48">
  {sideFoul && (
    <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 shadow-[0_12px_35px_rgba(0,0,0,.25)]" role="status" aria-live="polite">
      <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" /> Falta marcada
      </div>
      <p className="text-xs leading-snug text-white/80">{sideFoul.text}</p>
      <p className="mt-1 text-[10px] font-bold tabular-nums text-white/40">{sideFoul.minute}&apos;</p>
    </div>
  )}
  <BigStat label="Posse" value={state.away?.possession ?? 50} side="right" />
  <BigStat label="Chutes" value={state.away?.shots ?? 0} side="right" />
  <BigStat label="No alvo" value={state.away?.shotsOnTarget ?? 0} side="right" />
  </div>
        </div>

        {/* Barra de Acoes - Rodape */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0a1515]/80 backdrop-blur-sm px-4 sm:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Controles da partida */}
              {state.phase === "pre" && (
                <Button
                  size="sm"
                  onClick={start}
                  className="text-xs bg-[#00ffc8] text-black hover:bg-[#00ffc8]/80 font-bold"
                >
                  <Play className="mr-1 h-3.5 w-3.5 fill-current" />
                  INICIAR
                </Button>
              )}
              {isMatchInProgress && (
                <>
                  {isRunning ? (
                    <Button size="sm" onClick={pause} variant="ghost" className="text-xs text-white/70 hover:text-white hover:bg-white/10">
                      <Pause className="mr-1 h-3.5 w-3.5" />
                      PAUSAR
                    </Button>
                  ) : (
                    <Button size="sm" onClick={resume} className="text-xs bg-[#00ffc8] text-black hover:bg-[#00ffc8]/80 font-bold">
                      <Play className="mr-1 h-3.5 w-3.5 fill-current" />
                      CONTINUAR
                    </Button>
                  )}
                </>
              )}

              {/* Advance Button */}
              <button
                type="button"
                onClick={fastForward}
                disabled={state.phase === "fulltime"}
                className="flex items-center gap-2 hover:text-white disabled:opacity-40 disabled:hover:text-white/60 transition-colors"
              >
                <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/50 font-bold">X</span>
                <span className="text-white/60 text-sm">Avancar</span>
              </button>

              {/* Substituicao sempre visivel durante o jogo (teclado T / Y-Triangulo). */}
              {isMatchInProgress && (
                <button
                  type="button"
                  onClick={() => { pause(); setShowSubModal(true) }}
                  disabled={subsRemaining <= 0}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35"
                >
                  <span className="rounded bg-[#00ffc8]/15 px-2 py-1 text-[10px] font-black text-[#00ffc8]">T</span>
                  <ArrowDownUp className="h-3.5 w-3.5 text-[#00ffc8]" />
                  <span className="text-sm">Substituir ({subsRemaining})</span>
                </button>
              )}

              {/* Post-Match Interview */}
              {state.phase === "fulltime" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/50">
                    <Triangle className="w-3 h-3 fill-current" />
                  </span>
                  <span className="text-white/60 text-sm">Coletiva pos-jogo</span>
                </div>
              )}
            </div>

            {/* Velocidade */}
            <div className="hidden sm:flex items-center gap-2">
              {SPEEDS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSpeed(s.id)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-bold rounded transition",
                    speed === s.id
                      ? "bg-[#00ffc8] text-black"
                      : "bg-white/10 text-white/50 hover:bg-white/20"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Substituição */}
      {showSubModal && (
        <SubstitutionModal
          open={showSubModal}
          team={userTeamForSub}
          starters={userStarters}
          bench={userBench}
          subsRemaining={subsRemaining}
          onClose={() => setShowSubModal(false)}
          onConfirm={handleSub}
        />
      )}

      {/* Modal de Resultado — usa os times congelados no apito final */}
      {showResult && (
        <MatchResultModal
          open={showResult}
          homeTeam={finalMatch?.home ?? homeTeam}
          awayTeam={finalMatch?.away ?? awayTeam}
          state={state}
          userSide={finalMatch?.userSide ?? userSide}
          isFinal={false}
          isChampion={isLeagueChampion}
          onClose={() => {
            setShowResult(false)
            // Ordem obrigatoria: placar/estatisticas -> resultados da rodada -> imprensa.
            // A base tambem passa pela tela para manter a experiencia igual ao profissional.
            setShowRoundResults(true)
          }}
        />
      )}

  {/* Resultados de toda a rodada (todas as competicoes) antes da coletiva */}
  {showRoundResults && (
    <RoundResultsModal
      open={showRoundResults}
      results={postMatchRoundResults}
      userHome={(finalMatch?.home ?? homeTeam).curto}
      userAway={(finalMatch?.away ?? awayTeam).curto}
      onContinue={() => {
        setShowRoundResults(false)
        setShowPressConference(true)
      }}
    />
  )}

  {/* Coletiva pos-jogo */}
  {showPressConference && (
    <PostMatchPress
      isOpen={showPressConference}
      homeTeam={finalMatch?.home ?? homeTeam}
      awayTeam={finalMatch?.away ?? awayTeam}
      homeGoals={state.home.goals}
      awayGoals={state.away.goals}
      userSide={finalMatch?.userSide ?? userSide}
      onClose={() => setShowPressConference(false)}
      // Artilheiros do MEU time nesta partida: alimentam as perguntas
      // individuais da coletiva (elogiar/cobrar alguem de verdade).
      atletasDaPartida={(() => {
        const meuLado = finalMatch?.userSide ?? userSide
        const golsPorAtleta = new Map<string, number>()
        for (const e of state.events) {
          if (e.type !== "goal" || e.side !== meuLado || !e.player) continue
          golsPorAtleta.set(e.player, (golsPorAtleta.get(e.player) ?? 0) + 1)
        }
        return [...golsPorAtleta.entries()].map(([nome, gols]) => ({ nome, gols }))
      })()}
      onComplete={async ({ moraleImpact, tons, repercussoes }) => {
        setShowPressConference(false)

        // A coletiva agora TEM consequencia. O callback recebia o saldo das
        // respostas e ignorava o valor: escolher "vou cobrar no vestiario" ou
        // "o grupo esta de parabens" dava exatamente no mesmo lugar.
        const userGoals = (finalMatch?.userSide ?? userSide) === "home" ? state.home.goals : state.away.goals
        const rivalGoals = (finalMatch?.userSide ?? userSide) === "home" ? state.away.goals : state.home.goals
        const efeito = calcularEfeitoColetiva({
          moraleImpact,
          tons,
          venceu: userGoals > rivalGoals,
          perdeu: userGoals < rivalGoals,
        })

        if (efeito.moralDelta !== 0 || efeito.diretoriaDelta !== 0) {
          const atual = loadGameState()
          setSavedGame({
            teamMorale: Math.max(0, Math.min(100, (atual.teamMorale ?? 65) + efeito.moralDelta)),
            boardConfidence: Math.max(0, Math.min(100, (atual.boardConfidence ?? 60) + efeito.diretoriaDelta)),
          })
        }
        // O jogador precisa VER a consequencia; senao o efeito existe e passa
        // despercebido, que na pratica e o mesmo que nao existir.
        if (efeito.recadoElenco) {
          addNotification({ type: "system", priority: efeito.moralDelta > 0 ? "medium" : "high",
            title: efeito.recadoElenco.titulo, message: efeito.recadoElenco.texto })
        }
        if (efeito.recadoDiretoria) {
          addNotification({ type: "system", priority: efeito.diretoriaDelta > 0 ? "medium" : "high",
            title: efeito.recadoDiretoria.titulo, message: efeito.recadoDiretoria.texto })
        }
        // RECADO DE CADA ATLETA CITADO na coletiva (pedido: elogiar o Memphis
        // gera mensagem dele). Elogio agrada, cobranca publica magoa.
        for (const r of repercussoes ?? []) {
          addNotification({
            type: "news", priority: r.tom === "cobranca" ? "high" : "medium",
            title: r.titulo, message: r.mensagem,
          })
        }

        // O save so pode liberar a tela depois que resultado, rodada e motor foram
        // confirmados no disco. O href direto quebrava no build Tauri (ERR_FILE_NOT_FOUND)
        // e podia matar o autosave ainda pendente.
        if (postMatchAdvance.current) await postMatchAdvance.current
        persistGameEngineNow()
        await flushPersistentStore()
        await saveGameStateAndFlush(loadGameState())
        // REARMA o portao da caixa de entrada: ele so dispara uma vez por sessao
        // do app, mas o usuario quer a Central SEMPRE apos a partida — e e depois
        // do jogo que chegam os recados do elenco, da diretoria e do mercado.
        try { sessionStorage.removeItem("ultrafoot:inbox-gate-shown") } catch { /* ignora */ }
        // Pos-partida vai ao PRE-OFFICE (pedido), nao ao escritorio direto: e
        // la que ficam o resumo da rodada, as tarefas e o proximo compromisso.
        hardNavigate(matchCtx.youth ? "/base/carreira" : "/pre-office")
      }}
    />
  )}

  {/* Animacoes de eventos */}
  <EventAnimation
    event={currentAnimation?.type ?? null}
    team={currentAnimation?.team}
    player={currentAnimation?.player}
    minute={currentAnimation?.minute}
    onComplete={handleAnimationComplete}
  />

  {/* Modal de selecao de batedor de penalti */}
  <PenaltyTakerModal
    isOpen={showPenaltyModal}
    team={userSide === "home" ? homeTeam : awayTeam}
    players={userSide === "home" ? homeSquad : awaySquad}
    onSelectPlayer={(p) => handlePenaltyTaker(p as unknown as MatchPlayer)}
    onFinish={handlePenaltyFinish}
    onClose={() => {
      // Fechar sem escolher NAO pode congelar a partida: o relogio so anda quando o
      // penalti pendente e resolvido. Passando null, o motor escolhe o batedor.
      takePenalty(null)
      handlePenaltyFinish()
    }}
  />
  </div>
  )
}
