// Motor de negociacao em DUAS etapas.
//
// Antes a negociacao era so dinheiro: uma barra de "% do valor" decidia tudo e o
// jogador nao tinha voz — bastava pagar mais que ele vinha. Irreal.
//
// Agora:
//   1) O CLUBE avalia a proposta financeira (dinheiro manda aqui).
//   2) O JOGADOR avalia o PROJETO. Dinheiro ajuda, mas nao compra tudo: um craque de
//      um clube grande recusa ir para um clube pequeno mesmo com 10x o salario.
//
// Por isso e possivel (e comum) o clube aceitar e o jogador recusar.

export type NegotiationParty = "club" | "player"

export interface PlayerDecisionInput {
  playerOverall: number        // 0-100
  playerAge: number
  playerPotential?: number     // 0-100
  currentClubPrestige: number  // 0-100 (prestigio do clube atual do jogador)
  buyingClubPrestige: number   // 0-100 (prestigio do clube do usuario)
  /** Salario oferecido / salario esperado pelo jogador. 1.0 = exatamente o esperado. */
  wageRatio: number
  /** Overall do 11 titular do comprador — define se ele seria titular ou reserva. */
  buyingClubSquadStrength: number
}

export interface DecisionResult {
  accepted: boolean
  /** 0-100 — o quanto o jogador quis a transferencia. */
  score: number
  /** Motivo em PT-BR. Quando recusa, explica o QUE pesou contra. */
  reason: string
}

/** Etapa 1: o clube vendedor avalia o dinheiro. Aqui a grana e quase tudo. */
export function evaluateClubOffer(offerPercentage: number): { chance: number; label: string } {
  if (offerPercentage >= 150) return { chance: 98, label: "Irrecusavel" }
  if (offerPercentage >= 110) return { chance: 92, label: "Excelente" }
  if (offerPercentage >= 100) return { chance: 75, label: "Justa" }
  if (offerPercentage >= 90) return { chance: 50, label: "Razoavel" }
  if (offerPercentage >= 80) return { chance: 25, label: "Baixa" }
  return { chance: 5, label: "Insultuosa" }
}

/**
 * Etapa 2: o JOGADOR decide. Dinheiro entra, mas nao domina.
 * Um craque so troca um clube grande por um pequeno se o salario for absurdo — e
 * ainda assim pode recusar.
 */
