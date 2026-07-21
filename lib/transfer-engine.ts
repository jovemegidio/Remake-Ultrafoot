// PHASE 8 — Mercado de transferências
// MVP funcional: alvos dinâmicos a partir do BF26 import + ofertas geradas para jogadores do usuário.
// Restante do esqueleto fica para evolução futura (counter-offers, contratos, deadline day, etc.).

import type { GameState } from "@/lib/save-system"
import { repairMojibake } from "@/lib/text-normalization"
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
  liga?: string
  divisao?: string
  prestigio?: number
  saldo?: number
  escudo?: string
  fileKey?: string
  // `nac` é assado por scripts/apply-tm-squads.mjs a partir do Transfermarkt.
  jogadores?: Array<{ nome: string; posicao: string; overall: number; idade: number; salario?: number; nac?: string }>
}

const ALL_BF_TEAMS = (importedBF as { teams?: BfTeamRaw[] }).teams ?? []

// Distribuição usada para quem vem sem posição na fonte — mesma ideia do
// FILLER_POSITION_ORDER de players-data.ts, que já resolve isso nos elencos.
const BENCH_POSITION_ORDER = ["GOL", "ZAG", "ZAG", "LD", "LE", "VOL", "MEI", "MEI", "PD", "PE", "ATA", "ATA"]

/**
 * Overall exibido, comprimindo o topo. O banco importado tem valores até 107;
 * clampar em 99 criava uma parede de atletas todos "99". Abaixo de 90 passa
 * intacto; de 90 a 107 mapeia para 90-99, preservando a ordem.
 */
function rescaleOverall(raw: number): number {
  const v = Math.max(1, raw || 1)
  if (v <= 90) return Math.min(99, v)
  return Math.min(99, Math.round(90 + (v - 90) * (9 / 17)))
}

/**
 * Converte a posição da fonte para o código do jogo.
 *
 * O fallback anterior era `return "MEI"`, e o banco importado marca TODO atleta
 * fora dos 11 titulares como "BAN" (banco, não uma posição): 25.078 registros —
 * de longe o valor mais comum — viravam meias. Somados a "CA" (centroavante) e
 * "LAT", o mercado ficava inundado de MEI e a busca por ATA, VOL, PD ou PE
 * praticamente não devolvia ninguém correto. Relato de jogador em 2026-07-20.
 *
 * `index` mantém a distribuição estável: o mesmo atleta cai sempre na mesma
 * posição, em vez de mudar a cada listagem do mercado.
 */
