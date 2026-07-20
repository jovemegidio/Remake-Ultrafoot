// Cobradores designados de bola parada.
//
// Antes o motor sorteava por POSIÇÃO a cada lance (pickPlayerFull), então o
// especialista do elenco batia por acaso. Estes testes exercitam a SELEÇÃO do
// cobrador — que é o que a mudança faz.
//
// Nota de método: a primeira versão deste teste tentava provar o efeito rodando
// partidas inteiras e contando gols de escanteio. Deu 0 em 300 partidas e ainda
// assim reportou "todos passaram" — teste que não exercita nada é pior que
// nenhum. Testar a função de seleção direto é mais honesto e mais estável.
//
// Rodar: npx tsx scripts/test-set-pieces.ts

import { pickSetPieceTaker, type MatchConfig, type SquadPlayer } from "../lib/match-engine"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const jogador = (nome: string, pos: string, overall = 75): SquadPlayer =>
  ({ nome, pos, overall, shooting: overall, passing: overall } as SquadPlayer)

const elenco: SquadPlayer[] = [
  jogador("Goleiro", "GOL"),
  jogador("Zagueiro", "ZAG"),
  jogador("Meia Comum", "MEI", 70),
  jogador("BATEDOR", "MEI", 88),
  jogador("Ponta D", "PD"),
  jogador("Atacante", "ATA", 82),
]

const cfg = (takers?: MatchConfig["userSetPieceTakers"], userSide: "home" | "away" = "home") =>
  ({ homeSquad: elenco, awaySquad: elenco, userSide, userSetPieceTakers: takers } as MatchConfig)

const POS_ESCANTEIO = ["MEI", "PD", "PE"]

console.log("\nCobrador designado\n")

// 30 chamadas: se o designado for respeitado, é sempre ele. Se caísse no
// sorteio, "Meia Comum" e "Ponta D" apareceriam.
const escolhas = Array.from({ length: 30 }, () =>
  pickSetPieceTaker("home", cfg({ corner: "BATEDOR" }), "corner", POS_ESCANTEIO)?.nome,
)
check("designado cobra SEMPRE", escolhas.every(n => n === "BATEDOR"),
  `apareceram: ${[...new Set(escolhas)].join(", ")}`)

const semDesignado = Array.from({ length: 30 }, () =>
  pickSetPieceTaker("home", cfg(), "corner", POS_ESCANTEIO)?.nome,
)
check("sem designado, o motor sorteia entre os da posição",
  semDesignado.every(n => POS_ESCANTEIO.includes(elenco.find(p => p.nome === n)?.pos ?? "")),
  `apareceram: ${[...new Set(semDesignado)].join(", ")}`)
check("o sorteio realmente varia", new Set(semDesignado).size > 1,
  `sempre o mesmo: ${[...new Set(semDesignado)].join(", ")}`)

console.log("\nCada tipo de cobrança é independente\n")

const takers = { freeKick: "Atacante", corner: "BATEDOR", penalty: "Meia Comum" }
check("falta usa o batedor de falta",
  pickSetPieceTaker("home", cfg(takers), "freeKick", ["ATA", "MEI"])?.nome === "Atacante")
check("escanteio usa o batedor de escanteio",
  pickSetPieceTaker("home", cfg(takers), "corner", POS_ESCANTEIO)?.nome === "BATEDOR")
check("pênalti usa o batedor de pênalti",
  pickSetPieceTaker("home", cfg(takers), "penalty", ["ATA", "MEI"])?.nome === "Meia Comum")

console.log("\nRobustez\n")

// Designar quem não está em campo (vendido, suspenso, substituído) não pode
// travar a cobrança.
const fantasma = Array.from({ length: 20 }, () =>
  pickSetPieceTaker("home", cfg({ corner: "Jogador Inexistente" }), "corner", POS_ESCANTEIO)?.nome,
)
check("designado fora de campo cai no sorteio",
  fantasma.every(n => n !== undefined && n !== "Jogador Inexistente"),
  `veio: ${[...new Set(fantasma)].join(", ")}`)

// A regra é só do usuário: a IA continua sorteando.
const ia = Array.from({ length: 30 }, () =>
  pickSetPieceTaker("away", cfg({ corner: "BATEDOR" }, "home"), "corner", POS_ESCANTEIO)?.nome,
)
check("o adversário NÃO herda o cobrador do usuário", new Set(ia).size > 1,
  `IA usou sempre: ${[...new Set(ia)].join(", ")}`)

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}\n`)
process.exit(falhas === 0 ? 0 : 1)
