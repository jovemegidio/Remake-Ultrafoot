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
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { ClubCrest } from "@/components/club-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const speeds = [
  { id: "slow", label: "LENTO" },
  { id: "normal", label: "NORMAL" },
  { id: "fast", label: "RÁPIDO" },
  { id: "ultra", label: "ULTRA" },
  { id: "hyper", label: "HIPER" },
]

const stats = [
  { label: "POSSE", home: "34.2%", away: "65.8%", icon: Activity, ratio: 34.2 },
  { label: "FINALIZAÇÕES", home: "0", away: "0", icon: TargetIcon, ratio: 50 },
  { label: "NO ALVO", home: "0", away: "0", icon: TargetIcon, ratio: 50 },
  { label: "XG", home: "0.00", away: "0.16", icon: Sparkles, ratio: 0 },
  { label: "ESCANTEIOS", home: "0", away: "0", icon: Flag, ratio: 50 },
  { label: "FALTAS", home: "0", away: "0", icon: AlertTriangle, ratio: 50 },
]

const events = [
  { min: 8, type: "chance", side: "away", text: "Hulk arrisca de longe — defesa do goleiro" },
  { min: 6, type: "card", side: "home", text: "Cartão amarelo · #14 Ricardo" },
  { min: 3, type: "kick-off", side: "home", text: "Bola rolando! Mandante começa o jogo" },
]