function mapPos(p: string, index = 0): string {
  const u = (p || "").toUpperCase()
  if (u === "GOL" || u === "GK") return "GOL"
  if (u === "LD" || u === "RB") return "LD"
  if (u === "LE" || u === "LB") return "LE"
  if (u === "LAT") return "LD"
  if (u === "DEF" || u === "ZAG" || u === "CB") return "ZAG"
  if (u === "VOL" || u === "DM" || u === "CDM" || u === "MCD") return "VOL"
  if (u === "MEI" || u === "MID" || u === "MED" || u === "MC" || u === "CM" || u === "CAM" || u === "MO") return "MEI"
  if (u === "PD" || u === "RW" || u === "AD" || u === "MD") return "PD"
  if (u === "PE" || u === "LW" || u === "AE" || u === "ME") return "PE"
  // CA é centroavante no banco importado, não "meia central".
  if (u === "ATA" || u === "FWD" || u === "ST" || u === "CA" || u === "CF" || u === "SA") return "ATA"
  // "BAN" (e qualquer código desconhecido) não carrega informação de posição:
  // distribui pelos setores em vez de fingir que todos são meias.
  return BENCH_POSITION_ORDER[Math.abs(index) % BENCH_POSITION_ORDER.length]
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
      position: mapPos(c.player.posicao, idx),
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
  liga?: string
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

// O banco legado mistura nomes de paises, siglas de pais, siglas estaduais e, em
// alguns arquivos corrompidos, ate o nome do proprio clube no campo `pais`.
// Normalizamos antes de expor o dado ao mercado para o filtro nunca listar "172",
// "ABECAT", "AC" ou nomes de clubes como se fossem paises.
const COUNTRY_CODES: Record<string, string> = {
  BRA: "Brasil", BR: "Brasil", SP: "Brasil", RJ: "Brasil", MG: "Brasil", RS: "Brasil", SC: "Brasil", PR: "Brasil", BA: "Brasil", PE: "Brasil", CE: "Brasil", PA: "Brasil", PB: "Brasil", RN: "Brasil", AL: "Brasil", SE: "Brasil", GO: "Brasil", MT: "Brasil", MS: "Brasil", DF: "Brasil", AM: "Brasil", AP: "Brasil", AC: "Brasil", RO: "Brasil", RR: "Brasil", TO: "Brasil", MA: "Brasil", PI: "Brasil",
  ARG: "Argentina", AR: "Argentina", URU: "Uruguai", CHI: "Chile", COL: "Colômbia", PER: "Peru", PAR: "Paraguai", BOL: "Bolívia", EQU: "Equador", VEN: "Venezuela",
  ENG: "Inglaterra", ESP: "Espanha", ES: "Espanha", IT: "Itália", ITA: "Itália", GER: "Alemanha", ALE: "Alemanha", FRA: "França", FR: "França", POR: "Portugal", NED: "Holanda", HOL: "Holanda", SCO: "Escócia", BEL: "Bélgica", TUR: "Turquia", RUS: "Rússia", AUT: "Áustria", AUS: "Austrália", SUI: "Suíça", UKR: "Ucrânia", SRB: "Sérvia", SWE: "Suécia", NOR: "Noruega", DEN: "Dinamarca", GRE: "Grécia", CRO: "Croácia", BUL: "Bulgária", ROM: "Romênia", HUN: "Hungria", IRL: "Irlanda", FIN: "Finlândia", ISL: "Islândia", ISR: "Israel", POL: "Polônia", CZE: "Tchéquia", SLK: "Eslováquia", SVN: "Eslovênia", ALB: "Albânia", ARM: "Armênia", AZB: "Azerbaijão", GEO: "Geórgia", KOS: "Kosovo",
  USA: "Estados Unidos", EUA: "Estados Unidos", MEX: "México", CAN: "Canadá",
  ARA: "Arábia Saudita", KSA: "Arábia Saudita", UAE: "Emirados Árabes Unidos", CAT: "Catar", QAT: "Catar", CHN: "China", JPN: "Japão", JAP: "Japão", KOR: "Coreia do Sul", COR: "Coreia do Sul", IND: "Índia", IRN: "Irã", TAI: "Tailândia",
  AFS: "África do Sul", EGI: "Egito", MAR: "Marrocos", TUN: "Tunísia", NGA: "Nigéria", GHA: "Gana",
}
const COUNTRY_NAMES = new Set([
  "Brasil", "Argentina", "Uruguai", "Chile", "Colômbia", "Colombia", "Peru", "Paraguai", "Bolívia", "Bolivia", "Equador", "Venezuela",
  "Inglaterra", "Espanha", "Itália", "Italia", "Alemanha", "França", "Franca", "Portugal", "Holanda", "Países Baixos", "Escócia", "Escocia", "Bélgica", "Belgica", "Turquia", "Rússia", "Russia", "Áustria", "Austria", "Suíça", "Suica", "Ucrânia", "Ucrania", "Sérvia", "Servia", "Suécia", "Suecia", "Noruega", "Dinamarca", "Grécia", "Grecia", "Croácia", "Croacia", "Bulgária", "Bulgaria", "Romênia", "Romenia", "Hungria", "Irlanda", "Finlândia", "Finlandia", "Islândia", "Islandia", "Israel", "Polônia", "Polonia", "Tchéquia", "Eslováquia", "Eslovênia", "Albânia", "Armênia", "Azerbaijão", "Geórgia", "Kosovo",
  "Estados Unidos", "EUA", "México", "Mexico", "Canadá", "Canada", "Arábia Saudita", "Arabia Saudita", "Emirados Árabes Unidos", "Catar", "China", "Japão", "Japao", "Coreia do Sul", "Índia", "India", "Irã", "Ira", "Tailândia", "Tailandia", "Austrália", "Australia", "África do Sul", "Africa do Sul", "Egito", "Marrocos", "Tunísia", "Tunisia", "Nigéria", "Nigeria", "Gana",
])

function normalizedCountry(raw?: string, fileKey?: string): string | undefined {
  const value = (raw ?? "").trim()
  if (COUNTRY_CODES[value.toUpperCase()]) return COUNTRY_CODES[value.toUpperCase()]
  if (COUNTRY_NAMES.has(value)) return PAIS_NACIONALIDADE[value] ?? value
  const suffix = (fileKey ?? "").split("_").pop()?.toUpperCase() ?? ""
  return COUNTRY_CODES[suffix]
}

const SECONDARY_POS: Record<string, string[]> = {
  GOL: [], ZAG: ["VOL"], LD: ["ZAG", "PD"], LE: ["ZAG", "PE"],
  VOL: ["ZAG", "MEI"], MEI: ["VOL", "ATA"], PD: ["ATA", "LD"],
  PE: ["ATA", "LE"], ATA: ["MEI"],
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
    nome: repairMojibake(t.nome),
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
    pais: normalizedCountry(t.pais, t.fileKey),
    liga: t.liga ?? t.divisao ?? "Liga nacional",
  }
}

