// Teto salarial na contratação.
//
// A tela de Finanças já avisava "limite salarial excedido", mas buyPlayer só
// checava o CAIXA: dava para afundar o clube em folha sem nenhuma barreira.
//
// Rodar: npx tsx scripts/test-wage-budget.ts

import { exceedsWageBudget } from "../lib/game-engine"

let falhas = 0
function check(nome: string, atual: boolean, esperado: boolean) {
  const ok = atual === esperado
  if (!ok) falhas++
  console.log(`${ok ? "  ok  " : " FALHA"} ${nome}${ok ? "" : ` — esperado ${esperado}, veio ${atual}`}`)
}

const elenco = (salariosSemanais: number[]) => ({
  squadPlayers: salariosSemanais.map(salary => ({ contract: { salary } })),
})

console.log("\nTeto salarial (wageBudget é MENSAL = semanal x 4)\n")

// Folha semanal 100k = 400k/mes. Teto 500k deixa 100k/mes = 25k/semana de espaco.
const clube = { ...elenco([50_000, 50_000]), wageBudget: 500_000 }

check("contratacao dentro do espaco e permitida", exceedsWageBudget(clube, 20_000), false)
check("contratacao que estoura o teto e barrada", exceedsWageBudget(clube, 30_000), true)
check("exatamente no teto passa", exceedsWageBudget(clube, 25_000), false)
check("um centavo acima do teto barra", exceedsWageBudget(clube, 25_001), true)

// Sem teto definido nao ha fiscalizacao (saves antigos).
check("teto zero desliga a regra", exceedsWageBudget({ ...elenco([999_999]), wageBudget: 0 }, 999_999), false)

// Elenco vazio: so o salario novo conta.
check("elenco vazio compara so o novo salario", exceedsWageBudget({ squadPlayers: [], wageBudget: 400_000 }, 100_000), false)
check("elenco vazio barra salario acima do teto", exceedsWageBudget({ squadPlayers: [], wageBudget: 400_000 }, 100_001), true)

// Atleta sem contrato nao pesa na folha.
check("jogador sem contrato nao conta na folha",
  exceedsWageBudget({ squadPlayers: [{ contract: null }], wageBudget: 400_000 }, 100_000), false)

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}\n`)
process.exit(falhas === 0 ? 0 : 1)
