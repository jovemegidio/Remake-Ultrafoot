// PARTIDA AO VIVO — decisões do técnico.
//
// ⚠️ O cabeçalho deste arquivo dizia "Status: skeleton" até a 1.0.292 e isso
// ficou ERRADO na 1.0.291, quando as decisões foram de fato ligadas. A auditoria
// da 3.0 leu o comentário, não o código, e classificou o sistema como "só altera
// o momentum uma vez" — que era verdade em 1.0.290 e não é mais.
//
// O que cada decisão faz HOJE, do minuto em que é tomada até expirar:
//   - `applyDecision` dá o empurrão imediato no momentum;
//   - `hooks/use-match-simulation` monta `homeCoachEffect`/`awayCoachEffect` a
//     cada tick e passa ao motor;
//   - `lib/match-engine` cobra isso em ataque, defesa, meio-campo, goleiro
//     (`applyCoachEffect`), no fator de energia e no bônus de pressão;
//   - `app/partida/ao-vivo` drena a energia INDIVIDUAL de cada atleta conforme a
//     decisão ativa;
//   - `saldoDeMoralDaPartida` (abaixo) leva o saldo para DEPOIS do apito.
//
// gritar, acalmar, pressionar, recuar, tudo ou nada, segurar resultado, bola
// longa, sub sugerida.

import type { MatchState } from "@/lib/match-engine"

export type MatchDecisionId =
  | "gritar"
  | "acalmar"
  | "pressionar"
  | "recuar"
  | "tudo_ou_nada"
  | "segurar_resultado"
  | "bola_longa"
  | "sub_sugerida"

export interface DecisionEffect {
  attackDelta: number              // -10..+10
  defenseDelta: number
  energyDelta: number              // -5..+5
  moraleDelta: number              // -10..+10
  pressureDelta: number            // 0..+15
  durationMinutes: number          // por quantos minutos vale
}

export interface ActiveDecision {
  id: MatchDecisionId
  appliedAtMinute: number
  effect: DecisionEffect
}

export const EMPTY_DECISION_EFFECT: DecisionEffect = {
  attackDelta: 0,
  defenseDelta: 0,
  energyDelta: 0,
  moraleDelta: 0,
  pressureDelta: 0,
  durationMinutes: 0,
}

/** A partir de qual minuto vale a habilidade "Fechamento de Casinha". */
export const MINUTO_DO_FECHAMENTO = 80

/**
 * Soma somente as intervencoes que continuam em vigor no minuto informado.
 *
 * `defesaNoFinal` e a habilidade "Fechamento de Casinha" do tecnico
 * (`lib/efeito-do-treinador.ts`), em pontos de defesa a partir do minuto 80.
 * Neutro em 0. Ela entra AQUI, e nao nas forcas do XI, por dois motivos: este e
 * o unico canal do jogo que ja e recalculado minuto a minuto, e ficando junto
 * das decisoes ela obedece ao mesmo teto que o motor aplica sobre elas.
 */
export function aggregateDecisionEffects(
  active: ActiveDecision[],
  minute: number,
  defesaNoFinal = 0,
): DecisionEffect {
  const base = active.reduce<DecisionEffect>((total, decision) => {
    if (minute >= decision.appliedAtMinute + decision.effect.durationMinutes) return total
    return {
      attackDelta: total.attackDelta + decision.effect.attackDelta,
      defenseDelta: total.defenseDelta + decision.effect.defenseDelta,
      energyDelta: total.energyDelta + decision.effect.energyDelta,
      moraleDelta: total.moraleDelta + decision.effect.moraleDelta,
      pressureDelta: total.pressureDelta + decision.effect.pressureDelta,
      durationMinutes: Math.max(total.durationMinutes, decision.effect.durationMinutes),
    }
  }, { ...EMPTY_DECISION_EFFECT })
  if (defesaNoFinal === 0 || minute < MINUTO_DO_FECHAMENTO) return base
  return { ...base, defenseDelta: base.defenseDelta + defesaNoFinal }
}

