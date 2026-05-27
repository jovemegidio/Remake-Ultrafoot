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
  User,
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
  jLeagueTeams,
  saudiFirstDivTeams,
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
  leagueInfo,
} from "@/lib/international-teams"
import { teamRating, getPlayersByTeam } from "@/lib/players-data"
import { useGameManager } from "@/lib/use-game-manager"
import { TeamCrest } from "@/components/team-crest"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/lib/i18n"
import { useGamepadContext } from "@/components/gamepad-provider"

interface DivisaoTab {
  key: Divisao
  label: string
  short: string
  teams: Team[]
  region: Regiao
  country?: string
  code?: string
}

const DIVISIONS: DivisaoTab[] = [
  // Brasil
  { key: "serie_a", label: "Brasileirao Serie A", short: "Serie A", teams: serieATeams, region: "brasil", country: "Brasil", code: "BR" },
  { key: "serie_b", label: "Brasileirao Serie B", short: "Serie B", teams: serieBTeams, region: "brasil", country: "Brasil", code: "BR" },
  { key: "serie_c", label: "Brasileirao Serie C", short: "Serie C", teams: serieCTeams, region: "brasil", country: "Brasil", code: "BR" },
  { key: "serie_d", label: "Brasileirao Serie D", short: "Serie D", teams: serieDTeams, region: "brasil", country: "Brasil", code: "BR" },
  // Europa - Top 5
  { key: "premier_league", label: "Premier League", short: "Premier", teams: premierLeagueTeams, region: "europa", country: "Inglaterra", code: "ENG" },
  { key: "la_liga", label: "La Liga", short: "La Liga", teams: laLigaTeams, region: "europa", country: "Espanha", code: "ESP" },
  { key: "serie_a_ita", label: "Serie A Italia", short: "Serie A ITA", teams: serieAItaTeams, region: "europa", country: "Italia", code: "ITA" },
  { key: "bundesliga", label: "Bundesliga", short: "Bundesliga", teams: bundesligaTeams, region: "europa", country: "Alemanha", code: "GER" },
  { key: "ligue_1", label: "Ligue 1", short: "Ligue 1", teams: ligue1Teams, region: "europa", country: "Franca", code: "FRA" },
  // Europa - Demais
  { key: "primeira_liga", label: "Primeira Liga", short: "Portugal", teams: primeiraLigaTeams, region: "europa", country: "Portugal", code: "POR" },
  { key: "eredivisie", label: "Eredivisie", short: "Eredivisie", teams: eredivisieTeams, region: "europa", country: "Holanda", code: "NED" },
  { key: "scottish_prem", label: "Scottish Premiership", short: "Escocia", teams: scottishPremTeams, region: "europa", country: "Escocia", code: "SCO" },
  { key: "super_lig", label: "Super Lig", short: "Turquia", teams: superLigTeams, region: "europa", country: "Turquia", code: "TUR" },
  { key: "pro_league_bel", label: "Belgian Pro League", short: "Belgica", teams: proLeagueBelTeams, region: "europa", country: "Belgica", code: "BEL" },
  { key: "russian_prem", label: "Russian Premier League", short: "Russia", teams: russianPremTeams, region: "europa", country: "Russia", code: "RUS" },
  // Americas
  { key: "liga_argentina", label: "Liga Argentina", short: "Argentina", teams: ligaArgentinaTeams, region: "americas", country: "Argentina", code: "ARG" },
  { key: "mls", label: "MLS", short: "MLS", teams: mlsTeams, region: "americas", country: "EUA", code: "USA" },
  { key: "liga_mx", label: "Liga MX", short: "Liga MX", teams: ligaMXTeams, region: "americas", country: "Mexico", code: "MEX" },
  { key: "primera_a_col", label: "Primera A Colombia", short: "Colombia", teams: primeiraAColTeams, region: "americas", country: "Colombia", code: "COL" },
  { key: "primera_div_chi", label: "Primera Division Chile", short: "Chile", teams: primeraDivChileTeams, region: "americas", country: "Chile", code: "CHI" },
  { key: "primera_div_ury", label: "Primera Division Uruguay", short: "Uruguai", teams: primeraDivUryTeams, region: "americas", country: "Uruguai", code: "URU" },
  // Asia
  { key: "saudi_pro", label: "Saudi Pro League", short: "Saudi Pro", teams: saudiProTeams, region: "asia", country: "Arabia Saudita", code: "KSA" },
  { key: "saudi_first_div", label: "Saudi First Division", short: "Saudi 1st", teams: saudiFirstDivTeams, region: "asia", country: "Arabia Saudita", code: "KSA" },
  { key: "j_league", label: "J-League", short: "Japao", teams: jLeagueTeams, region: "asia", country: "Japao", code: "JPN" },
  { key: "k_league_1", label: "K-League 1", short: "Coreia", teams: kLeague1Teams, region: "asia", country: "Coreia do Sul", code: "KOR" },
  { key: "chinese_super", label: "Chinese Super League", short: "China", teams: chineseSuperTeams, region: "asia", country: "China", code: "CHN" },
]

