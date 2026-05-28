"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Star,
  Users,
  Building2,
  Wallet,
  Trophy,
  Globe,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Shield,
  Shirt,
  TrendingUp,
} from "lucide-react"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  formatCurrency,
  formatNumber,
  getLogoUrl,
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
import { teamRating, getPlayersByTeam } from "@/lib/players-data"
import { useGameManager } from "@/lib/use-game-manager"
import { TeamCrest } from "@/components/team-crest"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/lib/i18n"
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

export default function NovoJogoPage() {
  const router = useRouter()
  const { initializeNewGame } = useGameManager()
  const { setTheme, setTeamColors } = useTheme()
  const t = useTranslation()

  const [selectedRegion, setSelectedRegion] = useState<Regiao | "all">("all")
  const [divisao, setDivisao] = useState<Divisao>("serie_a")
  const [search, setSearch] = useState("")
  const [managerName, setManagerName] = useState("")
  const [selected, setSelected] = useState<Team | null>(null)
  const [focusedTeamIndex, setFocusedTeamIndex] = useState(0)
  const [hoveredTeam, setHoveredTeam] = useState<Team | null>(null)
  const teamGridRef = useRef<HTMLDivElement>(null)
  const divisionScrollRef = useRef<HTMLDivElement>(null)

  const filteredDivisions = useMemo(() => {
    if (selectedRegion === "all") return DIVISIONS
    return DIVISIONS.filter(d => d.region === selectedRegion)
  }, [selectedRegion])

  const activeDivision = DIVISIONS.find(d => d.key === divisao) ?? DIVISIONS[0]

  const teams = useMemo(() => {
    const list = activeDivision.teams
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      t =>
        t.nome.toLowerCase().includes(q) ||
        t.curto.toLowerCase().includes(q) ||
        t.estado.toLowerCase().includes(q) ||
        t.cidade?.toLowerCase().includes(q),
    )
  }, [activeDivision, search])

  const totalTeams = DIVISIONS.reduce((s, d) => s + d.teams.length, 0)

  const handleStart = useCallback(() => {
    if (!selected) return
    // Define as cores do time como tema padrao
    setTeamColors({ primary: selected.cor1, secondary: selected.cor2 })
    setTheme("team")
    initializeNewGame(selected.curto, managerName)
    router.push("/")
  }, [selected, managerName, initializeNewGame, router, setTeamColors, setTheme])

  const handleRegionChange = (region: Regiao | "all") => {
    setSelectedRegion(region)
    const firstDivInRegion = region === "all"
      ? DIVISIONS[0]
      : DIVISIONS.find(d => d.region === region)
    if (firstDivInRegion) {
      setDivisao(firstDivInRegion.key)
    }
    setSelected(null)
    setFocusedTeamIndex(0)
  }

  const getGridCols = useCallback(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200
    if (w >= 1536) return 6
    if (w >= 1280) return 5
    if (w >= 1024) return 4
    if (w >= 768) return 3
    if (w >= 640) return 2
    return 2
  }, [])

  useEffect(() => {
    const grid = teamGridRef.current
    if (!grid) return
    const cards = grid.querySelectorAll("[data-team-card]")
    const card = cards[focusedTeamIndex] as HTMLElement | undefined
    if (card) {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [focusedTeamIndex])

  useEffect(() => {
    setFocusedTeamIndex(0)
  }, [divisao, search])

  // Navegacao por gamepad
  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "B":
          router.push("/splash")
          break
        case "A":
          if (teams[focusedTeamIndex]) {
            setSelected(teams[focusedTeamIndex])
          }
          break
        case "START":
          handleStart()
          break
        case "DPAD_LEFT":
          setFocusedTeamIndex(prev => Math.max(0, prev - 1))
          break
        case "DPAD_RIGHT":
          setFocusedTeamIndex(prev => Math.min(teams.length - 1, prev + 1))
          break
        case "DPAD_UP":
          setFocusedTeamIndex(prev => Math.max(0, prev - getGridCols()))
          break
        case "DPAD_DOWN":
          setFocusedTeamIndex(prev => Math.min(teams.length - 1, prev + getGridCols()))
          break
        case "LB": {
          const currentDivIdx = filteredDivisions.findIndex(d => d.key === divisao)
          const prevDiv = filteredDivisions[currentDivIdx - 1]
          if (prevDiv) {
            setDivisao(prevDiv.key)
            setSelected(null)
          }
          break
        }
        case "RB": {
          const currentDivIdx = filteredDivisions.findIndex(d => d.key === divisao)
          const nextDiv = filteredDivisions[currentDivIdx + 1]
          if (nextDiv) {
            setDivisao(nextDiv.key)
            setSelected(null)
          }
          break
        }
      }
    }
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [teams, focusedTeamIndex, divisao, filteredDivisions, router, handleStart, getGridCols])

  const scrollDivisions = (dir: 'left' | 'right') => {
    if (divisionScrollRef.current) {
      const scrollAmount = 200
      divisionScrollRef.current.scrollBy({
        left: dir === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  const previewTeam = hoveredTeam || selected

  return (
    <main className="h-screen bg-[#050505] text-white antialiased flex flex-col overflow-hidden">
      {/* Background com gradiente e particulas */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 100% 100%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
              radial-gradient(ellipse 40% 30% at 0% 80%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)
            `
          }}
        />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Header Premium */}
      <header className="relative z-10 flex-shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 md:px-8 h-16">
          <button
            onClick={() => router.push("/splash")}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline">Voltar</span>
          </button>
          
          <div className="flex items-center gap-3">
            <Image
              src="/brand/ultrafoot-logo.png"
              alt="Logo"
              width={200}
              height={50}
              className="drop-shadow-[0_0_20px_rgba(16,185,129,0.3)] h-10 w-auto object-contain"
              unoptimized
            />
            <div className="hidden sm:block">
              <div className="text-[10px] tracking-[0.2em] text-white/30">CAREER MODE</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-white/30">
            <span className="hidden md:inline">{totalTeams} CLUBES</span>
            <span className="hidden md:inline text-white/10">|</span>
            <span>{DIVISIONS.length} LIGAS</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Sidebar - Team Preview */}
        <aside className="hidden lg:flex flex-col w-[380px] border-r border-white/[0.06] bg-black/20">
          {previewTeam ? (
            <TeamPreviewPanel team={previewTeam} isSelected={selected?.curto === previewTeam.curto} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                <Shield className="w-12 h-12 text-white/20" />
              </div>
              <p className="text-sm text-white/40 max-w-[200px]">
                Selecione um clube para ver os detalhes
              </p>
            </div>
          )}
        </aside>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters Bar */}
          <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-white/[0.06] bg-black/30">
            {/* Region Tabs */}
            <div className="flex items-center gap-2 mb-4">
              <RegionTab 
                active={selectedRegion === "all"} 
                onClick={() => handleRegionChange("all")}
                icon={<Globe className="w-3.5 h-3.5" />}
              >
                Todas
              </RegionTab>
              <RegionTab 
                active={selectedRegion === "brasil"} 
                onClick={() => handleRegionChange("brasil")}
                flag="🇧🇷"
              >
                Brasil
              </RegionTab>
              <RegionTab 
                active={selectedRegion === "europa"} 
                onClick={() => handleRegionChange("europa")}
                flag="🇪🇺"
              >
                Europa
              </RegionTab>
              <RegionTab 
                active={selectedRegion === "americas"} 
                onClick={() => handleRegionChange("americas")}
                flag="🌎"
              >
                Americas
              </RegionTab>
              <RegionTab 
                active={selectedRegion === "asia"} 
                onClick={() => handleRegionChange("asia")}
                flag="🌏"
              >
                Asia
              </RegionTab>
            </div>

            {/* League Selector */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => scrollDivisions('left')}
                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div 
                ref={divisionScrollRef}
                className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-1"
              >
{filteredDivisions.map(d => (
                    <LeagueChip
                      key={d.key}
                      active={d.key === divisao}
                      onClick={() => { setDivisao(d.key); setSelected(null) }}
                      flag={d.flag}
                      count={d.teams.length}
                      leagueKey={d.key}
                    >
                      {d.short}
                    </LeagueChip>
                  ))}
              </div>

              <button 
                onClick={() => scrollDivisions('right')}
                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="hidden sm:flex relative ml-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar clube..."
                  className="w-48 h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                />
              </div>
            </div>
          </div>

          {/* League Header */}
          <div className="flex-shrink-0 px-4 md:px-6 py-3 flex items-center justify-between bg-gradient-to-r from-white/[0.02] to-transparent">
            <div className="flex items-center gap-3">
              {getLeagueLogo(activeDivision.key) ? (
                <Image
                  src={getLeagueLogo(activeDivision.key)!}
                  alt={activeDivision.label}
                  width={40}
                  height={40}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="text-2xl">{activeDivision.flag}</div>
              )}
              <div>
                <h2 className="text-lg font-bold text-white">{activeDivision.label}</h2>
                <p className="text-xs text-white/40">{activeDivision.country} - {activeDivision.teams.length} clubes</p>
              </div>
            </div>
          </div>

          {/* Teams Grid */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
            <div 
              ref={teamGridRef} 
              className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
            >
              {teams.map((team, idx) => (
                <TeamCard
                  key={team.curto + team.divisao}
                  team={team}
                  selected={selected?.curto === team.curto && selected?.divisao === team.divisao}
                  focused={focusedTeamIndex === idx}
                  onClick={() => { setSelected(team); setFocusedTeamIndex(idx) }}
                  onHover={() => setHoveredTeam(team)}
                  onLeave={() => setHoveredTeam(null)}
                />
              ))}
              {teams.length === 0 && (
                <div className="col-span-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
                  <Search className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <p className="text-sm text-white/40">
                    Nenhum clube encontrado para &quot;{search}&quot;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex-shrink-0 border-t border-white/[0.06] bg-black/40 backdrop-blur-xl">
            <div className="px-4 md:px-6 py-4 flex items-center justify-between gap-4">
              {/* Mobile Preview */}
              <div className="lg:hidden flex items-center gap-3 flex-1 min-w-0">
                {selected ? (
                  <>
                    <TeamCrest team={selected} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white truncate">{selected.nome}</div>
                      <div className="text-xs text-white/40">{selected.cidade}, {selected.pais || selected.estado}</div>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-white/40">Selecione um clube</span>
                )}
              </div>

              {/* Manager Name Input */}
              <div className="hidden sm:flex items-center gap-3">
                <label className="text-xs text-white/40">Tecnico:</label>
                <input
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  placeholder="Seu nome"
                  maxLength={32}
                  className="w-40 h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                disabled={!selected}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-6 py-3 font-bold text-sm transition-all",
                  selected
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                )}
              >
                <span>INICIAR CARREIRA</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function RegionTab({ 
  children, 
  active, 
  onClick, 
  icon,
  flag 
}: { 
  children: React.ReactNode
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  flag?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
        active 
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
          : "text-white/50 hover:text-white hover:bg-white/[0.05]"
      )}
    >
      {flag && <span className="text-sm">{flag}</span>}
      {icon}
      {children}
    </button>
  )
}

function LeagueChip({ 
  children, 
  active, 
  onClick, 
  flag,
  count,
  leagueKey,
}: { 
  children: React.ReactNode
  active: boolean
  onClick: () => void
  flag?: string
  count: number
  leagueKey: string
}) {
  const leagueLogo = getLeagueLogo(leagueKey)
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
        active 
          ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)]" 
          : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white"
      )}
    >
      {leagueLogo ? (
        <Image 
          src={leagueLogo} 
          alt="" 
          width={20} 
          height={20} 
          className="object-contain"
          unoptimized
        />
      ) : flag ? (
        <span className="text-sm">{flag}</span>
      ) : null}
      <span>{children}</span>
      <span className={cn(
        "px-1.5 py-0.5 rounded text-[10px]",
        active ? "bg-black/10" : "bg-white/10"
      )}>
        {count}
      </span>
    </button>
  )
}

function TeamCard({
  team,
  selected,
  focused,
  onClick,
  onHover,
  onLeave,
}: {
  team: Team
  selected: boolean
  focused?: boolean
  onClick: () => void
  onHover?: () => void
  onLeave?: () => void
}) {
  const overall = teamRating(team.nome)

  return (
    <button
      data-team-card
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "group relative flex flex-col items-center p-4 rounded-2xl border transition-all duration-200",
        selected
          ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          : focused
            ? "border-cyan-500/50 bg-cyan-500/10"
            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.05]"
      )}
    >
      {/* Team Colors Accent */}
      <div 
        className="absolute inset-x-0 top-0 h-1 rounded-t-2xl opacity-80"
        style={{ 
          background: `linear-gradient(90deg, ${team.cor1} 0%, ${team.cor2} 100%)` 
        }}
      />

      {/* Crest */}
      <div className="relative mb-3">
        <TeamCrest team={team} size="xl" className="drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]" />
        {overall > 0 && (
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-black/80 border border-white/10 flex items-center justify-center">
            <span className="text-xs font-bold text-emerald-400">{overall}</span>
          </div>
        )}
      </div>

      {/* Team Name */}
      <div className="text-center w-full">
        <h3 className="font-bold text-sm text-white truncate">{team.nome}</h3>
        <p className="text-[10px] text-white/40 truncate mt-0.5">{team.cidade}</p>
      </div>

      {/* Prestige Stars */}
      <div className="flex items-center gap-0.5 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star 
            key={i} 
            className={cn(
              "w-2.5 h-2.5",
              i < Math.round(team.prestigio / 20) 
                ? "fill-amber-400 text-amber-400" 
                : "text-white/20"
            )} 
          />
        ))}
      </div>

      {/* Selection indicator */}
      {selected && (
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  )
}

function TeamPreviewPanel({ team, isSelected }: { team: Team; isSelected: boolean }) {
  const overall = teamRating(team.nome)
  const players = getPlayersByTeam(team.nome)
  const divisionInfo = DIVISIONS.find(d => d.key === team.divisao)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with gradient */}
      <div 
        className="relative px-6 pt-8 pb-6"
        style={{
          background: `linear-gradient(180deg, ${team.cor1}40 0%, transparent 100%)`
        }}
      >
        <div className="flex items-start gap-4">
          <TeamCrest team={team} size="2xl" className="drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]" />
          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{divisionInfo?.flag}</span>
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">{divisionInfo?.label}</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight">{team.nome}</h2>
            <p className="text-sm text-white/50 flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {team.cidade}, {team.pais || team.estado}
            </p>
          </div>
        </div>

        {isSelected && (
          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-emerald-500 text-black text-xs font-bold">
            SELECIONADO
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-6 py-4 grid grid-cols-2 gap-3">
        <StatCard 
          icon={<TrendingUp className="w-4 h-4" />} 
          label="Overall" 
          value={overall > 0 ? overall.toString() : "-"}
          accent
        />
        <StatCard 
          icon={<Star className="w-4 h-4" />} 
          label="Prestigio" 
          value={team.prestigio.toString()} 
        />
        <StatCard 
          icon={<Users className="w-4 h-4" />} 
          label="Torcida" 
          value={formatNumber(team.torcida)} 
        />
        <StatCard 
          icon={<Wallet className="w-4 h-4" />} 
          label="Saldo" 
          value={formatCurrency(team.saldo)} 
        />
      </div>

      {/* Stadium */}
      <div className="px-6 py-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">Estadio</span>
          </div>
          <div className="text-sm font-semibold text-white">{team.estadio_nome}</div>
          <div className="text-xs text-white/40 mt-1">
            Capacidade: {team.estadio_cap.toLocaleString("pt-BR")}
          </div>
        </div>
      </div>

      {/* Squad Info */}
      {players.length > 0 && (
        <div className="px-6 py-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
              <Shirt className="w-3.5 h-3.5" />
              <span className="uppercase tracking-wider">Elenco</span>
            </div>
            <div className="text-sm font-semibold text-white">{players.length} jogadores</div>
          </div>
        </div>
      )}

      {/* Sponsor */}
      {team.patrocinador && (
        <div className="px-6 py-3 mt-auto">
          <div className="text-xs text-white/30 text-center">
            Patrocinador: <span className="text-white/50">{team.patrocinador}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ 
  icon, 
  label, 
  value, 
  accent 
}: { 
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className={cn(
      "rounded-xl border p-3",
      accent 
        ? "border-emerald-500/20 bg-emerald-500/5" 
        : "border-white/[0.06] bg-white/[0.02]"
    )}>
      <div className={cn(
        "flex items-center gap-1.5 text-xs mb-1",
        accent ? "text-emerald-400/60" : "text-white/40"
      )}>
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn(
        "text-lg font-bold",
        accent ? "text-emerald-400" : "text-white"
      )}>
        {value}
      </div>
    </div>
  )
}
