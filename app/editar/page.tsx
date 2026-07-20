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
  allPoolTeams,
  type Team
} from "@/lib/teams-data"
import { allInternationalTeams } from "@/lib/international-teams"
import { getPlayersForTeam } from "@/lib/players-data"
import { getPlayerOverride, setPlayerOverride, defaultPlayerAttributes } from "@/lib/player-overrides"
import { TeamCrest, setCustomLogoUrl, getCustomLogoUrl, removeCustomLogoUrl, listLocalCustomLogos } from "@/components/team-crest"
import { isTauri } from "@/lib/game-asset"
import { compressImageDataUrl } from "@/lib/image-utils"
import {
  getTeamOverride,
  setTeamOverride,
  clearTeamOverride,
  applyTeamOverride,
  listLocalTeamOverrides,
  type TeamOverride,
  type KitPattern,
} from "@/lib/team-overrides"
import { flushPersistentStore, initPersistentStore } from "@/lib/persistent-store"
import { generateYouthRoster, getYouthRoster, saveYouthRoster, type YouthEditorPlayer } from "@/lib/youth-editor"
import { PlayerAvatar } from "@/components/player-avatar"
import { setPlayerPhotoOverride } from "@/lib/player-photos"
import { KitImage } from "@/components/match/kit-image"

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

// Nome do pais (PT-BR, como vem do pool) -> codigo, para os clubes do pool caírem no
// MESMO grupo dos curados. Paises fora do mapa usam o proprio nome como codigo.
const PAIS_CODE: Record<string, string> = {
  "Brasil": "BRA", "Inglaterra": "ENG", "Espanha": "ESP", "Itália": "ITA", "Italia": "ITA",
  "Alemanha": "GER", "França": "FRA", "Franca": "FRA", "Portugal": "POR",
  "Holanda": "NED", "Países Baixos": "NED", "Paises Baixos": "NED",
  "Escócia": "SCO", "Escocia": "SCO", "Turquia": "TUR", "Bélgica": "BEL", "Belgica": "BEL",
  "Rússia": "RUS", "Russia": "RUS", "Estados Unidos": "USA", "México": "MEX", "Mexico": "MEX",
  "Argentina": "ARG", "Colômbia": "COL", "Colombia": "COL", "Chile": "CHI",
  "Uruguai": "URU", "Arábia Saudita": "KSA", "Arabia Saudita": "KSA",
  "Japão": "JPN", "Japao": "JPN", "Coreia do Sul": "KOR", "China": "CHN",
}

// Clube do pool? (divisao no formato "pool:<pais>")
import { normalizeCountry } from "@/lib/country-normalize"

const isPoolTeam = (team: Team) => typeof team.divisao === "string" && team.divisao.startsWith("pool:")

const countryCodeOf = (team: Team): string => {
  if (isPoolTeam(team)) {
    // O valor cru virava "país": clube com pais="SP" (sigla de estado) criava um
    // grupo "SP" ao lado de "São Paulo", e fragmentos de nome de clube
    // ("SPORT", "OPERARIOMT") viravam grupos-fantasma. Normaliza primeiro —
    // UFs viram Brasil, lixo vira Indefinido — e só então busca o código.
    const pais = normalizeCountry(team.pais ?? (team.divisao as string).slice(5))
    if (pais === "Brasil") return "BRA"
    return PAIS_CODE[pais] ?? "INT"
  }
  return DIV_COUNTRY[team.divisao] ?? "INT"
}

// Segundo nível de agrupamento: por estado (Brasil) ou por liga (internacional).
const subGroupOf = (team: Team): { key: string; label: string } => {
  const code = countryCodeOf(team)
  // Clubes BR do pool COM estado agrupam por estado (junto dos curados). Sem estado ou
  // fora do Brasil, caem num "Outros clubes" por pais (nao temos a liga no Team).
  if (isPoolTeam(team)) {
    if (code === "BRA" && team.estado) return { key: `BRA|${team.estado}`, label: ESTADO_LABEL[team.estado] ?? team.estado }
    return { key: `${code}|pool`, label: "Outros clubes" }
  }
  return code === "BRA"
    ? { key: `BRA|${team.estado}`, label: ESTADO_LABEL[team.estado] ?? team.estado }
    : { key: `${code}|${team.divisao}`, label: formatDivisao(team.divisao) }
}

