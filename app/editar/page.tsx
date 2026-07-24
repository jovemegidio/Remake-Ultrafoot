"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Search,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  MapPin,
  Plus,
  Shuffle,
  Pencil,
  Trash2,
  Users,
  Shield,
  Upload,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  getCamisaUrl,
  type Team
} from "@/lib/teams-data"
import { allInternationalTeams } from "@/lib/international-teams"
import { TeamCrest, setCustomLogoUrl, getCustomLogoUrl, removeCustomLogoUrl } from "@/components/team-crest"
import { isTauri } from "@/lib/game-asset"
import {
  getTeamOverride,
  setTeamOverride,
  clearTeamOverride,
  type TeamOverride,
  type KitPattern,
} from "@/lib/team-overrides"
import { initPersistentStore } from "@/lib/persistent-store"

const DIV_LABEL: Record<string, string> = {
  serie_a: "Série A", serie_b: "Série B", serie_c: "Série C", serie_d: "Série D",
  premier_league: "Premier League", championship: "Championship",
  la_liga: "La Liga", la_liga_2: "La Liga 2",
  serie_a_ita: "Serie A", serie_b_ita: "Serie B",
  bundesliga: "Bundesliga", bundesliga_2: "2. Bundesliga",
  ligue_1: "Ligue 1", ligue_2: "Ligue 2",
  primeira_liga: "Primeira Liga", eredivisie: "Eredivisie",
  scottish_prem: "Scottish Prem", super_lig: "Süper Lig",
  pro_league_bel: "Pro League", russian_prem: "Liga Russa",
  mls: "MLS", liga_mx: "Liga MX",
  liga_argentina: "Liga Argentina", primeira_a_col: "Primera A",
  primera_div_chi: "Primera Div", primera_div_ury: "Primera Div",
  saudi_pro: "Saudi Pro", saudi_first_div: "Saudi 1ª Div",
  j_league: "J-League", k_league_1: "K-League 1", chinese_super: "Super League",
}

const DIV_COUNTRY: Record<string, string> = {
  serie_a: "BRA", serie_b: "BRA", serie_c: "BRA", serie_d: "BRA",
  premier_league: "ENG", championship: "ENG",
  la_liga: "ESP", la_liga_2: "ESP",
  serie_a_ita: "ITA", serie_b_ita: "ITA",
  bundesliga: "GER", bundesliga_2: "GER",
  ligue_1: "FRA", ligue_2: "FRA",
  primeira_liga: "POR", eredivisie: "NED",
  scottish_prem: "SCO", super_lig: "TUR",
  pro_league_bel: "BEL", russian_prem: "RUS",
  mls: "USA", liga_mx: "MEX",
  liga_argentina: "ARG", primeira_a_col: "COL",
  primera_div_chi: "CHI", primera_div_ury: "URU",
  saudi_pro: "KSA", saudi_first_div: "KSA",
  j_league: "JPN", k_league_1: "KOR", chinese_super: "CHN",
}

// Nome do país (PT-BR) por código, para os cabeçalhos de grupo do editor.
const COUNTRY_NAME: Record<string, string> = {
  BRA: "Brasil", ENG: "Inglaterra", ESP: "Espanha", ITA: "Itália",
  GER: "Alemanha", FRA: "França", POR: "Portugal", NED: "Holanda",
  SCO: "Escócia", TUR: "Turquia", BEL: "Bélgica", RUS: "Rússia",
  USA: "Estados Unidos", MEX: "México", ARG: "Argentina", COL: "Colômbia",
  CHI: "Chile", URU: "Uruguai", KSA: "Arábia Saudita", JPN: "Japão",
  KOR: "Coreia do Sul", CHN: "China", INT: "Internacional",
}

// Sigla do estado -> nome completo, usado para os subgrupos (estaduais) do Brasil.
const ESTADO_LABEL: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
}

const formatDivisao = (div: string) =>
  DIV_LABEL[div] ?? div.replace(/_/g, " ").toUpperCase()

const countryCodeOf = (team: Team) => DIV_COUNTRY[team.divisao] ?? "INT"

// Segundo nível de agrupamento: por estado (Brasil) ou por liga (internacional).
const subGroupOf = (team: Team): { key: string; label: string } =>
  countryCodeOf(team) === "BRA"
    ? { key: `BRA|${team.estado}`, label: ESTADO_LABEL[team.estado] ?? team.estado }
    : { key: `${countryCodeOf(team)}|${team.divisao}`, label: formatDivisao(team.divisao) }

