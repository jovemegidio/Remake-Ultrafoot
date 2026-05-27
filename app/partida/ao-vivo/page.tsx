"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeft,
  Activity,
  Cloud,
  Users,
  CalendarDays,
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
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { getPlayersForTeam, sortByPosition, type Player } from "@/lib/players-data"
import { loadMatchContext } from "@/lib/match-context"
import { useMatchSimulation } from "@/hooks/use-match-simulation"
import { getActionForButton, type GameContext } from "@/lib/gamepad-controls"
import { useGamepad, type GamepadButtonName } from "@/hooks/use-gamepad"
import { useGameManager } from "@/lib/use-game-manager"
import { useDiscordRPC } from "@/hooks/use-discord-rpc"
import { useGameEngine, type Player as EnginePlayer } from "@/lib/game-engine"
import {
  type MatchSpeed,
  type MatchEvent,
  type MatchState,
} from "@/lib/match-engine"
import { LivePitch } from "@/components/match/live-pitch"
import { SubstitutionModal, type MatchPlayer } from "@/components/match/substitution-modal"
import { MatchResultModal } from "@/components/match/match-result-modal"

// ─────────────────────────────────────────────────────────────────────────────
// Mock players - usados como elenco padrão quando não houver squad real
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

function playersToMatchSquad(players: Player[], idOffset = 0): { starters: MatchPlayer[]; bench: MatchPlayer[] } {
  const sorted = sortByPosition(players)
  const starters: MatchPlayer[] = sorted.slice(0, 11).map((p, i) => ({
    id: idOffset + i + 1,
    name: p.nome,
    number: POSITION_NUMBER_MAP[p.pos] ?? i + 1,
    position: p.pos,
    rating: p.base,
    stamina: 100,
    pace: p.pos === "GOL" ? 50 : 65 + Math.floor(Math.random() * 25),
    shooting: p.pos === "GOL" ? 20 : 50 + Math.floor(Math.random() * 35),
    passing: 55 + Math.floor(Math.random() * 30),
    dribbling: p.pos === "GOL" ? 30 : 50 + Math.floor(Math.random() * 35),
    defending: p.pos === "ATA" || p.pos === "PE" || p.pos === "PD" ? 30 + Math.floor(Math.random() * 20) : 60 + Math.floor(Math.random() * 25),
    physical: 60 + Math.floor(Math.random() * 25),
  }))
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

// Converte jogadores do game-engine (com atributos reais) para MatchPlayer
function enginePlayersToMatchSquad(players: EnginePlayer[], idOffset = 0): { starters: MatchPlayer[]; bench: MatchPlayer[] } {
  const available = players
    .filter(p => !p.injury && !p.calledUp)
    .sort((a, b) => {
      // Manual starters come first; fall back to position order
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

// Deriva formação tática a partir do elenco titular
function deriveFormation(players: MatchPlayer[]): string {
  const def = players.filter(p => ["ZAG", "LD", "LE", "ZD", "ZE"].includes(p.position)).length
  const mid = players.filter(p => ["VOL", "MEI", "MCO", "MC"].includes(p.position)).length
  const att = players.filter(p => ["ATA", "PE", "PD", "SA"].includes(p.position)).length
  if (def > 0 || mid > 0 || att > 0) return `${def}-${mid}-${att}`
  return "4-3-3"
}

// ─────────────────────────────────────────────────────────────────────────────
// Velocidades
// ─────────────────────────────────────────────────────────────────────────────

const SPEEDS: { id: MatchSpeed; label: string; sublabel: string }[] = [
  { id: "slow", label: "LENTO", sublabel: "1x" },
  { id: "normal", label: "NORMAL", sublabel: "2x" },
  { id: "fast", label: "RÁPIDO", sublabel: "5x" },
  { id: "ultra", label: "ULTRA", sublabel: "12x" },
  { id: "hyper", label: "HIPER", sublabel: "30x" },
]

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function MatchCenterPage() {
  const { team: userTeam, hydrated } = useUserTeam()
  const { registerUserMatchResult, advanceWeek } = useGameManager()
  const { squadPlayers } = useGameEngine()

  // Flag para evitar duplo registro do resultado
  const resultRegistered = useRef(false)

  // Carrega contexto da partida
  const [matchCtx, setMatchCtx] = useState(() => loadMatchContext())
  useEffect(() => {
    setMatchCtx(loadMatchContext())
  }, [])

  // Determina mandante e visitante a partir do contexto
  const homeTeam: Team = useMemo(() => {
    return getTeamByShort(matchCtx.homeShort) || userTeam || serieATeams[0]
  }, [matchCtx.homeShort, userTeam])

  const awayTeam: Team = useMemo(() => {
    const t = getTeamByShort(matchCtx.awayShort)
    if (t) return t
    // Pega outro time qualquer diferente do home
    return serieATeams.find(t => t.curto !== homeTeam.curto) || serieATeams[1]
  }, [matchCtx.awayShort, homeTeam])

  // O jogador está como mandante ou visitante?
  const userSide: "home" | "away" = userTeam.curto === awayTeam.curto ? "away" : "home"

  // Público do estádio — calculado uma única vez para evitar flicker por re-render
  const attendance = useMemo(
    () => Math.floor(homeTeam.estadio_cap * (0.6 + Math.random() * 0.35)),
    [homeTeam.estadio_cap]
  )

  // Partículas de gol — posições fixas para evitar reposicionamento a cada render
  const goalParticles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: 10 + Math.random() * 80,
        top: 10 + Math.random() * 80,
        delay: Math.random() * 0.5,
      })),
    []
  )

  // Inicia polling do gamepad para que eventos sejam despachados via window
  useGamepad()

  // Squads — inicializados com mocks, substituídos por dados reais via useEffect
  const [homeSquad, setHomeSquad] = useState<MatchPlayer[]>(() => buildSquad(0, ""))
  const [awaySquad, setAwaySquad] = useState<MatchPlayer[]>(() => buildSquad(200, ""))
  const [homeBench, setHomeBench] = useState<MatchPlayer[]>(() => buildBench(100, ""))
  const [awayBench, setAwayBench] = useState<MatchPlayer[]>(() => buildBench(300, ""))

  // Carrega jogadores reais quando os times forem resolvidos
  // Para o time do usuario: usa o elenco real do game-engine (reflete transfers, treinos e lesoes)
  // Para o adversario: usa os dados de seed do banco de jogadores
  useEffect(() => {
    const isUserHome = userTeam.curto === homeTeam.curto

    if (isUserHome && squadPlayers.length >= 11) {
      const { starters, bench } = enginePlayersToMatchSquad(squadPlayers, 0)
      setHomeSquad(starters)
      setHomeBench(bench)
    } else {
      const homePlayers = getPlayersForTeam(homeTeam)
      if (homePlayers.length >= 11) {
        const { starters, bench } = playersToMatchSquad(homePlayers, 0)
        setHomeSquad(starters)
        setHomeBench(bench)
      }
    }

    const isUserAway = userTeam.curto === awayTeam.curto
    if (isUserAway && squadPlayers.length >= 11) {
      const { starters, bench } = enginePlayersToMatchSquad(squadPlayers, 200)
      setAwaySquad(starters)
      setAwayBench(bench)
    } else {
      const awayPlayers = getPlayersForTeam(awayTeam)
      if (awayPlayers.length >= 11) {
        const { starters, bench } = playersToMatchSquad(awayPlayers, 200)
        setAwaySquad(starters)
        setAwayBench(bench)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeTeam.nome, awayTeam.nome, userTeam.curto, squadPlayers])

  // Configuração da simulação
  const config = useMemo(() => ({
    homeTeam,
    awayTeam,
    homeRating: Math.round(homeSquad.reduce((s, p) => s + p.rating, 0) / homeSquad.length),
    awayRating: Math.round(awaySquad.reduce((s, p) => s + p.rating, 0) / awaySquad.length),
    durationMinutes: matchCtx.duration,
    weatherFactor: matchCtx.weather === "rain" ? 0.9 : 1,
    homeSquad: homeSquad.map(p => ({
      nome: p.name,
      pos: p.position,
      rating: p.rating,
      shooting: p.shooting,
      passing: p.passing,
      dribbling: p.dribbling,
      defending: p.defending,
      physical: p.physical,
      pace: p.pace,
      stamina: p.stamina,
    })),
    awaySquad: awaySquad.map(p => ({
      nome: p.name,
      pos: p.position,
      rating: p.rating,
      shooting: p.shooting,
      passing: p.passing,
      dribbling: p.dribbling,
      defending: p.defending,
      physical: p.physical,
      pace: p.pace,
      stamina: p.stamina,
    })),
  }), [homeTeam, awayTeam, homeSquad, awaySquad, matchCtx.duration, matchCtx.weather])

  const sim = useMatchSimulation(config)
  const { state, speed, isRunning, start, pause, resume, reset, setSpeed, fastForward } = sim

  // Discord Rich Presence — mostra time da casa x visitante + placar no Discord
  useDiscordRPC(state, homeTeam, awayTeam)

  // Determina contexto atual da partida
  const gameContext: GameContext = state.phase === "pre" 
    ? "match_preview" 
    : state.phase === "fulltime" 
      ? "menu"
      : isRunning 
        ? "match_live" 
        : "match_paused"

  // Modal substituição - declarado antes dos useEffects que o utilizam
  const [showSubModal, setShowSubModal] = useState(false)
  const [subsRemaining, setSubsRemaining] = useState(5)

  // Handler de teclado (ESC para pausar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.phase !== "pre" && state.phase !== "fulltime") {
          if (isRunning) pause()
          else resume()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isRunning, pause, resume, state.phase])

  // Handler de gamepad com mapeamento completo de botoes
  useEffect(() => {
    const handleGamepadButton = (e: CustomEvent<{ button: GamepadButtonName }>) => {
      const button = e.detail.button
      const action = getActionForButton(button, gameContext)
      
      if (!action) return

      // Executa acao baseada no mapeamento
      switch (action) {
        // Controle de partida
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
        case "slow_motion":
          if (speed === "hyper") setSpeed("ultra")
          else if (speed === "ultra") setSpeed("fast")
          else if (speed === "fast") setSpeed("normal")
          else if (speed === "normal") setSpeed("slow")
          break
        case "skip_to_result":
          fastForward()
          break
        case "substitute":
          if (subsRemaining > 0 && state.phase !== "fulltime") {
            setShowSubModal(true)
          }
          break
        case "show_stats":
          // Scroll para estatisticas
          document.querySelector('[data-section="stats"]')?.scrollIntoView({ behavior: "smooth" })
          break
        case "confirm":
          if (state.phase === "pre") start()
          break
        case "back":
          if (showSubModal) setShowSubModal(false)
          break
      }
    }

    // Escuta eventos de botao do gamepad
    window.addEventListener("gamepad:button" as any, handleGamepadButton)
    return () => window.removeEventListener("gamepad:button" as any, handleGamepadButton)
  }, [gameContext, isRunning, pause, resume, speed, setSpeed, fastForward, start, subsRemaining, state.phase, showSubModal])

  // Modal de fim
  const [showResult, setShowResult] = useState(false)
  const [isLeagueChampion, setIsLeagueChampion] = useState(false)
  useEffect(() => {
    if (state.phase === "fulltime" && !showResult) {
      // Registra o resultado no jogo uma unica vez
      if (!resultRegistered.current) {
        resultRegistered.current = true
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
      // Mostra após pequena pausa para ver placar final
      const t = setTimeout(() => setShowResult(true), 1200)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, showResult])

  // Stamina drena por minuto de jogo (independente da velocidade de simulação)
  // 100 stamina / 90 minutos = ~1.1 por minuto para esgotar totalmente
  useEffect(() => {
    if (state.phase !== "first" && state.phase !== "second") return
    setHomeSquad(prev =>
      prev.map(p => ({
        ...p,
        stamina: Math.max(0, p.stamina - 1.1),
      }))
    )
    setAwaySquad(prev =>
      prev.map(p => ({
        ...p,
        stamina: Math.max(0, p.stamina - 1.1),
      }))
    )
  }, [state.minute, state.phase])

  // Animação de gol/cartão (durante 2.5s)
  const [animation, setAnimation] = useState<{ type: "goal" | "card"; side: "home" | "away"; cardColor?: "yellow" | "red" } | null>(null)
  useEffect(() => {
    if (!state.flash) return
    if (state.flash.type === "goal") {
      setAnimation({ type: "goal", side: state.flash.side })
      const t = setTimeout(() => setAnimation(null), 2500)
      return () => clearTimeout(t)
    }
    if (state.flash.type === "card") {
      setAnimation({ type: "card", side: state.flash.side, cardColor: state.flash.cardColor })
      const t = setTimeout(() => setAnimation(null), 2000)
      return () => clearTimeout(t)
    }
  }, [state.flash])

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

  // Selected pitch player
  const [selectedPitchPlayer, setSelectedPitchPlayer] = useState<number | null>(null)

  if (!hydrated) {
    return (
      <div className="h-screen pl-16 bg-[#050508] flex items-center justify-center text-white/40 text-sm">
        Carregando partida...
      </div>
    )
  }

  // Durante a partida ao vivo, ocultar a sidebar para evitar reinicio
  const isMatchInProgress = state.phase === "first" || state.phase === "second" || state.phase === "halftime"

  return (
    <div className={cn("h-screen bg-[#050508] flex flex-col overflow-hidden", !isMatchInProgress && "pl-16")}>
      {/* Sidebar oculta durante a partida */}
      {!isMatchInProgress && <GameSidebar />}

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.04] bg-[#050508]/95 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3">
          {/* Botao de voltar oculto durante a partida para evitar saida acidental */}
          {!isMatchInProgress && (
            <Link
              href="/partida"
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5 transition text-white/60 hover:text-white"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
          <h1 className="text-xl font-semibold text-white">Partida</h1>
          {state.phase !== "fulltime" && state.phase !== "pre" && (
            <span className="ml-2 flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-medium tracking-wider text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              AO VIVO
            </span>
          )}
          {state.phase === "fulltime" && (
            <span className="ml-2 px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-medium tracking-wider text-white/70">
              ENCERRADA
            </span>
          )}
          <span className="ml-2 px-2 py-1 rounded bg-white/10 text-xs font-bold text-white tabular-nums">
            {state.minute}&apos;
          </span>
        </div>

        <div className="flex items-center gap-2">
          {state.phase === "pre" && (
            <Button
              size="sm"
              onClick={start}
              className="text-xs bg-[#00ffc8] text-black hover:bg-[#00c8ff] font-bold tracking-wider"
            >
              <Play className="mr-1 h-3.5 w-3.5 fill-current" />
              INICIAR
            </Button>
          )}
          {(state.phase === "first" || state.phase === "second" || state.phase === "halftime") && (
            <>
              {isRunning ? (
                <Button size="sm" onClick={pause} variant="outline" className="text-xs border-white/10 bg-transparent text-white/80 hover:bg-white/5">
                  <Pause className="mr-1 h-3.5 w-3.5 fill-current" />
                  PAUSAR
                </Button>
              ) : (
                <Button size="sm" onClick={resume} className="text-xs bg-[#00ffc8] text-black hover:bg-[#00c8ff] font-bold">
                  <Play className="mr-1 h-3.5 w-3.5 fill-current" />
                  CONTINUAR
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={fastForward} className="text-xs border-white/10 bg-transparent text-white/80 hover:bg-white/5">
                <FastForward className="mr-1 h-3.5 w-3.5" />
                FIM
              </Button>
            </>
          )}
          {state.phase === "fulltime" && (
            <Button size="sm" variant="outline" onClick={reset} className="text-xs border-white/10 bg-transparent text-white/80 hover:bg-white/5">
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              REJOGAR
            </Button>
          )}
        </div>
      </header>

      <main className="space-y-4 p-4">
        {/* Animacao de gol - Estilo Broadcast Profissional */}
        {animation?.type === "goal" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
            {/* Flash branco inicial */}
            <div className="absolute inset-0 bg-white animate-goal-flash" />
            
            {/* Background escuro com vinheta */}
            <div 
              className="absolute inset-0 animate-goal-bg-in"
              style={{
                background: `
                  radial-gradient(ellipse 80% 50% at 50% 50%, transparent 0%, rgba(0,0,0,0.98) 100%),
                  linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)
                `
              }}
            />
            
            {/* Linhas horizontais estilo TV */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
            }} />

            {/* Barra superior - Minuto */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 animate-goal-slide-down">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Gol aos</span>
                <span className="text-sm font-bold text-white tabular-nums">{state.minute}&apos;</span>
              </div>
            </div>

            {/* Container central */}
            <div className="relative flex flex-col items-center z-10">
              
              {/* Card principal do gol */}
              <div className="relative animate-goal-card-in">
                {/* Glow do time */}
                <div 
                  className="absolute -inset-8 rounded-3xl blur-3xl opacity-30 animate-pulse"
                  style={{ backgroundColor: animation.side === "home" ? homeTeam.cor1 : awayTeam.cor1 }}
                />
                
                {/* Card */}
                <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] rounded-2xl border border-white/10 overflow-hidden">
                  {/* Barra colorida do time no topo */}
                  <div 
                    className="h-1.5 w-full"
                    style={{ backgroundColor: animation.side === "home" ? homeTeam.cor1 : awayTeam.cor1 }}
                  />
                  
                  <div className="px-12 py-8 flex flex-col items-center gap-5">
                    {/* Escudo */}
                    <div className="relative">
                      <div 
                        className="absolute inset-0 blur-2xl opacity-40 scale-150"
                        style={{ backgroundColor: animation.side === "home" ? homeTeam.cor1 : awayTeam.cor1 }}
                      />
                      <div className="relative animate-goal-badge-bounce">
                        <TeamCrest team={animation.side === "home" ? homeTeam : awayTeam} size="xl" />
                      </div>
                    </div>
                    
                    {/* Nome do time */}
                    <div className="text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-white tracking-wide uppercase">
                        {animation.side === "home" ? homeTeam.nome : awayTeam.nome}
                      </div>
                    </div>
                    
                    {/* Placar */}
                    <div className="flex items-center gap-6 px-8 py-4 rounded-xl bg-black/40 border border-white/[0.04]">
                      <div className="flex flex-col items-center gap-1">
                        <TeamCrest team={homeTeam} size="sm" />
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">{homeTeam.curto}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span 
                          className={cn(
                            "text-5xl sm:text-6xl font-black tabular-nums transition-all",
                            animation.side === "home" ? "text-white animate-goal-score-pop" : "text-white/60"
                          )}
                        >
                          {state.home.goals}
                        </span>
                        <span className="text-2xl text-white/20 font-light">-</span>
                        <span
                          className={cn(
                            "text-5xl sm:text-6xl font-black tabular-nums transition-all",
                            animation.side === "away" ? "text-white animate-goal-score-pop" : "text-white/60"
                          )}
                        >
                          {state.away.goals}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <TeamCrest team={awayTeam} size="sm" />
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">{awayTeam.curto}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Texto GOOOOL abaixo do card */}
              <div className="mt-6 animate-goal-text-slide">
                <div 
                  className="text-6xl sm:text-8xl font-black tracking-tighter uppercase"
                  style={{ 
                    color: animation.side === "home" ? homeTeam.cor1 : awayTeam.cor1,
                    textShadow: `0 0 40px ${animation.side === "home" ? homeTeam.cor1 : awayTeam.cor1}60`
                  }}
                >
                  GOOOL!
                </div>
              </div>
            </div>

            {/* Particulas sutis */}
            <div className="absolute inset-0 overflow-hidden">
              {goalParticles.map(p => (
                <div
                  key={p.id}
                  className="absolute w-1 h-1 rounded-full animate-goal-particle"
                  style={{
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    backgroundColor: animation.side === "home" ? homeTeam.cor1 : awayTeam.cor1,
                    animationDelay: `${p.delay}s`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Animação de cartão */}
        {animation?.type === "card" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/60 animate-fade-in" />
            <div className="relative animate-scale-in">
              <div
                className={cn(
                  "w-20 h-28 rounded-lg shadow-2xl",
                  animation.cardColor === "yellow" ? "bg-yellow-400" : "bg-red-500",
                )}
              />
              <div
                className={cn(
                  "absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm font-bold uppercase tracking-wider whitespace-nowrap",
                  animation.cardColor === "yellow" ? "text-yellow-400" : "text-red-500",
                )}
              >
                Cartão {animation.cardColor === "yellow" ? "Amarelo" : "Vermelho"}
              </div>
            </div>
          </div>
        )}

        {/* PLACAR */}
        <Scoreboard
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          state={state}
          competition={matchCtx.competition}
          weather={matchCtx.weather}
        />

        {/* CONTROLE DE VELOCIDADE */}
        <section className="rounded-xl border border-white/[0.04] bg-[#0c0c10] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Timer className="h-4 w-4 text-[#00ffc8]" />
              <span className="text-xs font-medium text-white/60 tracking-wider">VELOCIDADE</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {SPEEDS.map(s => {
                const active = speed === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSpeed(s.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-[10px] font-bold tracking-wider transition flex flex-col items-center min-w-[64px]",
                      active
                        ? "border-[#00ffc8] bg-[#00ffc8] text-black"
                        : "border-white/10 bg-[#1a1a1a] text-white/70 hover:border-white/20",
                    )}
                  >
                    <span>{s.label}</span>
                    <span className={cn("text-[9px] opacity-60", active && "opacity-80")}>{s.sublabel}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.04] bg-white/5 md:grid-cols-3 lg:grid-cols-6">
          <StatCell
            label="POSSE"
            home={`${state.home.possession}%`}
            away={`${state.away.possession}%`}
            icon={Activity}
            ratio={state.home.possession}
            homeColor={homeTeam.cor1}
            awayColor={awayTeam.cor1}
          />
          <StatCell
            label="FINALIZAÇÕES"
            home={state.home.shots}
            away={state.away.shots}
            icon={TargetIcon}
            ratio={ratioFor(state.home.shots, state.away.shots)}
            homeColor={homeTeam.cor1}
            awayColor={awayTeam.cor1}
          />
          <StatCell
            label="NO ALVO"
            home={state.home.shotsOnTarget}
            away={state.away.shotsOnTarget}
            icon={TargetIcon}
            ratio={ratioFor(state.home.shotsOnTarget, state.away.shotsOnTarget)}
            homeColor={homeTeam.cor1}
            awayColor={awayTeam.cor1}
          />
          <StatCell
            label="xG"
            home={state.home.xG.toFixed(2)}
            away={state.away.xG.toFixed(2)}
            icon={Sparkles}
            ratio={ratioFor(state.home.xG, state.away.xG)}
            homeColor={homeTeam.cor1}
            awayColor={awayTeam.cor1}
          />
          <StatCell
            label="ESCANTEIOS"
            home={state.home.corners}
            away={state.away.corners}
            icon={Flag}
            ratio={ratioFor(state.home.corners, state.away.corners)}
            homeColor={homeTeam.cor1}
            awayColor={awayTeam.cor1}
          />
          <StatCell
            label="FALTAS"
            home={state.home.fouls}
            away={state.away.fouls}
            icon={AlertTriangle}
            ratio={ratioFor(state.home.fouls, state.away.fouls)}
            homeColor={homeTeam.cor1}
            awayColor={awayTeam.cor1}
          />
        </section>

        {/* SUBSTITUIÇÃO BAR */}
        <section className="rounded-xl border border-white/[0.04] bg-[#0c0c10] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowSubModal(true)}
                disabled={subsRemaining === 0 || state.phase === "fulltime" || state.phase === "pre"}
                className="text-xs bg-[#00ffc8] text-black hover:bg-[#00c8ff] disabled:opacity-30 font-bold tracking-wider"
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                SUBSTITUIR
              </Button>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-bold tracking-wider",
                  subsRemaining > 2
                    ? "bg-[#00ffc8]/15 text-[#00ffc8]"
                    : subsRemaining > 0
                      ? "bg-yellow-400/15 text-yellow-400"
                      : "bg-red-400/15 text-red-400",
                )}
              >
                {subsRemaining}/5 RESTANTES
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/50">
              <span>
                Formação: <strong className="text-white">{deriveFormation(userSide === "home" ? homeSquad : awaySquad)}</strong>
              </span>
              <span>
                Sua moral:{" "}
                <strong className={(() => {
                  const userGoals = userSide === "home" ? state.home.goals : state.away.goals
                  const oppGoals = userSide === "home" ? state.away.goals : state.home.goals
                  if (userGoals > oppGoals) return "text-[#00ffc8]"
                  if (userGoals < oppGoals) return "text-red-400"
                  return "text-yellow-400"
                })()}>
                  {(() => {
                    const userGoals = userSide === "home" ? state.home.goals : state.away.goals
                    const oppGoals = userSide === "home" ? state.away.goals : state.home.goals
                    if (userGoals > oppGoals) return "Alta"
                    if (userGoals < oppGoals) return "Baixa"
                    return "Equilibrada"
                  })()}
                </strong>
              </span>
            </div>
          </div>
        </section>

        {/* PITCH + EVENTS */}
        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          <section className="overflow-hidden rounded-xl border border-white/[0.04] bg-[#0c0c10]">
            <div className="flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#00ffc8]" />
                <h2 className="text-xs font-medium text-white tracking-wider">CAMPO TÁTICO</h2>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: homeTeam.cor1 }}
                  />
                  {homeTeam.curto}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: awayTeam.cor1 }}
                  />
                  {awayTeam.curto}
                </span>
              </div>
            </div>
            <LivePitch
              ball={state.ball}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homePlayers={homeSquad}
              awayPlayers={awaySquad}
              selectedPlayer={selectedPitchPlayer}
              onSelectPlayer={setSelectedPitchPlayer}
              flash={state.flash}
            />
          </section>

          <section className="overflow-hidden rounded-xl border border-white/[0.04] bg-[#0c0c10]">
            <div className="flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Goal className="h-4 w-4 text-[#00ffc8]" />
                <h2 className="text-xs font-medium text-white tracking-wider">EVENTOS</h2>
              </div>
              <span className="text-[10px] text-white/40 font-medium">
                {state.events.length} eventos
              </span>
            </div>

            <ul className="max-h-[420px] overflow-y-auto divide-y divide-white/5">
              {state.events.length === 0 ? (
                <li className="px-4 py-8 text-center text-xs text-white/40">
                  Inicie a partida para ver os eventos.
                </li>
              ) : (
                state.events.map(e => (
                  <EventRow key={e.id} event={e} homeTeam={homeTeam} awayTeam={awayTeam} />
                ))
              )}
            </ul>
          </section>
        </div>

        {/* META */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.04] bg-white/5 md:grid-cols-4">
          <MetaTile icon={CalendarDays} label="COMPETIÇÃO" value={matchCtx.competition} />
          <MetaTile
            icon={Cloud}
            label="CLIMA"
            value={
              matchCtx.weather === "rain"
                ? "Chuva · 18°C"
                : matchCtx.weather === "cloudy"
                  ? "Nublado · 22°C"
                  : "Ensolarado · 26°C"
            }
          />
          <MetaTile icon={Activity} label="GRAMADO" value="84/100" valueClass="text-[#00ffc8]" />
          <MetaTile
            icon={Users}
            label="PÚBLICO"
            value={attendance.toLocaleString("pt-BR")}
          />
        </section>
      </main>

      {/* MODAIS */}
      <SubstitutionModal
        open={showSubModal}
        onClose={() => setShowSubModal(false)}
        team={userTeamForSub}
        starters={userStarters}
        bench={userBench}
        subsRemaining={subsRemaining}
        onConfirm={handleSub}
      />

      <MatchResultModal
        open={showResult}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        state={state}
        userSide={userSide}
        isChampion={isLeagueChampion}
        onClose={() => setShowResult(false)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────────────────────────────────────

function ratioFor(home: number, away: number): number {
  const total = home + away
  if (total === 0) return 50
  return Math.round((home / total) * 100)
}

function Scoreboard({
  homeTeam,
  awayTeam,
  state,
  competition,
  weather,
}: {
  homeTeam: Team
  awayTeam: Team
  state: MatchState
  competition: string
  weather: "sunny" | "cloudy" | "rain"
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-white/[0.04] bg-[#0c0c10]">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(90deg, ${homeTeam.cor1}30 0%, transparent 30%, transparent 70%, ${awayTeam.cor1}30 100%)`,
        }}
      />

      <div className="relative flex items-center justify-between gap-4 px-6 py-5">
        {/* Mandante */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <TeamCrest team={homeTeam} size="lg" />
          <div className="min-w-0">
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">
              MANDANTE
            </div>
            <div className="text-lg font-black text-white tracking-tight uppercase truncate">
              {homeTeam.nome}
            </div>
            <div className="text-[10px] text-white/40">{homeTeam.estadio_nome}</div>
          </div>
        </div>

        {/* Placar */}
        <div className="flex items-center gap-3 px-4 flex-shrink-0">
          <div
            className={cn(
              "text-5xl font-black leading-none tabular-nums transition-all",
              state.flash?.type === "goal" && state.flash.side === "home" && "text-[#00ffc8] scale-125",
            )}
          >
            {state.home.goals}
          </div>
          <div className="text-lg text-white/30 font-light">×</div>
          <div
            className={cn(
              "text-5xl font-black leading-none tabular-nums transition-all",
              state.flash?.type === "goal" && state.flash.side === "away" && "text-[#00ffc8] scale-125",
            )}
          >
            {state.away.goals}
          </div>
        </div>

        {/* Visitante */}
        <div className="flex items-center gap-4 flex-1 min-w-0 justify-end">
          <div className="text-right min-w-0">
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">
              VISITANTE
            </div>
            <div className="text-lg font-black text-white tracking-tight uppercase truncate">
              {awayTeam.nome}
            </div>
            <div className="text-[10px] text-white/40">
              {awayTeam.cidade}, {awayTeam.estado}
            </div>
          </div>
          <TeamCrest team={awayTeam} size="lg" />
        </div>
      </div>

      {/* Footer info */}
      <div className="relative flex items-center justify-center gap-3 px-6 py-2 border-t border-white/[0.04] bg-black/20 text-[10px] text-white/40">
        <span>{competition}</span>
        <span className="text-white/15">·</span>
        <span className="capitalize">{weather === "sunny" ? "Ensolarado" : weather === "cloudy" ? "Nublado" : "Chuva"}</span>
        <span className="text-white/15">·</span>
        <span className="capitalize">
          {state.phase === "pre" && "Aguardando início"}
          {state.phase === "first" && "1º tempo"}
          {state.phase === "halftime" && "Intervalo"}
          {state.phase === "second" && "2º tempo"}
          {state.phase === "fulltime" && "Encerrada"}
        </span>
      </div>
    </section>
  )
}

function StatCell({
  label,
  home,
  away,
  icon: Icon,
  ratio,
  homeColor = "#00ffc8",
  awayColor = "#ffffff",
}: {
  label: string
  home: string | number
  away: string | number
  icon: React.ComponentType<{ className?: string }>
  ratio: number
  homeColor?: string
  awayColor?: string
}) {
  return (
    <div className="bg-[#0c0c10] p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-white/40 mb-2">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold tabular-nums text-white">{home}</span>
        <span className="text-white/20 text-xs">vs</span>
        <span className="text-lg font-bold tabular-nums text-white">{away}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="flex h-full">
          <div className="h-full transition-all duration-700" style={{ width: `${ratio}%`, backgroundColor: homeColor }} />
          <div className="h-full transition-all duration-700" style={{ width: `${100 - ratio}%`, backgroundColor: awayColor, opacity: 0.5 }} />
        </div>
      </div>
    </div>
  )
}

function MetaTile({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-[#0c0c10] p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-white/40">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("mt-1 text-base font-semibold leading-tight text-white truncate", valueClass)}>
        {value}
      </div>
    </div>
  )
}

function EventRow({
  event,
  homeTeam,
  awayTeam,
}: {
  event: MatchEvent
  homeTeam: Team
  awayTeam: Team
}) {
  const teamColor = event.side === "home" ? homeTeam.cor1 : awayTeam.cor1

  const badgeStyle =
    event.type === "goal"
      ? { className: "bg-[#00ffc8] text-black", label: "GOL" }
      : event.type === "yellow_card"
        ? { className: "bg-yellow-400 text-black", label: "AMA" }
        : event.type === "red_card"
          ? { className: "bg-red-500 text-white", label: "VER" }
          : event.type === "penalty"
            ? { className: "bg-purple-400/20 text-purple-300", label: "PEN" }
            : event.type === "post"
              ? { className: "bg-orange-400/20 text-orange-300", label: "TRA" }
              : event.type === "save"
                ? { className: "bg-blue-400/20 text-blue-300", label: "DEF" }
                : event.type === "corner"
                  ? { className: "bg-cyan-400/20 text-cyan-300", label: "ESC" }
                  : event.type === "foul"
                    ? { className: "bg-white/10 text-white/60", label: "FAL" }
                    : event.type === "injury"
                      ? { className: "bg-red-400/20 text-red-300", label: "LES" }
                      : event.type === "halftime"
                        ? { className: "bg-white/15 text-white", label: "HT" }
                        : event.type === "fulltime"
                          ? { className: "bg-white/15 text-white", label: "FT" }
                          : { className: "bg-white/10 text-white/60", label: "INI" }

  return (
    <li className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-bold text-white/40 tabular-nums w-6">{event.minute}&apos;</span>
        <div
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider min-w-[28px] text-center",
            badgeStyle.className,
          )}
        >
          {badgeStyle.label}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-snug",
            event.type === "goal"
              ? "text-[#00ffc8] font-semibold"
              : event.important
                ? "text-white"
                : "text-white/70",
          )}
        >
          {event.text}
        </p>
      </div>
      <div
        className="h-6 w-1 rounded-full flex-shrink-0"
        style={{ background: teamColor, opacity: 0.6 }}
      />
    </li>
  )
}
