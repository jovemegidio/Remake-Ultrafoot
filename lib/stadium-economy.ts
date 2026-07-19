// Economia do estádio — bilheteria, preço de ingresso e crescimento da torcida.
//
// Antes da 1.0.99 a bilheteria era um número solto: cada tela calculava o seu
// (`app/financas` usava 70% de ocupação fixa, `career-engine` usava outro preço)
// e as obras do estádio não mudavam nada, porque a capacidade vinha sempre do
// `estadio_cap` estático do clube. Este módulo é a fonte única: capacidade
// derivada do nível da obra, preço escolhido pelo usuário e público que responde
// a prestígio, torcida, títulos e ao próprio preço.

export type TicketTier = "barato" | "normal" | "caro"

export interface TicketTierInfo {
  id: TicketTier
  label: string
  description: string
  /** Multiplicador sobre o preço-base do ingresso. */
  priceMultiplier: number
  /** Efeito na demanda: barato lota, caro esvazia. */
  demandModifier: number
  /** Impacto na satisfação da torcida por partida em casa. */
  satisfactionDelta: number
}

export const TICKET_TIERS: Record<TicketTier, TicketTierInfo> = {
  barato: {
    id: "barato",
    label: "Popular",
    description: "Ingresso acessível: estádio cheio e torcida ao lado do clube, receita menor por pessoa.",
    priceMultiplier: 0.65,
    demandModifier: 1.18,
    satisfactionDelta: 2,
  },
  normal: {
    id: "normal",
    label: "Padrão",
    description: "Preço de mercado. Equilíbrio entre público e receita.",
    priceMultiplier: 1,
    demandModifier: 1,
    satisfactionDelta: 0,
  },
  caro: {
    id: "caro",
    label: "Premium",
    description: "Ingresso caro: mais receita por torcedor, mas arquibancadas vazias e desgaste com a torcida.",
    priceMultiplier: 1.55,
    demandModifier: 0.74,
    satisfactionDelta: -3,
  },
}

export const TICKET_TIER_ORDER: TicketTier[] = ["barato", "normal", "caro"]

/** Capacidade mínima garantida por nível de obra (espelha INFRASTRUCTURE_AREAS). */
export const STADIUM_LEVEL_CAPACITY = [15000, 25000, 40000, 55000, 70000]

// O nível 2 é o padrão de todo save novo, então ele é o âncora 1.0: clubes
// existentes mantêm exatamente a capacidade real do seu estádio e cada obra
// concluída passa a expandi-la de forma visível.
const LEVEL_CAPACITY_MULTIPLIER = [0.85, 1, 1.2, 1.45, 1.75]

function clampLevel(level: number): number {
  return Math.max(1, Math.min(5, Math.floor(level || 1)))
}

/** Capacidade efetiva do estádio considerando as obras concluídas. */
export function stadiumCapacity(baseCapacity: number, stadiumLevel: number): number {
  const level = clampLevel(stadiumLevel)
  const base = Math.max(5000, baseCapacity || 30000)
  const expanded = base * LEVEL_CAPACITY_MULTIPLIER[level - 1]
  return Math.round(Math.max(expanded, STADIUM_LEVEL_CAPACITY[level - 1]))
}

/** Quantos lugares a próxima obra acrescenta (usado na tela de infraestrutura). */
export function capacityGainForNextLevel(baseCapacity: number, stadiumLevel: number): number {
  const level = clampLevel(stadiumLevel)
  if (level >= 5) return 0
  return stadiumCapacity(baseCapacity, level + 1) - stadiumCapacity(baseCapacity, level)
}

/**
 * Prazo da obra em semanas. Ampliar arquibancada é obra pesada e cresce com o
 * degrau; as demais áreas continuam no ritmo antigo de 4 semanas.
 */
export function infrastructureUpgradeWeeks(areaId: string, targetLevel: number): number {
  if (areaId !== "stadium") return 4
  return 6 + (clampLevel(targetLevel) - 1) * 4
}

/**
 * Conta os títulos do clube no histórico da carreira. GameState não guarda uma
 * lista de troféus: o registro confiável é o `seasonHistory`, onde cada linha
 * anota quem foi campeão daquela competição.
 */
export function countCareerTitles(
  seasonHistory: { champion?: string; teamCurto?: string }[] | undefined,
  teamCurto: string | undefined,
): number {
  if (!seasonHistory || !teamCurto) return 0
  return seasonHistory.filter(record => record.champion === teamCurto).length
}

/** Preço-base do ingresso antes da política de preço escolhida. */
export function baseTicketPrice(prestige: number): number {
  return Math.round(45 + Math.max(0, prestige) * 0.85)
}

export interface MatchdayInput {
  /** Capacidade real do estádio (já com as obras). */
  capacity: number
  prestige: number
  /** Tamanho da torcida (campo `torcida` do clube). */
  fanBase?: number
  ticketTier?: TicketTier
  /** Títulos conquistados na carreira — relevância puxa público. */
  titles?: number
  result?: "win" | "draw" | "loss"
  /** Copas/continentais enchem mais e valem ingresso mais caro. */
  competitionWeight?: number
}

export interface MatchdayRevenue {
  attendance: number
  occupancy: number
  ticketPrice: number
  revenue: number
}

/**
 * Público e renda de um jogo em casa. Ocupação e preço são derivados dos mesmos
 * fatores em qualquer tela, então a projeção da infraestrutura bate com o que a
 * partida credita de verdade.
 */
export function calcMatchdayRevenue(input: MatchdayInput): MatchdayRevenue {
  const tier = TICKET_TIERS[input.ticketTier ?? "normal"]
  const competitionWeight = input.competitionWeight ?? 1

  let occupancy = 0.62
  occupancy += ((input.prestige ?? 50) - 50) / 100 * 0.25
  occupancy += Math.min(0.12, ((input.fanBase ?? 50000) / 1_000_000) * 0.12)
  occupancy += Math.min(0.08, (input.titles ?? 0) * 0.02)
  if (input.result === "win") occupancy += 0.06
  else if (input.result === "draw") occupancy += 0.02
  else if (input.result === "loss") occupancy -= 0.05
  occupancy *= tier.demandModifier * competitionWeight
  occupancy = Math.max(0.25, Math.min(1, occupancy))

  const ticketPrice = Math.round(baseTicketPrice(input.prestige) * tier.priceMultiplier * competitionWeight)
  const attendance = Math.round(input.capacity * occupancy)

  return { attendance, occupancy, ticketPrice, revenue: attendance * ticketPrice }
}

/**
 * Crescimento da torcida depois de um jogo em casa. Estádio grande e cheio,
 * vitórias e títulos atraem sócios; preço alto e derrota afastam.
 */
export function fanBaseGrowth(
  currentFanBase: number,
  matchday: MatchdayRevenue,
  result: "win" | "draw" | "loss",
  ticketTier: TicketTier = "normal",
): number {
  const base = Math.max(1000, currentFanBase || 50000)
  const resultFactor = result === "win" ? 0.004 : result === "draw" ? 0.001 : -0.002
  const occupancyFactor = (matchday.occupancy - 0.6) * 0.006
  const priceFactor = TICKET_TIERS[ticketTier].satisfactionDelta * 0.0004
  const growth = base * (resultFactor + occupancyFactor + priceFactor)
  return Math.max(1000, Math.round(base + growth))
}
