// PHASE 8 — Mercado de transferências
// MVP funcional: alvos dinâmicos a partir do BF26 import + ofertas geradas para jogadores do usuário.
// Restante do esqueleto fica para evolução futura (counter-offers, contratos, deadline day, etc.).

import type { GameState } from "@/lib/save-system"
import type { SquadPlayer } from "@/lib/save-system"
import type { MarketTarget, IncomingOffer } from "@/lib/career-types"
import importedBF from "@/data/seeds/imported-bf2026.json"

// ─── MVP: Alvos dinâmicos do mercado ───────────────────────────────────────────

interface BfTeamRaw {
  nome: string
  curto: string
  cor1?: string
  cor2?: string
  estadio?: string
  pais?: string
  divisao?: string
  prestigio?: number
  saldo?: number
  escudo?: string
  fileKey?: string
  jogadores?: Array<{ nome: string; posicao: string; overall: number; idade: number; salario?: number }>
}

const ALL_BF_TEAMS = (importedBF as { teams?: BfTeamRaw[] }).teams ?? []

function mapPos(p: string): string {
  const u = (p || "").toUpperCase()
  if (u === "GOL" || u === "GK") return "GOL"
  if (u === "DEF" || u === "ZAG" || u === "LD" || u === "LE") return "ZAG"
  if (u === "VOL") return "VOL"
  if (u === "MEI" || u === "MID" || u === "MED" || u === "MC") return "MEI"
  if (u === "ATA" || u === "FWD" || u === "PD" || u === "PE") return "ATA"
  return "MEI"
}

function calcMarketValueFromAttrs(overall: number, age: number): number {
  const ageM = age < 22 ? 1.4 : age < 26 ? 1.2 : age < 30 ? 1.0 : age < 33 ? 0.7 : 0.4
  const value = Math.pow(overall / 60, 3) * 5_000_000 * ageM
  return Math.round(value / 100_000) * 100_000
}

function calcPotential(overall: number, age: number): number {
  const bonus = age < 20 ? 8 + Math.floor(Math.random() * 5) :
                age < 23 ? 4 + Math.floor(Math.random() * 4) :
                age < 27 ? 1 + Math.floor(Math.random() * 3) :
                age < 31 ? Math.floor(Math.random() * 2) - 1 :
                Math.floor(Math.random() * 2) - 3
  return Math.min(99, Math.max(overall, overall + bonus))
}

function pickTrend(age: number): 'up' | 'down' | 'stable' {
  if (age < 23) return Math.random() < 0.6 ? 'up' : 'stable'
  if (age < 28) return Math.random() < 0.4 ? 'stable' : (Math.random() < 0.5 ? 'up' : 'down')
  if (age < 32) return Math.random() < 0.5 ? 'down' : 'stable'
  return 'down'
}

/**
 * Gera N alvos de transferência: jogadores notáveis (overall >=70) de times variados,
 * excluindo o time do usuário. Refresh por temporada.
 */
export function generateMarketTargets(userTeamCurto: string, count = 24, season = 0): MarketTarget[] {
  const candidates: Array<{ team: BfTeamRaw; player: NonNullable<BfTeamRaw['jogadores']>[number] }> = []
  for (const team of ALL_BF_TEAMS) {
    if (team.curto === userTeamCurto) continue
    for (const j of team.jogadores ?? []) {
      if (j.overall >= 70) candidates.push({ team, player: j })
    }
  }
  if (candidates.length === 0) return []

  // Embaralha (Fisher-Yates parcial para não percorrer tudo)
  const result: MarketTarget[] = []
  const used = new Set<number>()
  let safety = count * 4
  while (result.length < count && safety-- > 0) {
    const idx = Math.floor(Math.random() * candidates.length)
    if (used.has(idx)) continue
    used.add(idx)
    const c = candidates[idx]
    result.push({
      id: `tgt_${season}_${idx}_${result.length}`,
      name: c.player.nome,
      position: mapPos(c.player.posicao),
      age: c.player.idade,
      overall: c.player.overall,
      potential: calcPotential(c.player.overall, c.player.idade),
      value: calcMarketValueFromAttrs(c.player.overall, c.player.idade),
      teamCurto: c.team.curto,
      teamNome: c.team.nome,
      teamCor1: c.team.cor1 ?? '#888888',
      trend: pickTrend(c.player.idade),
    })
  }
  return result
}

// ─── Alvos detalhados (vitrine do Mercado com atributos e clube completo) ──────

