"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Star, ChevronUp, ChevronDown, Minus, ChevronLeft, ChevronRight, User } from "lucide-react"
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
  saudiFirstDivTeams,
  mlsTeams,
  ligaMXTeams,
  primeiraLigaTeams,
  jLeagueTeams,
  eredivisieTeams,
  scottishPremTeams,
  superLigTeams,
  proLeagueBelTeams,
  russianPremTeams,
  ligaArgentinaTeams,
  primeiraAColTeams,
  primeraDivChileTeams,
  primeraDivUryTeams,
  kLeague1Teams,
  chineseSuperTeams,
} from "@/lib/international-teams"
import { getLeagueLogo } from "@/lib/league-logos"
import { teamRating } from "@/lib/players-data"
import { useGameManager } from "@/lib/use-game-manager"
import { TeamCrest } from "@/components/team-crest"
import { ControllerButton } from "@/components/controller-buttons"
import { useTheme } from "@/components/theme-provider"
import { useGamepadContext } from "@/components/gamepad-provider"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"

const FLAG_MAP: Record<string, string> = {
  BRA: "br", ENG: "gb-eng", ESP: "es", ITA: "it",
  GER: "de", FRA: "fr", POR: "pt", USA: "us",
  MEX: "mx", KSA: "sa", NED: "nl", SCO: "gb-sct",
  TUR: "tr", BEL: "be", RUS: "ru", ARG: "ar",
  COL: "co", CHI: "cl", URU: "uy", JPN: "jp",
  KOR: "kr", CHN: "cn",
}

function getFlagUrl(code: string) {
  const key = FLAG_MAP[code] || code.toLowerCase()
  return `/flags/${key}.png`
}

interface LeagueTab {
  key: Divisao
  label: string
  short: string
  teams: Team[]
}

interface CountryTab {
  name: string
  code: string
  region: Regiao
  leagues: LeagueTab[]
}

