"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  type Divisao,
  type Team,
  type Regiao,
} from "@/lib/teams-data"
import {
  premierLeagueTeams,
  laLigaTeams,
  serieAItaTeams,
  bundesligaTeams,
  ligue1Teams,
  saudiProTeams,
  mlsTeams,
  ligaMXTeams,
  primeiraLigaTeams,
} from "@/lib/international-teams"
import { getLeagueLogo } from "@/lib/league-logos"
import { teamRating } from "@/lib/players-data"
import { useGameManager } from "@/lib/use-game-manager"
import { TeamCrest } from "@/components/team-crest"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

interface DivisaoTab {
  key: Divisao
  label: string
  short: string
  teams: Team[]
  region: Regiao
  country?: string
  code?: string
  flag?: string
}

const DIVISIONS: DivisaoTab[] = [
  { key: "serie_a", label: "Brasileirao Serie A", short: "Serie A", teams: serieATeams, region: "brasil", country: "Brasil", code: "BRA", flag: "🇧🇷" },
  { key: "serie_b", label: "Brasileirao Serie B", short: "Serie B", teams: serieBTeams, region: "brasil", country: "Brasil", code: "BRA", flag: "🇧🇷" },
  { key: "serie_c", label: "Brasileirao Serie C", short: "Serie C", teams: serieCTeams, region: "brasil", country: "Brasil", code: "BRA", flag: "🇧🇷" },
  { key: "serie_d", label: "Brasileirao Serie D", short: "Serie D", teams: serieDTeams, region: "brasil", country: "Brasil", code: "BRA", flag: "🇧🇷" },
  { key: "premier_league", label: "Premier League", short: "Premier", teams: premierLeagueTeams, region: "europa", country: "Inglaterra", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { key: "la_liga", label: "La Liga", short: "La Liga", teams: laLigaTeams, region: "europa", country: "Espanha", code: "ESP", flag: "🇪🇸" },
  { key: "serie_a_ita", label: "Serie A Italia", short: "Serie A", teams: serieAItaTeams, region: "europa", country: "Italia", code: "ITA", flag: "🇮🇹" },
  { key: "bundesliga", label: "Bundesliga", short: "Bundesliga", teams: bundesligaTeams, region: "europa", country: "Alemanha", code: "GER", flag: "🇩🇪" },
  { key: "ligue_1", label: "Ligue 1", short: "Ligue 1", teams: ligue1Teams, region: "europa", country: "Franca", code: "FRA", flag: "🇫🇷" },
  { key: "primeira_liga", label: "Primeira Liga", short: "Portugal", teams: primeiraLigaTeams, region: "europa", country: "Portugal", code: "POR", flag: "🇵🇹" },
  { key: "mls", label: "MLS", short: "MLS", teams: mlsTeams, region: "americas", country: "EUA", code: "USA", flag: "🇺🇸" },
  { key: "liga_mx", label: "Liga MX", short: "Liga MX", teams: ligaMXTeams, region: "americas", country: "Mexico", code: "MEX", flag: "🇲🇽" },
  { key: "saudi_pro", label: "Saudi Pro League", short: "Saudi Pro", teams: saudiProTeams, region: "asia", country: "Arabia Saudita", code: "KSA", flag: "🇸🇦" },
]

// Background image URL
const STADIUM_BG = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-3pD8rjnjCI4PN1QCaVGJHPsocZwO8L.png"

export default function NovoJogoPage() {
  const router = useRouter()
  const { initializeNewGame } = useGameManager()
  const { setTheme, setTeamColors } = useTheme()

  const [divisaoIndex, setDivisaoIndex] = useState(0)
  const [teamIndex, setTeamIndex] = useState(0)
  const [managerName, setManagerName] = useState("")

  const activeDivision = DIVISIONS[divisaoIndex]
  const teams = activeDivision.teams
  const selectedTeam = teams[teamIndex]

  const overall = useMemo(() => teamRating(selectedTeam?.nome || ""), [selectedTeam])
  
  // Calculate stats using deterministic hash based on team name
  const stats = useMemo(() => {
    const base = overall || 70
    const teamName = selectedTeam?.nome || ""
    // Simple deterministic hash function
    const hash = (str: string, seed: number) => {
      let h = seed
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0
      }
      return Math.abs(h % 100) / 100 - 0.5
    }
    return {
      ata: Math.round(base + hash(teamName, 1) * 10),
      mei: Math.round(base + hash(teamName, 2) * 8),
      def: Math.round(base + hash(teamName, 3) * 10),
    }
  }, [overall, selectedTeam])

  const handleStart = useCallback(() => {
    if (!selectedTeam) return
    console.log("[v0] handleStart called with team:", selectedTeam.curto, "manager:", managerName)
    setTeamColors({ primary: selectedTeam.cor1, secondary: selectedTeam.cor2 })
    setTheme("team")
    initializeNewGame(selectedTeam.curto, managerName)
    console.log("[v0] initializeNewGame called, redirecting to /")
    router.push("/")
  }, [selectedTeam, managerName, initializeNewGame, router, setTeamColors, setTheme])

  const nextTeam = () => {
    setTeamIndex(prev => (prev + 1) % teams.length)
  }

  const prevTeam = () => {
    setTeamIndex(prev => (prev - 1 + teams.length) % teams.length)
  }

  const nextDivision = () => {
    setDivisaoIndex(prev => (prev + 1) % DIVISIONS.length)
    setTeamIndex(0)
  }

  const prevDivision = () => {
    setDivisaoIndex(prev => (prev - 1 + DIVISIONS.length) % DIVISIONS.length)
    setTeamIndex(0)
  }

  const selectRandomTeam = () => {
    setTeamIndex(Math.floor(Math.random() * teams.length))
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          prevTeam()
          break
        case "ArrowRight":
          nextTeam()
          break
        case "Enter":
          handleStart()
          break
        case "Escape":
        case "Backspace":
          router.push("/splash")
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleStart, router, teams.length])

  // Gamepad navigation
  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "B":
          router.push("/splash")
          break
        case "A":
        case "START":
          handleStart()
          break
        case "DPAD_LEFT":
          prevTeam()
          break
        case "DPAD_RIGHT":
          nextTeam()
          break
        case "LB":
          prevDivision()
          break
        case "RB":
          nextDivision()
          break
        case "X":
          selectRandomTeam()
          break
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [handleStart, router, teams.length])

  const leagueLogo = getLeagueLogo(activeDivision.key)
  const prestigeStars = Math.round((selectedTeam?.prestigio || 50) / 20)

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={STADIUM_BG}
          alt="Stadium Background"
          fill
          className="object-cover"
          priority
          unoptimized
        />
        {/* Overlay for better contrast */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Top Bar - League Selector */}
        <header className="flex items-center justify-center py-4 px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={prevDivision}
              className="w-10 h-10 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all border border-white/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 min-w-[250px] justify-center">
              {leagueLogo ? (
                <Image
                  src={leagueLogo}
                  alt={activeDivision.label}
                  width={28}
                  height={28}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-xl">{activeDivision.flag}</span>
              )}
              <span className="font-semibold text-white text-sm">
                {activeDivision.country}
              </span>
            </div>

            <button
              onClick={nextDivision}
              className="w-10 h-10 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all border border-white/10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content - Team Display */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="flex items-center gap-8">
            {/* Left Arrow */}
            <button
              onClick={prevTeam}
              className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all border border-white/10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Team Card */}
            <div className="flex flex-col items-center">
              {/* Team Name */}
              <h1 className="text-3xl md:text-4xl font-black text-white text-center mb-2 drop-shadow-lg">
                {selectedTeam?.nome}
              </h1>
              
              {/* Location */}
              <p className="text-white/60 text-sm mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white/40" />
                {selectedTeam?.cidade}, {selectedTeam?.pais || selectedTeam?.estado}
              </p>

              {/* Team Crest Container */}
              <div 
                className="relative rounded-2xl p-8 mb-6"
                style={{
                  background: `linear-gradient(180deg, ${selectedTeam?.cor1}40 0%, ${selectedTeam?.cor1}10 100%)`,
                  boxShadow: `0 0 60px ${selectedTeam?.cor1}30`
                }}
              >
                <div className="w-40 h-40 md:w-52 md:h-52 flex items-center justify-center">
                  <TeamCrest 
                    team={selectedTeam} 
                    size="2xl" 
                    className="w-full h-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
                  />
                </div>
              </div>

              {/* Stars Rating */}
              <div className="flex items-center gap-1 mb-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star 
                    key={i} 
                    className={cn(
                      "w-5 h-5",
                      i < prestigeStars 
                        ? "fill-amber-400 text-amber-400" 
                        : "text-white/30"
                    )} 
                  />
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 mb-8">
                <div className="text-center">
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">ATA</div>
                  <div className="text-2xl font-bold text-white">{stats.ata}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">MEI</div>
                  <div className="text-2xl font-bold text-white">{stats.mei}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">DEF</div>
                  <div className="text-2xl font-bold text-white">{stats.def}</div>
                </div>
              </div>

              {/* League Logo */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-white/40">{activeDivision.label}</span>
                {leagueLogo && (
                  <Image
                    src={leagueLogo}
                    alt={activeDivision.label}
                    width={80}
                    height={40}
                    className="object-contain opacity-80"
                    unoptimized
                  />
                )}
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={nextTeam}
              className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all border border-white/10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Bottom Bar - Actions */}
        <footer className="py-4 px-6">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            {/* Controls Legend */}
            <div className="flex items-center gap-4 text-xs text-white/50">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-white/10 text-white/70 font-medium">A</span>
                <span>Selecionar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-white/10 text-white/70 font-medium">B</span>
                <span>Voltar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-white/10 text-white/70 font-medium">X</span>
                <span>Aleatorio</span>
              </div>
            </div>

            {/* Manager Name Input */}
            <div className="flex items-center gap-3">
              <input
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                placeholder="Nome do Tecnico"
                maxLength={32}
                className="w-48 h-10 rounded-lg border border-white/20 bg-black/40 backdrop-blur-sm px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
              
              {/* Start Button */}
              <button
                onClick={handleStart}
                className="flex items-center gap-2 rounded-lg px-6 py-2.5 font-bold text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-black hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-500/30"
              >
                INICIAR CARREIRA
              </button>
            </div>

            {/* Team Counter */}
            <div className="text-xs text-white/40">
              {teamIndex + 1} / {teams.length}
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
