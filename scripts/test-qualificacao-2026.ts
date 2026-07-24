// Os classificados de 2026 tem que bater com a vida real. O jogador conhece
// estes nomes de cor — errar aqui e o tipo de bug que ele ve na primeira tela.
import { qualificacaoReal2026 } from "../lib/qualificacao-2026"
import { getTeamByShort, allBrazilianTeams } from "../lib/teams-data"
import { getUserCupPlan } from "../lib/use-game-manager"

let falhas = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) }
}

console.log("== Classificacao continental 2026 ==")

// 1) Os oito da Libertadores 2026 (fonte: CBF/CONMEBOL apos a Copa do Brasil).
const LIBERTA = ["Flamengo", "Corinthians", "Palmeiras", "Cruzeiro", "Mirassol", "Fluminense", "Botafogo", "Bahia"]
for (const nome of LIBERTA) {
  const q = qualificacaoReal2026(nome, 2026)
  check(q?.competicao === "libertadores", `${nome} deveria estar na Libertadores 2026, veio ${q?.competicao ?? "nada"}`)
}
console.log(`  Libertadores: ${LIBERTA.length} clubes conferidos`)

// 2) Botafogo e Bahia entram pela preliminar, nao direto nos grupos.
check(qualificacaoReal2026("Botafogo", 2026)?.fase === "preliminar", "Botafogo entra pela preliminar")
check(qualificacaoReal2026("Bahia", 2026)?.fase === "preliminar", "Bahia entra pela preliminar")
check(qualificacaoReal2026("Corinthians", 2026)?.fase === "grupos", "Corinthians entra direto nos grupos")

// 3) O caso que o jogador citou: o Corinthians entra pelo titulo da Copa do
//    Brasil 2025, nao pela posicao no Brasileirao.
const corinthians = qualificacaoReal2026("Corinthians", 2026)
check(/Copa do Brasil/i.test(corinthians?.motivo ?? ""), `motivo do Corinthians: ${corinthians?.motivo}`)
const flamengo = qualificacaoReal2026("Flamengo", 2026)
check(/Libertadores 2025/i.test(flamengo?.motivo ?? ""), `motivo do Flamengo: ${flamengo?.motivo}`)

// 4) Sao Paulo NAO se classificou para a Libertadores 2026 (ficou na Sula).
check(qualificacaoReal2026("São Paulo", 2026)?.competicao === "sulamericana", "Sao Paulo vai a Sul-Americana")

// 5) A tabela vale SO para 2026. De 2027 em diante manda o jogo.
check(qualificacaoReal2026("Corinthians", 2027) === null, "2027 nao pode usar a tabela fixa")
check(qualificacaoReal2026("Corinthians", 2025) === null, "2025 nao pode usar a tabela fixa")

// 6) Acentos e variacoes de nome nao podem furar o casamento.
check(qualificacaoReal2026("Sao Paulo", 2026) !== null, "Sao Paulo sem acento deve casar")
check(qualificacaoReal2026("Atlético Mineiro", 2026) !== null, "Atletico Mineiro deve casar")

// 7) INTEGRACAO: o plano de copas do Corinthians em 2026 tem que trazer a
//    Libertadores, e nao a Sul-Americana. E o bug que isto conserta.
const timeCorinthians = allBrazilianTeams.find(t => /corinthians/i.test(t.nome))
  ?? getTeamByShort("COR")
if (timeCorinthians) {
  const plano2026 = getUserCupPlan(timeCorinthians, [], null, 2026)
  const cont2026 = plano2026.find(p => p.competitionType === "continental")
  check(/libertadores/i.test(cont2026?.competition.name ?? ""),
    `plano 2026 do Corinthians: continental = ${cont2026?.competition.name ?? "nenhuma"}`)
  console.log(`  Corinthians 2026 -> ${cont2026?.competition.name ?? "nenhuma"}`)

  // Em 2027 volta a valer o criterio do jogo (posicao/prestigio).
  const plano2027 = getUserCupPlan(timeCorinthians, [], null, 2027)
  console.log(`  Corinthians 2027 -> ${plano2027.find(p => p.competitionType === "continental")?.competition.name ?? "nenhuma"} (criterio do jogo)`)
} else {
  falhas++
  console.log("  FALHA: nao achei o Corinthians na base de clubes")
}

console.log(falhas === 0 ? "\nOK — classificacao 2026 bate com a vida real" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
