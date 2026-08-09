"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { safeLocalSet } from "@/lib/safe-storage"
import { getClubFacts } from "@/lib/club-facts"
import { getTeamStadiumBackground } from "@/lib/pre-match-bg"
import Image from "next/image"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, User, Play, Check, Trophy, Award, Globe, Building2, CornerDownLeft, ArrowLeft, Shuffle, Repeat } from "lucide-react"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  getTeamUniforms,
  completarLigaComPool,
  getCamisaUrl,
  getEscudoUrl,
  isKitVariantAvailable,
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
  primeraBChileTeams,
  ecuadorTeams,
  primeraDivUryTeams,
  kLeague1Teams,
  kLeague2Teams,
  chineseSuperTeams,
  championshipTeams,
  serieBItaTeams,
  bundesliga2Teams,
  ligue2Teams,
  laLiga2Teams,
} from "@/lib/international-teams"
import { getLeagueLogo } from "@/lib/league-logos"
import { useGameManager } from "@/lib/use-game-manager"
import { listCareerSaves } from "@/lib/save-system"
import { contaLogada } from "@/lib/conta-ultrafoot"
import { LIMITE_SAVES_SEM_REGISTRO, PAISES_SEM_REGISTRO, ROTA_DE_REGISTRO, useJogoRegistrado } from "@/lib/beneficios"
import { createYouthCareer } from "@/lib/youth-career-engine"
import { createClubDebt, type DebtPreset } from "@/lib/debt-engine"
import { createScoutingDepartment } from "@/lib/scout-engine"
import { createStadiumPitch } from "@/lib/infrastructure-engine"
import { generateOffers } from "@/lib/sponsor-engine"
import { TeamCrest, getCustomLogoUrl } from "@/components/team-crest"
import { Escudo3D } from "@/components/novo-jogo/escudo-3d"
import { NumeroQueConta } from "@/components/novo-jogo/numero-que-conta"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { flushPersistentStore } from "@/lib/persistent-store"
import { UEFA_EXPANSION_FEDERATIONS } from "@/lib/uefa-expansion"

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
  /**
   * Liga montada com o pool do proprio pais (as segundas divisoes ligadas em
   * 04/08). ⚠️ NAO da para resolver isso no escopo do modulo: o caminho passa
   * por `applyTeamOverride`, que le o persistent-store, e no Tauri o store
   * hidrata DEPOIS do import — o clube apareceria com o nome e o escudo de
   * antes das suas edicoes, e nunca se corrigiria. Ver
   * [[ultrafoot-efeito-que-grava-antes-de-hidratar]].
   */
  doPool?: boolean
}

interface CountryTab {
  name: string
  code: string
  region: Regiao
  leagues: LeagueTab[]
}

const CORE_COUNTRIES: CountryTab[] = [
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
      { key: "championship", label: "Championship", short: "Championship", teams: championshipTeams },
    ],
  },
  {
    name: "Espanha", code: "ESP", region: "europa",
    leagues: [
      { key: "la_liga", label: "La Liga", short: "La Liga", teams: laLigaTeams },
      { key: "la_liga_2", label: "La Liga 2", short: "La Liga 2", teams: laLiga2Teams },
    ],
  },
  {
    name: "Italia", code: "ITA", region: "europa",
    leagues: [
      { key: "serie_a_ita", label: "Serie A", short: "Serie A", teams: serieAItaTeams },
      { key: "serie_b_ita", label: "Serie B", short: "Serie B", teams: serieBItaTeams },
    ],
  },
  {
    name: "Alemanha", code: "GER", region: "europa",
    leagues: [
      { key: "bundesliga", label: "Bundesliga", short: "Bundesliga", teams: bundesligaTeams },
      { key: "bundesliga_2", label: "2. Bundesliga", short: "2. Bundesliga", teams: bundesliga2Teams },
    ],
  },
  {
    name: "Franca", code: "FRA", region: "europa",
    leagues: [
      { key: "ligue_1", label: "Ligue 1", short: "Ligue 1", teams: ligue1Teams },
      { key: "ligue_2", label: "Ligue 2", short: "Ligue 2", teams: ligue2Teams },
    ],
  },
  {
    name: "Portugal", code: "POR", region: "europa",
    leagues: [
      { key: "primeira_liga", label: "Primeira Liga", short: "Primeira Liga", teams: primeiraLigaTeams },
      { key: "liga_portugal_2", label: "Liga Portugal 2", short: "Liga 2", teams: [], doPool: true },
    ],
  },
  {
    name: "Holanda", code: "NED", region: "europa",
    leagues: [
      { key: "eredivisie", label: "Eredivisie", short: "Eredivisie", teams: eredivisieTeams },
      { key: "eerste_divisie", label: "Eerste Divisie", short: "Eerste Div", teams: [], doPool: true },
    ],
  },
  {
    name: "Escocia", code: "SCO", region: "europa",
    leagues: [
      { key: "scottish_prem", label: "Scottish Premiership", short: "Scottish Prem", teams: scottishPremTeams },
      { key: "scottish_champ", label: "Scottish Championship", short: "Championship", teams: [], doPool: true },
    ],
  },
  {
    name: "Turquia", code: "TUR", region: "europa",
    leagues: [
      { key: "super_lig", label: "Super Lig", short: "Super Lig", teams: superLigTeams },
      { key: "tff_1_lig", label: "TFF 1. Lig", short: "1. Lig", teams: [], doPool: true },
    ],
  },
  {
    name: "Belgica", code: "BEL", region: "europa",
    leagues: [
      { key: "pro_league_bel", label: "Belgian Pro League", short: "Pro League", teams: proLeagueBelTeams },
      { key: "challenger_pro", label: "Challenger Pro League", short: "Challenger", teams: [], doPool: true },
    ],
  },
  {
    name: "Russia", code: "RUS", region: "europa",
    leagues: [
      { key: "russian_prem", label: "Russian Premier League", short: "Russian Prem", teams: russianPremTeams },
      { key: "russian_first", label: "Russian First League", short: "First League", teams: [], doPool: true },
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
      { key: "liga_argentina", label: "Liga Profesional", short: "Liga Argentina", teams: ligaArgentinaTeams },
      { key: "primera_b_arg", label: "Primera Nacional", short: "Primera Nacional", teams: [], doPool: true },
    ],
  },
  {
    name: "Colombia", code: "COL", region: "americas",
    leagues: [
      { key: "primera_a_col", label: "Primera A", short: "Primera A", teams: primeiraAColTeams },
      { key: "torneo_betplay", label: "Torneo BetPlay", short: "Torneo BetPlay", teams: [], doPool: true },
    ],
  },
  {
    name: "Chile", code: "CHI", region: "americas",
    leagues: [
      { key: "primera_div_chi", label: "Primera Division", short: "Primera Div", teams: primeraDivChileTeams },
      { key: "primera_b_chi", label: "Primera B", short: "Primera B", teams: primeraBChileTeams },
    ],
  },
  {
    // A LigaPro existia inteira (16 clubes, escudo em todos, regulamento
    // proprio) e nao aparecia aqui — o pais nao era oferecido.
    name: "Equador", code: "ECU", region: "americas",
    leagues: [
      { key: "primera_a_ecu", label: "LigaPro Serie A", short: "LigaPro", teams: ecuadorTeams },
      { key: "serie_b_ecu", label: "LigaPro Serie B", short: "LigaPro B", teams: [], doPool: true },
    ],
  },
  {
    name: "Uruguai", code: "URU", region: "americas",
    leagues: [
      { key: "primera_div_ury", label: "Primera Division", short: "Primera Div", teams: primeraDivUryTeams },
      { key: "segunda_div_ury", label: "Segunda Division", short: "Segunda Div", teams: [], doPool: true },
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
      { key: "k_league_2", label: "K-League 2", short: "K-League 2", teams: kLeague2Teams },
    ],
  },
  {
    name: "China", code: "CHN", region: "asia",
    leagues: [
      { key: "chinese_super", label: "Chinese Super League", short: "Super League", teams: chineseSuperTeams },
      { key: "china_league_one", label: "China League One", short: "China Liga 1", teams: [], doPool: true },
    ],
  },
]