// Mock players data generator based on team - completamente deterministico (sem Math.random)
const generatePlayersForTeam = () => {
  const playerData = [
    { pos: "GOL", pais: "BRA", idade: 31, ovr: 75, carac: "Reflexos", lado: "D" },
    { pos: "GOL", pais: "BRA", idade: 21, ovr: 60, carac: "Reflexos", lado: "E" },
    { pos: "GOL", pais: "BRA", idade: 19, ovr: 88, carac: "Reflexos", lado: "A" },
    { pos: "GOL", pais: "ARG", idade: 20, ovr: 65, carac: "Reflexos", lado: "D" },
    { pos: "LAT", pais: "BRA", idade: 28, ovr: 85, carac: "Velocidade", lado: "D" },
    { pos: "LAT", pais: "BRA", idade: 27, ovr: 70, carac: "Velocidade", lado: "E" },
    { pos: "LAT", pais: "URU", idade: 23, ovr: 55, carac: "Marcacao", lado: "D" },
    { pos: "LAT", pais: "BRA", idade: 35, ovr: 57, carac: "Passe", lado: "E" },
    { pos: "ZAG", pais: "BRA", idade: 27, ovr: 75, carac: "Marcacao", lado: "D" },
    { pos: "ZAG", pais: "BRA", idade: 31, ovr: 62, carac: "Cabecada", lado: "E" },
    { pos: "ZAG", pais: "ARG", idade: 30, ovr: 80, carac: "Marcacao", lado: "A" },
    { pos: "ZAG", pais: "COL", idade: 31, ovr: 75, carac: "Cabecada", lado: "D" },
    { pos: "VOL", pais: "BRA", idade: 33, ovr: 60, carac: "Marcacao", lado: "E" },
    { pos: "VOL", pais: "BRA", idade: 19, ovr: 83, carac: "Passe", lado: "A" },
    { pos: "VOL", pais: "CHI", idade: 27, ovr: 80, carac: "Marcacao", lado: "D" },
    { pos: "VOL", pais: "PAR", idade: 23, ovr: 65, carac: "Passe", lado: "E" },
    { pos: "MEI", pais: "BRA", idade: 26, ovr: 70, carac: "Drible", lado: "A" },
    { pos: "MEI", pais: "BRA", idade: 35, ovr: 55, carac: "Passe", lado: "D" },
    { pos: "MEI", pais: "ARG", idade: 29, ovr: 57, carac: "Finalizacao", lado: "E" },
    { pos: "MEI", pais: "BRA", idade: 27, ovr: 75, carac: "Drible", lado: "A" },
    { pos: "ATA", pais: "BRA", idade: 22, ovr: 60, carac: "Finalizacao", lado: "D" },
    { pos: "ATA", pais: "COL", idade: 30, ovr: 59, carac: "Velocidade", lado: "E" },
  ]

  const names = [
    "Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Ferreira",
    "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araujo", "Ribeiro", "Martins",
    "Gomes", "Barbosa", "Moreira", "Fernandez", "Gonzalez", "Rodriguez", "Martinez"
  ]

  const firstNames = [
    "Lucas", "Gabriel", "Rafael", "Bruno", "Matheus", "Felipe", "Gustavo", "Pedro",
    "Thiago", "Marcos", "Andre", "Carlos", "Diego", "Eduardo", "Fernando", "Henrique",
    "Paulo", "Ricardo", "Sergio", "Victor", "William", "Yago"
  ]

  return playerData.map((data, i) => ({
    id: i + 1,
    nome: `${firstNames[i]} ${names[i]}`,
    posicao: data.pos,
    pais: data.pais,
    idade: data.idade,
    overall: data.ovr,
    caracteristica: data.carac,
    lado: data.lado
  }))
}

// All teams combined (brasileiros + internacionais)
const allTeams = [...serieATeams, ...serieBTeams, ...serieCTeams, ...serieDTeams, ...allInternationalTeams]

const POS_STYLE: Record<string, { text: string; bg: string }> = {
  GOL: { text: "text-amber-300",  bg: "bg-amber-400/10 border-amber-400/25" },
  LAT: { text: "text-cyan-300",   bg: "bg-cyan-400/10 border-cyan-400/25" },
  ZAG: { text: "text-blue-300",   bg: "bg-blue-400/10 border-blue-400/25" },
  VOL: { text: "text-emerald-300",bg: "bg-emerald-400/10 border-emerald-400/25" },
  MEI: { text: "text-green-300",  bg: "bg-green-400/10 border-green-400/25" },
  ATA: { text: "text-rose-300",   bg: "bg-rose-400/10 border-rose-400/25" },
}

type PlayerRow = ReturnType<typeof generatePlayersForTeam>[number]

const POSICOES = ["GOL", "LAT", "ZAG", "VOL", "MEI", "ATA"] as const
const LADOS: { value: string; label: string }[] = [
  { value: "D", label: "Direito" },
  { value: "E", label: "Esquerdo" },
  { value: "A", label: "Ambos" },
]
const CARACTERISTICAS = [
  "Reflexos", "Velocidade", "Marcacao", "Cabecada", "Passe", "Drible", "Finalizacao",
]

