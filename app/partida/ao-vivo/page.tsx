"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ChevronLeft,
  Repeat2,
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
  X,
  Check,
  ChevronRight,
  Timer,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort } from "@/lib/teams-data"

// Teams for this match
const homeTeam = getTeamByShort("PAL") || getTeamByShort("BTF")!
const awayTeam = getTeamByShort("TLT") || getTeamByShort("FLM")!

// Mock player data
const homePlayers = [
  { id: 1, name: "Silva", number: 1, position: "GOL", rating: 78, stamina: 100 },
  { id: 2, name: "Santos", number: 2, position: "LD", rating: 72, stamina: 85 },
  { id: 3, name: "Oliveira", number: 3, position: "ZAG", rating: 75, stamina: 90 },
  { id: 4, name: "Costa", number: 4, position: "ZAG", rating: 74, stamina: 88 },
  { id: 5, name: "Ferreira", number: 6, position: "LE", rating: 71, stamina: 82 },
  { id: 6, name: "Souza", number: 5, position: "VOL", rating: 76, stamina: 78 },
  { id: 7, name: "Almeida", number: 8, position: "MEI", rating: 77, stamina: 75 },
  { id: 8, name: "Rodrigues", number: 10, position: "MEI", rating: 80, stamina: 70 },
  { id: 9, name: "Lima", number: 7, position: "PE", rating: 79, stamina: 72 },
  { id: 10, name: "Pereira", number: 9, position: "ATA", rating: 82, stamina: 68 },
  { id: 11, name: "Martins", number: 11, position: "PD", rating: 78, stamina: 74 },
]

const homeBench = [
  { id: 12, name: "Gomes", number: 12, position: "GOL", rating: 70, stamina: 100 },
  { id: 13, name: "Ribeiro", number: 13, position: "ZAG", rating: 69, stamina: 100 },
  { id: 14, name: "Araujo", number: 14, position: "VOL", rating: 71, stamina: 100 },
  { id: 15, name: "Barbosa", number: 15, position: "MEI", rating: 73, stamina: 100 },
  { id: 16, name: "Carvalho", number: 16, position: "ATA", rating: 74, stamina: 100 },
]

const speeds = [
  { id: "slow", label: "LENTO" },
  { id: "normal", label: "NORMAL" },
  { id: "fast", label: "RAPIDO" },
  { id: "ultra", label: "ULTRA" },
  { id: "hyper", label: "HIPER" },
]

const stats = [
  { label: "POSSE", home: "34.2%", away: "65.8%", icon: Activity, ratio: 34.2 },
  { label: "FINALIZACOES", home: "3", away: "8", icon: TargetIcon, ratio: 27 },
  { label: "NO ALVO", home: "1", away: "4", icon: TargetIcon, ratio: 20 },
  { label: "XG", home: "0.32", away: "1.16", icon: Sparkles, ratio: 22 },
  { label: "ESCANTEIOS", home: "2", away: "5", icon: Flag, ratio: 29 },
  { label: "FALTAS", home: "4", away: "2", icon: AlertTriangle, ratio: 67 },
]

const initialEvents = [
  { min: 42, type: "goal", side: "away", text: "GOOOOL! Hulk cobra penalti no canto esquerdo" },
  { min: 38, type: "penalty", side: "away", text: "Penalti para o visitante! Falta de Costa" },
  { min: 32, type: "chance", side: "home", text: "Pereira cabeceia - bola na trave!" },
  { min: 28, type: "sub", side: "away", text: "Substituicao: Sai Zaracho, entra Scarpa" },
  { min: 18, type: "chance", side: "away", text: "Hulk arrisca de longe - defesa do goleiro" },
  { min: 12, type: "card", side: "home", text: "Cartao amarelo - #14 Araujo" },
  { min: 3, type: "kick-off", side: "home", text: "Bola rolando! Mandante comeca o jogo" },
]

