// GLITCH DE DINHEIRO INFINITO na bilheteria por setor — teste de regressão.
//
// Relato (07/08/2026): "seleciono um time endividado, ponho o ingresso num valor
// alto, pago a dívida inteira e ainda sobra em caixa".
//
// A causa era o piso FIXO de 5% na ocupação: como a renda é `público × preço` e
// o público nunca caía abaixo de 5% do setor por mais caro que fosse o ingresso,
// a receita crescia sem limite. Este teste existe para a torneira não reabrir —
// o que ele checa não é um número específico, e sim a PROPRIEDADE: a receita
// precisa ter um máximo.

import { calcularRenda, precosSugeridos, repartirCapacidade, SETORES, type PorSetor, type SetorId } from "@/lib/stadium-sectors"

let falhas = 0
function ok(cond: boolean, msg: string) {
  console.log(`  ${cond ? "ok  " : "FALHA"} ${msg}`)
  if (!cond) falhas++
}

const PRESTIGIO = 65
const capacidades = repartirCapacidade(46_931)
const sugeridos = precosSugeridos(PRESTIGIO)

/** Renda com todos os setores multiplicando o preço sugerido por `fator`. */
function rendaCom(fator: number): number {
  const precos = Object.fromEntries(
    SETORES.map(s => [s.id, Math.round(sugeridos[s.id] * fator)]),
  ) as PorSetor<number>
  return calcularRenda({ capacidades, precos, prestigio: PRESTIGIO, atracao: 0.85 }).renda
}

console.log("== Bilheteria por setor: sem dinheiro infinito ==")

// 1. A PROPRIEDADE que fecha o glitch: preço absurdo NÃO rende absurdo.
{
  const justo = rendaCom(1)
  const caro = rendaCom(10)
  const absurdo = rendaCom(100)
  const insano = rendaCom(10_000)
  console.log(`     1x=${justo.toLocaleString("pt-BR")}  10x=${caro.toLocaleString("pt-BR")}`
    + `  100x=${absurdo.toLocaleString("pt-BR")}  10000x=${insano.toLocaleString("pt-BR")}`)
  ok(insano === 0, "preço 10.000x o sugerido esvazia o estádio: receita ZERO")
  ok(absurdo <= justo, "preço 100x nao rende mais que o preço justo")
}

// 2. A receita tem um MÁXIMO — varre a curva inteira e confere que ela cai.
{
  let melhor = 0
  let fatorDoPico = 0
  for (let f = 0.5; f <= 30; f += 0.25) {
    const r = rendaCom(f)
    if (r > melhor) { melhor = r; fatorDoPico = f }
  }
  const fim = rendaCom(60)
  ok(fatorDoPico < 30, `a receita tem pico (em ~${fatorDoPico.toFixed(2)}x) e nao cresce para sempre`)
  ok(fim < melhor, "depois do pico a receita CAI — cobrar mais caro passa a custar público")
}

// 3. Preço baixo continua enchendo: o piso do torcedor fiel sobreviveu.
{
  const barato = calcularRenda({
    capacidades,
    precos: Object.fromEntries(SETORES.map(s => [s.id, 1])) as PorSetor<number>,
    prestigio: PRESTIGIO, atracao: 0.85,
  })
  ok(barato.ocupacao > 0.5, "ingresso barato mantém o estádio cheio (ocupação > 50%)")
}

// 4. Um setor caro nao derruba os outros — a conta é por setor.
{
  const precos = Object.fromEntries(
    SETORES.map(s => [s.id, s.id === "camarote" ? sugeridos[s.id] * 50 : sugeridos[s.id]]),
  ) as PorSetor<number>
  const r = calcularRenda({ capacidades, precos, prestigio: PRESTIGIO, atracao: 0.85 })
  ok(r.porSetor["camarote" as SetorId].publico === 0, "camarote absurdamente caro fica vazio")
  ok(r.porSetor["geral" as SetorId].publico > 0, "a geral, no preço justo, segue cheia")
}

// 5. Nunca negativo.
{
  const r = rendaCom(1000)
  ok(r >= 0, "receita nunca fica negativa")
}

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} TESTE(S) FALHARAM`)
process.exit(falhas ? 1 : 0)
