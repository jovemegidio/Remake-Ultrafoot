// A CENA NÃO PODE INVENTAR LANCE.
//
// O 3D encena o que o motor de partida decidiu. A tradução entre os dois
// vocabulários tem casos que exigem decisão (cartão genérico, impedimento,
// lesão), e o risco de errar é mostrar ao jogador um lance que não aconteceu —
// sem erro nenhum no console.
//
// ⚠️ O que este teste protege é a regra de ouro: **tipo desconhecido não vira
// cena**. Se alguém um dia "resolver" um tipo novo mapeando para o mais
// parecido, a cena passa a mentir e nada acusa.
//
//   npx tsx scripts/test-eventos-para-3d.ts

import { conhecido, SEM_ENCENACAO, tipoParaCena } from "../lib/eventos-para-3d"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

console.log("\nOs eventos que o motor de partida produz\n")

// Extraidos de lib/match-engine.ts. Se um novo aparecer la, este teste reprova
// ate alguem DECIDIR o que fazer com ele — que e o objetivo.
const DO_MOTOR = [
  "card", "chance", "corner", "counter_attack", "foul", "fulltime", "goal",
  "halftime", "injury", "kickoff", "miss", "offside", "penalty", "post",
  "red_card", "save", "yellow_card",
]

for (const t of DO_MOTOR) {
  check(`"${t}" é conhecido (traduzido ou recusado de propósito)`, conhecido(t))
}

console.log("\nTraduções diretas\n")

check("gol vira gol", tipoParaCena("goal") === "goal")
check("escanteio vira escanteio", tipoParaCena("corner") === "corner")
check("defesa vira defesa", tipoParaCena("save") === "save")
check("trave vira trave", tipoParaCena("post") === "post")
check("amarelo e vermelho não se misturam",
  tipoParaCena("yellow_card") === "yellow_card" && tipoParaCena("red_card") === "red_card")
check("intervalo e fim de jogo chegam", tipoParaCena("halftime") === "halftime" && tipoParaCena("fulltime") === "fulltime")

console.log("\nAs decisões, e por que elas\n")

check("impedimento vira falta marcada (para o jogo e devolve a posse)",
  tipoParaCena("offside") === "free_kick")
check("chance vira ataque (estado ofensivo, sem desfecho inventado)",
  tipoParaCena("chance") === "attack")

console.log("\n⚠️ O QUE NÃO PODE VIRAR CENA\n")

check("lesão NÃO é encenada (não há equivalente honesto)", tipoParaCena("injury") === null)
check("cartão GENÉRICO não é encenado (mostraria vermelho onde houve amarelo)",
  tipoParaCena("card") === null)
check("os dois estão declarados como recusa, não esquecimento",
  SEM_ENCENACAO.has("injury") && SEM_ENCENACAO.has("card"))

console.log("\n⚠️ A REGRA DE OURO: desconhecido NÃO vira cena\n")

for (const inventado of ["voo_rasante", "", "GOL_INVENTADO", "substituicao", "var"]) {
  check(`"${inventado || "(vazio)"}" não vira lance`, tipoParaCena(inventado) === null)
}
check("e desconhecido também não passa por 'conhecido'", !conhecido("voo_rasante"))

console.log("\nMaiúsculas não quebram a tradução\n")

check("GOAL funciona igual a goal", tipoParaCena("GOAL") === "goal")

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)
