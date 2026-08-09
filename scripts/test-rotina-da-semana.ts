/**
 * A SEMANA TEM DIAS — e a escolha do técnico precisa ter preço.
 *
 * Pedido: "implemente dia de jogo, dia de descanso, dia de treinamento (assim
 * como na vida real)".
 *
 * O que este teste trava:
 *   1. o número de jogos da semana define quantos dias sobram (vem do
 *      calendário, não de um botão);
 *   2. VÉSPERA DE JOGO nunca é dia de treino — nem na carga total. É o que
 *      impede a interface de entregar o elenco moído em campo;
 *   3. poupar CUSTA rendimento (menos carga) e RENDE energia. Se poupar fosse só
 *      vantagem, não seria decisão — seria a escolha óbvia;
 *   4. semana cheia de jogos quase não deixa treinar, que é o problema real de
 *      um clube em três competições.
 */
export {}

import { montarRotina } from "../lib/rotina-da-semana"

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

// ── 1. o calendario manda ───────────────────────────────────────────────────
const umJogo = montarRotina(1, "equilibrado")
const doisJogos = montarRotina(2, "equilibrado")
const tresJogos = montarRotina(3, "equilibrado")
ok("um jogo na semana", umJogo.diasDeJogo === 1, umJogo.resumo)
ok("dois jogos deixam menos dias de treino que um",
  doisJogos.diasDeTreino < umJogo.diasDeTreino,
  `${doisJogos.diasDeTreino} contra ${umJogo.diasDeTreino}`)
ok("tres jogos deixam menos ainda",
  tresJogos.diasDeTreino < doisJogos.diasDeTreino,
  `${tresJogos.diasDeTreino} contra ${doisJogos.diasDeTreino}`)
ok("a semana sempre tem 7 dias", umJogo.dias.length === 7 && tresJogos.dias.length === 7)

// ── 2. vespera de jogo nao e treino, nem na carga total ─────────────────────
for (const postura of ["carga_total", "equilibrado", "poupar"] as const) {
  const r = montarRotina(2, postura)
  const jogos = r.dias.filter(d => d.tipo === "jogo").map(d => d.indice)
  const vesperaTreinando = jogos.some(j => j > 0 && r.dias[j - 1].tipo === "treino")
  ok(`vespera de jogo nao e treino (${postura})`, !vesperaTreinando)
}

// ── 3. poupar tem preco e tem beneficio ─────────────────────────────────────
const total = montarRotina(1, "carga_total")
const poupando = montarRotina(1, "poupar")
ok("poupar reduz a carga de treino", poupando.fatorDeCarga < total.fatorDeCarga,
  `${poupando.fatorDeCarga.toFixed(2)} contra ${total.fatorDeCarga.toFixed(2)}`)
ok("...e devolve mais energia", poupando.recuperacaoExtra > total.recuperacaoExtra,
  `+${poupando.recuperacaoExtra} contra +${total.recuperacaoExtra}`)
ok("carga total treina mais dias que poupar",
  total.diasDeTreino > poupando.diasDeTreino,
  `${total.diasDeTreino} contra ${poupando.diasDeTreino}`)

// ── 4. semana cheia quase nao deixa treinar ─────────────────────────────────
const cheia = montarRotina(4, "carga_total")
ok("semana de quatro jogos quase nao tem treino", cheia.diasDeTreino <= 1,
  `${cheia.diasDeTreino} dia(s)`)
ok("...e a carga cai para o piso", cheia.fatorDeCarga <= 0.5,
  cheia.fatorDeCarga.toFixed(2))

// ── 5. limites: nada explode ────────────────────────────────────────────────
const livre = montarRotina(0, "carga_total")
ok("semana sem jogo e toda de trabalho", livre.diasDeJogo === 0 && livre.diasDeTreino >= 6,
  livre.resumo)
ok("o fator de carga respeita o teto", livre.fatorDeCarga <= 1.5, livre.fatorDeCarga.toFixed(2))
ok("os tipos de dia sao sempre validos",
  [umJogo, doisJogos, tresJogos, cheia, livre].every(r =>
    r.dias.every(d => ["jogo", "treino", "descanso", "viagem"].includes(d.tipo))))

console.log(`\nRESULTADO: ${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)