// Mock players data generator based on team - completamente deterministico (sem Math.random)
// Monta a lista de jogadores REAL do time (antes era uma lista fixa/fake, IGUAL para todos
// os clubes). Usa getPlayersForTeam com raw=true para ter o nome ORIGINAL (chave da edicao),
// e mostra o valor ja editado quando existe override.
interface EditorPlayer {
  id: number
  originalName: string
  nome: string
  posicao: string
  pais: string
  idade: number
  overall: number
  caracteristica: string
  lado: string
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}
function generatePlayersForTeam(team: Team | null): EditorPlayer[] {
  if (!team) return []
  return getPlayersForTeam(team, { raw: true }).map((p, i) => {
    const ov = getPlayerOverride(team.file_key, p.nome)
    const base = ov?.base ?? p.base
    const pos = ov?.pos ?? p.pos
    const def = defaultPlayerAttributes(base, pos)
    return {
      id: i + 1,
      originalName: p.nome,
      nome: ov?.nome ?? p.nome,
      posicao: pos,
      pais: "-",
      idade: ov?.idade ?? p.idade,
      overall: base,
      caracteristica: "-",
      lado: "-",
      pace: ov?.pace ?? def.pace,
      shooting: ov?.shooting ?? def.shooting,
      passing: ov?.passing ?? def.passing,
      dribbling: ov?.dribbling ?? def.dribbling,
      defending: ov?.defending ?? def.defending,
      physical: ov?.physical ?? def.physical,
    }
  })
}

// All teams combined (brasileiros + internacionais + POOL BF2026 ~2947 clubes).
// O pool traz todos os clubes reais que nao estao curados, para o editor listar TODOS.
const allTeams = [...serieATeams, ...serieBTeams, ...serieCTeams, ...serieDTeams, ...allInternationalTeams, ...allPoolTeams]

