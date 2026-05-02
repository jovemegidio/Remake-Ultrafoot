"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useState } from "react"
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
  Timer,
  ArrowLeftRight,
  FastForward,
  Pause,
  Play,
  SkipForward,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { ClubCrest } from "@/components/club-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Dynamic import for 3D component to avoid SSR issues
const TacticalPitch3D = dynamic(
  () => import("@/components/tactical-pitch-3d").then((mod) => mod.TacticalPitch3D),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gradient-to-b from-[#0a1628] to-[#071018] rounded-lg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-display tracking-wider">
            CARREGANDO CAMPO 3D
          </span>
        </div>
      </div>
    )
  }
)

const speeds = [
  { id: "pause", label: "PAUSAR", icon: Pause },
  { id: "normal", label: "1X", icon: Play },
  { id: "fast", label: "2X", icon: FastForward },
  { id: "ultra", label: "4X", icon: SkipForward },
]

const stats = [
  { label: "POSSE", home: "34.2%", away: "65.8%", icon: Activity, ratio: 34.2 },
  { label: "FINALIZACOES", home: "2", away: "5", icon: TargetIcon, ratio: 28.5 },
  { label: "NO ALVO", home: "1", away: "3", icon: TargetIcon, ratio: 25 },
  { label: "XG", home: "0.12", away: "0.86", icon: Sparkles, ratio: 12 },
  { label: "ESCANTEIOS", home: "1", away: "3", icon: Flag, ratio: 25 },
  { label: "FALTAS", home: "4", away: "2", icon: AlertTriangle, ratio: 66.6 },
]

const events = [
  { min: 18, type: "goal", side: "away", text: "GOOOOL! Hulk cobra penalti e abre o placar!" },
  { min: 15, type: "penalty", side: "away", text: "Penalti marcado! Falta de Joao no atacante" },
  { min: 8, type: "chance", side: "away", text: "Hulk arrisca de longe - defesa do goleiro" },
  { min: 6, type: "card", side: "home", text: "Cartao amarelo - #14 Ricardo" },
  { min: 3, type: "kick-off", side: "home", text: "Bola rolando! Mandante comeca o jogo" },
]

// Sample player data for 4-3-3 formation
const homePlayers = [
  { id: 1, x: 5, y: 50, number: 1, name: "GK", rating: 75, position: "GK" },
  { id: 2, x: 20, y: 15, number: 2, name: "LD", rating: 72, position: "RB" },
  { id: 3, x: 20, y: 38, number: 3, name: "ZAG", rating: 74, position: "CB" },
  { id: 4, x: 20, y: 62, number: 4, name: "ZAG", rating: 76, position: "CB" },
  { id: 5, x: 20, y: 85, number: 6, name: "LE", rating: 71, position: "LB" },
  { id: 6, x: 38, y: 25, number: 5, name: "VOL", rating: 73, position: "CDM" },
  { id: 7, x: 38, y: 50, number: 8, name: "MEI", rating: 77, position: "CM" },
  { id: 8, x: 38, y: 75, number: 10, name: "MEI", rating: 79, position: "CM" },
  { id: 9, x: 52, y: 20, number: 7, name: "PD", rating: 76, position: "RW" },
  { id: 10, x: 52, y: 50, number: 9, name: "CA", rating: 78, position: "ST" },
  { id: 11, x: 52, y: 80, number: 11, name: "PE", rating: 75, position: "LW" },
]

const awayPlayers = [
  { id: 12, x: 95, y: 50, number: 1, name: "Everson", rating: 82, position: "GK" },
  { id: 13, x: 80, y: 85, number: 2, name: "Mariano", rating: 78, position: "RB" },
  { id: 14, x: 80, y: 62, number: 3, name: "Battaglia", rating: 80, position: "CB" },
  { id: 15, x: 80, y: 38, number: 4, name: "Rabello", rating: 79, position: "CB" },
  { id: 16, x: 80, y: 15, number: 6, name: "Arana", rating: 83, position: "LB" },
  { id: 17, x: 62, y: 75, number: 5, name: "Otavio", rating: 81, position: "CDM" },
  { id: 18, x: 62, y: 50, number: 8, name: "Scarpa", rating: 84, position: "CM" },
  { id: 19, x: 62, y: 25, number: 10, name: "Bernard", rating: 80, position: "CM" },
  { id: 20, x: 48, y: 80, number: 7, name: "Paulinho", rating: 85, position: "RW" },
  { id: 21, x: 48, y: 50, number: 9, name: "Hulk", rating: 87, position: "ST" },
  { id: 22, x: 48, y: 20, number: 11, name: "Zaracho", rating: 82, position: "LW" },
]