const REGIONS: { key: Regiao | "all"; label: string; code: string | null }[] = [
  { key: "all", label: "Todas", code: null },
  { key: "brasil", label: "Brasil", code: "BR" },
  { key: "europa", label: "Europa", code: "EU" },
  { key: "americas", label: "Americas", code: "AM" },
  { key: "asia", label: "Asia", code: "AS" },
]

export default function NovoJogoPage() {
  const router = useRouter()
  const { initializeNewGame } = useGameManager()
  const t = useTranslation()
  const { isGamepadConnected } = useGamepadContext()

  const regions = [
    { key: "all" as const, label: t.newGame.filterAll, code: null as string | null },
    { key: "brasil" as const, label: t.newGame.filterBrazil, code: "BR" as string | null },
    { key: "europa" as const, label: t.newGame.filterEurope, code: "EU" as string | null },
    { key: "americas" as const, label: t.newGame.filterAmericas, code: "AM" as string | null },
    { key: "asia" as const, label: t.newGame.filterAsia, code: "AS" as string | null },
  ]

  const [selectedRegion, setSelectedRegion] = useState<Regiao | "all">("all")
  const [divisao, setDivisao] = useState<Divisao>("serie_a")
  const [search, setSearch] = useState("")
  const [managerName, setManagerName] = useState("")
  const [selected, setSelected] = useState<Team | null>(null)
  const [focusedTeamIndex, setFocusedTeamIndex] = useState(0)
  const teamGridRef = useRef<HTMLDivElement>(null)
  const [showManagerModal, setShowManagerModal] = useState(false)
  const [pendingTeam, setPendingTeam] = useState<Team | null>(null)

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

  const handleStart = useCallback((nameOverride?: string) => {
    if (!selected) return
    initializeNewGame(selected.curto, nameOverride ?? managerName)
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("ultrafoot:session-active", "true")
    }
    router.push("/")
  }, [selected, managerName, initializeNewGame, router])

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

  // Calcula colunas do grid baseado na largura da janela
  const getGridCols = useCallback(() => {
    const w = window.innerWidth
    if (w >= 1536) return 5
    if (w >= 1280) return 4
    if (w >= 1024) return 3
    if (w >= 640) return 2
    return 1
  }, [])

  // Scroll do item focado para dentro da visao
  useEffect(() => {
    const grid = teamGridRef.current
    if (!grid) return
    const cards = grid.querySelectorAll("[data-team-card]")
    const card = cards[focusedTeamIndex] as HTMLElement | undefined
    if (card) {
      card.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [focusedTeamIndex])

  // Reseta foco quando divisao ou busca mudar
  useEffect(() => {
    setFocusedTeamIndex(0)
  }, [divisao, search])

  // ESC volta para splash
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showManagerModal) {
          setShowManagerModal(false)
          setPendingTeam(null)
          setSelected(null)
        } else {
          router.push("/splash")
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router, showManagerModal])

  // Navegacao por gamepad
  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      if (showManagerModal) return
      const { button } = (e as CustomEvent<{ button: string }>).detail

      switch (button) {
        case "B":
          router.push("/splash")
          break
        case "A":
          if (teams[focusedTeamIndex]) {
            const team = teams[focusedTeamIndex]
            setSelected(team)
            setPendingTeam(team)
            setShowManagerModal(true)
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
          // Liga anterior
          const currentDivIdx = filteredDivisions.findIndex(d => d.key === divisao)
          const prevDiv = filteredDivisions[currentDivIdx - 1]
          if (prevDiv) {
            setDivisao(prevDiv.key)
            setSelected(null)
          }
          break
        }
        case "RB": {
          // Proxima liga
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
  }, [teams, focusedTeamIndex, divisao, filteredDivisions, router, handleStart, getGridCols, showManagerModal])

  return (
    <main data-gamepad-exclude className="h-screen bg-[#080808] text-white antialiased flex flex-col overflow-hidden">
      <BackgroundFx />

      {/* Header */}
      <header className="relative z-10 flex-shrink-0 flex items-center justify-between border-b border-white/5 px-6 h-14">
        <button
          onClick={() => router.push("/splash")}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
          <Image
            src={getLogoUrl()}
            alt="Ultrafoot"
            width={26}
            height={26}
            unoptimized
          />
          <span
            className="text-[11px] font-black tracking-[0.35em] text-white/55"
            style={{ fontFamily: "var(--font-oswald), var(--font-geist), sans-serif" }}
          >
            ULTRAFOOT
          </span>
        </div>
        <div className="text-[10px] tracking-[0.3em] text-white/30">
          {t.newGame.title}
        </div>
      </header>

      <div className="relative z-10 flex-1 flex flex-col mx-auto w-full max-w-[1600px] px-6 py-4 overflow-hidden">
        <div className="flex-shrink-0 mb-4">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/35">
            {t.newGame.step}
          </p>
          <h1
            className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight"
            style={{
              fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
            }}
          >
            {t.newGame.chooseTeam}
          </h1>
          <p className="mt-1 max-w-xl text-xs text-white/50">
            {t.newGame.teamsAvailable(totalTeams, DIVISIONS.length)}
          </p>
        </div>

        <div className="flex-1 grid gap-4 lg:grid-cols-[1fr_360px] overflow-hidden">
          {/* Team browser */}
          <section className="flex flex-col overflow-hidden">
            {/* Unified filter container */}
            <div className="flex-shrink-0 mb-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              {/* Region selector */}
              <div className="flex items-center gap-1 mb-2.5">
                {regions.map(r => (
                  <button
                    key={r.key}
                    onClick={() => handleRegionChange(r.key)}
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 " +
                      (r.key === selectedRegion
                        ? "bg-white text-black"
                        : "text-white/55 hover:text-white hover:bg-white/[0.06]")
                    }
                  >
                    {r.code
                      ? <CountryCode code={r.code} active={r.key === selectedRegion} />
                      : <Globe className="h-3 w-3" />
                    }
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.07] mb-2.5" />

              {/* Division tabs — grouped by region when "Todas" selected */}
              {selectedRegion === "all" ? (
                <div className="space-y-2">
                  {regions.filter(r => r.key !== "all").map(region => {
                    const regionDivs = DIVISIONS.filter(d => d.region === region.key)
                    return (
                      <div key={region.key} className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-white/25 w-7 shrink-0">
                          {region.code}
                        </span>
                        {regionDivs.map(d => (
                          <button
                            key={d.key}
                            onClick={() => { setDivisao(d.key); setSelected(null) }}
                            className={
                              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition whitespace-nowrap flex items-center gap-1.5 " +
                              (d.key === divisao
                                ? "bg-white text-black"
                                : "text-white/55 hover:text-white hover:bg-white/[0.07]")
                            }
                          >
                            {d.short}
                            <span className="text-[10px] opacity-55">{d.teams.length}</span>
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {filteredDivisions.map(d => (
                    <button
                      key={d.key}
                      onClick={() => { setDivisao(d.key); setSelected(null) }}
                      className={
                        "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition whitespace-nowrap flex items-center gap-1.5 " +
                        (d.key === divisao
                          ? "bg-white text-black"
                          : "text-white/55 hover:text-white hover:bg-white/[0.06]")
                      }
                    >
                      {d.code && <CountryCode code={d.code} active={d.key === divisao} />}
                      {d.short}
                      <span className="text-[10px] opacity-55">{d.teams.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search bar */}
            <div className="flex-shrink-0 mb-2 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t.newGame.searchIn(activeDivision.label)}
                className="border-white/10 bg-white/[0.03] pl-9 text-sm text-white placeholder:text-white/30 h-9"
              />
            </div>

            {/* League info bar */}
            <div className="flex-shrink-0 mb-2 flex items-center gap-4 px-1">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Globe className="h-3.5 w-3.5" />
                <span>{activeDivision.country}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Trophy className="h-3.5 w-3.5" />
                <span>{activeDivision.label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Users className="h-3.5 w-3.5" />
                <span>{activeDivision.teams.length} times</span>
              </div>
            </div>

            {/* Team grid - scrollable */}
            <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
              <div ref={teamGridRef} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {teams.map((team, idx) => (
                  <TeamCard
                    key={team.curto + team.divisao}
                    team={team}
                    selected={selected?.curto === team.curto && selected?.divisao === team.divisao}
                    focused={focusedTeamIndex === idx}
                    onClick={() => { setSelected(team); setFocusedTeamIndex(idx) }}
                  />
                ))}
                {teams.length === 0 && (
                  <div className="col-span-full rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-white/40">
                    {t.newGame.noResults(search)}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Selection panel */}
          <aside className="flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
              {selected ? (
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <SelectedPanel team={selected} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                  <div
                    aria-hidden
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5"
                  >
                    <Trophy className="h-6 w-6 text-white/30" />
                  </div>
                  <p className="text-sm text-white/50">
                    {t.newGame.selectTeamHint}
                  </p>
                </div>
              )}

              {/* Manager + start */}
              <div className="flex-shrink-0 border-t border-white/5 p-4">
                <label className="mb-1 block text-[10px] uppercase tracking-[0.3em] text-white/40">
                  {t.newGame.managerName}
                </label>
                <Input
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  placeholder={t.newGame.managerPlaceholder}
                  maxLength={32}
                  className="mb-3 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30 h-9"
                />
                <button
                  onClick={() => handleStart()}
                  disabled={!selected}
                  className={
                    "group flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
                    (selected
                      ? "bg-white text-black hover:bg-white/90 shadow-[0_8px_30px_rgba(255,255,255,0.18)]"
                      : "cursor-not-allowed bg-white/5 text-white/30")
                  }
                >
                  <span>{t.newGame.startCareer}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <p className="mt-2 text-center text-[10px] text-white/30">
                  {t.newGame.savedLocally}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
      {showManagerModal && pendingTeam && (
        <ManagerNameModal
          team={pendingTeam}
          onConfirm={(name) => {
            setShowManagerModal(false)
            setManagerName(name)
            initializeNewGame(pendingTeam.curto, name)
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem("ultrafoot:session-active", "true")
            }
            router.push("/")
          }}
          onCancel={() => {
            setShowManagerModal(false)
            setPendingTeam(null)
            setSelected(null)
          }}
        />
      )}
    </main>
  )
}

function ManagerNameModal({
  team,
  onConfirm,
  onCancel,
}: {
  team: Team
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleBtn = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      if (button === "B") {
        onCancel()
      }
    }
    window.addEventListener("gamepad:button", handleBtn)
    return () => window.removeEventListener("gamepad:button", handleBtn)
  }, [onCancel])

  useEffect(() => {
    const handleAction = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: string }>).detail
      if (action === "START") {
        onConfirm(name.trim())
      }
    }
    window.addEventListener("gamepad:action", handleAction)
    return () => window.removeEventListener("gamepad:action", handleAction)
  }, [name, onConfirm])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl"
        style={{
          backgroundImage: `radial-gradient(ellipse at top, ${team.cor1}25 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <TeamCrest team={team} size="lg" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Técnico de
            </p>
            <h2
              className="text-lg font-extrabold text-white leading-tight"
              style={{ fontFamily: "var(--font-oswald), var(--font-geist), sans-serif" }}
            >
              {team.nome}
            </h2>
          </div>
        </div>

        <label className="mb-1 block text-[10px] uppercase tracking-[0.3em] text-white/40">
          Nome do Técnico
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") onConfirm(name.trim())
              if (e.key === "Escape") onCancel()
            }}
            placeholder="Digite seu nome..."
            maxLength={32}
            className="pl-9 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 h-10"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(name.trim())}
            className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
          >
            Iniciar
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] text-white/25">
          Enter ou <span className="text-white/40">START</span> para confirmar · B para cancelar
        </p>
      </div>
    </div>
  )
}

function TeamCard({
  team,
  selected,
  focused,
  onClick,
}: {
  team: Team
  selected: boolean
  focused?: boolean
  onClick: () => void
}) {
  const overall = teamRating(team.nome)

  return (
    <button
      data-team-card
      onClick={onClick}
      className={
        "group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition " +
        (selected
          ? "border-white/40 bg-white/[0.06]"
          : focused
            ? "border-[#1db954]/60 bg-[#1db954]/5 shadow-[0_0_0_2px_rgba(29,185,84,0.25)]"
            : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]")
      }
    >
      {/* Color accent bar */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] transition-all"
        style={{ background: team.cor1 }}
      />
      <TeamCrest team={team} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {team.nome}
          </span>
          {overall > 0 && (
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/80">
              {overall}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/40">
          <span>{team.pais || team.estado}</span>
          <span className="text-white/15">·</span>
          <span className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5" />
            {team.prestigio}
          </span>
        </div>
      </div>
    </button>
  )
}

function SelectedPanel({ team }: { team: Team }) {
  const overall = teamRating(team.nome)
  const players = getPlayersByTeam(team.nome)
  const divisionInfo = DIVISIONS.find(d => d.key === team.divisao)
  const t = useTranslation()

  return (
    <div
      className="relative px-5 pb-4 pt-5"
      style={{
        backgroundImage: `radial-gradient(ellipse at top, ${team.cor1}30 0%, transparent 65%)`,
      }}
    >
      <div className="flex items-start gap-3">
        <TeamCrest team={team} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
            {divisionInfo?.code && <CountryCode code={divisionInfo.code} active={false} />}
            <span>{divisionInfo?.label || team.divisao.replace("_", " ").toUpperCase()}</span>
          </div>
          <h2
            className="mt-0.5 text-xl font-extrabold leading-tight text-white"
            style={{
              fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
            }}
          >
            {team.nome}
          </h2>
          <p className="mt-0.5 text-xs text-white/45 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {team.cidade ? `${team.cidade}, ${team.pais || team.estado}` : team.pais || team.estado}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat icon={Star} label={t.newGame.prestige} value={team.prestigio.toString()} />
        <Stat
          icon={Trophy}
          label={t.newGame.overall}
          value={overall > 0 ? overall.toString() : "-"}
        />
        <Stat icon={Users} label={t.newGame.fans} value={formatNumber(team.torcida)} />
        <Stat icon={Wallet} label={t.common.balance} value={formatCurrency(team.saldo)} />
      </div>

      <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
          <Building2 className="h-3 w-3" />
          {t.newGame.stadium}
        </div>
        <div className="mt-1 text-sm font-medium text-white">
          {team.estadio_nome || "-"}
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">
          {t.newGame.capacity}: {team.estadio_cap.toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Additional info */}
      <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40">
          <Globe className="h-3 w-3" />
          {t.newGame.information}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-white/40">{t.newGame.country}: </span>
            <span className="text-white/70">{team.pais || "Brasil"}</span>
          </div>
          <div>
            <span className="text-white/40">{t.newGame.league}: </span>
            <span className="text-white/70">{divisionInfo?.short || team.divisao}</span>
          </div>
          {team.patrocinador && (
            <div className="col-span-2">
              <span className="text-white/40">{t.newGame.sponsor}: </span>
              <span className="text-white/70">{team.patrocinador}</span>
            </div>
          )}
        </div>
      </div>

      {players.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
          <span>{t.newGame.squad(players.length)}</span>
        </div>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-white/40">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className="mt-0.5 text-base font-semibold text-white"
        style={{
          fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function CountryCode({ code, active }: { code: string; active: boolean }) {
  return (
    <span
      className={
        "inline-flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-[8px] font-black tracking-widest uppercase leading-none border " +
        (active
          ? "border-black/20 bg-black/10 text-black"
          : "border-white/15 bg-white/5 text-white/50")
      }
    >
      {code}
    </span>
  )
}

function BackgroundFx() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 30% 10%, oklch(0.32 0.10 195 / 0.18) 0%, transparent 55%)," +
            "radial-gradient(ellipse at 80% 90%, oklch(0.30 0.18 140 / 0.12) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </>
  )
}
