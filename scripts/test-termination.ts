// Custo de rescisão de contrato.
// Rodar: npx tsx scripts/test-termination.ts

import { terminationCost } from "../lib/game-engine"

let falhas = 0
function check(nome: string, atual: number, esperado: number) {
  const ok = atual === esperado
  if (!ok) falhas++
  console.log(`${ok ? "  ok  " : " FALHA"} ${nome}${ok ? "" : ` — esperado ${esperado}, veio ${atual}`}`)
}

const p = (salary: number, endDate: number) => ({ contract: { salary, endDate } })

console.log("\nCusto de rescisão\n")

// 50k/semana, 20 semanas restantes: 50k * 20 * 0.6 = 600k
check("contrato longo cobra o restante com desconto", terminationCost(p(50_000, 30), 10), 600_000)

// Contrato vencendo: piso de 4 semanas impede rescisão quase de graça.
check("piso de 4 semanas em contrato vencendo", terminationCost(p(50_000, 11), 10), 120_000)
check("piso vale tambem para contrato ja vencido", terminationCost(p(50_000, 5), 10), 120_000)

// Sem contrato nao ha multa.
check("sem contrato nao custa nada", terminationCost({ contract: null }, 10), 0)
check("salario zero nao custa nada", terminationCost(p(0, 30), 10), 0)

// Salario maior custa proporcionalmente mais — o ponto da feature e que
// dispensar um jogador caro DOI.
const barato = terminationCost(p(20_000, 30), 10)
const caro = terminationCost(p(200_000, 30), 10)
check("dispensar salario alto custa 10x mais", caro, barato * 10)

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}\n`)
process.exit(falhas === 0 ? 0 : 1)
