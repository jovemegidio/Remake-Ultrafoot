"use client"

import Link from "next/link"
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
} from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { getPlayersForTeam, sortByPosition, type Player } from "@/lib/players-data"
import { clearMatchContext, loadMatchContext } from "@/lib/match-context"
import { useMatchSimulation } from "@/hooks/use-match-simulation"
import { getActionForButton, type GameContext } from "@/lib/gamepad-controls"
import { useGamepad, type GamepadButtonName } from "@/hooks/use-gamepad"
import { useGameManager } from "@/lib/use-game-manager"
import { useDiscordRPC } from "@/hooks/use-discord-rpc"
import { useTranslation } from "@/lib/i18n"
import { useGameEngine, type Player as EnginePlayer } from "@/lib/game-engine"
import {
  type MatchSpeed,
  type MatchEvent,
  type MatchState,
} from "@/lib/match-engine"
import { LivePitch } from "@/components/match/live-pitch"
import { SubstitutionModal, type MatchPlayer } from "@/components/match/substitution-modal"
import { MatchResultModal } from "@/components/match/match-result-modal"
import { PostMatchPress } from "@/components/match/post-match-press"
import { EventAnimation, type AnimatableEvent } from "@/components/match/event-animations"
import { PenaltyTakerModal } from "@/components/match/penalty-taker-modal"
import { MatchRadar } from "@/components/match/match-radar"
import { useMatchSounds } from "@/hooks/use-match-sounds"

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

const POSITION_ORDER: Record<string, number> = {
  GOL: 0, LD: 1, ZAG: 2, LE: 3, VOL: 4, MEI: 5, PD: 6, PE: 7, ATA: 8,
}

