// Prova que a coletiva pos-jogo tem efeito, e que diretoria e elenco reagem de
// formas DIFERENTES a mesma resposta.
//
//   npx tsx scripts/test-press-effects.ts

import { calcularEfeitoColetiva } from "../lib/press-effects"

let falhas = 0
function checa(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "OK  " : "FALHA"} ${nome}${detalhe ? " — " + detalhe : ""}`)
}

// ── Sem responder nada: nada acontece ────────────────────────────────────────
const pulou = calcularEfeitoColetiva({ moraleImpact: 0, tons: [], venceu: true, perdeu: false })
checa("pular a coletiva nao mexe em nada",
  pulou.moralDelta === 0 && pulou.diretoriaDelta === 0 && pulou.recadoElenco === null)

// ── Derrota + bater no time: elenco cai, diretoria SOBE ──────────────────────
const cobrou = calcularEfeitoColetiva({
  moraleImpact: -4, tons: ["agressivo", "agressivo"], venceu: false, perdeu: true,
})
checa("derrota + cobranca publica derruba o elenco", cobrou.moralDelta < 0, `moral ${cobrou.moralDelta}`)
checa("derrota + cobranca publica agrada a diretoria", cobrou.diretoriaDelta > 0, `diretoria ${cobrou.diretoriaDelta}`)
checa("os dois lados divergem", Math.sign(cobrou.moralDelta) !== Math.sign(cobrou.diretoriaDelta))

// ── Derrota + blindar o grupo: elenco sobe, diretoria cai ────────────────────
const blindou = calcularEfeitoColetiva({
  moraleImpact: 6, tons: ["positivo", "positivo"], venceu: false, perdeu: true,
})
checa("derrota + elogio levanta o elenco", blindou.moralDelta > 0, `moral ${blindou.moralDelta}`)
checa("derrota + elogio desagrada a diretoria", blindou.diretoriaDelta < 0, `diretoria ${blindou.diretoriaDelta}`)

// ── Vitoria + bater no time: diretoria estranha ──────────────────────────────
const venceuECobrou = calcularEfeitoColetiva({
  moraleImpact: -3, tons: ["agressivo"], venceu: true, perdeu: false,
})
checa("vitoria + cobranca passa instabilidade a diretoria", venceuECobrou.diretoriaDelta < 0,
  `diretoria ${venceuECobrou.diretoriaDelta}`)

// ── Recados so aparecem quando ha efeito ─────────────────────────────────────
checa("efeito gera recado do elenco", cobrou.recadoElenco !== null)
checa("efeito gera recado da diretoria", cobrou.recadoDiretoria !== null)

// ── Limites: nada de saltos absurdos ─────────────────────────────────────────
const extremo = calcularEfeitoColetiva({
  moraleImpact: 999, tons: ["positivo", "positivo", "positivo"], venceu: true, perdeu: false,
})
checa("moral fica dentro do limite", Math.abs(extremo.moralDelta) <= 12, `moral ${extremo.moralDelta}`)
checa("confianca fica dentro do limite", Math.abs(extremo.diretoriaDelta) <= 8, `diretoria ${extremo.diretoriaDelta}`)

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
