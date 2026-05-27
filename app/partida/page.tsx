"use client"

import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Play,
  Star,
  ChevronLeft,
  ChevronRight,
  Check,
  Settings2,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { GamepadControlsBar } from "@/components/gamepad-controls-bar"
import { getCompetitionTheme, type CompetitionId } from "@/lib/competition-themes"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getTeamByShort,
  serieATeams,
  getCamisaUrl,
  getTeamUniforms,
  type Team,
} from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameManager, getLeagueName } from "@/lib/use-game-manager"
import { saveMatchContext } from "@/lib/match-context"
import { simulateFullMatch, type MatchEvent as SimEvent } from "@/lib/match-engine"
import { type MatchEvent as EngineEvent } from "@/lib/game-engine"
import { teamRating } from "@/lib/players-data"
import { TacticalEditor } from "@/components/tactical-editor"
import { getLeagueLogo } from "@/lib/league-logos"

type KitVariant = "home" | "away" | "third"

// ─────────────────────────────────────────────────────────────────────────────
// TeamCard Component - Estilo EA FC
// ─────────────────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  side,
  selectedKit,
  onKitChange,
  leagueName,
}: {
  team: Team
  side: "home" | "away"
  selectedKit: KitVariant
  onKitChange: (kit: KitVariant) => void
  leagueName: string
}) {
  const overallRating = teamRating(team.curto) || teamRating(team.nome) || 75
  
  // Calcula estrelas baseado no prestigio
  const stars = Math.min(5, Math.max(1, Math.round(team.prestigio / 2)))
  const halfStar = team.prestigio % 2 !== 0

  // Stats baseados no overall rating com pequena variacao
  const baseRating = overallRating || 75
  const stats = useMemo(() => ({
    ata: Math.round(baseRating + (team.curto.charCodeAt(0) % 5) - 2),
    mei: Math.round(baseRating + (team.curto.charCodeAt(1) % 5) - 2),
    def: Math.round(baseRating + (team.curto.charCodeAt(2) % 5) - 2),
  }), [baseRating, team.curto])

  // Tendencia baseada em hash do nome para ser deterministica
  const trends = useMemo(() => ({
    ata: team.nome.length % 3 === 0 ? "up" : team.nome.length % 3 === 1 ? "neutral" : "down",
    mei: team.nome.length % 3 === 1 ? "up" : team.nome.length % 3 === 2 ? "neutral" : "down",
    def: team.nome.length % 3 === 2 ? "up" : team.nome.length % 3 === 0 ? "neutral" : "down",
  }), [team.nome])

  const leagueLogo = getLeagueLogo(leagueName)

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "up") return <TrendingUp className="h-3 w-3 text-green-400" />
    if (trend === "down") return <TrendingDown className="h-3 w-3 text-red-400" />
    return <Minus className="h-3 w-3 text-white/30" />
  }

  return (
    <div className={cn(
      "flex-1 flex flex-col items-center justify-center relative",
      side === "home" ? "pr-4" : "pl-4"
    )}>
      {/* Team Name */}
      <h2 className="text-2xl font-bold text-white mb-6 tracking-wide">
        {team.nome}
      </h2>

      {/* Large Crest with glow */}
      <div className="relative mb-6">
        <div 
          className="absolute inset-0 blur-3xl opacity-40 scale-150"
          style={{ backgroundColor: team.cor1 }}
        />
        <div className="relative">
          <TeamCrest team={team} size="2xl" className="w-40 h-40" />
        </div>
      </div>

      {/* Star Rating */}
      <div className="flex items-center gap-0.5 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-5 w-5",
              i < stars
                ? "text-yellow-400 fill-yellow-400"
                : halfStar && i === stars
                ? "text-yellow-400 fill-yellow-400/50"
                : "text-white/20"
            )}
          />
        ))}
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-white/40 font-bold tracking-wider mb-1">ATA</span>
          <div className="flex items-center gap-1">
            <span className={cn(
              "text-xl font-bold",
              trends.ata === "up" ? "text-green-400" : trends.ata === "down" ? "text-red-400" : "text-white"
            )}>
              {stats.ata}
            </span>
            <TrendIcon trend={trends.ata} />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-white/40 font-bold tracking-wider mb-1">MEI</span>
          <div className="flex items-center gap-1">
            <span className={cn(
              "text-xl font-bold",
              trends.mei === "up" ? "text-green-400" : trends.mei === "down" ? "text-red-400" : "text-white"
            )}>
              {stats.mei}
            </span>
            <TrendIcon trend={trends.mei} />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-white/40 font-bold tracking-wider mb-1">DEF</span>
          <div className="flex items-center gap-1">
            <span className={cn(
              "text-xl font-bold",
              trends.def === "up" ? "text-green-400" : trends.def === "down" ? "text-red-400" : "text-white"
            )}>
              {stats.def}
            </span>
            <TrendIcon trend={trends.def} />
          </div>
        </div>
      </div>

      {/* League Badge */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-white/40 mb-2">Liga</span>
        <Image
          src={leagueLogo}
          alt={leagueName}
          width={48}
          height={48}
          className="object-contain"
          unoptimized
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VerticalLabel Component
// ─────────────────────────────────────────────────────────────────────────────

function VerticalLabel({ text, side }: { text: string; side: "left" | "right" }) {
  return (
    <div className={cn(
      "absolute top-1/2 -translate-y-1/2 flex items-center justify-center",
      side === "left" ? "left-0" : "right-0"
    )}>
      <span 
        className="text-5xl font-black text-white/10 tracking-[0.5em] uppercase"
        style={{ 
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: side === "left" ? "rotate(180deg)" : "rotate(0deg)"
        }}
      >
        {text}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PartidaPage() {
  const router = useRouter()
  const userTeam = useUserTeam()
  const { currentMatch, standings, league, currentRound } = useGameManager()

  const [hydrated, setHydrated] = useState(false)
  const [homeKit, setHomeKit] = useState<KitVariant>("home")
  const [awayKit, setAwayKit] = useState<KitVariant>("away")
  const [livePhase, setLivePhase] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showQuickSim, setShowQuickSim] = useState(false)
  const [quickSimResult, setQuickSimResult] = useState<{
    homeGoals: number
    awayGoals: number
    events: (SimEvent | EngineEvent)[]
  } | null>(null)

  // Hydration
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Resolve teams
  const homeTeam = useMemo(() => {
    if (!currentMatch) return getTeamByShort("FLA") || serieATeams[0]
    return getTeamByShort(currentMatch.homeTeam) || serieATeams[0]
  }, [currentMatch])

  const awayTeam = useMemo(() => {
    if (!currentMatch) return getTeamByShort("MIR") || serieATeams[1]
    return getTeamByShort(currentMatch.awayTeam) || serieATeams[1]
  }, [currentMatch])

  const matchInfo = useMemo(() => {
    const leagueName = getLeagueName(league)
    return {
      competition: leagueName,
      round: `Rodada ${currentRound}`,
      date: "01 ABR 2026",
      time: "16:00",
      stadium: homeTeam.estadio_nome,
    }
  }, [league, currentRound, homeTeam])

  const competitionTheme = useMemo(() => {
    const competitionId = league === "serie-a" ? "brasileirao" : (league as CompetitionId)
    return getCompetitionTheme(competitionId)
  }, [league])

  // Quick sim handler
  const handleQuickSim = useCallback(() => {
    if (!homeTeam || !awayTeam) return
    setShowQuickSim(true)
    const result = simulateFullMatch(homeTeam, awayTeam, "home")
    setTimeout(() => {
      setQuickSimResult({
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        events: result.events,
      })
    }, 1500)
  }, [homeTeam, awayTeam])

  // Save match context before navigation
  useEffect(() => {
    if (homeTeam && awayTeam) {
      saveMatchContext({
        homeShort: homeTeam.curto,
        awayShort: awayTeam.curto,
        homeKit,
        awayKit,
        competition: matchInfo.competition,
        round: matchInfo.round,
      })
    }
  }, [homeTeam, awayTeam, homeKit, awayKit, matchInfo])

  // Gamepad controls
  useEffect(() => {
    const cycleKit = (current: KitVariant, direction: number): KitVariant => {
      const kits: KitVariant[] = ["home", "away", "third"]
      const idx = kits.indexOf(current)
      const newIdx = (idx + direction + kits.length) % kits.length
      return kits[newIdx]
    }

    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent).detail
      
      if (showQuickSim) {
        if (button === "B") {
          setShowQuickSim(false)
          setQuickSimResult(null)
        }
        return
      }

      switch (button) {
        case "A":
          router.push("/partida/ao-vivo")
          break
        case "B":
          router.back()
          break
        case "X":
          handleQuickSim()
          break
        case "Y":
          setShowSettings(true)
          break
        case "LB":
          setHomeKit(prev => cycleKit(prev, -1))
          break
        case "RB":
          setHomeKit(prev => cycleKit(prev, 1))
          break
      }
    }

    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [showQuickSim, router, handleQuickSim])

  if (!hydrated) {
    return (
      <div className="h-screen md:pl-16 pl-0 pb-20 md:pb-0 bg-[#050508] flex items-center justify-center text-white/40 text-sm">
        Carregando...
      </div>
    )
  }

  return (
    <div className="h-screen md:pl-16 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {/* Background with light rays */}
        <div className="absolute inset-0">
          {/* Dark gradient base */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#050508]" />
          
          {/* Light rays from center */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse 80% 50% at 50% 60%, rgba(255,255,255,0.1) 0%, transparent 50%)`,
            }}
          />
          
          {/* Stadium silhouette hint */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-1/3 opacity-10"
            style={{
              background: `linear-gradient(to top, #000 0%, transparent 100%)`,
            }}
          />
        </div>

        {/* Country/League Selector - Top */}
        <div className="relative flex items-center justify-center gap-4 py-4 border-b border-white/[0.04] bg-black/30">
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft className="h-4 w-4 text-white/60" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇧🇷</span>
            <span className="text-white font-semibold">Brasil</span>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronRight className="h-4 w-4 text-white/60" />
          </button>

          {/* Flag on right */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-white/40 text-sm">Brasil</span>
            <span className="text-2xl">🇧🇷</span>
          </div>
        </div>

        {/* Teams Section */}
        <div className="relative flex-1 flex items-stretch h-[calc(100%-140px)]">
          {/* Vertical CASA label */}
          <VerticalLabel text="CASA" side="left" />

          {/* Home Team */}
          <TeamCard 
            team={homeTeam} 
            side="home" 
            selectedKit={homeKit}
            onKitChange={setHomeKit}
            leagueName={matchInfo.competition}
          />

          {/* Center Options */}
          <div className="flex flex-col items-center justify-center px-8 gap-6 min-w-[200px]">
            {/* Advantage Options */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-white/40">
                <Settings2 className="h-4 w-4" />
                <span className="text-sm">Nao</span>
              </div>
              <span className="text-[10px] text-white/30">Opcoes de vantagem</span>
            </div>

            {/* Live Phase Toggle */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => setLivePhase(!livePhase)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                  livePhase 
                    ? "bg-green-500/20 border border-green-500/50 text-green-400" 
                    : "bg-white/5 border border-white/10 text-white/40"
                )}
              >
                {livePhase && <Check className="h-4 w-4" />}
                <Zap className="h-4 w-4" />
              </button>
              <span className="text-sm text-white/60">Fase ao vivo</span>
              <span className="text-xs text-white/40">{livePhase ? "Sim" : "Nao"}</span>
            </div>
          </div>

          {/* Away Team */}
          <TeamCard 
            team={awayTeam} 
            side="away" 
            selectedKit={awayKit}
            onKitChange={setAwayKit}
            leagueName={matchInfo.competition}
          />

          {/* Vertical FORA label */}
          <VerticalLabel text="FORA" side="right" />
        </div>

        {/* Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent py-4 px-6">
          <div className="flex items-center justify-between">
            {/* Left Actions */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-blue-500 text-white rounded px-2 py-1 font-bold">X</span>
                <span className="text-white/60 text-sm">Selecionar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">O</span>
                <span className="text-white/60 text-sm">Voltar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white/20 text-white rounded px-2 py-1 font-bold">R3</span>
                <span className="text-white/60 text-sm">Aleatorio</span>
              </div>
            </div>

            {/* Center - Start Button */}
            <Link href="/partida/ao-vivo">
              <Button
                size="lg"
                className="h-12 px-8 text-base font-black tracking-wider bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] text-black hover:from-[#00c8ff] hover:to-[#22e766]"
              >
                <Play className="mr-2 h-5 w-5 fill-current" />
                INICIAR PARTIDA
              </Button>
            </Link>

            {/* Right - Team Badge */}
            <div className="flex items-center gap-4">
              <TeamCrest team={userTeam} size="sm" />
            </div>
          </div>
        </div>
      </main>

      {/* Quick Sim Modal */}
      {showQuickSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0c0c10] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white text-center mb-6">Simulacao Rapida</h3>
            
            {quickSimResult ? (
              <div className="text-center">
                <div className="flex items-center justify-center gap-8 mb-6">
                  <div className="flex flex-col items-center gap-2">
                    <TeamCrest team={homeTeam} size="lg" />
                    <span className="text-4xl font-black text-white">{quickSimResult.homeGoals}</span>
                  </div>
                  <span className="text-2xl text-white/30">x</span>
                  <div className="flex flex-col items-center gap-2">
                    <TeamCrest team={awayTeam} size="lg" />
                    <span className="text-4xl font-black text-white">{quickSimResult.awayGoals}</span>
                  </div>
                </div>
                <Button 
                  onClick={() => { setShowQuickSim(false); setQuickSimResult(null) }}
                  className="w-full"
                >
                  Fechar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-white/60">Simulando partida...</span>
              </div>
            )}
          </div>
        </div>
      )}

      <MusicPlayer />
      <GamepadControlsBar
        controls={[
          { button: "A", label: "Iniciar Partida" },
          { button: "B", label: "Voltar" },
          { button: "X", label: "Sim. Rapida" },
          { button: "LB", label: "Kit Casa", showBumper: true },
          { button: "RB", label: "Kit Fora", showBumper: true },
        ]}
      />
    </div>
  )
}
