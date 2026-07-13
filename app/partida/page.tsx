"use client"

import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Play,
  Star,
  StarHalf,
  ChevronUp,
  ChevronDown,
  Check,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
} from "lucide-react"
import { ActionHint } from "@/components/gamepad-icons"
import { GamepadControlsBar, useGamepadDetection } from "@/components/gamepad-controls-bar"
import { getCompetitionTheme, type CompetitionId } from "@/lib/competition-themes"
import { TeamCrest } from "@/components/team-crest"
import { CtaPill } from "@/components/cta-pill"
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
import { clearMatchContext, saveMatchContext } from "@/lib/match-context"
import { hardNavigate } from "@/lib/hard-navigation"
import { simulateFullMatch, type MatchEvent as SimEvent } from "@/lib/match-engine"
import { type MatchEvent as EngineEvent } from "@/lib/game-engine"
import { teamRating } from "@/lib/players-data"
import { TacticalEditor } from "@/components/tactical-editor"
import { getLeagueLogo } from "@/lib/league-logos"

type KitVariant = "home" | "away" | "third"

// Mapeia o pais do time para o codigo de bandeira (flagcdn) e nome exibido
function getCountryInfo(team: Team): { name: string; code: string } {
  const pais = (team.pais || "").toLowerCase()
  const map: Record<string, { name: string; code: string }> = {
    brasil: { name: "Brasil", code: "br" },
    brazil: { name: "Brasil", code: "br" },
    argentina: { name: "Argentina", code: "ar" },
    alemanha: { name: "Alemanha", code: "de" },
    inglaterra: { name: "Inglaterra", code: "gb-eng" },
    espanha: { name: "Espanha", code: "es" },
    franca: { name: "França", code: "fr" },
    italia: { name: "Itália", code: "it" },
    portugal: { name: "Portugal", code: "pt" },
  }
  if (map[pais]) return map[pais]
  // fallback por regiao
  if (team.regiao === "americas") return { name: "Argentina", code: "ar" }
  if (team.regiao === "europa") return { name: "Europa", code: "eu" }
  return { name: "Brasil", code: "br" }
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamPanel Component - Estilo EA FC (Selecionar Times)
// ─────────────────────────────────────────────────────────────────────────────

function TeamPanel({
  team,
  selected,
  leagueName,
  leagueLogo,
  onSelect,
}: {
  team: Team
  selected: boolean
  leagueName: string
  leagueLogo: string | null
  onSelect: () => void
}) {
  const overallRating = teamRating(team.curto) || teamRating(team.nome) || 75
  const country = getCountryInfo(team)

  // Avaliacao em estrelas com suporte a meia-estrela (prestigio em escala 0-10)
  const ratingHalf = Math.max(0.5, Math.min(5, Math.round(team.prestigio) / 2))

  const baseRating = overallRating || 75
  const cor1 = team.cor1 || "#10b981"
  const stats = useMemo(() => {
    const trends = ["up", "neutral", "down"] as const
    return {
      ata: { value: Math.round(baseRating + (team.curto.charCodeAt(0) % 5) - 2), trend: trends[team.curto.charCodeAt(0) % 3] },
      mei: { value: Math.round(baseRating + (team.curto.charCodeAt(1) % 5) - 2), trend: trends[team.curto.charCodeAt(1) % 3] },
      def: { value: Math.round(baseRating + (team.curto.charCodeAt(2) % 5) - 2), trend: trends[team.curto.charCodeAt(2) % 3] },
    }
  }, [baseRating, team.curto])

  const TrendIndicator = ({ trend }: { trend: string }) => {
    if (trend === "up") return <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
    if (trend === "down") return <ChevronDown className="h-3.5 w-3.5 text-red-400" />
    return <Minus className="h-3.5 w-3.5 text-white/35" />
  }

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-3">

      {/* Card de PAIS */}
      <div className="relative flex w-full items-center justify-center rounded-2xl bg-[#0e1116]/85 px-5 py-3.5 backdrop-blur-sm">
        <span className="text-base font-bold tracking-wide text-white">{country.name}</span>
        <img
          src={`https://flagcdn.com/h40/${country.code}.png`}
          alt={country.name}
          className="absolute right-5 top-1/2 h-6 w-9 -translate-y-1/2 rounded-[3px] object-cover shadow-md"
        />
      </div>

      {/* Card de selecao de time */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect() }}
        className={cn(
          "relative w-full cursor-pointer overflow-hidden rounded-2xl transition-all",
          selected
            ? "border-2 border-[#00ffc8]/70 bg-[linear-gradient(160deg,rgba(22,30,40,0.96)_0%,rgba(10,14,20,0.96)_100%)] shadow-[0_0_38px_rgba(0,255,200,0.16),0_20px_60px_rgba(0,0,0,0.6)]"
            : "border border-white/[0.07] bg-[linear-gradient(160deg,rgba(20,26,34,0.85)_0%,rgba(10,14,20,0.9)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
        )}
      >
        {/* Nome do time */}
        <div className="px-6 pt-4 pb-1">
          <h2 className="truncate text-center text-xl font-bold tracking-wide text-white">{team.nome}</h2>
        </div>

        {/* Escudo */}
        <div className="relative flex justify-center py-3 sm:py-4">
          <div
            className="flex h-32 w-32 items-center justify-center rounded-full sm:h-36 sm:w-36"
            style={{ background: `radial-gradient(circle, ${cor1}22 0%, transparent 68%)` }}
          >
            <TeamCrest team={team} size="2xl" className="h-28 w-28 sm:h-32 sm:w-32" />
          </div>
        </div>

        {/* Estrelas (com meia-estrela) */}
        <div className="flex items-center justify-center gap-1 pb-4">
          {Array.from({ length: 5 }).map((_, i) => {
            const fill = ratingHalf - i
            if (fill >= 1) {
              return (
                <Star
                  key={i}
                  className="h-5 w-5 fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]"
                />
              )
            }
            if (fill >= 0.5) {
              return (
                <span key={i} className="relative inline-block h-5 w-5">
                  <Star className="absolute inset-0 h-full w-full text-white/15" />
                  <StarHalf className="absolute inset-0 h-full w-full fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                </span>
              )
            }
            return <Star key={i} className="h-5 w-5 text-white/15" />
          })}
        </div>

        {/* ATA / MEI / DEF */}
        <div className="flex items-stretch border-t border-white/[0.07] bg-black/30">
          <div className="flex-1 px-2 py-3.5 text-center">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">ATA</div>
            <div className="flex items-center justify-center gap-0.5">
              <span className="text-2xl font-black leading-none tabular-nums text-white">{stats.ata.value}</span>
              <TrendIndicator trend={stats.ata.trend} />
            </div>
          </div>
          <div className="w-px bg-white/[0.07]" />
          <div className="flex-1 px-2 py-3.5 text-center">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">MEI</div>
            <div className="flex items-center justify-center gap-0.5">
              <span className="text-2xl font-black leading-none tabular-nums text-white">{stats.mei.value}</span>
              <TrendIndicator trend={stats.mei.trend} />
            </div>
          </div>
          <div className="w-px bg-white/[0.07]" />
          <div className="flex-1 px-2 py-3.5 text-center">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">DEF</div>
            <div className="flex items-center justify-center gap-0.5">
              <span className="text-2xl font-black leading-none tabular-nums text-white">{stats.def.value}</span>
              <TrendIndicator trend={stats.def.trend} />
            </div>
          </div>
        </div>
      </div>

      {/* Card de LIGA */}
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-[#0e1116]/85 px-5 py-3.5 backdrop-blur-sm">
        {leagueLogo ? (
          // Sem mixBlendMode: o "screen" tornava as partes escuras da logo
          // transparentes, deixando so um contorno fantasma no lugar do emblema.
          <Image
            src={leagueLogo}
            alt={leagueName}
            width={200}
            height={56}
            className="h-11 w-auto max-w-[190px] object-contain"
            unoptimized
          />
        ) : (
          <Trophy className="h-7 w-7 text-white/60" />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PartidaPage() {
  const router = useRouter()
  const userTeam = useUserTeam()
  const { currentMatch, standings, league, currentRound, registerUserMatchResult, advanceWeek } = useGameManager()

  const { connected: gamepadConnected } = useGamepadDetection()
  const [hydrated, setHydrated] = useState(false)
  const [homeKit, setHomeKit] = useState<KitVariant>("home")
  const [awayKit, setAwayKit] = useState<KitVariant>("away")
  const [livePhase, setLivePhase] = useState(true)
  const [advantageOptions, setAdvantageOptions] = useState(false)
  const [focusedSide, setFocusedSide] = useState<"home" | "away">("home")
  const [showSettings, setShowSettings] = useState(false)
  const [showQuickSim, setShowQuickSim] = useState(false)
  const [quickSimResult, setQuickSimResult] = useState<{
    homeGoals: number
    awayGoals: number
    events: (SimEvent | EngineEvent)[]
  } | null>(null)
  const quickSimRegistered = useRef(false)

  // Hydration
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Resolve teams
  const homeTeam = useMemo(() => {
    if (!currentMatch) return getTeamByShort("FLA") || serieATeams[0]
    return currentMatch.homeTeam
  }, [currentMatch])

  const awayTeam = useMemo(() => {
    if (!currentMatch) return getTeamByShort("MIR") || serieATeams[1]
    return currentMatch.awayTeam
  }, [currentMatch])

  const matchInfo = useMemo(() => {
    // league é a chave de divisao (ex: "serie_a") — usar diretamente para o logo
    const leagueName = getLeagueName(homeTeam.curto)
    // Jogos de liga usam a divisao; estaduais/copas/continentais usam o nome real da competicao.
    const compType = currentMatch?.competitionType
    const isLeagueMatch = !compType || compType === "league"
    const competition = currentMatch?.competition ?? leagueName
    return {
      competition,
      // O logo central segue a competicao real da partida
      leagueKey: isLeagueMatch ? league : competition,
      // Em copas/estaduais a fase ja vem no nome da competicao; na liga mostramos a rodada
      round: isLeagueMatch ? `Rodada ${currentRound ?? 1}` : competition,
      date: "01 ABR 2026",
      time: "16:00",
      stadium: homeTeam.estadio_nome,
    }
  }, [league, currentRound, homeTeam, currentMatch])

  const competitionTheme = useMemo(() => {
    const competitionId = (league ?? "serie_a").replace(/_/g, "-") as CompetitionId
    return getCompetitionTheme(competitionId)
  }, [league])

  // Quick sim handler
  const handleQuickSim = useCallback(() => {
    if (!homeTeam || !awayTeam) return
    quickSimRegistered.current = false
    setShowQuickSim(true)
    setQuickSimResult(null)
    const result = simulateFullMatch({ homeTeam, awayTeam, homeRating: homeTeam.prestigio, awayRating: awayTeam.prestigio })
    setTimeout(() => {
      setQuickSimResult({
        homeGoals: result.home.goals,
        awayGoals: result.away.goals,
        events: result.events,
      })

      if (!quickSimRegistered.current) {
        quickSimRegistered.current = true
        const goalEvents: EngineEvent[] = result.events
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
          result.home.goals,
          result.away.goals,
          goalEvents
        )
        clearMatchContext()
        void advanceWeek()
      }
    }, 1500)
  }, [homeTeam, awayTeam, registerUserMatchResult, advanceWeek])

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
          hardNavigate("/splash?menu=1")
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
      <div className="h-screen bg-[#050508] flex items-center justify-center text-white/40 text-sm">
        Carregando...
      </div>
    )
  }
  
  const homeLeague = getLeagueName(homeTeam.curto)
  const awayLeague = getLeagueName(awayTeam.curto)

  return (
    <div className="h-screen bg-[#050508] flex flex-col overflow-hidden">

      {/* Main Content */}
      <main className="relative flex-1 overflow-hidden">
        {/* Background - estadio noturno */}
        <div className="absolute inset-0">
          <Image
            src="/images/stadium-night.png"
            alt=""
            fill
            priority
            className="object-cover"
            unoptimized
          />
          {/* Escurecimento para legibilidade */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/65 to-black/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/30" />
        </div>

        {/* Header */}
        <div className="relative z-20 flex items-center gap-4 px-8 pt-6">
          <Image
            src="/brand/uf26-logo.png"
            alt="UF26"
            width={160}
            height={60}
            className="h-14 w-auto object-contain"
            priority
          />
          <h1 className="text-lg font-bold text-white">Partida Clássica</h1>
          <span className="h-5 w-px bg-white/25" />
          <span className="text-base font-semibold text-white/80">Selecionar Times</span>
        </div>

        {/* Teams Section */}
        <div className="relative z-10 flex h-[calc(100%-150px)] items-center justify-center gap-4 px-6 xl:gap-10 xl:px-20">
          {/* Painel CASA */}
          <TeamPanel
            team={homeTeam}
            selected={focusedSide === "home"}
            leagueName={homeLeague}
            leagueLogo={getLeagueLogo(homeTeam.divisao)}
            onSelect={() => setFocusedSide("home")}
          />

          {/* Coluna central de opcoes */}
          <div className="flex shrink-0 flex-col items-center justify-center gap-10 px-2">
            <button
              onClick={() => setAdvantageOptions((v) => !v)}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 text-xs font-bold text-white/70">
                  q
                </span>
                <span className="text-base font-semibold text-white">{advantageOptions ? "Sim" : "Não"}</span>
              </div>
              <span className="max-w-24 text-sm leading-tight text-white/55 text-balance">Opções de vantagem</span>
            </button>

            <button
              onClick={() => setLivePhase((v) => !v)}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 text-xs font-bold text-white/70">
                  d
                </span>
                {livePhase ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                    <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="h-6 w-6 rounded-full border-2 border-white/30" />
                )}
              </div>
              <span className="text-sm leading-tight text-white/55">Fase ao vivo</span>
              <span className="text-sm font-medium text-white/75">{livePhase ? "Sim" : "Não"}</span>
            </button>
          </div>

          {/* Painel FORA */}
          <TeamPanel
            team={awayTeam}
            selected={focusedSide === "away"}
            leagueName={awayLeague}
            leagueLogo={getLeagueLogo(awayTeam.divisao)}
            onSelect={() => setFocusedSide("away")}
          />
        </div>

        {/* Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/90 to-transparent px-8 py-5">
          <div className="flex items-center justify-between">
            {/* Atalhos estilo EA FC */}
            <div className="flex items-center gap-7">
              <Link href="/partida/ao-vivo" className="flex items-center gap-2 text-white transition-opacity hover:opacity-80">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 px-1.5 text-xs font-bold">
                  ⏎
                </span>
                <span className="text-sm font-semibold">Selecionar</span>
              </Link>
              <button onClick={() => hardNavigate("/splash?menu=1")} className="flex items-center gap-2 text-white transition-opacity hover:opacity-80">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 px-1.5 text-xs font-bold">
                  Esc
                </span>
                <span className="text-sm font-semibold">Voltar</span>
              </button>
            </div>

            {/* Botao iniciar (acesso direto) */}
            <CtaPill href="/partida/ao-vivo">INICIAR PARTIDA</CtaPill>
          </div>
        </div>
      </main>

      {/* Quick Sim Modal */}
      {showQuickSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0c0c10] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white text-center mb-6">Simulação Rápida</h3>
            
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
                  Continuar
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
  
  <GamepadControlsBar
        customActions={[
          { button: "A", label: "Iniciar Partida" },
          { button: "B", label: "Voltar" },
          { button: "X", label: "Sim. Rapida" },
          { button: "LB", label: "Kit Casa" },
          { button: "RB", label: "Kit Fora" },
        ]}
      />
    </div>
  )
}