const COUNTRIES: CountryTab[] = [
  {
    name: "Brasil", code: "BRA", region: "brasil",
    leagues: [
      { key: "serie_a", label: "Brasileirao Serie A", short: "Serie A", teams: serieATeams },
      { key: "serie_b", label: "Brasileirao Serie B", short: "Serie B", teams: serieBTeams },
      { key: "serie_c", label: "Brasileirao Serie C", short: "Serie C", teams: serieCTeams },
      { key: "serie_d", label: "Brasileirao Serie D", short: "Serie D", teams: serieDTeams },
    ],
  },
  {
    name: "Inglaterra", code: "ENG", region: "europa",
    leagues: [
      { key: "premier_league", label: "Premier League", short: "Premier League", teams: premierLeagueTeams },
    ],
  },
  {
    name: "Espanha", code: "ESP", region: "europa",
    leagues: [
      { key: "la_liga", label: "La Liga", short: "La Liga", teams: laLigaTeams },
    ],
  },
  {
    name: "Italia", code: "ITA", region: "europa",
    leagues: [
      { key: "serie_a_ita", label: "Serie A", short: "Serie A", teams: serieAItaTeams },
    ],
  },
  {
    name: "Alemanha", code: "GER", region: "europa",
    leagues: [
      { key: "bundesliga", label: "Bundesliga", short: "Bundesliga", teams: bundesligaTeams },
    ],
  },
  {
    name: "Franca", code: "FRA", region: "europa",
    leagues: [
      { key: "ligue_1", label: "Ligue 1", short: "Ligue 1", teams: ligue1Teams },
    ],
  },
  {
    name: "Portugal", code: "POR", region: "europa",
    leagues: [
      { key: "primeira_liga", label: "Primeira Liga", short: "Primeira Liga", teams: primeiraLigaTeams },
    ],
  },
  {
    name: "Holanda", code: "NED", region: "europa",
    leagues: [
      { key: "eredivisie", label: "Eredivisie", short: "Eredivisie", teams: eredivisieTeams },
    ],
  },
  {
    name: "Escocia", code: "SCO", region: "europa",
    leagues: [
      { key: "scottish_prem", label: "Scottish Premiership", short: "Scottish Prem", teams: scottishPremTeams },
    ],
  },
  {
    name: "Turquia", code: "TUR", region: "europa",
    leagues: [
      { key: "super_lig", label: "Super Lig", short: "Super Lig", teams: superLigTeams },
    ],
  },
  {
    name: "Belgica", code: "BEL", region: "europa",
    leagues: [
      { key: "pro_league_bel", label: "Belgian Pro League", short: "Pro League", teams: proLeagueBelTeams },
    ],
  },
  {
    name: "Russia", code: "RUS", region: "europa",
    leagues: [
      { key: "russian_prem", label: "Russian Premier League", short: "Russian Prem", teams: russianPremTeams },
    ],
  },
  {
    name: "EUA", code: "USA", region: "americas",
    leagues: [
      { key: "mls", label: "MLS", short: "MLS", teams: mlsTeams },
    ],
  },
  {
    name: "Mexico", code: "MEX", region: "americas",
    leagues: [
      { key: "liga_mx", label: "Liga MX", short: "Liga MX", teams: ligaMXTeams },
    ],
  },
  {
    name: "Argentina", code: "ARG", region: "americas",
    leagues: [
      { key: "liga_argentina", label: "Liga Argentina", short: "Liga Argentina", teams: ligaArgentinaTeams },
    ],
  },
  {
    name: "Colombia", code: "COL", region: "americas",
    leagues: [
      { key: "primera_a_col", label: "Primera A", short: "Primera A", teams: primeiraAColTeams },
    ],
  },
  {
    name: "Chile", code: "CHI", region: "americas",
    leagues: [
      { key: "primera_div_chi", label: "Primera Division", short: "Primera Div", teams: primeraDivChileTeams },
    ],
  },
  {
    name: "Uruguai", code: "URU", region: "americas",
    leagues: [
      { key: "primera_div_ury", label: "Primera Division", short: "Primera Div", teams: primeraDivUryTeams },
    ],
  },
  {
    name: "Arabia Saudita", code: "KSA", region: "asia",
    leagues: [
      { key: "saudi_pro", label: "Saudi Pro League", short: "Saudi Pro", teams: saudiProTeams },
      { key: "saudi_first_div", label: "Saudi First Division", short: "Saudi 1a Div", teams: saudiFirstDivTeams },
    ],
  },
  {
    name: "Japao", code: "JPN", region: "asia",
    leagues: [
      { key: "j_league", label: "J-League", short: "J-League", teams: jLeagueTeams },
    ],
  },
  {
    name: "Coreia do Sul", code: "KOR", region: "asia",
    leagues: [
      { key: "k_league_1", label: "K-League 1", short: "K-League 1", teams: kLeague1Teams },
    ],
  },
  {
    name: "China", code: "CHN", region: "asia",
    leagues: [
      { key: "chinese_super", label: "Chinese Super League", short: "Super League", teams: chineseSuperTeams },
    ],
  },
]

const STADIUM_BG = "/images/stadium-bg.png"