export function evaluatePlayerDecision(input: PlayerDecisionInput): DecisionResult {
  const {
    playerOverall, playerAge, playerPotential = playerOverall,
    currentClubPrestige, buyingClubPrestige,
    wageRatio, buyingClubSquadStrength,
  } = input

  let score = 50
  const negatives: { weight: number; reason: string }[] = []

  // ── Prestigio: o fator mais pesado ────────────────────────────────────────
  // Subir de patamar atrai; descer de patamar afasta, e afasta MUITO.
  const prestigeDelta = buyingClubPrestige - currentClubPrestige
  score += prestigeDelta * 1.2
  if (prestigeDelta < -10) {
    negatives.push({
      weight: Math.abs(prestigeDelta) * 1.2,
      reason: "nao quer trocar um clube maior por um menor",
    })
  }

  // ── Minutagem: craque nao vai para o banco ────────────────────────────────
  // Se o elenco do comprador e mais forte que o jogador, ele seria reserva.
  const benchGap = buyingClubSquadStrength - playerOverall
  if (benchGap > 4) {
    const w = Math.min(30, benchGap * 2.5)
    score -= w
    negatives.push({ weight: w, reason: "nao aceita brigar por vaga no banco" })
  } else if (benchGap < -6) {
    score += 12 // seria estrela do time: atrativo
  }

  // ── Salario: ajuda, mas satura ────────────────────────────────────────────
  // Dobrar o salario nao dobra a vontade. Acima de ~2.5x o ganho e marginal:
  // e por isso que "10x" nao garante o sim.
  const wageBonus = Math.min(28, Math.max(-25, Math.log2(Math.max(0.25, wageRatio)) * 18))
  score += wageBonus
  if (wageRatio < 0.9) {
    negatives.push({ weight: 25 * (1 - wageRatio), reason: "considera o salario abaixo do que merece" })
  }

  // ── Idade / ambicao ───────────────────────────────────────────────────────
  if (playerAge >= 31) {
    // Veterano: prioriza dinheiro e jogo, liga menos para projeto.
    score += wageBonus * 0.35
  } else if (playerAge <= 23 && playerPotential > playerOverall + 6) {
    // Jovem promissor: quer projeto e minutos, nao banco de clube grande.
    if (benchGap > 2) {
      score -= 12
      negatives.push({ weight: 12, reason: "e jovem e quer jogar, nao amadurecer no banco" })
    }
  }

  // ── Estrela consolidada em clube forte: dificil de tirar ──────────────────
  if (playerOverall >= 82 && currentClubPrestige >= 75 && prestigeDelta < 0) {
    score -= 18
    negatives.push({ weight: 18, reason: "e idolo onde esta e nao ve motivo para sair" })
  }

  score = Math.max(2, Math.min(97, score))

  const accepted = Math.random() * 100 <= score

  if (accepted) {
    const driver =
      prestigeDelta > 8 ? "Enxerga o clube como um passo adiante na carreira."
      : wageBonus > 15 ? "A proposta salarial convenceu."
      : benchGap < -6 ? "Gostou de ser peca central do projeto."
      : "Topou o projeto."
    return { accepted: true, score: Math.round(score), reason: driver }
  }

  // Recusou: explica o QUE mais pesou contra (nao um "nao" generico).
  negatives.sort((a, b) => b.weight - a.weight)
  const main = negatives[0]?.reason ?? "nao se convenceu do projeto"
  return {
    accepted: false,
    score: Math.round(score),
    reason: `O jogador ${main}.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ETAPA 3 — O AGENTE e os TERMOS PESSOAIS
//
// Fechar com o clube nao fecha a contratacao. Quem senta na mesa depois e o AGENTE,
// e o trabalho dele e espremer: salario, luvas, tempo de contrato e — o que mais
// pesa — o PAPEL que o jogador vai ter no elenco. Prometer banco a um craque nao se
// compra com dinheiro; prometer titularidade a um reserva barateia o salario.
// ─────────────────────────────────────────────────────────────────────────────

/** Papel prometido ao jogador no elenco. */
export type SquadRole = "primordial" | "reforco" | "banco"

export const ROLE_LABEL: Record<SquadRole, string> = {
  primordial: "Jogador Primordial",
  reforco: "Reforco de Rotacao",
  banco: "Opcao de Banco",
}

export const ROLE_DESCRIPTION: Record<SquadRole, string> = {
  primordial: "Titular absoluto, peca central do time.",
  reforco: "Entra no rodizio, disputa a titularidade.",
  banco: "Opcao para o segundo tempo e desfalques.",
}

/** Peso do papel: quanto ele "vale" para o jogador (e quanto custa ao clube). */
const ROLE_WEIGHT: Record<SquadRole, number> = {
  primordial: 1.0,
  reforco: 0.6,
  banco: 0.25,
}

export interface PersonalTerms {
  /** Salario MENSAL oferecido. */
  salary: number
  /** Duracao do contrato, em anos (1-5). */
  contractYears: number
  /** Luvas (bonus de assinatura), pagas uma vez. */
  signingBonus: number
  role: SquadRole
}

export interface AgentDemands {
  salary: number
  signingBonus: number
  contractYears: number
  /** Papel MINIMO aceitavel. Abaixo disso o agente nem discute. */
  minRole: SquadRole
  /** 0-100: o quanto o agente e duro na queda. */
  toughness: number
}

const ROLE_RANK: Record<SquadRole, number> = { banco: 0, reforco: 1, primordial: 2 }

/**
 * O que o agente PEDE. Sai do patamar do jogador (overall, idade, clube atual) e do
 * porte de quem esta comprando: clube grande paga mais, e o agente sabe disso.
 */
export function computeAgentDemands(input: {
  playerOverall: number
  playerAge: number
  playerPotential?: number
  marketValue: number
  currentClubPrestige: number
  buyingClubPrestige: number
}): AgentDemands {
  const {
    playerOverall, playerAge, playerPotential = playerOverall,
    marketValue, currentClubPrestige, buyingClubPrestige,
  } = input

  // Salario-base ancorado no valor de mercado (~0,45% do valor por mes) e puxado
  // para cima pelo overall: craque nao ganha proporcional, ganha desproporcional.
  const overallMultiplier = 1 + Math.max(0, playerOverall - 70) * 0.06
  let salary = marketValue * 0.0045 * overallMultiplier

  // Clube rico? O agente pede mais — e sem constrangimento.
  if (buyingClubPrestige > currentClubPrestige) {
    salary *= 1 + (buyingClubPrestige - currentClubPrestige) * 0.008
  }

  // Luvas: ~4 meses de salario; sobem para quem sai de um clube grande (ele "abre mao").
  let signingBonus = salary * 4
  if (currentClubPrestige >= 78) signingBonus *= 1.5

  // Tempo de contrato: jovem quer longo (seguranca + valorizacao); veterano quer curto.
  let contractYears = 4
  if (playerAge >= 32) contractYears = 2
  else if (playerAge >= 29) contractYears = 3
  else if (playerAge <= 22 && playerPotential > playerOverall + 8) contractYears = 5

  // Papel minimo: craque nao vai para o banco, nem por dinheiro.
  let minRole: SquadRole = "banco"
  if (playerOverall >= 80) minRole = "primordial"
  else if (playerOverall >= 72) minRole = "reforco"

  // Dureza: craque de clube grande com agente faminto.
  const toughness = Math.min(95, Math.max(20,
    (playerOverall - 60) * 2.2 + currentClubPrestige * 0.25
  ))

  return {
    salary: Math.round(salary),
    signingBonus: Math.round(signingBonus),
    contractYears,
    minRole,
    toughness: Math.round(toughness),
  }
}

export type AgentVerdict = "accepted" | "counter" | "rejected"

export interface AgentResponse {
  verdict: AgentVerdict
  /** Fala do agente, em PT-BR. */
  message: string
  /** Presente quando verdict === "counter": o que ele exige para fechar. */
  counter?: PersonalTerms
  /** 0-100 — o quanto a proposta agradou. */
  satisfaction: number
}

/**
 * O agente avalia os termos. Ele pode:
 *  - aceitar,
 *  - CONTRA-PROPOR (o caso mais comum — e o que "dificulta" de verdade),
 *  - ou romper, quando a oferta e insultuosa ou o papel e abaixo do minimo dele.
 */
export function evaluateAgentOffer(
  terms: PersonalTerms,
  demands: AgentDemands,
  playerName: string,
): AgentResponse {
  // ── Papel abaixo do minimo: nao ha dinheiro que resolva ───────────────────
  if (ROLE_RANK[terms.role] < ROLE_RANK[demands.minRole]) {
    return {
      verdict: "rejected",
      satisfaction: 0,
      message: `${playerName} nao veio aqui para ser ${ROLE_LABEL[terms.role].toLowerCase()}. ` +
        `Sem pelo menos "${ROLE_LABEL[demands.minRole]}", nao ha conversa.`,
    }
  }

  // ── Quanto os termos atendem ao pedido ────────────────────────────────────
  const salaryRatio = demands.salary > 0 ? terms.salary / demands.salary : 1
  const bonusRatio = demands.signingBonus > 0 ? terms.signingBonus / demands.signingBonus : 1
  const yearsGap = Math.abs(terms.contractYears - demands.contractYears)

  // ── ATENDEU O QUE ELE PEDIU: fecha. ───────────────────────────────────────
  //
  // BUG que isto corrige: a aceitacao dependia so de `satisfaction >= 62`. Um agente
  // duro (toughness ~95) derruba a satisfacao em (95-50)*0.28 = 12,6 pontos, entao mesmo
  // ACEITANDO A CONTRAPROPOSTA dele a conta dava ~59 — abaixo de 62. Ele contrapropunha
  // de novo, para sempre: era impossivel fechar a contratacao ("mesmo colocando o que o
  // jogador pede, ele ainda aumenta as exigencias").
  //
  // Agora a regra e explicita e honesta: se o salario, as luvas e o papel atendem (ou
  // superam) o que ele exigiu, o agente ASSINA — independente da conta de satisfacao.
  const meetsSalary = terms.salary >= demands.salary
  const meetsBonus = terms.signingBonus >= demands.signingBonus
  const meetsRole = ROLE_RANK[terms.role] >= ROLE_RANK[demands.minRole]
  if (meetsSalary && meetsBonus && meetsRole) {
    return {
      verdict: "accepted",
      satisfaction: 100,
      message: `Fechado. ${playerName} assina — voce atendeu o que pedimos.`,
    }
  }

  // Papel ACIMA do minimo compensa dinheiro: promover a titular vale salario.
  const roleBonus = (ROLE_WEIGHT[terms.role] - ROLE_WEIGHT[demands.minRole]) * 30

  // Salario domina; luvas pesam menos; anos de contrato so incomodam se muito fora.
  let satisfaction =
    50 +
    (salaryRatio - 1) * 55 +
    (bonusRatio - 1) * 18 +
    roleBonus -
    yearsGap * 6

  // Agente duro exige mais para o mesmo nivel de satisfacao.
  satisfaction -= (demands.toughness - 50) * 0.28

  satisfaction = Math.max(0, Math.min(100, satisfaction))

  // ── Oferta insultuosa: rompe ──────────────────────────────────────────────
  if (salaryRatio < 0.55) {
    return {
      verdict: "rejected",
      satisfaction: Math.round(satisfaction),
      message: `Isso e menos da metade do que ${playerName} ganha no patamar dele. ` +
        `Nao vou nem levar essa proposta a ele.`,
    }
  }

  // ── Aceita ────────────────────────────────────────────────────────────────
  if (satisfaction >= 62) {
    return {
      verdict: "accepted",
      satisfaction: Math.round(satisfaction),
      message: `Temos acordo. ${playerName} esta animado com o projeto — pode preparar a assinatura.`,
    }
  }

  // ── Contra-proposta: o agente aperta ──────────────────────────────────────
  // Pede o que falta, com uma margem de gordura proporcional a dureza dele.
  const greed = 1 + demands.toughness / 320   // 1.06 a 1.30
  const counter: PersonalTerms = {
    salary: Math.round(Math.max(terms.salary, demands.salary * greed)),
    signingBonus: Math.round(Math.max(terms.signingBonus, demands.signingBonus * greed)),
    contractYears: demands.contractYears,
    // Se o papel esta no minimo e a satisfacao esta baixa, ele tenta subir o papel.
    role: satisfaction < 40 && ROLE_RANK[terms.role] < 2
      ? (ROLE_RANK[terms.role] === 0 ? "reforco" : "primordial")
      : terms.role,
  }

  const gaps: string[] = []
  if (counter.salary > terms.salary) gaps.push("o salario esta abaixo do mercado dele")
  if (counter.signingBonus > terms.signingBonus) gaps.push("as luvas nao compensam a mudanca")
  if (counter.contractYears !== terms.contractYears) gaps.push("o tempo de contrato nao serve")
  if (counter.role !== terms.role) gaps.push("ele quer um papel maior no elenco")

  return {
    verdict: "counter",
    satisfaction: Math.round(satisfaction),
    counter,
    message: gaps.length
      ? `Assim nao fecha: ${gaps.join(", ")}. Ajuste e voltamos a conversar.`
      : `Estamos perto, mas ainda nao e o suficiente. Melhore e fechamos.`,
  }
}
