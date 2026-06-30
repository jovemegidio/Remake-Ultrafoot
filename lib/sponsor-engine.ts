// PHASE 24 — Patrocínios
// Status: skeleton — master, fornecedor, bônus, penalidade, renovação.

export type SponsorTier = "master" | "fornecedor" | "secundario" | "manga" | "calção"

export interface Sponsor {
  id: string
  name: string
  tier: SponsorTier
  monthlyValue: number
  contractStart: number            // season
  contractEnd: number              // season
  bonuses: {
    titleBonus?: number
    promotionBonus?: number
    continentalBonus?: number
    starPlayerBonus?: number       // jogador estrela usando produto
  }
  penalties: {
    relegationPenalty?: number
    publicityPenalty?: number      // jogador polêmico do clube → desconto
  }
  exclusivity?: string[]           // categorias proibidas
}

export interface SponsorOffer {
  sponsor: Sponsor
  totalValue: number
  durationSeasons: number
  expiresInWeeks: number
}

/** Gera ofertas de patrocínio baseado em prestígio/torcida/marketing. */
export function generateOffers(_clubPrestigio: number, _facilitiesMarketingLevel: number): SponsorOffer[] {
  throw new Error("sponsor-engine.generateOffers: not implemented")
}

/** Aceita oferta — adiciona ao roster ativo. */
export function acceptOffer(_offer: SponsorOffer, _active: Sponsor[]): Sponsor[] {
  throw new Error("sponsor-engine.acceptOffer: not implemented")
}

/** Avalia bônus/penalidade aplicáveis no fim da temporada. */
export function evaluateContract(_sponsor: Sponsor, _seasonEvents: { titles: string[]; relegated: boolean }): {
  bonus: number
  penalty: number
} {
  throw new Error("sponsor-engine.evaluateContract: not implemented")
}

/** Renova contrato. */
export function renew(_sponsor: Sponsor, _newDurationSeasons: number, _newMonthlyValue: number): Sponsor {
  throw new Error("sponsor-engine.renew: not implemented")
}
