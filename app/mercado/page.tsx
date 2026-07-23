"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Image from "next/image"
import {
  Search,
  User,
  ArrowLeftRight,
  Trophy,
  Shield,
  Flag,
  ChevronLeft,
  ChevronRight,
  Star,
  AlertCircle,
  Globe,
  Clock,
  Check,
  X,
  UserPlus,
  Play,
  Pause,
  Eye,
  EyeOff,
  Briefcase,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { NegotiationModal } from "@/components/modals/negotiation-modal"
import { getGameDate } from "@/lib/game-date"
import { getFormationSlots, normalizePosition } from "@/lib/formations"
import { inferredNationality } from "@/lib/country-normalize"

/** Setores da aba "Rede Mundial" — cada botão cobre todas as posições do setor. */
const REDE_SECTOR_POSITIONS: Record<string, string[]> = {
  Ata: ["ATA", "PD", "PE"],
  Mei: ["MEI", "VOL", "MD", "ME"],
  Def: ["ZAG", "LD", "LE", "GOL"],
}
import { announceOnlineAction } from "@/lib/online-multiplayer"
import { markPlayerRejection, getRejectionCooldownDays } from "@/lib/transfer-cooldown"
import { formatCurrency } from "@/lib/teams-data"
import { generateDetailedMarketTargets, type DetailedMarketTarget } from "@/lib/transfer-engine"
import { useGameState, useUserTeam } from "@/lib/save-system"
import { markDeparted, hasDeparted } from "@/lib/departed-players"
import { useNotifications } from "@/components/notifications-system"
import {
  AVAILABLE_SCOUTS,
  useGameEngine,
  type Player as EnginePlayer,
  type Scout,
  type TransferOffer,
  nextTransferWindowWeek,
} from "@/lib/game-engine"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"
import { PlayerAvatar } from "@/components/player-avatar"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { getLeagueLogo } from "@/lib/league-logos"
import { playerSalaryWeekly } from "@/lib/club-economy"
import { attributesFromOverall } from "@/lib/player-attributes"
import { canAffordTransfer } from "@/lib/debt-engine"

// Alvos de transferência dinâmicos — gerados do banco real (2.900+ clubes)
// via generateDetailedMarketTargets. Determinístico por temporada.
type Player = DetailedMarketTarget

/** Nome de clube comparável (sem acento/caixa/sigla), para casar save x catálogo. */
const SIGLA_CLUBE_MERCADO = new Set(["fc", "sc", "ec", "ca", "cr", "ac", "se", "afc", "cf", "ud", "cd", "clube", "club"])
function normalizeClubShort(nome?: string): string {
  return (nome ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter(w => w && !SIGLA_CLUBE_MERCADO.has(w)).join(" ")
}
type MarketTab = "buscar" | "rede" | "olheiros" | "central" | "enviadas" | "recebidas"
type SentProposalStatus = "aceita" | "rejeitada"

function scoutedLeadToMarketPlayer(lead: import("@/lib/game-engine").ScoutedLead): Player {
  return {
    id: lead.id,
    name: lead.name,
    position: lead.position,
    secondaryPositions: [],
    age: lead.age,
    overall: lead.overall,
    potential: lead.potential,
    value: lead.marketValue,
    trend: "up",
    nationality: lead.nationality,
    height: "—",
    weight: "—",
    foot: "—",
    stats: {
      pace: lead.pace,
      shooting: lead.shooting,
      passing: lead.passing,
      dribbling: lead.dribbling,
      defense: lead.defending,
      physical: lead.physical,
    },
    releaseClause: null,
    scoutedBy: "Departamento de olheiros",
    scoutProgress: 100,
    team: {
      nome: "Mercado observado",
      curto: "OBS",
      cidade: lead.scoutedRegion,
      estado: lead.scoutedRegion,
      cor1: "#00ffc8",
      cor2: "#102226",
      prestigio: 50,
      torcida: 0,
      estadio_cap: 0,
      saldo: 0,
      file_key: "mercado_observado",
      estadio_nome: "",
      patrocinador: "",
      escudo_url: "",
      divisao: "mercado",
      pais: lead.nationality,
      liga: "Agentes e observados",
    },
  }
}

interface SentTransferProposal {
  id: number
  playerName: string
  teamName: string
  position: string
  overall: number
  type: "buy" | "loan"
  amount: number
  status: SentProposalStatus
  week: number
}

const MARKET_TABS: MarketTab[] = ["buscar", "rede", "olheiros", "central", "enviadas", "recebidas"]

// Rótulo amigável para a divisão/liga crua do banco (ex.: "serie_a" -> "Série A").
function divisaoLabel(d?: string): string {
  if (!d) return "Outra"
  const map: Record<string, string> = {
    // Com o país no nome: "Série A" (Brasil) e "Serie A" (Itália) apareciam como
    // duas entradas praticamente iguais no filtro — mesma grafia aos olhos e a
    // MESMA logo. Sem o qualificador não dava para saber qual era qual.
    serie_a: "Série A (Brasil)", serie_b: "Série B (Brasil)",
    serie_c: "Série C (Brasil)", serie_d: "Série D (Brasil)",
  }
  return map[d] ?? d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Nome de liga sem ambiguidade entre países. "Serie A" existe na Itália e no
 * Brasil; "Primera División" em quatro países sul-americanos. Sem o país, o
 * filtro mostra entradas duplicadas e indistinguíveis.
 */
function ligaComPais(liga?: string, pais?: string): string | undefined {
  const nome = (liga ?? "").trim()
  // undefined (e nao "Outra") para o chamador cair no divisaoLabel da divisão.
  if (!nome) return undefined
  const AMBIGUAS = /^(serie a|série a|serie b|série b|primera divisi[oó]n|liga nacional|premier league|primeira liga)$/i
  if (!AMBIGUAS.test(nome) || !pais) return nome
  return `${nome} (${pais})`
}

// Destinos do olheiro: continentes (busca ampla, mais barata por atleta) e
// PAISES especificos (pedido: "procurar no Continente Europeu ou apenas na
// Espanha"). Pais custa mais e demora menos: e uma varredura focada.
const scoutingRegions = [
  // Continentes
  { id: "Brasil", name: "Brasil", weeksToComplete: 2, searchCost: 50000, tipo: "continente" as const },
  { id: "Americas", name: "Américas", weeksToComplete: 3, searchCost: 150000, tipo: "continente" as const },
  { id: "Europa", name: "Europa", weeksToComplete: 4, searchCost: 300000, tipo: "continente" as const },
  { id: "Africa", name: "África", weeksToComplete: 3, searchCost: 120000, tipo: "continente" as const },
  { id: "Asia", name: "Ásia", weeksToComplete: 3, searchCost: 100000, tipo: "continente" as const },
  // Paises — foco maior, prazo menor, custo por atleta mais alto
  { id: "Espanha", name: "Espanha", weeksToComplete: 2, searchCost: 220000, tipo: "pais" as const },
  { id: "Inglaterra", name: "Inglaterra", weeksToComplete: 2, searchCost: 260000, tipo: "pais" as const },
  { id: "Italia", name: "Itália", weeksToComplete: 2, searchCost: 200000, tipo: "pais" as const },
  { id: "Alemanha", name: "Alemanha", weeksToComplete: 2, searchCost: 200000, tipo: "pais" as const },
  { id: "Franca", name: "França", weeksToComplete: 2, searchCost: 190000, tipo: "pais" as const },
  { id: "Portugal", name: "Portugal", weeksToComplete: 2, searchCost: 150000, tipo: "pais" as const },
  { id: "Argentina", name: "Argentina", weeksToComplete: 2, searchCost: 110000, tipo: "pais" as const },
  { id: "Uruguai", name: "Uruguai", weeksToComplete: 2, searchCost: 90000, tipo: "pais" as const },
  { id: "Colombia", name: "Colômbia", weeksToComplete: 2, searchCost: 85000, tipo: "pais" as const },
]

/** Posições que o técnico pode encomendar ao olheiro. */
const SCOUT_POSICOES = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"]

// Filter card types
type FilterType = "nome" | "posicao" | "nacionalidade" | "status" | "idade" | "pais" | "liga" | "time"

interface FilterCard {
  id: FilterType
  label: string
  icon: React.ReactNode
  value: string
}

function marketPlayerToEnginePlayer(p: Player, division = "serie_a", salarioNegociado?: number): EnginePlayer {
  // Atributos coerentes com a posicao quando o alvo nao os traz (antes usava
  // defaults planos 70/65/55 cegos a posicao).
  const attrs = attributesFromOverall(p.overall, p.position, p.name)
  return {
    id: p.id + 9000,
    name: p.name,
    position: p.position,
    age: p.age,
    overall: p.overall,
    potential: p.potential,
    nationality: p.nationality,
    pace: p.stats?.pace ?? attrs.pace,
    shooting: p.stats?.shooting ?? attrs.shooting,
    passing: p.stats?.passing ?? attrs.passing,
    dribbling: p.stats?.dribbling ?? attrs.dribbling,
    defending: p.stats?.defense ?? attrs.defending,
    physical: p.stats?.physical ?? attrs.physical,
    energy: 100,
    morale: "Normal" as const,
    form: p.overall,
    // Salario REALISTA por divisao (consistente com a economia do jogo), ou o
    // valor negociado na mesa do agente. Antes era overall*800 fixo — irreal
    // para clubes pequenos e desligado da nova economia.
    contract: { salary: salarioNegociado ?? playerSalaryWeekly(p.overall, division), endDate: 52, releaseClause: p.releaseClause ?? null, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: p.value,
    joinedClubWeek: 0,
    joinedClubSeason: 2026,
    isLoanedIn: false,
    isStarter: false,
  }
}

export default function MercadoPage() {
  const { team: userTeam } = useUserTeam()
  const { addNotification } = useNotifications()
  const { state: careerState, setState: setCareerState } = useGameState()
  const t = useTranslation()
  const gameEngine = useGameEngine()

  useDiscordActivity("No mercado de transferências", userTeam?.nome ?? "Sem clube")

  const [activeTab, setActiveTab] = useState<MarketTab>("buscar")
  const [selectedFilter, setSelectedFilter] = useState<FilterType | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [negotiationOpen, setNegotiationOpen] = useState(false)
  const [negotiationType, setNegotiationType] = useState<"buy" | "loan">("buy")
  const [positionFilter, setPositionFilter] = useState<string>("Tudo")
  const [redeDetailed, setRedeDetailed] = useState(false)
  const [marketPage, setMarketPage] = useState(0)
  const [expandedScoutId, setExpandedScoutId] = useState<number | null>(null)
  const [marketNotice, setMarketNotice] = useState<string | null>(null)
  const [sentProposals, setSentProposals] = useState<SentTransferProposal[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Filter states
  const [nameFilter, setNameFilter] = useState("")
  // Antes eram read-only (useState sem setter): os cards de filtro so marcavam qual
  // estava "ativo", mas nunca mudavam o valor — a busca so funcionava por nome. Agora
  // Posicao e Idade sao editaveis pelos proprios cards e alimentam filteredPlayers.
  const [selectedPosition, setSelectedPosition] = useState("Tudo")
  const [minAge, setMinAge] = useState(16)
  const [maxAge, setMaxAge] = useState(35)
  const POSICOES = ["Tudo", "GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"]
  const cyclePosition = () => {
    const i = POSICOES.indexOf(selectedPosition)
    setSelectedPosition(POSICOES[(i + 1) % POSICOES.length])
  }

  // Filtros antes decorativos (Nacionalidade/Pais/Liga/Time/Status): agora com estado
  // real e alimentando filteredPlayers. "Qualquer" = sem filtro.
  const [filterNationality, setFilterNationality] = useState("Qualquer")
  const [filterCountry, setFilterCountry] = useState("Qualquer")
  const [filterLeague, setFilterLeague] = useState("Qualquer")
  const [filterTeam, setFilterTeam] = useState("Qualquer")
  const [filterStatus, setFilterStatus] = useState("Qualquer")
  // Status de transferencia: alem da multa, cobre quem esta disponivel p/ emprestimo
  // e quem esta sem clube (agente livre).
  const STATUS_OPTIONS = [
    "Qualquer",
    "Com multa rescisória",
    "Sem multa",
    "Disponível para empréstimo",
    "Sem clube",
  ]
  const clearAllFilters = () => {
    setNameFilter(""); setSearchQuery(""); setSelectedPosition("Tudo")
    setMinAge(16); setMaxAge(35)
    setFilterNationality("Qualquer"); setFilterCountry("Qualquer")
    setFilterLeague("Qualquer"); setFilterTeam("Qualquer"); setFilterStatus("Qualquer")
  }

  // Search input state for real-time filtering
  const [searchQuery, setSearchQuery] = useState("")

  // Filter cards for search
  const filterCards: FilterCard[] = [
    { id: "nome", label: t.market.name, icon: <User className="h-10 w-10 text-white/30" />, value: t.market.any },
    { id: "posicao", label: t.market.position, icon: null, value: t.market.any },
    { id: "nacionalidade", label: t.market.nationality, icon: <Flag className="h-10 w-10 text-white/30" />, value: t.market.any },
    { id: "status", label: t.market.transferStatus, icon: <ArrowLeftRight className="h-10 w-10 text-white/30" />, value: t.market.any },
    { id: "idade", label: t.market.age, icon: null, value: "16 - 35" },
    { id: "pais", label: t.market.countryRegion, icon: <Flag className="h-8 w-8 text-white/30" />, value: t.market.any },
    { id: "liga", label: t.market.league, icon: <Trophy className="h-10 w-10 text-white/30" />, value: t.market.any },
    { id: "time", label: t.market.team, icon: <Shield className="h-12 w-12 text-white/20" />, value: t.market.any },
  ]

  const hiredScouts = gameEngine.scouts
  const scoutedLeads = gameEngine.scoutedLeads
  const availableScouts = useMemo(() => {
    const hiredIds = new Set(hiredScouts.map((scout) => scout.id))
    return AVAILABLE_SCOUTS.filter((scout) => !hiredIds.has(scout.id))
  }, [hiredScouts])

  const pendingReceivedOffers = useMemo(() => {
    return gameEngine.transferOffers.filter((offer) => offer.status === "pendente")
  }, [gameEngine.transferOffers])

  const pastReceivedOffers = useMemo(() => {
    return gameEngine.transferOffers
      .filter((offer) => offer.status !== "pendente")
      .slice(-8)
      .reverse()
  }, [gameEngine.transferOffers])

  // Data ATUAL do jogo — a carencia de recusa conta em dias de jogo, nao reais.
  const gameDate = useMemo(
    () => getGameDate(gameEngine.currentSeason, gameEngine.currentWeek),
    [gameEngine.currentSeason, gameEngine.currentWeek],
  )

  // Formacao REAL do usuario (o engine e a fonte; a tela mostrava "4-3-3" fixo).
  const centralFormation = gameEngine.formation ?? "4-3-3"

  /**
   * 11 titular REAL, posicionado pela formacao REAL — para o campo da Central de
   * Transferencias, que ate aqui era um 4-3-3 desenhado a mao com overalls inventados.
   *
   * Preferimos quem o usuario marcou como titular; se o engine ainda nao tem escalacao,
   * caimos nos 11 melhores do elenco (dado real, so nao escolhido por ele).
   */
  const centralStartingXI = useMemo(() => {
    const slots = getFormationSlots(centralFormation)
    const squad = gameEngine.squadPlayers ?? []

    const starters = squad.filter((p) => p.isStarter)
    const chosen = (starters.length >= 11 ? starters : [...squad].sort((a, b) => b.overall - a.overall))
      .slice(0, 11)

    // Encaixa cada titular no slot da mesma posicao; o que sobrar preenche na ordem.
    const pool = [...chosen]
    return slots.map((slot) => {
      const exact = pool.findIndex((p) => p.position === slot.pos)
      const idx = exact !== -1 ? exact : 0
      const player = pool.splice(idx, 1)[0]
      return { ...slot, player }
    })
  }, [centralFormation, gameEngine.squadPlayers])

  // Resumo do elenco para os chips do cabecalho da Central (dado real).
  const centralStats = useMemo(() => {
    const squad = gameEngine.squadPlayers ?? []
    const xi = centralStartingXI.map((s) => s.player).filter(Boolean) as EnginePlayer[]
    const avg = xi.length ? Math.round(xi.reduce((s, p) => s + p.overall, 0) / xi.length) : 0
    const value = squad.reduce((s, p) => s + (p.marketValue || 0), 0)
    return { avg, count: squad.length, value }
  }, [gameEngine.squadPlayers, centralStartingXI])

  // Catálogo completo: todos os atletas de todos os clubes importados, estáveis
  // dentro da temporada. A versão anterior passava `60` e, por isso, filtros de
  // país/liga/time pesquisavam somente uma vitrine aleatória — não o mercado real.
  const transferTargets = useMemo(
    () => generateDetailedMarketTargets(userTeam?.curto ?? "", undefined, gameEngine.currentSeason, userTeam?.nome),
    [userTeam?.curto, userTeam?.nome, gameEngine.currentSeason],
  )

  // Opções reais e encadeadas: país -> liga -> time. Nacionalidade e País/Região
  // exibem somente nomes de países (nunca siglas de estado/arquivo).
  const filterOptions = useMemo(() => {
    const uniq = (arr: string[]) =>
      ["Qualquer", ...Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"))]
    const byCountry = filterCountry === "Qualquer"
      ? transferTargets
      : transferTargets.filter((p) => p.team.pais === filterCountry)
    const byLeague = filterLeague === "Qualquer"
      ? byCountry
      : byCountry.filter((p) => p.team.liga === filterLeague)
    // Duas coisas DIFERENTES que estavam saindo da mesma lista: "País/Região" é
    // onde o clube joga; "Nacionalidade" é de onde o ATLETA é. O filtro compara
    // contra p.nationality, mas as opções vinham de p.team.pais — entao escolher
    // uma nacionalidade que so existe como estrangeiro (um paraguaio no Sao
    // Paulo) simplesmente nao era oferecida, e escolher "Brasil" o excluia.
    const countries = transferTargets.map((p) => p.team.pais ?? p.nationality)
    const nationalities = transferTargets.map((p) => p.nationality ?? p.team.pais)
    const groupedTeams = new Map<string, Set<string>>()
    for (const player of byLeague) {
      const country = player.team.pais ?? "Outros países"
      const names = groupedTeams.get(country) ?? new Set<string>()
      names.add(player.team.nome)
      groupedTeams.set(country, names)
    }
    return {
      nacionalidade: uniq(nationalities),
      pais: uniq(countries),
      liga: uniq(byCountry.map((p) => ligaComPais(p.team.liga, p.team.pais) ?? divisaoLabel(p.team.divisao))),
      time: uniq(byLeague.map((p) => p.team.nome)),
      timeGroups: Array.from(groupedTeams.entries())
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([label, names]) => ({
          label,
          options: Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR")),
        })),
    }
  }, [transferTargets, filterCountry, filterLeague])

  // Filter players by all criteria
  const filteredPlayers = useMemo(() => {
    // Salvaguarda de ultima linha: nunca listar o proprio clube, mesmo que o
    // catalogo use um curto diferente do save (COR x CORINTHI). O gerador ja
    // filtra por nome, isto garante que nenhum caminho contorne a regra.
    const meuCurto = (userTeam?.curto ?? "").toUpperCase()
    const meuNome = normalizeClubShort(userTeam?.nome)
    return transferTargets.filter(p => {
      if ((p.team?.curto ?? "").toUpperCase() === meuCurto) return false
      if (meuNome && normalizeClubShort(p.team?.nome) === meuNome) return false
      // Já contratado (por você ou já cedido): sai da vitrine, senão daria para
      // "comprar" de novo um atleta que não está mais no clube de origem.
      if (p.team?.nome && hasDeparted(p.team.nome, p.name)) return false
      // Name filter (uses searchQuery for real-time search)
      const searchTerm = searchQuery || nameFilter
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      // Position filter
      if (selectedPosition !== "Tudo" && p.position !== selectedPosition && !p.secondaryPositions?.includes(selectedPosition)) {
        return false
      }
      // Age filter
      if (p.age < minAge || p.age > maxAge) {
        return false
      }
      // Filtro por SETOR da aba "rede". Antes comparava com uma única sigla
      // ("ATA"/"MEI"/"ZAG"), então "Ata" escondia pontas, "Mei" escondia volantes
      // e "Def" escondia os laterais — a maior parte do catálogo sumia.
      if (positionFilter !== "Tudo") {
        const sector = REDE_SECTOR_POSITIONS[positionFilter]
        if (sector) {
          const positions = [p.position, ...(p.secondaryPositions ?? [])].map(normalizePosition)
          if (!positions.some(pos => sector.includes(pos))) return false
        }
      }
      // Nacionalidade / Pais / Liga / Time
      if (filterNationality !== "Qualquer" && p.nationality !== filterNationality) return false
      if (filterCountry !== "Qualquer" && (p.team.pais ?? "") !== filterCountry) return false
      if (filterLeague !== "Qualquer" && (ligaComPais(p.team.liga, p.team.pais) ?? divisaoLabel(p.team.divisao)) !== filterLeague) return false
      if (filterTeam !== "Qualquer" && p.team.nome !== filterTeam) return false
      // Status de transferencia
      if (filterStatus === "Com multa rescisória" && p.releaseClause == null) return false
      if (filterStatus === "Sem multa" && p.releaseClause != null) return false
      // Sem clube: agente livre (o banco marca o clube como vazio).
      if (filterStatus === "Sem clube" && (p.team?.nome ?? "").trim() !== "") return false
      // Emprestavel: clube grande + jogador jovem/reserva costuma liberar emprestimo.
      // Sem um flag real no banco, usamos esse criterio (e o rotulo diz "disponivel").
      if (filterStatus === "Disponível para empréstimo") {
        const jovem = p.age <= 23
        const naoEssencial = p.overall < (p.team?.prestigio ?? 70)
        if (!(jovem || naoEssencial)) return false
      }
      return true
    })
  }, [transferTargets, nameFilter, searchQuery, selectedPosition, minAge, maxAge, positionFilter,
      filterNationality, filterCountry, filterLeague, filterTeam, filterStatus])
  
  // Auto-select first player when filtered results change
  useEffect(() => {
    if (filteredPlayers.length > 0 && !selectedPlayer) {
      setSelectedPlayer(filteredPlayers[0])
    }
  }, [filteredPlayers, selectedPlayer])

  // Gamepad support
  useEffect(() => {
    const handler = (e: Event) => {
      const { button } = (e as CustomEvent).detail

      if (button === "B") {
        if (negotiationOpen) { setNegotiationOpen(false); return }
        window.history.back()
        return
      }

      // Mesmo problema do teclado, no controle: com o modal aberto, LB/RB trocava a aba
      // e o D-Pad movia a selecao ATRAS do dialog. So o "B" (fechar) passa daqui.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return

      if (button === "LB" || button === "RB") {
        const idx = MARKET_TABS.indexOf(activeTab)
        const fallbackIdx = idx === -1 ? 0 : idx
        const next = button === "LB" ? Math.max(0, fallbackIdx - 1) : Math.min(MARKET_TABS.length - 1, fallbackIdx + 1)
        setActiveTab(MARKET_TABS[next])
        return
      }

      if (activeTab === "rede") {
        if (button === "DPad_Up" || button === "DPad_Down") {
          const cur = selectedPlayer ? filteredPlayers.findIndex(p => p.id === selectedPlayer.id) : -1
          const next = button === "DPad_Up" ? Math.max(0, cur - 1) : Math.min(filteredPlayers.length - 1, cur + 1)
          if (filteredPlayers[next]) setSelectedPlayer(filteredPlayers[next])
          return
        }
        if (button === "A") { handleNegotiate("buy"); return }
        if (button === "X") { handleNegotiate("loan"); return }
      }

      if (activeTab === "buscar" && button === "A") { handleSearch(); return }
    }

    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, negotiationOpen, filteredPlayers, selectedPlayer])

  // Keyboard support for the transfer hub shortcuts shown on screen.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null

      // Com um MODAL aberto, a tela de fundo nao pode reagir ao teclado.
      //
      // Este listener esta no window. O slider do Radix e um <span role="slider">, nao
      // um <input> — entao escapava do guarda isTyping abaixo: apertar a seta no slider
      // da proposta movia o slider E, ao borbulhar ate aqui, trocava a aba do mercado
      // atras do modal. Vale para qualquer dialog, nao so o de negociacao.
      const modalOpen = document.querySelector('[role="dialog"][data-state="open"]')
      if (modalOpen) {
        // Esc continua fechando (o proprio Radix ja trata; aqui so evitamos o history.back).
        return
      }

      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable ||
        // Widgets de teclado (slider, spinbutton) consomem as setas por conta propria.
        target?.getAttribute("role") === "slider" ||
        target?.getAttribute("role") === "spinbutton"

      if (isTyping) return

      if (e.key === "Escape") {
        if (negotiationOpen) {
          setNegotiationOpen(false)
          return
        }
        // Na aba Buscar, Esc primeiro LIMPA os filtros ativos (o rodape anuncia isso);
        // sem filtros ativos, volta.
        if (activeTab === "buscar") {
          const algumAtivo =
            searchQuery !== "" || nameFilter !== "" || selectedPosition !== "Tudo" ||
            minAge > 16 || maxAge < 35 || filterNationality !== "Qualquer" ||
            filterCountry !== "Qualquer" || filterLeague !== "Qualquer" ||
            filterTeam !== "Qualquer" || filterStatus !== "Qualquer"
          if (algumAtivo) { clearAllFilters(); return }
        }
        window.history.back()
        return
      }

      if (e.key === "q" || e.key === "Q") {
        setActiveTab("buscar")
        return
      }

      if (e.key === "z" || e.key === "Z") {
        setActiveTab("central")
        return
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const idx = MARKET_TABS.indexOf(activeTab)
        const fallbackIdx = idx === -1 ? 0 : idx
        const next =
          e.key === "ArrowLeft"
            ? Math.max(0, fallbackIdx - 1)
            : Math.min(MARKET_TABS.length - 1, fallbackIdx + 1)
        setActiveTab(MARKET_TABS[next])
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, negotiationOpen, searchQuery, nameFilter, selectedPosition, minAge, maxAge,
      filterNationality, filterCountry, filterLeague, filterTeam, filterStatus])

  // Renderizar 53 mil cards de uma vez bloqueava a WebView ao abrir a Rede Mundial.
  // O catálogo continua completo para busca/filtros, mas a lista é paginada.
  const MARKET_PAGE_SIZE = 100
  const marketPageCount = Math.max(1, Math.ceil(filteredPlayers.length / MARKET_PAGE_SIZE))
  const visibleMarketPlayers = useMemo(
    () => filteredPlayers.slice(marketPage * MARKET_PAGE_SIZE, (marketPage + 1) * MARKET_PAGE_SIZE),
    [filteredPlayers, marketPage],
  )

  // Setas do painel de detalhe (eram decorativas): navegam o jogador
  // anterior/próximo dentro da página visível.
  const detailNav = useMemo(() => {
    if (!selectedPlayer) return { prev: undefined, next: undefined, indice: -1, total: 0, irPara: undefined }
    const idx = visibleMarketPlayers.findIndex(p => p.id === selectedPlayer.id)
    return {
      prev: idx > 0 ? () => setSelectedPlayer(visibleMarketPlayers[idx - 1]) : undefined,
      next: idx >= 0 && idx < visibleMarketPlayers.length - 1 ? () => setSelectedPlayer(visibleMarketPlayers[idx + 1]) : undefined,
      // Posicao e total reais: o rodape do painel mostrava a palavra "Num" e
      // cinco bolinhas fixas, com a primeira sempre acesa. Nao indicavam nada.
      indice: idx,
      total: visibleMarketPlayers.length,
      irPara: (i: number) => setSelectedPlayer(visibleMarketPlayers[i]),
    }
  }, [selectedPlayer, visibleMarketPlayers])

  // Atalhos X/C dos keycaps da aba Rede (eram enfeite): ciclam o filtro de setor.
  useEffect(() => {
    const FILTROS = ["Tudo", "Ata", "Mei", "Def"]
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT")) return
      const k = e.key.toLowerCase()
      if (k !== "x" && k !== "c") return
      const i = FILTROS.indexOf(positionFilter)
      const atual = i >= 0 ? i : 0
      setPositionFilter(FILTROS[(atual + (k === "c" ? 1 : FILTROS.length - 1)) % FILTROS.length])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [positionFilter])
  useEffect(() => setMarketPage(0), [searchQuery, nameFilter, selectedPosition, minAge, maxAge,
    positionFilter, filterNationality, filterCountry, filterLeague, filterTeam, filterStatus])
  useEffect(() => {
    if (marketPage >= marketPageCount) setMarketPage(marketPageCount - 1)
  }, [marketPage, marketPageCount])

  // Group players by position type
  const groupedPlayers = useMemo(() => {
    const groups: Record<string, Player[]> = {
      "Ataque": [],
      "Meio": [],
      "Defesa": []
    }
    
    visibleMarketPlayers.forEach(player => {
      if (["ATA", "PE", "PD"].includes(player.position)) {
        groups["Ataque"].push(player)
      } else if (["MEI", "ME", "MD", "VOL"].includes(player.position)) {
        groups["Meio"].push(player)
      } else {
        groups["Defesa"].push(player)
      }
    })
    
    return groups
  }, [visibleMarketPlayers])

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player)
  }

  const handleNegotiate = (type: "buy" | "loan" = "buy", player = selectedPlayer) => {
    if (!player) return

    // Jogador que recusou fica 30 dias sem ouvir o clube. Antes dava para reabrir o
    // modal e propor de novo no mesmo dia ate a sorte virar — recusa sem custo nenhum.
    const daysLeft = getRejectionCooldownDays(player.id, gameDate)
    if (daysLeft > 0) {
      setMarketNotice(
        `${player.name} recusou sua proposta. Ele so voltara a negociar em ${daysLeft} dia${daysLeft > 1 ? "s" : ""}.`
      )
      return
    }

    setSelectedPlayer(player)
    setNegotiationType(type)
    setNegotiationOpen(true)
  }

  const handleSearch = () => {
    setActiveTab("rede")
  }

  const handleHireScout = (scoutData: typeof AVAILABLE_SCOUTS[number]) => {
    if (gameEngine.balance < scoutData.salary * 4) {
      setMarketNotice("Saldo insuficiente para contratar este olheiro.")
      return
    }

    const newScout: Scout = {
      ...scoutData,
      isSearching: false,
      searchProgress: 0,
      searchTarget: null,
      foundPlayers: [],
      weeksSearching: 0,
    }

    gameEngine.hireScout(newScout)
    setMarketNotice(`${scoutData.name} foi contratado para o departamento de olheiros.`)
  }

  // Criterios da missao do olheiro (posicao / potencial minimo / idade maxima).
  const [scoutPos, setScoutPos] = useState<string>("")
  const [scoutMinPot, setScoutMinPot] = useState<number>(0)
  const [scoutMaxAge, setScoutMaxAge] = useState<number>(23)

  const handleStartScoutSearch = (scoutId: number, regionId: string) => {
    const region = scoutingRegions.find((item) => item.id === regionId)
    if (!region) return

    if (gameEngine.balance < region.searchCost) {
      setMarketNotice("Saldo insuficiente para iniciar esta busca.")
      return
    }

    gameEngine.startScoutSearch(scoutId, region.id, region.weeksToComplete, region.searchCost, {
      position: scoutPos || null,
      minPotential: scoutMinPot || undefined,
      maxAge: scoutMaxAge,
    })
    setExpandedScoutId(null)
    const alvo = [scoutPos || null, scoutMinPot ? `potencial ${scoutMinPot}+` : null, `até ${scoutMaxAge} anos`]
      .filter(Boolean).join(", ")
    setMarketNotice(`Busca iniciada em ${region.name} (${alvo}). Avance semanas para receber relatórios.`)
  }

  const handleNegotiationResult = ({
    player,
    type,
    offer,
    accepted,
    rejectedBy,
  }: {
    player: { id?: number; name: string; position: string; overall: number; team?: { nome?: string } }
    type: "buy" | "sell" | "loan"
    offer: number
    accepted: boolean
    rejectedBy?: "club" | "player" | null
  }) => {
    if (type === "sell") return

    // Recusa DO JOGADOR abre 30 dias de carencia. Recusa do clube nao: ali e so
    // dinheiro, e faz sentido voltar com uma oferta maior.
    if (!accepted && rejectedBy === "player" && player.id != null) {
      markPlayerRejection(player.id, gameDate)
      // Jogador que recusou SAI da Central (pedido com print): manter a
      // proposta rejeitada listada convidava a reabrir negociação que o
      // atleta congelou por 30 dias. O toast já comunica a carência.
      setSentProposals(current => current.filter(p => p.playerName !== player.name))
      return
    }

    const proposalStatus: SentProposalStatus = accepted ? "aceita" : "rejeitada"
    announceOnlineAction("transfer_decision", { player: player.name, type, offer, accepted, rejectedBy: rejectedBy ?? null })

    // Aviso na Central da resposta à MINHA proposta (pedido). A decisão é
    // sincrona aqui, entao notificamos direto — a ponte global cuida das
    // propostas RECEBIDAS e das sondagens.
    addNotification({
      type: "transfer", priority: accepted ? "high" : "medium",
      title: accepted ? `Proposta aceita: ${player.name}` : `Proposta recusada: ${player.name}`,
      message: accepted
        ? `${player.team?.nome ?? "O clube"} aceitou sua proposta por ${player.name}. Conclua a contratação.`
        : `${rejectedBy ?? player.team?.nome ?? "O clube"} recusou sua proposta por ${player.name}.`,
    })

    setSentProposals((current) => [
      {
        id: Date.now(),
        playerName: player.name,
        teamName: player.team?.nome ?? "Clube",
        position: player.position,
        overall: player.overall,
        type,
        amount: offer,
        status: proposalStatus,
        week: gameEngine.currentWeek,
      },
      ...current,
    ].slice(0, 12))
  }

  const handleGenerateReceivedOffer = () => {
    const before = useGameEngine.getState().transferOffers.length
    gameEngine.generateAIOffers(userTeam?.curto)
    const after = useGameEngine.getState().transferOffers.length
    setMarketNotice(
      after > before
        ? "Um clube enviou uma nova proposta."
        : "Nenhum clube apresentou proposta nesta rodada."
    )
  }

  // O mercado depende de save/localStorage. Renderizar os dados persistidos no primeiro
  // frame do cliente, enquanto o HTML estatico foi gerado sem save, causava hydration
  // mismatch (React #418) apenas na build de producao.
  if (!mounted) {
    return <div className="h-screen bg-[#050508]" aria-label="Carregando mercado" />
  }

  return (
    <div className="relative h-screen overflow-hidden md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508]">
      {/* Background stadium image */}
      {/* Sem md:ml-16: reservava 64px para uma sidebar inexistente e deixava uma
          faixa sem fundo na esquerda a partir do breakpoint md. */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/images/market-transfer-background.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        {/* Base dark overlay */}
        <div className="absolute inset-0 bg-black/40" />
        {/* Top gradient to darken header area */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/70" />
        {/* Subtle dark blue tint for game atmosphere */}
        <div className="absolute inset-0 bg-[#050508]/20" />
      </div>

      <GameHeader team={userTeam} />

      <main className="relative z-10 p-4 h-[calc(100vh-48px)] overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MarketTab)}>
          {/* EA FC Style Header Navigation */}
          <div className="flex items-center gap-4 mb-8 min-w-0">
            <div className="flex shrink-0 items-center gap-2 text-white/50 text-sm">
              <span className="text-xs border border-white/20 rounded px-1.5 py-0.5">w</span>
              <span>Transferencias</span>
            </div>

            <div className="relative min-w-0 flex-1">
              <div className="overflow-x-auto pr-10 scrollbar-thin">
                <TabsList className="min-w-max bg-transparent border-0 p-0 h-auto gap-6">
                  <TabsTrigger
                    value="buscar"
                    className="bg-transparent border-0 px-0 py-0 text-lg font-semibold data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
                  >
                    {t.market.searchAthletes}
                  </TabsTrigger>
                  <span className="text-white/20">|</span>
                  <TabsTrigger
                    value="rede"
                    className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
                  >
                    {t.market.transferNetwork}
                  </TabsTrigger>
                  <span className="text-white/20">|</span>
                  <TabsTrigger
                    value="olheiros"
                    className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
                  >
                    {t.market.scouts}
                  </TabsTrigger>
                  <span className="text-white/20">|</span>
                  <TabsTrigger
                    value="central"
                    className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
                  >
                    Central de Transf.
                  </TabsTrigger>
                  <span className="text-white/20">|</span>
                  <TabsTrigger
                    value="enviadas"
                    className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
                  >
                    Propostas Enviadas
                  </TabsTrigger>
                  <span className="text-white/20">|</span>
                  <TabsTrigger
                    value="recebidas"
                    className="bg-transparent border-0 px-0 py-0 text-base data-[state=active]:text-white data-[state=active]:bg-transparent text-white/40 hover:text-white/60"
                  >
                    Propostas Recebidas
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l from-[#050508] via-[#050508] to-transparent pl-8">
                <ChevronRight className="h-4 w-4 text-white/35" />
              </div>
            </div>

            <div className="hidden xl:flex shrink-0 items-center gap-4">
              <span className="text-sm text-white/40">{t.market.searchFilters}</span>
            </div>
          </div>

          {marketNotice && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-[#00ffc8]/20 bg-[#00ffc8]/10 px-4 py-2 text-sm text-[#00ffc8]">
              <span>{marketNotice}</span>
              <button
                type="button"
                onClick={() => setMarketNotice(null)}
                className="rounded p-1 text-[#00ffc8]/70 hover:bg-white/10 hover:text-[#00ffc8]"
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Search Filters Tab */}
          <TabsContent value="buscar" className="mt-0">
            {/* Search Input */}
            <div className="mb-6 flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="text"
                  placeholder={t.market.searchByName}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    // Enter apenas fixa o filtro; NAO pula de aba. Antes, apertar Enter
                    // (ou "Buscar") jogava o usuario para a "Rede Mundial" no mesmo instante,
                    // dando a impressao de que a busca "nao fez nada" — o resultado aparecia
                    // noutra tela, sem aviso. Agora os resultados surgem aqui mesmo, abaixo.
                    if (e.key === "Enter") setNameFilter(searchQuery)
                  }}
                  className="w-full pl-12 pr-12 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setNameFilter("")
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={() => setNameFilter(searchQuery)}
                className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Buscar
              </button>
            </div>
            
            {/* Preview de resultados: aparece com busca por nome OU com qualquer filtro
                ativo (posicao/idade). Antes so surgia com 2+ letras, entao filtrar por
                posicao sozinho nao mostrava nada — parecia que o filtro nao funcionava. */}
            {(searchQuery.length >= 2 || selectedPosition !== "Tudo" || minAge > 16 || maxAge < 35 ||
              filterNationality !== "Qualquer" || filterCountry !== "Qualquer" || filterLeague !== "Qualquer" ||
              filterTeam !== "Qualquer" || filterStatus !== "Qualquer") && filteredPlayers.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-[#1a1a1a] border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/60">{t.market.playersFound(filteredPlayers.length)}</span>
                  <button
                    onClick={handleSearch}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {t.market.viewInNetwork}
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {filteredPlayers.slice(0, 8).map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handlePlayerSelect(player)}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-left group"
                    >
                      <PlayerAvatar name={player.name} teamColor={player.team.cor1} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate group-hover:text-primary transition-colors">
                          {player.name}
                        </div>
                        <div className="text-[10px] text-white/40">{player.position} - {player.age} anos</div>
                      </div>
                      <span className="text-sm font-bold text-[#ffd700]">{player.overall}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-4">
              {/* First Row */}
              <FilterCardComponent 
                card={filterCards[0]} 
                selected={selectedFilter === "nome"}
                onClick={() => setSelectedFilter("nome")}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-b from-white/10 to-white/5 flex items-center justify-center">
                        <User className="h-10 w-10 text-white/30" strokeWidth={1.5} />
                      </div>
                    </div>
                    <span className="text-white/50 text-sm mt-3">{nameFilter || t.market.any}</span>
                  </div>
                }
              />
              <FilterCardComponent
                card={filterCards[1]}
                selected={selectedFilter === "posicao"}
                onClick={() => { setSelectedFilter("posicao"); cyclePosition() }}
                customContent={
                  <div className="flex flex-col items-center justify-center h-full gap-1">
                    <div className="font-semibold text-white text-base">{t.market.role}</div>
                    <div className={cn(
                      "text-2xl font-black",
                      selectedPosition === "Tudo" ? "text-white/40" : "text-[#00ffc8]"
                    )}>
                      {selectedPosition === "Tudo" ? t.market.any : selectedPosition}
                    </div>
                    <span className="text-[10px] text-white/30">clique para alternar</span>
                  </div>
                }
              />
              <FilterDropdownCard
                label={t.market.nationality}
                icon={<Flag className="h-10 w-10 text-white/30" strokeWidth={1.5} />}
                value={filterNationality}
                options={filterOptions.nacionalidade}
                onSelect={setFilterNationality}
              />
              <FilterDropdownCard
                label={t.market.transferStatus}
                icon={<ArrowLeftRight className="h-10 w-10 text-white/30" strokeWidth={1.5} />}
                value={filterStatus}
                options={STATUS_OPTIONS}
                onSelect={setFilterStatus}
              />

              {/* Second Row */}
              <FilterCardComponent 
                card={filterCards[4]} 
                selected={selectedFilter === "idade"}
                onClick={() => setSelectedFilter("idade")}
                customContent={
                  <div className="flex flex-col items-stretch justify-center h-full px-6 gap-3">
                    {[
                      { label: "MIN.", val: minAge, dec: () => setMinAge(a => Math.max(15, a - 1)), inc: () => setMinAge(a => Math.min(maxAge, a + 1)) },
                      { label: "MAX.", val: maxAge, dec: () => setMaxAge(a => Math.max(minAge, a - 1)), inc: () => setMaxAge(a => Math.min(45, a + 1)) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between w-full text-sm">
                        <span className="text-white/50 font-medium">{row.label}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); row.dec() }}
                            className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-white/70 hover:bg-white/20"
                          >−</button>
                          <span className="w-6 text-center text-white font-bold tabular-nums">{row.val}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); row.inc() }}
                            className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-white/70 hover:bg-white/20"
                          >+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              />
              <FilterDropdownCard
                label={t.market.countryRegion}
                icon={<Globe className="h-10 w-10 text-white/30" strokeWidth={1.5} />}
                value={filterCountry}
                options={filterOptions.pais}
                onSelect={(country) => {
                  setFilterCountry(country)
                  setFilterLeague("Qualquer")
                  setFilterTeam("Qualquer")
                }}
              />
              <FilterDropdownCard
                label={t.market.league}
                icon={<Trophy className="h-10 w-10 text-white/30" strokeWidth={1.5} />}
                leagueLogo={filterLeague !== "Qualquer" ? getLeagueLogo(filterLeague) : null}
                value={filterLeague}
                options={filterOptions.liga}
                onSelect={(league) => {
                  setFilterLeague(league)
                  setFilterTeam("Qualquer")
                }}
              />
              <FilterDropdownCard
                label={t.market.team}
                icon={<Shield className="h-10 w-10 text-white/20" strokeWidth={1} />}
                value={filterTeam}
                options={filterOptions.time}
                groups={filterOptions.timeGroups}
                onSelect={setFilterTeam}
              />
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between mt-8">
              <div className="flex items-center gap-6 text-xs text-white/50">
                <div className="flex items-center gap-2">
                  <span className="border border-white/30 rounded px-1.5 py-0.5">Enter</span>
                  <span>Selecionar Filtro</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="border border-white/30 rounded px-1.5 py-0.5">Esc</span>
                  <span>Limpar Filtros</span>
                </div>
              </div>
              <button 
                onClick={handleSearch}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                {t.market.startSearch}
              </button>
            </div>
          </TabsContent>

          {/* Transfer Network Tab */}
          <TabsContent value="rede" className="mt-0">
            {/* Position Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-1 text-xs text-white/40">
                <span className="border border-white/20 rounded px-1 py-0.5">x</span>
                <span className="border border-white/20 rounded px-1 py-0.5 ml-1">c</span>
              </div>
              {/* "Detalhes" não é posição: era passado como filtro e derrubava a
                  lista para zero atletas. Agora alterna a densidade das linhas. */}
              <button
                onClick={() => setRedeDetailed(value => !value)}
                className={cn("text-sm transition-colors", redeDetailed ? "text-white" : "text-white/40 hover:text-white/60")}
              >
                Detalhes
              </button>
              {["Tudo", "Ata", "Mei", "Def"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPositionFilter(filter)}
                  className={cn(
                    "text-sm transition-colors",
                    positionFilter === filter ? "text-white" : "text-white/40 hover:text-white/60",
                  )}
                >
                  {filter}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-3">
                <TeamCrest team={userTeam} size="sm" />
                <span className="text-white font-medium">{userTeam.nome}</span>
                <div className="flex gap-0.5">
                  <div className="w-12 h-1 bg-green-500 rounded-full" />
                  <div className="w-12 h-1 bg-green-500 rounded-full" />
                  <div className="w-12 h-1 bg-green-500/50 rounded-full" />
                </div>
                <Star className="h-4 w-4 text-[#ffd700]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 h-[calc(100vh-180px)]">
              {/* Player List */}
              <div className="space-y-4 overflow-y-auto pr-1 scrollbar-thin">
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0c0c10]/95 px-3 py-2 backdrop-blur-sm">
                  <span className="text-xs text-white/45">
                    {filteredPlayers.length.toLocaleString("pt-BR")} atletas · página {marketPage + 1} de {marketPageCount}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" disabled={marketPage === 0} onClick={() => setMarketPage(page => Math.max(0, page - 1))} className="rounded bg-white/10 p-1.5 text-white disabled:opacity-25" aria-label="Página anterior">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={marketPage + 1 >= marketPageCount} onClick={() => setMarketPage(page => Math.min(marketPageCount - 1, page + 1))} className="rounded bg-white/10 p-1.5 text-white disabled:opacity-25" aria-label="Próxima página">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {Object.entries(groupedPlayers).map(([group, players]) => (
                  players.length > 0 && (
                    <div key={group} className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-semibold">{group}</h3>
                        <span className="text-xs text-white/40">{t.market.readyToPlay}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {players.map((player) => (
                          <PlayerListCard
                            key={player.id}
                            player={player}
                            selected={selectedPlayer?.id === player.id}
                            detailed={redeDetailed}
                            onClick={() => handlePlayerSelect(player)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>

              {/* Player Details Panel */}
              <div className="overflow-y-auto pr-1 scrollbar-thin">
                {selectedPlayer ? (
                    <PlayerDetailsPanel
                    player={selectedPlayer}
                    onNegotiate={handleNegotiate}
                    onPrev={detailNav.prev}
                    onNext={detailNav.next}
                    indice={detailNav.indice}
                    total={detailNav.total}
                    irPara={detailNav.irPara}
                  />
                ) : (
                  <div className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-8 h-full flex flex-col items-center justify-center text-center">
                    <User className="h-20 w-20 text-white/10 mb-4" />
                    <h3 className="text-white/40 text-lg">{t.market.selectPlayer}</h3>
                    <p className="text-white/30 text-sm mt-2">{t.market.clickForDetails}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Scouts Tab */}
          <TabsContent value="olheiros" className="mt-0">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-white font-semibold">{t.market.scouts}</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">Contrate, envie e acompanhe relatorios</span>
            </div>

            <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)] overflow-hidden">
              <div className="col-span-12 xl:col-span-7 overflow-y-auto pr-2 space-y-4 scrollbar-thin">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-4">
                    <p className="text-xs text-white/40">Olheiros</p>
                    <p className="mt-1 text-2xl font-bold text-white">{hiredScouts.length}</p>
                  </div>
                  <div className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-4">
                    <p className="text-xs text-white/40">Em busca</p>
                    <p className="mt-1 text-2xl font-bold text-[#00ffc8]">{hiredScouts.filter((scout) => scout.isSearching).length}</p>
                  </div>
                  <div className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-4">
                    <p className="text-xs text-white/40">Relatorios</p>
                    <p className="mt-1 text-2xl font-bold text-[#ffd700]">{scoutedLeads.length}</p>
                  </div>
                </div>

                {hiredScouts.length === 0 ? (
                  <div className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-8 text-center">
                    <Briefcase className="mx-auto mb-3 h-10 w-10 text-white/25" />
                    <p className="text-white font-semibold">Nenhum olheiro contratado</p>
                    <p className="mt-1 text-sm text-white/45">Contrate um olheiro para liberar buscas por regiao.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hiredScouts.map((scout) => (
                      <div key={scout.id} className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-white font-semibold">{scout.name}</h3>
                              <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/50">{scout.nationality ?? scout.region}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn("h-3.5 w-3.5", i < scout.skill ? "text-[#ffd700] fill-yellow-500" : "text-white/15")}
                                />
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-white/45">
                              {scout.isSearching
                                ? `Buscando em ${scout.searchTarget ?? scout.region} - ${scout.searchProgress}%`
                                : `Disponivel para nova busca - ${formatCurrency(scout.salary)}/sem`}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {scout.isSearching ? (
                              <button
                                type="button"
                                onClick={() => gameEngine.stopScoutSearch(scout.id)}
                                className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                              >
                                <Pause className="h-3.5 w-3.5" />
                                Parar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedScoutId(expandedScoutId === scout.id ? null : scout.id)}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#00ffc8] px-3 py-2 text-xs font-semibold text-black hover:bg-[#00c8ff]"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Iniciar busca
                              </button>
                            )}
                          </div>
                        </div>

                        {/* O QUE procurar (pedido): posicao, potencial minimo e
                            idade maxima. Sem isto o olheiro trazia qualquer um. */}
                        {expandedScoutId === scout.id && !scout.isSearching && (
                          <div className="mt-4 grid gap-3 border-t border-white/[0.04] pt-4 sm:grid-cols-3">
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-white/40">Posição procurada</span>
                              <select
                                value={scoutPos}
                                onChange={e => setScoutPos(e.target.value)}
                                className="rounded-lg border border-white/10 bg-[#14252a] px-2 py-1.5 text-xs text-white"
                              >
                                <option value="">Qualquer</option>
                                {SCOUT_POSICOES.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-white/40">Potencial mínimo</span>
                              <select
                                value={scoutMinPot}
                                onChange={e => setScoutMinPot(Number(e.target.value))}
                                className="rounded-lg border border-white/10 bg-[#14252a] px-2 py-1.5 text-xs text-white"
                              >
                                <option value={0}>Qualquer</option>
                                {[70, 75, 80, 85, 90].map(v => <option key={v} value={v}>{v}+</option>)}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-white/40">Idade máxima</span>
                              <select
                                value={scoutMaxAge}
                                onChange={e => setScoutMaxAge(Number(e.target.value))}
                                className="rounded-lg border border-white/10 bg-[#14252a] px-2 py-1.5 text-xs text-white"
                              >
                                {[17, 19, 21, 23].map(v => <option key={v} value={v}>até {v} anos</option>)}
                              </select>
                            </label>
                          </div>
                        )}

                        {expandedScoutId === scout.id && !scout.isSearching && (
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 border-t border-white/[0.04] pt-4">
                            {scoutingRegions.map((region) => (
                              <button
                                key={region.id}
                                type="button"
                                onClick={() => handleStartScoutSearch(scout.id, region.id)}
                                className="rounded-lg border border-white/[0.04] bg-white/[0.03] p-3 text-left hover:border-[#00ffc8]/40 hover:bg-[#00ffc8]/10"
                              >
                                <p className="text-sm font-semibold text-white">{region.name}</p>
                                <p className="mt-1 text-[10px] text-white/40">{region.weeksToComplete} sem.</p>
                                <p className="text-[10px] text-[#ffd700]">{formatCurrency(region.searchCost)}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-12 xl:col-span-5 overflow-y-auto space-y-4 scrollbar-thin">
                <div className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Contratar olheiro</h3>
                    <span className="text-xs text-white/35">{availableScouts.length} disponiveis</span>
                  </div>

                  {availableScouts.length === 0 ? (
                    <p className="text-sm text-white/45">Todos os olheiros disponiveis ja foram contratados.</p>
                  ) : (
                    <div className="space-y-2">
                      {availableScouts.slice(0, 4).map((scout) => (
                        <div key={scout.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{scout.name}</p>
                            <p className="text-xs text-white/45">{scout.region} - {formatCurrency(scout.salary)}/sem</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleHireScout(scout)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-[#00ffc8] hover:text-black"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Contratar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Relatorios descobertos</h3>
                    <span className="text-xs text-white/35">{scoutedLeads.length}</span>
                  </div>

                  {scoutedLeads.length === 0 ? (
                    <div className="rounded-lg bg-white/[0.03] p-5 text-center">
                      <EyeOff className="mx-auto mb-2 h-8 w-8 text-white/20" />
                      <p className="text-sm text-white/45">Nenhum jogador descoberto ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {scoutedLeads.map((lead) => (
                        <div key={lead.id} className="rounded-lg bg-white/[0.03] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{lead.name}</p>
                              <p className="text-xs text-white/45">{lead.position} - {lead.age} anos - {lead.nationality}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-[#00ffc8]">{lead.revealedAttributes ? lead.overall : "?"}</p>
                              <p className="text-[10px] text-white/35">OVR</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-xs text-white/45">
                              Potencial {lead.revealedAttributes ? lead.potential : "??"} - {formatCurrency(lead.marketValue)}
                            </span>
                            <div className="flex items-center gap-2">
                              {!lead.revealedAttributes && (
                                <button
                                  type="button"
                                  onClick={() => gameEngine.revealScoutedLead(lead.id)}
                                  disabled={gameEngine.balance < 50000}
                                  className="inline-flex items-center gap-1 rounded bg-[#00ffc8]/15 px-2 py-1 text-[10px] font-semibold text-[#00ffc8] hover:bg-[#00ffc8]/25 disabled:opacity-40"
                                >
                                  <Eye className="h-3 w-3" />
                                  Revelar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => gameEngine.dismissScoutedLead(lead.id)}
                                className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/60 hover:bg-red-500/15 hover:text-red-300"
                              >
                                Dispensar
                              </button>
                              {lead.revealedAttributes && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const player = scoutedLeadToMarketPlayer(lead)
                                    setSelectedPlayer(player)
                                    setNegotiationType("buy")
                                    setNegotiationOpen(true)
                                  }}
                                  className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                                >
                                  <ArrowLeftRight className="h-3 w-3" />
                                  Negociar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Central de Transferencias Tab */}
          <TabsContent value="central" className="mt-0 h-[calc(100vh-116px)] overflow-hidden">
            {/* Cabecalho da Central — titulo claro + chips com o resumo REAL do elenco. */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold leading-tight text-white">Central de Transferências</h2>
                  <p className="text-sm text-white/50">Sua base de operações no mercado</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { icon: <Shield className="h-3.5 w-3.5" />, label: "Formação", value: centralFormation },
                  { icon: <Star className="h-3.5 w-3.5" />, label: "Média XI", value: String(centralStats.avg) },
                  { icon: <User className="h-3.5 w-3.5" />, label: "Elenco", value: String(centralStats.count) },
                  { icon: <Trophy className="h-3.5 w-3.5" />, label: "Valor", value: formatCurrency(centralStats.value) },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                    <span className="text-primary/80">{c.icon}</span>
                    <div className="leading-none">
                      <div className="text-[10px] uppercase tracking-wide text-white/40">{c.label}</div>
                      <div className="text-sm font-bold text-white">{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid h-[calc(100%-76px)] grid-cols-[minmax(320px,0.8fr)_minmax(460px,1.2fr)] gap-4 pb-12">
              {/* Left Column - Actions and Saved Lists */}
              <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
                {/* Action Cards Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Buscar atletas */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("buscar")}
                    className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#12262b] to-[#0b1416] p-5 text-left transition-all hover:border-primary/40"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25 transition-colors group-hover:bg-primary/25">
                      <Search className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Buscar atletas</h3>
                      <p className="text-sm text-white/45">Explore o mercado mundial</p>
                    </div>
                    <ChevronRight className="absolute right-4 top-5 h-5 w-5 text-white/20 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </button>

                  {/* Meus olheiros */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("olheiros")}
                    className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#12262b] to-[#0b1416] p-5 text-left transition-all hover:border-primary/40"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 ring-1 ring-amber-400/25 transition-colors group-hover:bg-amber-400/25">
                      <Eye className="h-6 w-6 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Meus olheiros</h3>
                      <p className="text-sm text-white/45">Relatórios e alvos</p>
                    </div>
                    <ChevronRight className="absolute right-4 top-5 h-5 w-5 text-white/20 transition-transform group-hover:translate-x-1 group-hover:text-amber-400" />
                  </button>
                </div>

                {/* Saved List Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab("rede")}
                  className="relative h-full min-h-0 w-full rounded-xl p-4 text-left transition-all overflow-hidden bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618] border border-primary hover:border-primary group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold truncate">Padrao {userTeam?.curto || "TIME"}...</h3>
                      <span className="text-white/60 text-sm">{centralFormation}</span>
                      <span className="text-[#00ffc8] text-sm ml-2">ABERTO</span>
                    </div>
                    <span className="p-1 rounded transition-colors group-hover:bg-white/10">
                      <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </span>
                  </div>
                  {/* Mini field preview */}
                  <div
                    className="mt-3 h-[calc(100%-112px)] min-h-24 rounded-lg relative overflow-hidden"
                    style={{ background: "radial-gradient(120% 120% at 50% 0%, #1c5a3a, #0f3722 80%)" }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border border-white/20 rounded-full" />
                    </div>
                    {/* Bolinhas na formacao REAL (antes eram 11 posicoes fixas no HTML). */}
                    {centralStartingXI.map((slot, i) => (
                      <div
                        key={i}
                        className={cn(
                          "absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                          slot.pos === "GOL" ? "bg-yellow-400" : "bg-blue-400",
                        )}
                        style={{ left: `${slot.x}%`, top: `${(slot.y / 133) * 100}%` }}
                        title={slot.player?.name ?? slot.pos}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-[#00ffc8] text-xs">
                    <Check className="w-4 h-4" />
                    <span>Abrir rede mundial</span>
                  </div>
                </button>
              </div>

              {/* Right Column - Big Field Preview */}
              <div className="min-h-0 rounded-xl p-5 bg-gradient-to-br from-[#1c2b2f]/80 via-[#162224]/80 to-[#0d1618]/80 backdrop-blur-sm border border-white/[0.08]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white text-2xl font-bold">Padrao {userTeam?.nome?.toUpperCase() || "TIME"}</h2>
                    <span className="text-white/60">{centralFormation}</span>
                    <span className="text-[#00ffc8] ml-2">ABERTO</span>
                  </div>
                  <TeamCrest team={userTeam} size="lg" />
                </div>

                {/* Big Field */}
                <div
                  className="relative w-full h-[calc(100%-80px)] rounded-xl overflow-hidden"
                  style={{
                    // Mesma turfa rica do Gerenciamento (direcao visual aprovada).
                    background:
                      "radial-gradient(120% 90% at 50% -6%, #1c5a3a 0%, #164a31 44%, #0f3722 78%, #0a2718 100%)",
                    boxShadow: "inset 0 0 50px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* Refletores nos cantos */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(60% 55% at 15% 8%, rgba(255,255,235,0.09), transparent 70%)," +
                        "radial-gradient(60% 55% at 85% 8%, rgba(255,255,235,0.09), transparent 70%)",
                    }}
                  />
                  {/* Field lines */}
                  <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/30" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/30 rounded-full" />
                  {/* Penalty areas */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-40 h-16 border-2 border-white/30 border-t-0" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-16 border-2 border-white/30 border-b-0" />

                  {/* 11 TITULAR REAL.
                      Antes eram 11 <div> chumbados no HTML (overalls 81/78/80/84...,
                      rotulos "ZAG"/"MC"), um 4-3-3 fixo que nao tinha relacao nenhuma com
                      o elenco nem com a formacao do usuario. Agora vem do engine. */}
                  {centralStartingXI.map((slot, i) => (
                    <div
                      key={i}
                      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                      style={{ left: `${slot.x}%`, top: `${(slot.y / 133) * 100}%` }}
                    >
                      <div className={cn(
                        "flex h-12 w-10 items-center justify-center rounded-t-full text-xs font-bold",
                        slot.pos === "GOL"
                          ? "bg-gradient-to-b from-yellow-400 to-yellow-600 text-black"
                          : "bg-gradient-to-b from-blue-400 to-blue-600 text-white",
                      )}>
                        {slot.player?.overall ?? "-"}
                      </div>
                      <span className="mt-1 max-w-[72px] truncate text-[10px] text-white">
                        {slot.player?.name ?? slot.pos}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-0 left-0 md:left-16 right-0 bg-gradient-to-t from-[#050508] via-[#050508]/95 to-transparent py-4 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">Esc</span>
                    <span className="text-white/60 text-sm">Voltar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">q</span>
                    <span className="text-white/60 text-sm">Procurar atletas</span>
                  </div>
                </div>
                <TeamCrest team={userTeam} size="sm" />
              </div>
            </div>
          </TabsContent>

          {/* Propostas Enviadas Tab */}
          <TabsContent value="enviadas" className="mt-0">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-white font-semibold">Propostas Enviadas</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">Negociacoes em andamento</span>
            </div>

            <div className="grid grid-cols-2 gap-6 h-[calc(100vh-220px)]">
              <div className="rounded-xl p-6 bg-gradient-to-br from-[#1c2b2f]/80 via-[#162224]/80 to-[#0d1618]/80 backdrop-blur-sm border border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/40">Resumo</p>
                    <h3 className="mt-1 text-xl font-bold text-white">Negociacoes recentes</h3>
                  </div>
                  <Globe className="w-10 h-10 text-white/20" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/[0.04] p-4">
                    <p className="text-xs text-white/40">Enviadas</p>
                    <p className="mt-1 text-2xl font-bold text-white">{sentProposals.length}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-4">
                    <p className="text-xs text-white/40">Aceitas</p>
                    <p className="mt-1 text-2xl font-bold text-[#00ffc8]">{sentProposals.filter((proposal) => proposal.status === "aceita").length}</p>
                  </div>
                </div>
                <p className="mt-6 text-sm text-white/50 leading-relaxed">
                  As propostas feitas pelo modal de negociacao aparecem aqui com o resultado da resposta do clube.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("buscar")}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00ffc8] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00c8ff]"
                  >
                    <Search className="h-4 w-4" />
                    Buscar atletas
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("rede")}
                    className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Abrir rede
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-[#1c2b2f]/80 via-[#162224]/80 to-[#0d1618]/80 backdrop-blur-sm border border-white/[0.08] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
                  <h3 className="text-sm font-semibold text-white">Historico enviado</h3>
                  <span className="text-xs text-white/35">{sentProposals.length} registros</span>
                </div>

                {sentProposals.length === 0 ? (
                  <div className="flex h-[calc(100%-57px)] flex-col items-center justify-center p-8 text-center">
                    <ArrowLeftRight className="mb-4 h-12 w-12 text-white/20" />
                    <p className="text-white/60">Voce nao fez nenhuma proposta ainda.</p>
                    <p className="mt-2 text-sm text-white/40">Escolha um jogador na Rede Mundial e negocie compra ou emprestimo.</p>
                  </div>
                ) : (
                  <div className="max-h-[calc(100vh-280px)] overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin">
                    {sentProposals.map((proposal) => (
                      <div key={proposal.id} className="flex items-center gap-4 px-5 py-4">
                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          proposal.status === "aceita" ? "bg-[#00ffc8]/15 text-[#00ffc8]" : "bg-red-500/15 text-red-300"
                        )}>
                          {proposal.status === "aceita" ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{proposal.playerName}</p>
                          <p className="text-xs text-white/45">
                            {proposal.teamName} - {proposal.type === "loan" ? "Emprestimo" : "Compra"} - Semana {proposal.week}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">{formatCurrency(proposal.amount)}</p>
                          <p className={cn("text-[10px] uppercase", proposal.status === "aceita" ? "text-[#00ffc8]" : "text-red-300")}>
                            {proposal.status === "aceita" ? "Aceita" : "Rejeitada"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-0 left-0 md:left-16 right-0 bg-gradient-to-t from-[#050508] via-[#050508]/95 to-transparent py-4 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">Esc</span>
                    <span className="text-white/60 text-sm">Voltar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">q</span>
                    <span className="text-white/60 text-sm">Procurar atletas</span>
                  </div>
                </div>
                <TeamCrest team={userTeam} size="sm" />
              </div>
            </div>
          </TabsContent>

          {/* Propostas Recebidas Tab */}
          <TabsContent value="recebidas" className="mt-0">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-white font-semibold">Propostas Recebidas</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40">Ofertas de outros clubes</span>
            </div>

            <div className="grid grid-cols-2 gap-6 h-[calc(100vh-220px)]">
              <div className="rounded-xl p-6 bg-gradient-to-br from-[#1c2b2f]/80 via-[#162224]/80 to-[#0d1618]/80 backdrop-blur-sm border border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/40">Entrada</p>
                    <h3 className="mt-1 text-xl font-bold text-white">Ofertas pendentes</h3>
                  </div>
                  <ArrowLeftRight className="w-10 h-10 text-white/20" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/[0.04] p-4">
                    <p className="text-xs text-white/40">Pendentes</p>
                    <p className="mt-1 text-2xl font-bold text-[#ffd700]">{pendingReceivedOffers.length}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-4">
                    <p className="text-xs text-white/40">Historico</p>
                    <p className="mt-1 text-2xl font-bold text-white">{pastReceivedOffers.length}</p>
                  </div>
                </div>
                <p className="mt-6 text-sm text-white/50 leading-relaxed">
                  Aceitar uma proposta de compra remove o jogador do elenco e atualiza saldo, verba de transferencia e folha salarial.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateReceivedOffer}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#00ffc8] px-4 py-2 text-sm font-semibold text-black hover:bg-[#00c8ff]"
                >
                  <Clock className="h-4 w-4" />
                  Atualizar interesse
                </button>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-[#1c2b2f]/80 via-[#162224]/80 to-[#0d1618]/80 backdrop-blur-sm border border-white/[0.08] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
                  <h3 className="text-sm font-semibold text-white">Caixa de ofertas</h3>
                  <span className="text-xs text-white/35">{gameEngine.transferOffers.length} total</span>
                </div>

                {pendingReceivedOffers.length === 0 && pastReceivedOffers.length === 0 ? (
                  <div className="flex h-[calc(100%-57px)] flex-col items-center justify-center p-8 text-center">
                    <ArrowLeftRight className="mb-4 h-12 w-12 text-white/20" />
                    <p className="text-white/60">Voce nao recebeu nenhuma proposta.</p>
                    <p className="mt-2 text-sm text-white/40">Avance semanas ou use Atualizar interesse para simular movimentacao do mercado.</p>
                  </div>
                ) : (
                  <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-4 scrollbar-thin">
                    {pendingReceivedOffers.length > 0 && (
                      <div className="space-y-3">
                        {pendingReceivedOffers.map((offer) => (
                          <ReceivedOfferCard
                            key={offer.id}
                            offer={offer}
                            currentWeek={gameEngine.currentWeek}
                            player={gameEngine.squadPlayers.find((item) => item.id === offer.playerId)}
                            onAccept={() => gameEngine.respondToOffer(offer.id, true)}
                            onReject={() => gameEngine.respondToOffer(offer.id, false)}
                            onCounter={(amount,coverage,weeks)=>gameEngine.counterTransferOffer(offer.id,amount,coverage,weeks)}
                          />
                        ))}
                      </div>
                    )}

                    {pastReceivedOffers.length > 0 && (
                      <div className={cn("space-y-2", pendingReceivedOffers.length > 0 && "mt-5 border-t border-white/[0.04] pt-4")}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Historico</p>
                        {pastReceivedOffers.map((offer) => (
                          <PastReceivedOfferRow key={offer.id} offer={offer} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="fixed bottom-0 left-0 md:left-16 right-0 bg-gradient-to-t from-[#050508] via-[#050508]/95 to-transparent py-4 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 rounded px-2 py-1 text-white/60">Esc</span>
                    <span className="text-white/60 text-sm">Voltar</span>
                  </div>
                </div>
                <TeamCrest team={userTeam} size="sm" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <NegotiationModal
        open={negotiationOpen}
        onOpenChange={setNegotiationOpen}
        player={selectedPlayer}
        type={negotiationType}
        team={userTeam}
        onConfirm={(fee, salarioSemanal) => {
          if (!selectedPlayer) return
          const divisaoUsuario = String(careerState.divisionOverride ?? userTeam.divisao ?? "serie_a")
          const enginePlayer = marketPlayerToEnginePlayer(selectedPlayer, divisaoUsuario, salarioSemanal)
          if (negotiationType === "loan") {
            const result = gameEngine.loanPlayer(enginePlayer, 26, Math.round(fee / 26))
            // Empréstimo tira o atleta do clube de origem durante o vínculo, senão
            // ele jogaria contra você defendendo o próprio time enquanto está no seu.
            if ((result === "joined" || result === "pending") && selectedPlayer.team?.nome) {
              markDeparted(selectedPlayer.team.nome, selectedPlayer.name)
            }
            setMarketNotice(result === "pending"
              ? `${selectedPlayer.name} assinou e será registrado na semana ${nextTransferWindowWeek(gameEngine.currentWeek)}.`
              : result === "joined" ? `${selectedPlayer.name} chegou por emprestimo.` : "Não foi possível concluir o empréstimo.")
          } else {
            // DIVIDA: a compra respeita o teto por endividamento e o congelamento
            // por inadimplencia. Antes o limite so era exibido em /financas — nada
            // barrava a compra, e atrasar parcela nao tinha consequencia.
            const permissao = canAffordTransfer(careerState.debt, gameEngine.balance, fee)
            if (!permissao.ok) {
              setMarketNotice(permissao.reason === "frozen"
                ? "Mercado congelado: a diretoria suspendeu as contratações por causa das parcelas da dívida em atraso. Regularize as finanças primeiro."
                : "A dívida do clube reduz o teto de gastos com transferências. Esta oferta ultrapassa o limite atual — quite parte da dívida ou reduza o valor.")
              setActiveTab("enviadas")
              return
            }
            if (gameEngine.balance < fee) {
              setMarketNotice("Saldo insuficiente para concluir esta transferencia.")
              setActiveTab("enviadas")
              return
            }
            const isFreeAgent = !selectedPlayer.team
            const transferResult = gameEngine.buyPlayer(enginePlayer, fee, isFreeAgent)
            if (transferResult === "wage_budget") {
              setMarketNotice(
                "A diretoria vetou: o salário deste atleta estoura o teto da folha. Libere espaço vendendo, rescindindo ou renegociando contratos.",
              )
              return
            }
            if (transferResult === "failed") {
              setMarketNotice("A contratação não foi concluída ou o atleta já pertence ao plantel.")
              setActiveTab("enviadas")
              return
            }
            // Sucesso (joined ou pending): o atleta sai do clube de origem, para
            // nao aparecer mais no elenco dele (relato do Neymar no Santos).
            if (selectedPlayer.team?.nome) markDeparted(selectedPlayer.team.nome, selectedPlayer.name)
            // Mantem tambem o save da carreira sincronizado. Base/transferencias ainda
            // consultam este resumo, enquanto elenco/radar usam o game-engine completo.
            if (transferResult === "joined" && !(careerState.squadPlayers ?? []).some(player => player.name.toLocaleLowerCase("pt-BR") === selectedPlayer.name.toLocaleLowerCase("pt-BR"))) {
              setCareerState({
                squadPlayers: [...(careerState.squadPlayers ?? []), {
                  id: `transfer_${enginePlayer.id}_${Date.now()}`,
                  name: selectedPlayer.name,
                  position: selectedPlayer.position,
                  age: selectedPlayer.age,
                  overall: selectedPlayer.overall,
                  potential: selectedPlayer.potential,
                  value: selectedPlayer.value,
                  pace: enginePlayer.pace,
                  shooting: enginePlayer.shooting,
                  passing: enginePlayer.passing,
                  dribbling: enginePlayer.dribbling,
                  defending: enginePlayer.defending,
                  physical: enginePlayer.physical,
                  fromTeam: selectedPlayer.team?.nome,
                  seasonSigned: careerState.season,
                }],
              })
            }
            setMarketNotice(transferResult === "pending"
              ? `${selectedPlayer.name} foi contratado por ${formatCurrency(fee)} e será registrado na semana ${nextTransferWindowWeek(gameEngine.currentWeek)}.`
              : `${selectedPlayer.name} foi contratado por ${formatCurrency(fee)} e já está no elenco.`)
          }
          setActiveTab("enviadas")
        }}
        onNegotiationResult={handleNegotiationResult}
      />
    </div>
  )
}

function ReceivedOfferCard({
  offer,
  currentWeek,
  player,
  onAccept,
  onReject,
  onCounter,
}: {
  offer: TransferOffer
  currentWeek: number
  player?: EnginePlayer
  onAccept: () => void
  onReject: () => void
  onCounter:(amount:number,coverage?:number,weeks?:number)=>"accepted"|"revised"|"rejected"
}) {
  const expiresIn = Math.max(0, offer.expiresWeek - currentWeek)
  const belowMarket = player && offer.offerType === "compra" && offer.offerAmount < player.marketValue
  const [counterOpen,setCounterOpen]=useState(false)
  const [counterAmount,setCounterAmount]=useState(offer.offerAmount)
  const [coverage,setCoverage]=useState(offer.wageCoverage??100)
  const [loanWeeks,setLoanWeeks]=useState(offer.loanWeeks??26)

  return (
    <div className="rounded-xl bg-[#0c0c10]/85 border border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{offer.fromTeam}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/45">
            {offer.offerType === "emprestimo" ? "Emprestimo" : "Compra"} por {offer.playerName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-[#00ffc8]">{formatCurrency(offer.offerAmount)}</p>
          <p className="text-[10px] text-white/40">Expira em {expiresIn} sem.</p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{offer.playerName}</p>
            <p className="text-xs text-white/45">
              {player ? `${player.position} - ${player.age} anos - OVR ${player.overall}` : "Jogador nao encontrado no elenco"}
            </p>
          </div>
          {player && (
            <div className="text-right">
              <p className="text-xs text-white/35">Valor mercado</p>
              <p className="text-sm font-semibold text-white">{formatCurrency(player.marketValue)}</p>
            </div>
          )}
        </div>

        {offer.offerType === "emprestimo" && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-white/[0.03] p-3">
            <div>
              <p className="text-[10px] uppercase text-white/35">Duracao</p>
              <p className="text-sm font-semibold text-white">{offer.loanWeeks ?? 0} semanas</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/35">Salario coberto</p>
              <p className="text-sm font-semibold text-white">{offer.wageCoverage ?? 0}%</p>
            </div>
          </div>
        )}

        {belowMarket && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertCircle className="h-4 w-4" />
            Oferta abaixo do valor de mercado.
          </div>
        )}

        {offer.counterMessage&&<div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{offer.counterMessage}</div>}
        {counterOpen&&<div className="mt-3 grid gap-2 rounded-lg bg-black/30 p-3 sm:grid-cols-3"><label className="text-[10px] uppercase text-white/45">Valor solicitado<input type="number" min={0} step={100000} value={counterAmount} onChange={e=>setCounterAmount(Number(e.target.value))} className="mt-1 w-full rounded bg-white/10 p-2 text-sm text-white"/></label>{offer.offerType==="emprestimo"&&<><label className="text-[10px] uppercase text-white/45">Salário coberto %<input type="number" min={0} max={100} value={coverage} onChange={e=>setCoverage(Number(e.target.value))} className="mt-1 w-full rounded bg-white/10 p-2 text-sm text-white"/></label><label className="text-[10px] uppercase text-white/45">Semanas<input type="number" min={4} value={loanWeeks} onChange={e=>setLoanWeeks(Number(e.target.value))} className="mt-1 w-full rounded bg-white/10 p-2 text-sm text-white"/></label></>}</div>}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20"
          >
            <X className="h-4 w-4" />
            Recusar
          </button>
          <button type="button" onClick={()=>{if(!counterOpen){setCounterAmount(Math.max(offer.offerAmount,player?.marketValue??offer.offerAmount));setCounterOpen(true)}else{onCounter(counterAmount,coverage,loanWeeks);setCounterOpen(false)}}} className="inline-flex items-center justify-center rounded-lg bg-amber-400/10 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-400/20">{counterOpen?"Enviar":"Contraproposta"}</button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!player}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00ffc8] py-2.5 text-sm font-semibold text-black hover:bg-[#00c8ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}

function PastReceivedOfferRow({ offer }: { offer: TransferOffer }) {
  const statusLabel = offer.status === "aceita" ? "Aceita" : offer.status === "rejeitada" ? "Rejeitada" : "Expirada"
  const statusClass =
    offer.status === "aceita"
      ? "text-[#00ffc8] bg-[#00ffc8]/10"
      : offer.status === "rejeitada"
        ? "text-red-300 bg-red-500/10"
        : "text-[#ffd700] bg-[#ffd700]/10"

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5">
      <div className={cn("rounded px-2 py-1 text-[10px] font-semibold uppercase", statusClass)}>
        {statusLabel}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{offer.playerName}</p>
        <p className="text-xs text-white/40">{offer.fromTeam}</p>
      </div>
      <p className="text-sm font-semibold text-white">{formatCurrency(offer.offerAmount)}</p>
    </div>
  )
}

// Filter Card Component
function FilterCardComponent({ 
  card, 
  selected, 
  onClick, 
  customContent,
  highlight = false 
}: { 
  card: FilterCard
  selected: boolean
  onClick: () => void
  customContent?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
      className={cn(
        "relative rounded-xl p-4 h-44 text-left transition-all overflow-hidden",
        "bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618]",
        selected 
          ? "ring-2 ring-primary shadow-lg shadow-primary/30" 
          : "border border-white/[0.04] hover:border-primary/30",
        highlight && "opacity-70"
      )}
    >
      {/* Subtle glow effect when selected */}
      {selected && (
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
      )}
      <h3 className={cn(
        "text-sm font-semibold relative z-10",
        highlight ? "text-white/50" : "text-white"
      )}>
        {card.label}
      </h3>
      <div className="relative z-10 h-[calc(100%-2rem)]">
        {customContent}
      </div>
    </div>
  )
}

// Card de filtro com DROPDOWN de valores reais (Nacionalidade/Pais/Liga/Time/Status).
// Substitui os cards antes decorativos: clicar abre a lista; escolher aplica o filtro.
function FilterDropdownCard({
  label,
  icon,
  value,
  options,
  groups,
  onSelect,
  leagueLogo,
}: {
  label: string
  icon: React.ReactNode
  value: string
  options: string[]
  groups?: Array<{ label: string; options: string[] }>
  onSelect: (v: string) => void
  /** Logo a exibir no lugar do icone (usado pela Liga). */
  leagueLogo?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  // Abre para CIMA quando nao ha espaco abaixo: os cards Liga/Pais/Time ficam na
  // fileira de baixo e o dropdown (max-h-64 = 256px) era cortado pelo rodape/
  // container (relato: filtros de liga/pais cortados).
  const toggle = () => {
    setOpen(o => {
      if (!o && ref.current) {
        const r = ref.current.getBoundingClientRect()
        setDropUp(window.innerHeight - r.bottom < 280 && r.top > 280)
      }
      return !o
    })
  }
  const active = value !== "Qualquer" && value !== "Tudo"
  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className={cn(
          "relative w-full rounded-xl p-4 h-44 text-left transition-all overflow-hidden",
          "bg-gradient-to-br from-[#1c2b2f] via-[#162224] to-[#0d1618]",
          active || open
            ? "ring-2 ring-primary shadow-lg shadow-primary/30"
            : "border border-white/[0.04] hover:border-primary/30",
        )}
      >
        <h3 className="text-sm font-semibold text-white relative z-10">{label}</h3>
        <div className="relative z-10 flex h-[calc(100%-2rem)] flex-col items-center justify-center gap-3">
          {/* Logo da liga selecionada substitui o icone generico quando ha uma. */}
          {leagueLogo ? (
            <div className="relative h-12 w-12">
              <Image src={leagueLogo} alt={value} fill className="object-contain" sizes="48px" />
            </div>
          ) : icon}
          <span className={cn("text-sm font-medium text-center px-2 truncate max-w-full", active ? "text-[#00ffc8]" : "text-white/50")}>
            {value}
          </span>
        </div>
      </button>

      {open && (
        <div className={cn(
          "absolute left-0 right-0 z-40 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0c0c12] shadow-2xl scrollbar-thin",
          dropUp ? "bottom-full mb-1" : "top-full mt-1",
        )}>
          {!groups && options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onSelect(opt); setOpen(false) }}
              className={cn(
                "block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/10",
                opt === value ? "bg-primary/15 text-[#00ffc8] font-semibold" : "text-white/70",
              )}
            >
              {opt}
            </button>
          ))}
          {groups && (
            <>
              <button
                type="button"
                onClick={() => { onSelect("Qualquer"); setOpen(false) }}
                className={cn(
                  "block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/10",
                  value === "Qualquer" ? "bg-primary/15 text-[#00ffc8] font-semibold" : "text-white/70",
                )}
              >
                Qualquer
              </button>
              {groups.map((group) => (
                <div key={group.label} className="border-t border-white/[0.06] py-1">
                  <p className="sticky top-0 bg-[#0c0c12] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#00ffc8]/80">
                    {group.label}
                  </p>
                  {group.options.map((opt) => (
                    <button
                      key={`${group.label}:${opt}`}
                      type="button"
                      onClick={() => { onSelect(opt); setOpen(false) }}
                      className={cn(
                        "block w-full px-5 py-2 text-left text-sm transition-colors hover:bg-white/10",
                        opt === value ? "bg-primary/15 text-[#00ffc8] font-semibold" : "text-white/70",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Player List Card Component
function PlayerListCard({
  player,
  selected,
  onClick,
  detailed = false,
}: {
  player: Player
  selected: boolean
  onClick: () => void
  /** Modo "Detalhes": mostra overall, valor e clube direto na linha. */
  detailed?: boolean
}) {
  const isNew = player.scoutProgress && player.scoutProgress < 100

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 p-3 rounded-lg transition-all text-left",
        "bg-[#1a1a1a]/80",
        selected 
          ? "ring-2 ring-primary" 
          : "border border-white/[0.04] hover:border-white/10"
      )}
    >
      {/* Alert indicator */}
      {isNew && (
        <AlertCircle className="absolute -top-1 -left-1 h-4 w-4 text-[#ffd700]" />
      )}

      {/* Player Avatar */}
      <div className="relative">
        <PlayerAvatar name={player.name} teamColor={player.team.cor1} size="sm" />
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Era "BR" FIXO para todo atleta — um uruguaio do Peñarol aparecia
              brasileiro. Nacionalidade INFERIDA do país do clube (o banco não
              traz a real; ver lib/country-normalize.ts). */}
          {/* player.nationality e a nacionalidade REAL (Transfermarkt) quando existe.
              Este card ignorava o campo e inferia sempre pelo pais do CLUBE, entao
              todo estrangeiro aparecia com a bandeira errada — um paraguaio no Sao
              Paulo saia como brasileiro. O pais do clube fica so como ultimo
              recurso, para quem ainda nao tem dado real. */}
          {(() => {
            const nac = player.nationality || inferredNationality(player.team.pais)
            return (
              <div className="h-3 min-w-4 rounded-sm bg-white/15 px-0.5 flex items-center justify-center" title={nac}>
                <span className="text-[8px] text-white font-bold">
                  {nac.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase()}
                </span>
              </div>
            )
          })()}
          <span className="text-[10px] text-white/50 uppercase">{player.name.split(" ")[0]}</span>
        </div>
        <div className="font-bold text-white text-sm truncate">{player.name.split(" ").slice(-1)[0].toUpperCase()}</div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span>Idade {player.age}</span>
          <span>|</span>
          <span>{player.position}</span>
        </div>
        {detailed && (
          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/45">
            <span className="truncate">{player.team.nome}</span>
            <span>|</span>
            <span className="whitespace-nowrap">{formatCurrency(player.value)}</span>
          </div>
        )}
      </div>

      {/* Team Crest */}
      <div className="flex flex-col items-end gap-1">
        {detailed && <span className="text-sm font-black text-white">{player.overall}</span>}
        <TeamCrest team={player.team} size="xs" />
        {selected && (
          <div className="flex items-center justify-center w-5 h-5 rounded border border-white/20 text-[10px] text-white/50">
            Enter
          </div>
        )}
      </div>
    </button>
  )
}

// Player Details Panel Component
function PlayerDetailsPanel({ player, onNegotiate, onPrev, onNext, indice = -1, total = 0, irPara }: { player: Player, onNegotiate: (type: "buy" | "loan") => void, onPrev?: () => void, onNext?: () => void, indice?: number, total?: number, irPara?: (i: number) => void }) {
  const t = useTranslation()
  const isNew = player.scoutProgress && player.scoutProgress < 100
  const isNotScouted = !player.scoutedBy

  return (
    <div className="rounded-xl bg-[#0c0c10]/75 backdrop-blur-sm border border-white/[0.06] overflow-hidden">
      {/* Header — gradiente com a cor do time, no tratamento visual aprovado. */}
      <div
        className="p-4 border-b border-white/[0.04]"
        style={{ background: `linear-gradient(135deg, ${player.team.cor1}22, transparent 62%)` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isNew && <AlertCircle className="h-4 w-4 text-[#ffd700]" />}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              {isNew ? "NOVO" : isNotScouted ? "NAO OBSERVADO" : "OBSERVADO"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNegotiate("buy")}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t.market.buy}
            </button>
            <button
              onClick={() => onNegotiate("loan")}
              className="px-4 py-1.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
            >
              {t.market.loan}
            </button>
          </div>
        </div>
      </div>

      {/* Player Info */}
      <div className="p-6">
        <div className="flex gap-6">
          {/* Left side - Avatar and basic info */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <PlayerAvatar name={player.name} teamColor={player.team.cor1} size="xl" />
              <TeamCrest team={player.team} size="md" className="absolute -bottom-2 -right-2" />
            </div>
          </div>

          {/* Right side - Details */}
          <div className="flex-1">
            {/* Position badges */}
            <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
              <span>?</span>
              <span>|</span>
              <span className="font-medium text-white">{player.position}</span>
              {player.secondaryPositions?.map(pos => (
                <span key={pos} className="text-white/40">{pos}</span>
              ))}
            </div>

            {/* Name */}
            <div className="text-xs text-white/50 uppercase">{player.name.split(" ")[0]}</div>
            <h2 className="text-2xl font-bold text-white tracking-wide">{player.name.split(" ").slice(-1)[0].toUpperCase()}</h2>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 text-sm">
              <div>
                <span className="text-white/50">Potencial</span>
                <div className="flex items-center gap-1">
                  <span className="text-primary font-bold">{player.overall}</span>
                  <span className="text-white/30">-</span>
                  <span className="text-primary font-bold">{player.potential}</span>
                </div>
              </div>
              <div>
                <span className="text-white/50">Idade</span>
                <div className="text-white font-bold">{player.age}</div>
              </div>
              <div>
                <span className="text-white/50">Altura e peso</span>
                <div className="text-white font-bold">{player.height}/{player.weight?.replace(" kg", "kg")}</div>
              </div>
              <div>
                <span className="text-white/50">Perna boa</span>
                <div className="text-white font-bold">{player.foot}</div>
              </div>
            </div>

            {/* Scouted by */}
            {player.scoutedBy && (
              <div className="text-xs text-white/40 mt-3">
                Encontrado por {player.scoutedBy}
              </div>
            )}
          </div>

          {/* Team badge on right */}
          <div className="flex flex-col items-center">
            <TeamCrest team={player.team} size="lg" />
            <span className="text-white/50 text-xs mt-1">{player.team.curto}</span>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          {/* Left stats */}
          <div>
            <h4 className="text-white/50 text-xs font-medium mb-3">Resumo</h4>
            <div className="space-y-2">
              {[
                { label: "Ritmo", value: player.stats.pace, potential: player.stats.pace + 8 },
                { label: "Finalizacao", value: player.stats.shooting, potential: player.stats.shooting + 10 },
                { label: "Passe", value: player.stats.passing, potential: player.stats.passing + 11 },
                { label: "Conducao", value: player.stats.dribbling, potential: player.stats.dribbling + 10 },
                { label: "Defesa", value: player.stats.defense, potential: player.stats.defense + 10 },
                { label: "Fisico", value: player.stats.physical, potential: player.stats.physical + 10 },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">{stat.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-primary font-medium">{stat.value}</span>
                    <span className="text-white/30">-</span>
                    <span className="text-primary font-medium">{stat.potential}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Scout status */}
          <div>
            <div className="rounded-lg bg-[#1a1a1a] p-4">
              <h4 className="text-white font-semibold mb-2">
                {isNotScouted ? "Sem observar" : "Observando"}
              </h4>
              <p className="text-white/50 text-sm">
                {isNotScouted 
                  ? `${player.name.split(" ").slice(-1)[0]} nao esta sendo observado no momento.`
                  : `${player.name.split(" ").slice(-1)[0]} esta sendo observado.`
                }
              </p>
              
              {/* Scout progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/50">Estado do relatorio</span>
                  <span className="text-white">{player.scoutProgress || 0}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/40 rounded-full transition-all"
                    style={{ width: `${player.scoutProgress || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Finances */}
            <div className="mt-4">
              <h4 className="text-white/50 text-xs font-medium mb-2">Financas</h4>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Multa rescisoria</span>
                <span className="text-white font-medium">{formatCurrency(player.releaseClause ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navegacao entre os atletas da pagina.
            Antes: a palavra "Num" e cinco bolinhas FIXAS, com a primeira sempre
            acesa — nao diziam em que atleta voce estava nem quantos havia. Agora
            mostra a posicao real e as bolinhas acompanham (e levam) a selecao. */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/[0.04]">
          <button
            onClick={onPrev}
            disabled={!onPrev}
            title="Atleta anterior"
            className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-xs tabular-nums text-white/50">
            {indice >= 0 ? `${indice + 1} de ${total}` : "-"}
          </span>

          <button
            onClick={onNext}
            disabled={!onNext}
            title="Proximo atleta"
            className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Janela de ate 7 pontos centrada na selecao: com 100 atletas na
              pagina, desenhar um ponto por atleta viraria uma tira ilegivel. */}
          {indice >= 0 && total > 1 && (
            <div className="ml-1 flex items-center gap-1">
              {(() => {
                const MAX = 7
                const inicio = Math.max(0, Math.min(indice - Math.floor(MAX / 2), total - MAX))
                return Array.from({ length: Math.min(MAX, total) }, (_, k) => inicio + k).map(i => (
                  <button
                    key={i}
                    onClick={() => irPara?.(i)}
                    title={`Atleta ${i + 1}`}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === indice ? "w-5 bg-white" : "w-2 bg-white/25 hover:bg-white/50",
                    )}
                  />
                ))
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Legacy scout card kept for visual experiments.
function _ScoutCard({ scout, selected }: { scout: { name: string; nationality: string; area: string; assigned: number; stars: number }, selected: boolean }) {
  return (
    <div className={cn(
      "rounded-xl p-6 text-center transition-all",
      "bg-gradient-to-br from-[#1a1a1a] to-[#141414]",
      selected 
        ? "ring-2 ring-primary" 
        : "border border-white/[0.04] hover:border-white/10"
    )}>
      {/* Flag */}
      <div className="flex justify-center mb-3">
        <Flag className="h-7 w-7 text-white/40" />
      </div>

      {/* Name */}
      <div className="text-white font-bold text-lg uppercase tracking-wide">
        {scout.name.split(" ")[0]}
      </div>
      <div className="text-white font-bold text-lg uppercase tracking-wide">
        {scout.name.split(" ").slice(1).join(" ")}
      </div>

      {/* Area */}
      <div className="text-white/50 text-sm mt-2">{scout.area}</div>

      {/* Assigned */}
      {scout.assigned > 0 && (
        <div className="flex items-center justify-center gap-2 mt-2 text-white/60">
          <User className="h-4 w-4" />
          <span>{scout.assigned}</span>
        </div>
      )}

      {/* Arrow for available scouts */}
      {scout.area === "Scout Available" && (
        <div className="mt-2">
          <div className="w-8 h-8 mx-auto rounded-full border border-white/20 flex items-center justify-center">
            <ChevronRight className="h-4 w-4 text-white/40" />
          </div>
        </div>
      )}

      {/* Stars */}
      <div className="flex items-center justify-center gap-1 mt-3">
        <span className="text-white/50 text-xs">Judgement:</span>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star 
            key={i} 
            className={cn(
              "h-3 w-3",
              i < scout.stars ? "text-[#ffd700] fill-yellow-500" : "text-white/20"
            )} 
          />
        ))}
      </div>
    </div>
  )
}
