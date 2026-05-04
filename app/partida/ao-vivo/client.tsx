"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
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
import { loadMatchContext } from "@/lib/match-context"
import { useMatchSimulation } from "@/hooks/use-match-simulation"
import { getActionForButton, type GameContext } from "@/lib/gamepad-controls"
import { type GamepadButtonName } from "@/hooks/use-gamepad"
import {
  type MatchSpeed,
  type MatchEvent,
  type MatchState,
} from "@/lib/match-engine"
import { LivePitch } from "@/components/match/live-pitch"
import { SubstitutionModal, type MatchPlayer } from "@/components/match/substitution-modal"
import { MatchResultModal } from "@/components/match/match-result-modal"

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

const SPEEDS: { id: MatchSpeed; label: string; sublabel: string }[] = [
  { id: "slow", label: "LENTO", sublabel: "1x" },
  { id: "normal", label: "NORMAL", sublabel: "2x" },
  { id: "fast", label: "RÁPIDO", sublabel: "5x" },
  { id: "ultra", label: "ULTRA", sublabel: "12x" },
  { id: "hyper", label: "HIPER", sublabel: "30x" },
]

export default function MatchCenterClient() {
  const { team: userTeam, hydrated } = useUserTeam()

  const [matchCtx, setMatchCtx] = useState(() => loadMatchContext())
  useEffect(() => {
    setMatchCtx(loadMatchContext())
  }, [])

  const homeTeam: Team = useMemo(() => {
    return getTeamByShort(matchCtx.homeShort) || userTeam || serieATeams[0]
  }, [matchCtx.homeShort, userTeam])

  const awayTeam: Team = useMemo(() => {
    const t = getTeamByShort(matchCtx.awayShort)
    if (t) return t
    return serieATeams.find(t => t.curto !== homeTeam.curto) || serieATeams[1]
  }, [matchCtx.awayShort, homeTeam])

  const userSide: "home" | "away" = userTeam.curto === awayTeam.curto ? "away" : "home"

  const [homeSquad, setHomeSquad] = useState<MatchPlayer[]>(() => buildSquad(0, ""))
  const [awaySquad, setAwaySquad] = useState<MatchPlayer[]>(() => buildSquad(200, ""))
  const [homeBench, setHomeBench] = useState<MatchPlayer[]>(() => buildBench(100, ""))
  const [awayBench, setAwayBench] = useState<MatchPlayer[]>(() => buildBench(300, ""))

  const config = useMemo(() => ({
    homeTeam,
    awayTeam,
    homeRating: Math.round(homeSquad.reduce((s, p) => s + p.rating, 0) / homeSquad.length),
    awayRating: Math.round(awaySquad.reduce((s, p) => s + p.rating, 0) / awaySquad.length),
    durationMinutes: matchCtx.duration,
    weatherFactor: matchCtx.weather === "rain" ? 0.9 : 1,
    homeSquad: homeSquad.map(p => ({ nome: p.name, pos: p.position })),
    awaySquad: awaySquad.map(p => ({ nome: p.name, pos: p.position })),
  }), [homeTeam, awayTeam, homeSquad, awaySquad, matchCtx.duration, matchCtx.weather])

  const sim = useMatchSimulation(config)
  const { state, speed, isRunning, start, pause, resume, reset, setSpeed, fastForward } = sim

  const [showSubModal, setShowSubModal] = useState(false)
  const [subsRemaining, setSubsRemaining] = useState(5)

  const gameContext: GameContext = state.phase === "pre"
    ? "match_preview"
    : state.phase === "fulltime"
      ? "menu"
      : isRunning
        ? "match_live"
        : "match_paused"

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
    window.addEventListener("gamepad:button" as any, handleGamepadButton)
    return () => window.removeEventListener("gamepad:button" as any, handleGamepadButton)
  }, [gameContext, isRunning, pause, resume, speed, setSpeed, fastForward, start, subsRemaining, state.phase, showSubModal])

  const [showResult, setShowResult] = useState(false)
  useEffect(() => {
    if (state.phase === "fulltime" && !showResult) {
      const t = setTimeout(() => setShowResult(true), 1200)
      return () => clearTimeout(t)
    }
  }, [state.phase, showResult])

  useEffect(() => {
    if (state.phase !== "first" && state.phase !== "second") return
    setHomeSquad(prev => prev.map(p => ({ ...p, stamina: Math.max(0, p.stamina - 0.4) })))
    setAwaySquad(prev => prev.map(p => ({ ...p, stamina: Math.max(0, p.stamina - 0.4) })))
  }, [state.minute, state.phase])

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

  const [selectedPitchPlayer, setSelectedPitchPlayer] = useState<number | null>(null)

  if (!hydrated) {
    return (
      <div className="min-h-screen pl-[72px] bg-[#0a0a0a] flex items-center justify-center text-white/40 text-sm">
        Carregando partida...
      </div>
    )
  }

  const isMatchInProgress = state.phase === "first" || state.phase === "second" || state.phase === "halftime"

  return (
    <div className={cn("min-h-screen pb-4 bg-[#0a0a0a]", !isMatchInProgress && "pl-[72px]")}>
      {!isMatchInProgress && <GameSidebar />}

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/95 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3">
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
              className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760] font-bold tracking-wider"
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
                <Button size="sm" onClick={resume} className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760] font-bold">
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
        {animation?.type === "goal" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/70 animate-fade-in" />
            <div className="relative flex flex-col items-center gap-4 animate-scale-in">
              <div
                className="text-7xl sm:text-9xl font-black tracking-tighter animate-bounce"
                style={{ color: animation.side === "home" ? homeTeam.cor1 : awayTeam.cor1 }}
              >
                GOOOOL!
              </div>
              <TeamCrest team={animation.side === "home" ? homeTeam : awayTeam} size="xl" />
              <div className="text-2xl font-bold text-white">
                {animation.side === "home" ? homeTeam.nome : awayTeam.nome}
              </div>
            </div>
          </div>
        )}

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

        <Scoreboard
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          state={state}
          competition={matchCtx.competition}
          weather={matchCtx.weather}
        />

        <section className="rounded-xl border border-white/5 bg-[#141414] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Timer className="h-4 w-4 text-[#1db954]" />
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
                        ? "border-[#1db954] bg-[#1db954] text-black"
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

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/5 bg-white/5 md:grid-cols-3 lg:grid-cols-6">
          <StatCell label="POSSE" home={`${state.home.possession}%`} away={`${state.away.possession}%`} icon={Activity} ratio={state.home.possession} />
          <StatCell label="FINALIZAÇÕES" home={state.home.shots} away={state.away.shots} icon={TargetIcon} ratio={ratioFor(state.home.shots, state.away.shots)} />
          <StatCell label="NO ALVO" home={state.home.shotsOnTarget} away={state.away.shotsOnTarget} icon={TargetIcon} ratio={ratioFor(state.home.shotsOnTarget, state.away.shotsOnTarget)} />
          <StatCell label="xG" home={state.home.xG.toFixed(2)} away={state.away.xG.toFixed(2)} icon={Sparkles} ratio={ratioFor(state.home.xG, state.away.xG)} />
          <StatCell label="ESCANTEIOS" home={state.home.corners} away={state.away.corners} icon={Flag} ratio={ratioFor(state.home.corners, state.away.corners)} />
          <StatCell label="FALTAS" home={state.home.fouls} away={state.away.fouls} icon={AlertTriangle} ratio={ratioFor(state.home.fouls, state.away.fouls)} />
        </section>

        <section className="rounded-xl border border-white/5 bg-[#141414] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowSubModal(true)}
                disabled={subsRemaining === 0 || state.phase === "fulltime" || state.phase === "pre"}
                className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760] disabled:opacity-30 font-bold tracking-wider"
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                SUBSTITUIR
              </Button>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-bold tracking-wider",
                  subsRemaining > 2
                    ? "bg-[#1db954]/15 text-[#1db954]"
                    : subsRemaining > 0
                      ? "bg-yellow-400/15 text-yellow-400"
                      : "bg-red-400/15 text-red-400",
                )}
              >
                {subsRemaining}/5 RESTANTES
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/50">
              <span>Formação: <strong className="text-white">4-3-3</strong></span>
              <span>Sua moral: <strong className="text-[#1db954]">{state.home.goals + state.away.goals === 0 ? "Equilibrada" : "Alta"}</strong></span>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          <section className="overflow-hidden rounded-xl border border-white/5 bg-[#141414]">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#1db954]" />
                <h2 className="text-xs font-medium text-white tracking-wider">CAMPO TÁTICO</h2>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: homeTeam.cor1 }} />
                  {homeTeam.curto}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: awayTeam.cor1 }} />
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

          <section className="overflow-hidden rounded-xl border border-white/5 bg-[#141414]">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Goal className="h-4 w-4 text-[#1db954]" />
                <h2 className="text-xs font-medium text-white tracking-wider">EVENTOS</h2>
              </div>
              <span className="text-[10px] text-white/40 font-medium">{state.events.length} eventos</span>
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

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/5 bg-white/5 md:grid-cols-4">
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
          <MetaTile icon={Activity} label="GRAMADO" value="84/100" valueClass="text-[#1db954]" />
          <MetaTile
            icon={Users}
            label="PÚBLICO"
            value={(homeTeam.estadio_cap * (0.6 + Math.random() * 0.35))
              .toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          />
        </section>
      </main>

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
        onClose={() => setShowResult(false)}
      />
    </div>
  )
}

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
    <section className="relative overflow-hidden rounded-xl border border-white/5 bg-[#141414]">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(90deg, ${homeTeam.cor1}30 0%, transparent 30%, transparent 70%, ${awayTeam.cor1}30 100%)`,
        }}
      />
      <div className="relative flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <TeamCrest team={homeTeam} size="lg" />
          <div className="min-w-0">
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">MANDANTE</div>
            <div className="text-lg font-black text-white tracking-tight uppercase truncate">{homeTeam.nome}</div>
            <div className="text-[10px] text-white/40">{homeTeam.estadio_nome}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 flex-shrink-0">
          <div className={cn("text-5xl font-black leading-none tabular-nums transition-all", state.flash?.type === "goal" && state.flash.side === "home" && "text-[#1db954] scale-125")}>
            {state.home.goals}
          </div>
          <div className="text-lg text-white/30 font-light">×</div>
          <div className={cn("text-5xl font-black leading-none tabular-nums transition-all", state.flash?.type === "goal" && state.flash.side === "away" && "text-[#1db954] scale-125")}>
            {state.away.goals}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-1 min-w-0 justify-end">
          <div className="text-right min-w-0">
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/40 uppercase">VISITANTE</div>
            <div className="text-lg font-black text-white tracking-tight uppercase truncate">{awayTeam.nome}</div>
            <div className="text-[10px] text-white/40">{awayTeam.cidade}, {awayTeam.estado}</div>
          </div>
          <TeamCrest team={awayTeam} size="lg" />
        </div>
      </div>
      <div className="relative flex items-center justify-center gap-3 px-6 py-2 border-t border-white/5 bg-black/20 text-[10px] text-white/40">
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
  label, home, away, icon: Icon, ratio,
}: {
  label: string
  home: string | number
  away: string | number
  icon: React.ComponentType<{ className?: string }>
  ratio: number
}) {
  return (
    <div className="bg-[#141414] p-4">
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
          <div className="bg-red-400 h-full transition-all duration-700" style={{ width: `${ratio}%` }} />
          <div className="bg-blue-400 h-full transition-all duration-700" style={{ width: `${100 - ratio}%` }} />
        </div>
      </div>
    </div>
  )
}

function MetaTile({
  icon: Icon, label, value, valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-[#141414] p-4">
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
  event, homeTeam, awayTeam,
}: {
  event: MatchEvent
  homeTeam: Team
  awayTeam: Team
}) {
  const teamColor = event.side === "home" ? homeTeam.cor1 : awayTeam.cor1
  const badgeStyle =
    event.type === "goal" ? { className: "bg-[#1db954] text-black", label: "GOL" }
    : event.type === "yellow_card" ? { className: "bg-yellow-400 text-black", label: "AMA" }
    : event.type === "red_card" ? { className: "bg-red-500 text-white", label: "VER" }
    : event.type === "penalty" ? { className: "bg-purple-400/20 text-purple-300", label: "PEN" }
    : event.type === "post" ? { className: "bg-orange-400/20 text-orange-300", label: "TRA" }
    : event.type === "save" ? { className: "bg-blue-400/20 text-blue-300", label: "DEF" }
    : event.type === "corner" ? { className: "bg-cyan-400/20 text-cyan-300", label: "ESC" }
    : event.type === "foul" ? { className: "bg-white/10 text-white/60", label: "FAL" }
    : event.type === "halftime" ? { className: "bg-white/15 text-white", label: "HT" }
    : event.type === "fulltime" ? { className: "bg-white/15 text-white", label: "FT" }
    : { className: "bg-white/10 text-white/60", label: "INI" }

  return (
    <li className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-bold text-white/40 tabular-nums w-6">{event.minute}&apos;</span>
        <div className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider min-w-[28px] text-center", badgeStyle.className)}>
          {badgeStyle.label}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-snug", event.type === "goal" ? "text-[#1db954] font-semibold" : event.important ? "text-white" : "text-white/70")}>
          {event.text}
        </p>
      </div>
      <div className="h-6 w-1 rounded-full flex-shrink-0" style={{ background: teamColor, opacity: 0.6 }} />
    </li>
  )
}
