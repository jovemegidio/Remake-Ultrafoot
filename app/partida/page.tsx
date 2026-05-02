"use client"

import Link from "next/link"
import { useState } from "react"
import { 
  ChevronLeft, 
  Globe2, 
  ArrowRight, 
  Tv, 
  Cloud, 
  Users, 
  MapPin,
  Clock,
  Trophy,
  Zap,
  ChevronRight as ChevronRightIcon,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { ClubCrest } from "@/components/club-crest"
import { Jersey } from "@/components/jersey"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type KitId = "home" | "away" | "third"

const kits: {
  id: KitId
  label: string
  primary: string
  secondary: string
  pattern: "stripes" | "solid" | "diagonal"
}[] = [
  { id: "home", label: "Titular", primary: "oklch(0.08 0.02 260)", secondary: "oklch(0.95 0.01 240)", pattern: "stripes" },
  { id: "away", label: "Reserva", primary: "oklch(0.95 0.01 240)", secondary: "oklch(0.08 0.02 260)", pattern: "solid" },
  { id: "third", label: "Alternativo", primary: "oklch(0.15 0.02 260)", secondary: "oklch(0.60 0.24 25)", pattern: "diagonal" },
]

const matchInfo = {
  competition: "Campeonato Mineiro",
  round: "Rodada 1",
  stadium: "Arena Independencia",
  city: "Belo Horizonte, MG",
  weather: "Parcialmente nublado",
  temperature: "24C",
  attendance: "~18.500",
}

export default function PreMatchPage() {
  const [selected, setSelected] = useState<KitId>("third")
  const [speed, setSpeed] = useState<"instant" | "fast" | "normal">("normal")

  return (
    <div className="relative min-h-screen pl-16 pb-20 bg-background overflow-hidden">
      <GameSidebar />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 30% 20%, oklch(0.60 0.24 25 / 0.12) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, oklch(0.75 0.18 195 / 0.08) 0%, transparent 50%)
            `,
          }}
        />
        {/* Stadium lights effect */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-b from-white/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-b from-white/5 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 glass-panel px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 hover:bg-card hover:border-primary/50 transition"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-accent rounded-full" />
            <span className="font-display tracking-[0.3em] text-xs text-muted-foreground">PARTIDA</span>
          </div>
          <span className="text-border">/</span>
          <span className="font-display tracking-wider text-sm text-foreground">PRE-JOGO</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Tv className="h-3.5 w-3.5" />
            <span className="font-display tracking-wider">MODO DE SIMULACAO</span>
          </span>
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            {(["instant", "fast", "normal"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-display tracking-wider transition",
                  speed === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-card/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "instant" ? "INST" : s === "fast" ? "2X" : "1X"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex flex-col items-center px-6 py-12">
        <div className="mx-auto w-full max-w-6xl">
          {/* Stage indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="flex items-center gap-2 text-[10px] font-display tracking-[0.3em] text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary text-[9px]">1</span>
              PREPARACAO
            </span>
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            <span className="flex items-center gap-2 text-[10px] font-display tracking-[0.3em] text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[9px]">2</span>
              AO VIVO
            </span>
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
            <span className="flex items-center gap-2 text-[10px] font-display tracking-[0.3em] text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[9px]">3</span>
              RESULTADO
            </span>
          </div>

          {/* Match header card */}
          <div className="relative overflow-hidden rounded-2xl border border-border/50 glass-panel mb-8">
            {/* Decorative elements */}
            <div className="absolute top-4 left-4 w-20 h-20 border-l-2 border-t-2 border-primary/20" />
            <div className="absolute top-4 right-4 w-20 h-20 border-r-2 border-t-2 border-primary/20" />
            <div className="absolute bottom-4 left-4 w-20 h-20 border-l-2 border-b-2 border-accent/20" />
            <div className="absolute bottom-4 right-4 w-20 h-20 border-r-2 border-b-2 border-accent/20" />

            <div className="relative p-10">
              {/* Competition badge */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-3 rounded-full border border-border/50 bg-card/50 px-5 py-2 backdrop-blur">
                  <Trophy className="h-4 w-4 text-gold" />
                  <span className="font-display tracking-[0.2em] text-xs">{matchInfo.competition.toUpperCase()}</span>
                  <span className="h-4 w-px bg-border" />
                  <span className="text-xs text-muted-foreground">{matchInfo.round}</span>
                </div>
              </div>

              {/* Teams */}
              <div className="flex items-center justify-center gap-16">
                {/* Home team */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-br from-destructive/20 to-transparent rounded-full blur-2xl" />
                    <ClubCrest
                      abbr="TBS"
                      size="xl"
                      primary="oklch(0.60 0.24 25)"
                      secondary="oklch(0.08 0.02 260)"
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-display tracking-[0.3em] text-muted-foreground mb-1">
                      MANDANTE
                    </div>
                    <div className="font-display-italic text-3xl">TOMBENSE</div>
                    <div className="text-xs text-muted-foreground mt-1">4-3-3 | Ofensivo</div>
                  </div>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="absolute -inset-8 bg-gradient-to-r from-destructive/20 via-transparent to-primary/20 rounded-full blur-3xl" />
                    <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-2 border-border/50 bg-card/50 backdrop-blur">
                      <span className="font-display-italic text-4xl text-muted-foreground">VS</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>16:00</span>
                  </div>
                </div>

                {/* Away team */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl" />
                    <ClubCrest
                      abbr="CAM"
                      size="xl"
                      primary="oklch(0.08 0.02 260)"
                      secondary="oklch(0.95 0.01 240)"
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-display tracking-[0.3em] text-muted-foreground mb-1">
                      VISITANTE
                    </div>
                    <div className="font-display-italic text-3xl">ATLETICO-MG</div>
                    <div className="text-xs text-muted-foreground mt-1">4-2-3-1 | Equilibrado</div>
                  </div>
                </div>
              </div>

              {/* Match info strip */}
              <div className="mt-10 grid grid-cols-4 gap-4">
                <InfoTile icon={MapPin} label="Estadio" value={matchInfo.stadium} sub={matchInfo.city} />
                <InfoTile icon={Cloud} label="Clima" value={matchInfo.weather} sub={matchInfo.temperature} />
                <InfoTile icon={Users} label="Publico Esperado" value={matchInfo.attendance} sub="78% ocupacao" />
                <InfoTile icon={Zap} label="Gramado" value="Bom" sub="85/100 condicao" valueClass="text-accent" />
              </div>
            </div>
          </div>

          {/* Kit selector */}
          <div className="mb-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 text-[10px] font-display tracking-[0.3em] text-muted-foreground">
                <div className="w-8 h-px bg-gradient-to-r from-transparent to-border" />
                SELECIONE SEU UNIFORME
                <div className="w-8 h-px bg-gradient-to-l from-transparent to-border" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
              {kits.map((kit) => {
                const active = selected === kit.id
                return (
                  <button
                    key={kit.id}
                    onClick={() => setSelected(kit.id)}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300",
                      active
                        ? "border-accent bg-accent/5 shadow-glow-accent scale-[1.02]"
                        : "border-border/50 glass-panel hover:border-primary/50 hover:scale-[1.01]",
                    )}
                  >
                    {active && (
                      <span className="absolute right-3 top-3 rounded bg-accent px-2 py-0.5 text-[9px] font-display tracking-widest text-accent-foreground">
                        SELECIONADO
                      </span>
                    )}

                    <div className="mx-auto w-28 transition-transform duration-300 group-hover:scale-105">
                      <Jersey
                        variant={kit.id}
                        primary={kit.primary}
                        secondary={kit.secondary}
                        pattern={kit.pattern}
                      />
                    </div>

                    <div
                      className={cn(
                        "mt-4 font-display tracking-[0.2em] text-sm transition",
                        active ? "text-accent" : "text-foreground/80",
                      )}
                    >
                      {kit.label.toUpperCase()}
                    </div>

                    {/* Decorative accent */}
                    {active && (
                      <div className="absolute -bottom-4 -right-4 h-16 w-16 rotate-45 bg-accent/10 blur-xl" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Start match CTA */}
          <div className="flex flex-col items-center gap-4">
            <Link href="/partida/ao-vivo">
              <Button
                size="lg"
                className="group h-14 px-12 btn-eafc font-display tracking-[0.2em] text-base shadow-glow-accent"
              >
                <Globe2 className="mr-3 h-5 w-5" />
                INICIAR PARTIDA
                <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center">
              Clique para iniciar a transmissao ao vivo da partida
            </p>
          </div>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

function InfoTile({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/30 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[9px] font-display tracking-[0.2em] text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className={cn("font-display tracking-wide text-sm", valueClass)}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}