const EXPANSION_COUNTRIES: CountryTab[] = UEFA_EXPANSION_FEDERATIONS
  .filter(federation => federation.top?.participants.length)
  .map(federation => ({
    name: federation.country,
    code: federation.code.toUpperCase(),
    region: "europa",
    leagues: [federation.top, federation.second]
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry?.participants.length))
      .map(entry => ({
        key: entry.id,
        label: entry.name,
        short: entry.name,
        teams: [],
        // Resolve depois da hidratação para respeitar overrides e saves.
        doPool: true,
      })),
  }))

const COUNTRIES: CountryTab[] = [...CORE_COUNTRIES, ...EXPANSION_COUNTRIES]

// Fundo trocado a pedido do usuario (2026-07-20): foto in-game 7.
const STADIUM_BG = "/images/pre-jogo/in-game-7.webp"

export default function NovoJogoPage() {
  const { initializeNewGame } = useGameManager()
  const { registrado } = useJogoRegistrado()
  const [limiteDeSaves, setLimiteDeSaves] = useState(false)
  const { setTheme, setTeamColors } = useTheme()

  const [countryIndex, setCountryIndex] = useState(0)
  const [leagueIndex, setLeagueIndex] = useState(0)
  const [teamIndex, setTeamIndex] = useState(0)
  const [uniformIndex, setUniformIndex] = useState(0)
  const [kitError, setKitError] = useState(false)
  const [kitRetryCount, setKitRetryCount] = useState(0)
  const [managerName, setManagerName] = useState("")
  /**
   * O nome já vem preenchido com o da CONTA do launcher.
   *
   * Quem entrou na conta já se identificou uma vez; pedir o nome de novo aqui é
   * atrito puro — e era o único campo que barrava o botão de começar. Continua
   * editável: o técnico pode usar outro nome na carreira se quiser.
   *
   * `nome` vazio cai na parte do e-mail antes do @, porque cadastro por Google
   * às vezes chega sem nome preenchido e um placeholder vazio anularia o ganho.
   */
  const nomePreenchido = useRef(false)
  useEffect(() => {
    if (nomePreenchido.current) return
    let vivo = true

    const aplicar = (nome: string) => {
      const limpo = nome.trim().slice(0, 32)
      if (!vivo || !limpo || nomePreenchido.current) return
      nomePreenchido.current = true
      // Só preenche campo VAZIO: se a pessoa já começou a digitar, manda ela.
      setManagerName(atual => (atual.trim().length > 0 ? atual : limpo))
    }

    void (async () => {
      // 1) CONTA DO LAUNCHER. Só existe dentro do app: `contaLogada` chama o
      //    comando Tauri `ler_sessao_do_launcher`, que no NAVEGADOR sempre
      //    falha e devolve null. Por isso o campo continuava vazio no preview
      //    web — não era o código não rodar, era não haver conta para ler ali.
      const conta = await contaLogada()
      const doEmail = (conta?.email ?? "").split("@")[0]?.trim() ?? ""
      const daConta = (conta?.nome ?? "").trim() || doEmail
      if (daConta) return aplicar(daConta)

      // 2) SEM CONTA: usa o nome da carreira mais recente. Quem já jogou não
      //    precisa redigitar o próprio nome a cada carreira nova — e isso vale
      //    inclusive na versão web, onde a conta do launcher não existe.
      try {
        const anteriores = await Promise.resolve(listCareerSaves())
        const ultimo = [...(anteriores ?? [])]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .find(c => (c.managerName ?? "").trim().length > 0)
        if (ultimo) aplicar(ultimo.managerName)
      } catch { /* preencher o nome e conforto: nunca pode travar a tela */ }
    })()

    return () => { vivo = false }
  }, [])
  const [careerStart, setCareerStart] = useState<"professional" | "sub20">("professional")
  const [debtPreset, setDebtPreset] = useState<DebtPreset>("none")
  const [nameError, setNameError] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Enquanto o registro nao hidrata (o arquivo do store carrega de forma
  // assincrona) valem os tres paises livres: o indice 0 e o Brasil nos dois
  // casos, entao a lista so CRESCE quando o codigo aparece — nunca encolhe
  // debaixo do dedo de quem ja estava escolhendo.
  // O store hidrata assincrono; enquanto isso as ligas do pool ficam vazias e
  // esta revisao as recalcula quando ele avisa.
  const [storeHidratado, setStoreHidratado] = useState(0)
  useEffect(() => {
    const avisar = () => setStoreHidratado(v => v + 1)
    window.addEventListener("ultrafoot:store:ready", avisar)
    return () => window.removeEventListener("ultrafoot:store:ready", avisar)
  }, [])

  const paises = useMemo(
    () => {
      const lista = registrado ? COUNTRIES : COUNTRIES.filter(c => PAISES_SEM_REGISTRO.includes(c.code))
      return lista.map(pais => ({
        ...pais,
        leagues: pais.leagues.map(liga =>
          liga.doPool ? { ...liga, teams: completarLigaComPool(liga.key) } : liga),
      }))
    },
    [registrado, storeHidratado],
  )
  const paisesBloqueados = COUNTRIES.length - paises.length

  const activeCountry = paises[Math.min(countryIndex, paises.length - 1)]
  const activeLeague = activeCountry.leagues[Math.min(leagueIndex, activeCountry.leagues.length - 1)]
  const teams = activeLeague.teams
  const selectedTeam = teams[teamIndex]

  // Dados de perfil do clube, derivados de forma deterministica (estaveis por time)
  // Modal com a FOTO real do estádio (acervo de 1785 fotos, por nome do clube).
  const [showStadiumPhoto, setShowStadiumPhoto] = useState(false)
  const stadiumPhoto = useMemo(
    () => getTeamStadiumBackground(selectedTeam?.nome, selectedTeam?.estadio_nome),
    [selectedTeam?.nome, selectedTeam?.estadio_nome],
  )

  // URL do escudo para a cena 3D, resolvida na MESMA ordem do TeamCrest (save
  // local > canal > build). Resolvida num efeito, e nao direto no render, porque
  // `getCustomLogoUrl` le o persistent-store, que hidrata depois da montagem —
  // ler cedo devolveria o escudo do build e a cena ficaria com o antigo.
  const [escudo3dUrl, setEscudo3dUrl] = useState<string | null>(null)
  /** A cena assumiu? Enquanto for false, quem aparece e o TeamCrest normal. */
  const [escudo3dAtivo, setEscudo3dAtivo] = useState(false)
  useEffect(() => {
    const chave = selectedTeam?.file_key
    // Trocou de clube: a reserva volta AGORA. Sem isto o escudo do time anterior
    // ficaria escondido enquanto a textura nova carrega, e a tela piscaria vazia.
    setEscudo3dAtivo(false)
    if (!chave) { setEscudo3dUrl(null); return }
    const resolver = () => setEscudo3dUrl(getCustomLogoUrl(chave) ?? getEscudoUrl(chave))
    resolver()
    window.addEventListener("ultrafoot:store:ready", resolver)
    window.addEventListener("ultrafoot:elencos:atualizados", resolver)
    return () => {
      window.removeEventListener("ultrafoot:store:ready", resolver)
      window.removeEventListener("ultrafoot:elencos:atualizados", resolver)
    }
  }, [selectedTeam?.file_key])

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
    // Fatos REAIS (lib/club-facts): fundacao e titulos eram inventados por hash
    // — Corinthians saia como 1895/11 ligas (real: 1910/7). Sem curadoria, "—".
    const facts = getClubFacts(t?.curto)
    const foundation = facts?.foundation ?? null
    const ligas = facts?.ligas ?? null
    const copas = facts?.copas ?? null
    const continental = facts?.continental ?? null
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
    // Cores da referência (EA FC): o degradê vai do tom VIVO no topo para uma
    // versão mais funda embaixo — nunca para quase-preto, que era o que fazia
    // os três cards virarem manchas marrons indistinguíveis na tela.
    if (score >= 80) return { label: "MUITO ALTA", grad: "from-[#f43f5e] via-[#c81e4a] to-[#7d1533]" }
    if (score >= 62) return { label: "ALTA", grad: "from-[#fb923c] via-[#e35d12] to-[#8f3a0c]" }
    if (score >= 44) return { label: "MÉDIA", grad: "from-[#2dd4bf] via-[#0f9e8c] to-[#0a4f47]" }
    if (score >= 26) return { label: "BAIXA", grad: "from-[#60a5fa] via-[#2563eb] to-[#1a3f96]" }
    return { label: "MUITO BAIXA", grad: "from-[#94a3b8] via-[#5b6b7f] to-[#2b3542]" }
  }

  const uniforms = useMemo(() => (selectedTeam ? getTeamUniforms(selectedTeam) : null), [selectedTeam])
  const uniformVariants = useMemo(
    () => (["home", "away", "third"] as const).filter(variant => !selectedTeam || isKitVariantAvailable(selectedTeam.file_key, variant)),
    [selectedTeam],
  )
  const activeVariant = uniformVariants[uniformIndex % uniformVariants.length] ?? "home"
  const activeUniform = uniforms ? uniforms[activeVariant] : null
  const cycleUniform = useCallback(() => setUniformIndex(prev => (prev + 1) % uniformVariants.length), [uniformVariants.length])

  const formatCompact = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 2 }).format(v)

  const handleStart = useCallback(async () => {
    if (!selectedTeam) return
    if (managerName.trim().length === 0) {
      setNameError(true)
      // foca o input para o usuario digitar o nome
      nameInputRef.current?.focus()
      return
    }
    // TETO DE CARREIRAS SEM REGISTRO (lib/beneficios.ts). Note o que isto NAO
    // faz: nao interrompe carreira nenhuma, nao apaga save e nao aparece no meio
    // do jogo. So diz, ANTES de comecar mais uma, que o slot acabou — e apagar
    // uma carreira antiga libera o espaco na hora.
    if (!registrado && listCareerSaves().length >= LIMITE_SAVES_SEM_REGISTRO) {
      setLimiteDeSaves(true)
      return
    }
    // Marcador pequeno e sincrono para recuperar a navegacao no WebView caso o
    // sessionStorage seja descartado durante o reload do protocolo Tauri.
    safeLocalSet("ultrafoot:career-bootstrap", JSON.stringify({
      teamShort: selectedTeam.curto,
      managerName: managerName.trim(),
      createdAt: Date.now(),
    }))
    setTeamColors({ primary: selectedTeam.cor1, secondary: selectedTeam.cor2 })
    setTheme("team")
    initializeNewGame(selectedTeam.curto, managerName, {
      youthCareer: undefined,
      debt: createClubDebt(debtPreset, profile?.clubValue ?? 100_000_000),
      scoutingDepartment: createScoutingDepartment(),
      stadiumPitch: createStadiumPitch(selectedTeam.prestigio, 2026),
      sponsorOffers: generateOffers(selectedTeam.prestigio, 1),
      activeSponsors: [],
    })
    window.sessionStorage.setItem("ultrafoot:session-active", "true")
    // Cutscene de início de carreira REMOVIDA (pedido): vai DIRETO ao escritório.
    // Ainda aguardamos o plugin-store persistir — sem isso, o reload da WebView
    // podia destruir o cache antes de o novo clube chegar ao disco e a home
    // carregava para sempre. O limite de 5s evita prender a UI se o FS falhar.
    await Promise.race([
      flushPersistentStore(),
      new Promise<void>(resolve => window.setTimeout(resolve, 5000)),
    ])
    hardNavigate("/?career=1")
  }, [selectedTeam, managerName, initializeNewGame, setTeamColors, setTheme, careerStart, debtPreset, profile])

  const isNameValid = managerName.trim().length > 0

  const nextTeam = useCallback(() => setTeamIndex(prev => (prev + 1) % teams.length), [teams.length])
  const prevTeam = useCallback(() => setTeamIndex(prev => (prev - 1 + teams.length) % teams.length), [teams.length])

  const nextCountry = useCallback(() => {
    setCountryIndex(prev => (prev + 1) % paises.length)
    setLeagueIndex(0)
    setTeamIndex(0)
  }, [paises.length])
  const prevCountry = useCallback(() => {
    setCountryIndex(prev => (prev - 1 + paises.length) % paises.length)
    setLeagueIndex(0)
    setTeamIndex(0)
  }, [paises.length])

  // O registro chega depois do primeiro render: a lista de paises cresce e o
  // indice precisa continuar dentro dela.
  useEffect(() => {
    setCountryIndex(prev => Math.min(prev, paises.length - 1))
  }, [paises.length])

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
      // NAO sequestrar teclas quando o jogador esta digitando (ex.: nome). Antes, apagar
      // (Backspace) durante a digitacao do nome VOLTAVA ao menu, e as setas trocavam de time.
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      switch (e.key) {
        case "ArrowLeft": prevTeam(); break
        case "ArrowRight": nextTeam(); break
        case "ArrowUp": prevCountry(); break
        case "ArrowDown": nextCountry(); break
        case "Enter": handleStart(); break
        // Esc NÃO volta mais à splash (relato: expulsava do seletor). Fecha o
        // modal da foto do estádio quando aberto; senão é no-op. Sair do
        // seletor fica no Backspace e no botão Voltar.
        case "Escape": setShowStadiumPhoto(false); break
        case "Backspace": hardNavigate("/splash"); break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleStart, prevTeam, nextTeam, prevCountry, nextCountry])

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
  useEffect(() => { setKitError(false); setKitRetryCount(0) }, [teamIndex, leagueIndex, countryIndex, uniformIndex])

  // O protocolo game-asset:// (Tauri) por vezes falha numa primeira tentativa logo apos
  // a janela abrir. Antes de cair pro uniforme generico, tenta de novo algumas vezes.
  const handleKitError = useCallback(() => {
    setKitRetryCount((c) => {
      if (c < 4) {
        setTimeout(() => setKitRetryCount((n) => n + 1), 120)
        return c
      }
      setKitError(true)
      return c
    })
  }, [])

  // Cartão da referência: azul-ardósia translúcido, canto BEM arredondado e
  // borda quase invisível. O antigo tinha canto menor e fundo mais opaco, o que
  // dava um ar de "caixa de formulário" em vez do vidro suave do FIFA 26.
  const cardBase = "rounded-[20px] bg-[#141b28]/72 border border-white/[0.06] backdrop-blur-md shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]"
  const fan = levelInfo(profile.fanAdmiration)
  const youth = levelInfo(profile.youthFacilities)
  const fin = levelInfo(profile.financialStability)

  return (
    <main className="h-screen w-screen overflow-hidden relative">

      {/* ── FUNDO ────────────────────────────────────────────────────────────
          A referência (FIFA 26) usa um fundo CINEMATOGRÁFICO e desfocado, não
          uma foto nítida: névoa escura com um halo frio de um lado e quente do
          outro. A foto do estádio continua ali, mas borrada e dessaturada — ela
          dá profundidade sem disputar atenção com os cartões, que é o problema
          de usá-la nítida. */}
      <div className="absolute inset-0 z-0">
        {/* A ARTE é o fundo (Nova pasta/Fundo 2.png -> WebP, 53 KB): gramado
            noturno com névoa e profundidade de campo. Substitui a foto de
            estádio, que mudava a cada clube e fazia a tela trocar de
            temperatura sem que isso dissesse nada sobre o time. */}
        <Image
          src="/images/escolha-time-bg.webp"
          alt=""
          fill
          className="object-cover"
          priority
          unoptimized
        />
        {/* Véu leve (30%). A arte já nasce escura; véu forte apagaria o gramado
            e sobraria um retângulo preto. O suficiente para o texto branco
            assentar sobre a área mais clara do campo. */}
        <div className="absolute inset-0 bg-[#06080b]/30" />
        {/* Halos do clube nos cantos SUPERIORES: a metade de baixo da arte é o
            gramado iluminado, e halo colorido ali vira mancha suja. Em cima, na
            névoa escura, a cor do time aparece limpa. */}
        <div
          aria-hidden
          className="absolute inset-0 transition-[background] duration-700"
          style={{
            background:
              `radial-gradient(50% 45% at 8% 12%, ${cor1}3a 0%, transparent 66%),`
              + ` radial-gradient(45% 40% at 94% 10%, ${cor2}26 0%, transparent 62%)`,
          }}
        />
        {/* Vinheta + escurecimento do rodapé: fecha os cantos e garante contraste
            para os controles, agora que a barra de baixo é transparente. */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_40%,transparent_38%,rgba(0,0,0,0.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      <div className="relative z-10 h-full flex flex-col">

        {/* ── Conteudo principal: 4 zonas (estilo EA FC) ── */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 overflow-y-auto py-6">
          <div className="flex flex-col lg:flex-row items-stretch justify-center gap-3 lg:gap-4 w-full max-w-[1480px]">

            {/* ── Zona 1: Info do clube ── */}
            <div className="flex flex-col w-full lg:w-[300px] shrink-0">

              {/* Pais (com setas, navega nos dois sentidos pelos paises disponiveis) */}
              <div className="flex items-center gap-1.5 mb-2">
                <button
                  onClick={prevCountry}
                  aria-label="Pais anterior"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={nextCountry}
                  aria-label={`Pais: ${activeCountry.name}. Trocar pais`}
                  className="group flex items-center gap-1.5"
                >
                  <span className="text-base font-bold uppercase tracking-wide text-white/80 group-hover:text-white transition-colors">{activeCountry.name}</span>
                  <span className="text-white/35 text-[10px]">{Math.min(countryIndex, paises.length - 1) + 1}/{paises.length}</span>
                </button>
                <button
                  onClick={nextCountry}
                  aria-label="Proximo pais"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Aviso das ligas que o codigo libera. Fica junto do seletor porque
                  e ali que a falta aparece — some assim que o jogo e registrado. */}
              {paisesBloqueados > 0 && (
                <button
                  type="button"
                  onClick={() => hardNavigate(ROTA_DE_REGISTRO)}
                  className="mb-3 flex w-full items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-2 text-left text-[11px] leading-snug text-amber-100/80 transition-colors hover:border-amber-400/45 hover:bg-amber-400/[0.12]"
                >
                  <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    Sem registro voce comeca no <strong className="font-semibold text-amber-100">Brasil, Franca ou Espanha</strong>.
                    Registre o jogo para abrir os outros {paisesBloqueados} paises.
                  </span>
                </button>
              )}

              {/* NOME + ESCUDO, na hierarquia da referência: o nome manda, o
                  escudo vem grande logo abaixo, sem moldura nem círculo. O halo
                  fica na COR DO CLUBE e troca junto com ele. */}
              <h1 className="text-[2.1rem] sm:text-[2.5rem] font-black uppercase tracking-[-0.02em] text-white leading-[0.95] text-balance">
                {selectedTeam?.nome}
              </h1>

              {/* ESCUDO — o elemento mais importante da tela, e agora com o
                  tamanho que isso exige. Halo duplo (cor do clube + brilho
                  quente) para ele descolar do fundo em qualquer escudo, claro
                  ou escuro. */}
              <div className="relative my-7 flex items-center justify-center">
                <div
                  aria-hidden
                  className="absolute h-72 w-72 rounded-full blur-[70px] transition-colors duration-500"
                  style={{ backgroundColor: `${cor1}55` }}
                />
                <div
                  aria-hidden
                  className="absolute h-44 w-44 rounded-full bg-white/[0.06] blur-2xl"
                />
                <motion.div
                  key={selectedTeam?.curto}
                  initial={{ opacity: 0, scale: 0.86, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
                >
                  {/* O TeamCrest e a RESERVA, e some quando a cena 3D assume — os
                      dois visiveis ao mesmo tempo davam escudo duplicado, porque a
                      placa 3D e o <img> nao ocupam o mesmo espaco. Ele continua
                      montado (nao e `&&`) de proposito: e ele que resolve escudo
                      local, do canal e do build, e volta a aparecer sozinho se
                      faltar WebGL, se a textura falhar ou se o jogador ligar
                      "reduzir movimento". */}
                  <TeamCrest
                    team={selectedTeam}
                    size="4xl"
                    className={cn(
                      "h-56 w-56 drop-shadow-[0_18px_46px_rgba(0,0,0,0.8)] sm:h-64 sm:w-64 transition-opacity duration-300",
                      escudo3dAtivo && "opacity-0",
                    )}
                  />
                  {escudo3dUrl && (
                    <Escudo3D
                      key={escudo3dUrl}
                      src={escudo3dUrl}
                      cor1={selectedTeam?.cor1}
                      cor2={selectedTeam?.cor2}
                      onPronto={setEscudo3dAtivo}
                      className="pointer-events-none absolute inset-0"
                    />
                  )}
                </motion.div>
              </div>

              {/* Estrelas — medida de força do clube, discretas sob o escudo. */}
              <div className="mb-5 flex items-center justify-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => {
                  const fill = ratingHalf - i
                  return (
                    <span
                      key={i}
                      className={cn(
                        "h-2.5 w-2.5 rotate-45 rounded-[1px] transition-colors",
                        fill >= 1 ? "bg-amber-400"
                          : fill >= 0.5 ? "bg-gradient-to-br from-amber-400 from-50% to-white/12 to-50%"
                            : "bg-white/12",
                      )}
                    />
                  )
                })}
              </div>

              {/* PÍLULAS DE AÇÃO — o formato da referência. "Trocar de time" no
                  lugar das setas soltas em volta do escudo: fica claro que é
                  ação, e não decoração do brasão.
                  (A referência tem também "ÍDOLOS e Heróis/Heroínas"; fora daqui
                  de propósito — este jogo não tem times femininos.) */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={nextTeam}
                  className="group flex h-11 w-full max-w-[260px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-5 text-sm font-semibold text-white/85 transition-all hover:border-white/30 hover:bg-white/[0.13] hover:text-white"
                >
                  <Shuffle className="h-4 w-4 opacity-70" />
                  Trocar de time
                </button>
                <button
                  onClick={selectRandomTeam}
                  className="flex h-10 w-full max-w-[260px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[13px] font-medium text-white/60 transition-all hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
                >
                  Surpreenda-me
                </button>
              </div>

              {/* Liga (com setas se houver multiplas no pais) */}
              <div className="flex items-center justify-center gap-2 mt-auto pt-4">
                {hasMultipleLeagues && (
                  <button onClick={prevLeague} aria-label="Liga anterior" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={hasMultipleLeagues ? nextLeague : undefined}
                  aria-label={hasMultipleLeagues ? `Liga: ${activeLeague.label}. Trocar liga` : activeLeague.label}
                  className={cn("flex flex-col items-center gap-2", hasMultipleLeagues && "cursor-pointer")}
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
                  {hasMultipleLeagues && (
                    <span className="text-white/35 text-[10px]">{leagueIndex + 1} / {activeCountry.leagues.length} ligas</span>
                  )}
                </button>
                {hasMultipleLeagues && (
                  <button onClick={nextLeague} aria-label="Proxima liga" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Zona 2: Uniforme + Estadio ──
                Coluna mais larga para a camisa CABER GRANDE: era 220px e a
                camisa saía com 150px, menor que o escudo do card ao lado. */}
            <div className="flex flex-col gap-3 w-full lg:w-[268px] shrink-0">
              {/* Card Uniforme */}
              <button onClick={cycleUniform} className={cn(cardBase, "flex-1 flex flex-col items-center px-5 py-4 transition-colors hover:border-[var(--brand)]/30")} aria-label="Trocar uniforme">
                <span className="text-xs text-white/50 tracking-wide">Uniforme</span>
                <span className="text-base font-black uppercase tracking-wide text-white mb-2">Uniforme {(uniformIndex % uniformVariants.length) + 1}</span>
                <motion.div
                  key={`${selectedTeam?.curto}-${activeVariant}`}
                  initial={{ opacity: 0, y: 10, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-1 flex items-center justify-center w-full px-2"
                >
                  {selectedTeam && !kitError ? (
                    <Image
                      key={`${selectedTeam.file_key}-${activeVariant}-${kitRetryCount}`}
                      src={getCamisaUrl(selectedTeam.file_key, activeVariant, selectedTeam.nome)}
                      alt={`Uniforme ${(uniformIndex % uniformVariants.length) + 1} do ${selectedTeam.nome}`}
                      width={230}
                      height={288}
                      className="max-w-[230px] w-full h-auto object-contain drop-shadow-[0_14px_34px_rgba(0,0,0,0.65)]"
                      onError={handleKitError}
                      unoptimized
                    />
                  ) : activeUniform ? (
                    <Jersey
                      variant={activeVariant}
                      primary={activeUniform.primary}
                      secondary={activeUniform.secondary}
                      pattern={activeUniform.pattern}
                      className="max-w-[230px]"
                    />
                  ) : null}
                </motion.div>
                {/* Indicador de carrossel */}
                <div className="flex items-center gap-2 mt-3">
                  <ChevronLeft className="w-3.5 h-3.5 text-white/30" />
                  {[0, 1, 2].map(i => (
                    <span key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === uniformIndex ? "bg-[var(--brand)]" : "bg-white/20")} />
                  ))}
                  <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                </div>
              </button>

              {/* Card Estadio — clique/hover abre modal com a FOTO real do
                  estádio (acervo de 1785 fotos já embutido, por nome do clube). */}
              <button
                onClick={() => stadiumPhoto && setShowStadiumPhoto(true)}
                onMouseEnter={() => stadiumPhoto && setShowStadiumPhoto(true)}
                className={cn(cardBase, "flex flex-col items-center px-5 py-4 gap-2", stadiumPhoto && "cursor-pointer hover:ring-1 hover:ring-[var(--brand)]/40")}
              >
                <span className="text-xs text-white/50 tracking-wide">Nome do estádio</span>
                <span className="text-sm font-black uppercase tracking-wide text-white text-center text-balance leading-tight">{selectedTeam?.estadio_nome}</span>
                <Building2 className="w-9 h-9 text-white/70 mt-1" strokeWidth={1.5} />
                <span className="text-[11px] text-white/40 tabular-nums">{(selectedTeam?.estadio_cap || 0).toLocaleString("pt-BR")} lugares</span>
              </button>

              {showStadiumPhoto && stadiumPhoto && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                  onClick={() => setShowStadiumPhoto(false)}
                  onMouseLeave={() => setShowStadiumPhoto(false)}
                >
                  <div className="relative mx-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10">
                    {/* <img> cru: a foto do estadio vem de caminho resolvido em runtime. */}
                    <img src={stadiumPhoto} alt={selectedTeam?.estadio_nome ?? "Estádio"} className="h-auto w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
                      <p className="text-lg font-black text-white">{selectedTeam?.estadio_nome}</p>
                      <p className="text-xs text-white/60">{(selectedTeam?.estadio_cap || 0).toLocaleString("pt-BR")} lugares · {selectedTeam?.nome}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Zona 3: Estatisticas + Diretoria ── */}
            <div className="flex flex-col gap-3 w-full lg:flex-1 lg:max-w-[440px]">
              {/* O conteúdo se DISTRIBUI na altura do cartão (justify-between +
                  py maior). Antes tudo se amontoava no topo e sobrava um vazio
                  grande embaixo — na referência o cartão é preenchido de ponta
                  a ponta, e é isso que o faz parecer um painel e não uma lista
                  que acabou cedo. */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={cn(cardBase, "flex-1 px-7 py-7 flex flex-col justify-center gap-8")}
              >
                {/* FUNDAÇÃO com a moldura de louros da referência. São dois
                    ramos em CSS (bordas arredondadas cortadas), não um asset:
                    o card precisa funcionar em qualquer clube sem depender de
                    arte que não temos. */}
                {/* O DESTAQUE SO ACENDE QUANDO HA FATO CURADO. Brilho e moldura
                    dourada em cima de "—" chamam atencao para o que o jogo NAO
                    sabe; sem dado, a moldura fica discreta e o rotulo explica.
                    Ver lib/club-facts: fundacao e titulo sao afirmacoes sobre
                    clube real, entao ou vem de curadoria ou nao vem. */}
                <div className="relative text-center">
                  <span className="text-[13px] text-white/55 tracking-wide">Fundação</span>
                  <motion.div
                    key={`fund-${selectedTeam?.file_key ?? ""}`}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="relative mx-auto mt-1 flex w-fit items-center gap-3"
                  >
                    <span aria-hidden className={cn(
                      "h-12 w-6 rounded-l-full border-y-2 border-l-2 transition-colors duration-500",
                      profile.foundation ? "border-[color:var(--brand)]/70" : "border-white/20",
                    )} />
                    <div className="relative">
                      {profile.foundation && (
                        <motion.span
                          aria-hidden
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.5, 0.28] }}
                          transition={{ duration: 1.1, times: [0, 0.45, 1] }}
                          className="pointer-events-none absolute -inset-4 rounded-full bg-[color:var(--brand)]/25 blur-2xl"
                        />
                      )}
                      <NumeroQueConta
                        valor={profile.foundation}
                        tipo="ano"
                        className="relative text-6xl font-black text-white tabular-nums leading-none"
                      />
                    </div>
                    <span aria-hidden className={cn(
                      "h-12 w-6 rounded-r-full border-y-2 border-r-2 transition-colors duration-500",
                      profile.foundation ? "border-[color:var(--brand)]/70" : "border-white/20",
                    )} />
                  </motion.div>
                  {!profile.foundation && (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/25">sem registro histórico</p>
                  )}
                </div>

                {/* Titulos */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Award, label: "Ligas nacionais", value: profile.ligas },
                    { icon: Trophy, label: "Copas nacionais", value: profile.copas },
                    { icon: Globe, label: "Continental", value: profile.continental },
                  ].map(({ icon: Icon, label, value }, i) => (
                    <motion.div
                      key={`${label}-${selectedTeam?.file_key ?? ""}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.08 + i * 0.06 }}
                      className="flex flex-col items-center text-center"
                    >
                      {/* Sala de troféus: quem TEM título ganha ícone aceso e
                          número na cor do tema; quem tem zero (ou não tem dado)
                          fica apagado. É a diferença entre a vitrine do clube
                          grande e a do clube pequeno, que é justamente o que
                          esta tela deveria comunicar. */}
                      <Icon
                        className={cn(
                          "w-9 h-9 transition-colors duration-500",
                          value ? "text-[color:var(--brand)]" : "text-white/35",
                        )}
                        strokeWidth={1.5}
                      />
                      <span className="text-[11px] text-white/50 mt-2 leading-tight">{label}</span>
                      <NumeroQueConta
                        valor={value}
                        duracao={700}
                        className={cn(
                          "text-4xl font-black tabular-nums mt-1 leading-none",
                          value ? "text-white" : "text-white/35",
                        )}
                      />
                    </motion.div>
                  ))}
                </div>

                <div className="h-px bg-white/[0.09]" />

                {/* Valores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <span className="text-[12px] text-white/50">Valor do clube</span>
                    <div className="text-2xl font-black gradient-text-primary tabular-nums leading-tight">{formatCompact(profile.clubValue)}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-[12px] text-white/50">Verba de transf.</span>
                    <div className="text-2xl font-black text-white tabular-nums leading-tight">{formatCompact(profile.transferBudget)}</div>
                  </div>
                </div>
              </motion.div>

              {/* Card Diretoria */}
              <div className={cn(cardBase, "px-6 py-4 text-center")}>
                <span className="text-xs text-white/50 tracking-wide">Expectativa da Diretoria</span>
                <p className="text-sm font-black uppercase tracking-wide text-white mt-1 text-balance leading-snug">{profile.board}</p>
              </div>
            </div>

            {/* ── Zona 4: Cards de nivel ──
                O DEGRADÊ é o dado aqui: a cor diz o nível antes de a pessoa ler
                a palavra. Antes um `bg-black/20` cobria o cartão inteiro e
                apagava justamente isso — restava um retângulo cinza-avermelhado
                em que "MUITO ALTA" e "BAIXA" pareciam a mesma coisa. Agora o véu
                é só um degradê de baixo para cima, para o texto continuar
                legível sem matar a cor. */}
            <div className="flex flex-col gap-3 w-full lg:w-[232px] shrink-0">
              {[
                { title: "Admiração da Torcida", info: fan },
                { title: "Instalações da Base", info: youth },
                { title: "Estabilidade financeira", info: fin },
              ].map(({ title, info }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.06 * i, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "relative flex flex-1 flex-col justify-between overflow-hidden rounded-[20px] bg-gradient-to-b px-5 py-5 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]",
                    info.grad,
                  )}
                >
                  {/* Brilho SÓ no topo, como na referência: dá volume ao cartão
                      sem o véu preto que antes cobria tudo e apagava a cor —
                      era ele que deixava os três cards com a mesma cara. */}
                  <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.14] to-transparent" />
                  <span className="relative text-[15px] font-semibold leading-tight text-white text-balance drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
                    {title}
                  </span>
                  <motion.span
                    key={info.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28 }}
                    className="relative text-[1.7rem] font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                  >
                    {info.label}
                  </motion.span>
                </motion.div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Barra inferior (estilo EA FC) ── */}
        {/* RODAPÉ TRANSPARENTE — a barra opaca cortava a arte do fundo numa
            faixa reta e fazia a tela parecer duas imagens coladas. Sem fundo
            nem borda: só um degradê muito suave por baixo, para os controles
            claros não sumirem quando a arte tiver área clara ali. */}
        <footer className="relative shrink-0 bg-gradient-to-t from-black/55 to-transparent px-4 sm:px-8 py-3">
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
              {/* O botão "Profissional" saiu daqui: era um seletor de UMA opção
                  só — `careerStart` nunca deixava de ser "professional", já que
                  não havia botão para o sub-20. Um controle que não controla
                  nada ocupa espaço e sugere uma escolha que não existe.
                  O estado continua, com o mesmo valor padrão. */}
              <select value={debtPreset} onChange={event => setDebtPreset(event.target.value as DebtPreset)} aria-label="Dívida inicial do clube" className="h-11 rounded-xl border border-white/15 bg-black/70 px-3 text-[10px] font-bold uppercase text-white/75">
                <option value="none">Sem dívida</option><option value="light">Dívida leve</option><option value="realistic">Dívida realista</option><option value="high">Dívida alta</option>
              </select>
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
                  style={{ borderWidth: "1px", borderStyle: "solid", borderColor: nameError ? "#ef4444" : `${cor1}40` }}
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

      {/* Teto de carreiras de quem não registrou. Aparece ANTES de comecar mais
          uma — nunca no meio de carreira nenhuma — e sai daqui por dois caminhos:
          apagar uma antiga (Carregar jogo) ou registrar. */}
      {limiteDeSaves && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-6" onClick={() => setLimiteDeSaves(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c14] p-6 text-center"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">
              Você já tem {LIMITE_SAVES_SEM_REGISTRO} carreiras salvas
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Sem registro o jogo guarda {LIMITE_SAVES_SEM_REGISTRO} carreiras ao mesmo tempo. Apague uma antiga
              para abrir espaço, ou registre o jogo e tenha quantas quiser — junto com save na
              nuvem, FC Hub, editor de equipes e a Central de Atualizações.
            </p>
            <p className="mt-2 text-xs text-white/35">
              Nenhuma carreira sua é apagada ou interrompida por isso.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => hardNavigate(ROTA_DE_REGISTRO)}
                className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-black text-[var(--brand-ink)] transition-all hover:brightness-110"
              >
                Registrar o jogo
              </button>
              <button
                onClick={() => hardNavigate("/splash?menu=1")}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                Gerenciar carreiras
              </button>
              <button
                onClick={() => setLimiteDeSaves(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/50 transition-colors hover:text-white"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
