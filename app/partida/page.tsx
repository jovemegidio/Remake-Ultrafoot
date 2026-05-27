"use client"

import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  MapPin,
  Clock,
  Users,
  Shirt,
  Check,
  ChevronRight,
  Play,
  Zap,
  TrendingUp,
  Target,
  Star,
  X,
  Cloud,
  Sun,
  CloudRain,
  Settings2,
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

type KitVariant = "home" | "away" | "third"
type Weather = "sunny" | "cloudy" | "rain"

// ─────────────────────────────────────────────────────────────────────────────
// KitSelector
// ─────────────────────────────────────────────────────────────────────────────

function KitSelector({
  team,
  selected,
  onSelect,
  side,
  form,
}: {
  team: Team
  selected: KitVariant
  onSelect: (kit: KitVariant) => void
  side: "home" | "away"
  form?: ("W" | "D" | "L")[]
}) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const uniforms = getTeamUniforms(team)
  const kits: { id: KitVariant; label: string }[] = [
    { id: "home", label: "1" },
    { id: "away", label: "2" },
    { id: "third", label: "3" },
  ]

  return (
    <div className={cn("flex flex-col", side === "away" && "items-end")}>
      <div className={cn("relative mb-6", side === "away" && "flex flex-col items-end")}>
        <div
          className="absolute inset-0 blur-3xl opacity-30 rounded-full scale-150"
          style={{ background: `radial-gradient(circle, ${team.cor1} 0%, transparent 70%)` }}
        />

        <div className="relative">
          <TeamCrest team={team} size="2xl" />
          <div
            className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2"
            style={{
              backgroundColor: team.cor1,
              borderColor: team.cor2,
              color: team.cor2,
            }}
          >
            {team.prestigio}
          </div>
        </div>

        <div className={cn("mt-4", side === "away" && "text-right")}>
          <div
            className="text-[10px] font-bold tracking-[0.3em] mb-1"
            style={{ color: team.cor1 === "#ffffff" ? "#aaa" : team.cor1 }}
          >
            {side === "home" ? "MANDANTE" : "VISITANTE"}
          </div>
          <div className="text-2xl font-black text-white tracking-tight uppercase">{team.nome}</div>
          <div className="text-xs text-white/40 mt-1">
            {team.cidade}, {team.estado}
          </div>
        </div>
      </div>

      <div className={cn("flex gap-2", side === "away" && "flex-row-reverse")}>
        {kits.map(kit => {
          const active = selected === kit.id
          const camisaUrl = getCamisaUrl(team.file_key, kit.id)
          const hasError = imageErrors[kit.id]
          const uniform = uniforms[kit.id]

          return (
            <button
              key={kit.id}
              onClick={() => onSelect(kit.id)}
              className={cn(
                "relative group w-20 h-24 rounded-lg overflow-hidden transition-all duration-300",
                active
                  ? "ring-2 ring-offset-2 ring-offset-[#0a0a0a] scale-105"
                  : "opacity-60 hover:opacity-100 hover:scale-[1.02]",
              )}
              style={{
                background: `linear-gradient(180deg, ${team.cor1}20 0%, ${team.cor2}10 100%)`,
              }}
            >
              <div
                className={cn(
                  "absolute top-1 left-1 h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center z-10 transition-all",
                  active ? "bg-white text-black" : "bg-white/20 text-white/60",
                )}
              >
                {kit.label}
              </div>

              {active && (
                <div
                  className="absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center z-10"
                  style={{ backgroundColor: team.cor1 }}
                >
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center p-2">
                {!hasError ? (
                  <Image
                    src={camisaUrl}
                    alt={`Kit ${kit.label}`}
                    fill
                    className="object-contain p-2 drop-shadow-lg"
                    onError={() => setImageErrors(prev => ({ ...prev, [kit.id]: true }))}
                    unoptimized
                  />
                ) : (
                  <div
                    className="w-12 h-14 rounded flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${uniform.primary} 0%, ${uniform.secondary} 100%)`,
                    }}
                  >
                    <Shirt className="h-5 w-5 text-white/80" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {form && form.length > 0 && (
        <div className={cn("flex items-center gap-1 mt-4", side === "away" && "flex-row-reverse")}>
          <span className="text-[10px] text-white/40 mr-2">FORMA:</span>
          {form.slice(-5).map((result, i) => (
            <div
              key={i}
              className={cn(
                "h-5 w-5 rounded text-[9px] font-bold flex items-center justify-center",
                result === "W" && "bg-green-500/20 text-green-400",
                result === "D" && "bg-yellow-500/20 text-yellow-400",
                result === "L" && "bg-red-500/20 text-red-400",
              )}
            >
              {result === "W" ? "V" : result === "D" ? "E" : "D"}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ───────────────────────────────────�����─────────────────────────────────────────

export default function PreMatchPage() {
  const router = useRouter()
  const { team: userTeam, hydrated } = useUserTeam()
  const { seasonCalendar, currentWeek, currentSeason, registerUserMatchResult, advanceWeek, standings } = useGameManager()

  const [homeKit, setHomeKit] = useState<KitVariant>("home")
  const [awayKit, setAwayKit] = useState<KitVariant>("away")
  const [showLineup, setShowLineup] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showQuickSim, setShowQuickSim] = useState(false)
  const [quickSimResult, setQuickSimResult] = useState<{
    homeGoals: number
    awayGoals: number
    events: SimEvent[]
  } | null>(null)

  // Configurações da partida
  const [duration, setDuration] = useState(90)
  const [weather, setWeather] = useState<Weather>("sunny")
  const [matchMode, setMatchMode] = useState<"normal" | "highlights" | "commentary">("normal")

  // Determina proxima partida do calendario
  const nextMatch = seasonCalendar.nextUserMatch
  
  // Determina adversário baseado na proxima partida do calendario
  const opponent = useMemo(() => {
    if (nextMatch) {
      return nextMatch.homeTeam.curto === userTeam.curto 
        ? nextMatch.awayTeam 
        : nextMatch.homeTeam
    }
    return serieATeams.find(t => t.curto !== userTeam.curto) || serieATeams[1]
  }, [nextMatch, userTeam.curto])
  
  // Verifica se o usuario joga em casa
  const isHome = nextMatch ? nextMatch.homeTeam.curto === userTeam.curto : true

  const matchInfo = {
    competition: nextMatch?.competition || getLeagueName(userTeam.curto),
    competitionId: "brasileirao" as CompetitionId,
    round: nextMatch ? `Rodada ${nextMatch.round}` : `Rodada ${currentWeek + 1}`,
    stadium: isHome ? userTeam.estadio_nome : opponent.estadio_nome,
    city: isHome ? userTeam.cidade : opponent.cidade,
    date: `${currentSeason}`,
    time: "16:00",
    isHome,
  }

  // Obtem tema da competicao
  const competitionTheme = getCompetitionTheme(matchInfo.competitionId)

  const homeTeam = matchInfo.isHome ? userTeam : opponent
  const awayTeam = matchInfo.isHome ? opponent : userTeam

  // Salva no sessionStorage sempre que muda algo
  useEffect(() => {
    if (!hydrated) return
    saveMatchContext({
      homeShort: homeTeam.curto,
      awayShort: awayTeam.curto,
      homeKit,
      awayKit,
      competition: matchInfo.competition,
      round: matchInfo.round,
      duration,
      weather,
      matchMode,
    })
  }, [hydrated, homeTeam.curto, awayTeam.curto, homeKit, awayKit, duration, weather, matchMode])

  const handleQuickSim = useCallback(() => {
    const final = simulateFullMatch({
      homeTeam,
      awayTeam,
      homeRating: teamRating(homeTeam.nome) || homeTeam.prestigio,
      awayRating: teamRating(awayTeam.nome) || awayTeam.prestigio,
      durationMinutes: duration,
      weatherFactor: weather === "rain" ? 0.9 : 1,
    })
    setQuickSimResult({ homeGoals: final.home.goals, awayGoals: final.away.goals, events: final.events })
    setShowQuickSim(true)
  }, [homeTeam, awayTeam, duration, weather])

  // Navegacao por controle na tela de pre-partida
  useEffect(() => {
    const KITS: KitVariant[] = ["home", "away", "third"]
    const cycleKit = (current: KitVariant, dir: 1 | -1): KitVariant =>
      KITS[(KITS.indexOf(current) + dir + 3) % 3]

    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail

      // Fecha modais abertos primeiro
      if (showLineup) {
        if (button === "B") setShowLineup(false)
        return
      }
      if (showSettings) {
        if (button === "B" || button === "Y") setShowSettings(false)
        return
      }
      if (showQuickSim) {
        if (button === "B") { setShowQuickSim(false); setQuickSimResult(null) }
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
        case "SELECT":
          setShowLineup(true)
          break
        // LB/RB ciclam o kit do time mandante
        case "LB":
          setHomeKit(prev => cycleKit(prev, -1))
          break
        case "RB":
          setHomeKit(prev => cycleKit(prev, 1))
          break
        // LT/RT ciclam o kit do time visitante
        case "LT":
          setAwayKit(prev => cycleKit(prev, -1))
          break
        case "RT":
          setAwayKit(prev => cycleKit(prev, 1))
          break
      }
    }

    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [showLineup, showSettings, showQuickSim, router, handleQuickSim])

  if (!hydrated) {
    return (
      <div className="h-screen pl-16 bg-[#050508] flex items-center justify-center text-white/40 text-sm">
        Carregando...
      </div>
    )
  }

  return (
    <div className="h-screen pl-16 bg-[#050508] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="relative rounded-2xl overflow-hidden mb-6">
          {/* Background da competicao */}
          {competitionTheme.backgroundImage && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-30"
              style={{ backgroundImage: `url(${competitionTheme.backgroundImage})` }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${competitionTheme.colors.primary}20 0%, #0a0a0a 40%, #0a0a0a 60%, ${competitionTheme.colors.primary}20 100%)`,
            }}
          />

          <div className="absolute inset-0 opacity-5">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)`,
                backgroundSize: "10px 10px",
              }}
            />
          </div>

          {/* Competition Header */}
          <div className="relative flex items-center justify-center gap-4 py-4 border-b border-white/[0.04]">
            <Image
              src="/logos/brasileirao.png"
              alt="Brasileirão"
              width={40}
              height={40}
              className="object-contain"
            />
            <div className="text-center">
              <div className="text-xs font-bold tracking-[0.2em] text-white/60">
                {matchInfo.competition.toUpperCase()}
              </div>
              <div className="text-[10px] text-white/40">
                {matchInfo.round} · {matchInfo.date}
              </div>
            </div>
          </div>

          <div className="relative px-8 py-10">
            <div className="flex items-center justify-between">
              <KitSelector team={homeTeam} selected={homeKit} onSelect={setHomeKit} side="home" form={standings.find(s => s.teamShort === homeTeam.curto)?.form} />

              <div className="flex flex-col items-center px-8">
                <div className="mb-6 text-center">
                  <div className="text-5xl font-black text-white tracking-tighter">{matchInfo.time}</div>
                  <div className="text-xs text-white/40 mt-1">HORÁRIO LOCAL</div>
                </div>

                <div className="relative">
                  <div className="absolute -left-16 top-1/2 h-px w-12 bg-gradient-to-r from-transparent to-white/20" />
                  <div className="absolute -right-16 top-1/2 h-px w-12 bg-gradient-to-l from-transparent to-white/20" />
                  <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-xl font-black text-white/30">VS</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <MapPin className="h-3.5 w-3.5 text-white/30" />
                    {matchInfo.stadium}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/30">
                    <Users className="h-3 w-3" />
                    {homeTeam.estadio_cap.toLocaleString("pt-BR")} lugares
                  </div>
                </div>
              </div>

              <KitSelector team={awayTeam} selected={awayKit} onSelect={setAwayKit} side="away" form={standings.find(s => s.teamShort === awayTeam.curto)?.form} />
            </div>
          </div>

          <div className="relative flex items-center justify-center gap-8 py-4 border-t border-white/[0.04] bg-black/30">
            <div className="flex items-center gap-2 text-xs">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-white/40">Prestígio:</span>
              <span className="font-bold text-white">{homeTeam.prestigio}</span>
              <span className="text-white/20 mx-2">vs</span>
              <span className="font-bold text-white">{awayTeam.prestigio}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-white/40">H2H:</span>
              <span className="font-bold text-green-400">3V</span>
              <span className="font-bold text-white/40">2E</span>
              <span className="font-bold text-red-400">1D</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-xs">
              <Target className="h-4 w-4 text-blue-400" />
              <span className="text-white/40">Gols esperados:</span>
              <span className="font-bold text-white">2.4</span>
            </div>
          </div>
        </div>

        {homeKit === awayKit && (
          <div className="mb-6 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <span className="text-xs text-yellow-500">
              Uniformes similares selecionados. Considere trocar um deles para evitar confusão visual.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4">
          <Link href="/partida/ao-vivo" className="w-full max-w-md">
            <Button
              size="lg"
              className="relative w-full h-16 text-base font-black tracking-wider bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] text-black hover:from-[#00c8ff] hover:to-[#22e766] overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Play className="mr-3 h-6 w-6 fill-current" />
              INICIAR PARTIDA
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </Link>

          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration} minutos
            </span>
            <span className="text-white/20">·</span>
            <span className="capitalize">
              {matchMode === "normal" ? "Modo Normal" : matchMode === "highlights" ? "Destaques" : "Narração"}
            </span>
            <span className="text-white/20">·</span>
            <span className="capitalize flex items-center gap-1">
              {weather === "sunny" && <Sun className="h-3 w-3" />}
              {weather === "cloudy" && <Cloud className="h-3 w-3" />}
              {weather === "rain" && <CloudRain className="h-3 w-3" />}
              {weather === "sunny" ? "Ensolarado" : weather === "cloudy" ? "Nublado" : "Chuva"}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setShowLineup(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/70 hover:text-white"
          >
            <Users className="h-4 w-4" />
            Ver Escalação
            <ChevronRight className="h-3 w-3" />
          </button>
          <button
            onClick={handleQuickSim}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/70 hover:text-white"
          >
            <Zap className="h-4 w-4" />
            Simular Rápido
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/70 hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
            Configurações
          </button>
        </div>
  </main>
  
  <GamepadControlsBar />
  <MusicPlayer />
  
  {/* Editor Tatico - Ver Escalação */}
      {showLineup && (
        <TacticalEditor
          team={userTeam}
          onClose={() => setShowLineup(false)}
          onSave={(formation, players) => {
            console.log("[v0] Formation saved:", formation, players)
          }}
        />
      )}

      {/* Modal: Simular Rápido - Resultado direto */}
      {showQuickSim && quickSimResult && (
        <Modal
          title="Resultado Final"
          onClose={() => {
            setShowQuickSim(false)
            setQuickSimResult(null)
          }}
        >
          <div className="text-center py-6">
            <div className="space-y-6">
              <div className="text-[10px] font-bold tracking-[0.3em] text-white/50">PLACAR FINAL</div>
              <div className="flex items-center justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <TeamCrest team={homeTeam} size="lg" />
                  <span className="text-xs font-medium text-white/70">{homeTeam.curto}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-black tabular-nums text-white">{quickSimResult.homeGoals}</span>
                  <span className="text-xl font-light text-white/30">×</span>
                  <span className="text-5xl font-black tabular-nums text-white">{quickSimResult.awayGoals}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <TeamCrest team={awayTeam} size="lg" />
                  <span className="text-xs font-medium text-white/70">{awayTeam.curto}</span>
                </div>
              </div>
              <div className="text-xs text-white/40">
                {duration} minutos · {matchInfo.competition}
              </div>
              <div className="flex justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleQuickSim}
                  className="border-white/10 bg-transparent text-white/70 hover:bg-white/5"
                >
                  Simular Novamente
                </Button>
                <Button
                  onClick={async () => {
                    if (quickSimResult) {
                      const engineEvents: EngineEvent[] = quickSimResult.events
                        .filter(e => e.type === "goal")
                        .map(e => ({
                          minute: e.minute,
                          type: "goal" as const,
                          playerId: 0,
                          playerName: e.player ?? (e.side === "home" ? homeTeam.curto : awayTeam.curto),
                        }))
                      registerUserMatchResult(
                        homeTeam.curto,
                        awayTeam.curto,
                        quickSimResult.homeGoals,
                        quickSimResult.awayGoals,
                        engineEvents
                      )
                      await advanceWeek()
                    }
                    setShowQuickSim(false)
                    router.push("/")
                  }}
                  className="bg-[#00ffc8] text-black hover:bg-[#00c8ff] font-bold"
                >
                  Confirmar Resultado
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Configurações da partida */}
      {showSettings && (
        <Modal title="Configurações da Partida" onClose={() => setShowSettings(false)}>
          <div className="space-y-6">
            {/* Duração */}
            <div>
              <label className="text-[10px] font-bold tracking-[0.2em] text-white/50 mb-2 block">
                DURAÇÃO
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 30, label: "30 MIN", sub: "Rápida" },
                  { val: 45, label: "45 MIN", sub: "Curta" },
                  { val: 90, label: "90 MIN", sub: "Padrão" },
                ].map(o => (
                  <button
                    key={o.val}
                    onClick={() => setDuration(o.val)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition",
                      duration === o.val
                        ? "border-[#00ffc8] bg-[#00ffc8]/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <div className="text-sm font-bold text-white">{o.label}</div>
                    <div className="text-[10px] text-white/50">{o.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Clima */}
            <div>
              <label className="text-[10px] font-bold tracking-[0.2em] text-white/50 mb-2 block">
                CLIMA
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { val: "sunny", label: "Ensolarado", icon: Sun, color: "text-yellow-400" },
                    { val: "cloudy", label: "Nublado", icon: Cloud, color: "text-zinc-400" },
                    { val: "rain", label: "Chuva", icon: CloudRain, color: "text-blue-400" },
                  ] as const
                ).map(o => {
                  const Icon = o.icon
                  return (
                    <button
                      key={o.val}
                      onClick={() => setWeather(o.val)}
                      className={cn(
                        "rounded-lg border p-3 flex flex-col items-center gap-2 transition",
                        weather === o.val
                          ? "border-[#00ffc8] bg-[#00ffc8]/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      <Icon className={cn("h-5 w-5", o.color)} />
                      <span className="text-xs font-medium text-white">{o.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Modo */}
            <div>
              <label className="text-[10px] font-bold tracking-[0.2em] text-white/50 mb-2 block">
                MODO DE PARTIDA
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { val: "normal", label: "Normal" },
                    { val: "highlights", label: "Destaques" },
                    { val: "commentary", label: "Narração" },
                  ] as const
                ).map(o => (
                  <button
                    key={o.val}
                    onClick={() => setMatchMode(o.val)}
                    className={cn(
                      "rounded-lg border p-3 text-sm font-medium transition",
                      matchMode === o.val
                        ? "border-[#00ffc8] bg-[#00ffc8]/10 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/[0.04]">
            <Button
              variant="outline"
              onClick={() => setShowSettings(false)}
              className="border-white/10 bg-transparent text-white/70 hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => setShowSettings(false)}
              className="bg-[#00ffc8] text-black hover:bg-[#00c8ff] font-bold"
            >
              <Check className="mr-2 h-4 w-4" />
              Aplicar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes utilitários
// ─────────────────────────────────────────────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-white/10 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

