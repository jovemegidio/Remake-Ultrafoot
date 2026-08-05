"use client"

// MERCADO DO MUNDO — a IA negociando entre si.
//
// O buraco: so o clube do USUARIO mudava de elenco. Os adversarios eram gerados
// na hora a partir do seed, entao o mundo era estatico — o mesmo Flamengo, com
// os mesmos jogadores, para sempre. `tickAIDecisions` (ai-club-engine) era um
// stub que devolvia lista vazia.
//
// Aqui fica o registro das CHEGADAS. A SAIDA ja tinha registro
// ([[departed-players]]), que o getPlayersForTeam usa para tirar do elenco de
// origem quem foi embora. Juntando os dois lados, uma transferencia entre dois
// clubes da IA passa a existir de verdade: some de la, aparece aqui.
//
// Este modulo NAO importa players-data (que importa este) — a simulacao recebe o
// elenco por callback. Mesmo motivo de departed-players ficar fora do engine.

import { storeGet, storeSet } from "@/lib/persistent-store"
import { getActiveCareerId, getCareerScopedKey } from "@/lib/save-system"
import { markDeparted } from "@/lib/departed-players"
import { playerMarketValue } from "@/lib/club-economy"

const KEY = () => getCareerScopedKey("ultrafoot:world-arrivals")

