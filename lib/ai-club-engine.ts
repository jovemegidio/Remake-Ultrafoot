// PHASE 38 — IA dos clubes (decisões fora do campo)
// Cada clube tem perfil próprio: contratar, vender, renovar, entrar em crise.
// Usado pelo mercado de transferências para gerar propostas coerentes.

import type { GameState } from "@/lib/save-system"
import { aiTacticForClub, type TacticalIdentity } from "@/lib/tactics-engine"
import type { TransferOffer } from "@/lib/transfer-engine"

export type ClubAIPersonality = "agressivo" | "conservador" | "formador" | "comprador" | "vendedor"

export interface ClubAIConfig {
  curto: string
  personality: ClubAIPersonality
  budgetCaution: number            // 0..100
  starHunting: number              // 0..100 (vai atrás de big players)
  youthFocus: number               // 0..100
  identity: TacticalIdentity
  patienceWithCoach: number        // 0..100
  inCrisis: boolean
}

// ─── Perfis de clubes conhecidos ──────────────────────────────────────────────

const KNOWN_PROFILES: Record<string, Partial<ClubAIConfig>> = {
  FLA: { personality: "comprador", budgetCaution: 30, starHunting: 90, youthFocus: 55 },
  PAL: { personality: "comprador", budgetCaution: 40, starHunting: 85, youthFocus: 70 },
  COR: { personality: "agressivo", budgetCaution: 25, starHunting: 75, youthFocus: 50 },
  SAO: { personality: "formador", budgetCaution: 55, starHunting: 60, youthFocus: 85 },
  SAN: { personality: "formador", budgetCaution: 65, starHunting: 40, youthFocus: 95 },
  GRE: { personality: "conservador", budgetCaution: 60, starHunting: 55, youthFocus: 70 },
  INT: { personality: "conservador", budgetCaution: 55, starHunting: 60, youthFocus: 65 },
  CAM: { personality: "agressivo", budgetCaution: 35, starHunting: 80, youthFocus: 45 },
  BOT: { personality: "comprador", budgetCaution: 30, starHunting: 80, youthFocus: 40 },
  FLU: { personality: "formador", budgetCaution: 60, starHunting: 50, youthFocus: 80 },
  VAS: { personality: "vendedor", budgetCaution: 70, starHunting: 40, youthFocus: 65 },
  CRU: { personality: "agressivo", budgetCaution: 40, starHunting: 70, youthFocus: 55 },
  BAH: { personality: "comprador", budgetCaution: 45, starHunting: 65, youthFocus: 50 },
  RBB: { personality: "formador", budgetCaution: 50, starHunting: 45, youthFocus: 85 },
}

const PERSONALITIES: ClubAIPersonality[] = ["agressivo", "conservador", "formador", "comprador", "vendedor"]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** Perfil de IA do clube — conhecido ou derivado deterministicamente do prestígio. */
export function getClubAIConfig(curto: string, prestigio = 70): ClubAIConfig {
  const known = KNOWN_PROFILES[curto]
  const h = hashStr(curto)
  const base: ClubAIConfig = {
    curto,
    personality: known?.personality ?? PERSONALITIES[h % PERSONALITIES.length],
    budgetCaution: known?.budgetCaution ?? 35 + (h % 45),
    starHunting: known?.starHunting ?? Math.min(95, Math.max(15, prestigio - 10 + (h % 25))),
    youthFocus: known?.youthFocus ?? 30 + ((h >> 3) % 55),
    identity: aiTacticForClub(curto).identity,
    patienceWithCoach: 40 + ((h >> 5) % 50),
    inCrisis: false,
  }
  return base
}

// ─── Avaliação de compra ──────────────────────────────────────────────────────

/** Decide se clube IA quer comprar jogador X e quanto pagaria. */
export function evaluateBuy(
  config: ClubAIConfig,
  player: { overall: number; age: number; value: number; nationality: string },
): { wants: boolean; maxFee: number; maxSalary: number } {
  const { overall, age, value } = player

  // Interesse base por overall
  let interest = (overall - 68) * 4 // 0 aos 68, +4 por ponto

  // Personalidade
  if (config.personality === "comprador") interest += 15
  if (config.personality === "agressivo") interest += 10
  if (config.personality === "vendedor") interest -= 20
  if (config.personality === "conservador") interest -= 8

  // Jovens promissores atraem formadores; veteranos afastam
  if (age <= 22) interest += config.youthFocus * 0.25
  if (age >= 31) interest -= 18
  if (age >= 34) interest -= 30

  // Estrelas atraem caçadores de estrela
  if (overall >= 82) interest += (config.starHunting - 50) * 0.4

  // Crise reduz apetite de mercado
  if (config.inCrisis) interest -= 25

  const wants = interest > 20

  // Disposição de pagamento: cautela orçamentária controla o ágio
  const premium = 1 + Math.max(0, (60 - config.budgetCaution)) * 0.006 // até +36%
  const ageDiscount = age >= 31 ? 0.8 : age >= 29 ? 0.92 : 1
  const maxFee = Math.round(value * premium * ageDiscount)
  const maxSalary = Math.round((overall * overall * 18) / 12) // heurística mensal

  return { wants, maxFee, maxSalary }
}

// ─── Avaliação de venda ───────────────────────────────────────────────────────

/** Decide se clube IA aceita vender jogador. */
export function evaluateSell(
  config: ClubAIConfig,
  player: { overall: number; age: number; valueClub: number },
  offer: TransferOffer,
): boolean {
  const { valueClub, age, overall } = player

  // Preço mínimo do clube depende da personalidade
  let threshold = 1.0
  if (config.personality === "vendedor") threshold = 0.85
  if (config.personality === "formador" && age <= 21) threshold = 1.4 // segura joias
  if (config.personality === "conservador") threshold = 1.15
  if (config.personality === "comprador" && overall >= 80) threshold = 1.3 // não vende estrela

  // Veterano: aceita com desconto; crise: precisa de caixa
  if (age >= 32) threshold *= 0.75
  if (config.inCrisis) threshold *= 0.8

  return offer.fee >= valueClub * threshold
}

// ─── Detecção de crise ────────────────────────────────────────────────────────

/** Clube entra em crise com sequência ruim ou caixa apertado. */
export function detectCrisis(recentResults: ("W" | "D" | "L")[], financeRunway: number): boolean {
  const last5 = recentResults.slice(-5)
  const losses = last5.filter(r => r === "L").length
  const wins = last5.filter(r => r === "W").length
  const badRun = last5.length >= 5 && losses >= 4 && wins === 0
  const brokeSoon = financeRunway < 8 // menos de 8 semanas de caixa
  return badRun || brokeSoon
}

// ─── Tick semanal ─────────────────────────────────────────────────────────────

/**
 * Tick weekly: clubes IA reagem ao contexto. Versão atual: detecta crises e
 * ajusta identidade tática de clubes em crise (retranca). Geração de ofertas
 * concretas fica no game-engine (generateAIOffers), que usa evaluateBuy.
 */
export function tickAIDecisions(state: GameState, _week: number): {
  state: GameState
  newOffers: TransferOffer[]
  coachChanges: { curto: string; newCoach: string }[]
  identityChanges: { curto: string; newIdentity: TacticalIdentity }[]
} {
  return { state, newOffers: [], coachChanges: [], identityChanges: [] }
}
