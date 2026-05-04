"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { 
  ChevronLeft, 
  Globe2, 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Clock,
  Users,
  Trophy,
  Shirt,
  Check,
  ChevronRight
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  getTeamByShort, 
  serieATeams, 
  getCamisaUrl, 
  getTeamUniforms,
  type Team 
} from "@/lib/teams-data"

type KitVariant = "home" | "away" | "third"

interface KitOption {
  id: KitVariant
  label: string
  sublabel: string
}

const kitOptions: KitOption[] = [
  { id: "home", label: "Titular", sublabel: "1° Uniforme" },
  { id: "away", label: "Reserva", sublabel: "2° Uniforme" },
  { id: "third", label: "Alternativo", sublabel: "3° Uniforme" },
]

// Dados do confronto
const userTeam = getTeamByShort("RBB") || serieATeams[0]
const opponent = getTeamByShort("PLM") || serieATeams[1]

const matchInfo = {
  competition: "Brasileirão Série A",
  round: "Rodada 1",
  stadium: userTeam.estadio_nome,
  city: userTeam.cidade,
  date: "15 Jan 2026",
  time: "16:00",
  isHome: true,
}

function UniformSelector({ 
  team, 
  selected, 
  onSelect,
  side,
}: { 
  team: Team
  selected: KitVariant
  onSelect: (kit: KitVariant) => void
  side: "home" | "away"
}) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const uniforms = getTeamUniforms(team)

  const handleImageError = (kitId: string) => {
    setImageErrors(prev => ({ ...prev, [kitId]: true }))
  }

  return (
    <div className={cn(
      "flex flex-col",
      side === "away" && "items-end"
    )}>
      {/* Team header */}
      <div className={cn(
        "flex items-center gap-3 mb-4",
        side === "away" && "flex-row-reverse"
      )}>
        <TeamCrest team={team} size="lg" />
        <div className={side === "away" ? "text-right" : ""}>
          <div className="text-[10px] font-display tracking-widest text-muted-foreground">
            {side === "home" ? "MANDANTE" : "VISITANTE"}
          </div>
          <div className="font-display-italic text-xl text-foreground">
            {team.nome.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Kit options */}
      <div className={cn(
        "flex gap-2",
        side === "away" && "flex-row-reverse"
      )}>
        {kitOptions.map((kit) => {
          const active = selected === kit.id
          const camisaUrl = getCamisaUrl(team.file_key, kit.id)
          const hasError = imageErrors[kit.id]
          const uniform = uniforms[kit.id]

          return (
            <button
              key={kit.id}
              onClick={() => onSelect(kit.id)}
              className={cn(
                "group relative flex flex-col items-center rounded-xl border-2 p-3 transition-all w-28",
                active
                  ? "border-accent bg-accent/10 shadow-glow-accent"
                  : "border-border/50 bg-card/40 backdrop-blur hover:border-primary/40 hover:bg-card/60",
              )}
            >
              {/* Selection indicator */}
              {active && (
                <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent shadow-lg">
                  <Check className="h-3 w-3 text-accent-foreground" />
                </div>
              )}

              {/* Camisa image or fallback */}
              <div className="relative w-16 h-20 mb-2">
                {!hasError ? (
                  <Image
                    src={camisaUrl}
                    alt={`${kit.label} ${team.nome}`}
                    fill
                    className={cn(
                      "object-contain drop-shadow-lg transition-transform",
                      active && "scale-105"
                    )}
                    onError={() => handleImageError(kit.id)}
                    unoptimized
                  />
                ) : (
                  // Fallback: colored jersey representation
                  <div 
                    className={cn(
                      "w-full h-full rounded-lg flex items-center justify-center transition-transform",
                      active && "scale-105"
                    )}
                    style={{ 
                      background: `linear-gradient(135deg, ${uniform.primary} 0%, ${uniform.secondary} 100%)`,
                      boxShadow: `0 8px 24px ${uniform.primary}40`
                    }}
                  >
                    <Shirt className="h-8 w-8 text-white/80" />
                  </div>
                )}
              </div>

              {/* Kit label */}
              <div className={cn(
                "text-[10px] font-display tracking-widest transition-colors",
                active ? "text-accent" : "text-muted-foreground"
              )}>
                {kit.label.toUpperCase()}
              </div>
              <div className="text-[9px] text-muted-foreground/60">
                {kit.sublabel}
              </div>

              {/* Active accent */}
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 bg-accent rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function PreMatchPage() {
  const [homeKit, setHomeKit] = useState<KitVariant>("home")
  const [awayKit, setAwayKit] = useState<KitVariant>("away")

  const homeTeam = matchInfo.isHome ? userTeam : opponent
  const awayTeam = matchInfo.isHome ? opponent : userTeam

  return (
    <div className="relative min-h-screen pl-[72px] pb-24">
      <GameSidebar />

      {/* Cinematic background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[#0a0a0a]" />
        {/* Team gradient accents */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(ellipse at 20% 30%, ${homeTeam.cor1}50, transparent 40%),
              radial-gradient(ellipse at 80% 30%, ${awayTeam.cor1}50, transparent 40%),
              radial-gradient(ellipse at 50% 100%, oklch(0.15 0.03 260) 0%, transparent 50%)
            `
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-10" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-border/40 bg-card/20 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-card transition"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="font-display tracking-widest text-xs text-primary">PARTIDA</span>
          <span className="text-border">/</span>
          <span className="text-xs text-muted-foreground">Pré-Jogo</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {matchInfo.date}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {matchInfo.time}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex flex-col px-6 py-8">
        <div className="mx-auto w-full max-w-6xl">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="font-display tracking-[0.5em] text-[10px] text-primary mb-2">
              PREPARAÇÃO
            </div>
            <h1 className="font-display-italic text-5xl md:text-6xl leading-none tracking-tight">
              PRÉ-JOGO
            </h1>
          </div>

          {/* Match card */}
          <div className="relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden mb-8">
            {/* Competition banner */}
            <div className="flex items-center justify-center gap-3 py-3 border-b border-border/30 bg-primary/5">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="font-display tracking-widest text-[11px] text-foreground">
                {matchInfo.competition.toUpperCase()}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-[11px] text-muted-foreground">
                {matchInfo.round}
              </span>
            </div>

            {/* Teams vs */}
            <div className="flex items-center justify-between px-8 py-10">
              {/* Home team */}
              <div className="flex items-center gap-5">
                <TeamCrest team={homeTeam} size="2xl" />
                <div>
                  <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1">
                    MANDANTE
                  </div>
                  <div className="font-display-italic text-3xl text-foreground">
                    {homeTeam.nome.toUpperCase()}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {homeTeam.cidade}, {homeTeam.estado}
                  </div>
                </div>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="font-display-italic text-4xl text-muted-foreground/30">VS</div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-px w-16 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                </div>
              </div>

              {/* Away team */}
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1">
                    VISITANTE
                  </div>
                  <div className="font-display-italic text-3xl text-foreground">
                    {awayTeam.nome.toUpperCase()}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {awayTeam.cidade}, {awayTeam.estado}
                  </div>
                </div>
                <TeamCrest team={awayTeam} size="2xl" />
              </div>
            </div>

            {/* Venue info */}
            <div className="flex items-center justify-center gap-6 py-3 border-t border-border/30 bg-black/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {matchInfo.stadium}
              </div>
              <span className="text-border/30">|</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-primary" />
                {homeTeam.estadio_cap.toLocaleString('pt-BR')} lugares
              </div>
            </div>
          </div>

          {/* Uniform selection */}
          <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden">
            <div className="flex items-center justify-center gap-2 py-3 border-b border-border/30">
              <Shirt className="h-4 w-4 text-accent" />
              <span className="font-display tracking-widest text-[11px] text-foreground">
                ESCOLHA DE UNIFORMES
              </span>
            </div>

            <div className="p-8">
              <div className="flex items-start justify-between">
                {/* Home team uniforms */}
                <UniformSelector
                  team={homeTeam}
                  selected={homeKit}
                  onSelect={setHomeKit}
                  side="home"
                />

                {/* Preview divider */}
                <div className="flex flex-col items-center px-8">
                  <div className="w-px h-24 bg-gradient-to-b from-transparent via-border/50 to-transparent" />
                  <div className="my-4 px-4 py-2 rounded-full bg-card/60 border border-border/30">
                    <span className="text-[10px] font-display tracking-widest text-muted-foreground">
                      PREVIEW
                    </span>
                  </div>
                  <div className="w-px h-24 bg-gradient-to-b from-transparent via-border/50 to-transparent" />
                </div>

                {/* Away team uniforms */}
                <UniformSelector
                  team={awayTeam}
                  selected={awayKit}
                  onSelect={setAwayKit}
                  side="away"
                />
              </div>

              {/* Conflict warning */}
              {homeKit === awayKit && (
                <div className="mt-6 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-warning/10 border border-warning/30">
                  <span className="text-xs text-warning">
                    Os uniformes selecionados podem causar confusão visual. Considere trocar um deles.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Start match CTA */}
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link href="/partida/ao-vivo">
              <Button
                size="lg"
                className="group h-14 px-10 font-display tracking-[0.2em] bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow-accent"
              >
                <Globe2 className="mr-3 h-5 w-5" />
                INICIAR PARTIDA
                <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              Pressione para iniciar a transmissão • 90 minutos • Modo Normal
            </p>
          </div>

          {/* Quick actions */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link 
              href="/elenco"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/30 bg-card/20 hover:bg-card/40 transition text-sm text-muted-foreground hover:text-foreground"
            >
              <Users className="h-4 w-4" />
              Ver Escalação
              <ChevronRight className="h-3 w-3" />
            </Link>
            <button 
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/30 bg-card/20 hover:bg-card/40 transition text-sm text-muted-foreground hover:text-foreground"
            >
              Simular Partida
            </button>
          </div>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}
