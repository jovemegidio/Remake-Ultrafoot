// Renovacao e rescisao de contrato — COM negociacao de verdade.
//
// O que existia: `renewContract(playerId, newSalary, weeks)` gravava o que fosse
// pedido, sem ninguem do outro lado; e a rescisao cobrava `terminationCost` e
// pronto. Nao havia contraproposta, nao havia como o atleta discordar.
//
// Nao escrevi um motor novo: `negotiation-engine` ja tem agente, exigencias e
// contraproposta (`evaluateAgentOffer`), usado nas contratacoes. Aqui eu adapto
// aquele motor ao contexto de quem JA E do clube, que e diferente:
//
//  - Renovar nao e contratar. Nao ha luvas de chegada, ha premio por FICAR, e o
//    tempo de casa pesa a favor do clube.
//  - Contrato acabando enfraquece o clube: a menos de meia temporada do fim, o
//    atleta pode assinar de graca com outro e sabe disso.
//  - Na rescisao os papeis se INVERTEM: quem quer sair aceita receber menos;
//    quem esta bem exige o valor cheio para abrir mao do contrato.

import {
  computeAgentDemands,
  evaluateAgentOffer,
  ROLE_LABEL,
  type AgentResponse,
  type PersonalTerms,
  type SquadRole,
} from "@/lib/negotiation-engine"
import { multiplicadorDeSalario, type NivelDePrestigio } from "@/lib/prestigio-do-atleta"
import { efeitosDoTreinador } from "@/lib/efeito-do-treinador"

export interface ContractPlayer {
  name: string
  overall: number
  age: number
  /** Salario MENSAL atual. */
  salary: number
  marketValue: number
  /** Semanas restantes de contrato. */
  weeksLeft: number
  /** 0-100. Quem esta feliz cobra menos para renovar. */
  morale?: number
  /** Temporadas no clube. Tempo de casa desconta o pedido. */
  seasonsAtClub?: number
  /**
   * Nivel de prestigio (lib/prestigio-do-atleta.ts). Estrela e Top Mundial
   * cobram acima do que o overall deles pediria — e a contrapartida de valerem
   * mais no mercado. Ausente = "normal", o caso de quase todo atleta.
   */
  prestigio?: NivelDePrestigio
}

// ─── RENOVACAO ────────────────────────────────────────────────────────────────

export interface RenewalTerms {
  salary: number
  contractYears: number
  /** Premio por renovar (equivalente as luvas, mas por FICAR). */
  loyaltyBonus: number
  role: SquadRole
}

/**
 * O que o agente pede para renovar.
 *
 * Parte das exigencias de contratacao e aplica os descontos e agravantes de quem
 * ja esta na casa.
 */
export function computeRenewalDemands(player: ContractPlayer, clubPrestige: number) {
  const base = computeAgentDemands({
    playerOverall: player.overall,
    playerAge: player.age,
    marketValue: player.marketValue,
    currentClubPrestige: clubPrestige,
    buyingClubPrestige: clubPrestige, // mesmo clube: sem premio de mudanca
  })

  // Tempo de casa e moral alta seguram o pedido; contrato acabando o inflaciona,
  // porque a menos de meia temporada ele pode negociar livre com qualquer clube.
  const casa = Math.min(0.12, (player.seasonsAtClub ?? 0) * 0.03)
  const feliz = ((player.morale ?? 70) - 70) / 100 * 0.10
  const fim = player.weeksLeft <= 20 ? 0.18 : player.weeksLeft <= 40 ? 0.08 : 0

  // PRESTIGIO ENCARECE A RENOVACAO. O craque reconhecido sabe o que vale, e o
  // clube que o formou paga por isso — e a outra ponta de ele valer mais numa
  // venda. Sobe MENOS que o valor de mercado de proposito: contratar Estrela nao
  // pode ser so armadilha de folha salarial.
  // O TECNICO NEGOCIADOR SEGURA O PEDIDO (`lib/efeito-do-treinador.ts`: atributo
  // NEGOCIACAO + habilidade "Fidelizador"). Neutro em 1.
  //
  // Lido do retrato aqui dentro, e nao passado por parametro, porque
  // `computeRenewalDemands` tem tres chamadores (a avaliacao, a sugestao inicial
  // e a tela) e um deles esquecido daria numeros diferentes na mesa e no aceite —
  // exatamente o tipo de divergencia que o jogador enxerga como bug.
  const tecnico = efeitosDoTreinador().custoDeRenovacao
  const fator = (1 - casa - feliz + fim) * multiplicadorDeSalario(player.prestigio ?? "normal") * tecnico
  // Nunca abaixo do que ele ja ganha: ninguem renova para perder salario.
  const salary = Math.max(player.salary, Math.round(base.salary * fator))

  return {
    ...base,
    salary,
    // Premio de permanencia: ~2 meses, menor que as luvas de uma contratacao.
    signingBonus: Math.round(salary * 2),
    toughness: Math.min(95, base.toughness + (player.weeksLeft <= 20 ? 10 : 0)),
  }
}