const POS_STYLE: Record<string, { text: string; bg: string }> = {
  GOL: { text: "text-amber-300",  bg: "bg-amber-400/10 border-amber-400/25" },
  LAT: { text: "text-cyan-300",   bg: "bg-cyan-400/10 border-cyan-400/25" },
  ZAG: { text: "text-blue-300",   bg: "bg-blue-400/10 border-blue-400/25" },
  VOL: { text: "text-emerald-300",bg: "bg-emerald-400/10 border-emerald-400/25" },
  MEI: { text: "text-green-300",  bg: "bg-green-400/10 border-green-400/25" },
  ATA: { text: "text-rose-300",   bg: "bg-rose-400/10 border-rose-400/25" },
}

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
  // Edicao de jogador (nome/posicao/overall) — persiste via player-overrides.
  const [editingPlayer, setEditingPlayer] = useState<EditorPlayer | null>(null)
  const [pDraft, setPDraft] = useState({ nome: "", posicao: "", overall: 0, idade: 0, preferredFoot: "Direita" as "Direita" | "Esquerda" | "Ambidestro", reputation: "normal" as "normal" | "estrela" | "top_mundial", traits: [] as string[], faceDataUrl: "", pace: 0, shooting: 0, passing: 0, dribbling: 0, defending: 0, physical: 0 })
  const openPlayerEdit = (p: EditorPlayer) => {
    setEditingPlayer(p)
    const ov = selectedTeam ? getPlayerOverride(selectedTeam.file_key, p.originalName) : null
    setPDraft({ nome: p.nome, posicao: p.posicao, overall: p.overall, idade: p.idade, preferredFoot: ov?.preferredFoot ?? "Direita", reputation: ov?.reputation ?? "normal", traits: ov?.traits ?? [], faceDataUrl: ov?.faceDataUrl ?? "", pace: p.pace, shooting: p.shooting, passing: p.passing, dribbling: p.dribbling, defending: p.defending, physical: p.physical })
  }
  const [activeTab, setActiveTab] = useState<"principal" | "juniores" | "dados">("principal")
  useEffect(() => setSelectedPlayerIndex(0), [activeTab])
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [players, setPlayers] = useState(() => generatePlayersForTeam(allTeams[0]))
  const [youthPlayers, setYouthPlayers] = useState<YouthEditorPlayer[]>(() => getYouthRoster(allTeams[0].file_key))
  const [hasCustomLogo, setHasCustomLogo] = useState(false)
  const [storeReady, setStoreReady] = useState(false)
  const [teamsRevision, setTeamsRevision] = useState(0)
  const resolvedTeams = useMemo(
    () => allTeams.map(team => applyTeamOverride(team)),
    [storeReady, teamsRevision],
  )

  // Edit draft state
  const [editDraft, setEditDraft] = useState<TeamOverride>({})
  const [editSaved, setEditSaved] = useState(false)
  // Aviso do exportador (quantos clubes sairam / nada a exportar).
  const [exportMsg, setExportMsg] = useState<string | null>(null)

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

  const handleSaveOverride = async () => {
    if (!selectedTeam) return
    await initPersistentStore()
    const normalized: TeamOverride = {
      ...editDraft,
      nome: editDraft.nome?.trim() || selectedTeam.nome,
      curto: editDraft.curto?.trim().toUpperCase() || selectedTeam.curto,
    }
    setTeamOverride(selectedTeam.file_key, normalized)
    await flushPersistentStore()
    // Reflete imediatamente no cabeçalho e na lista; antes só aparecia após reabrir.
    setSelectedTeam({ ...selectedTeam, ...normalized })
    setEditDraft(normalized)
    setTeamsRevision(value => value + 1)
    setEditSaved(true)
    setTimeout(() => setEditSaved(false), 2000)
  }

  const handleResetOverride = () => {
    if (!selectedTeam) return
    clearTeamOverride(selectedTeam.file_key)
    const base = allTeams.find(team => team.file_key === selectedTeam.file_key) ?? selectedTeam
    const resolved = applyTeamOverride(base)
    setSelectedTeam({ ...resolved })
    initDraft(resolved)
    setTeamsRevision(value => value + 1)
  }

  /**
   * Exporta TODAS as edicoes de clube para um arquivo.
   *
   * Por que isto existe: o editor grava no persistent-store, que e o save LOCAL. As
   * edicoes ficavam so na maquina de quem editou e NUNCA chegavam aos outros jogadores.
   * Exportando, da para fundir no seed que viaja com o build:
   *
   *   node scripts/merge-team-overrides.mjs <arquivo-exportado.json>
   *
   * A partir do proximo build, todo jogador que instalar recebe estes escudos/uniformes.
   */
  const handleExportOverrides = async () => {
    const all = listLocalTeamOverrides()
    // Junta os escudos custom (guardados separado em ultrafoot:logo:*) em cada clube, para
    // eles TAMBEM viajarem no build. Inclui clubes que so tem escudo, sem outra edicao.
    for (const [fileKey, logoUrl] of Object.entries(listLocalCustomLogos())) {
      all[fileKey] = { ...(all[fileKey] ?? {}), logoUrl }
    }
    const count = Object.keys(all).length
    if (count === 0) {
      setExportMsg("Nenhuma edicao para exportar.")
      setTimeout(() => setExportMsg(null), 3000)
      return
    }
    const json = JSON.stringify(all, null, 2)

    if (isTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog")
      const { writeTextFile } = await import("@tauri-apps/plugin-fs")
      const filePath = await save({
        title: "Exportar edicoes de clubes",
        defaultPath: "team-overrides-export.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      if (!filePath) return
      await writeTextFile(filePath as string, json)
      setExportMsg(`${count} clube(s) exportado(s).`)
    } else {
      const blob = new Blob([json], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "team-overrides-export.json"
      a.click()
      URL.revokeObjectURL(a.href)
      setExportMsg(`${count} clube(s) exportado(s).`)
    }
    setTimeout(() => setExportMsg(null), 4000)
  }

  const handleKitImageUpload = async (variant: "home" | "away" | "third") => {
    const processFile = async (rawDataUrl: string) => {
      // Comprime ANTES de guardar: sem isto o uniforme importado ia pro save em tamanho
      // original e inchava o ultrafoot-clubs.json ate o jogo travar/dar erro ao carregar.
      const dataUrl = await compressImageDataUrl(rawDataUrl, 400)
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
        setTeamsRevision(value => value + 1)
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
      await processFile(`data:${mime};base64,${base64}`)
    } else {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/png,image/jpeg,image/webp"
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = e => { if (e.target?.result) void processFile(e.target.result as string) }
        reader.readAsDataURL(file)
      }
      input.click()
    }
  }

  // Initialize the persistent store (loads data from disk into memory cache)
  useEffect(() => {
    initPersistentStore().then(() => {
      setStoreReady(true)
      setSelectedTeam(current => current ? { ...applyTeamOverride(current) } : current)
    })
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
      // Comprime o escudo antes de gravar (evita inchar o save e travar o jogo).
      const compressed = await compressImageDataUrl(`data:${mime};base64,${base64}`, 256)
      setCustomLogoUrl(fileKey, compressed)
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
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string
          if (dataUrl) {
            setCustomLogoUrl(fileKey, await compressImageDataUrl(dataUrl, 256))
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
      setPlayers(generatePlayersForTeam(selectedTeam))
      setYouthPlayers(getYouthRoster(selectedTeam.file_key))
      setSelectedPlayerIndex(0)
      initDraft(selectedTeam)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam, storeReady])

  const filteredTeams = useMemo(() => {
    if (!searchTeam) return resolvedTeams
    return resolvedTeams.filter(team =>
      team.nome.toLowerCase().includes(searchTeam.toLowerCase()) ||
      team.curto.toLowerCase().includes(searchTeam.toLowerCase())
    )
  }, [searchTeam, resolvedTeams])

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

  const displayedPlayers = activeTab === "juniores" ? youthPlayers : players
  const sortedPlayers = useMemo(() => {
    if (!sortColumn) return displayedPlayers
    return [...displayedPlayers].sort((a, b) => {
      const aVal = a[sortColumn as keyof typeof a]
      const bVal = b[sortColumn as keyof typeof b]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal
      }
      return sortDirection === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [displayedPlayers, sortColumn, sortDirection])

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

      {/* Header */}
      <header className="relative z-10 h-14 flex-shrink-0 bg-black/70 backdrop-blur-xl border-b border-white/[0.06] px-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link
            href="/splash?menu=1"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-lg transition-all text-sm font-medium border border-white/[0.06]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voltar ao Menu</span>
          </Link>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-white/30" />
            <h1 className="text-sm font-semibold text-white/70 tracking-wide">Editor de Clubes</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/25">
          <kbd className="px-2 py-0.5 bg-white/5 rounded border border-white/10 font-mono">ESC</kbd>
          <span>para voltar</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">

        {/* Left Panel – Teams List */}
        <aside className="w-64 lg:w-72 flex-shrink-0 flex flex-col bg-black/50 backdrop-blur-sm border-r border-white/[0.06]">
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
                          const isSelected = selectedTeam?.file_key === team.file_key
                          return (
                            <button
                              key={team.file_key}
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
                    {(["home", "away", "third"] as const).map((variant) => (
                        <div
                          key={variant}
                          className="w-10 h-12 bg-white/[0.04] rounded-lg flex items-center justify-center p-1 hover:bg-white/[0.08] transition-all cursor-pointer border border-white/[0.06]"
                          title={variant === "home" ? "Principal" : variant === "away" ? "Alternativo" : "Terceiro"}
                        >
                          <KitImage team={selectedTeam} variant={variant} />
                        </div>
                    ))}
                  </div>

                  {/* OVR */}
                  <div className="flex-shrink-0 text-center px-2">
                    <div className="text-4xl font-black tracking-tight" style={{ color: teamColor }}>
                      {selectedTeam.prestigio}
                    </div>
                    <div className="text-[9px] text-white/30 font-semibold tracking-widest mt-0.5">OVERALL</div>
                  </div>

                  {/* Tabs */}
                  <div className="flex-shrink-0 flex gap-1">
                    {([
                      { id: "principal", label: "Elenco" },
                      { id: "juniores",  label: "Juniores" },
                      { id: "dados",     label: "Editar" },
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
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab !== "dados" ? (
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
                            onClick={() => { setSelectedPlayerIndex(index); openPlayerEdit(player) }}
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
                  <div className="sticky bottom-0 z-20 flex min-h-16 flex-shrink-0 flex-wrap items-center justify-between gap-2 bg-black/95 px-5 py-2 border-t border-white/[0.10] shadow-[0_-8px_30px_rgba(0,0,0,.45)]">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-bold text-white">{displayedPlayers.length}</span>
                      <span className="text-white/30">/55 jogadores</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (activeTab !== "juniores" || !selectedTeam) return
                          const attrs = defaultPlayerAttributes(50, "MEI")
                          const created: YouthEditorPlayer = {
                            id: Math.max(10000, ...youthPlayers.map(player => player.id + 1)),
                            originalName: `novo_juvenil_${Date.now()}`,
                            nome: "Novo juvenil", posicao: "MEI", pais: "-", idade: 16,
                            overall: 50, caracteristica: "Em formação", lado: "D", ...attrs,
                          }
                          const next = [...youthPlayers, created]
                          setYouthPlayers(next)
                          saveYouthRoster(selectedTeam.file_key, next)
                          openPlayerEdit(created)
                        }}
                        disabled={activeTab !== "juniores"}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#00ffc8]/10 hover:bg-[#00ffc8]/20 text-[#00ffc8] rounded-lg transition-all border border-[#00ffc8]/20 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Plus className="h-3 w-3" />
                        <span className="hidden sm:inline">Adicionar</span>
                      </button>
                      <button
                        onClick={() => {
                          const p = sortedPlayers[selectedPlayerIndex]
                          if (!p) return
                          openPlayerEdit(p)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white rounded-lg transition-all border border-white/[0.06]"
                      >
                        <Pencil className="h-3 w-3" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => {
                          if (activeTab !== "juniores" || !selectedTeam) return
                          const next = generateYouthRoster(selectedTeam.file_key, Date.now() % 100000)
                          setYouthPlayers(next)
                          saveYouthRoster(selectedTeam.file_key, next)
                          setSelectedPlayerIndex(0)
                        }}
                        disabled={activeTab !== "juniores"}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white rounded-lg transition-all border border-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Shuffle className="h-3 w-3" />
                        <span className="hidden sm:inline">Aleatorio</span>
                      </button>
                      <button
                        onClick={() => {
                          if (activeTab !== "juniores" || !selectedTeam) return
                          const selected = sortedPlayers[selectedPlayerIndex]
                          if (!selected) return
                          const next = youthPlayers.filter(player => player.id !== selected.id)
                          setYouthPlayers(next)
                          saveYouthRoster(selectedTeam.file_key, next)
                          setSelectedPlayerIndex(index => Math.max(0, Math.min(index, next.length - 1)))
                        }}
                        disabled={activeTab !== "juniores"}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-all border border-rose-500/20 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Remover</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* ── DADOS / EDITAR TAB ── */
                <div className="flex-1 flex flex-col overflow-hidden">
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
                                  <div className="h-16 w-16">
                                    <KitImage
                                      team={{ ...selectedTeam, cor1: kit.primary, cor2: kit.secondary }}
                                      variant={variant}
                                    />
                                  </div>
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

                  {/* Save / Reset bar */}
                  <div className="flex-shrink-0 h-12 flex items-center justify-between bg-black/60 backdrop-blur-sm border-t border-white/[0.06] px-5">
                    <button
                      onClick={handleResetOverride}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 rounded-lg transition-all border border-white/[0.06]"
                    >
                      Restaurar padrão
                    </button>

                    <div className="flex items-center gap-2">
                      {exportMsg && (
                        <span className="text-[11px] text-[#00ffc8]">{exportMsg}</span>
                      )}
                      {/* As edicoes ficam no save LOCAL — nao chegam aos outros jogadores.
                          Exportar + merge-team-overrides.mjs embute no build. */}
                      <button
                        onClick={handleExportOverrides}
                        title="Exporta suas edições para embutir no jogo (todos os jogadores recebem)"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 rounded-lg transition-all border border-white/[0.06]"
                      >
                        Exportar edições
                      </button>
                      <button
                        onClick={handleSaveOverride}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all border",
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
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de edicao de JOGADOR (nome / posicao / overall) — persiste e viaja no build. */}
      {editingPlayer && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingPlayer(null)}>
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1e22] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-white">Editar jogador</h3>
            <p className="mb-4 text-xs text-white/40">Original: {editingPlayer.originalName}</p>
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <PlayerAvatar name={pDraft.nome || editingPlayer.nome} photoUrl={pDraft.faceDataUrl || undefined} position={pDraft.posicao} size="xl" />
                <div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">
                    <Upload className="h-4 w-4" /> Importar foto
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      const raw = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
                      setPDraft(d => ({ ...d, faceDataUrl: raw }))
                    }} />
                  </label>
                  <p className="mt-2 text-[10px] leading-4 text-white/35">PNG, JPEG ou WebP. A imagem é compactada ao salvar.</p>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Nome</label>
                <input
                  value={pDraft.nome}
                  onChange={(e) => setPDraft((d) => ({ ...d, nome: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-[#00ffc8]/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Posição</label>
                  <select
                    value={pDraft.posicao}
                    onChange={(e) => setPDraft((d) => ({ ...d, posicao: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {["GOL", "LD", "ZAG", "LE", "VOL", "MEI", "PD", "PE", "ATA"].map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Overall</label>
                  <input
                    type="number" min={40} max={99}
                    value={pDraft.overall}
                    onChange={(e) => setPDraft((d) => ({ ...d, overall: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Idade</label>
                  <input type="number" min={14} max={50} value={pDraft.idade} onChange={e => setPDraft(d => ({ ...d, idade: Number(e.target.value) }))} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Pé preferido</label>
                  <select value={pDraft.preferredFoot} onChange={e => setPDraft(d => ({ ...d, preferredFoot: e.target.value as typeof d.preferredFoot }))} className="w-full rounded-lg border border-white/10 bg-[#14252a] px-3 py-2 text-sm text-white">
                    <option>Direita</option><option>Esquerda</option><option>Ambidestro</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Reputação</label>
                  <select value={pDraft.reputation} onChange={e => setPDraft(d => ({ ...d, reputation: e.target.value as typeof d.reputation }))} className="w-full rounded-lg border border-white/10 bg-[#14252a] px-3 py-2 text-sm text-white">
                    <option value="normal">Normal</option><option value="estrela">Estrela</option><option value="top_mundial">Top mundial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-wide text-white/40">Características especiais</label>
                <div className="grid grid-cols-2 gap-2">
                  {(pDraft.posicao === "GOL"
                    ? [["defende_penaltis", "Defende pênaltis"], ["sai_do_gol", "Sai bem do gol"], ["reposicao", "Ótima reposição"], ["reflexos", "Reflexos rápidos"]]
                    : [["finalizador", "Finalizador"], ["driblador", "Driblador"], ["passe_vertical", "Passe vertical"], ["lider", "Liderança"]]
                  ).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setPDraft(d => ({ ...d, traits: d.traits.includes(id) ? d.traits.filter(t => t !== id) : [...d.traits, id] }))} className={cn("rounded-lg border px-3 py-2 text-left text-xs", pDraft.traits.includes(id) ? "border-[#00ffc8]/60 bg-[#00ffc8]/10 text-[#00ffc8]" : "border-white/10 text-white/55")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Atributos individuais (valem na partida) */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wide text-white/40">Atributos</label>
                  <span className="text-[10px] text-white/25">afetam a partida</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["pace", "RIT"], ["shooting", "FIN"], ["passing", "PAS"],
                    ["dribbling", "DRI"], ["defending", "DEF"], ["physical", "FIS"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-white/40">{label}</span>
                        <span className="text-xs font-bold text-[#00ffc8]">{pDraft[key]}</span>
                      </div>
                      <input
                        type="range" min={40} max={99} value={pDraft[key]}
                        onChange={(e) => setPDraft((d) => ({ ...d, [key]: parseInt(e.target.value) || 0 }))}
                        className="w-full accent-[#00ffc8]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setEditingPlayer(null)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/60 hover:bg-white/10">Cancelar</button>
              <button
                onClick={async () => {
                  if (editingPlayer && selectedTeam) {
                    const ovr = Math.max(40, Math.min(99, Math.round(pDraft.overall) || 0))
                    if (activeTab === "juniores") {
                      const next = youthPlayers.map(player => player.id === editingPlayer.id ? {
                        ...player,
                        nome: pDraft.nome.trim() || player.nome,
                        posicao: pDraft.posicao || player.posicao,
                        overall: ovr,
                        idade: Math.max(14, Math.min(23, pDraft.idade || player.idade)),
                        pace: pDraft.pace, shooting: pDraft.shooting, passing: pDraft.passing,
                        dribbling: pDraft.dribbling, defending: pDraft.defending, physical: pDraft.physical,
                      } : player)
                      setYouthPlayers(next)
                      saveYouthRoster(selectedTeam.file_key, next)
                    } else {
                      const faceDataUrl = pDraft.faceDataUrl ? await compressImageDataUrl(pDraft.faceDataUrl, 320) : undefined
                      setPlayerOverride(selectedTeam.file_key, editingPlayer.originalName, {
                        nome: pDraft.nome.trim() || undefined,
                        pos: pDraft.posicao || undefined,
                        base: ovr || undefined,
                        idade: pDraft.idade || undefined,
                        pace: pDraft.pace,
                        shooting: pDraft.shooting,
                        passing: pDraft.passing,
                        dribbling: pDraft.dribbling,
                        defending: pDraft.defending,
                        physical: pDraft.physical,
                        preferredFoot: pDraft.preferredFoot,
                        reputation: pDraft.reputation,
                        traits: pDraft.traits,
                        faceDataUrl,
                      })
                      if (faceDataUrl) setPlayerPhotoOverride(pDraft.nome.trim() || editingPlayer.nome, faceDataUrl)
                      setPlayers(generatePlayersForTeam(selectedTeam))
                    }
                  }
                  setEditingPlayer(null)
                }}
                className="rounded-lg bg-[#00ffc8] px-5 py-2 text-sm font-bold text-[#05231b] hover:bg-[#00e6b5]"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