/** Time no formato da UI (compatível com TeamCrest / teams-data.Team). */
export interface MarketTeamInfo {
  nome: string
  curto: string
  cidade: string
  estado: string
  cor1: string
  cor2: string
  prestigio: number
  torcida: number
  estadio_cap: number
  saldo: number
  file_key: string
  estadio_nome: string
  patrocinador: string
  escudo_url: string
  divisao: string
  pais?: string
}

export interface DetailedMarketTarget {
  id: number
  name: string
  team: MarketTeamInfo
  position: string
  secondaryPositions: string[]
  age: number
  overall: number
  potential: number
  value: number
  trend: 'up' | 'down' | 'stable'
  nationality: string
  height: string
  weight: string
  foot: string
  stats: { pace: number; shooting: number; passing: number; dribbling: number; defense: number; physical: number }
  releaseClause: number | null
  scoutedBy: string | null
  scoutProgress: number
}

// RNG determinístico (mulberry32) — a vitrine fica estável dentro da temporada
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const PAIS_NACIONALIDADE: Record<string, string> = {
  Brasil: "Brasil", Argentina: "Argentina", Uruguai: "Uruguai", Chile: "Chile",
  Colombia: "Colômbia", Inglaterra: "Inglaterra", Espanha: "Espanha",
  Italia: "Itália", Alemanha: "Alemanha", Franca: "França", Portugal: "Portugal",
  Holanda: "Holanda", Escocia: "Escócia", Turquia: "Turquia", Belgica: "Bélgica",
  Russia: "Rússia", EUA: "EUA", Mexico: "México", Japao: "Japão",
  "Coreia do Sul": "Coreia do Sul", China: "China", "Arabia Saudita": "Arábia Saudita",
}

const SECONDARY_POS: Record<string, string[]> = {
  GOL: [], ZAG: ["VOL"], VOL: ["ZAG", "MEI"], MEI: ["VOL", "ATA"], ATA: ["MEI"],
}

function deriveStats(position: string, overall: number, rng: () => number) {
  const n = (spread: number) => Math.round((rng() - 0.5) * spread)
  const clamp = (v: number) => Math.max(30, Math.min(99, v))
  switch (position) {
    case "GOL":
      return { pace: clamp(overall - 25 + n(8)), shooting: clamp(overall - 40 + n(8)), passing: clamp(overall - 20 + n(10)), dribbling: clamp(overall - 30 + n(8)), defense: clamp(overall + 2 + n(4)), physical: clamp(overall - 8 + n(8)) }
    case "ZAG":
      return { pace: clamp(overall - 12 + n(12)), shooting: clamp(overall - 28 + n(10)), passing: clamp(overall - 14 + n(10)), dribbling: clamp(overall - 18 + n(8)), defense: clamp(overall + 3 + n(4)), physical: clamp(overall + 1 + n(6)) }
    case "VOL":
      return { pace: clamp(overall - 10 + n(10)), shooting: clamp(overall - 15 + n(10)), passing: clamp(overall - 2 + n(6)), dribbling: clamp(overall - 8 + n(8)), defense: clamp(overall - 2 + n(6)), physical: clamp(overall + n(6)) }
    case "MEI":
      return { pace: clamp(overall - 8 + n(10)), shooting: clamp(overall - 6 + n(8)), passing: clamp(overall + 3 + n(4)), dribbling: clamp(overall + 1 + n(6)), defense: clamp(overall - 22 + n(10)), physical: clamp(overall - 12 + n(8)) }
    default: // ATA
      return { pace: clamp(overall + 2 + n(6)), shooting: clamp(overall + 3 + n(4)), passing: clamp(overall - 14 + n(10)), dribbling: clamp(overall + n(6)), defense: clamp(overall - 35 + n(10)), physical: clamp(overall - 6 + n(10)) }
  }
}

function toMarketTeamInfo(t: BfTeamRaw): MarketTeamInfo {
  return {
    nome: t.nome,
    curto: t.curto,
    cidade: "",
    estado: "",
    cor1: t.cor1 ?? "#888888",
    cor2: t.cor2 ?? "#222222",
    prestigio: t.prestigio ?? 70,
    torcida: 0,
    estadio_cap: 30000,
    saldo: t.saldo ?? 0,
    file_key: t.fileKey ?? t.curto.toLowerCase(),
    estadio_nome: t.estadio ?? "",
    patrocinador: "",
    escudo_url: t.escudo ?? "",
    divisao: t.divisao ?? "serie_a",
    pais: t.pais,
  }
}

/**
 * Vitrine do mercado: alvos completos gerados do banco real (2.900+ clubes),
 * com atributos derivados por posição. Determinístico por temporada.
 */
