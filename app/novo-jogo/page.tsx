"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { Star, StarHalf, ChevronLeft, ChevronRight, User, Play, Check, Trophy, Award, Globe, Building2, CornerDownLeft, ArrowLeft, Shuffle, Repeat } from "lucide-react"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  getTeamUniforms,
  getCamisaUrl,
  type Divisao,
  type Team,
  type Regiao,
} from "@/lib/teams-data"
import { Jersey } from "@/components/jersey"
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
import { useGameManager } from "@/lib/use-game-manager"
import { TeamCrest } from "@/components/team-crest"
import { useTheme } from "@/components/theme-provider"
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

  const [countryIndex, setCountryIndex] = useState(0)
  const [leagueIndex, setLeagueIndex] = useState(0)
  const [teamIndex, setTeamIndex] = useState(0)
  const [uniformIndex, setUniformIndex] = useState(0)
  const [kitError, setKitError] = useState(false)
  const [genderTab, setGenderTab] = useState<"masculino" | "feminino">("masculino")
  const [managerName, setManagerName] = useState("")
  const [nameError, setNameError] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const activeCountry = COUNTRIES[countryIndex]
  const activeLeague = activeCountry.leagues[leagueIndex]
  const teams = activeLeague.teams
  const selectedTeam = teams[teamIndex]

  // Dados de perfil do clube, derivados de forma deterministica (estaveis por time)
  const profile = useMemo(() => {
    const t = selectedTeam
    const name = t?.nome || ""
    const prest = t?.prestigio || 50
    // hash 0..1 estavel
    const h = (seed: number) => {
      let x = seed
      for (let i = 0; i < name.length; i++) x = ((x << 5) - x + name.charCodeAt(i)) | 0
      return Math.abs(x % 1000) / 1000
    }
    const tierFactor = prest / 100
    const foundation = 1888 + Math.floor(h(7) * 47) // 1888..1935
    const ligas = Math.max(0, Math.round(tierFactor * 12 * (0.45 + h(8) * 0.7)))
    const copas = Math.max(0, Math.round(tierFactor * 9 * (0.35 + h(9) * 0.8)))
    const continental = Math.max(0, Math.round(Math.pow(tierFactor, 1.6) * 5 * h(10)))
    const clubValue = (t?.saldo || 0) * (3 + tierFactor * 5) + (t?.estadio_cap || 0) * 45000
    const transferBudget = t?.saldo || 0
    // niveis 0..100
    const fanAdmiration = Math.round(Math.min(100, prest * 0.7 + h(11) * 45))
    const youthFacilities = Math.round(Math.min(100, 25 + h(12) * 70 + tierFactor * 15))
    const financialStability = Math.round(Math.min(100, 30 + tierFactor * 45 + h(13) * 30))
    // expectativa da diretoria por faixa de prestigio
    const board =
      prest >= 88 ? "VENÇA TUDO, EM CASA E NO EXTERIOR"
      : prest >= 76 ? "CONQUISTE TÍTULOS NACIONAIS"
      : prest >= 62 ? "BRIGUE PELO TÍTULO DA LIGA"
      : prest >= 48 ? "CLASSIFIQUE PARA TORNEIOS CONTINENTAIS"
      : prest >= 32 ? "TERMINE NA PRIMEIRA METADE DA TABELA"
      : "EVITE O REBAIXAMENTO"
    return { foundation, ligas, copas, continental, clubValue, transferBudget, fanAdmiration, youthFacilities, financialStability, board }
  }, [selectedTeam])

  // Mapeia score 0..100 para rotulo + gradiente (heatmap estilo EA FC)
  const levelInfo = (score: number) => {
    if (score >= 80) return { label: "MUITO ALTA", grad: "from-[#e11d48] to-[#7f1d1d]" }
    if (score >= 62) return { label: "ALTA", grad: "from-[#ea580c] to-[#7c2d12]" }
    if (score >= 44) return { label: "MÉDIA", grad: "from-[#00c8a0] to-[#0a4a44]" }
    if (score >= 26) return { label: "BAIXA", grad: "from-[#2563eb] to-[#1e3a8a]" }
    return { label: "MUITO BAIXA", grad: "from-[#475569] to-[#1e293b]" }
  }

  const uniforms = useMemo(() => (selectedTeam ? getTeamUniforms(selectedTeam) : null), [selectedTeam])
  const uniformVariants = ["home", "away", "third"] as const
  const activeVariant = uniformVariants[uniformIndex]
  const activeUniform = uniforms ? uniforms[activeVariant] : null
  const cycleUniform = useCallback(() => setUniformIndex(prev => (prev + 1) % 3), [])

  const formatCompact = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 2 }).format(v)

  const handleStart = useCallback(() => {
    if (!selectedTeam) return
    if (managerName.trim().length === 0) {
      setNameError(true)
      // foca o input para o usuario digitar o nome
      nameInputRef.current?.focus()
      return
    }
    setTeamColors({ primary: selectedTeam.cor1, secondary: selectedTeam.cor2 })
    setTheme("team")
    initializeNewGame(selectedTeam.curto, managerName)
    window.sessionStorage.setItem("ultrafoot:session-active", "true")
    hardNavigate("/")
  }, [selectedTeam, managerName, initializeNewGame, setTeamColors, setTheme])

  const isNameValid = managerName.trim().length > 0

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
  // Avaliacao em estrelas com suporte a meia-estrela (passos de 0.5)
  const ratingHalf = Math.max(0, Math.min(5, Math.round(((selectedTeam?.prestigio || 50) / 20) * 2) / 2))
  const cor1 = selectedTeam?.cor1 || "#10b981"
  const cor2 = selectedTeam?.cor2 || "#059669"
  const hasMultipleLeagues = activeCountry.leagues.length > 1

  // Reseta o uniforme exibido ao trocar de time
  useEffect(() => { setUniformIndex(0) }, [teamIndex, leagueIndex, countryIndex])
  // Tenta novamente a imagem real ao trocar de time ou de uniforme
  useEffect(() => { setKitError(false) }, [teamIndex, leagueIndex, countryIndex, uniformIndex])

  const cardBase = "rounded-2xl bg-[#0c1118]/85 border border-white/[0.07] backdrop-blur-sm"
  const fan = levelInfo(profile.fanAdmiration)
  const youth = levelInfo(profile.youthFacilities)
  const fin = levelInfo(profile.financialStability)

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image src={STADIUM_BG} alt="Stadium Background" fill className="object-cover" priority unoptimized />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/80" />
      </div>

      <div className="relative z-10 h-full flex flex-col">

        {/* ── Conteudo principal: 4 zonas (estilo EA FC) ── */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 overflow-y-auto py-6">
          <div className="flex flex-col lg:flex-row items-stretch justify-center gap-3 lg:gap-4 w-full max-w-[1480px]">

            {/* ── Zona 1: Info do clube ── */}
            <div className="flex flex-col w-full lg:w-[300px] shrink-0">
              {/* Abas masculino / feminino */}
              <div className="flex items-center gap-4 mb-5">
                <button
                  onClick={() => setGenderTab("masculino")}
                  className="flex items-center gap-2 text-sm font-semibold transition-colors"
                >
                  <span className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors",
                    genderTab === "masculino" ? "border-[#00ffc8] bg-[#00ffc8]" : "border-white/30"
                  )}>
                    {genderTab === "masculino" && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                  </span>
                  <span className={cn(genderTab === "masculino" ? "text-white" : "text-white/50")}>Times masculinos</span>
                </button>
                <button
                  onClick={() => setGenderTab("masculino")}
                  className="flex items-center gap-2 text-sm font-semibold text-white/35"
                  aria-label="Times femininos (indisponivel)"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white/20" />
                  <span>Times femininos</span>
                </button>
              </div>

              {/* Pais (clicavel) */}
              <button
                onClick={nextCountry}
                aria-label={`Pais: ${activeCountry.name}. Trocar pais`}
                className="group flex items-center gap-2.5 mb-2 w-fit"
              >
                <span className="text-base font-bold uppercase tracking-wide text-white/80 group-hover:text-white transition-colors">{activeCountry.name}</span>
              </button>

              {/* Nome do time */}
              <h1 className="text-3xl sm:text-[2rem] font-black uppercase tracking-tight text-white leading-tight text-balance mb-5">
                {selectedTeam?.nome}
              </h1>

              {/* Escudo com setas */}
              <div className="relative flex items-center justify-center my-2">
                <button
                  onClick={prevTeam}
                  aria-label="Time anterior"
                  className="absolute left-0 w-10 h-10 flex items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronLeft className="w-7 h-7" />
                </button>
                <div
                  className="w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center rounded-full"
                  style={{ background: `radial-gradient(circle, ${cor1}26 0%, transparent 68%)` }}
                >
                  <TeamCrest team={selectedTeam} size="2xl" className="w-36 h-36 sm:w-40 sm:h-40" />
                </div>
                <button
                  onClick={nextTeam}
                  aria-label="Proximo time"
                  className="absolute right-0 w-10 h-10 flex items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronRight className="w-7 h-7" />
                </button>
              </div>

              {/* Estrelas */}
              <div className="flex items-center justify-center gap-1 my-4">
                {Array.from({ length: 5 }).map((_, i) => {
                  const fill = ratingHalf - i
                  if (fill >= 1) {
                    return <Star key={i} className="w-6 h-6 fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                  }
                  if (fill >= 0.5) {
                    return (
                      <span key={i} className="relative inline-block w-6 h-6">
                        <Star className="absolute inset-0 w-full h-full text-white/15" />
                        <StarHalf className="absolute inset-0 w-full h-full fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                      </span>
                    )
                  }
                  return <Star key={i} className="w-6 h-6 text-white/15" />
                })}
              </div>

              {/* Liga (clicavel se houver multiplas) */}
              <button
                onClick={hasMultipleLeagues ? nextLeague : undefined}
                aria-label={hasMultipleLeagues ? `Liga: ${activeLeague.label}. Trocar liga` : activeLeague.label}
                className={cn("flex flex-col items-center gap-2 mt-auto pt-4", hasMultipleLeagues && "cursor-pointer")}
              >
                {leagueLogo && (
                  <Image
                    src={leagueLogo}
                    alt={activeLeague.label}
                    width={150}
                    height={36}
                    className="object-contain h-7 w-auto max-w-[160px]"
                    style={{ mixBlendMode: "screen" }}
                    unoptimized
                  />
                )}
                <span className="text-base font-black uppercase tracking-[0.1em] text-white">{activeLeague.short}</span>
                {hasMultipleLeagues && (
                  <span className="text-white/35 text-[10px]">{leagueIndex + 1} / {activeCountry.leagues.length} ligas</span>
                )}
              </button>
            </div>

            {/* ── Zona 2: Uniforme + Estadio ── */}
            <div className="flex flex-col gap-3 w-full lg:w-[220px] shrink-0">
              {/* Card Uniforme */}
              <button onClick={cycleUniform} className={cn(cardBase, "flex-1 flex flex-col items-center px-5 py-4 transition-colors hover:border-[#00ffc8]/30")} aria-label="Trocar uniforme">
                <span className="text-xs text-white/50 tracking-wide">Uniforme</span>
                <span className="text-base font-black uppercase tracking-wide text-white mb-2">Uniforme {uniformIndex + 1}</span>
                <div className="flex-1 flex items-center justify-center w-full px-6">
                  {selectedTeam && !kitError ? (
                    <Image
                      key={`${selectedTeam.file_key}-${activeVariant}`}
                      src={getCamisaUrl(selectedTeam.file_key, activeVariant)}
                      alt={`Uniforme ${uniformIndex + 1} do ${selectedTeam.nome}`}
                      width={150}
                      height={188}
                      className="max-w-[150px] w-full h-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                      onError={() => setKitError(true)}
                      unoptimized
                    />
                  ) : activeUniform ? (
                    <Jersey
                      variant={activeVariant}
                      primary={activeUniform.primary}
                      secondary={activeUniform.secondary}
                      pattern={activeUniform.pattern}
                      className="max-w-[150px]"
                    />
                  ) : null}
                </div>
                {/* Indicador de carrossel */}
                <div className="flex items-center gap-2 mt-3">
                  <ChevronLeft className="w-3.5 h-3.5 text-white/30" />
                  {[0, 1, 2].map(i => (
                    <span key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === uniformIndex ? "bg-[#00ffc8]" : "bg-white/20")} />
                  ))}
                  <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                </div>
              </button>

              {/* Card Estadio */}
              <div className={cn(cardBase, "flex flex-col items-center px-5 py-4 gap-2")}>
                <span className="text-xs text-white/50 tracking-wide">Nome do estádio</span>
                <span className="text-sm font-black uppercase tracking-wide text-white text-center text-balance leading-tight">{selectedTeam?.estadio_nome}</span>
                <Building2 className="w-9 h-9 text-white/70 mt-1" strokeWidth={1.5} />
                <span className="text-[11px] text-white/40 tabular-nums">{(selectedTeam?.estadio_cap || 0).toLocaleString("pt-BR")} lugares</span>
              </div>
            </div>

            {/* ── Zona 3: Estatisticas + Diretoria ── */}
            <div className="flex flex-col gap-3 w-full lg:flex-1 lg:max-w-[440px]">
              <div className={cn(cardBase, "flex-1 px-6 py-5 flex flex-col")}>
                {/* Fundacao */}
                <div className="text-center">
                  <span className="text-xs text-white/50 tracking-wide">Fundação</span>
                  <div className="text-4xl font-black text-white tabular-nums leading-tight">{profile.foundation}</div>
                  <div className="mx-auto mt-1 h-px w-20 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                </div>

                {/* Titulos */}
                <div className="grid grid-cols-3 gap-2 mt-6">
                  {[
                    { icon: Award, label: "Ligas nacionais", value: profile.ligas },
                    { icon: Trophy, label: "Copas nacionais", value: profile.copas },
                    { icon: Globe, label: "Continental", value: profile.continental },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex flex-col items-center text-center">
                      <Icon className="w-7 h-7 text-white/80" strokeWidth={1.5} />
                      <span className="text-[10px] text-white/45 mt-1.5 leading-tight">{label}</span>
                      <span className="text-2xl font-black text-white tabular-nums mt-1">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-white/[0.08] my-5" />

                {/* Valores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <span className="text-[11px] text-white/45">Valor do clube</span>
                    <div className="text-lg font-black gradient-text-primary tabular-nums">{formatCompact(profile.clubValue)}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] text-white/45">Verba de transf.</span>
                    <div className="text-lg font-black text-white tabular-nums">{formatCompact(profile.transferBudget)}</div>
                  </div>
                </div>
              </div>

              {/* Card Diretoria */}
              <div className={cn(cardBase, "px-6 py-4 text-center")}>
                <span className="text-xs text-white/50 tracking-wide">Expectativa da Diretoria</span>
                <p className="text-sm font-black uppercase tracking-wide text-white mt-1 text-balance leading-snug">{profile.board}</p>
              </div>
            </div>

            {/* ── Zona 4: Cards de nivel (heatmap) ── */}
            <div className="flex flex-col gap-3 w-full lg:w-[220px] shrink-0">
              {[
                { title: "Admiração da Torcida", info: fan },
                { title: "Instalações da Base", info: youth },
                { title: "Estabilidade financeira", info: fin },
              ].map(({ title, info }) => (
                <div key={title} className={cn("flex-1 rounded-2xl border border-white/[0.08] p-5 flex flex-col bg-gradient-to-br overflow-hidden relative", info.grad)}>
                  <div className="absolute inset-0 bg-black/20" />
                  <span className="relative text-sm font-semibold text-white/90 leading-tight text-balance">{title}</span>
                  <span className="relative text-xl font-black uppercase tracking-wide text-white mt-auto drop-shadow">{info.label}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Barra inferior (estilo EA FC) ── */}
        <footer className="relative shrink-0 border-t border-white/[0.08] bg-black/75 backdrop-blur-md px-4 sm:px-8 py-3">
          <div className="flex items-center justify-between gap-4 max-w-[1480px] mx-auto flex-wrap">

            {/* Dicas de controle */}
            <div className="flex items-center gap-3 sm:gap-5 text-xs text-white/55">
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/10 border border-white/15"><CornerDownLeft className="w-3.5 h-3.5" /></kbd>
                Avançar
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/10 border border-white/15"><ArrowLeft className="w-3.5 h-3.5" /></kbd>
                Voltar
              </span>
              <button onClick={selectRandomTeam} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/10 border border-white/15"><Shuffle className="w-3.5 h-3.5" /></kbd>
                Aleatório
              </button>
              {hasMultipleLeagues && (
                <button onClick={nextLeague} className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors">
                  <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/10 border border-white/15"><Repeat className="w-3.5 h-3.5" /></kbd>
                  Trocar liga
                </button>
              )}
              <span className="text-white/30 font-mono tabular-nums">{teamIndex + 1} / {teams.length}</span>
            </div>

            {/* Nome do tecnico + iniciar */}
            <div className="flex items-center gap-3">
              <div className="relative">
                {nameError && (
                  <p className="absolute -top-7 right-0 whitespace-nowrap text-[11px] font-medium text-red-400">
                    Digite o nome do treinador para continuar
                  </p>
                )}
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: `${cor1}90` }} />
                <input
                  ref={nameInputRef}
                  value={managerName}
                  onChange={e => {
                    setManagerName(e.target.value)
                    if (nameError) setNameError(false)
                  }}
                  placeholder="Nome do técnico..."
                  maxLength={32}
                  aria-invalid={nameError}
                  className="h-11 w-44 sm:w-56 rounded-xl pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:outline-none transition-all bg-black/55"
                  style={{ border: `1px solid ${nameError ? "#ef4444" : `${cor1}40`}` }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = nameError ? "#ef4444" : `${cor1}80`
                    e.currentTarget.style.boxShadow = nameError ? "0 0 0 3px rgba(239,68,68,0.15)" : `0 0 0 3px ${cor1}20`
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = nameError ? "#ef4444" : `${cor1}40`
                    e.currentTarget.style.boxShadow = "none"
                  }}
                />
              </div>

              <button
                onClick={handleStart}
                aria-disabled={!isNameValid}
                className="relative h-11 px-6 rounded-xl font-black text-sm tracking-[0.15em] uppercase text-white transition-all active:scale-[0.97] inline-flex items-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${cor1} 0%, ${cor2} 100%)`,
                  boxShadow: `0 6px 22px ${cor1}45`,
                  opacity: isNameValid ? 1 : 0.55,
                  filter: isNameValid ? "none" : "grayscale(0.4)",
                }}
              >
                <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                Iniciar carreira
              </button>
            </div>

          </div>
        </footer>
      </div>
    </main>
  )
}
