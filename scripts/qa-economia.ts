/**
 * QA da economia do clube — os três bugs relatados por jogador em 29/07/2026.
 *
 *   pnpm exec tsx scripts/qa-economia.ts
 *
 * Exercita o MOTOR de verdade (a store), não uma cópia da lógica: um teste que
 * reimplementa a regra passa mesmo quando o jogo está quebrado.
 */

import { useGameEngine, folhaSemanal } from "../lib/game-engine"
import { generateYouthProspects } from "../lib/youth-academy"

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

// ─── 5. O ID do jovem precisa ser único ENTRE peneiras ───────────────────────
//
// O anti-duplicata acima só funciona se cada venda tiver um recibo distinto, e
// o recibo é `jovem:<id>`. O id era `youth_<time>_<temporada>_<i>`: duas
// gerações do mesmo clube na mesma temporada devolviam os MESMOS 6 ids, então a
// segunda venda batia no recibo da primeira e era recusada em silêncio — o
// garoto sumia da base e o dinheiro não entrava.
//
// Este caso faltava: o teste de duplicata passava enquanto o bug era relatado,
// porque ele usava recibos escritos à mão ("jovem:99"), nunca os ids reais.

{
  const g1 = generateYouthProspects("BGT", 2026, 60, 6)
  const g2 = generateYouthProspects("BGT", 2026, 60, 6)
  const ids1 = new Set(g1.map(p => p.id))
  const colisoes = g2.filter(p => ids1.has(p.id)).length
  checar("duas peneiras do mesmo clube/temporada não repetem id", colisoes === 0,
    `${colisoes} de ${g2.length} colidiram`)
  checar("ids são únicos dentro da mesma peneira", ids1.size === g1.length)

  // 50 peneiras em rajada. É o caso que pega o relógio: várias gerações caem no
  // MESMO milissegundo, e só um contador as separa. Com `Date.now()` sozinho
  // isto colide às centenas.
  const vistos = new Set<string>()
  let repetidos = 0
  for (let n = 0; n < 50; n++) {
    for (const p of generateYouthProspects("BGT", 2026, 60, 6)) {
      if (vistos.has(p.id)) repetidos++
      vistos.add(p.id)
    }
  }
  checar("50 peneiras seguidas não repetem nenhum id", repetidos === 0,
    `${repetidos} repetidos em 300 jovens`)

  // O que o usuário sentia: vender o segundo jovem tinha de creditar de verdade.
  const antes = motor().balance
  motor().receberPorJovem(700_000, `jovem:${g1[0].id}`)
  motor().receberPorJovem(700_000, `jovem:${g2[0].id}`)
  checar("vender um jovem de cada peneira credita as DUAS vendas",
    motor().balance === antes + 1_400_000,
    `entrou ${((motor().balance - antes) / 1000).toFixed(0)}k, esperado 1400k`)
}

console.log(falhas === 0 ? "\nRESULTADO: TUDO OK" : `\nRESULTADO: ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
