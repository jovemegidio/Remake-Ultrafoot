// O GATE DA BUSCA DE CLUBE (1.0.345).
//
// ⚠️ POR QUE ELE EXISTE. O jogo travava em várias telas, incluindo a seleção de
// times. A causa não era erro de JavaScript — era CUSTO: `getTeamByShort` levava
// 3,45 ms por chamada e `getTeamByName` 1,39 ms, porque as duas refaziam
// `allTeams.map(applyTeamOverride)` (e o pool inteiro, ~3.000 clubes) a CADA
// consulta. Numa tela que consulta clube em laço isso vira O(n²): uma tabela de
// 500 linhas congelava quase 2 segundos.
//
// Nada disso aparece num type-check, num lint ou num teste de comportamento —
// todos passavam. Desempenho que ninguém mede regride em silêncio, e foi o
// jogador quem percebeu. Este gate mede.
//
// ⚠️ O LIMITE É FOLGADO DE PROPÓSITO. A máquina de quem roda o gate varia, e um
// limite apertado viraria reprovação aleatória — que é pior que gate nenhum,
// porque ensina a ignorar. O que ele barra é a REGRESSÃO DE ORDEM DE GRANDEZA:
// voltar a refazer a lista por chamada custa ~100x o limite.
//
// Uso: npx tsx scripts/test-busca-de-clube-rapida.ts

import { allTeams, getTeamByName, getTeamByShort } from "@/lib/teams-data"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

const CHAMADAS = 300
/** ms por chamada. Medido depois da correção: 0,06 e 0,008. */
const TETO_MS = 0.5

const alvo = allTeams[50]

// Aquece: a primeira chamada monta o índice, e medir a montagem seria medir
// outra coisa. O que importa é o custo da consulta REPETIDA, que é o que a tela
// faz ao percorrer uma lista.
getTeamByShort(alvo.curto)
getTeamByName(alvo.nome)

for (const [nome, fn] of [
  ["getTeamByShort", () => getTeamByShort(alvo.curto)],
  ["getTeamByName", () => getTeamByName(alvo.nome)],
] as const) {
  const t0 = Date.now()
  for (let i = 0; i < CHAMADAS; i++) fn()
  const porChamada = (Date.now() - t0) / CHAMADAS
  console.log(`${nome.padEnd(16)} ${porChamada.toFixed(3)} ms por chamada`)
  if (porChamada > TETO_MS) {
    erro(`${nome} custa ${porChamada.toFixed(2)} ms por chamada (teto ${TETO_MS}) — `
      + "provavelmente voltou a refazer a lista de clubes a cada consulta")
  }
}

// ── E rapido nao pode significar ERRADO ─────────────────────────────────────
// O indice resolve o homonimo feminino na montagem; se essa regra se perder, a
// busca fica rapida e devolve o clube errado — pior que lenta.
const ajax = getTeamByName("Ajax")
if (ajax?.file_key !== "ajax") {
  erro(`"Ajax" devolveu ${ajax?.file_key} — o masculino tem de vencer o homonimo feminino`)
}

let semResposta = 0
for (const t of allTeams) if (!getTeamByName(t.nome)) semResposta++
if (semResposta > 0) erro(`${semResposta} clube(s) deixaram de ser encontrados pelo proprio nome`)
console.log(`${allTeams.length} nomes conferidos, ${semResposta} sem resposta`)

console.log(falhas === 0
  ? "\nBUSCA OK — rapida e ainda devolvendo o clube certo."
  : `\n${falhas} problema(s) na busca de clube.`)
process.exit(falhas === 0 ? 0 : 1)
