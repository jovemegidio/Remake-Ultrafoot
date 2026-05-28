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
import { ControllerButton } from "@/components/controller-buttons"
import { useTheme } from "@/components/theme-provider"
import { useGamepadContext } from "@/components/gamepad-provider"
import { cn } from "@/lib/utils"

const FLAG_CDN: Record<string, string> = {
  BRA: "br", ENG: "gb-eng", ESP: "es", ITA: "it",
  GER: "de", FRA: "fr", POR: "pt", USA: "us",
  MEX: "mx", KSA: "sa",
}

function getFlagUrl(code: string) {
  const key = FLAG_CDN[code] || code.toLowerCase()
  return `https://flagcdn.com/w80/${key}.png`
}

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
  const { isGamepadConnected } = useGamepadContext()

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
        <header className="flex items-center justify-center py-3 sm:py-5 px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={prevDivision}
              className="text-white/50 hover:text-white transition-colors text-2xl font-light select-none px-2"
            >
              {"<"}
            </button>

            <div className="flex items-center justify-center w-14 h-10">
              {activeDivision.code && (
                <Image
                  src={getFlagUrl(activeDivision.code)}
                  alt={activeDivision.country || ""}
                  width={56}
                  height={40}
                  className="object-contain rounded drop-shadow-lg"
                  unoptimized
                />
              )}
            </div>

            <button
              onClick={nextDivision}
              className="text-white/50 hover:text-white transition-colors text-2xl font-light select-none px-2"
            >
              {">"}
            </button>
          </div>
        </header>

        {/* Main Content - Team Display */}
        <div className="flex-1 flex items-center justify-center px-2 sm:px-6 overflow-hidden">
          <div className="flex items-center gap-2 sm:gap-6 w-full max-w-sm sm:max-w-none justify-center">
            {/* Left Arrow */}
            <button
              onClick={prevTeam}
              className="text-white/40 hover:text-white/70 transition-colors text-3xl sm:text-4xl font-extralight select-none shrink-0 px-1"
            >
              {"◀"}
            </button>

            {/* Team Card - FIFA Style */}
            <div className="flex flex-col items-center min-w-0">
              {/* Card Container */}
              <div className="relative bg-linear-to-b from-white/12 to-white/6 backdrop-blur-md border border-white/20 rounded-lg overflow-hidden w-76 sm:w-84">
                {/* Team Name Header */}
                <div className="px-4 py-2 sm:py-3 border-b border-white/10 bg-white/5">
                  <h1 className="text-xl sm:text-2xl font-bold text-white text-center truncate">
                    {selectedTeam?.nome}
                  </h1>
                </div>

                {/* Team Crest — sem fundo: radial gradient apenas como aura */}
                <div className="py-4 sm:py-6 flex justify-center">
                  <div
                    className="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center"
                    style={{
                      background: `radial-gradient(circle, ${selectedTeam?.cor1}30 0%, transparent 65%)`,
                    }}
                  >
                    <TeamCrest
                      team={selectedTeam}
                      size="2xl"
                      className="w-32 h-32 sm:w-36 sm:h-36"
                    />
                  </div>
                </div>

                {/* Stars Rating */}
                <div className="flex items-center justify-center gap-0.5 pb-3 sm:pb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-5 h-5",
                        i < prestigeStars
                          ? "fill-amber-400 text-amber-400"
                          : "text-white/20"
                      )}
                    />
                  ))}
                </div>

                {/* Stats Bar */}
                <div className="flex items-center justify-center gap-8 py-4 border-t border-white/10 bg-black/20">
                  <div className="text-center">
                    <div className="text-xs text-white/50 uppercase tracking-widest mb-1">ATA</div>
                    <div className="flex items-center gap-1">
                      <span className="text-xl font-bold text-white">{stats.ata.value}</span>
                      <TrendIndicator trend={stats.ata.trend} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-white/50 uppercase tracking-widest mb-1">MEI</div>
                    <div className="flex items-center gap-1">
                      <span className="text-xl font-bold text-white">{stats.mei.value}</span>
                      <TrendIndicator trend={stats.mei.trend} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-white/50 uppercase tracking-widest mb-1">DEF</div>
                    <div className="flex items-center gap-1">
                      <span className="text-xl font-bold text-white">{stats.def.value}</span>
                      <TrendIndicator trend={stats.def.trend} />
                    </div>
                  </div>
                </div>
              </div>

              {/* League Info — abaixo do card, logo sem fundo quadrado */}
              <div className="flex flex-col items-center mt-2 gap-1">
                <span className="text-[10px] text-white/50">{activeDivision.label}</span>
                {leagueLogo && (
                  <Image
                    src={leagueLogo}
                    alt={activeDivision.label}
                    width={64}
                    height={32}
                    className="object-contain"
                    style={{ mixBlendMode: "screen" }}
                    unoptimized
                  />
                )}
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={nextTeam}
              className="text-white/40 hover:text-white/70 transition-colors text-3xl sm:text-4xl font-extralight select-none shrink-0 px-1"
            >
              {"▶"}
            </button>
          </div>
        </div>

        {/* Bottom Bar - Actions */}
        <footer className="py-3 sm:py-4 px-3 sm:px-6 bg-linear-to-t from-black/60 to-transparent">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-0 sm:justify-between">
            {/* Controls Legend — só aparece com controle conectado */}
            {isGamepadConnected && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <ControllerButton button="A" controller="playstation" size="sm" showLabel={false} />
                  <span className="text-white/70">Selecionar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ControllerButton button="B" controller="playstation" size="sm" showLabel={false} />
                  <span className="text-white/70">Voltar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ControllerButton button="X" controller="playstation" size="sm" showLabel={false} />
                  <span className="text-white/70">Aleatório</span>
                </div>
              </div>
            )}

            {/* Center - Manager Input & Start */}
            <div className={cn("flex items-center gap-3", !isGamepadConnected && "sm:mx-auto")}>
              <input
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                placeholder="Nome do Técnico"
                maxLength={32}
                className="w-36 sm:w-44 h-9 rounded border border-white/20 bg-black/50 backdrop-blur-sm px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
              <button
                onClick={handleStart}
                className="rounded px-4 sm:px-5 py-2 font-bold text-sm bg-emerald-500 text-black hover:bg-emerald-400 transition-all whitespace-nowrap"
              >
                INICIAR CARREIRA
              </button>
            </div>

            {/* Right - Team Counter */}
            <div className="text-white/50 text-xs">
              <span>{teamIndex + 1} / {teams.length}</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
