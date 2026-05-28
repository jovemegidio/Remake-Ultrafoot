"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Star, ChevronUp, ChevronDown, Minus } from "lucide-react"
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
  flagImg?: string
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
    const hash = (str: string, seed: number) => {
      let h = seed
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0
      }
      return Math.abs(h % 100) / 100 - 0.5
    }
    const ataVal = Math.round(base + hash(teamName, 1) * 10)
    const meiVal = Math.round(base + hash(teamName, 2) * 8)
    const defVal = Math.round(base + hash(teamName, 3) * 10)
    return {
      ata: { value: ataVal, trend: hash(teamName, 4) > 0.1 ? "up" : hash(teamName, 4) < -0.1 ? "down" : "neutral" },
      mei: { value: meiVal, trend: hash(teamName, 5) > 0.1 ? "up" : hash(teamName, 5) < -0.1 ? "down" : "neutral" },
      def: { value: defVal, trend: hash(teamName, 6) > 0.1 ? "up" : hash(teamName, 6) < -0.1 ? "down" : "neutral" },
    }
  }, [overall, selectedTeam])

  const handleStart = useCallback(() => {
    if (!selectedTeam) return
    setTeamColors({ primary: selectedTeam.cor1, secondary: selectedTeam.cor2 })
    setTheme("team")
    initializeNewGame(selectedTeam.curto, managerName)
    router.push("/")
  }, [selectedTeam, managerName, initializeNewGame, router, setTeamColors, setTheme])

  const nextTeam = useCallback(() => {
    setTeamIndex(prev => (prev + 1) % teams.length)
  }, [teams.length])

  const prevTeam = useCallback(() => {
    setTeamIndex(prev => (prev - 1 + teams.length) % teams.length)
  }, [teams.length])

  const nextDivision = useCallback(() => {
    setDivisaoIndex(prev => (prev + 1) % DIVISIONS.length)
    setTeamIndex(0)
  }, [])

  const prevDivision = useCallback(() => {
    setDivisaoIndex(prev => (prev - 1 + DIVISIONS.length) % DIVISIONS.length)
    setTeamIndex(0)
  }, [])

  const selectRandomTeam = useCallback(() => {
    setTeamIndex(Math.floor(Math.random() * teams.length))
  }, [teams.length])

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
  }, [handleStart, router, prevTeam, nextTeam])

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
  }, [handleStart, router, prevTeam, nextTeam, prevDivision, nextDivision, selectRandomTeam])

  const leagueLogo = getLeagueLogo(activeDivision.key)
  const prestigeStars = Math.round((selectedTeam?.prestigio || 50) / 20)

  // Stat trend indicator component
  const TrendIndicator = ({ trend }: { trend: string }) => {
    if (trend === "up") return <ChevronUp className="w-3 h-3 text-emerald-400" />
    if (trend === "down") return <ChevronDown className="w-3 h-3 text-red-400" />
    return <Minus className="w-3 h-3 text-white/40" />
  }

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
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Top Bar - Country & Flag */}
        <header className="flex items-center justify-center py-6 px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={prevDivision}
              className="text-white/50 hover:text-white transition-colors text-2xl font-light select-none"
            >
              {"<"}
            </button>

            <div className="flex items-center gap-3 min-w-[200px] justify-center">
              <span className="text-white/90 font-medium tracking-wide">
                {activeDivision.country}
              </span>
              <span className="text-2xl">{activeDivision.flag}</span>
            </div>

            <button
              onClick={nextDivision}
              className="text-white/50 hover:text-white transition-colors text-2xl font-light select-none"
            >
              {">"}
            </button>
          </div>
        </header>

        {/* Main Content - Team Display */}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="flex items-center gap-6">
            {/* Left Arrow */}
            <button
              onClick={prevTeam}
              className="text-white/40 hover:text-white/70 transition-colors text-4xl font-extralight select-none"
            >
              {"◀"}
            </button>

            {/* Team Card - FIFA Style */}
            <div className="relative">
              {/* Card Container */}
              <div 
                className="relative bg-gradient-to-b from-white/[0.12] to-white/[0.06] backdrop-blur-md border border-white/20 rounded-lg overflow-hidden"
                style={{ width: "280px" }}
              >
                {/* Team Name Header */}
                <div className="px-4 py-3 border-b border-white/10 bg-white/5">
                  <h1 className="text-xl font-bold text-white text-center">
                    {selectedTeam?.nome}
                  </h1>
                </div>

                {/* Team Crest */}
                <div className="py-6 flex justify-center">
                  <div 
                    className="w-36 h-36 flex items-center justify-center rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${selectedTeam?.cor1}20 0%, transparent 70%)`,
                    }}
                  >
                    <TeamCrest 
                      team={selectedTeam} 
                      size="2xl" 
                      className="w-28 h-28 drop-shadow-[0_5px_15px_rgba(0,0,0,0.4)]" 
                    />
                  </div>
                </div>

                {/* Stars Rating */}
                <div className="flex items-center justify-center gap-0.5 pb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={cn(
                        "w-4 h-4",
                        i < prestigeStars 
                          ? "fill-amber-400 text-amber-400" 
                          : "text-white/20"
                      )} 
                    />
                  ))}
                </div>

                {/* Stats Bar */}
                <div className="flex items-center justify-center gap-6 py-3 border-t border-white/10 bg-black/20">
                  <div className="text-center">
                    <div className="text-[10px] text-white/50 uppercase tracking-widest mb-0.5">ATA</div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-white">{stats.ata.value}</span>
                      <TrendIndicator trend={stats.ata.trend} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-white/50 uppercase tracking-widest mb-0.5">MEI</div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-white">{stats.mei.value}</span>
                      <TrendIndicator trend={stats.mei.trend} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-white/50 uppercase tracking-widest mb-0.5">DEF</div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-white">{stats.def.value}</span>
                      <TrendIndicator trend={stats.def.trend} />
                    </div>
                  </div>
                </div>
              </div>

              {/* League Info - Below Card */}
              <div className="flex flex-col items-center mt-4 gap-2">
                <span className="text-xs text-white/60">{activeDivision.label}</span>
                {leagueLogo && (
                  <Image
                    src={leagueLogo}
                    alt={activeDivision.label}
                    width={100}
                    height={50}
                    className="object-contain"
                    unoptimized
                  />
                )}
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={nextTeam}
              className="text-white/40 hover:text-white/70 transition-colors text-4xl font-extralight select-none"
            >
              {"▶"}
            </button>
          </div>
        </div>

        {/* Bottom Bar - Actions */}
        <footer className="py-4 px-6 bg-gradient-to-t from-black/60 to-transparent">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            {/* Controls Legend - FIFA Style */}
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-sm bg-blue-600 flex items-center justify-center text-white font-bold text-xs">X</span>
                <span className="text-white/70">Selecionar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-sm bg-red-600 flex items-center justify-center text-white font-bold text-xs">O</span>
                <span className="text-white/70">Voltar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-sm bg-pink-600 flex items-center justify-center text-white font-bold text-xs">□</span>
                <span className="text-white/70">Aleatorio</span>
              </div>
            </div>

            {/* Center - Manager Input & Start */}
            <div className="flex items-center gap-3">
              <input
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                placeholder="Nome do Tecnico"
                maxLength={32}
                className="w-44 h-9 rounded border border-white/20 bg-black/50 backdrop-blur-sm px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
              <button
                onClick={handleStart}
                className="flex items-center gap-2 rounded px-5 py-2 font-bold text-sm bg-emerald-500 text-black hover:bg-emerald-400 transition-all"
              >
                INICIAR CARREIRA
              </button>
            </div>

            {/* Right - Team Counter & Icons */}
            <div className="flex items-center gap-4 text-white/50 text-xs">
              <span>{teamIndex + 1} / {teams.length}</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