export function generateDetailedMarketTargets(
  userTeamCurto: string,
  count = 60,
  season = 0,
): DetailedMarketTarget[] {
  const rng = mulberry32(hashSeed(`${userTeamCurto}-${season}-mercado`))

  const candidates: Array<{ team: BfTeamRaw; player: NonNullable<BfTeamRaw["jogadores"]>[number] }> = []
  for (const team of ALL_BF_TEAMS) {
    if (team.curto === userTeamCurto) continue
    for (const j of team.jogadores ?? []) {
      // Pool de qualidade: destaque OU jovem promissor
      if (j.overall >= 74 || (j.idade <= 21 && j.overall >= 68)) {
        candidates.push({ team, player: j })
      }
    }
  }
  if (candidates.length === 0) return []

  const result: DetailedMarketTarget[] = []
  const used = new Set<number>()
  const usedNames = new Set<string>()
  let safety = count * 6
  let nextId = 1

  while (result.length < count && safety-- > 0) {
    const idx = Math.floor(rng() * candidates.length)
    if (used.has(idx)) continue
    used.add(idx)
    const { team, player } = candidates[idx]
    if (usedNames.has(player.nome)) continue
    usedNames.add(player.nome)

    const position = mapPos(player.posicao)
    const overall = player.overall
    const age = player.idade
    const potBonus = age < 20 ? 8 + Math.floor(rng() * 5) :
                     age < 23 ? 4 + Math.floor(rng() * 4) :
                     age < 27 ? 1 + Math.floor(rng() * 3) :
                     age < 31 ? Math.floor(rng() * 2) - 1 :
                     Math.floor(rng() * 2) - 3
    const potential = Math.min(99, Math.max(overall, overall + potBonus))
    const value = calcMarketValueFromAttrs(overall, age)
    const trend: 'up' | 'down' | 'stable' =
      age < 23 ? (rng() < 0.6 ? 'up' : 'stable') :
      age < 28 ? (rng() < 0.4 ? 'stable' : rng() < 0.5 ? 'up' : 'down') :
      age < 32 ? (rng() < 0.5 ? 'down' : 'stable') : 'down'

    const heightCm = position === "GOL" ? 185 + Math.floor(rng() * 12) : 168 + Math.floor(rng() * 22)
    const weightKg = Math.round(heightCm * 0.42 + rng() * 8 - 4)

    result.push({
      id: nextId++,
      name: player.nome,
      team: toMarketTeamInfo(team),
      position,
      secondaryPositions: SECONDARY_POS[position] ?? [],
      age,
      overall,
      potential,
      value,
      trend,
      nationality: PAIS_NACIONALIDADE[team.pais ?? ""] ?? team.pais ?? "Brasil",
      height: `${heightCm} cm`,
      weight: `${weightKg} kg`,
      foot: rng() < 0.72 ? "D" : "E",
      stats: deriveStats(position, overall, rng),
      // ~65% têm multa rescisória (2.2x a 3x o valor)
      releaseClause: rng() < 0.65 ? Math.round((value * (2.2 + rng() * 0.8)) / 500_000) * 500_000 : null,
      scoutedBy: null,
      scoutProgress: 0,
    })
  }

  // Ordena por overall desc para a vitrine abrir com os destaques
  return result.sort((a, b) => b.overall - a.overall)
}

/**
 * Gera UMA oferta para um dos jogadores do usuário (random).
 * Retorna null se não houver elenco contratado para vender.
 */
export function generateIncomingOffer(
  state: GameState,
  round: number,
  season: number,
): IncomingOffer | null {
  const squad = state.squadPlayers ?? []
  const userCurto = state.selectedTeam?.curto ?? state.selectedTeamShort ?? ''
  if (squad.length === 0) return null
  // Foca nos jogadores mais valiosos / overall alto
  const ranked = [...squad].sort((a, b) => b.overall - a.overall)
  const target = ranked[Math.floor(Math.random() * Math.min(5, ranked.length))]

  const buyerCandidates = ALL_BF_TEAMS.filter(t => t.curto !== userCurto)
  if (buyerCandidates.length === 0) return null
  const buyer = buyerCandidates[Math.floor(Math.random() * buyerCandidates.length)]

  const baseValue = calcMarketValueFromAttrs(target.overall, target.age)
  // Oferta entre 70% e 110% do valor; reservation entre 95% e 130%
  const offer = Math.round(baseValue * (0.70 + Math.random() * 0.40))
  const reservation = Math.round(baseValue * (0.95 + Math.random() * 0.35))

  return {
    id: `offer_${season}_${round}_${Math.random().toString(36).slice(2, 8)}`,
    playerId: target.id,
    playerName: target.name,
    fromTeamCurto: buyer.curto,
    fromTeamNome: buyer.nome,
    fromTeamCor1: buyer.cor1 ?? '#888888',
    value: offer,
    reservationPrice: reservation,
    status: 'pending',
    receivedRound: round,
    receivedSeason: season,
    expiresInRounds: 3,
  }
}