export default function MatchCenterPage() {
  const [speed, setSpeed] = useState("normal")
  const [showSubModal, setShowSubModal] = useState(false)
  const [selectedPlayerOut, setSelectedPlayerOut] = useState<typeof homePlayers[0] | null>(null)
  const [selectedPlayerIn, setSelectedPlayerIn] = useState<typeof homeBench[0] | null>(null)
  const [subsRemaining, setSubsRemaining] = useState(5)
  const [events, setEvents] = useState(initialEvents)
  const [matchMinute, setMatchMinute] = useState(45)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(1)
  const [selectedPitchPlayer, setSelectedPitchPlayer] = useState<number | null>(null)
  const [goalAnimation, setGoalAnimation] = useState<"home" | "away" | null>(null)
  const [cardAnimation, setCardAnimation] = useState<"yellow" | "red" | null>(null)

  // Simulate goal animation
  const triggerGoalAnimation = (side: "home" | "away") => {
    setGoalAnimation(side)
    if (side === "home") setHomeScore(prev => prev + 1)
    else setAwayScore(prev => prev + 1)
    setTimeout(() => setGoalAnimation(null), 3000)
  }

  // Simulate card animation  
  const triggerCardAnimation = (type: "yellow" | "red") => {
    setCardAnimation(type)
    setTimeout(() => setCardAnimation(null), 2000)
  }

  const handleSubstitution = () => {
    if (selectedPlayerOut && selectedPlayerIn && subsRemaining > 0) {
      // Add substitution event
      const newEvent = {
        min: matchMinute,
        type: "sub" as const,
        side: "home" as const,
        text: `Substituicao: Sai ${selectedPlayerOut.name}, entra ${selectedPlayerIn.name}`,
      }
      setEvents([newEvent, ...events])
      setSubsRemaining(subsRemaining - 1)
      setShowSubModal(false)
      setSelectedPlayerOut(null)
      setSelectedPlayerIn(null)
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "goal": return "GOL"
      case "card": return "CAR"
      case "chance": return "CHA"
      case "sub": return "SUB"
      case "penalty": return "PEN"
      default: return "INI"
    }
  }

  const getEventColor = (type: string, side: string) => {
    if (type === "goal") return "bg-[#1db954] text-black"
    if (type === "card") return "bg-yellow-400 text-black"
    if (type === "penalty") return "bg-red-400 text-white"
    return side === "home" ? "bg-red-400/20 text-red-400" : "bg-blue-400/20 text-blue-400"
  }

  return (
    <div className="min-h-screen pl-[72px] pb-4 bg-[#0a0a0a]">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/95 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/partida"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5 transition text-white/60 hover:text-white"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold text-white">Partida</h1>
          <span className="ml-2 flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-medium tracking-wider text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            AO VIVO
          </span>
          <span className="ml-2 px-2 py-1 rounded bg-white/10 text-xs font-bold text-white tabular-nums">
            {matchMinute}&apos;
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white">
            <Repeat2 className="mr-1 h-3.5 w-3.5" />
            Replay
          </Button>
          <Button
            size="sm"
            className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760]"
          >
            2X
          </Button>
        </div>
      </header>

      <main className="space-y-4 p-4">
        {/* Goal Animation Overlay */}
        {goalAnimation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/60 animate-fade-in" />
            <div className="relative flex flex-col items-center gap-4 animate-scale-in">
              <div className={cn(
                "text-8xl font-black tracking-tighter animate-bounce",
                goalAnimation === "home" ? "text-red-500" : "text-yellow-400"
              )}>
                GOOOOL!
              </div>
              <TeamCrest team={goalAnimation === "home" ? homeTeam : awayTeam} size="xl" />
              <div className="text-2xl font-bold text-white">
                {goalAnimation === "home" ? homeTeam?.nome : awayTeam?.nome}
              </div>
            </div>
          </div>
        )}

        {/* Card Animation Overlay */}
        {cardAnimation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/60 animate-fade-in" />
            <div className="relative animate-scale-in">
              <div className={cn(
                "w-20 h-28 rounded-lg shadow-2xl animate-card-show",
                cardAnimation === "yellow" ? "bg-yellow-400" : "bg-red-500"
              )} />
              <div className={cn(
                "absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm font-bold uppercase tracking-wider whitespace-nowrap",
                cardAnimation === "yellow" ? "text-yellow-400" : "text-red-500"
              )}>
                Cartao {cardAnimation === "yellow" ? "Amarelo" : "Vermelho"}
              </div>
            </div>
          </div>
        )}

        {/* Scoreboard - EA FC 26 Style */}
        <section className="relative overflow-hidden rounded-xl border border-white/5 bg-[#141414]">
          <div className="relative flex items-center justify-center gap-4 px-6 py-4">
            {/* Home Team */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[9px] font-medium tracking-wider text-white/40 uppercase">
                  Mandante
                </div>
                <div className="text-lg font-bold text-white tracking-wide uppercase">
                  {homeTeam?.nome || "MANDANTE"}
                </div>
              </div>
              <div className="relative">
                <TeamCrest team={homeTeam} size="md" />
                {goalAnimation === "home" && (
                  <div className="absolute inset-0 animate-ping rounded-full bg-[#1db954]/50" />
                )}
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center gap-3 px-4">
              <div className={cn(
                "text-5xl font-bold leading-none tabular-nums transition-all duration-300",
                goalAnimation === "home" ? "text-[#1db954] scale-125" : "text-white"
              )}>
                {homeScore}
              </div>
              <div className="text-lg text-white/30 font-light">x</div>
              <div className={cn(
                "text-5xl font-bold leading-none tabular-nums transition-all duration-300",
                goalAnimation === "away" ? "text-[#1db954] scale-125" : "text-white"
              )}>
                {awayScore}
              </div>
            </div>

            {/* Away Team */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <TeamCrest team={awayTeam} size="md" />
                {goalAnimation === "away" && (
                  <div className="absolute inset-0 animate-ping rounded-full bg-[#1db954]/50" />
                )}
              </div>
              <div className="text-left">
                <div className="text-[9px] font-medium tracking-wider text-white/40 uppercase">
                  Visitante
                </div>
                <div className="text-lg font-bold text-white tracking-wide uppercase">
                  {awayTeam?.nome || "VISITANTE"}
                </div>
              </div>
            </div>
          </div>

          {/* Test buttons for animations (dev only) */}
          <div className="flex items-center justify-center gap-2 pb-3">
            <button
              onClick={() => triggerGoalAnimation("home")}
              className="px-2 py-1 text-[9px] rounded bg-[#1db954]/20 text-[#1db954] hover:bg-[#1db954]/30"
            >
              Gol Casa
            </button>
            <button
              onClick={() => triggerGoalAnimation("away")}
              className="px-2 py-1 text-[9px] rounded bg-[#1db954]/20 text-[#1db954] hover:bg-[#1db954]/30"
            >
              Gol Fora
            </button>
            <button
              onClick={() => triggerCardAnimation("yellow")}
              className="px-2 py-1 text-[9px] rounded bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30"
            >
              Amarelo
            </button>
            <button
              onClick={() => triggerCardAnimation("red")}
              className="px-2 py-1 text-[9px] rounded bg-red-400/20 text-red-400 hover:bg-red-400/30"
            >
              Vermelho
            </button>
          </div>
        </section>

        {/* Speed Control */}
        <section className="rounded-xl border border-white/5 bg-[#141414] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer className="h-4 w-4 text-[#1db954]" />
              <span className="text-xs font-medium text-white/60">Velocidade da Simulacao</span>
            </div>
            <div className="flex items-center gap-1.5">
              {speeds.map((s) => {
                const active = speed === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSpeed(s.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-[10px] font-medium transition",
                      active
                        ? "border-[#1db954] bg-[#1db954] text-black"
                        : "border-white/10 bg-[#1a1a1a] text-white/70 hover:border-white/20",
                    )}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/5 bg-white/5 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <StatCell key={s.label} {...s} />
          ))}
        </section>

        {/* Substitution Panel */}
        <section className="rounded-xl border border-white/5 bg-[#141414] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setShowSubModal(true)}
                className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760]"
                disabled={subsRemaining === 0}
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Substituir
              </Button>
              <span className={cn(
                "rounded-full px-3 py-1 text-[10px] font-medium tracking-wider",
                subsRemaining > 2 ? "bg-[#1db954]/15 text-[#1db954]" : 
                subsRemaining > 0 ? "bg-yellow-400/15 text-yellow-400" : "bg-red-400/15 text-red-400"
              )}>
                {subsRemaining} RESTANTES
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/50">
              <span>Formacao: <strong className="text-white">4-3-3</strong></span>
              <span>Moral: <strong className="text-[#1db954]">Alta</strong></span>
            </div>
          </div>
        </section>

        {/* Pitch + Events */}
        <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
          {/* Pitch */}
          <section className="overflow-hidden rounded-xl border border-white/5 bg-[#141414]">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#1db954]" />
                <h2 className="text-xs font-medium text-white tracking-wider">CAMPO TATICO</h2>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  Mandante
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                  Visitante
                </span>
              </div>
            </div>
            <Pitch 
              selectedPlayer={selectedPitchPlayer} 
              onSelectPlayer={setSelectedPitchPlayer}
              players={homePlayers}
            />
          </section>

          {/* Events */}
          <section className="overflow-hidden rounded-xl border border-white/5 bg-[#141414]">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Goal className="h-4 w-4 text-[#1db954]" />
                <h2 className="text-xs font-medium text-white tracking-wider">EVENTOS</h2>
              </div>
              <span className="text-[10px] text-white/40 font-medium">
                {events.length} eventos
              </span>
            </div>

            {/* Event list */}
            <ul className="max-h-[400px] overflow-y-auto divide-y divide-white/5">
              {events.map((e, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/40 tabular-nums w-6">
                      {e.min}&apos;
                    </span>
                    <div className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider",
                      getEventColor(e.type, e.side)
                    )}>
                      {getEventIcon(e.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm leading-snug",
                      e.type === "goal" ? "text-[#1db954] font-semibold" : "text-white/80"
                    )}>
                      {e.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Meta Info */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/5 bg-white/5 md:grid-cols-4">
          <MetaTile icon={CalendarDays} label="COMPETICAO" value="Camp. Mineiro" />
          <MetaTile icon={Cloud} label="CLIMA" value="Chuva · 22°C" />
          <MetaTile icon={Activity} label="GRAMADO" value="54/100" valueClass="text-yellow-400" />
          <MetaTile icon={Users} label="PUBLICO" value="15.526" />
        </section>
      </main>

      {/* Substitution Modal */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 rounded-xl bg-[#141414] border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white">Realizar Substituicao</h3>
              <button 
                onClick={() => {
                  setShowSubModal(false)
                  setSelectedPlayerOut(null)
                  setSelectedPlayerIn(null)
                }}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 grid md:grid-cols-2 gap-6">
              {/* Player Out */}
              <div>
                <h4 className="text-xs font-medium text-white/50 tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  SAI DE CAMPO
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {homePlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerOut(player)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                        selectedPlayerOut?.id === player.id
                          ? "border-red-400 bg-red-400/10"
                          : "border-white/5 bg-white/[0.02] hover:border-white/10"
                      )}
                    >
                      <div className="h-8 w-8 rounded-full bg-red-400 flex items-center justify-center text-xs font-bold text-white">
                        {player.number}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{player.name}</div>
                        <div className="text-[10px] text-white/50">{player.position} - RAT {player.rating}</div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-xs font-medium",
                          player.stamina > 70 ? "text-[#1db954]" :
                          player.stamina > 40 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {player.stamina}%
                        </div>
                        <div className="text-[9px] text-white/40">Energia</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Player In */}
              <div>
                <h4 className="text-xs font-medium text-white/50 tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#1db954]" />
                  ENTRA EM CAMPO
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {homeBench.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerIn(player)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                        selectedPlayerIn?.id === player.id
                          ? "border-[#1db954] bg-[#1db954]/10"
                          : "border-white/5 bg-white/[0.02] hover:border-white/10"
                      )}
                    >
                      <div className="h-8 w-8 rounded-full bg-[#1a1a1a] border border-white/20 flex items-center justify-center text-xs font-bold text-white">
                        {player.number}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{player.name}</div>
                        <div className="text-[10px] text-white/50">{player.position} - RAT {player.rating}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-[#1db954]">
                          {player.stamina}%
                        </div>
                        <div className="text-[9px] text-white/40">Energia</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/[0.02]">
              <div className="text-xs text-white/50">
                {selectedPlayerOut && selectedPlayerIn ? (
                  <span className="text-white">
                    {selectedPlayerOut.name} <ChevronRight className="inline h-3 w-3 mx-1" /> {selectedPlayerIn.name}
                  </span>
                ) : (
                  "Selecione os jogadores"
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSubModal(false)
                    setSelectedPlayerOut(null)
                    setSelectedPlayerIn(null)
                  }}
                  className="text-xs border-white/10 bg-transparent text-white/70 hover:bg-white/5"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubstitution}
                  disabled={!selectedPlayerOut || !selectedPlayerIn}
                  className="text-xs bg-[#1db954] text-black hover:bg-[#1ed760] disabled:opacity-50"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
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
    <div className="bg-[#141414] p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-white/40">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("mt-1 text-base font-semibold leading-tight text-white", valueClass)}>{value}</div>
    </div>
  )
}

