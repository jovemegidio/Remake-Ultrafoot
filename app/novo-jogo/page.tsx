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
  // Brasil
  { key: "serie_a", label: "Brasileirao Serie A", short: "Serie A", teams: serieATeams, region: "brasil", country: "Brasil", code: "BRA", flag: "🇧🇷" },
  { key: "serie_b", label: "Brasileirao Serie B", short: "Serie B", teams: serieBTeams, region: "brasil", country: "Brasil", code: "BRA", flag: "🇧🇷" },
  { key: "serie_c", label: "Brasileirao Serie C", short: "Serie C", teams: serieCTeams, region: "brasil", country: "Brasil", code: "BRA", flag: "🇧🇷" },
  { key: "serie_d", label: "Brasileirao Serie D", short: "Serie D", teams: serieDTeams, region: "brasil", country: "Brasil", code: "BRA", flag: "🇧🇷" },
  // Europa - Top 5
  { key: "premier_league", label: "Premier League", short: "Premier", teams: premierLeagueTeams, region: "europa", country: "Inglaterra", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { key: "la_liga", label: "La Liga", short: "La Liga", teams: laLigaTeams, region: "europa", country: "Espanha", code: "ESP", flag: "🇪🇸" },
  { key: "serie_a_ita", label: "Serie A Italia", short: "Serie A", teams: serieAItaTeams, region: "europa", country: "Italia", code: "ITA", flag: "🇮🇹" },
  { key: "bundesliga", label: "Bundesliga", short: "Bundesliga", teams: bundesligaTeams, region: "europa", country: "Alemanha", code: "GER", flag: "🇩🇪" },
  { key: "ligue_1", label: "Ligue 1", short: "Ligue 1", teams: ligue1Teams, region: "europa", country: "Franca", code: "FRA", flag: "🇫🇷" },
  // Europa - Demais
  { key: "primeira_liga", label: "Primeira Liga", short: "Portugal", teams: primeiraLigaTeams, region: "europa", country: "Portugal", code: "POR", flag: "🇵🇹" },
  { key: "eredivisie", label: "Eredivisie", short: "Eredivisie", teams: eredivisieTeams, region: "europa", country: "Holanda", code: "NED", flag: "🇳🇱" },
  { key: "scottish_prem", label: "Scottish Premiership", short: "Scotland", teams: scottishPremTeams, region: "europa", country: "Escocia", code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { key: "super_lig", label: "Super Lig", short: "Super Lig", teams: superLigTeams, region: "europa", country: "Turquia", code: "TUR", flag: "🇹🇷" },
  { key: "pro_league_bel", label: "Belgian Pro League", short: "Pro League", teams: proLeagueBelTeams, region: "europa", country: "Belgica", code: "BEL", flag: "🇧🇪" },
  { key: "russian_prem", label: "Russian Premier League", short: "Russia", teams: russianPremTeams, region: "europa", country: "Russia", code: "RUS", flag: "🇷🇺" },
  // Americas
  { key: "mls", label: "MLS", short: "MLS", teams: mlsTeams, region: "americas", country: "EUA", code: "USA", flag: "🇺🇸" },
  { key: "liga_mx", label: "Liga MX", short: "Liga MX", teams: ligaMXTeams, region: "americas", country: "Mexico", code: "MEX", flag: "🇲🇽" },
  { key: "liga_argentina", label: "Liga Argentina", short: "Argentina", teams: ligaArgentinaTeams, region: "americas", country: "Argentina", code: "ARG", flag: "🇦🇷" },
  { key: "primera_a_col", label: "Primera A Colombia", short: "Colombia", teams: primeiraAColTeams, region: "americas", country: "Colombia", code: "COL", flag: "🇨🇴" },
  { key: "primera_div_chi", label: "Primera Division Chile", short: "Chile", teams: primeraDivChileTeams, region: "americas", country: "Chile", code: "CHI", flag: "🇨🇱" },
  { key: "primera_div_ury", label: "Primera Division Uruguay", short: "Uruguai", teams: primeraDivUryTeams, region: "americas", country: "Uruguai", code: "URU", flag: "🇺🇾" },
  // Asia
  { key: "saudi_pro", label: "Saudi Pro League", short: "Saudi Pro", teams: saudiProTeams, region: "asia", country: "Arabia Saudita", code: "KSA", flag: "🇸🇦" },
  { key: "saudi_first_div", label: "Saudi First Division", short: "Saudi Div 1", teams: saudiFirstDivTeams, region: "asia", country: "Arabia Saudita", code: "KSA", flag: "🇸🇦" },
  { key: "j_league", label: "J-League", short: "J-League", teams: jLeagueTeams, region: "asia", country: "Japao", code: "JPN", flag: "🇯🇵" },
  { key: "k_league_1", label: "K-League 1", short: "K-League", teams: kLeague1Teams, region: "asia", country: "Coreia do Sul", code: "KOR", flag: "🇰🇷" },
  { key: "chinese_super", label: "Chinese Super League", short: "China", teams: chineseSuperTeams, region: "asia", country: "China", code: "CHN", flag: "🇨🇳" },
]

const STADIUM_BG = "/images/stadium-bg.png"

export default function NovoJogoPage() {
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
        case "LB": prevDivision(); break
        case "RB": nextDivision(); break
        case "X": selectRandomTeam(); break
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [handleStart, prevTeam, nextTeam, prevDivision, nextDivision, selectRandomTeam])

  const leagueLogo = getLeagueLogo(activeDivision.key)
  const prestigeStars = Math.round((selectedTeam?.prestigio || 50) / 20)
  const cor1 = selectedTeam?.cor1 || "#10b981"
  const cor2 = selectedTeam?.cor2 || "#059669"

  const TrendIndicator = ({ trend }: { trend: string }) => {
    if (trend === "up") return <ChevronUp className="w-3 h-3 text-emerald-400" />
    if (trend === "down") return <ChevronDown className="w-3 h-3 text-red-400" />
    return <Minus className="w-3 h-3 text-white/30" />
  }

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image src={STADIUM_BG} alt="Stadium Background" fill className="object-cover" priority unoptimized />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70" />
      </div>

      <div className="relative z-10 h-full flex flex-col">

        {/* ── ÁREA 1+2+3: Card do time + seletor de país (overlay) + badge da liga ── */}
        <div className="flex-1 flex items-center justify-center px-2 sm:px-6 overflow-hidden">
          <div className="flex items-center gap-4 sm:gap-8 w-full max-w-sm sm:max-w-none justify-center">

            {/* Seta esquerda */}
            <button
              onClick={prevTeam}
              className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0 border border-white/10 backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Card + Liga */}
            <div className="flex flex-col items-center min-w-0">

              {/* ── Seletor de país/liga flutuando acima do card ── */}
              <div
                className="flex items-center gap-3 rounded-full px-4 py-2.5 shadow-xl mb-[-1px] z-10 relative"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                <button
                  onClick={prevDivision}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2.5 min-w-[130px] justify-center">
                  <div className="w-9 h-6 rounded overflow-hidden shadow-md flex-shrink-0">
                    {activeDivision.code && (
                      <Image
                        src={getFlagUrl(activeDivision.code)}
                        alt={activeDivision.country || ""}
                        width={36}
                        height={24}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-white font-semibold text-sm tracking-wide">{activeDivision.country}</span>
                    <span className="text-white/45 text-[10px] mt-0.5">{activeDivision.short}</span>
                  </div>
                </div>

                <button
                  onClick={nextDivision}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Card principal */}
              <div
                className="relative rounded-b-2xl rounded-t-lg overflow-hidden shadow-2xl w-72 sm:w-80"
                style={{
                  background: `linear-gradient(160deg, ${cor1}22 0%, rgba(5,10,15,0.88) 55%, ${cor2}15 100%)`,
                  border: `1px solid ${cor1}50`,
                  borderTop: `1px solid ${cor1}30`,
                  boxShadow: `0 0 60px ${cor1}18, 0 20px 60px rgba(0,0,0,0.6)`,
                }}
              >
                {/* Faixa de cor do time no topo */}
                <div
                  className="h-1 w-full"
                  style={{ background: `linear-gradient(90deg, ${cor1}, ${cor2})` }}
                />

                {/* Nome do time */}
                <div
                  className="px-5 py-3 border-b"
                  style={{ borderColor: `${cor1}25`, background: `${cor1}10` }}
                >
                  <h1 className="text-xl sm:text-2xl font-bold text-white text-center tracking-wide truncate">
                    {selectedTeam?.nome}
                  </h1>
                </div>

                {/* Escudo */}
                <div className="py-5 sm:py-7 flex justify-center">
                  <div
                    className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center rounded-full"
                    style={{
                      background: `radial-gradient(circle, ${cor1}28 0%, transparent 68%)`,
                    }}
                  >
                    <TeamCrest team={selectedTeam} size="2xl" className="w-32 h-32 sm:w-36 sm:h-36" />
                  </div>
                </div>

                {/* Estrelas de prestígio */}
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
                <div
                  className="flex items-stretch border-t"
                  style={{ borderColor: `${cor1}25`, background: "rgba(0,0,0,0.35)" }}
                >
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

              {/* ── ÁREA 3: Badge da liga ── */}
              <div
                className="flex items-center gap-2.5 mt-3 rounded-full px-4 py-2 shadow-lg"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                {leagueLogo && (
                  <Image
                    src={leagueLogo}
                    alt={activeDivision.label}
                    width={32}
                    height={16}
                    className="object-contain flex-shrink-0"
                    style={{ mixBlendMode: "screen" }}
                    unoptimized
                  />
                )}
                <span className="text-sm font-medium text-white/75 tracking-wide whitespace-nowrap">
                  {activeDivision.label}
                </span>
              </div>
            </div>

            {/* Seta direita */}
            <button
              onClick={nextTeam}
              className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0 border border-white/10 backdrop-blur-sm"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* ── ÁREA 4: Footer com input e botão ── */}
        <footer className="py-4 sm:py-5 px-4 sm:px-6 bg-gradient-to-t from-black/75 via-black/30 to-transparent">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-0 sm:justify-between">

            {/* Controles do gamepad */}
            {isGamepadConnected && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <ControllerButton button="A" controller="playstation" size="sm" showLabel={false} />
                  <span className="text-white/60">Selecionar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ControllerButton button="B" controller="playstation" size="sm" showLabel={false} />
                  <span className="text-white/60">Voltar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ControllerButton button="X" controller="playstation" size="sm" showLabel={false} />
                  <span className="text-white/60">Aleatório</span>
                </div>
              </div>
            )}

            {/* Input + botão */}
            <div className={cn("flex items-center gap-3", !isGamepadConnected && "sm:mx-auto")}>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                <input
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  placeholder="Nome do Técnico"
                  maxLength={32}
                  className="w-44 sm:w-52 h-10 rounded-xl pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:outline-none transition-all"
                  style={{
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = `${cor1}80`
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${cor1}20`
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>
              <button
                onClick={handleStart}
                className="h-10 rounded-xl px-5 sm:px-6 font-bold text-sm text-white tracking-wide transition-all whitespace-nowrap active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${cor1}, ${cor2})`,
                  boxShadow: `0 4px 20px ${cor1}45, inset 0 1px 0 rgba(255,255,255,0.15)`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = `0 6px 28px ${cor1}60, inset 0 1px 0 rgba(255,255,255,0.15)`
                  e.currentTarget.style.filter = "brightness(1.1)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = `0 4px 20px ${cor1}45, inset 0 1px 0 rgba(255,255,255,0.15)`
                  e.currentTarget.style.filter = "none"
                }}
              >
                INICIAR CARREIRA
              </button>
            </div>

            {/* Contador */}
            <div className="text-white/35 text-xs font-mono tabular-nums">
              {teamIndex + 1} / {teams.length}
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
