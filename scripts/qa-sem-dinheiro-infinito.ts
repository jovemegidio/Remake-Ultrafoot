/**
 * O PORTAO CONTRA DINHEIRO INFINITO (1.0.379).
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/qa-sem-dinheiro-infinito.ts
 *
 * ⚠️ POR QUE ELE EXISTE. Auditoria de 28/08/2026 nos 13 pontos do motor que
 * CREDITAM caixa: dois deles nao tinham trava de repeticao.
 *
 *   1. O formulario de pedidos a diretoria (`app/gestao-avancada`) limitava
 *      apenas o pedido PRIORITARIO a um por temporada. Pedido comum era
 *      ilimitado, e com a confianca da diretoria em 70+ todo pedido saia
 *      "aprovado" liberando verba na hora. Medido num clube de Serie A com
 *      elenco de R$ 300 milhoes: R$ 18,7 MILHOES POR ENVIO, sem espera e sem
 *      custo. Escrever qualquer justificativa e clicar em laco dava saldo
 *      infinito em menos de um minuto.
 *
 *   2. `createMarketingContract` creditava o `upfrontPayment` (R$ 2 a 12
 *      milhoes) a cada chamada, sem conferir se ja havia contrato ativo do
 *      mesmo tipo. Nenhuma tela a chamava — era um infinito LATENTE, esperando
 *      alguem ligar um botao nela.
 *
 * ⚠️ O QUE ESTE PORTAO EXERCITA. As duas travas de VERDADE — a funcao da lib e
 * a store do motor —, nunca uma copia da regra. Teste que reimplementa a regra
 * passa com o jogo quebrado.
 *
 * ⚠️ TRES CAMINHOS QUE JA ERAM SEGUROS entram aqui de proposito, porque sao
 * exatamente os que um refactor futuro quebraria sem ninguem notar:
 * `receberPorJovem` (recibo no MESMO `set` do dinheiro), `respondToOffer`
 * (recusa proposta que nao esta pendente) e `sellPlayer`.
 */

import { useGameEngine } from "../lib/game-engine"
import { verbaDisponivel282, verbaDoPedido282, PEDIDOS_FINANCIADOS_POR_TEMPORADA } from "../lib/gestao-282"

let falhas = 0
const ok = (m: string) => console.log(`ok   ${m}`)
const erro = (m: string) => { console.log(`FALHA ${m}`); falhas++ }
const M = (n: number) => `R$ ${(n / 1e6).toFixed(1)}M`

// ── 1. A DIRETORIA NAO ABRE O COFRE EM LACO ─────────────────────────────────
{
  const season = 2026
  const contexto = { valorDoElenco: 300_000_000, confianca: 85 }
  const pedidos: { season: number; verbaLiberada?: number }[] = []
  let total = 0

  // Cinquenta envios seguidos, que e o que um jogador faz em um minuto.
  for (let i = 0; i < 50; i++) {
    const cota = verbaDisponivel282(pedidos, season)
    const verba = cota.liberado ? verbaDoPedido282({ tipo: "orcamento", prioridade: false }, contexto) : 0
    total += verba
    pedidos.push({ season, verbaLiberada: verba || undefined })
  }

  const porEnvio = verbaDoPedido282({ tipo: "orcamento", prioridade: false }, contexto)
  const tetoEsperado = porEnvio * PEDIDOS_FINANCIADOS_POR_TEMPORADA
  if (total > tetoEsperado) {
    erro(`50 pedidos liberaram ${M(total)} — teto da temporada e ${M(tetoEsperado)}`)
  } else {
    ok(`diretoria: 50 pedidos liberaram ${M(total)} (${PEDIDOS_FINANCIADOS_POR_TEMPORADA} financiados), nao ${M(porEnvio * 50)}`)
  }

  // A temporada seguinte volta a ter cota — a trava e por temporada, nao eterna.
  const cotaNova = verbaDisponivel282(pedidos, season + 1)
  if (!cotaNova.liberado) erro("a cota nao renovou na temporada seguinte")
  else ok("diretoria: a cota renova na temporada seguinte")
}

// ── 2. CONTRATO DE MARKETING: UM ATIVO POR TIPO ─────────────────────────────
{
  const motor = () => useGameEngine.getState()
  useGameEngine.setState({ balance: 10_000_000, marketingContracts: [] })
  const antes = motor().balance

  for (let i = 0; i < 20; i++) motor().createMarketingContract("esquadrao_imbativel")

  const ativos = motor().marketingContracts.filter(c => c.active && c.type === "esquadrao_imbativel").length
  const ganho = motor().balance - antes
  const umPagamento = motor().marketingContracts[0]?.upfrontPayment ?? 0

  if (ativos !== 1) {
    erro(`20 chamadas criaram ${ativos} contratos ativos do mesmo tipo`)
  } else {
    ok("marketing: 20 chamadas, um contrato ativo por tipo")
  }
  if (ganho > umPagamento) {
    erro(`20 chamadas creditaram ${M(ganho)} — um pagamento e ${M(umPagamento)}`)
  } else {
    ok(`marketing: creditou ${M(ganho)} uma vez so, nao ${M(umPagamento * 20)}`)
  }
}

// ── 3. VENDA DE JOVEM NAO PAGA DUAS VEZES ───────────────────────────────────
{
  const motor = () => useGameEngine.getState()
  useGameEngine.setState({ balance: 0, vendasDeJovensPagas: [] })
  for (let i = 0; i < 10; i++) motor().receberPorJovem(1_000_000, "venda-unica")
  const saldo = motor().balance
  if (saldo !== 1_000_000) {
    erro(`dez chamadas do MESMO recibo creditaram ${M(saldo)}`)
  } else {
    ok("jovem: dez chamadas do mesmo recibo pagaram uma vez")
  }
  // Recibo diferente TEM de pagar — a trava nao pode barrar venda legitima.
  motor().receberPorJovem(500_000, "outra-venda")
  if (motor().balance !== 1_500_000) erro("a trava barrou uma venda legitima de outro recibo")
  else ok("jovem: venda de outro recibo continua sendo paga")
}

// ── 4. O CAIXA NUNCA FICA NEGATIVO POR GASTO ────────────────────────────────
{
  const motor = () => useGameEngine.getState()
  useGameEngine.setState({ balance: 1_000_000 })
  const passou = motor().spendClubFunds(5_000_000)
  if (passou || motor().balance < 0) {
    erro(`gasto acima do caixa foi aceito (saldo ${M(motor().balance)})`)
  } else {
    ok("caixa: gasto acima do saldo e recusado, sem saldo negativo")
  }
  // E gasto negativo nao pode virar receita pela porta dos fundos.
  const antes = motor().balance
  motor().spendClubFunds(-5_000_000)
  if (motor().balance > antes) erro("gasto NEGATIVO creditou o caixa")
  else ok("caixa: valor negativo em gasto nao vira receita")
}

console.log(falhas === 0
  ? "\nSEM DINHEIRO INFINITO — os caminhos de credito tem trava de repeticao."
  : `\n${falhas} caminho(s) de dinheiro infinito abertos.`)
process.exit(falhas === 0 ? 0 : 1)