/** Decrementa expiresInRounds; remove ofertas expiradas, marcando como rejeitadas. */
export function tickIncomingOffers(offers: IncomingOffer[]): IncomingOffer[] {
  return offers
    .map(o => o.status !== 'pending' ? o : { ...o, expiresInRounds: o.expiresInRounds - 1 })
    .map(o => o.status === 'pending' && o.expiresInRounds <= 0 ? { ...o, status: 'rejected' as const } : o)
}

// ─── Esqueleto original (para evolução futura) ─────────────────────────────────

export type OfferType = "buy" | "sell" | "loan" | "loan_with_option" | "free"

export type OfferStatus =
  | "draft"
  | "sent"
  | "negotiating"
  | "accepted"
  | "rejected"
  | "expired"
  | "completed"

export interface TransferOffer {
  id: string
  playerId: string
  playerName: string
  fromClub: string
  toClub: string
  type: OfferType
  status: OfferStatus
  fee: number                      // valor da multa/transferência
  monthlySalary: number
  contractYears: number
  signOnBonus: number              // luvas
  bonuses: { goalsBonus?: number; titleBonus?: number; appsBonus?: number }
  loanOptionFee?: number           // se "loan_with_option"
  releaseClause?: number
  counterOffers: TransferOffer[]
  createdAt: number
  expiresAt: number
}

export interface TransferWindow {
  season: number
  type: "winter" | "summer"
  opensAt: number                  // round
  closesAt: number                 // round
  isOpen: boolean
}

export interface PlayerWantingOut {
  playerId: string
  reason: "low_minutes" | "moral" | "salary" | "ambition" | "personal"
  intensity: "discontent" | "demanding" | "forcing_exit"
}

/** Cria proposta inicial (do usuário pra outro clube ou vice-versa). [stub futuro] */
export function createOffer(_offer: Partial<TransferOffer>): TransferOffer {
  throw new Error("transfer-engine.createOffer: not implemented")
}

// (stubs abaixo são placeholders — não usados pelo MVP)

/** Submete proposta e aguarda resposta da IA do clube/jogador. */
export function submitOffer(_state: GameState, _offer: TransferOffer): {
  state: GameState
  newStatus: OfferStatus
  counter?: TransferOffer
  reason?: string
} {
  throw new Error("transfer-engine.submitOffer: not implemented")
}

/** IA do clube avalia se aceita venda do jogador. */
export function evaluateClubAcceptance(_offer: TransferOffer): {
  accepts: boolean
  counter?: Partial<TransferOffer>
  reason: string
} {
  throw new Error("transfer-engine.evaluateClubAcceptance: not implemented")
}

/** IA do jogador avalia se aceita salário/contrato. */
export function evaluatePlayerAcceptance(_offer: TransferOffer): {
  accepts: boolean
  counter?: Partial<TransferOffer>
  reason: string
} {
  throw new Error("transfer-engine.evaluatePlayerAcceptance: not implemented")
}

/** Conclui transferência: muda jogador de elenco, deduz/credita saldo. */
export function completeTransfer(_state: GameState, _offer: TransferOffer): GameState {
  throw new Error("transfer-engine.completeTransfer: not implemented")
}

/** Avança 1 dia/rodada de janela: expira ofertas, gera ofertas IA. */
export function tickTransferWindow(_state: GameState): GameState {
  throw new Error("transfer-engine.tickTransferWindow: not implemented")
}

/** Calcula valor de mercado do jogador (idade, overall, potencial, contrato). */
export function calcMarketValue(_player: SquadPlayer): number {
  throw new Error("transfer-engine.calcMarketValue: not implemented")
}

/** Detecta jogadores insatisfeitos querendo sair. */
export function detectPlayersWantingOut(_state: GameState): PlayerWantingOut[] {
  throw new Error("transfer-engine.detectPlayersWantingOut: not implemented")
}

/** Deadline day: ofertas de última hora, contador, notícias urgentes. */
export function runDeadlineDay(_state: GameState): {
  state: GameState
  events: { time: string; description: string }[]
} {
  throw new Error("transfer-engine.runDeadlineDay: not implemented")
}