/**
 * Vitrine do mercado: alvos completos gerados do banco real (2.900+ clubes),
 * com atributos derivados por posição. Determinístico por temporada.
 */
export function generateDetailedMarketTargets(
  userTeamCurto: string,
  count?: number,
  season = 0,
): DetailedMarketTarget[] {
  const rng = mulberry32(hashSeed(`${userTeamCurto}-${season}-mercado`))

  const candidates: Array<{ team: BfTeamRaw; player: NonNullable<BfTeamRaw["jogadores"]>[number] }> = []
  for (const team of ALL_BF_TEAMS) {
    if (team.curto === userTeamCurto) continue
    for (const j of team.jogadores ?? []) candidates.push({ team, player: j })
  }
  if (candidates.length === 0) return []

  const result: DetailedMarketTarget[] = []
  // Sem limite = catálogo inteiro. Quando um limite for pedido por outra tela,
  // embaralhamos índices de forma determinística e sem a antiga perda por nomes
  // repetidos (dois "Gabriel" são dois atletas diferentes).
  const indexes = candidates.map((_, index) => index)
  if (count !== undefined && count < indexes.length) {
    for (let i = indexes.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[indexes[i], indexes[j]] = [indexes[j], indexes[i]]
    }
  }
  const selectedIndexes = indexes.slice(0, count === undefined ? indexes.length : Math.max(0, count))

  for (const idx of selectedIndexes) {
    const { team, player } = candidates[idx]

    const position = mapPos(player.posicao, idx)
    // O banco tem overalls ATÉ 107. Clampar em 99 empilhava dezenas de atletas
    // todos como "99" (relato: "jogadores com 99+ e por aí vai"). Comprime a
    // faixa 90-107 para 90-99, preservando a ordem e espalhando o topo.
    const overall = rescaleOverall(player.overall)
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
      // ID estável e exclusivo no catálogo; usado também pela carência de negociação.
      id: idx + 1,
      name: repairMojibake(player.nome),
      team: toMarketTeamInfo(team),
      position,
      secondaryPositions: SECONDARY_POS[position] ?? [],
      age,
      overall,
      potential,
      value,
      trend,
      // Nacionalidade real do Transfermarkt quando existe; o país do clube é só
      // o palpite de reserva (errava todo estrangeiro: um paraguaio no São Paulo
      // aparecia como brasileiro).
      nationality: player.nac ?? normalizedCountry(team.pais, team.fileKey) ?? "Brasil",
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
export function createOffer(offer: Partial<TransferOffer>): TransferOffer {
  const now=Date.now();return{id:offer.id??`offer-${now}-${offer.playerId??"player"}`,playerId:offer.playerId??"",playerName:offer.playerName??"Atleta",fromClub:offer.fromClub??"",toClub:offer.toClub??"",type:offer.type??"buy",status:offer.status??"draft",fee:Math.max(0,offer.fee??0),monthlySalary:Math.max(0,offer.monthlySalary??0),contractYears:Math.max(1,offer.contractYears??3),signOnBonus:Math.max(0,offer.signOnBonus??0),bonuses:{...(offer.bonuses??{})},loanOptionFee:offer.loanOptionFee,releaseClause:offer.releaseClause,counterOffers:offer.counterOffers??[],createdAt:offer.createdAt??now,expiresAt:offer.expiresAt??now+7*86400000}
}

// (stubs abaixo são placeholders — não usados pelo MVP)

/** Submete proposta e aguarda resposta da IA do clube/jogador. */
export function submitOffer(state: GameState, offer: TransferOffer): {
  state: GameState
  newStatus: OfferStatus
  counter?: TransferOffer
  reason?: string
} {
  const club=evaluateClubAcceptance(offer);if(!club.accepts)return{state:structuredClone(state),newStatus:club.counter?"negotiating":"rejected",counter:club.counter?createOffer({...offer,...club.counter,status:"negotiating",counterOffers:[...offer.counterOffers,offer]}):undefined,reason:club.reason}
  const player=evaluatePlayerAcceptance(offer);if(!player.accepts)return{state:structuredClone(state),newStatus:player.counter?"negotiating":"rejected",counter:player.counter?createOffer({...offer,...player.counter,status:"negotiating",counterOffers:[...offer.counterOffers,offer]}):undefined,reason:player.reason}
  return{state:completeTransfer(state,{...offer,status:"accepted"}),newStatus:"completed",reason:"Clube e atleta aceitaram a proposta."}
}

/** IA do clube avalia se aceita venda do jogador. */
export function evaluateClubAcceptance(offer: TransferOffer): {
  accepts: boolean
  counter?: Partial<TransferOffer>
  reason: string
} {
  if(offer.type==="free")return{accepts:true,reason:"Atleta livre no mercado."};const reference=Math.max(250000,offer.monthlySalary*48);if(offer.fee>=reference*.9)return{accepts:true,reason:"Valor aceito pelo clube."};const fee=Math.ceil(reference*1.05/10000)*10000;return{accepts:false,counter:{fee},reason:"O clube exige uma compensação maior."}
}

/** IA do jogador avalia se aceita salário/contrato. */
export function evaluatePlayerAcceptance(offer: TransferOffer): {
  accepts: boolean
  counter?: Partial<TransferOffer>
  reason: string
} {
  const expected=Math.max(12000,Math.round(Math.sqrt(Math.max(offer.fee,100000))*45));if(offer.monthlySalary>=expected&&offer.contractYears>=1)return{accepts:true,reason:"O atleta aceitou os termos."};return{accepts:false,counter:{monthlySalary:Math.ceil(expected/1000)*1000,signOnBonus:Math.max(offer.signOnBonus,expected*2)},reason:"O representante apresentou uma contraproposta salarial."}
}

/** Conclui transferência: muda jogador de elenco, deduz/credita saldo. */
export function completeTransfer(state: GameState, offer: TransferOffer): GameState {
  const next=structuredClone(state),squad=next.squadPlayers??[],isBuyer=offer.toClub===next.selectedTeamShort
  if(isBuyer&&!squad.some(p=>p.id===offer.playerId)){const overall=Math.max(50,Math.min(90,Math.round(Math.cbrt(Math.max(offer.fee,125000)/35))));squad.push({id:offer.playerId,name:offer.playerName,position:"MC",age:24,overall,potential:Math.min(95,overall+5),value:offer.fee,fromTeam:offer.fromClub,seasonSigned:next.season});next.balance=(next.balance??next.selectedTeam?.saldo??0)-offer.fee-offer.signOnBonus}
  if(offer.fromClub===next.selectedTeamShort){next.squadPlayers=squad.filter(p=>p.id!==offer.playerId);next.balance=(next.balance??0)+offer.fee}else next.squadPlayers=squad
  next.transfers=[...(next.transfers??[]),{id:offer.id,playerName:offer.playerName,fromTeam:offer.fromClub,toTeam:offer.toClub,value:offer.fee,type:offer.type.startsWith("loan")?"loan":isBuyer?"buy":"sell",week:next.week,season:next.season}];next.updatedAt=Date.now();return next
}

/** Avança 1 dia/rodada de janela: expira ofertas, gera ofertas IA. */
export function tickTransferWindow(state: GameState): GameState {
  return{...structuredClone(state),updatedAt:Date.now()}
}

/** Calcula valor de mercado do jogador (idade, overall, potencial, contrato). */
export function calcMarketValue(player: SquadPlayer): number {
  const ageFactor = player.age <= 23 ? 1.35 : (player.age >= 32 ? 0.58 : 1), quality=Math.max(45,player.overall),potential=Math.max(0,player.potential-player.overall);return Math.round((quality**3*35+potential*350000)*ageFactor/10000)*10000
}

/** Detecta jogadores insatisfeitos querendo sair. */
export function detectPlayersWantingOut(state: GameState): PlayerWantingOut[] {
  if((state.teamMorale??65)>=40)return[];return(state.squadPlayers??[]).filter((_,i)=>i%7===0).map((p,i)=>({playerId:p.id,reason:"moral",intensity:(state.teamMorale??65)<25?"forcing_exit":i%2?"demanding":"discontent"}))
}

/** Deadline day: ofertas de última hora, contador, notícias urgentes. */
export function runDeadlineDay(state: GameState): {
  state: GameState
  events: { time: string; description: string }[]
} {
  const events=(state.squadPlayers??[]).slice(0,3).map((p,i)=>({time:`${10+i*3}:00`,description:`Clubes monitoram ${p.name} nas últimas horas da janela.`}));return{state:{...structuredClone(state),updatedAt:Date.now()},events}
}
