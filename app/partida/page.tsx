"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { 
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
  Zap,
  TrendingUp,
  Target,
  Star
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

// Dados do confronto
const userTeam = getTeamByShort("BGT") || serieATeams[0]
const opponent = getTeamByShort("PAL") || serieATeams[1]

const matchInfo = {
  competition: "Brasileirao Serie A",
  round: "Rodada 1",
  stadium: userTeam.estadio_nome,
  city: userTeam.cidade,
  date: "15 Jan 2026",
  time: "16:00",
  isHome: true,
}

// Stats para o preview
const teamStats = {
  home: { wins: 3, draws: 1, losses: 0, form: ["W", "W", "D", "W", "W"] },
  away: { wins: 2, draws: 2, losses: 0, form: ["W", "D", "W", "D", "W"] }
}

function KitSelector({ 
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
  const kits: { id: KitVariant; label: string }[] = [
    { id: "home", label: "1" },
    { id: "away", label: "2" },
    { id: "third", label: "3" },
  ]

  return (
    <div className={cn("flex flex-col", side === "away" && "items-end")}>
      {/* Team badge area - EA FC style */}
      <div className={cn(
        "relative mb-6",
        side === "away" && "flex flex-col items-end"
      )}>
        {/* Glowing background effect */}
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
              color: team.cor2 
            }}
          >
            {team.prestigio}
          </div>
        </div>
        
        <div className={cn("mt-4", side === "away" && "text-right")}>
          <div 
            className="text-[10px] font-bold tracking-[0.3em] mb-1"
            style={{ color: team.cor1 }}
          >
            {side === "home" ? "MANDANTE" : "VISITANTE"}
          </div>
          <div className="text-2xl font-black text-white tracking-tight uppercase">
            {team.nome}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {team.cidade}, {team.estado}
          </div>
        </div>
      </div>

      {/* Kit selection - compact EA FC style */}
      <div className={cn("flex gap-2", side === "away" && "flex-row-reverse")}>
        {kits.map((kit) => {
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
                  : "opacity-60 hover:opacity-100 hover:scale-102",
              )}
              style={{ 
                ringColor: active ? team.cor1 : undefined,
                background: `linear-gradient(180deg, ${team.cor1}20 0%, ${team.cor2}10 100%)`
              }}
            >
              {/* Kit number badge */}
              <div 
                className={cn(
                  "absolute top-1 left-1 h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center z-10 transition-all",
                  active ? "bg-white text-black" : "bg-white/20 text-white/60"
                )}
              >
                {kit.label}
              </div>

              {/* Check indicator */}
              {active && (
                <div 
                  className="absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center z-10"
                  style={{ backgroundColor: team.cor1 }}
                >
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}

              {/* Camisa image */}
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
                    style={{ background: `linear-gradient(135deg, ${uniform.primary} 0%, ${uniform.secondary} 100%)` }}
                  >
                    <Shirt className="h-5 w-5 text-white/80" />
                  </div>
                )}
              </div>

              {/* Hover glow */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `linear-gradient(180deg, ${team.cor1}30 0%, transparent 50%)` }}
              />
            </button>
          )
        })}
      </div>

      {/* Form indicator */}
      <div className={cn("flex items-center gap-1 mt-4", side === "away" && "flex-row-reverse")}>
        <span className="text-[10px] text-white/40 mr-2">FORMA:</span>
        {teamStats[side].form.map((result, i) => (
          <div 
            key={i}
            className={cn(
              "h-5 w-5 rounded text-[9px] font-bold flex items-center justify-center",
              result === "W" && "bg-green-500/20 text-green-400",
              result === "D" && "bg-yellow-500/20 text-yellow-400",
              result === "L" && "bg-red-500/20 text-red-400"
            )}
          >
            {result === "W" ? "V" : result === "D" ? "E" : "D"}
          </div>
        ))}
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

      <main className="p-6">
        {/* EA FC Style Hero Section */}
        <div className="relative rounded-2xl overflow-hidden mb-6">
          {/* Dynamic gradient background based on team colors */}
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${homeTeam.cor1}15 0%, #0a0a0a 40%, #0a0a0a 60%, ${awayTeam.cor1}15 100%)`
            }}
          />
          
          {/* Diagonal line pattern - EA FC style */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)`,
              backgroundSize: '10px 10px'
            }} />
          </div>

          {/* Competition Header */}
          <div className="relative flex items-center justify-center gap-4 py-4 border-b border-white/5">
            <Image 
              src="/logos/brasileirao.png"
              alt="Brasileirao"
              width={40}
              height={40}
              className="object-contain"
            />
            <div className="text-center">
              <div className="text-xs font-bold tracking-[0.2em] text-white/60">
                {matchInfo.competition.toUpperCase()}
              </div>
              <div className="text-[10px] text-white/40">
                {matchInfo.round} • {matchInfo.date}
              </div>
            </div>
          </div>

          {/* Main Match Display */}
          <div className="relative px-8 py-10">
            <div className="flex items-center justify-between">
              {/* Home Team */}
              <KitSelector
                team={homeTeam}
                selected={homeKit}
                onSelect={setHomeKit}
                side="home"
              />

              {/* Center - VS and Match Info */}
              <div className="flex flex-col items-center px-8">
                {/* Time display - EA FC style */}
                <div className="mb-6 text-center">
                  <div className="text-5xl font-black text-white tracking-tighter">
                    {matchInfo.time}
                  </div>
                  <div className="text-xs text-white/40 mt-1">HORARIO LOCAL</div>
                </div>

                {/* VS divider */}
                <div className="relative">
                  <div className="absolute -left-16 top-1/2 h-px w-12 bg-gradient-to-r from-transparent to-white/20" />
                  <div className="absolute -right-16 top-1/2 h-px w-12 bg-gradient-to-l from-transparent to-white/20" />
                  <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-xl font-black text-white/30">VS</span>
                  </div>
                </div>

                {/* Venue info */}
                <div className="mt-6 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <MapPin className="h-3.5 w-3.5 text-white/30" />
                    {matchInfo.stadium}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/30">
                    <Users className="h-3 w-3" />
                    {homeTeam.estadio_cap.toLocaleString('pt-BR')} lugares
                  </div>
                </div>
              </div>

              {/* Away Team */}
              <KitSelector
                team={awayTeam}
                selected={awayKit}
                onSelect={setAwayKit}
                side="away"
              />
            </div>
          </div>

          {/* Bottom Stats Bar - EA FC style */}
          <div className="relative flex items-center justify-center gap-8 py-4 border-t border-white/5 bg-black/30">
            <div className="flex items-center gap-2 text-xs">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-white/40">Prestigio:</span>
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

        {/* Kit Conflict Warning */}
        {homeKit === awayKit && (
          <div className="mb-6 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <span className="text-xs text-yellow-500">
              Uniformes similares selecionados. Considere trocar um deles para evitar confusao visual.
            </span>
          </div>
        )}

        {/* Action Buttons - EA FC style */}
        <div className="flex flex-col items-center gap-4">
          <Link href="/partida/ao-vivo" className="w-full max-w-md">
            <Button
              size="lg"
              className="relative w-full h-16 text-base font-black tracking-wider bg-gradient-to-r from-[#1db954] to-[#1ed760] text-black hover:from-[#1ed760] hover:to-[#22e766] overflow-hidden group"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Play className="mr-3 h-6 w-6 fill-current" />
              INICIAR PARTIDA
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </Link>
          
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              90 minutos
            </span>
            <span className="text-white/20">•</span>
            <span>Modo Normal</span>
            <span className="text-white/20">•</span>
            <span>Clima: Ensolarado</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <Link 
            href="/elenco"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/60 hover:text-white"
          >
            <Users className="h-4 w-4" />
            Ver Escalacao
            <ChevronRight className="h-3 w-3" />
          </Link>
          <button 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/60 hover:text-white"
          >
            <Zap className="h-4 w-4" />
            Simular Rapido
          </button>
          <Link 
            href="/configuracoes"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/60 hover:text-white"
          >
            <Shirt className="h-4 w-4" />
            Configuracoes
          </Link>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}