const SIGLA_CLUBE = new Set(["fc", "cf", "sc", "ec", "ca", "cr", "ac", "se", "afc", "ud", "cd", "clube", "club"])
function norm(s: string): string {
  const base = (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  return base.split(" ").filter(w => w && !SIGLA_CLUBE.has(w)).join(" ")
}

/** Atleta que CHEGOU a um clube por transferencia entre clubes da IA. */
export interface ArrivedPlayer {
  nome: string
  pos: string
  idade: number
  base: number
  nac?: string
  /** Clube de origem — so para a noticia/historico. */
  deOnde: string
  temporada: number
}

type ArrivalsMap = Record<string, ArrivedPlayer[]>

let cache: ArrivalsMap | null = null
let cacheCareerId: string | null = null

function carregar(): ArrivalsMap {
  const atual = getActiveCareerId()
  if (cache && cacheCareerId === atual) return cache
  cacheCareerId = atual
  try {
    const raw = storeGet(KEY())
    cache = raw ? (JSON.parse(raw) as ArrivalsMap) : {}
  } catch {
    cache = {}
  }
  return cache
}

function salvar(map: ArrivalsMap): void {
  cache = map
  storeSet(KEY(), JSON.stringify(map))
}

/** Reforcos que este clube recebeu da IA (vazio na maioria dos clubes). */
export function getArrivals(clubeNome: string): ArrivedPlayer[] {
  return carregar()[norm(clubeNome)] ?? []
}

/** Alguem chegou a algum clube? Atalho barato para o caminho quente. */
export function hasAnyArrival(): boolean {
  return Object.keys(carregar()).length > 0
}

/** Registra a transferencia: sai da origem (departed) e entra no destino. */
export function recordWorldTransfer(
  origem: string,
  destino: string,
  atleta: Omit<ArrivedPlayer, "deOnde">,
): void {
  if (!origem || !destino || !atleta?.nome) return
  markDeparted(origem, atleta.nome)
  const map = { ...carregar() }
  const k = norm(destino)
  const lista = map[k] ?? []
  if (lista.some(a => norm(a.nome) === norm(atleta.nome))) return
  map[k] = [...lista, { ...atleta, deOnde: origem }]
  salvar(map)
}

export function reloadWorldMarket(): void {
  cache = null
  cacheCareerId = null
  logCache = null
  logCareerId = null
}

// ── Janela de transferencias do mundo ──────────────────────────────────────

export interface WorldTransferNews {
  atleta: string
  de: string
  para: string
  valor: number
  /** Posicao e idade viajam na noticia para a Central mostrar sem consultar elenco. */
  pos?: string
  idade?: number
  base?: number
  temporada?: number
  semana?: number
}

// ── DIARIO DO MERCADO (o que alimenta a Central de Transferencias) ──────────
//
// A janela da IA existia e ja mexia nos elencos, mas o resultado morria numa
// notificacao: nao havia onde ACOMPANHAR quem contratou quem. Este diario e a
// fonte da Central de Transferencias — fica no save da carreira, em ordem
// cronologica inversa, com teto para nao crescer sem fim.

const LOG_KEY = () => getCareerScopedKey("ultrafoot:world-transfer-log")
const LOG_MAX = 400

let logCache: WorldTransferNews[] | null = null
let logCareerId: string | null = null

/** Diario do mercado mundial, do negocio mais recente para o mais antigo. */
export function getWorldTransferLog(): WorldTransferNews[] {
  const atual = getActiveCareerId()
  if (logCache && logCareerId === atual) return logCache
  logCareerId = atual
  try {
    const raw = storeGet(LOG_KEY())
    const parsed = raw ? JSON.parse(raw) : []
    logCache = Array.isArray(parsed) ? (parsed as WorldTransferNews[]) : []
  } catch {
    logCache = []
  }
  return logCache
}

/** Acrescenta negocios ao diario (os mais novos primeiro). */
export function appendWorldTransferLog(noticias: WorldTransferNews[]): void {
  if (noticias.length === 0) return
  const atual = [...noticias, ...getWorldTransferLog()].slice(0, LOG_MAX)
  logCache = atual
  logCareerId = getActiveCareerId()
  storeSet(LOG_KEY(), JSON.stringify(atual))
}

interface ClubeParaMercado {
  nome: string
  curto: string
  prestigio: number
  divisao: string
}

function hash(v: string): number {
  let h = 2166136261
  for (const c of v) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * JANELA DA IA: move um punhado de atletas entre clubes da IA ao virar a
 * temporada. Deterministica pela semente (a mesma temporada gera as mesmas
 * transferencias) e conservadora — poucos negocios por ano, sempre de um clube
 * menor para um MAIOR, como o fluxo real do mercado.
 *
 * `squadOf` entra por parametro para este modulo nao importar players-data.
 * `clubeDoUsuario` fica de fora: o elenco dele e do engine, nao daqui.
 */
export function simulateWorldTransferWindow(params: {
  clubes: readonly ClubeParaMercado[]
  squadOf: (curto: string) => { nome: string; pos: string; idade: number; base: number; nac?: string }[]
  clubeDoUsuario: string
  temporada: number
  /** Quantos negocios tentar nesta janela. */
  quantidade?: number
  /** Semana do jogo, quando o negocio acontece DURANTE a temporada. */
  semana?: number
  /** Diferencia as sementes entre a virada de temporada e cada semana. */
  rotulo?: string
}): WorldTransferNews[] {
  const { clubes, squadOf, clubeDoUsuario, temporada, semana } = params
  // 14 negocios por janela sobre 525 clubes elegiveis = ~2,6% dos clubes
  // contratando por ano; o mundo parecia parado. 40 mantem o custo baixo (a
  // simulacao e um laco simples sobre sementes) e ja da movimento perceptivel na
  // Central de Transferencias.
  const quantidade = params.quantidade ?? 40
  const rotulo = params.rotulo ?? "virada"
  const noticias: WorldTransferNews[] = []

  // So clubes com alguma expressao entram no mercado do mundo (evita ruido de
  // milhares de clubes pequenos e mantem o custo baixo).
  const elegiveis = clubes
    .filter(c => c.curto !== clubeDoUsuario && (c.prestigio ?? 0) >= 55)
    .sort((a, b) => b.prestigio - a.prestigio)
  if (elegiveis.length < 4) return noticias

  const jaMovido = new Set<string>()
  for (let i = 0; i < quantidade; i++) {
    const semente = hash(`${rotulo}:${temporada}:${semana ?? 0}:${i}`)
    // Comprador: sorteado entre os de MAIOR prestigio (metade de cima).
    const topo = elegiveis.slice(0, Math.max(2, Math.floor(elegiveis.length / 2)))
    const comprador = topo[semente % topo.length]
    // Vendedor: alguem de prestigio MENOR que o comprador.
    const menores = elegiveis.filter(c => c.prestigio < comprador.prestigio - 3)
    if (menores.length === 0) continue
    const vendedor = menores[hash(`v${rotulo}${temporada}:${semana ?? 0}:${i}`) % menores.length]

    const elenco = squadOf(vendedor.curto)
    if (elenco.length < 14) continue // nao esvazia elenco curto
    // Alvo: um dos melhores do vendedor, preferindo jovens (mercado real).
    const alvos = [...elenco]
      .sort((a, b) => (b.base + (b.idade <= 24 ? 4 : 0)) - (a.base + (a.idade <= 24 ? 4 : 0)))
      .slice(0, 6)
      .filter(p => !jaMovido.has(`${norm(vendedor.nome)}::${norm(p.nome)}`))
    if (alvos.length === 0) continue
    const alvo = alvos[hash(`a${rotulo}${temporada}:${semana ?? 0}:${i}`) % alvos.length]

    // O comprador so leva quem agrega (nao compra pior do que ja tem em media).
    if (alvo.base < comprador.prestigio - 18) continue

    jaMovido.add(`${norm(vendedor.nome)}::${norm(alvo.nome)}`)
    recordWorldTransfer(vendedor.nome, comprador.nome, {
      nome: alvo.nome, pos: alvo.pos, idade: alvo.idade, base: alvo.base, nac: alvo.nac,
      temporada,
    })
    noticias.push({
      atleta: alvo.nome, de: vendedor.nome, para: comprador.nome,
      // MESMA conta do mercado do jogador (`playerMarketValue`). A fórmula local
      // `(base/60)³ × 4M` era uma segunda régua para a mesma coisa e divergia até
      // 2x no topo: um atleta de overall 90 valia R$ 13,5 mi na notícia do mundo e
      // R$ 27,6 mi na tela de mercado. Duas verdades sobre o preço do mesmo atleta.
      valor: playerMarketValue(alvo.base, comprador.divisao),
      pos: alvo.pos, idade: alvo.idade, base: alvo.base, temporada, semana,
    })
  }
  // O diario e a fonte da Central de Transferencias.
  appendWorldTransferLog(noticias)
  return noticias
}