/** Aplica decisão do técnico durante a partida. */
export function applyDecision(state: MatchState, id: MatchDecisionId): {
  state: MatchState
  active: ActiveDecision
} {
  const effects: Record<MatchDecisionId, DecisionEffect> = {
    gritar:{attackDelta:3,defenseDelta:1,energyDelta:-2,moraleDelta:2,pressureDelta:5,durationMinutes:10}, acalmar:{attackDelta:-1,defenseDelta:2,energyDelta:2,moraleDelta:3,pressureDelta:0,durationMinutes:12},
    pressionar:{attackDelta:5,defenseDelta:-2,energyDelta:-4,moraleDelta:1,pressureDelta:10,durationMinutes:15}, recuar:{attackDelta:-4,defenseDelta:6,energyDelta:1,moraleDelta:0,pressureDelta:0,durationMinutes:15},
    tudo_ou_nada:{attackDelta:10,defenseDelta:-8,energyDelta:-5,moraleDelta:2,pressureDelta:15,durationMinutes:10}, segurar_resultado:{attackDelta:-6,defenseDelta:7,energyDelta:2,moraleDelta:0,pressureDelta:0,durationMinutes:12},
    bola_longa:{attackDelta:4,defenseDelta:-1,energyDelta:-2,moraleDelta:0,pressureDelta:4,durationMinutes:12}, sub_sugerida:{attackDelta:2,defenseDelta:2,energyDelta:4,moraleDelta:2,pressureDelta:2,durationMinutes:20},
  }
  const next = structuredClone(state), effect = effects[id]
  // A fala provoca uma resposta imediata pequena. O efeito esportivo completo
  // e sustentado entra no MatchConfig durante todos os minutos da decisao.
  next.momentum = Math.max(-50, Math.min(50, next.momentum + effect.moraleDelta + effect.pressureDelta * 0.2))
  return { state:next, active:{id,appliedAtMinute:state.minute,effect} }
}

/** Avalia se decisão é apropriada (pra IA do auxiliar sugerir). */
export function suggestDecision(state: MatchState): MatchDecisionId | null {
  const diff = state.home.goals - state.away.goals
  if (state.minute >= 80 && diff < 0) return "tudo_ou_nada"
  if (state.minute >= 75 && diff > 0) return "segurar_resultado"
  if (state.momentum < -25) return "acalmar"
  if (state.minute >= 55 && diff === 0) return "pressionar"
  return null
}

/**
 * SALDO DE MORAL QUE SOBREVIVE AO APITO FINAL.
 *
 * Até a 1.0.291 toda intervenção do técnico morria no minuto 90: o elenco não
 * guardava nada do que aconteceu no banco. Isto fecha o ciclo — o que o técnico
 * fez durante o jogo passa a valer alguma coisa na semana seguinte.
 *
 * A leitura é a do vestiário, não a da planilha: cobrar (`gritar`,
 * `tudo_ou_nada`) rende quando dá certo e custa quando não dá; acalmar e trocar
 * quem estava afundando rendem pouco, mas rendem em qualquer resultado; e
 * `segurar_resultado` só é bem-visto quando o resultado foi de fato segurado.
 *
 * Devolve DEGRAUS para `ajustarMoralJogador` (-2..+2), não pontos: é a mesma
 * escala das conversas e das punições, e sair dela desequilibraria as duas.
 */
export function saldoDeMoralDaPartida(
  tomadas: ActiveDecision[],
  desfecho: "vitoria" | "empate" | "derrota",
): number {
  if (!tomadas.length) return 0
  const bom = desfecho === "vitoria" ? 1 : desfecho === "empate" ? 0 : -1

  let pontos = 0
  for (const decisao of tomadas) {
    switch (decisao.id) {
      // Cobrança: multiplica o resultado, para os dois lados.
      case "gritar": pontos += bom * 1.2; break
      case "tudo_ou_nada": pontos += bom * 1.5; break
      case "pressionar": pontos += bom * 0.8; break
      // Cuidado com o elenco: rende pouco, mas rende sempre.
      case "acalmar": pontos += 0.7; break
      case "sub_sugerida": pontos += 0.5; break
      // Postura defensiva: só convence se o placar foi mantido.
      case "segurar_resultado": pontos += desfecho === "vitoria" ? 1 : -0.8; break
      case "recuar": pontos += desfecho === "derrota" ? -0.9 : 0.3; break
      case "bola_longa": pontos += bom * 0.4; break
    }
  }
  // Teto BAIXO de propósito: oito decisões numa goleada não podem valer mais do
  // que uma conversa individual bem conduzida.
  //
  // ⚠️ Sem dividir antes de arredondar. Uma divisão por 2 aqui zerava o caso
  // MAIS comum — uma única decisão na partida (-0,8 vira -0,4, que arredonda
  // para zero) — e o sistema pareceria ligado sem nunca fazer nada.
  return Math.max(-2, Math.min(2, Math.round(pontos)))
}

/** Remove decisões expiradas baseado no minuto atual. */
export function pruneExpired(_active: ActiveDecision[], _minute: number): ActiveDecision[] {
  return _active.filter(d => _minute < d.appliedAtMinute + d.effect.durationMinutes)
}
