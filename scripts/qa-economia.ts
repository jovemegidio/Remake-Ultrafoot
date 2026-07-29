/**
 * QA da economia do clube — os três bugs relatados por jogador em 29/07/2026.
 *
 *   pnpm exec tsx scripts/qa-economia.ts
 *
 * Exercita o MOTOR de verdade (a store), não uma cópia da lógica: um teste que
 * reimplementa a regra passa mesmo quando o jogo está quebrado.
 */

import { useGameEngine, folhaSemanal } from "../lib/game-engine"

let falhas = 0

function checar(nome: string, condicao: boolean, detalhe = "") {
  if (!condicao) falhas++
  console.log(`${condicao ? "OK   " : "FALHA"} ${nome}${detalhe ? "  — " + detalhe : ""}`)
}

const motor = () => useGameEngine.getState()

// ─── 1. Venda de jovem não pode ser paga duas vezes ──────────────────────────
//
// Era o "dinheiro infinito dos juniores": o dinheiro fica no motor e a lista de
// jovens no save; se o save não chegasse ao disco, a venda era creditada de novo.

{
  const antes = motor().balance
  motor().receberPorJovem(1_000_000, "jovem:99")
  const depoisDaPrimeira = motor().balance
  checar("venda de jovem credita uma vez", depoisDaPrimeira === antes + 1_000_000,
    `${antes} -> ${depoisDaPrimeira}`)

  // A MESMA venda, de novo — é exatamente o que acontecia ao voltar para a tela.
  motor().receberPorJovem(1_000_000, "jovem:99")
  motor().receberPorJovem(1_000_000, "jovem:99")
  checar("repetir a MESMA venda não credita de novo", motor().balance === depoisDaPrimeira,
    `saldo ${motor().balance}, esperado ${depoisDaPrimeira}`)

  // Outra venda, com recibo diferente, precisa continuar valendo.
  motor().receberPorJovem(500_000, "jovem:100")
  checar("outra venda continua sendo paga", motor().balance === depoisDaPrimeira + 500_000,
    `saldo ${motor().balance}`)
}

// ─── 2. Gasto avulso não vira despesa semanal ────────────────────────────────
//
// Pagar 5 milhões de dívida UMA vez passava a custar 5 milhões POR SEMANA.

{
  useGameEngine.setState({ balance: 50_000_000, weeklyExpenses: 1_000_000 })
  const despesaAntes = motor().weeklyExpenses

  motor().spendClubFunds(5_000_000)
  checar("gasto avulso não mexe na despesa semanal",
    motor().weeklyExpenses === despesaAntes, `${despesaAntes} -> ${motor().weeklyExpenses}`)
  checar("gasto avulso debita o caixa", motor().balance === 45_000_000, String(motor().balance))

  motor().payClubDebt(3_000_000)
  checar("pagar dívida não mexe na despesa semanal",
    motor().weeklyExpenses === despesaAntes, `${despesaAntes} -> ${motor().weeklyExpenses}`)

  const receitaAntes = motor().weeklyIncome
  motor().addClubRevenue(2_000_000)
  checar("receita avulsa não vira receita semanal",
    motor().weeklyIncome === receitaAntes, `${receitaAntes} -> ${motor().weeklyIncome}`)
}

// ─── 3. Folha somada do elenco bate com o elenco ─────────────────────────────

{
  const elenco = [
    { contract: { salary: 100_000 } },
    { contract: { salary: 250_000 } },
    { contract: null },
    {},
  ]
  checar("folhaSemanal soma só quem tem contrato", folhaSemanal(elenco) === 350_000,
    String(folhaSemanal(elenco)))
  checar("folhaSemanal de elenco vazio é zero", folhaSemanal([]) === 0)
}

console.log(falhas === 0 ? "\nRESULTADO: TUDO OK" : `\nRESULTADO: ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