// Hash determinístico por nome de jogador — elimina Math.random() nos atributos
function playerHash(name: string, seed: number): number {
  let h = seed
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

function playersToMatchSquad(players: Player[], idOffset = 0): { starters: MatchPlayer[]; bench: MatchPlayer[] } {
  const sorted = sortByPosition(players)
  const starters: MatchPlayer[] = sorted.slice(0, 11).map((p, i) => {
    const h = (seed: number) => playerHash(p.nome, seed)
    const isGK = p.pos === "GOL"
    const isAtt = ["ATA", "PE", "PD"].includes(p.pos)
    return {
      id: idOffset + i + 1,
      name: p.nome,
      number: POSITION_NUMBER_MAP[p.pos] ?? i + 1,
      position: p.pos,
      rating: p.base,
      stamina: 100,
      pace:      isGK ? 50 : 65 + (h(1) % 25),
      shooting:  isGK ? 20 : 50 + (h(2) % 35),
      passing:   55 + (h(3) % 30),
      dribbling: isGK ? 30 : 50 + (h(4) % 35),
      defending: isAtt ? 30 + (h(5) % 20) : 60 + (h(6) % 25),
      physical:  60 + (h(7) % 25),
    }
  })
  const bench: MatchPlayer[] = sorted.slice(11, 18).map((p, i) => ({
    id: idOffset + 100 + i + 1,
    name: p.nome,
    number: 12 + i,
    position: p.pos,
    rating: p.base,
    stamina: 100,
  }))
  return { starters, bench }
}

// Converte jogadores do game-engine para MatchPlayer
function enginePlayersToMatchSquad(players: EnginePlayer[], idOffset = 0): { starters: MatchPlayer[]; bench: MatchPlayer[] } {
  const available = players
    .filter(p => !p.injury && !p.calledUp)
    .sort((a, b) => {
      const aStarter = a.isStarter === true ? 0 : a.isStarter === false ? 2 : 1
      const bStarter = b.isStarter === true ? 0 : b.isStarter === false ? 2 : 1
      if (aStarter !== bStarter) return aStarter - bStarter
      return (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9)
    })

  const starters: MatchPlayer[] = available.slice(0, 11).map((p, i) => ({
    id: idOffset + i + 1,
    name: p.name,
    number: p.shirtNumber ?? POSITION_NUMBER_MAP[p.position] ?? i + 1,
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

  const bench: MatchPlayer[] = available.slice(11, 18).map((p, i) => ({
    id: idOffset + 100 + i + 1,
    name: p.name,
    number: p.shirtNumber ?? 12 + i,
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
  const { team: _userTeamHook } = useUserTeam()
  const userTeamId = _userTeamHook.curto
  const { currentMatch, registerUserMatchResult, advanceWeek } = useGameManager()
  const { squadPlayers: enginePlayers } = useGameEngine()
  const resultRegistered = useRef(false)
  const t = useTranslation()

  // Hydration guard
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  // Carrega contexto da partida salva ou usa valores padrao
  const matchCtx = useMemo(() => loadMatchContext(), [])

  // Determina times a partir do contexto salvo
  const homeTeam = useMemo(() => {
    if (currentMatch) return currentMatch.homeTeam
    if (matchCtx.homeShort) return getTeamByShort(matchCtx.homeShort) ?? serieATeams[0]
    return getTeamByShort(userTeamId ?? "") ?? serieATeams[0]
  }, [currentMatch, matchCtx.homeShort, userTeamId])

  const awayTeam = useMemo(() => {
    if (currentMatch) return currentMatch.awayTeam
    if (matchCtx.awayShort) return getTeamByShort(matchCtx.awayShort) ?? serieATeams[1]
    return serieATeams.find(t => t.curto !== homeTeam.curto) ?? serieATeams[1]
  }, [currentMatch, matchCtx.awayShort, homeTeam.curto])

  const displayCompetition = currentMatch?.competition || matchCtx.competition || "Brasileirao Serie A"
  const displayRound = currentMatch ? `Rodada ${currentMatch.round}` : (matchCtx.round || "Rodada 1")

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
    if (enginePlayers && enginePlayers.length > 0) {
      const userSquad = enginePlayersToMatchSquad(enginePlayers, isHome ? 0 : 200)
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
  }, [enginePlayers, homeTeam.curto, awayTeam.curto, isHome])

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

  // Config da simulacao
  const config = useMemo(() => ({
    homeTeam,
    awayTeam,
    homeRating: homeTeam.prestigio,
    awayRating: awayTeam.prestigio,
    homeSquad: homeSquad.map(toSquadPlayer),
    awaySquad: awaySquad.map(toSquadPlayer),
    durationMinutes: matchCtx.duration,
  }), [homeTeam, awayTeam, homeSquad, awaySquad, matchCtx.duration])

  const sim = useMatchSimulation(config)
  const { state, speed, isRunning, start, pause, resume, reset, setSpeed, fastForward } = sim

  // Discord Rich Presence
  useDiscordRPC(state, homeTeam, awayTeam)

  // Sons da partida
  const { play: playSound } = useMatchSounds()
  const lastSoundEventId = useRef<string | null>(null)
  const lastPhase = useRef<string | null>(null)

  // Som por mudança de fase (apito de início/intervalo/fim)
  useEffect(() => {
    if (!hydrated) return
    if (lastPhase.current === state.phase) return
    lastPhase.current = state.phase
    if (state.phase === "first") playSound("apito_inicio")
    else if (state.phase === "halftime") playSound("apito_intervalo")
    else if (state.phase === "fulltime") playSound("apito_fim")
  }, [state.phase, hydrated, playSound])

  // Som por evento (gol, falta, cartão, etc.)
  useEffect(() => {
    if (state.events.length === 0) return
    const last = state.events[state.events.length - 1]
    const id = `snd-${last.type}-${last.minute}-${last.side}`
    if (lastSoundEventId.current === id) return
    lastSoundEventId.current = id
    switch (last.type) {
      case "goal":    playSound("gol"); break
      case "foul":    playSound("apito_falta"); break
      case "yellow_card": playSound("cartao_amarelo"); break
      case "red_card":    playSound("cartao_vermelho"); break
      case "penalty":     playSound("penalti"); break
      case "sub":         playSound("substituicao"); break
    }
  }, [state.events, playSound])

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
  const [activeTab, setActiveTab] = useState<"pitch" | "fitness" | "ratings" | "stats" | "gameplan">("stats")

  // Estado para animacoes de eventos
  const [currentAnimation, setCurrentAnimation] = useState<{
    type: AnimatableEvent
    team?: typeof homeTeam
    player?: string
    minute?: number
  } | null>(null)

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
    
    const lastEvent = state.events[state.events.length - 1]
    const eventId = `${lastEvent.type}-${lastEvent.minute}-${lastEvent.side}`
    
    // Evita processar o mesmo evento duas vezes
    if (lastProcessedEventId.current === eventId) return
    lastProcessedEventId.current = eventId

    const animatableTypes: AnimatableEvent[] = ["goal", "penalty", "yellow_card", "red_card", "foul", "var"]
    
    if (animatableTypes.includes(lastEvent.type as AnimatableEvent)) {
      const eventTeam = lastEvent.side === "home" ? homeTeam : awayTeam
      
      // Se for penalti a favor do usuario, mostra modal de selecao
      if (lastEvent.type === "penalty" && lastEvent.side === userSide) {
        pause()
        setShowPenaltyModal(true)
        setPendingPenalty({ side: lastEvent.side, minute: lastEvent.minute })
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

  // Handler para quando o usuario seleciona batedor de penalti
  const handlePenaltyTaker = (player: MatchPlayer) => {
    setShowPenaltyModal(false)
    
    // Mostra animacao do penalti
    setCurrentAnimation({
      type: "penalty",
      team: userSide === "home" ? homeTeam : awayTeam,
      player: player.name,
      minute: pendingPenalty?.minute
    })
    
    setPendingPenalty(null)
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
        if (state.phase === "pre") { start(); return }
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
  }, [isRunning, pause, resume, start, state.phase])

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
  const [showPressConference, setShowPressConference] = useState(false)
  const [isLeagueChampion, setIsLeagueChampion] = useState(false)
  // Congela os times do confronto no apito final, ANTES de advanceWeek mudar o
  // currentMatch para a proxima partida (senao o modal mostra o adversario errado).
  const [finalMatch, setFinalMatch] = useState<{ home: Team; away: Team; userSide: "home" | "away" } | null>(null)

  useEffect(() => {
    if (state.phase === "fulltime" && !showResult) {
      if (!resultRegistered.current) {
        resultRegistered.current = true
        // Snapshot dos times ANTES de avancar a semana (que troca o currentMatch)
        setFinalMatch({ home: homeTeam, away: awayTeam, userSide })
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
        clearMatchContext()
        advanceWeek().then(result => {
          if (result && "leagueChampion" in result && result.leagueChampion) {
            const champ = result.leagueChampion
            localStorage.setItem("ultrafoot-pending-champion", JSON.stringify({
              competition: champ.competition,
              season: champ.season,
              type: "league",
              stats: champ.stats,
            }))
            setIsLeagueChampion(true)
          }
        }).catch(() => {})
      }
      const t = setTimeout(() => setShowResult(true), 1200)
      return () => clearTimeout(t)
    }
  }, [state.phase, showResult, state.events, state.home.goals, state.away.goals, homeTeam.curto, awayTeam.curto, registerUserMatchResult, advanceWeek])

  // Stamina drena por minuto
  useEffect(() => {
    if (state.phase !== "first" && state.phase !== "second") return
    setHomeSquad(prev => prev.map(p => ({ ...p, stamina: Math.max(0, p.stamina - 1.1) })))
    setAwaySquad(prev => prev.map(p => ({ ...p, stamina: Math.max(0, p.stamina - 1.1) })))
  }, [state.minute, state.phase])

  // Substituição
  const userStarters = userSide === "home" ? homeSquad : awaySquad
  const userBench = userSide === "home" ? homeBench : awayBench
  const userTeamForSub = userSide === "home" ? homeTeam : awayTeam

  const handleSub = (out: MatchPlayer, inPlayer: MatchPlayer) => {
    if (subsRemaining <= 0) return
    const setStarters = userSide === "home" ? setHomeSquad : setAwaySquad
    const setBenchSet = userSide === "home" ? setHomeBench : setAwayBench
    setStarters(prev => prev.map(p => p.id === out.id ? { ...inPlayer } : p))
    setBenchSet(prev => prev.filter(p => p.id !== inPlayer.id))
    setSubsRemaining(s => s - 1)
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

  // Acrescimos
  const extraTime = state.minute > 45 && state.minute <= 47 
    ? `+${state.minute - 45}` 
    : state.minute > 90 
      ? `+${state.minute - 90}` 
      : null

  return (
    <div className={cn(
      "min-h-screen flex flex-col",
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
      <div className="flex-1 flex flex-col relative overflow-y-auto">

        {/* Liga Badge - Topo Central */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a]/80 backdrop-blur-sm border border-white/10">
            <span className="text-white text-sm font-bold">{displayCompetition}</span>
          </div>
        </div>

        {/* Header do Placar */}
        <header className="relative z-10 pt-16 pb-4 px-4 sm:px-8">
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
                  {state.minute > 90 ? "90" : state.minute}&apos;00
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
        <div className="flex-1 flex px-4 sm:px-8 pb-4 gap-4 sm:gap-8 min-h-0">
          
  {/* Coluna Esquerda - Stats Casa */}
  <div className="hidden lg:flex flex-col justify-center gap-8 w-48">
  <BigStat label="Posse" value={state.home?.possession ?? 50} side="left" />
  <BigStat label="Chutes" value={state.home?.shots ?? 0} side="left" />
  <BigStat label="No alvo" value={state.home?.shotsOnTarget ?? 0} side="left" />
  </div>

          {/* Coluna Central - Conteudo baseado na Tab ativa */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 rounded-2xl bg-[#1a2a2a]/60 backdrop-blur-sm border border-white/[0.06] overflow-hidden flex flex-col">
              
              {/* Conteudo da Tab */}
              <div className="flex-1 overflow-y-auto p-4">
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

                {activeTab === "pitch" && (
                  <div className="space-y-3">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">{t.match.live.sectionPitch}</h3>
                    <MatchRadar
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      homeSquad={homeSquad}
                      awaySquad={awaySquad}
                      homePossession={state.home?.possession ?? 50}
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
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Formacao Casa */}
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <TeamCrest team={homeTeam} size="xs" />
                          <span className="text-white text-sm font-medium">{homeTeam.curto}</span>
                        </div>
                        <div className="text-[#00ffc8] text-lg font-bold">4-3-3</div>
                        <div className="text-white/40 text-xs mt-1">Posse: Equilibrado</div>
                        <div className="text-white/40 text-xs">Mentalidade: Normal</div>
                      </div>

                      {/* Formacao Fora */}
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <TeamCrest team={awayTeam} size="xs" />
                          <span className="text-white text-sm font-medium">{awayTeam.curto}</span>
                        </div>
                        <div className="text-[#00ffc8] text-lg font-bold">4-4-2</div>
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
                <div className="flex items-center justify-center gap-1 px-4 py-2">
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40 mr-2">L1</span>
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
  <div className="hidden lg:flex flex-col justify-center gap-8 w-48">
  <BigStat label="Posse" value={state.away?.possession ?? 50} side="right" />
  <BigStat label="Chutes" value={state.away?.shots ?? 0} side="right" />
  <BigStat label="No alvo" value={state.away?.shotsOnTarget ?? 0} side="right" />
  </div>
        </div>

        {/* Barra de Acoes - Rodape */}
        <div className="border-t border-white/[0.06] bg-[#0a1515]/80 backdrop-blur-sm px-4 sm:px-8 py-3">
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
      onComplete={(moraleImpact) => {
        setShowPressConference(false)
        // Navegar para a pagina de pre-jogo (dashboard/escritorio)
        window.location.href = "/"
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
    onClose={() => {
      setShowPenaltyModal(false)
      setPendingPenalty(null)
      resume()
    }}
  />
  </div>
  )
}