export default function EditarPage() {
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === "B") hardNavigate("/splash?menu=1")
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [])

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(allTeams[0])
  const [searchTeam, setSearchTeam] = useState("")
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<"principal" | "juniores" | "dados">("principal")
  const [kitErrors, setKitErrors] = useState<Record<string, boolean>>({})
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [players, setPlayers] = useState(() => generatePlayersForTeam())
  const [hasCustomLogo, setHasCustomLogo] = useState(false)
  const [storeReady, setStoreReady] = useState(false)

  // Edit draft state
  const [editDraft, setEditDraft] = useState<TeamOverride>({})
  const [editSaved, setEditSaved] = useState(false)

  // Modal: editar clube
  const [showClubModal, setShowClubModal] = useState(false)

  // Modal: editar / adicionar jogador
  const [playerDraft, setPlayerDraft] = useState<PlayerRow | null>(null)
  const [isNewPlayer, setIsNewPlayer] = useState(false)

  const initDraft = (team: Team) => {
    const override = getTeamOverride(team.file_key) ?? {}
    setEditDraft({
      nome: override.nome ?? team.nome,
      curto: override.curto ?? team.curto,
      cor1: override.cor1 ?? team.cor1,
      cor2: override.cor2 ?? team.cor2,
      prestigio: override.prestigio ?? team.prestigio,
      estadio_nome: override.estadio_nome ?? team.estadio_nome,
      estadio_cap: override.estadio_cap ?? team.estadio_cap,
      patrocinador: override.patrocinador ?? (team.patrocinador ?? ""),
      kits: override.kits ?? {
        home: { primary: team.cor1, secondary: team.cor2, pattern: "solid" },
        away: { primary: team.cor2, secondary: team.cor1, pattern: "solid" },
        third: { primary: "#1a1a2e", secondary: team.cor1, pattern: "diagonal" },
      },
    })
    setEditSaved(false)
  }

  const handleSaveOverride = () => {
    if (!selectedTeam) return
    setTeamOverride(selectedTeam.file_key, editDraft)
    setEditSaved(true)
    setTimeout(() => setEditSaved(false), 2000)
  }

  const handleResetOverride = () => {
    if (!selectedTeam) return
    clearTeamOverride(selectedTeam.file_key)
    initDraft(selectedTeam)
  }

  // ── Jogadores ──
  const openPlayerEditor = (index: number) => {
    const p = sortedPlayers[index]
    if (!p) return
    setPlayerDraft({ ...p })
    setIsNewPlayer(false)
  }

  const openNewPlayer = () => {
    setPlayerDraft({
      id: Date.now(),
      nome: "",
      posicao: "MEI",
      pais: "BRA",
      idade: 20,
      overall: 65,
      caracteristica: "Passe",
      lado: "D",
    })
    setIsNewPlayer(true)
  }

  const savePlayerDraft = () => {
    if (!playerDraft || !playerDraft.nome.trim()) return
    setPlayers(prev =>
      isNewPlayer
        ? [...prev, playerDraft]
        : prev.map(p => (p.id === playerDraft.id ? playerDraft : p)),
    )
    setPlayerDraft(null)
    setIsNewPlayer(false)
  }

  const removeSelectedPlayer = () => {
    const p = sortedPlayers[selectedPlayerIndex]
    if (!p) return
    setPlayers(prev => prev.filter(x => x.id !== p.id))
    setSelectedPlayerIndex(0)
  }

  const randomizeSelectedPlayer = () => {
    const p = sortedPlayers[selectedPlayerIndex]
    if (!p) return
    const rndOvr = 50 + Math.floor(Math.random() * 45)
    const rndCar = CARACTERISTICAS[Math.floor(Math.random() * CARACTERISTICAS.length)]
    setPlayers(prev => prev.map(x => (x.id === p.id ? { ...x, overall: rndOvr, caracteristica: rndCar } : x)))
  }

  const handleKitImageUpload = async (variant: "home" | "away" | "third") => {
    const processFile = (dataUrl: string) => {
      setEditDraft(prev => ({
        ...prev,
        kits: {
          ...prev.kits,
          [variant]: { ...(prev.kits?.[variant] ?? {}), imageUrl: dataUrl },
        },
      }))
      // Persiste o uniforme importado imediatamente (igual ao escudo), sem depender
      // do botao Salvar: passa a ser usado para este clube no jogo inteiro. Faz merge
      // apenas do kit no override ja gravado, sem tocar em edicoes ainda nao salvas.
      if (selectedTeam?.file_key) {
        const stored = getTeamOverride(selectedTeam.file_key) ?? {}
        setTeamOverride(selectedTeam.file_key, {
          ...stored,
          kits: {
            ...stored.kits,
            [variant]: { ...(stored.kits?.[variant] ?? {}), imageUrl: dataUrl },
          },
        })
        // Limpa eventual erro do thumbnail (o kit padrao pode ter dado 404 antes),
        // senao o cabecalho continuaria mostrando o SVG generico no lugar do import.
        setKitErrors(prev => {
          const next = { ...prev }
          delete next[`${selectedTeam.file_key}-${variant}`]
          return next
        })
      }
    }

    if (isTauri()) {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const { readFile } = await import("@tauri-apps/plugin-fs")
      const filePath = await open({ title: "Importar Camisa", filters: [{ name: "Imagem", extensions: ["png","jpg","jpeg","webp"] }] })
      if (!filePath) return
      const bytes = await readFile(filePath as string)
      const ext = (filePath as string).split(".").pop()?.toLowerCase() ?? "png"
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png"
      const base64 = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(""))
      processFile(`data:${mime};base64,${base64}`)
    } else {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/png,image/jpeg,image/webp"
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = e => { if (e.target?.result) processFile(e.target.result as string) }
        reader.readAsDataURL(file)
      }
      input.click()
    }
  }

  // Initialize the persistent store (loads data from disk into memory cache)
  useEffect(() => {
    initPersistentStore().then(() => setStoreReady(true))
  }, [])

  useEffect(() => {
    if (selectedTeam?.file_key) {
      setHasCustomLogo(!!getCustomLogoUrl(selectedTeam.file_key))
    }
  }, [selectedTeam, storeReady])

  const handleImportLogo = async () => {
    if (!selectedTeam?.file_key) return
    const fileKey = selectedTeam.file_key

    if (isTauri()) {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const { readFile } = await import("@tauri-apps/plugin-fs")
      const filePath = await open({
        title: "Importar Logo do Time",
        filters: [{ name: "Imagem", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }],
      })
      if (!filePath) return
      const bytes = await readFile(filePath as string)
      const ext = (filePath as string).split(".").pop()?.toLowerCase() ?? "png"
      const mime =
        ext === "svg" ? "image/svg+xml" :
        ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
        ext === "webp" ? "image/webp" : "image/png"
      const base64 = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(""))
      setCustomLogoUrl(fileKey, `data:${mime};base64,${base64}`)
      setHasCustomLogo(true)
    } else {
      // Fallback para navegador
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/png,image/jpeg,image/webp,image/svg+xml"
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          if (dataUrl) {
            setCustomLogoUrl(fileKey, dataUrl)
            setHasCustomLogo(true)
          }
        }
        reader.readAsDataURL(file)
      }
      input.click()
    }
  }

  const handleRemoveLogo = () => {
    if (!selectedTeam?.file_key) return
    removeCustomLogoUrl(selectedTeam.file_key)
    setHasCustomLogo(false)
  }

  useEffect(() => {
    if (selectedTeam) {
      setPlayers(generatePlayersForTeam())
      setSelectedPlayerIndex(0)
      setKitErrors({})
      initDraft(selectedTeam)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam, storeReady])

  const filteredTeams = useMemo(() => {
    if (!searchTeam) return allTeams
    return allTeams.filter(team =>
      team.nome.toLowerCase().includes(searchTeam.toLowerCase()) ||
      team.curto.toLowerCase().includes(searchTeam.toLowerCase())
    )
  }, [searchTeam])

  // Agrupa os times por País > (estados no Brasil / ligas no exterior).
  // Países e subgrupos são ordenados por prestígio (o mais forte primeiro),
  // com o Brasil sempre no topo.
  const groupedTeams = useMemo(() => {
    const byCountry = new Map<string, {
      code: string
      name: string
      subs: Map<string, { key: string; label: string; teams: Team[] }>
    }>()

    for (const team of filteredTeams) {
      const code = countryCodeOf(team)
      if (!byCountry.has(code)) {
        byCountry.set(code, { code, name: COUNTRY_NAME[code] ?? code, subs: new Map() })
      }
      const country = byCountry.get(code)!
      const sub = subGroupOf(team)
      if (!country.subs.has(sub.key)) {
        country.subs.set(sub.key, { key: sub.key, label: sub.label, teams: [] })
      }
      country.subs.get(sub.key)!.teams.push(team)
    }

    const maxPrestige = (teams: Team[]) => teams.reduce((m, t) => Math.max(m, t.prestigio), 0)

    return Array.from(byCountry.values())
      .map(country => {
        const subs = Array.from(country.subs.values())
          .map(sub => ({
            ...sub,
            teams: [...sub.teams].sort((a, b) => b.prestigio - a.prestigio || a.nome.localeCompare(b.nome)),
          }))
          .sort((a, b) => maxPrestige(b.teams) - maxPrestige(a.teams) || a.label.localeCompare(b.label))
        const count = subs.reduce((n, s) => n + s.teams.length, 0)
        const prestige = subs.reduce((m, s) => Math.max(m, maxPrestige(s.teams)), 0)
        return { ...country, subs, count, prestige }
      })
      .sort((a, b) => {
        if (a.code === "BRA") return -1
        if (b.code === "BRA") return 1
        return b.prestige - a.prestige || a.name.localeCompare(b.name)
      })
  }, [filteredTeams])

  const isSearching = searchTeam.trim().length > 0
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(() => new Set(["BRA"]))
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(() => new Set())

  // Mantém o grupo do time selecionado sempre aberto (ao trocar de time).
  useEffect(() => {
    if (!selectedTeam) return
    const code = countryCodeOf(selectedTeam)
    const sub = subGroupOf(selectedTeam)
    setExpandedCountries(prev => (prev.has(code) ? prev : new Set(prev).add(code)))
    setExpandedSubs(prev => (prev.has(sub.key) ? prev : new Set(prev).add(sub.key)))
  }, [selectedTeam])

  const toggleCountry = (code: string) =>
    setExpandedCountries(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })

  const toggleSub = (key: string) =>
    setExpandedSubs(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const sortedPlayers = useMemo(() => {
    if (!sortColumn) return players
    return [...players].sort((a, b) => {
      const aVal = a[sortColumn as keyof typeof a]
      const bVal = b[sortColumn as keyof typeof b]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal
      }
      return sortDirection === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [players, sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hardNavigate("/splash?menu=1")
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const ovrColor = (ovr: number) =>
    ovr >= 85 ? "text-emerald-400" :
    ovr >= 75 ? "text-green-400" :
    ovr >= 65 ? "text-yellow-400" :
    ovr >= 55 ? "text-orange-400" : "text-white/40"

  const teamColor = selectedTeam?.cor1 ?? "#00ffc8"

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#050508]">
      {/* Stadium background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <Image
          src="/images/stadium-night.png"
          alt="Stadium"
          fill
          className="object-cover opacity-50"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/70 to-[#050508]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/80 via-transparent to-[#050508]/80" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">

        {/* Left Panel – Teams List */}
        <aside className="w-64 lg:w-72 flex-shrink-0 flex flex-col bg-black/50 backdrop-blur-sm border-r border-white/[0.06]">
          {/* Voltar — unico controle de navegacao desta tela */}
          <div className="p-3 border-b border-white/[0.06]">
            <Link
              href="/splash?menu=1"
              aria-label="Voltar ao menu"
              className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-white/55 hover:text-white rounded-lg transition-all text-sm font-medium border border-white/[0.06]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar</span>
            </Link>
          </div>
          {/* Search */}
          <div className="p-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
              <input
                type="text"
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                placeholder="Procurar time..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/25 focus:outline-none focus:border-[#00ffc8]/40 focus:ring-1 focus:ring-[#00ffc8]/15 transition-all"
              />
            </div>
          </div>

          {/* Column header */}
          <div className="grid grid-cols-[1fr_44px] bg-white/[0.03] text-white/30 text-[10px] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
            <div className="px-3 py-2">País · Estadual · Time</div>
            <div className="px-1 py-2 text-center">OVR</div>
          </div>

          {/* Teams List — agrupada por País > Estadual/Liga */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {groupedTeams.map((country) => {
              const countryOpen = isSearching || expandedCountries.has(country.code)
              return (
                <div key={country.code}>
                  {/* Cabeçalho do país */}
                  <button
                    onClick={() => toggleCountry(country.code)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-[#0a1210] hover:bg-white/[0.05] border-b border-white/[0.06] transition-colors"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-white/40 transition-transform", countryOpen ? "" : "-rotate-90")} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/30 w-7 text-left shrink-0">{country.code}</span>
                    <span className="flex-1 text-left text-xs font-semibold text-white/80 truncate">{country.name}</span>
                    <span className="text-[10px] text-white/25 shrink-0">{country.count}</span>
                  </button>

                  {countryOpen && country.subs.map((sub) => {
                    const subOpen = isSearching || expandedSubs.has(sub.key)
                    return (
                      <div key={sub.key}>
                        {/* Cabeçalho do estadual / liga */}
                        <button
                          onClick={() => toggleSub(sub.key)}
                          className="w-full flex items-center gap-2 pl-6 pr-3 py-1.5 bg-white/[0.015] hover:bg-white/[0.045] border-b border-white/[0.03] transition-colors"
                        >
                          <ChevronDown className={cn("h-3 w-3 shrink-0 text-white/25 transition-transform", subOpen ? "" : "-rotate-90")} />
                          <span className="flex-1 text-left text-[11px] font-medium text-[#00ffc8]/70 truncate">{sub.label}</span>
                          <span className="text-[9px] text-white/20 shrink-0">{sub.teams.length}</span>
                        </button>

                        {subOpen && sub.teams.map((team) => {
                          const isSelected = selectedTeam?.curto === team.curto && selectedTeam?.divisao === team.divisao
                          return (
                            <button
                              key={`${team.curto}-${team.divisao}`}
                              onClick={() => setSelectedTeam(team)}
                              className={cn(
                                "w-full grid grid-cols-[1fr_44px] text-xs border-b border-white/[0.03] transition-all",
                                isSelected
                                  ? "bg-white/[0.07] border-l-2 border-l-[#00ffc8]"
                                  : "hover:bg-white/[0.03]"
                              )}
                            >
                              <div className="pl-8 pr-3 py-2.5 text-left truncate flex items-center gap-2">
                                <TeamCrest team={team} size="xs" />
                                <span className={cn(
                                  "truncate",
                                  isSelected ? "text-white font-semibold" : "text-white/60"
                                )}>{team.nome}</span>
                              </div>
                              <div className={cn("px-1 py-2.5 text-center font-bold text-xs", ovrColor(team.prestigio))}>
                                {team.prestigio}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {groupedTeams.length === 0 && (
              <div className="px-3 py-10 text-center text-[11px] text-white/25">Nenhum time encontrado</div>
            )}
          </div>

          {/* Footer count */}
          <div className="px-3 py-2 text-[10px] text-white/25 bg-black/30 border-t border-white/[0.06] flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            <span>{filteredTeams.length} times</span>
          </div>
        </aside>

        {/* Right Panel – Team Details */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedTeam && (
            <>
              {/* Team Info Header */}
              <div className="relative flex-shrink-0 border-b border-white/[0.06] overflow-hidden bg-[#07100f]">
                {/* Team color glow */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(to right, transparent, ${teamColor}60, transparent)` }}
                />
                <div
                  className="pointer-events-none absolute -top-20 left-1/4 h-40 w-1/2 rounded-full blur-3xl opacity-10"
                  style={{ background: teamColor }}
                />

                <div className="relative px-6 py-4 flex items-center gap-5">
                  {/* Crest + import button */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                    <div
                      className="w-14 h-14 flex items-center justify-center rounded-xl border"
                      style={{
                        background: `${teamColor}0d`,
                        borderColor: `${teamColor}25`,
                      }}
                    >
                      <TeamCrest team={selectedTeam} size="md" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={handleImportLogo}
                        title="Importar logo customizada"
                        className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium bg-white/[0.05] hover:bg-[#00ffc8]/15 text-white/40 hover:text-[#00ffc8] rounded border border-white/[0.08] hover:border-[#00ffc8]/30 transition-all"
                      >
                        <Upload className="h-2.5 w-2.5" />
                        <span>Logo</span>
                      </button>
                      {hasCustomLogo && (
                        <button
                          onClick={handleRemoveLogo}
                          title="Remover logo customizada"
                          className="flex items-center px-1.5 py-0.5 text-[9px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded border border-rose-500/20 transition-all"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg font-bold text-white truncate">{selectedTeam.nome}</h2>
                      <span
                        className="px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider border"
                        style={{
                          color: `${teamColor}cc`,
                          background: `${teamColor}12`,
                          borderColor: `${teamColor}30`,
                        }}
                      >
                        {formatDivisao(selectedTeam.divisao)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedTeam.estado}, Brasil
                      </span>
                      <span className="text-white/15">·</span>
                      <span>{selectedTeam.estadio_nome}</span>
                    </div>
                  </div>

                  {/* Kits */}
                  <div className="hidden lg:flex items-center gap-1.5">
                    {(["home", "away", "third"] as const).map((variant, vi) => {
                      const kitKey = `${selectedTeam.file_key}-${variant}`
                      const hasError = kitErrors[kitKey]
                      const kitColors = [
                        { bg: selectedTeam.cor1, stripe: selectedTeam.cor2 },
                        { bg: selectedTeam.cor2, stripe: selectedTeam.cor1 },
                        { bg: "#1a1a2e", stripe: selectedTeam.cor1 },
                      ]
                      const { bg, stripe } = kitColors[vi]
                      return (
                        <div
                          key={variant}
                          className="w-10 h-12 bg-white/[0.04] rounded-lg flex items-center justify-center p-1 hover:bg-white/[0.08] transition-all cursor-pointer border border-white/[0.06]"
                          title={variant === "home" ? "Principal" : variant === "away" ? "Alternativo" : "Terceiro"}
                        >
                          {!hasError ? (
                            <Image
                              src={getCamisaUrl(selectedTeam.file_key, variant)}
                              alt={`${selectedTeam.nome} ${variant}`}
                              width={36}
                              height={44}
                              className="object-contain h-full w-auto"
                              unoptimized
                              onError={() => setKitErrors(prev => ({ ...prev, [kitKey]: true }))}
                            />
                          ) : (
                            <svg viewBox="0 0 40 50" className="h-full w-auto">
                              <path d="M14 2 L8 8 L2 6 L2 22 L8 22 L8 46 L32 46 L32 22 L38 22 L38 6 L32 8 Z"
                                fill={bg} stroke={stripe} strokeWidth="1.5" />
                              <path d="M14 2 L20 5 L26 2 L32 8 L20 12 L8 8 Z" fill={stripe} opacity="0.7" />
                            </svg>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* OVR */}
                  <div className="flex-shrink-0 text-center px-2">
                    <div className="text-4xl font-black tracking-tight" style={{ color: teamColor }}>
                      {selectedTeam.prestigio}
                    </div>
                    <div className="text-[9px] text-white/30 font-semibold tracking-widest mt-0.5">OVERALL</div>
                  </div>

                  {/* Tabs + Editar clube */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {([
                      { id: "principal", label: "Elenco" },
                      { id: "juniores",  label: "Juniores" },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                          "px-4 py-2 text-xs font-semibold rounded-lg transition-all",
                          activeTab === id
                            ? "text-black shadow-lg"
                            : "bg-white/[0.05] text-white/40 hover:bg-white/[0.08] hover:text-white/70"
                        )}
                        style={activeTab === id ? { background: `linear-gradient(135deg, ${teamColor}, ${selectedTeam.cor2 ?? teamColor})` } : {}}
                      >
                        {label}
                      </button>
                    ))}
                    <div className="mx-1 h-5 w-px bg-white/10" />
                    <button
                      onClick={() => setShowClubModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white border border-white/[0.06] transition-all"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar clube
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab Content — lista de jogadores */}
              <>
                  {/* Players Table */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Column headers */}
                    <div className="flex-shrink-0 grid grid-cols-[1fr_64px_52px_48px_52px_100px_44px] bg-white/[0.025] text-white/30 text-[10px] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
                      <button onClick={() => handleSort("nome")} className="px-4 py-2.5 text-left hover:text-white/50 flex items-center gap-1 transition-colors">
                        Nome
                        {sortColumn === "nome" && (
                          sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                      <button onClick={() => handleSort("posicao")} className="px-2 py-2.5 text-center hover:text-white/50 transition-colors">Pos</button>
                      <div className="px-2 py-2.5 text-center">País</div>
                      <button onClick={() => handleSort("idade")} className="px-2 py-2.5 text-center hover:text-white/50 transition-colors">Idade</button>
                      <button onClick={() => handleSort("overall")} className="px-2 py-2.5 text-center hover:text-white/50 transition-colors">OVR</button>
                      <div className="px-2 py-2.5 text-center">Carac.</div>
                      <div className="px-2 py-2.5 text-center">Lado</div>
                    </div>

                    {/* Player rows */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                      {sortedPlayers.map((player, index) => {
                        const isSelected = selectedPlayerIndex === index
                        const posStyle = POS_STYLE[player.posicao] ?? { text: "text-white/50", bg: "bg-white/5 border-white/10" }
                        return (
                          <button
                            key={player.id}
                            onClick={() => setSelectedPlayerIndex(index)}
                            onDoubleClick={() => openPlayerEditor(index)}
                            title="Clique para selecionar, duplo clique para editar"
                            className={cn(
                              "w-full grid grid-cols-[1fr_64px_52px_48px_52px_100px_44px] text-xs border-b border-white/[0.04] transition-all",
                              isSelected
                                ? "bg-white/[0.06] border-l-2 border-l-[#00ffc8]"
                                : index % 2 === 0
                                  ? "hover:bg-white/[0.03]"
                                  : "bg-white/[0.015] hover:bg-white/[0.035]"
                            )}
                          >
                            <div className={cn(
                              "px-4 py-2.5 text-left truncate font-medium",
                              isSelected ? "text-white" : "text-white/65"
                            )}>{player.nome}</div>

                            <div className="px-2 py-2.5 flex items-center justify-center">
                              <span className={cn(
                                "px-1.5 py-0.5 text-[10px] font-bold rounded border",
                                posStyle.text, posStyle.bg
                              )}>
                                {player.posicao}
                              </span>
                            </div>

                            <div className="px-2 py-2.5 text-center text-white/30">{player.pais}</div>
                            <div className="px-2 py-2.5 text-center text-white/50">{player.idade}</div>

                            <div className={cn("px-2 py-2.5 text-center font-bold", ovrColor(player.overall))}>
                              {player.overall}
                            </div>

                            <div className="px-2 py-2.5 text-center text-white/35 truncate">{player.caracteristica}</div>
                            <div className="px-2 py-2.5 text-center text-white/35">{player.lado}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex-shrink-0 h-12 flex items-center justify-between bg-black/60 backdrop-blur-sm border-t border-white/[0.06] px-5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-bold text-white">{players.length}</span>
                      <span className="text-white/30">/55 jogadores</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={openNewPlayer}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#00ffc8]/10 hover:bg-[#00ffc8]/20 text-[#00ffc8] rounded-lg transition-all border border-[#00ffc8]/20"
                      >
                        <Plus className="h-3 w-3" />
                        <span className="hidden sm:inline">Adicionar</span>
                      </button>
                      <button
                        onClick={() => openPlayerEditor(selectedPlayerIndex)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white rounded-lg transition-all border border-white/[0.06]"
                      >
                        <Pencil className="h-3 w-3" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={randomizeSelectedPlayer}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white rounded-lg transition-all border border-white/[0.06]"
                      >
                        <Shuffle className="h-3 w-3" />
                        <span className="hidden sm:inline">Aleatorio</span>
                      </button>
                      <button
                        onClick={removeSelectedPlayer}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-all border border-rose-500/20"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Remover</span>
                      </button>
                    </div>
                  </div>
                </>

              {/* ── MODAL: Editar clube ── */}
              {showClubModal && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
                  onClick={() => setShowClubModal(false)}
                >
                  <div
                    className="w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0f0e] shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Cabecalho do modal */}
                    <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center gap-2.5">
                        <Shield className="h-4 w-4" style={{ color: teamColor }} />
                        <div>
                          <h2 className="text-sm font-bold text-white leading-tight">Editar clube</h2>
                          <span className="text-[11px] text-white/40">{selectedTeam.nome}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowClubModal(false)}
                        aria-label="Fechar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">

                    {/* Dados gerais */}
                    <section>
                      <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Dados do Clube</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Nome */}
                        <div className="col-span-2">
                          <label className="block text-[10px] text-white/40 mb-1">Nome completo</label>
                          <input
                            type="text"
                            value={editDraft.nome ?? ""}
                            onChange={e => setEditDraft(p => ({ ...p, nome: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                          />
                        </div>
                        {/* Curto */}
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">Sigla (3-4 letras)</label>
                          <input
                            type="text"
                            maxLength={4}
                            value={editDraft.curto ?? ""}
                            onChange={e => setEditDraft(p => ({ ...p, curto: e.target.value.toUpperCase() }))}
                            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all font-mono"
                          />
                        </div>
                        {/* Prestígio */}
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">Prestígio (Overall)</label>
                          <input
                            type="number"
                            min={1} max={99}
                            value={editDraft.prestigio ?? selectedTeam.prestigio}
                            onChange={e => setEditDraft(p => ({ ...p, prestigio: Math.min(99, Math.max(1, Number(e.target.value))) }))}
                            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-white/20 transition-all"
                          />
                        </div>
                        {/* Estádio */}
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">Nome do Estádio</label>
                          <input
                            type="text"
                            value={editDraft.estadio_nome ?? ""}
                            onChange={e => setEditDraft(p => ({ ...p, estadio_nome: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                          />
                        </div>
                        {/* Capacidade */}
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">Capacidade</label>
                          <input
                            type="number"
                            min={1000}
                            value={editDraft.estadio_cap ?? ""}
                            onChange={e => setEditDraft(p => ({ ...p, estadio_cap: Number(e.target.value) }))}
                            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-white/20 transition-all"
                          />
                        </div>
                        {/* Patrocinador */}
                        <div className="col-span-2">
                          <label className="block text-[10px] text-white/40 mb-1">Patrocinador principal</label>
                          <input
                            type="text"
                            value={editDraft.patrocinador ?? ""}
                            onChange={e => setEditDraft(p => ({ ...p, patrocinador: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                          />
                        </div>
                        {/* Cores */}
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">Cor principal</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={editDraft.cor1 ?? selectedTeam.cor1}
                              onChange={e => setEditDraft(p => ({ ...p, cor1: e.target.value }))}
                              className="h-8 w-12 rounded cursor-pointer border border-white/10 bg-transparent"
                            />
                            <span className="text-[10px] font-mono text-white/40">{editDraft.cor1 ?? selectedTeam.cor1}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">Cor secundária</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={editDraft.cor2 ?? selectedTeam.cor2}
                              onChange={e => setEditDraft(p => ({ ...p, cor2: e.target.value }))}
                              className="h-8 w-12 rounded cursor-pointer border border-white/10 bg-transparent"
                            />
                            <span className="text-[10px] font-mono text-white/40">{editDraft.cor2 ?? selectedTeam.cor2}</span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Kits */}
                    <section>
                      <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Uniformes</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {(["home", "away", "third"] as const).map((variant) => {
                          const labels = { home: "Principal", away: "Alternativo", third: "Terceiro" }
                          const kit = editDraft.kits?.[variant] ?? { primary: selectedTeam.cor1, secondary: selectedTeam.cor2, pattern: "solid" as KitPattern }
                          return (
                            <div key={variant} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3 flex flex-col gap-2.5">
                              <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">{labels[variant]}</div>

                              {/* Kit preview */}
                              <div className="flex justify-center">
                                {editDraft.kits?.[variant]?.imageUrl ? (
                                  <div className="relative">
                                    <Image
                                      src={editDraft.kits[variant]!.imageUrl!}
                                      alt={labels[variant]}
                                      width={52} height={64}
                                      className="object-contain rounded"
                                      unoptimized
                                    />
                                    <button
                                      onClick={() => {
                                        setEditDraft(p => ({
                                          ...p,
                                          kits: { ...p.kits, [variant]: { ...p.kits?.[variant], imageUrl: undefined } }
                                        }))
                                        // Remove o uniforme importado do override na hora (igual ao escudo),
                                        // voltando ao uniforme padrao do clube em todo o jogo.
                                        if (selectedTeam?.file_key) {
                                          const stored = getTeamOverride(selectedTeam.file_key) ?? {}
                                          if (stored.kits?.[variant]) {
                                            setTeamOverride(selectedTeam.file_key, {
                                              ...stored,
                                              kits: { ...stored.kits, [variant]: { ...stored.kits[variant]!, imageUrl: undefined } },
                                            })
                                          }
                                        }
                                      }}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center"
                                    >
                                      <X className="h-2.5 w-2.5 text-white" />
                                    </button>
                                  </div>
                                ) : (
                                  <svg viewBox="0 0 40 50" className="h-14 w-auto">
                                    <path d="M14 2 L8 8 L2 6 L2 22 L8 22 L8 46 L32 46 L32 22 L38 22 L38 6 L32 8 Z"
                                      fill={kit.primary} stroke={kit.secondary} strokeWidth="1.5" />
                                    {kit.pattern === "stripes" && (
                                      <>
                                        <line x1="15" y1="8" x2="15" y2="46" stroke={kit.secondary} strokeWidth="3" opacity="0.5" />
                                        <line x1="22" y1="8" x2="22" y2="46" stroke={kit.secondary} strokeWidth="3" opacity="0.5" />
                                        <line x1="29" y1="8" x2="29" y2="46" stroke={kit.secondary} strokeWidth="3" opacity="0.5" />
                                      </>
                                    )}
                                    {kit.pattern === "diagonal" && (
                                      <line x1="2" y1="46" x2="38" y2="6" stroke={kit.secondary} strokeWidth="6" opacity="0.45" />
                                    )}
                                    {kit.pattern === "halves" && (
                                      <rect x="20" y="6" width="18" height="40" fill={kit.secondary} opacity="0.55" />
                                    )}
                                    <path d="M14 2 L20 5 L26 2 L32 8 L20 12 L8 8 Z" fill={kit.secondary} opacity="0.7" />
                                  </svg>
                                )}
                              </div>

                              {/* Primary color */}
                              <div>
                                <label className="block text-[9px] text-white/30 mb-1">Cor base</label>
                                <div className="flex items-center gap-1.5">
                                  <input type="color" value={kit.primary}
                                    onChange={e => setEditDraft(p => ({
                                      ...p,
                                      kits: { ...p.kits, [variant]: { ...p.kits?.[variant]!, primary: e.target.value } }
                                    }))}
                                    className="h-6 w-8 rounded cursor-pointer border border-white/10 bg-transparent"
                                  />
                                  <span className="text-[9px] font-mono text-white/30">{kit.primary}</span>
                                </div>
                              </div>

                              {/* Secondary color */}
                              <div>
                                <label className="block text-[9px] text-white/30 mb-1">Cor detalhe</label>
                                <div className="flex items-center gap-1.5">
                                  <input type="color" value={kit.secondary}
                                    onChange={e => setEditDraft(p => ({
                                      ...p,
                                      kits: { ...p.kits, [variant]: { ...p.kits?.[variant]!, secondary: e.target.value } }
                                    }))}
                                    className="h-6 w-8 rounded cursor-pointer border border-white/10 bg-transparent"
                                  />
                                  <span className="text-[9px] font-mono text-white/30">{kit.secondary}</span>
                                </div>
                              </div>

                              {/* Pattern */}
                              <div>
                                <label className="block text-[9px] text-white/30 mb-1">Padrão</label>
                                <select
                                  value={kit.pattern}
                                  onChange={e => setEditDraft(p => ({
                                    ...p,
                                    kits: { ...p.kits, [variant]: { ...p.kits?.[variant]!, pattern: e.target.value as KitPattern } }
                                  }))}
                                  className="w-full px-2 py-1 text-[10px] bg-white/[0.04] border border-white/[0.08] rounded text-white/70 focus:outline-none focus:border-white/20 transition-all"
                                >
                                  <option value="solid">Liso</option>
                                  <option value="stripes">Listras</option>
                                  <option value="diagonal">Diagonal</option>
                                  <option value="halves">Bicolor</option>
                                </select>
                              </div>

                              {/* Image upload */}
                              <button
                                onClick={() => handleKitImageUpload(variant)}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 rounded border border-white/[0.08] transition-all"
                              >
                                <Upload className="h-2.5 w-2.5" />
                                Importar imagem
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  </div>

                    {/* Rodape do modal */}
                    <div className="flex-shrink-0 h-14 flex items-center justify-between bg-black/40 border-t border-white/[0.06] px-5">
                      <button
                        onClick={handleResetOverride}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 rounded-lg transition-all border border-white/[0.06]"
                      >
                        Restaurar padrão
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowClubModal(false)}
                          className="px-4 py-2 text-xs font-medium text-white/50 hover:text-white rounded-lg transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => { handleSaveOverride(); }}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all border",
                            editSaved
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "text-black border-transparent shadow-lg"
                          )}
                          style={!editSaved ? { background: `linear-gradient(135deg, ${teamColor}, ${selectedTeam.cor2 ?? teamColor})` } : {}}
                        >
                          {editSaved ? "Salvo!" : "Salvar alterações"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── MODAL: Editar / adicionar jogador ── */}
      {playerDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setPlayerDraft(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0f0e] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecalho */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-[#00ffc8]" />
                <h2 className="text-sm font-bold text-white">
                  {isNewPlayer ? "Adicionar jogador" : "Editar jogador"}
                </h2>
              </div>
              <button
                onClick={() => setPlayerDraft(null)}
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Formulario */}
            <div className="px-5 py-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Nome</label>
                <input
                  autoFocus
                  value={playerDraft.nome}
                  onChange={(e) => setPlayerDraft({ ...playerDraft, nome: e.target.value })}
                  placeholder="Nome do jogador"
                  className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white rounded-lg border border-white/[0.08] focus:border-[#00ffc8]/40 focus:outline-none placeholder:text-white/25"
                />
              </div>

              {/* Posicao + Lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Posicao</label>
                  <select
                    value={playerDraft.posicao}
                    onChange={(e) => setPlayerDraft({ ...playerDraft, posicao: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white rounded-lg border border-white/[0.08] focus:border-[#00ffc8]/40 focus:outline-none"
                  >
                    {POSICOES.map((p) => (
                      <option key={p} value={p} className="bg-[#0a0f0e]">{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Pe / Lado</label>
                  <select
                    value={playerDraft.lado}
                    onChange={(e) => setPlayerDraft({ ...playerDraft, lado: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white rounded-lg border border-white/[0.08] focus:border-[#00ffc8]/40 focus:outline-none"
                  >
                    {LADOS.map((l) => (
                      <option key={l.value} value={l.value} className="bg-[#0a0f0e]">{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pais + Idade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Pais</label>
                  <input
                    value={playerDraft.pais}
                    maxLength={3}
                    onChange={(e) => setPlayerDraft({ ...playerDraft, pais: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white rounded-lg border border-white/[0.08] focus:border-[#00ffc8]/40 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Idade</label>
                  <input
                    type="number"
                    min={15}
                    max={45}
                    value={playerDraft.idade}
                    onChange={(e) => setPlayerDraft({ ...playerDraft, idade: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white rounded-lg border border-white/[0.08] focus:border-[#00ffc8]/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Overall */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">Overall</label>
                  <span className={cn("text-sm font-bold", ovrColor(playerDraft.overall))}>{playerDraft.overall}</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={99}
                  value={playerDraft.overall}
                  onChange={(e) => setPlayerDraft({ ...playerDraft, overall: Number(e.target.value) })}
                  className="w-full accent-[#00ffc8]"
                />
              </div>

              {/* Caracteristica */}
              <div>
                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">Caracteristica</label>
                <select
                  value={playerDraft.caracteristica}
                  onChange={(e) => setPlayerDraft({ ...playerDraft, caracteristica: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white rounded-lg border border-white/[0.08] focus:border-[#00ffc8]/40 focus:outline-none"
                >
                  {CARACTERISTICAS.map((c) => (
                    <option key={c} value={c} className="bg-[#0a0f0e]">{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rodape */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/[0.06] bg-black/40">
              <button
                onClick={() => setPlayerDraft(null)}
                className="px-4 py-2 text-xs font-medium text-white/50 hover:text-white rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={savePlayerDraft}
                disabled={!playerDraft.nome.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#00ffc8] text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isNewPlayer ? "Adicionar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