export default function MatchCenterPage() {
  const [speed, setSpeed] = useState("normal")
  const [matchMinute, setMatchMinute] = useState(18)

  return (
    <div className="min-h-screen pl-16 pb-4 bg-background">
      <GameSidebar />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid-small opacity-10" />
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 50% 0%, oklch(0.60 0.24 25 / 0.08) 0%, transparent 40%),
              radial-gradient(ellipse at 50% 100%, oklch(0.75 0.18 195 / 0.05) 0%, transparent 40%)
            `,
          }}
        />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 glass-panel px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/partida"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 hover:bg-card hover:border-primary/50 transition"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display-italic text-2xl tracking-tight text-gradient-primary">PARTIDA AO VIVO</h1>
          <div className="flex items-center gap-2 ml-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
            </span>
            <span className="text-[10px] font-display tracking-widest text-destructive">AO VIVO</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {speeds.map((s) => {
            const Icon = s.icon
            const active = speed === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSpeed(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-4 py-2 font-display tracking-wider text-[11px] transition",
                  active
                    ? "border-accent bg-accent text-accent-foreground shadow-glow-accent"
                    : "border-border/50 bg-card/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            )
          })}
        </div>
      </header>

      <main className="relative z-10 space-y-4 p-4">
        {/* Scoreboard */}
        <section className="relative overflow-hidden rounded-xl border border-border/50 glass-panel">
          {/* Corner accents */}
          <div className="absolute top-3 left-3 w-12 h-12 border-l-2 border-t-2 border-primary/30" />
          <div className="absolute top-3 right-3 w-12 h-12 border-r-2 border-t-2 border-primary/30" />
          
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-8 px-10 py-8">
            {/* Home */}
            <div className="flex items-center justify-end gap-5">
              <div className="text-right">
                <div className="text-[9px] font-display tracking-[0.3em] text-muted-foreground mb-1">
                  MANDANTE
                </div>
                <div className="font-display-italic text-3xl">POUSO ALEGRE</div>
                <div className="text-xs text-muted-foreground mt-1">4-3-3</div>
              </div>
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-br from-destructive/30 to-transparent rounded-full blur-xl" />
                <ClubCrest
                  abbr="PAL"
                  size="lg"
                  primary="oklch(0.60 0.24 25)"
                  secondary="oklch(0.08 0.02 260)"
                />
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-6">
                <div className="font-display-italic text-8xl leading-none tabular-nums text-destructive/80">0</div>
                <div className="flex flex-col items-center">
                  <div className="font-display text-2xl text-muted-foreground">:</div>
                  <div className="mt-2 flex items-center gap-2 rounded-full bg-accent/10 border border-accent/20 px-4 py-1.5">
                    <Timer className="h-3.5 w-3.5 text-accent" />
                    <span className="font-display tracking-wider text-accent text-sm">{matchMinute}&apos;</span>
                  </div>
                </div>
                <div className="font-display-italic text-8xl leading-none tabular-nums text-primary">1</div>
              </div>
            </div>

            {/* Away */}
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-br from-primary/30 to-transparent rounded-full blur-xl" />
                <ClubCrest
                  abbr="CAM"
                  size="lg"
                  primary="oklch(0.08 0.02 260)"
                  secondary="oklch(0.95 0.01 240)"
                />
              </div>
              <div>
                <div className="text-[9px] font-display tracking-[0.3em] text-muted-foreground mb-1">
                  VISITANTE
                </div>
                <div className="font-display-italic text-3xl">ATLETICO-MG</div>
                <div className="text-xs text-muted-foreground mt-1">4-2-3-1</div>
              </div>
            </div>
          </div>
        </section>

        {/* Meta info */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/50 md:grid-cols-4">
          <MetaTile icon={CalendarDays} label="COMPETICAO" value="Camp. Mineiro" />
          <MetaTile icon={Cloud} label="CLIMA" value="Chuva" sub="22C" />
          <MetaTile icon={Activity} label="GRAMADO" value="54/100" sub="Encharcado" valueClass="text-destructive" />
          <MetaTile icon={Users} label="PUBLICO" value="15.526" sub="78% ocupacao" />
        </div>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/50 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <StatCell key={s.label} {...s} />
          ))}
        </section>

        {/* Substitutions bar */}
        <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border/50 glass-panel p-4">
          <Button className="btn-eafc font-display tracking-wider shadow-glow-accent">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            SUBSTITUIR
          </Button>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-display tracking-widest text-accent">
              5 RESTANTES
            </span>
            <span className="text-xs text-muted-foreground">Nenhuma alteracao realizada</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-[10px] font-display tracking-[0.2em] text-muted-foreground">
              FORMACAO ATUAL
            </span>
            <span className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-sm font-display tracking-wider text-primary">
              4-3-3
            </span>
          </div>
        </section>

        {/* Pitch + events */}
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* 3D Pitch */}
          <section className="overflow-hidden rounded-xl border border-border/50 glass-panel">
            <div className="flex items-center justify-between border-b border-border/50 bg-card/30 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-display tracking-wider text-sm">CAMPO TATICO 3D</h2>
                  <p className="text-[10px] text-muted-foreground">Arraste para rotacionar a visao</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-destructive shadow-glow-primary" style={{ boxShadow: "0 0 8px oklch(0.60 0.24 25)" }} />
                  Mandante
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary shadow-glow-primary" />
                  Visitante
                </span>
              </div>
            </div>
            <div className="h-[500px]">
              <TacticalPitch3D
                homePlayers={homePlayers}
                awayPlayers={awayPlayers}
                homeColor="#ef4444"
                awayColor="#22d3ee"
              />
            </div>
          </section>

          {/* Events */}
          <section className="overflow-hidden rounded-xl border border-border/50 glass-panel">
            <div className="flex items-center justify-between border-b border-border/50 bg-card/30 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
                  <Goal className="h-4 w-4 text-accent" />
                </div>
                <h2 className="font-display tracking-wider text-sm">EVENTOS</h2>
              </div>
              <span className="text-[9px] text-muted-foreground tracking-widest font-display bg-card/50 px-2 py-1 rounded">
                MOMENTUM
              </span>
            </div>

            {/* Momentum graph */}
            <div className="px-5 py-4 border-b border-border/50">
              <div className="text-[9px] font-display tracking-[0.2em] text-muted-foreground mb-3">
                MOMENTO DA PARTIDA
              </div>
              <div className="relative h-16 w-full overflow-hidden rounded-lg bg-muted/50">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="momentum-gradient" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0" stopColor="oklch(0.60 0.24 25)" />
                      <stop offset="0.5" stopColor="oklch(0.75 0.18 195)" />
                      <stop offset="1" stopColor="oklch(0.75 0.18 195)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,20 Q10,25 20,18 T40,12 T60,8 T80,6 T100,4 L100,40 L0,40 Z"
                    fill="url(#momentum-gradient)"
                    opacity="0.4"
                  />
                  <path
                    d="M0,20 Q10,25 20,18 T40,12 T60,8 T80,6 T100,4"
                    stroke="oklch(0.75 0.18 195)"
                    strokeWidth="0.8"
                    fill="none"
                  />
                </svg>
                {/* Current position marker */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-accent"
                  style={{ left: `${(matchMinute / 90) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-muted-foreground tabular-nums font-display tracking-wider">
                <span>0&apos;</span>
                <span>45&apos;</span>
                <span>90&apos;</span>
              </div>
            </div>

            {/* Event list */}
            <ul className="max-h-[340px] overflow-y-auto divide-y divide-border/50 scrollbar-thin">
              {events.map((e, i) => (
                <li key={i} className="flex items-start gap-4 px-5 py-4 hover:bg-card/30 transition">
                  <div
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-sm tabular-nums",
                      e.side === "home"
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : "bg-primary/10 text-primary border border-primary/20",
                    )}
                  >
                    {e.min}&apos;
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      "text-[9px] font-display tracking-[0.2em] mb-1",
                      e.type === "goal" ? "text-accent" : 
                      e.type === "card" ? "text-gold" : 
                      e.type === "penalty" ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {e.type === "goal" ? "GOL" :
                       e.type === "card" ? "CARTAO AMARELO" :
                       e.type === "penalty" ? "PENALTI" :
                       e.type === "chance" ? "GRANDE CHANCE" : "INICIO"}
                    </div>
                    <p className="text-sm text-foreground/90 leading-snug">{e.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

function MetaTile({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="bg-card/50 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[9px] font-display tracking-[0.2em] text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className={cn("font-display tracking-wide text-lg", valueClass)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
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
    <div className="bg-card/50 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[9px] font-display tracking-[0.2em] text-muted-foreground mb-3">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display-italic text-xl tabular-nums text-destructive">{home}</span>
        <span className="text-muted-foreground text-xs font-display">VS</span>
        <span className="font-display-italic text-xl tabular-nums text-primary">{away}</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div className="flex h-full">
          <div className="bg-destructive h-full transition-all" style={{ width: `${ratio}%` }} />
          <div className="bg-primary h-full transition-all" style={{ width: `${100 - ratio}%` }} />
        </div>
      </div>
    </div>
  )
}
