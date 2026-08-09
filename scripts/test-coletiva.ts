/**
 * A COLETIVA TEM DE TER CONSEQUÊNCIA — inclusive quando o técnico não responde.
 *
 * Pedido: "a cada pergunta mal respondida isso deve impactar a moral com elenco
 * e diretoria (deixe o mais realista possível)".
 *
 * O que este teste trava:
 *   1. elenco e diretoria julgam COISAS DIFERENTES (bater no time em público
 *      agrada a cúpula e afunda o vestiário);
 *   2. deixar o tempo acabar (`omisso`) é pior do que responder mal — senão o
 *      cronômetro vira enfeite e ficar calado seria a jogada segura;
 *   3. omissão pesa também na VITÓRIA, onde só havia o que colher.
 */
export {}

import { calcularEfeitoColetiva } from "../lib/press-effects"

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

// ── elenco x diretoria julgam diferente ─────────────────────────────────────
const bateuNoTime = calcularEfeitoColetiva({
  moraleImpact: -4, tons: ["agressivo", "agressivo"], venceu: false, perdeu: true,
})
ok("cobrar em publico apos derrota afunda o vestiario", bateuNoTime.moralDelta < 0,
  `moral ${bateuNoTime.moralDelta}`)
ok("...e agrada a diretoria", bateuNoTime.diretoriaDelta > 0,
  `diretoria +${bateuNoTime.diretoriaDelta}`)

const blindouOGrupo = calcularEfeitoColetiva({
  moraleImpact: 4, tons: ["positivo", "positivo"], venceu: false, perdeu: true,
})
ok("blindar o grupo apos derrota agrada o elenco", blindouOGrupo.moralDelta > 0,
  `moral +${blindouOGrupo.moralDelta}`)
ok("...e desagrada a diretoria (falta de autocritica)", blindouOGrupo.diretoriaDelta < 0,
  `diretoria ${blindouOGrupo.diretoriaDelta}`)

// ── silencio e pior do que responder mal ────────────────────────────────────
const respondeuMal = calcularEfeitoColetiva({
  moraleImpact: -2, tons: ["negativo"], venceu: false, perdeu: true,
})
const naoRespondeu = calcularEfeitoColetiva({
  moraleImpact: -3, tons: ["omisso"], venceu: false, perdeu: true,
})
ok("nao responder machuca a moral mais do que responder mal",
  naoRespondeu.moralDelta < respondeuMal.moralDelta,
  `omisso ${naoRespondeu.moralDelta} x negativo ${respondeuMal.moralDelta}`)
ok("nao responder derruba a confianca da diretoria",
  naoRespondeu.diretoriaDelta < 0, `diretoria ${naoRespondeu.diretoriaDelta}`)
ok("a omissao gera recado proprio para o tecnico entender o motivo",
  /nao respondeu|sem resposta/i.test(naoRespondeu.recadoElenco?.titulo ?? ""),
  naoRespondeu.recadoElenco?.titulo ?? "(sem recado)")

// ── omissao pesa ate na vitoria ─────────────────────────────────────────────
const venceuECalou = calcularEfeitoColetiva({
  moraleImpact: -3, tons: ["omisso"], venceu: true, perdeu: false,
})
ok("calar apos vitoria tambem custa com a diretoria",
  venceuECalou.diretoriaDelta < 0, `diretoria ${venceuECalou.diretoriaDelta}`)

// ── nada respondido nao inventa efeito ──────────────────────────────────────
const pulou = calcularEfeitoColetiva({ moraleImpact: 0, tons: [], venceu: false, perdeu: false })
ok("pular a coletiva nao muda nada", pulou.moralDelta === 0 && pulou.diretoriaDelta === 0)

// ── os limites seguram valores absurdos ─────────────────────────────────────
const exagero = calcularEfeitoColetiva({
  moraleImpact: -99, tons: Array(20).fill("omisso"), venceu: false, perdeu: true,
})
ok("o impacto fica dentro do teto (uma coletiva nao destroi a temporada)",
  exagero.moralDelta >= -12 && exagero.diretoriaDelta >= -8,
  `moral ${exagero.moralDelta}, diretoria ${exagero.diretoriaDelta}`)

console.log(`\nRESULTADO: ${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)
