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
  ChevronRight,
  Play,
  Zap
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
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
  competition: "Brasileirao Serie A",
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
          <div className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
            {side === "home" ? "MANDANTE" : "VISITANTE"}
          </div>
          <div className="text-lg font-semibold text-white">
            {team.nome}
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
                "group relative flex flex-col items-center rounded-xl border p-3 transition-all w-24",
                active
                  ? "border-[#1db954] bg-[#1db954]/10"
                  : "border-white/10 bg-[#1a1a1a] hover:border-white/20 hover:bg-[#1a1a1a]/80",
              )}
            >
              {/* Selection indicator */}
              {active && (
                <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1db954]">
                  <Check className="h-3 w-3 text-black" />
                </div>
              )}

              {/* Camisa image or fallback */}
              <div className="relative w-14 h-16 mb-2">
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
                  <div 
                    className={cn(
                      "w-full h-full rounded-lg flex items-center justify-center transition-transform",
                      active && "scale-105"
                    )}
                    style={{ 
                      background: `linear-gradient(135deg, ${uniform.primary} 0%, ${uniform.secondary} 100%)`,
                    }}
                  >
                    <Shirt className="h-6 w-6 text-white/80" />
                  </div>
                )}
              </div>

              {/* Kit label */}
              <div className={cn(
                "text-[10px] font-medium tracking-wider transition-colors",
                active ? "text-[#1db954]" : "text-white/50"
              )}>
                {kit.label.toUpperCase()}
              </div>
              <div className="text-[9px] text-white/30">
                {kit.sublabel}
              </div>
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
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Pre-Jogo</h1>
            <p className="text-sm text-white/50 mt-1">Configure os uniformes e inicie a partida</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {matchInfo.date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {matchInfo.time}
            </span>
          </div>
        </div>

        {/* Match Card */}
        <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
          {/* Competition banner */}
          <div className="flex items-center justify-center gap-3 py-3 border-b border-white/5 bg-white/[0.02]">
            <Trophy className="h-4 w-4 text-[#1db954]" />
            <span className="text-xs font-medium text-white tracking-wider">
              {matchInfo.competition.toUpperCase()}
            </span>
            <span className="text-white/20">|</span>
            <span className="text-xs text-white/50">
              {matchInfo.round}
            </span>
          </div>

          {/* Teams VS */}
          <div className="flex items-center justify-between px-8 py-8">
            {/* Home team */}
            <div className="flex items-center gap-5">
              <TeamCrest team={homeTeam} size="2xl" />
              <div>
                <div className="text-[10px] font-medium tracking-wider text-white/40 mb-1">
                  MANDANTE
                </div>
                <div className="text-2xl font-semibold text-white">
                  {homeTeam.nome}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-white/50">
                  <MapPin className="h-3 w-3" />
                  {homeTeam.cidade}, {homeTeam.estado}
                </div>
              </div>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center px-8">
              <div className="text-3xl font-bold text-white/20">VS</div>
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent mt-2" />
            </div>

            {/* Away team */}
            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-[10px] font-medium tracking-wider text-white/40 mb-1">
                  VISITANTE
                </div>
                <div className="text-2xl font-semibold text-white">
                  {awayTeam.nome}
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-1 text-xs text-white/50">
                  <MapPin className="h-3 w-3" />
                  {awayTeam.cidade}, {awayTeam.estado}
                </div>
              </div>
              <TeamCrest team={awayTeam} size="2xl" />
            </div>
          </div>

          {/* Venue info */}
          <div className="flex items-center justify-center gap-6 py-3 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <MapPin className="h-3.5 w-3.5 text-[#1db954]" />
              {matchInfo.stadium}
            </div>
            <span className="text-white/10">|</span>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Users className="h-3.5 w-3.5 text-[#1db954]" />
              {homeTeam.estadio_cap.toLocaleString('pt-BR')} lugares
            </div>
          </div>
        </div>

        {/* Uniform Selection */}
        <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
          <div className="flex items-center justify-center gap-2 py-3 border-b border-white/5 bg-white/[0.02]">
            <Shirt className="h-4 w-4 text-[#1db954]" />
            <span className="text-xs font-medium text-white tracking-wider">
              ESCOLHA DE UNIFORMES
            </span>
          </div>

          <div className="p-6">
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
                <div className="w-px h-20 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="my-3 px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-white/10">
                  <span className="text-[10px] font-medium tracking-wider text-white/40">
                    PREVIEW
                  </span>
                </div>
                <div className="w-px h-20 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
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
              <div className="mt-6 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <span className="text-xs text-yellow-500">
                  Os uniformes selecionados podem causar confusao visual. Considere trocar um deles.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Start Match CTA */}
        <div className="flex flex-col items-center gap-4">
          <Link href="/partida/ao-vivo">
            <Button
              size="lg"
              className="h-14 px-10 text-sm font-semibold tracking-wider bg-[#1db954] text-black hover:bg-[#1ed760]"
            >
              <Play className="mr-3 h-5 w-5 fill-current" />
              INICIAR PARTIDA
              <ArrowRight className="ml-3 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-xs text-white/40">
            Pressione para iniciar a transmissao - 90 minutos - Modo Normal
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-center gap-4">
          <Link 
            href="/elenco"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-[#1a1a1a] hover:bg-[#1a1a1a]/80 transition text-sm text-white/60 hover:text-white"
          >
            <Users className="h-4 w-4" />
            Ver Escalacao
            <ChevronRight className="h-3 w-3" />
          </Link>
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-[#1a1a1a] hover:bg-[#1a1a1a]/80 transition text-sm text-white/60 hover:text-white"
          >
            <Zap className="h-4 w-4" />
            Simular Partida
          </button>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}
