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
