"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import { LinkLeve as Link } from "@/components/link-leve"
import { useJogoRegistrado } from "@/lib/beneficios"
import { AvisoDeRegistro } from "@/components/registro-necessario"
import { BandeiraPais } from "@/components/bandeira-pais"
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
  ArrowLeftRight,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AbasDoModal, GrupoDeCampos } from "@/components/modal-kit"
import { nomeOficialDoClube } from "@/lib/club-names"
import { hardNavigate } from "@/lib/hard-navigation"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  allPoolTeams,
  isKitVariantAvailable,
  type Team
} from "@/lib/teams-data"
import { allInternationalTeams } from "@/lib/international-teams"
import {
  NATIONAL_TEAMS,
  getNationalPlayerSources,
  getNationalStrength,
  getNationalTeamById,
} from "@/lib/national-teams"
import { getNationalCrestUrl } from "@/lib/national-assets"
import { getPlayersForTeam } from "@/lib/players-data"
import { getPlayerOverride, setPlayerOverride, defaultPlayerAttributes, reputationBonus,
  caracteristicasDaPosicao, MAX_CARACTERISTICAS, BONUS_CARACTERISTICA } from "@/lib/player-overrides"
import { TeamCrest, setCustomLogoUrl, getLocalCustomLogoUrl, removeCustomLogoUrl, listLocalCustomLogos } from "@/components/team-crest"
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
import {
  criarAtleta,
  removerAtleta,
  transferirAtleta,
  listLocalRosterPatches,
  normNome,
  type AtletaCriado,
} from "@/lib/roster-overrides"
import { validarElenco } from "@/lib/validacao-de-elenco"
import { PlayerAvatar } from "@/components/player-avatar"
import { setPlayerPhotoOverride } from "@/lib/player-photos"
import { KitImage } from "@/components/match/kit-image"
import { getTeamStadiumBackground } from "@/lib/pre-match-bg"

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
  // O MESMO TYPO ESTAVA AQUI. Corrigir só o DIV_COUNTRY tirou os clubes do balde
  // "Internacional", mas a liga deles ainda apareceria com o rótulo gerado —
  // "PRIMERA A COL", do `div.replace(/_/g," ").toUpperCase()` que serve de
  // fallback — porque este mapa também escrevia `primeira_a_col`. As duas
  // grafias ficam, como no mapa de nível: dado antigo que use a errada continua
  // com nome legível em vez de cair no fallback.
  liga_argentina: "Liga Argentina", primera_a_col: "Primera A", primeira_a_col: "Primera A",
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
  // ⚠️ `primera_a_col` (espanhol), NAO `primeira_a_col` (portugues). O mapa tinha
  // a grafia portuguesa e a divisao real se chama `primera_a_col` — a busca nunca
  // casava e TODO clube colombiano caia no `?? "INT"` do fim da funcao, virando
  // "Internacional" no editor em vez de ter a propria liga. Uma letra.
  liga_argentina: "ARG", primera_a_col: "COL",
  primera_div_chi: "CHI", primera_b_chi: "CHI", primera_div_ury: "URU",
  saudi_pro: "KSA", saudi_first_div: "KSA",
  j_league: "JPN", k_league_1: "KOR", chinese_super: "CHN",
  // Clubes internacionais criados (antes caíam todos em "Internacional"). O código
  // é o NOME do país (mesmo que o pool produz via normalizeCountry) para os que não
  // têm sigla no PAIS_CODE — assim clube criado e clube do pool caem no MESMO grupo.
  primera_a_ecu: "Equador", primera_div_ecu: "Equador",
  primera_div_per: "Peru", primera_div_bol: "Bolívia",
  primera_div_par: "Paraguai", primera_div_ven: "Venezuela",
  super_league_gre: "Grécia", superliga_den: "Dinamarca",
  fortuna_liga_cze: "Tchéquia", premyer_liqa_aze: "Azerbaijão",
  eliteserien_nor: "Noruega", protathlima_cyp: "Chipre",
  premier_liga_kaz: "Cazaquistão",
}