/** Avalia uma proposta de renovacao. Pode aceitar, CONTRAPROPOR ou romper. */
export function evaluateRenewal(
  player: ContractPlayer,
  clubPrestige: number,
  terms: RenewalTerms,
): AgentResponse {
  const demands = computeRenewalDemands(player, clubPrestige)
  const comoContratacao: PersonalTerms = {
    salary: terms.salary,
    contractYears: terms.contractYears,
    signingBonus: terms.loyaltyBonus,
    role: terms.role,
  }
  return evaluateAgentOffer(comoContratacao, demands, player.name)
}

/** Ponto de partida da conversa: o que o clube poe na mesa primeiro. */
export function sugestaoInicialRenovacao(player: ContractPlayer, clubPrestige: number): RenewalTerms {
  const d = computeRenewalDemands(player, clubPrestige)
  return {
    // Comeca ABAIXO do pedido de proposito: renovacao sem margem de negociacao
    // seria um formulario, nao uma conversa.
    salary: Math.round(d.salary * 0.88),
    contractYears: d.contractYears,
    loyaltyBonus: Math.round(d.signingBonus * 0.7),
    role: d.minRole,
  }
}

// ─── RESCISAO ─────────────────────────────────────────────────────────────────

export type RescissionVerdict = "accepted" | "counter" | "rejected"

export interface RescissionResponse {
  verdict: RescissionVerdict
  message: string
  /** Valor que ele aceita, quando contrapropoe. */
  counterAmount?: number
  /** Quanto custaria pagar o contrato ate o fim, sem negociar. */
  fullCost: number
}

/** Salario restante ate o fim do contrato — o teto de uma rescisao. */
export function custoCheio(player: ContractPlayer): number {
  const meses = Math.max(0, player.weeksLeft) / 4.33
  return Math.round(player.salary * meses)
}

/**
 * O quanto o atleta QUER sair (0-1). Quanto mais quer, menos exige para liberar.
 *
 * Reserva encostado e infeliz aceita quase qualquer coisa; titular com moral alta
 * e contrato longo nao abre mao de nada.
 */
export function vontadeDeSair(player: ContractPlayer): number {
  let v = 0.35
  if ((player.morale ?? 70) < 45) v += 0.30
  else if ((player.morale ?? 70) > 80) v -= 0.20
  if (player.age >= 33) v += 0.15          // veterano prefere jogar a ficar parado
  if (player.weeksLeft <= 20) v += 0.20    // fim de contrato: sair cedo pouco muda
  if (player.overall >= 80) v -= 0.15      // craque tem onde jogar; nao tem pressa
  return Math.max(0, Math.min(1, v))
}

/**
 * Avalia a oferta de rescisao. Diferente da renovacao, aqui o CLUBE e quem
 * propoe pagar menos que o devido — e o atleta e que aceita ou nao.
 */
export function evaluateRescission(player: ContractPlayer, oferta: number): RescissionResponse {
  const cheio = custoCheio(player)
  if (cheio <= 0) {
    return {
      verdict: "accepted",
      fullCost: 0,
      message: `O contrato de ${player.name} ja esta no fim. A saida nao custa nada ao clube.`,
    }
  }

  const vontade = vontadeDeSair(player)
  // Piso: quanto menos ele quer sair, maior a fatia que exige.
  const minimoAceito = Math.round(cheio * (1 - vontade * 0.65))

  if (oferta >= cheio) {
    return {
      verdict: "accepted",
      fullCost: cheio,
      message: `${player.name} aceita. O contrato sera pago integralmente.`,
    }
  }
  if (oferta >= minimoAceito) {
    return {
      verdict: "accepted",
      fullCost: cheio,
      message: vontade > 0.6
        ? `${player.name} quer jogar e aceita abrir mao de parte do contrato.`
        : `Depois de conversar, ${player.name} aceita os termos.`,
    }
  }
  // Insulto: menos de 40% do que ele aceitaria — nem contrapropoe.
  if (oferta < minimoAceito * 0.4) {
    return {
      verdict: "rejected",
      fullCost: cheio,
      message: `${player.name} tem contrato e vai cumpri-lo. Essa proposta nao merece resposta.`,
    }
  }
  return {
    verdict: "counter",
    fullCost: cheio,
    counterAmount: minimoAceito,
    message: `${player.name} abre mao de parte do contrato, mas nao dessa forma. ` +
      `Ele libera por ${minimoAceito.toLocaleString("pt-BR")}.`,
  }
}

export { ROLE_LABEL }