export default function NovoJogoPage() {
  const { initializeNewGame } = useGameManager()
  const { setTheme, setTeamColors } = useTheme()
  const { isGamepadConnected } = useGamepadContext()

  const [countryIndex, setCountryIndex] = useState(0)
  const [leagueIndex, setLeagueIndex] = useState(0)
  const [teamIndex, setTeamIndex] = useState(0)
  const [managerName, setManagerName] = useState("")

  const activeCountry = COUNTRIES[countryIndex]
  const activeLeague = activeCountry.leagues[leagueIndex]
  const teams = activeLeague.teams
  const selectedTeam = teams[teamIndex]

  const overall = useMemo(() => teamRating(selectedTeam?.nome || ""), [selectedTeam])

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
    window.sessionStorage.setItem("ultrafoot:session-active", "true")
    hardNavigate("/")
  }, [selectedTeam, managerName, initializeNewGame, setTeamColors, setTheme])

  const nextTeam = useCallback(() => setTeamIndex(prev => (prev + 1) % teams.length), [teams.length])
  const prevTeam = useCallback(() => setTeamIndex(prev => (prev - 1 + teams.length) % teams.length), [teams.length])

  const nextCountry = useCallback(() => {
    setCountryIndex(prev => (prev + 1) % COUNTRIES.length)
    setLeagueIndex(0)
    setTeamIndex(0)
  }, [])
  const prevCountry = useCallback(() => {
    setCountryIndex(prev => (prev - 1 + COUNTRIES.length) % COUNTRIES.length)
    setLeagueIndex(0)
    setTeamIndex(0)
  }, [])

  const nextLeague = useCallback(() => {
    setLeagueIndex(prev => (prev + 1) % activeCountry.leagues.length)
    setTeamIndex(0)
  }, [activeCountry.leagues.length])
  const prevLeague = useCallback(() => {
    setLeagueIndex(prev => (prev - 1 + activeCountry.leagues.length) % activeCountry.leagues.length)
    setTeamIndex(0)
  }, [activeCountry.leagues.length])

  const selectRandomTeam = useCallback(() => setTeamIndex(Math.floor(Math.random() * teams.length)), [teams.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft": prevTeam(); break
        case "ArrowRight": nextTeam(); break
        case "Enter": handleStart(); break
        case "Escape":
        case "Backspace": hardNavigate("/splash"); break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleStart, prevTeam, nextTeam])

  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "B": hardNavigate("/splash"); break
        case "A":
        case "START": handleStart(); break
        case "DPAD_LEFT": prevTeam(); break
        case "DPAD_RIGHT": nextTeam(); break
        case "LB": prevCountry(); break
        case "RB": nextCountry(); break
        case "LT": prevLeague(); break
        case "RT": nextLeague(); break
        case "X": selectRandomTeam(); break
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [handleStart, prevTeam, nextTeam, prevCountry, nextCountry, prevLeague, nextLeague, selectRandomTeam])

  const leagueLogo = getLeagueLogo(activeLeague.key)
  const prestigeStars = Math.round((selectedTeam?.prestigio || 50) / 20)
  const cor1 = selectedTeam?.cor1 || "#10b981"
  const cor2 = selectedTeam?.cor2 || "#059669"
  const hasMultipleLeagues = activeCountry.leagues.length > 1

  const TrendIndicator = ({ trend }: { trend: string }) => {
    if (trend === "up") return <ChevronUp className="w-3 h-3 text-emerald-400" />
    if (trend === "down") return <ChevronDown className="w-3 h-3 text-red-400" />
    return <Minus className="w-3 h-3 text-white/30" />
  }

  const SelectorPill = ({
    onPrev, onNext, children, showArrows = true,
  }: { onPrev: () => void; onNext: () => void; children: React.ReactNode; showArrows?: boolean }) => (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-2 shadow-xl"
      style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {showArrows && (
        <button
          onClick={onPrev}
          className="w-6 h-6 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
      {children}
      {showArrows && (
        <button
          onClick={onNext}
          className="w-6 h-6 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image src={STADIUM_BG} alt="Stadium Background" fill className="object-cover" priority unoptimized />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />
      </div>

      <div className="relative z-10 h-full flex flex-col">

        {/* ── Card central + seletores ── */}
        <div className="flex-1 flex items-center justify-center px-2 sm:px-6 overflow-hidden">
          <div className="flex items-center gap-4 sm:gap-8 w-full max-w-sm sm:max-w-none justify-center">

            {/* Seta esquerda — times */}
            <button
              onClick={prevTeam}
              className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0 border border-white/10 backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Coluna central: país → card → liga */}
            <div className="flex flex-col items-center min-w-0 gap-3">

              {/* ── Seletor de PAÍS ── */}
              <SelectorPill onPrev={prevCountry} onNext={nextCountry}>
                <div className="flex items-center gap-2.5 min-w-[140px] justify-center">
                  <div className="w-8 h-5 rounded overflow-hidden shadow-md flex-shrink-0">
                    <Image
                      src={getFlagUrl(activeCountry.code)}
                      alt={activeCountry.name}
                      width={32}
                      height={20}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-white font-semibold text-sm tracking-wide">{activeCountry.name}</span>
                    <span className="text-white/40 text-[10px] mt-0.5">{COUNTRIES.length} países</span>
                  </div>
                </div>
              </SelectorPill>

              {/* ── Card principal ── */}
              <div
                className="relative rounded-2xl overflow-hidden shadow-2xl w-72 sm:w-80"
                style={{
                  background: `linear-gradient(160deg, ${cor1}22 0%, rgba(5,10,15,0.88) 55%, ${cor2}15 100%)`,
                  border: `1px solid ${cor1}50`,
                  boxShadow: `0 0 60px ${cor1}18, 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)`,
                }}
              >
                {/* Faixa de cor */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${cor1}, ${cor2})` }} />

                {/* Nome do time */}
                <div className="px-5 py-3 border-b" style={{ borderColor: `${cor1}25`, background: `${cor1}10` }}>
                  <h1 className="text-xl sm:text-2xl font-bold text-white text-center tracking-wide truncate">
                    {selectedTeam?.nome}
                  </h1>
                </div>

                {/* Escudo */}
                <div className="py-5 sm:py-7 flex justify-center">
                  <div
                    className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center rounded-full"
                    style={{ background: `radial-gradient(circle, ${cor1}28 0%, transparent 68%)` }}
                  >
                    <TeamCrest team={selectedTeam} size="2xl" className="w-32 h-32 sm:w-36 sm:h-36" />
                  </div>
                </div>

                {/* Estrelas */}
                <div className="flex items-center justify-center gap-1 pb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-5 h-5 sm:w-6 sm:h-6",
                        i < prestigeStars
                          ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]"
                          : "text-white/15"
                      )}
                    />
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-stretch border-t" style={{ borderColor: `${cor1}25`, background: "rgba(0,0,0,0.35)" }}>
                  <div className="flex-1 text-center py-3.5 px-2">
                    <div className="text-[9px] font-bold text-orange-400/70 uppercase tracking-[0.15em] mb-1.5">ATA</div>
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="text-2xl font-black text-white leading-none">{stats.ata.value}</span>
                      <TrendIndicator trend={stats.ata.trend} />
                    </div>
                  </div>
                  <div className="w-px" style={{ background: `${cor1}25` }} />
                  <div className="flex-1 text-center py-3.5 px-2">
                    <div className="text-[9px] font-bold text-sky-400/70 uppercase tracking-[0.15em] mb-1.5">MEI</div>
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="text-2xl font-black text-white leading-none">{stats.mei.value}</span>
                      <TrendIndicator trend={stats.mei.trend} />
                    </div>
                  </div>
                  <div className="w-px" style={{ background: `${cor1}25` }} />
                  <div className="flex-1 text-center py-3.5 px-2">
                    <div className="text-[9px] font-bold text-emerald-400/70 uppercase tracking-[0.15em] mb-1.5">DEF</div>
                    <div className="flex items-center justify-center gap-0.5">
                      <span className="text-2xl font-black text-white leading-none">{stats.def.value}</span>
                      <TrendIndicator trend={stats.def.trend} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Seletor de LIGA ── */}
              <SelectorPill onPrev={prevLeague} onNext={nextLeague} showArrows={hasMultipleLeagues}>
                <div className="flex items-center gap-2 min-w-[160px] justify-center">
                  {leagueLogo && (
                    <Image
                      src={leagueLogo}
                      alt={activeLeague.label}
                      width={28}
                      height={14}
                      className="object-contain flex-shrink-0"
                      style={{ mixBlendMode: "screen" }}
                      unoptimized
                    />
                  )}
                  <div className="flex flex-col leading-none">
                    <span className="text-white font-semibold text-sm tracking-wide whitespace-nowrap">
                      {activeLeague.short}
                    </span>
                    <span className="text-white/40 text-[10px] mt-0.5">
                      {activeCountry.leagues.length > 1
                        ? `${leagueIndex + 1} / ${activeCountry.leagues.length} ligas`
                        : `${teams.length} times`}
                    </span>
                  </div>
                </div>
              </SelectorPill>

            </div>

            {/* Seta direita — times */}
            <button
              onClick={nextTeam}
              className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0 border border-white/10 backdrop-blur-sm"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* ── Footer Profissional ── */}
        <footer className="relative pt-4 pb-6 px-4 sm:px-8">
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none" />

          <div className="relative flex flex-col items-center gap-4">

            {/* Separador com label */}
            <div className="flex items-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${cor1}40)` }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: `${cor1}99` }}>
                Seu Técnico
              </span>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, ${cor1}40)` }} />
            </div>

            {/* Input de nome */}
            <div className="relative w-full max-w-xs">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `${cor1}70` }} />
              <input
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                placeholder="Digite seu nome..."
                maxLength={32}
                className="w-full h-12 rounded-xl pl-11 pr-4 text-sm text-white placeholder:text-white/25 focus:outline-none transition-all text-center"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  border: `1px solid ${cor1}30`,
                  backdropFilter: "blur(12px)",
                  letterSpacing: "0.05em",
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = `${cor1}70`
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${cor1}15, 0 0 20px ${cor1}10`
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = `${cor1}30`
                  e.currentTarget.style.boxShadow = "none"
                }}
              />
            </div>

            {/* Botão INICIAR CARREIRA */}
            <button
              onClick={handleStart}
              className="relative w-full max-w-xs h-14 rounded-2xl font-black text-base tracking-[0.2em] uppercase text-white transition-all active:scale-[0.97] overflow-hidden group"
              style={{
                background: `linear-gradient(135deg, ${cor1} 0%, ${cor2} 100%)`,
                boxShadow: `0 8px 32px ${cor1}50, 0 2px 0 rgba(255,255,255,0.12) inset, 0 -2px 0 rgba(0,0,0,0.2) inset`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = `0 12px 40px ${cor1}70, 0 2px 0 rgba(255,255,255,0.12) inset`
                e.currentTarget.style.filter = "brightness(1.08)"
                e.currentTarget.style.transform = "translateY(-1px)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = `0 8px 32px ${cor1}50, 0 2px 0 rgba(255,255,255,0.12) inset, 0 -2px 0 rgba(0,0,0,0.2) inset`
                e.currentTarget.style.filter = "none"
                e.currentTarget.style.transform = "none"
              }}
            >
              {/* Brilho superior */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/10 rounded-t-2xl" />
              <span className="relative z-10 drop-shadow-sm">⚽ INICIAR CARREIRA</span>
            </button>

            {/* Rodapé: gamepad + contador */}
            <div className="flex items-center justify-between w-full max-w-xs">
              {isGamepadConnected ? (
                <div className="flex items-center gap-3 text-[10px] text-white/40">
                  <div className="flex items-center gap-1">
                    <ControllerButton button="A" controller="playstation" size="sm" showLabel={false} />
                    <span>Iniciar</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ControllerButton button="B" controller="playstation" size="sm" showLabel={false} />
                    <span>Voltar</span>
                  </div>
                  <span className="text-white/20">LB/RB · LT/RT</span>
                </div>
              ) : (
                <div />
              )}
              <span className="text-white/30 text-xs font-mono tabular-nums">
                {teamIndex + 1} / {teams.length}
              </span>
            </div>

          </div>
        </footer>
      </div>
    </main>
  )
}