function StatCell({
  label,
  home,
  away,
  icon: Icon,
  ratio,
}: {
  label: string
  home: string
  away: string
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
        <span className="text-lg font-bold tabular-nums text-red-400">{home}</span>
        <span className="text-white/20 text-xs">vs</span>
        <span className="text-lg font-bold tabular-nums text-blue-400">{away}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="flex h-full">
          <div className="bg-red-400 h-full transition-all" style={{ width: `${ratio}%` }} />
          <div className="bg-blue-400 h-full transition-all" style={{ width: `${100 - ratio}%` }} />
        </div>
      </div>
    </div>
  )
}

function Pitch({
  selectedPlayer,
  onSelectPlayer,
  players,
}: {
  selectedPlayer: number | null
  onSelectPlayer: (id: number | null) => void
  players: typeof homePlayers
}) {
  // Formation positions for 4-3-3
  const positions = [
    { x: 10, y: 50 },  // GK
    { x: 25, y: 15 },  // LB
    { x: 25, y: 38 },  // CB
    { x: 25, y: 62 },  // CB
    { x: 25, y: 85 },  // RB
    { x: 45, y: 30 },  // CM
    { x: 45, y: 50 },  // CM
    { x: 45, y: 70 },  // CM
    { x: 65, y: 20 },  // LW
    { x: 65, y: 50 },  // ST
    { x: 65, y: 80 },  // RW
  ]

  const awayPositions = positions.map((p) => ({ x: 100 - p.x, y: p.y }))

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-b from-[oklch(0.42_0.14_145)] via-[oklch(0.32_0.11_145)] to-[oklch(0.42_0.14_145)]">
      {/* Stripes */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 8%, rgba(0,0,0,0.15) 8% 16%)",
        }}
      />

      {/* Field markings */}
      <svg viewBox="0 0 100 62.5" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <g stroke="rgba(255,255,255,0.5)" strokeWidth="0.2" fill="none">
          <rect x="2" y="2" width="96" height="58.5" />
          <line x1="50" y1="2" x2="50" y2="60.5" />
          <circle cx="50" cy="31.25" r="8" />
          <circle cx="50" cy="31.25" r="0.5" fill="rgba(255,255,255,0.5)" />
          {/* Left box */}
          <rect x="2" y="16" width="14" height="30.5" />
          <rect x="2" y="22" width="5" height="18.5" />
          <path d="M 16 26 A 8 8 0 0 1 16 36.5" />
          {/* Right box */}
          <rect x="84" y="16" width="14" height="30.5" />
          <rect x="93" y="22" width="5" height="18.5" />
          <path d="M 84 26 A 8 8 0 0 0 84 36.5" />
        </g>
      </svg>

      {/* Home Players */}
      {positions.map((pos, i) => {
        const player = players[i]
        if (!player) return null
        const isSelected = selectedPlayer === player.id
        return (
          <button
            key={player.id}
            onClick={() => onSelectPlayer(isSelected ? null : player.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all",
              isSelected 
                ? "bg-red-500 text-white ring-2 ring-white scale-110" 
                : "bg-red-400 text-white hover:scale-105",
              player.stamina < 50 && "ring-2 ring-yellow-400"
            )}>
              {player.number}
              {/* Stamina indicator */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-black/30 overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all",
                    player.stamina > 70 ? "bg-[#1db954]" :
                    player.stamina > 40 ? "bg-yellow-400" : "bg-red-400"
                  )}
                  style={{ width: `${player.stamina}%` }}
                />
              </div>
            </div>
            {/* Player tooltip */}
            {isSelected && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
                  <div className="text-xs font-semibold text-white">{player.name}</div>
                  <div className="text-[10px] text-white/50">{player.position} - RAT {player.rating}</div>
                  <div className={cn(
                    "text-[10px] font-medium mt-1",
                    player.stamina > 70 ? "text-[#1db954]" :
                    player.stamina > 40 ? "text-yellow-400" : "text-red-400"
                  )}>
                    Energia: {player.stamina}%
                  </div>
                </div>
              </div>
            )}
          </button>
        )
      })}

      {/* Away Players */}
      {awayPositions.map((pos, i) => (
        <div
          key={`away-${i}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-400 text-xs font-bold text-white opacity-80">
            {i + 1}
          </div>
        </div>
      ))}
    </div>
  )
}