// Nome do país (PT-BR) por código, para os cabeçalhos de grupo do editor.
const COUNTRY_NAME: Record<string, string> = {
  BRA: "Brasil", ENG: "Inglaterra", ESP: "Espanha", ITA: "Itália",
  GER: "Alemanha", FRA: "França", POR: "Portugal", NED: "Holanda",
  SCO: "Escócia", TUR: "Turquia", BEL: "Bélgica", RUS: "Rússia",
  USA: "Estados Unidos", MEX: "México", ARG: "Argentina", COL: "Colômbia",
  CHI: "Chile", URU: "Uruguai", KSA: "Arábia Saudita", JPN: "Japão",
  KOR: "Coreia do Sul", CHN: "China", INT: "Internacional", SEL: "Seleções",
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
  div.startsWith("national:")
    ? `Seleção · ${div.slice("national:".length)}`
    : DIV_LABEL[div] ?? div.replace(/_/g, " ").toUpperCase()

/**
 * NIVEL DA DIVISAO dentro do país — 1 é a primeira divisão, 2 a segunda, e assim
 * por diante. É o que ordena o painel: a liga de cima vem antes da de baixo.
 *
 * Antes as ligas de um país saíam ordenadas por PRESTÍGIO do clube mais forte do
 * grupo. Quase sempre dava certo por acidente, mas bastava um clube grande caído
 * (rebaixado, como o Sampdoria na Serie B) para a segunda divisão aparecer ACIMA
 * da primeira — e o Brasil nem tinha ligas: os clubes vinham repartidos por
 * estado, sem Série A / B / C / D.
 */
const DIV_TIER: Record<string, number> = {
  serie_a: 1, serie_b: 2, serie_c: 3, serie_d: 4,
  premier_league: 1, championship: 2,
  la_liga: 1, la_liga_2: 2,
  serie_a_ita: 1, serie_b_ita: 2,
  bundesliga: 1, bundesliga_2: 2,
  ligue_1: 1, ligue_2: 2,
  primeira_liga: 1, eredivisie: 1, scottish_prem: 1, super_lig: 1,
  pro_league_bel: 1, russian_prem: 1, mls: 1, liga_mx: 1,
  liga_argentina: 1, primeira_a_col: 1, primera_a_col: 1,
  primera_div_chi: 1, primera_b_chi: 2, primera_div_ury: 1,
  saudi_pro: 1, saudi_first_div: 2,
  j_league: 1, k_league_1: 1, chinese_super: 1,
  primera_a_ecu: 1, primera_div_ecu: 2, primera_div_per: 1, primera_div_bol: 1,
  primera_div_par: 1, primera_div_ven: 1, super_league_gre: 1, superliga_den: 1,
  fortuna_liga_cze: 1, premyer_liqa_aze: 1, eliteserien_nor: 1, protathlima_cyp: 1,
  premier_liga_kaz: 1,
}

/** Etiqueta curta do nível ("1ª div."), usada ao lado do nome da liga. */
const tierLabel = (tier: number): string | null =>
  tier >= 1 && tier <= 8 ? `${tier}ª div.` : null

/** Ordem dos grupos SEM liga conhecida: estaduais depois das ligas, "demais" por último. */
const TIER_ESTADUAL = 50
const TIER_DEMAIS = 99

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
import { inferredNationality, normalizeCountry, PAIS_DESCONHECIDO } from "@/lib/country-normalize"

// PAÍSES para os seletores (atleta, clube e técnico).
//
// Sai de NATIONAL_TEAMS, que é a lista canônica de seleções do jogo — e não das
// chaves de PAIS_CODE, que carregam grafias repetidas de propósito ("França" e
// "Franca", "Holanda" e "Países Baixos") para aceitar o que vem dos seeds.
//
// Era campo de TEXTO LIVRE: digitar "Franca" sem cedilha, ou "Holanda" onde o
// resto do jogo espera "Países Baixos", quebrava em silêncio a bandeira e o
// vínculo com a seleção. Lista fechada acaba com essa classe de erro.
const PAISES_ORDENADOS: string[] = Array.from(
  new Set(NATIONAL_TEAMS.map(n => n.name)),
).sort((a, b) => a.localeCompare(b, "pt-BR"))

/**
 * Lado sugerido a partir da posição, para o atleta que ainda não tem o campo.
 *
 * LD/PD são direita e LE/PE são esquerda por definição — herdar isso evita
 * abrir a ficha de um lateral-esquerdo e encontrar "Direita" no seletor. As
 * demais posições não têm lado implícito e começam no centro.
 */
function ladoDaPosicao(posicao: string): "E" | "D" | "C" {
  if (posicao === "LD" || posicao === "PD") return "D"
  if (posicao === "LE" || posicao === "PE") return "E"
  return "C"
}

const isPoolTeam = (team: Team) => typeof team.divisao === "string" && team.divisao.startsWith("pool:")
const isNationalTeam = (team: Team | null | undefined) => Boolean(team?.file_key.startsWith("nation_"))

const countryCodeOf = (team: Team): string => {
  if (isNationalTeam(team)) return "SEL"
  if (isPoolTeam(team)) {
    // O valor cru virava "país": clube com pais="SP" (sigla de estado) criava um
    // grupo "SP" ao lado de "São Paulo", e fragmentos de nome de clube
    // ("SPORT", "OPERARIOMT") viravam grupos-fantasma. Normaliza primeiro —
    // UFs viram Brasil, lixo vira Indefinido — e só então busca o código.
    const pais = normalizeCountry(team.pais ?? (team.divisao as string).slice(5))
    if (pais === "Brasil") return "BRA"
    if (pais === PAIS_DESCONHECIDO) return "INT"
    // Antes: PAIS_CODE[pais] ?? "INT" — todo país fora do mapa (Peru, Grécia,
    // Sérvia, Áustria…) caía num "Internacional > Outros clubes" gigante (relato
    // "900+ times em Internacional"). Agora, sem sigla no mapa, o PRÓPRIO nome do
    // país vira o código do grupo — cada país tem seu grupo.
    return PAIS_CODE[pais] ?? pais
  }
  return DIV_COUNTRY[team.divisao] ?? "INT"
}

// Segundo nível de agrupamento: a LIGA do clube (com o nível da divisão), e só
// quem não tem liga cai no estado (Brasil) ou em "Demais clubes".
const subGroupOf = (team: Team): { key: string; label: string; tier: number } => {
  const code = countryCodeOf(team)
  if (code === "SEL") {
    const confederation = team.divisao.replace(/^national:/, "")
    return { key: `SEL|${confederation}`, label: confederation, tier: 1 }
  }
  // Clube do pool nao tem liga no dado — vai para o estado (Brasil) ou para o
  // balde do pais, sempre DEPOIS das divisoes oficiais.
  if (isPoolTeam(team)) {
    if (code === "BRA" && team.estado) {
      return { key: `BRA|${team.estado}`, label: ESTADO_LABEL[team.estado] ?? team.estado, tier: TIER_ESTADUAL }
    }
    return { key: `${code}|pool`, label: "Demais clubes", tier: TIER_DEMAIS }
  }
  // Curado (inclusive os brasileiros, que antes vinham por estado): a liga é o grupo.
  return {
    key: `${code}|${team.divisao}`,
    label: formatDivisao(team.divisao),
    tier: DIV_TIER[team.divisao] ?? 9,
  }
}

// Mock players data generator based on team - completamente deterministico (sem Math.random)
// Monta a lista de jogadores REAL do time (antes era uma lista fixa/fake, IGUAL para todos
// os clubes). Usa getPlayersForTeam com raw=true para ter o nome ORIGINAL (chave da edicao),
// e mostra o valor ja editado quando existe override.
interface EditorPlayer {
  id: number
  originalName: string
  sourceTeamKey?: string
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
  const nationalId = team.file_key.startsWith("nation_")
    ? team.file_key.slice("nation_".length)
    : null
  const nationalTeam = nationalId ? getNationalTeamById(nationalId) : undefined
  const sources = nationalTeam
    ? getNationalPlayerSources(nationalTeam, { raw: true })
        .sort((a, b) => b.player.base - a.player.base)
        .slice(0, 55)
    : getPlayersForTeam(team, { raw: true }).map(player => ({ player, team }))

  return sources.map(({ player: p, team: sourceTeam }, i) => {
    // Na seleção, a edição pertence à própria seleção. Antes era gravada na
    // chave do clube do atleta, alterando o jogador no clube e podendo sumir da
    // convocação nacional ao recarregar.
    const overrideKey = nationalTeam ? team.file_key : sourceTeam.file_key
    const ov = getPlayerOverride(overrideKey, p.nome)
    // Teto rígido de 99 (relato "overall 99+"): overrides/dados antigos podiam
    // trazer valor acima do máximo; aqui o editor nunca mostra além de 99.
    const base = Math.min(99, Math.max(1, ov?.base ?? p.base))
    const pos = ov?.pos ?? p.pos
    const def = defaultPlayerAttributes(base, pos)
    return {
      id: i + 1,
      originalName: p.nome,
      sourceTeamKey: overrideKey,
      nome: ov?.nome ?? p.nome,
      posicao: pos,
      // Nacionalidade: edicao manual > real (Transfermarkt) > pais do CLUBE como
      // ultimo recurso. Essa ultima etapa segue a MESMA convencao que o mercado
      // ja usa (inferredNationality). Antes a coluna ficava "-" para 82% do
      // elenco; a maioria desses atletas joga no proprio pais, entao inferir do
      // clube acerta muito mais do que deixar em branco. Edicao manual sempre
      // vence, e quem tiver nacionalidade real nunca e sobrescrito.
      pais: ov?.nac ?? p.nac ?? inferredNationality(sourceTeam.pais) ?? nationalTeam?.name ?? "-",
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

// Todos os clubes e selecoes no mesmo formato visual do editor. A chave `nation_`
// tambem e reconhecida pelo TeamCrest e pelo restante do modo selecao.
const clubTeams = [...serieATeams, ...serieBTeams, ...serieCTeams, ...serieDTeams, ...allInternationalTeams, ...allPoolTeams]
const nationalEditorTeams: Team[] = NATIONAL_TEAMS.map(nation => ({
  nome: nation.name,
  curto: nation.code,
  cidade: "",
  estado: "",
  cor1: nation.cor1,
  cor2: nation.cor2,
  prestigio: getNationalStrength(nation),
  torcida: 0,
  estadio_cap: 0,
  saldo: 0,
  file_key: `nation_${nation.id}`,
  estadio_nome: "",
  patrocinador: "",
  escudo_url: getNationalCrestUrl(nation.id),
  divisao: `national:${nation.confederation}`,
  pais: nation.name,
}))
const allTeams = [...clubTeams, ...nationalEditorTeams]

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

  const { registrado, hidratado: registroHidratado } = useJogoRegistrado()

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(allTeams[0])
  const [searchTeam, setSearchTeam] = useState("")
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0)
  // Edicao de jogador (nome/posicao/overall) — persiste via player-overrides.
  const [editingPlayer, setEditingPlayer] = useState<EditorPlayer | null>(null)
  // Aba do modal de jogador. Ver components/modal-kit.tsx: o modal era um scroll
  // unico de nome ate atributos, com o Salvar fora da vista.
  const [abaDoJogador, setAbaDoJogador] = useState("identidade")
  const [pDraft, setPDraft] = useState({ nome: "", posicao: "", overall: 0, idade: 0, nac: "", preferredFoot: "Direita" as "Direita" | "Esquerda" | "Ambidestro", reputation: "normal" as "normal" | "estrela" | "top_mundial", lado: "D" as "E" | "D" | "C", traits: [] as string[], faceDataUrl: "", pace: 0, shooting: 0, passing: 0, dribbling: 0, defending: 0, physical: 0 })
  const openPlayerEdit = (p: EditorPlayer) => {
    setEditingPlayer(p)
    // Abrir SEMPRE na primeira aba: herdar a aba do jogador anterior faz o modal
    // abrir em "Atributos" para quem so queria corrigir um nome.
    setAbaDoJogador("identidade")
    const sourceTeamKey = p.sourceTeamKey ?? selectedTeam?.file_key
    const ov = sourceTeamKey ? getPlayerOverride(sourceTeamKey, p.originalName) : null
    setPDraft({ nome: p.nome, posicao: p.posicao, overall: p.overall, idade: p.idade, nac: ov?.nac ?? p.pais ?? "", preferredFoot: ov?.preferredFoot ?? "Direita", reputation: ov?.reputation ?? "normal", lado: ov?.lado ?? ladoDaPosicao(p.posicao), traits: (ov?.traits ?? []).slice(0, MAX_CARACTERISTICAS), faceDataUrl: ov?.faceDataUrl ?? "", pace: p.pace, shooting: p.shooting, passing: p.passing, dribbling: p.dribbling, defending: p.defending, physical: p.physical })
  }

  /** Aplica reputacao recomputando atributos a partir da base, para trocar de
   *  reputacao ser reversivel (estrela<->top<->normal sem acumular). */
  const aplicarReputacao = (rep: "normal" | "estrela" | "top_mundial") => {
    if (!editingPlayer) return
    const bonus = reputationBonus(rep)
    const clamp = (n: number) => Math.max(40, Math.min(99, n))
    setPDraft(d => ({
      ...d,
      reputation: rep,
      overall: clamp(editingPlayer.overall + bonus),
      pace: clamp(editingPlayer.pace + bonus),
      shooting: clamp(editingPlayer.shooting + bonus),
      passing: clamp(editingPlayer.passing + bonus),
      dribbling: clamp(editingPlayer.dribbling + bonus),
      defending: clamp(editingPlayer.defending + bonus),
      physical: clamp(editingPlayer.physical + bonus),
    }))
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
    const nationalCount = Object.keys(all).filter(fileKey => fileKey.startsWith("nation_")).length
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
        title: "Exportar edicoes de clubes e selecoes",
        defaultPath: "clubes-selecoes-overrides-export.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      if (!filePath) return
      await writeTextFile(filePath as string, json)
      setExportMsg(`${count} equipe(s), incluindo ${nationalCount} seleção(ões), exportadas.`)
    } else {
      const blob = new Blob([json], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "clubes-selecoes-overrides-export.json"
      a.click()
      URL.revokeObjectURL(a.href)
      setExportMsg(`${count} equipe(s), incluindo ${nationalCount} seleção(ões), exportadas.`)
    }
    setTimeout(() => setExportMsg(null), 4000)
  }

  /**
   * Exporta os ELENCOS editados (atletas criados, removidos e transferidos).
   *
   * Arquivo separado do de clubes de propósito: o outro é fundido por
   * `merge-team-overrides.mjs` e tem outro formato. Aqui o par é
   * `node scripts/merge-roster-overrides.mjs <arquivo>`.
   */
  const handleExportElencos = async () => {
    const todos = listLocalRosterPatches()
    const clubes = Object.keys(todos).length
    if (clubes === 0) {
      setExportMsg("Nenhum elenco editado para exportar.")
      setTimeout(() => setExportMsg(null), 3000)
      return
    }
    const criados = Object.values(todos).reduce((n, p) => n + (p.criados?.length ?? 0), 0)
    const removidos = Object.values(todos).reduce((n, p) => n + (p.removidos?.length ?? 0), 0)
    const json = JSON.stringify(todos, null, 2)
    const aviso = `${clubes} clube(s): ${criados} atleta(s) criado(s), ${removidos} removido(s).`

    if (isTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog")
      const { writeTextFile } = await import("@tauri-apps/plugin-fs")
      const filePath = await save({
        title: "Exportar elencos editados",
        defaultPath: "elencos-editados-export.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      if (!filePath) return
      await writeTextFile(filePath as string, json)
    } else {
      const blob = new Blob([json], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "elencos-editados-export.json"
      a.click()
      URL.revokeObjectURL(a.href)
    }
    setExportMsg(aviso)
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
          [variant]: { ...(prev.kits?.[variant] ?? {}), imageUrl: dataUrl, disabled: false },
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
            [variant]: { ...(stored.kits?.[variant] ?? {}), imageUrl: dataUrl, disabled: false },
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
      // ⚠️ SÓ o escudo local: escudo que veio do canal ou do build não é "custom"
      // desta instalação, e não há o que remover.
      setHasCustomLogo(!!getLocalCustomLogoUrl(selectedTeam.file_key))
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
      if (isNationalTeam(selectedTeam)) {
        setTeamOverride(fileKey, { ...(getTeamOverride(fileKey) ?? {}), logoUrl: compressed })
        await flushPersistentStore()
      }
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
            const compressed = await compressImageDataUrl(dataUrl, 256)
            setCustomLogoUrl(fileKey, compressed)
            if (isNationalTeam(selectedTeam)) {
              setTeamOverride(fileKey, { ...(getTeamOverride(fileKey) ?? {}), logoUrl: compressed })
              await flushPersistentStore()
            }
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
    if (isNationalTeam(selectedTeam)) {
      const rest = { ...(getTeamOverride(selectedTeam.file_key) ?? {}) }
      delete rest.logoUrl
      setTeamOverride(selectedTeam.file_key, rest)
      void flushPersistentStore()
    }
    setHasCustomLogo(false)
  }

  const setThirdKitDisabled = async (disabled: boolean) => {
    if (!selectedTeam?.file_key) return
    const fallback = {
      primary: selectedTeam.cor1 || "#222222",
      secondary: selectedTeam.cor2 || "#ffffff",
      pattern: "solid" as KitPattern,
    }
    setEditDraft(prev => ({
      ...prev,
      kits: {
        ...prev.kits,
        third: { ...fallback, ...prev.kits?.third, disabled, ...(disabled ? { imageUrl: undefined } : {}) },
      },
    }))
    const stored = getTeamOverride(selectedTeam.file_key) ?? {}
    setTeamOverride(selectedTeam.file_key, {
      ...stored,
      kits: {
        ...stored.kits,
        third: { ...fallback, ...stored.kits?.third, disabled, ...(disabled ? { imageUrl: undefined } : {}) },
      },
    })
    await flushPersistentStore()
    setTeamsRevision(value => value + 1)
  }

  useEffect(() => {
    if (selectedTeam) {
      setPlayers(generatePlayersForTeam(selectedTeam))
      setYouthPlayers(isNationalTeam(selectedTeam) ? [] : getYouthRoster(selectedTeam.file_key))
      if (isNationalTeam(selectedTeam)) {
        setActiveTab(current => current === "juniores" ? "principal" : current)
      }
      setSelectedPlayerIndex(0)
      initDraft(selectedTeam)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam?.file_key, storeReady])

  const filteredTeams = useMemo(() => {
    if (!searchTeam) return resolvedTeams
    return resolvedTeams.filter(team =>
      team.nome.toLowerCase().includes(searchTeam.toLowerCase()) ||
      team.curto.toLowerCase().includes(searchTeam.toLowerCase())
    )
  }, [searchTeam, resolvedTeams])

  // Agrupa os times por País > Liga (divisões da mais alta para a mais baixa;
  // estaduais e clubes sem liga vêm por último). Os países seguem por prestígio,
  // com Brasil e Seleções no topo.
  const groupedTeams = useMemo(() => {
    const byCountry = new Map<string, {
      code: string
      name: string
      subs: Map<string, { key: string; label: string; tier: number; teams: Team[] }>
    }>()

    for (const team of filteredTeams) {
      const code = countryCodeOf(team)
      if (!byCountry.has(code)) {
        byCountry.set(code, { code, name: COUNTRY_NAME[code] ?? code, subs: new Map() })
      }
      const country = byCountry.get(code)!
      const sub = subGroupOf(team)
      if (!country.subs.has(sub.key)) {
        country.subs.set(sub.key, { key: sub.key, label: sub.label, tier: sub.tier, teams: [] })
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
          // Nível da divisão primeiro (1ª antes da 2ª); prestígio só desempata
          // entre grupos do MESMO nível, e o nome fecha a ordem.
          .sort((a, b) =>
            a.tier - b.tier ||
            maxPrestige(b.teams) - maxPrestige(a.teams) ||
            a.label.localeCompare(b.label, "pt-BR"))
        const count = subs.reduce((n, s) => n + s.teams.length, 0)
        const prestige = subs.reduce((m, s) => Math.max(m, maxPrestige(s.teams)), 0)
        return { ...country, subs, count, prestige }
      })
      .sort((a, b) => {
        if (a.code === "BRA") return -1
        if (b.code === "BRA") return 1
        if (a.code === "SEL") return -1
        if (b.code === "SEL") return 1
        return b.prestige - a.prestige || a.name.localeCompare(b.name)
      })
  }, [filteredTeams])

  const isSearching = searchTeam.trim().length > 0
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(() => new Set(["BRA", "SEL"]))
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
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  const toggleSub = (key: string) =>
    setExpandedSubs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
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

  // ─── ELENCO EDITADO: criar, remover e transferir ──────────────────────────
  //
  // Até aqui o editor só sabia MUDAR um atleta que já existia. Criar, apagar e
  // mudar de clube são operações sobre a LISTA, e por isso moram noutro módulo
  // (lib/roster-overrides), aplicado dentro de `players-data.getPlayersForTeam`.
  //
  // Os juniores seguem pelo caminho próprio deles: aquela lista inteira é
  // guardada no save (lib/youth-editor) e não passa pelo cadastro do jogo.
  //
  // Seleção fica de fora: a convocação é montada a partir dos clubes
  // (`getNationalPlayerSources`), então criar alguém "na seleção" não teria onde
  // existir. Quem quer um atleta novo na seleção cria no clube dele.
  const podeMexerNoElenco = activeTab !== "dados" && Boolean(selectedTeam) && !isNationalTeam(selectedTeam)

  /** Nome que ainda não existe no clube — o patch recusa nome repetido. */
  const nomeInedito = (base: string) => {
    const usados = new Set(players.map(p => normNome(p.originalName)))
    if (!usados.has(normNome(base))) return base
    for (let i = 2; i < 99; i++) {
      const tentativa = `${base} ${i}`
      if (!usados.has(normNome(tentativa))) return tentativa
    }
    return `${base} ${players.length + 1}`
  }

  const adicionarAtleta = async () => {
    if (!selectedTeam || !podeMexerNoElenco) return
    if (activeTab === "juniores") {
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
      return
    }
    const nome = nomeInedito("Novo jogador")
    const attrs = defaultPlayerAttributes(60, "MEI")
    criarAtleta(selectedTeam.file_key, {
      nome, pos: "MEI", idade: 18, base: 60,
      nac: selectedTeam.pais || undefined, lado: "C", ...attrs,
    })
    await flushPersistentStore()
    const proximos = generatePlayersForTeam(selectedTeam)
    setPlayers(proximos)
    // Abre o modal já no atleta criado: um "Novo jogador" de 60 na lista não é
    // o objetivo de ninguém — o objetivo é a ficha que vem depois.
    const criado = proximos.find(p => normNome(p.originalName) === normNome(nome))
    if (criado) openPlayerEdit(criado)
  }

  const removerAtletaSelecionado = async () => {
    if (!selectedTeam || !podeMexerNoElenco) return
    const alvo = sortedPlayers[selectedPlayerIndex]
    if (!alvo) return
    if (activeTab === "juniores") {
      const next = youthPlayers.filter(player => player.id !== alvo.id)
      setYouthPlayers(next)
      saveYouthRoster(selectedTeam.file_key, next)
      setSelectedPlayerIndex(index => Math.max(0, Math.min(index, next.length - 1)))
      return
    }
    removerAtleta(selectedTeam.file_key, alvo.originalName)
    await flushPersistentStore()
    const proximos = generatePlayersForTeam(selectedTeam)
    setPlayers(proximos)
    setSelectedPlayerIndex(index => Math.max(0, Math.min(index, proximos.length - 1)))
  }

  /** Ficha completa do atleta como ele está HOJE — é o que viaja na transferência. */
  const fichaDoAtleta = (p: EditorPlayer): AtletaCriado => {
    const ov = p.sourceTeamKey ? getPlayerOverride(p.sourceTeamKey, p.originalName) : null
    return {
      nome: p.nome, pos: p.posicao, idade: p.idade, base: p.overall,
      nac: p.pais && p.pais !== "-" ? p.pais : undefined,
      lado: ov?.lado, preferredFoot: ov?.preferredFoot, reputation: ov?.reputation,
      traits: ov?.traits,
      pace: p.pace, shooting: p.shooting, passing: p.passing,
      dribbling: p.dribbling, defending: p.defending, physical: p.physical,
    }
  }

  const [transferindo, setTransferindo] = useState<EditorPlayer | null>(null)
  const [buscaDestino, setBuscaDestino] = useState("")
  const [transferMsg, setTransferMsg] = useState<string | null>(null)

  const destinosPossiveis = useMemo(() => {
    if (!transferindo || !selectedTeam) return []
    const termo = buscaDestino.trim().toLowerCase()
    return resolvedTeams
      .filter(t => t.file_key !== selectedTeam.file_key && !t.file_key.startsWith("nation_"))
      .filter(t => !termo || t.nome.toLowerCase().includes(termo) || t.curto.toLowerCase().includes(termo))
      .slice(0, 60)
  }, [transferindo, selectedTeam, buscaDestino, resolvedTeams])

  const confirmarTransferencia = async (destino: Team) => {
    if (!transferindo || !selectedTeam) return
    const ok = transferirAtleta(
      selectedTeam.file_key,
      destino.file_key,
      fichaDoAtleta(transferindo),
      transferindo.originalName,
    )
    await flushPersistentStore()
    setTransferMsg(ok
      ? `${transferindo.nome} agora é do ${destino.nome}.`
      : `O ${destino.nome} já tem um atleta com esse nome.`)
    setTimeout(() => setTransferMsg(null), 4000)
    setTransferindo(null)
    setBuscaDestino("")
    if (!ok) return
    const proximos = generatePlayersForTeam(selectedTeam)
    setPlayers(proximos)
    setSelectedPlayerIndex(index => Math.max(0, Math.min(index, proximos.length - 1)))
  }

  // Aviso de plantel. Só no elenco principal: a lista de juniores é uma seleção
  // de garotos, não um time que vai a campo, e exigir onze de linha dela seria
  // inventar uma regra que o jogo não tem.
  const problemasDoElenco = useMemo(
    () => (activeTab === "principal" && !isNationalTeam(selectedTeam)
      ? validarElenco(players.map(p => ({ pos: p.posicao })))
      : []),
    [activeTab, players, selectedTeam],
  )

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
  const stadiumBackground = getTeamStadiumBackground(
    selectedTeam?.nome,
    editDraft.estadio_nome ?? selectedTeam?.estadio_nome,
  ) ?? "/images/stadium-night.webp"

  // EDITOR = extra de quem registrou (ver lib/beneficios.ts). O convite fica
  // DEPOIS de todos os hooks, nunca antes: um return condicional no meio da
  // lista de hooks muda a contagem entre renders e derruba a tela com o erro
  // #310 do React — foi assim que o escritorio quebrou uma vez.
  if (registroHidratado && !registrado) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#05080a] p-6">
        <AvisoDeRegistro id="editor" className="max-w-xl" />
        <Link href="/splash?menu=1" className="mt-5 text-sm text-white/40 transition-colors hover:text-white/70">
          Voltar ao menu
        </Link>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#05080a] text-white">
      {/* Stadium background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <Image
          src={stadiumBackground}
          alt="Stadium"
          fill
          className="object-cover opacity-30 saturate-50"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05080a] via-[#05080a]/85 to-[#07110f]/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(0,255,200,0.09),transparent_34%),radial-gradient(circle_at_15%_80%,rgba(0,150,255,0.06),transparent_30%)]" />
      </div>

      {/* Header — barra superior com identidade do editor. */}
      <header className="relative z-10 h-[76px] flex-shrink-0 bg-[#060a0c]/80 backdrop-blur-2xl border-b border-white/[0.08] px-6 flex items-center justify-between">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/25 to-transparent" />
        <div className="flex items-center gap-4">
          <Link
            href="/splash?menu=1"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-lg transition-all text-sm font-medium border border-white/[0.06]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Menu</span>
          </Link>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand-2)]/5 border border-[var(--brand)]/25 shadow-[0_0_30px_rgba(0,255,200,0.08)]">
              <Shield className="h-5 w-5 text-[var(--brand)]" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">Editor de Clubes e Seleções</h1>
                <span className="rounded-full border border-[var(--brand)]/20 bg-[var(--brand)]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-[var(--brand)]">Studio</span>
              </div>
              <p className="text-[10px] text-white/35 uppercase tracking-[0.18em]">Elencos · Escudos · Uniformes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/25">
          <kbd className="px-2 py-0.5 bg-white/5 rounded border border-white/10 font-mono">ESC</kbd>
          <span className="hidden sm:inline">para voltar</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-3 overflow-hidden relative z-10 p-3">

        {/* Left Panel – Teams List */}
        <aside className="w-72 lg:w-80 flex-shrink-0 flex flex-col overflow-hidden rounded-2xl bg-[#080d0f]/88 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/30">
          {/* Search */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Diretório de equipes</span>
              <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-white/30">{filteredTeams.length}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
              <input
                type="text"
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                placeholder="Procurar clube ou seleção..."
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-black/25 border border-white/[0.09] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[var(--brand)]/40 focus:ring-4 focus:ring-[var(--brand)]/[0.06] transition-all"
              />
            </div>
          </div>

          {/* Column header */}
          <div className="grid grid-cols-[1fr_44px] bg-white/[0.03] text-white/30 text-[10px] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
            <div className="px-3 py-2">País · Competição · Time</div>
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
                    {/* BANDEIRA no lugar da sigla. A coluna era um bloco de
                        siglas ("BRA", "EQUA", "RUB") que exigia decifrar o
                        código de cada país; a bandeira se reconhece de relance. */}
                    <BandeiraPais codigo={country.code} titulo={country.name} className="w-5 h-[13px]" />
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
                          <span className="flex-1 text-left text-[11px] font-medium text-[var(--brand)]/70 truncate">{sub.label}</span>
                          {/* Nível da divisão: deixa explícito quem é a de cima e quem é a de baixo. */}
                          {tierLabel(sub.tier) && (
                            <span className="shrink-0 rounded border border-white/10 px-1 text-[8px] font-bold uppercase tracking-wider text-white/30">
                              {tierLabel(sub.tier)}
                            </span>
                          )}
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
                                  ? "bg-white/[0.07] border-l-2 border-l-[var(--brand)]"
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
            <span>{filteredTeams.length} clubes e seleções</span>
          </div>
        </aside>

        {/* Right Panel – Team Details */}
        <main className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070b0d]/80 backdrop-blur-xl shadow-2xl shadow-black/30">
          {selectedTeam && (
            <>
              {/* Team Info Header */}
              <div className="relative flex-shrink-0 border-b border-white/[0.07] overflow-hidden bg-gradient-to-r from-[#0a1212] via-[#08100f] to-[#080c0e]">
                {/* Team color glow */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(to right, transparent, ${teamColor}60, transparent)` }}
                />
                <div
                  className="pointer-events-none absolute -top-20 left-1/4 h-40 w-1/2 rounded-full blur-3xl opacity-10"
                  style={{ background: teamColor }}
                />

                <div className="relative px-7 py-5 flex items-center gap-6">
                  {/* Crest + import button */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                    <div
                      className="w-[72px] h-[72px] flex items-center justify-center rounded-2xl border shadow-xl"
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
                        className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium bg-white/[0.05] hover:bg-[var(--brand)]/15 text-white/40 hover:text-[var(--brand)] rounded border border-white/[0.08] hover:border-[var(--brand)]/30 transition-all"
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
                      <h2 className="text-2xl font-black tracking-tight text-white truncate">{selectedTeam.nome}</h2>
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
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {isNationalTeam(selectedTeam)
                          ? getNationalTeamById(selectedTeam.file_key.slice("nation_".length))?.confederation
                          : `${selectedTeam.estado}, ${selectedTeam.pais || "Brasil"}`}
                      </span>
                      {selectedTeam.estadio_nome && (
                        <>
                          <span className="text-white/15">·</span>
                          <span>{selectedTeam.estadio_nome}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Kits */}
                  <div className="hidden lg:flex items-center gap-1.5">
                    {(["home", "away", "third"] as const)
                      .filter(variant => isKitVariantAvailable(selectedTeam.file_key, variant))
                      .map((variant) => (
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
                    <div className="text-5xl font-black tracking-tighter" style={{ color: teamColor }}>
                      {selectedTeam.prestigio}
                    </div>
                    <div className="text-[9px] text-white/30 font-semibold tracking-widest mt-0.5">OVERALL</div>
                  </div>

                  {/* Tabs — segmented control contido, mais profissional. */}
                  <div className="flex-shrink-0 flex gap-1 rounded-xl border border-white/[0.08] bg-black/40 p-1">
                    {([
                      { id: "principal", label: "Elenco" },
                      { id: "juniores",  label: "Juniores" },
                      { id: "dados",     label: "Editar" },
                    ] as const).filter(({ id }) => id !== "juniores" || !isNationalTeam(selectedTeam)).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                          "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                          activeTab === id
                            ? "text-black shadow-md"
                            : "text-white/45 hover:bg-white/[0.06] hover:text-white/75"
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
                                ? "bg-white/[0.06] border-l-2 border-l-[var(--brand)]"
                                : index % 2 === 0
                                  ? "hover:bg-white/[0.03]"
                                  : "bg-white/[0.015] hover:bg-white/[0.035]"
                            )}
                          >
                            {/* FOTO na linha. O editor so mostrava avatar dentro
                                do modal de edicao — a lista era texto puro, e o
                                relato era exatamente "as fotos nao sao exibidas".
                                O rosto real vem do Transfermarkt por nome. */}
                            <div className={cn(
                              "flex items-center gap-2.5 px-3 py-2 text-left font-medium min-w-0",
                              isSelected ? "text-white" : "text-white/65"
                            )}>
                              <PlayerAvatar name={player.nome} position={player.posicao} fileKey={selectedTeam?.file_key} size="xs" />
                              <span className="truncate">{player.nome}</span>
                            </div>

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
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{displayedPlayers.length}</span>
                        <span className="text-white/30">/55 jogadores</span>
                      </div>
                      {/* AVISO DE PLANTEL — a regra do Brasfoot: sem goleiro ou
                          sem onze de linha, o clube não fecha um time. Erro é
                          vermelho; o resto é conselho. */}
                      {problemasDoElenco.slice(0, 2).map(problema => (
                        <span
                          key={problema.mensagem}
                          className={cn(
                            "flex items-center gap-1 text-[11px]",
                            problema.nivel === "erro" ? "text-rose-400" : "text-amber-400/80",
                          )}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {problema.mensagem}
                        </span>
                      ))}
                      {transferMsg && <span className="text-[11px] text-[var(--brand)]">{transferMsg}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={adicionarAtleta}
                        disabled={!podeMexerNoElenco}
                        title={podeMexerNoElenco ? "Cria um atleta neste clube" : "Não disponível para seleções"}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--brand)]/10 hover:bg-[var(--brand)]/20 text-[var(--brand)] rounded-lg transition-all border border-[var(--brand)]/20 disabled:cursor-not-allowed disabled:opacity-35"
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
                      {/* TRANSFERÊNCIA DE CADASTRO — sem proposta, sem salário,
                          sem janela. Isso é carreira, e carreira é o outro lado
                          do jogo. Aqui o atleta só passa a constar no outro clube. */}
                      <button
                        onClick={() => {
                          if (activeTab !== "principal" || !podeMexerNoElenco) return
                          const p = sortedPlayers[selectedPlayerIndex] as EditorPlayer | undefined
                          if (!p) return
                          setBuscaDestino("")
                          setTransferindo(p)
                        }}
                        disabled={activeTab !== "principal" || !podeMexerNoElenco}
                        title="Move o atleta para outro clube (cadastro, não negociação)"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white rounded-lg transition-all border border-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                        <span className="hidden sm:inline">Transferir</span>
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
                        onClick={removerAtletaSelecionado}
                        disabled={!podeMexerNoElenco}
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
                    {/* AGRUPAMENTO (pedido: "organize o modal de editar time").
                        Eram doze campos numa grade unica e plana: nome, estadio,
                        tecnico e cor disputavam o mesmo espaco visual. Os campos e o
                        que cada um grava sao os MESMOS - mudou so o agrupamento. */}
                    <GrupoDeCampos
                      titulo={isNationalTeam(selectedTeam) ? "Identidade da seleção" : "Identidade do clube"}
                      nota="Como o time aparece em tabela, placar e escudo."
                    >
                      <div className="grid grid-cols-2 gap-3">
                        {/* NOME DE EXIBICAO — o curto, que aparece em tabela,
                            placar e escudo. O rotulo dizia "Nome completo", o
                            que confundia com o nome oficial (campo abaixo). */}
                        <div className="col-span-2">
                          <label className="block text-[10px] text-white/40 mb-1">
                            Nome de exibição <span className="text-white/25">· usado em tabelas e placares</span>
                          </label>
                          <input
                            type="text"
                            value={editDraft.nome ?? ""}
                            onChange={e => setEditDraft(p => ({ ...p, nome: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                          />
                        </div>
                        {/* NOME DO CLUBE (oficial) */}
                        <div className="col-span-2">
                          <label className="block text-[10px] text-white/40 mb-1">
                            {isNationalTeam(selectedTeam) ? "Nome oficial da seleção" : "Nome do clube"}
                            <span className="text-white/25"> · nome institucional</span>
                          </label>
                          <input
                            type="text"
                            value={editDraft.nomeOficial ?? ""}
                            placeholder={selectedTeam ? nomeOficialDoClube(selectedTeam) : "Clube de Regatas do Flamengo"}
                            onChange={e => setEditDraft(p => ({ ...p, nomeOficial: e.target.value }))}
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
                      </div>
                    </GrupoDeCampos>

                    <GrupoDeCampos titulo="Estádio" nota="A capacidade define público, bilheteria e o teto das obras.">
                      <div className="grid grid-cols-2 gap-3">
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
                      </div>
                    </GrupoDeCampos>

                    {/* TÉCNICO. O clube tinha estádio, cores e patrocínio, mas não
                        tinha treinador — não dava para corrigir o nome de quem
                        comanda o time nem a nacionalidade dele. */}
                    <GrupoDeCampos titulo="Comando" nota="Quem dirige a equipe nas telas de partida.">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">Nome do técnico</label>
                          <input
                            type="text"
                            value={editDraft.tecnico ?? ""}
                            placeholder="Ex: Abel Ferreira"
                            onChange={e => setEditDraft(p => ({ ...p, tecnico: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">País do técnico</label>
                          <select
                            value={editDraft.tecnicoPais ?? ""}
                            onChange={e => setEditDraft(p => ({ ...p, tecnicoPais: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-[#14252a] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-white/20 transition-all"
                          >
                            <option value="">— não informado —</option>
                            {PAISES_ORDENADOS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                    </GrupoDeCampos>

                    {/* PAÍS DO CLUBE. Sem isto não havia como consertar um clube
                        importado no país errado — e o país decide bandeira,
                        competições e a seleção dos atletas da casa. */}
                    <GrupoDeCampos titulo="Peso e alcance" nota="País, prestígio e reputação decidem competições, atração de atletas e receita.">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">País do clube</label>
                          <select
                            value={editDraft.pais ?? selectedTeam.pais ?? "Brasil"}
                            onChange={e => setEditDraft(p => ({ ...p, pais: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-[#14252a] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-white/20 transition-all"
                          >
                            {PAISES_ORDENADOS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        {/* PRESTÍGIO — força do elenco (a REPUTAÇÃO abaixo é outra coisa). */}
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
                        {/* REPUTAÇÃO. Separada do prestígio de propósito: prestígio é a
                            força do ELENCO, reputação é o alcance da MARCA. Um clube
                            tradicional pode estar mal montado, e um recém-rico pode ter
                            time bom sem tradição nenhuma. */}
                        <div>
                          <label className="block text-[10px] text-white/40 mb-1">Reputação</label>
                          <select
                            value={editDraft.reputacao ?? "nacional"}
                            onChange={e => setEditDraft(p => ({ ...p, reputacao: e.target.value as NonNullable<TeamOverride["reputacao"]> }))}
                            className="w-full px-3 py-2 text-xs bg-[#14252a] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-white/20 transition-all"
                          >
                            <option value="regional">Regional</option>
                            <option value="nacional">Nacional</option>
                            <option value="continental">Continental</option>
                            <option value="mundial">Mundial</option>
                          </select>
                        </div>
                      </div>
                    </GrupoDeCampos>

                    <GrupoDeCampos titulo="Marca e cores" nota="As cores valem em todo o jogo: escudo gerado, faixas e o uniforme padrão.">
                      <div className="grid grid-cols-2 gap-3">
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
                    </GrupoDeCampos>

                    {/* Kits */}
                    <section>
                      <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Uniformes</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {(["home", "away", "third"] as const).map((variant) => {
                          const labels = { home: "Principal", away: "Alternativo", third: "Terceiro" }
                          const kit = editDraft.kits?.[variant] ?? { primary: selectedTeam.cor1, secondary: selectedTeam.cor2, pattern: "solid" as KitPattern }
                          const isDisabled = variant === "third" && editDraft.kits?.third?.disabled === true
                          return (
                            <div key={variant} className={cn(
                              "relative overflow-hidden rounded-2xl border p-4 flex flex-col gap-3 transition-all",
                              isDisabled
                                ? "border-dashed border-white/10 bg-black/20"
                                : "border-white/[0.09] bg-gradient-to-b from-white/[0.055] to-white/[0.02] shadow-xl shadow-black/10",
                            )}>
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-[10px] font-bold text-white/70 uppercase tracking-[0.16em]">{labels[variant]}</div>
                                  <div className="mt-0.5 text-[9px] text-white/25">
                                    {isDisabled ? "Não utilizado pela equipe" : variant === "home" ? "Uniforme mandante" : variant === "away" ? "Uniforme visitante" : "Uniforme opcional"}
                                  </div>
                                </div>
                                {variant === "third" && (
                                  <button
                                    onClick={() => void setThirdKitDisabled(!isDisabled)}
                                    className={cn(
                                      "rounded-lg border px-2 py-1 text-[9px] font-semibold transition-all",
                                      isDisabled
                                        ? "border-[var(--brand)]/25 bg-[var(--brand)]/10 text-[var(--brand)] hover:bg-[var(--brand)]/15"
                                        : "border-rose-400/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15",
                                    )}
                                  >
                                    {isDisabled ? "Adicionar" : "Excluir"}
                                  </button>
                                )}
                              </div>

                              {/* Kit preview */}
                              {isDisabled ? (
                                <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 text-center">
                                  <Trash2 className="mb-2 h-5 w-5 text-white/20" />
                                  <span className="text-[10px] font-semibold text-white/35">Sem terceiro uniforme</span>
                                  <span className="mt-1 max-w-[150px] text-[9px] leading-relaxed text-white/20">Esta opção não aparecerá antes das partidas.</span>
                                </div>
                              ) : <div className="flex h-28 items-center justify-center rounded-xl bg-black/20">
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
                              </div>}

                              {/* Primary color */}
                              {!isDisabled && <div>
                                <label className="block text-[9px] text-white/30 mb-1">Cor base</label>
                                <div className="flex items-center gap-1.5">
                                  <input type="color" value={kit.primary}
                                    onChange={e => setEditDraft(p => ({
                                      ...p,
                                      kits: { ...p.kits, [variant]: { ...(p.kits?.[variant] ?? {}), primary: e.target.value } }
                                    }))}
                                    className="h-6 w-8 rounded cursor-pointer border border-white/10 bg-transparent"
                                  />
                                  <span className="text-[9px] font-mono text-white/30">{kit.primary}</span>
                                </div>
                              </div>}

                              {/* Secondary color */}
                              {!isDisabled && <div>
                                <label className="block text-[9px] text-white/30 mb-1">Cor detalhe</label>
                                <div className="flex items-center gap-1.5">
                                  <input type="color" value={kit.secondary}
                                    onChange={e => setEditDraft(p => ({
                                      ...p,
                                      kits: { ...p.kits, [variant]: { ...(p.kits?.[variant] ?? {}), secondary: e.target.value } }
                                    }))}
                                    className="h-6 w-8 rounded cursor-pointer border border-white/10 bg-transparent"
                                  />
                                  <span className="text-[9px] font-mono text-white/30">{kit.secondary}</span>
                                </div>
                              </div>}

                              {/* Pattern */}
                              {!isDisabled && <div>
                                <label className="block text-[9px] text-white/30 mb-1">Padrão</label>
                                <select
                                  value={kit.pattern}
                                  onChange={e => setEditDraft(p => ({
                                    ...p,
                                    kits: { ...p.kits, [variant]: { ...(p.kits?.[variant] ?? {}), pattern: e.target.value as KitPattern } }
                                  }))}
                                  className="w-full px-2 py-1 text-[10px] bg-white/[0.04] border border-white/[0.08] rounded text-white/70 focus:outline-none focus:border-white/20 transition-all"
                                >
                                  <option value="solid">Liso</option>
                                  <option value="stripes">Listras</option>
                                  <option value="diagonal">Diagonal</option>
                                  <option value="halves">Bicolor</option>
                                </select>
                              </div>}

                              {/* Image upload */}
                              {!isDisabled && <button
                                onClick={() => handleKitImageUpload(variant)}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 rounded border border-white/[0.08] transition-all"
                              >
                                <Upload className="h-2.5 w-2.5" />
                                Importar imagem
                              </button>}
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
                        <span className="text-[11px] text-[var(--brand)]">{exportMsg}</span>
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
                      {/* Elencos criados/removidos/transferidos saem noutro
                          arquivo: o merge deles é o merge-roster-overrides.mjs. */}
                      <button
                        onClick={handleExportElencos}
                        title="Exporta os atletas criados, removidos e transferidos no editor"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 rounded-lg transition-all border border-white/[0.06]"
                      >
                        Exportar elencos
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

      {/* Modal de TRANSFERÊNCIA — escolher o clube de destino. */}
      {transferindo && selectedTeam && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setTransferindo(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1e22]"
            onClick={e => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-white/[0.07] px-6 pb-3 pt-5">
              <h3 className="text-lg font-bold text-white">Transferir atleta</h3>
              <p className="mt-0.5 text-xs text-white/40">
                {transferindo.nome} sai do {selectedTeam.nome} e passa a constar no clube escolhido.
              </p>
              <p className="mt-1 text-[11px] text-amber-400/70">
                Isto é cadastro: não há proposta, valor nem contrato. Negociação é dentro da carreira.
              </p>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                <input
                  autoFocus
                  value={buscaDestino}
                  onChange={e => setBuscaDestino(e.target.value)}
                  placeholder="Buscar clube de destino..."
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 pl-9 pr-3 text-xs text-white placeholder-white/20 transition-all focus:border-white/20 focus:outline-none"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              {destinosPossiveis.length === 0 ? (
                <p className="px-6 py-6 text-center text-xs text-white/30">Nenhum clube encontrado.</p>
              ) : destinosPossiveis.map(destino => (
                <button
                  key={destino.file_key}
                  onClick={() => confirmarTransferencia(destino)}
                  className="flex w-full items-center gap-3 border-b border-white/[0.04] px-5 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                >
                  <TeamCrest team={destino} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-xs text-white/80">{destino.nome}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/25">
                    {formatDivisao(String(destino.divisao))}
                  </span>
                </button>
              ))}
            </div>
            <div className="shrink-0 border-t border-white/[0.07] px-6 py-3 text-right">
              <button
                onClick={() => setTransferindo(null)}
                className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition-all hover:bg-white/[0.08] hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edicao de JOGADOR (nome / posicao / overall) — persiste e viaja no build. */}
      {editingPlayer && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setEditingPlayer(null)}>
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1e22]" onClick={(e) => e.stopPropagation()}>
            {/* Cabecalho FIXO: o nome de quem se edita nao pode sumir na rolagem. */}
            <div className="shrink-0 border-b border-white/[0.07] px-6 pb-3 pt-5">
              <h3 className="text-lg font-bold text-white">Editar jogador</h3>
              <p className="mb-3 text-xs text-white/40">Original: {editingPlayer.originalName}</p>
              <AbasDoModal
                ativa={abaDoJogador}
                onTrocar={setAbaDoJogador}
                abas={[
                  { id: "identidade", rotulo: "Identidade" },
                  { id: "perfil", rotulo: "Perfil" },
                  { id: "caracteristicas", rotulo: "Características", selo: `${pDraft.traits.length}/${MAX_CARACTERISTICAS}` },
                  { id: "atributos", rotulo: "Atributos" },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {abaDoJogador === "identidade" && (<>
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <PlayerAvatar name={pDraft.nome || editingPlayer.nome} photoUrl={pDraft.faceDataUrl || undefined} position={pDraft.posicao} fileKey={selectedTeam?.file_key} size="xl" />
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
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-[var(--brand)]/50 focus:outline-none"
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
              </>)}

              {abaDoJogador === "perfil" && (<>
              <GrupoDeCampos titulo="Ficha do atleta" nota="Idade, pé e reputação mudam preço, salário e como a IA o avalia.">
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
                  <select value={pDraft.reputation} onChange={e => aplicarReputacao(e.target.value as typeof pDraft.reputation)} className="w-full rounded-lg border border-white/10 bg-[#14252a] px-3 py-2 text-sm text-white">
                    <option value="normal">Normal</option><option value="estrela">Estrela (+5)</option><option value="top_mundial">Top mundial (+10)</option>
                  </select>
                </div>
              </div>
              </GrupoDeCampos>

              <GrupoDeCampos titulo="Origem e lado" nota="A nacionalidade decide bandeira e convocação; o lado vale para quem joga aberto.">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Nacionalidade</label>
                  <select
                    value={pDraft.nac}
                    onChange={e => setPDraft(d => ({ ...d, nac: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-[#14252a] px-3 py-2 text-sm text-white focus:border-[var(--brand)]/50 focus:outline-none"
                  >
                    <option value="">— não informada —</option>
                    {/* Nacionalidade que já veio do seed e não está na lista continua
                        selecionável: trocar para lista não pode APAGAR o que existe. */}
                    {pDraft.nac && !PAISES_ORDENADOS.includes(pDraft.nac) && (
                      <option value={pDraft.nac}>{pDraft.nac} (fora da lista)</option>
                    )}
                    {PAISES_ORDENADOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {/* LADO. A posição só embute o lado em LD/LE/PD/PE — zagueiro,
                    volante, meia e atacante ficavam sem, e um canhoto era igual a
                    um destro no editor. */}
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-white/40">Lado</label>
                  <select
                    value={pDraft.lado}
                    onChange={e => setPDraft(d => ({ ...d, lado: e.target.value as typeof d.lado }))}
                    className="w-full rounded-lg border border-white/10 bg-[#14252a] px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="D">Direita</option>
                    <option value="E">Esquerda</option>
                    <option value="C">Centro / indiferente</option>
                  </select>
                </div>
              </div>

              </GrupoDeCampos>
              </>)}

              {abaDoJogador === "caracteristicas" && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wide text-white/40">Características</label>
                  <span className={cn(
                    "text-[10px]",
                    pDraft.traits.length >= MAX_CARACTERISTICAS ? "text-[var(--brand)]" : "text-white/25",
                  )}>
                    {pDraft.traits.length} de {MAX_CARACTERISTICAS}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {caracteristicasDaPosicao(pDraft.posicao).map(c => {
                    const marcada = pDraft.traits.includes(c.id)
                    // Cheio e esta nao marcada: fica desabilitada em vez de sumir —
                    // esconder opcao faria a lista dancar a cada clique.
                    const cheio = !marcada && pDraft.traits.length >= MAX_CARACTERISTICAS
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={cheio}
                        title={c.descricao}
                        onClick={() => setPDraft(d => ({
                          ...d,
                          traits: d.traits.includes(c.id)
                            ? d.traits.filter(t => t !== c.id)
                            : [...d.traits, c.id].slice(0, MAX_CARACTERISTICAS),
                        }))}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                          marcada
                            ? "border-[var(--brand)]/60 bg-[var(--brand)]/10 text-[var(--brand)]"
                            : cheio
                              ? "cursor-not-allowed border-white/5 text-white/20"
                              : "border-white/10 text-white/55 hover:border-white/25",
                        )}
                      >
                        {c.nome}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-[10px] leading-4 text-white/35">
                  Cada característica soma +{BONUS_CARACTERISTICA} no atributo que reforça — elas
                  valem na partida, não são só rótulo.
                </p>
              </div>

              )}

              {/* Atributos individuais (valem na partida) */}
              {abaDoJogador === "atributos" && (
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
                        <span className="text-xs font-bold text-[var(--brand)]">{pDraft[key]}</span>
                      </div>
                      <input
                        type="range" min={40} max={99} value={pDraft[key]}
                        onChange={(e) => setPDraft((d) => ({ ...d, [key]: parseInt(e.target.value) || 0 }))}
                        className="w-full accent-[var(--brand)]"
                      />
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
            {/* Rodape FIXO: Salvar sempre a vista, em qualquer aba. */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.07] px-6 py-4">
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
                      setPlayerOverride(editingPlayer.sourceTeamKey ?? selectedTeam.file_key, editingPlayer.originalName, {
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
                        lado: pDraft.lado,
                        nac: pDraft.nac.trim() || undefined,
                        traits: pDraft.traits,
                        faceDataUrl,
                      })
                      if (faceDataUrl) setPlayerPhotoOverride(pDraft.nome.trim() || editingPlayer.nome, faceDataUrl)
                      setPlayers(generatePlayersForTeam(selectedTeam))
                    }
                  }
                  setEditingPlayer(null)
                }}
                className="rounded-lg bg-[var(--brand)] px-5 py-2 text-sm font-bold text-[#05231b] hover:bg-[#00e6b5]"
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
