// PHASE 24 — Patrocínios
// Status: implementado — master, fornecedor, bônus, penalidade, renovação.
// ⚠️ ESTE CABEÇALHO SE DECLARAVA INCOMPLETO E MENTIA. O módulo está completo
//    e é lido por 4 arquivos do jogo. Um rótulo desatualizado PARA MENOS
//    custa o mesmo que um para mais: leva quem audita a recriar do zero o
//    que já está pronto.

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
  negotiationRound?: number
  status?: "open"|"countered"|"accepted"|"rejected"
  message?: string
}

export function counterSponsorOffer(offer:SponsorOffer,requestedMonthly:number,requestedDuration:number):{offer:SponsorOffer;result:"accepted"|"countered"|"rejected"}{const round=(offer.negotiationRound??0)+1,ceiling=offer.sponsor.monthlyValue*(1.12+round*.05),duration=Math.max(1,Math.min(5,requestedDuration));if(round>3||requestedMonthly>ceiling*1.2)return{offer:{...offer,negotiationRound:round,status:"rejected",message:"A empresa encerrou as conversas."},result:"rejected"};if(requestedMonthly<=ceiling){const sponsor={...offer.sponsor,monthlyValue:Math.round(requestedMonthly),contractEnd:offer.sponsor.contractStart+duration};return{offer:{...offer,sponsor,durationSeasons:duration,totalValue:sponsor.monthlyValue*12*duration,negotiationRound:round,status:"accepted",message:"A empresa aceitou sua contraproposta."},result:"accepted"}}const monthly=Math.round((offer.sponsor.monthlyValue+ceiling)/2/10000)*10000,sponsor={...offer.sponsor,monthlyValue:monthly,contractEnd:offer.sponsor.contractStart+duration};return{offer:{...offer,sponsor,durationSeasons:duration,totalValue:monthly*12*duration,negotiationRound:round,status:"countered",message:"A empresa apresentou um valor intermediário."},result:"countered"}}

/**
 * Gera ofertas de patrocínio baseado em prestígio/torcida/marketing.
 *
 * ⚠️ `season` É A TEMPORADA DO JOGO E NÃO PODE VOLTAR A SER O RELÓGIO REAL.
 * Até a 1.0.377 esta função carimbava `contractStart` com
 * `new Date().getFullYear()`, enquanto quem faz o contrato VENCER compara com
 * `state.season` (ver use-game-manager, "PATROCÍNIO: contratos VENCEM"). As duas
 * datas só coincidem na primeira temporada: medido, a partir da temporada 2029
 * TODA oferta nascia com `contractEnd` no passado e o patrocínio morria na
 * virada seguinte, para sempre, com o aviso de "chegou ao fim" todo ano.
 * O parâmetro é obrigatório de propósito — um valor padrão traria o bug de volta
 * em silêncio no primeiro chamador que esquecesse de passá-lo.
 */
export function generateOffers(clubPrestigio: number, facilitiesMarketingLevel: number, season: number): SponsorOffer[] {
  const base=Math.round((150000+clubPrestigio*22000)*(1+facilitiesMarketingLevel*.04)),names=["UltraBank","VivaBet","TecnoSul"]
  return names.map((name,i)=>{const duration=i+1,monthly=Math.round(base*(1-i*.08));return{sponsor:{id:`offer-${season}-${i}`,name,tier:i===0?"master":"secundario",monthlyValue:monthly,contractStart:season,contractEnd:season+duration,bonuses:{titleBonus:monthly*4,promotionBonus:monthly*2},penalties:{relegationPenalty:monthly*3}},totalValue:monthly*12*duration,durationSeasons:duration,expiresInWeeks:4+i}})
}

/** Aceita oferta — adiciona ao roster ativo. */
export function acceptOffer(offer: SponsorOffer, active: Sponsor[]): Sponsor[] {
  const conflicts=new Set(offer.sponsor.exclusivity??[]);return [...active.filter(s=>s.tier!==offer.sponsor.tier&&!s.exclusivity?.some(e=>conflicts.has(e))),structuredClone(offer.sponsor)]
}

/** Avalia bônus/penalidade aplicáveis no fim da temporada. */
export function evaluateContract(sponsor: Sponsor, seasonEvents: { titles: string[]; relegated: boolean }): {
  bonus: number
  penalty: number
} {
  return{bonus:seasonEvents.titles.length*(sponsor.bonuses.titleBonus??0),penalty:seasonEvents.relegated?(sponsor.penalties.relegationPenalty??0):0}
}

/** Renova contrato. */
export function renew(sponsor: Sponsor, newDurationSeasons: number, newMonthlyValue: number): Sponsor {
  return{...sponsor,monthlyValue:Math.max(0,newMonthlyValue),contractStart:sponsor.contractEnd,contractEnd:sponsor.contractEnd+Math.max(1,newDurationSeasons)}
}