export default function MatchCenterPage() {
  const [speed, setSpeed] = useState("normal")

  return (
    <div className="min-h-screen pl-[72px] pb-4">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/partida"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-card transition"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display-italic text-2xl tracking-tight text-accent">PARTIDA</h1>
          <span className="ml-2 flex items-center gap-1.5 rounded-sm bg-destructive/15 px-2 py-0.5 text-[10px] font-display tracking-widest text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse-live" />
            AO VIVO
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-display tracking-wider">
            <Repeat2 className="mr-1 h-3.5 w-3.5" />
            REPLAY
          </Button>
          <Button
            size="sm"
            className="font-display tracking-wider bg-accent text-accent-foreground hover:bg-accent/90"
          >
            2X
          </Button>
        </div>
      </header>

      <main className="space-y-4 p-4">
        {/* Scoreboard */}
        <section className="relative overflow-hidden rounded-xl border border-border bg-card">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(ellipse at center, oklch(0.65 0.22 25 / 0.15), transparent 70%)",
            }}
          />
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-6 px-8 py-6">
            {/* Home */}
            <div className="flex items-center justify-end gap-4">
              <div className="text-right">
                <div className="text-[10px] font-display tracking-widest text-muted-foreground">
                  MANDANTE
                </div>
                <div className="font-display-italic text-3xl">POUSO ALEGRE</div>
              </div>
              <ClubCrest
                abbr="PAL"
                size="lg"
                primary="oklch(0.65 0.22 25)"
                secondary="oklch(0.13 0.015 250)"
              />
            </div>

            {/* Score */}
            <div className="flex items-center gap-4">
              <div className="font-display-italic text-7xl leading-none tabular-nums">0</div>
              <div className="font-display text-2xl text-muted-foreground">×</div>
              <div className="font-display-italic text-7xl leading-none tabular-nums">0</div>
            </div>

            {/* Away */}
            <div className="flex items-center gap-4">
              <ClubCrest
                abbr="CAM"
                size="lg"
                primary="oklch(0.13 0.015 250)"
                secondary="oklch(0.95 0.005 240)"
              />
              <div>
                <div className="text-[10px] font-display tracking-widest text-muted-foreground">
                  VISITANTE
                </div>
                <div className="font-display-italic text-3xl">ATLÉTICO-MG</div>
              </div>
            </div>
          </div>
        </section>

        {/* Match center: clock + speed + meta */}
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          {/* Clock + speed */}
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex">
              {/* Clock */}
              <div className="flex flex-col items-center justify-center gap-1 border-r border-border bg-card-foreground/[0.02] px-6 py-5">
                <div className="rounded-sm bg-accent/15 px-2 py-0.5 text-[10px] font-display tracking-widest text-accent">
                  · 10:00
                </div>
                <div className="text-[10px] font-display tracking-widest text-muted-foreground">
                  MATCH CENTER
                </div>
                <div className="font-display-italic text-base">Aquecimento final</div>
              </div>

              {/* Speed buttons */}
              <div className="flex flex-1 flex-wrap items-center gap-1.5 p-4">
                {speeds.map((s) => {
                  const active = speed === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSpeed(s.id)}
                      className={cn(
                        "rounded-md border px-3 py-2 font-display tracking-widest text-[11px] transition",
                        active
                          ? "border-accent bg-accent text-accent-foreground shadow-glow-accent"
                          : "border-border bg-card hover:border-primary/50 hover:bg-card-foreground/[0.04]",
                      )}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Meta */}
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
            <MetaTile icon={CalendarDays} label="COMPETIÇÃO" value="Camp. Mineiro Betano" />
            <MetaTile icon={Cloud} label="CLIMA" value="Chuva" sub="22°C · Vento N 12km/h" />
            <MetaTile icon={Activity} label="GRAMADO" value="54/100" sub="Encharcado" valueClass="text-destructive" />
            <MetaTile icon={Users} label="PÚBLICO" value="15.526" sub="Ind. ocupação 78%" />
          </section>
        </div>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <StatCell key={s.label} {...s} />
          ))}
        </section>

        {/* Subs */}
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Button className="font-display tracking-wider bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow-accent">
            <Users className="mr-2 h-4 w-4" />
            SUBSTITUIR
          </Button>
          <span className="rounded-sm border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-display tracking-widest text-accent">
            5 RESTANTES
          </span>
          <span className="text-xs text-muted-foreground">Sem alterações ainda</span>
          <span className="ml-auto text-[10px] font-display tracking-widest text-muted-foreground">
            FORMAÇÃO 4-3-3
          </span>
        </section>

        {/* Pitch + events */}
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* Pitch */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-card-foreground/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <h2 className="font-display tracking-widest text-xs">CAMPO TÁTICO</h2>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  Mandante
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Visitante
                </span>
              </div>
            </div>
            <Pitch />
          </section>

          {/* Events */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-card-foreground/[0.02] px-5 py-3">
              <div className="flex items-center gap-2">
                <Goal className="h-4 w-4 text-primary" />
                <h2 className="font-display tracking-widest text-xs">EVENTOS</h2>
              </div>
              <span className="text-[10px] text-muted-foreground tracking-widest font-display">
                MOMENTUM
              </span>
            </div>

            {/* Momentum bar */}
            <div className="px-5 py-4 border-b border-border">
              <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-2">
                MOMENTO ATUAL
              </div>
              <div className="relative h-12 w-full overflow-hidden rounded bg-muted">
                <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="mom" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0" stopColor="oklch(0.65 0.22 25)" />
                      <stop offset="1" stopColor="oklch(0.82 0.15 200)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,15 L10,18 L20,12 L30,20 L40,8 L50,14 L60,6 L70,10 L80,4 L90,8 L100,5 L100,30 L0,30 Z"
                    fill="url(#mom)"
                    opacity="0.5"
                  />
                  <path
                    d="M0,15 L10,18 L20,12 L30,20 L40,8 L50,14 L60,6 L70,10 L80,4 L90,8 L100,5"
                    stroke="oklch(0.95 0.005 240)"
                    strokeWidth="0.5"
                    fill="none"
                  />
                </svg>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>0&apos;</span>
                <span>45&apos;</span>
                <span>90&apos;</span>
              </div>
            </div>

            {/* Event list */}
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {events.map((e, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-[10px] tabular-nums",
                      e.side === "home"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {e.min}&apos;
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-display tracking-widest text-muted-foreground">
                      {e.type === "card"
                        ? "CARTÃO AMARELO"
                        : e.type === "chance"
                          ? "GRANDE CHANCE"
                          : "INÍCIO DA PARTIDA"}
                    </div>
                    <p className="text-sm text-foreground/90 leading-snug">{e.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
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
    <div className="bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-display tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("mt-1 font-display-italic text-lg leading-tight", valueClass)}>{value}</div>
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
    <div className="bg-card p-4">
      <div className="flex items-center justify-between text-[10px] font-display tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" />
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-display-italic text-lg tabular-nums text-destructive">{home}</span>
        <span className="text-muted-foreground text-xs">×</span>
        <span className="font-display-italic text-lg tabular-nums text-primary">{away}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="flex h-full">
          <div className="bg-destructive h-full" style={{ width: `${ratio}%` }} />
          <div className="bg-primary h-full" style={{ width: `${100 - ratio}%` }} />
        </div>
      </div>
    </div>
  )
}

function Pitch() {
  // Visiting team (right side, primary cyan dots) — 4-3-3
  const homePlayers = [
    { x: 8, y: 50, n: 1, name: "GK" },
    { x: 22, y: 18, n: 2, name: "LB" },
    { x: 22, y: 38, n: 3, name: "CB" },
    { x: 22, y: 62, n: 4, name: "CB" },
    { x: 22, y: 82, n: 5, name: "RB" },
    { x: 38, y: 28, n: 6, name: "CM" },
    { x: 38, y: 50, n: 8, name: "CM" },
    { x: 38, y: 72, n: 10, name: "CM" },
    { x: 48, y: 22, n: 7, name: "LW" },
    { x: 48, y: 50, n: 9, name: "ST" },
    { x: 48, y: 78, n: 11, name: "RW" },
  ]
  const awayPlayers = homePlayers.map((p) => ({ ...p, x: 100 - p.x }))

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-b from-[oklch(0.45_0.15_145)] via-[oklch(0.35_0.12_145)] to-[oklch(0.45_0.15_145)]">
      {/* Stripes */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 60px, rgba(0,0,0,0.18) 60px 120px)",
        }}
      />

      {/* Field markings */}
      <svg viewBox="0 0 100 56" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <g stroke="rgba(255,255,255,0.65)" strokeWidth="0.18" fill="none">
          <rect x="2" y="2" width="96" height="52" />
          <line x1="50" y1="2" x2="50" y2="54" />
          <circle cx="50" cy="28" r="6" />
          <circle cx="50" cy="28" r="0.5" fill="rgba(255,255,255,0.65)" />
          {/* boxes */}
          <rect x="2" y="14" width="14" height="28" />
          <rect x="2" y="20" width="6" height="16" />
          <rect x="84" y="14" width="14" height="28" />
          <rect x="92" y="20" width="6" height="16" />
        </g>
      </svg>

      {/* Players */}
      {[...homePlayers, ...awayPlayers].map((p, i) => {
        const isHome = i < homePlayers.length
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${(p.y / 100) * 100}%` }}
          >
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full font-display text-[10px] font-bold ring-2 ring-background/40 shadow-lg",
                isHome ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
              )}
            >
              {p.n}
            </div>
          </div>
        )
      })}

      {/* Sample tagged players */}
      <PlayerTag x={28} y={66} num={2} name="CASA 2" rating={66} side="home" />
      <PlayerTag x={72} y={66} num={2} name="FORA 2" rating={73} side="away" />
    </div>
  )
}

function PlayerTag({
  x,
  y,
  num,
  name,
  rating,
  side,
}: {
  x: number
  y: number
  num: number
  name: string
  rating: number
  side: "home" | "away"
}) {
  return (
    <div className="absolute z-10" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="flex items-center gap-1.5 rounded-md bg-background/85 backdrop-blur border border-border px-2 py-1 shadow-lg">
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full font-display text-[10px]",
            side === "home" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {num}
        </div>
        <div>
          <div className="font-display text-[10px] tracking-wider leading-none">{name}</div>
          <div className="text-[9px] text-muted-foreground tabular-nums">RAT {rating}</div>
        </div>
      </div>
    </div>
  )
}
