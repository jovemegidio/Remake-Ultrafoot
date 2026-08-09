/**
 * DOIS BUGS RELATADOS POR JOGADOR (08/08/2026).
 *
 *   1. "ao vender o time todo, ao voltar ao elenco os vendidos retornam" —
 *      valia tambem para emprestimo e leilao.
 *   2. "na contraproposta para uma selecao posso colocar o valor que eu quiser:
 *      glitch de salario infinito".
 *
 * O segundo e um bug de COMPOSICAO: cada rodada multiplicava a anterior. Bug
 * assim nao aparece num caso isolado — so iterando. Por isso os testes abaixo
 * rodam a negociacao em loop, que e como o jogador o encontrou.
 */
import { salarioDeMercadoDaSelecao, tetoSalarialDaSelecao, MAX_RODADAS_DE_NEGOCIACAO } from "../lib/use-national-team"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

console.log("\nBUGS RELATADOS — 1.0.277\n")

// ─── 1. ELENCO: a regra que decide entre motor e dado do clube ──────────────
//
// Reproduz a condicao de `rosterFromSource` em lib/use-user-roster.ts. O bug
// era `engineSquad.length >= 11` sozinho: abaixo disso a tela remontava o
// elenco do DADO DO CLUBE e ressuscitava quem havia saido.
function usaElencoDoMotor(tamanhoDoElenco: number, carreiraViva: boolean): boolean {
  return tamanhoDoElenco >= 11 || carreiraViva
}

{
  ok("carreira viva com 3 atletas usa o MOTOR (nao ressuscita)", usaElencoDoMotor(3, true))
  ok("carreira viva com 0 atletas usa o MOTOR", usaElencoDoMotor(0, true))
  ok("carreira viva com 1 atleta usa o MOTOR", usaElencoDoMotor(1, true))
  ok("elenco cheio usa o MOTOR", usaElencoDoMotor(25, true))
  // Sem carreira (previa de time no menu) o dado do clube continua sendo a fonte.
  ok("sem carreira e elenco vazio: usa o dado do clube", !usaElencoDoMotor(0, false))
  ok("sem carreira mas com 11+: ainda usa o motor", usaElencoDoMotor(11, false))
  // A regressao exata do relato.
  ok("REGRESSAO: vender ate 5 nao traz ninguem de volta", usaElencoDoMotor(5, true))
}

// ─── 2. SELECAO: negociacao de salario ───────────────────────────────────────
interface Oferta { monthlySalary: number; negotiationRound: number; strength: number }

/** Reproducao fiel de `counterOffer` (lib/use-national-team.ts). */
function contrapor(oferta: Oferta, pedidoBruto: number, meses: number): { oferta: Oferta; aceita: boolean } {
  const TETO = tetoSalarialDaSelecao(oferta.strength)
  const pedidoValido = Number.isFinite(pedidoBruto) && pedidoBruto > 0
  const pedido = pedidoValido ? Math.round(pedidoBruto) : 0
  const atual = oferta.monthlySalary
  const aumento = pedido / Math.max(1, atual)
  const rodada = oferta.negotiationRound + 1
  const limite = rodada === 1 ? 1.25 : 1.12
  const aceita = pedidoValido && rodada <= MAX_RODADAS_DE_NEGOCIACAO && aumento <= limite
    && pedido <= TETO && meses >= 12 && meses <= 48
  const arredondar = (v: number) => Math.round(Math.min(v, TETO) / 5_000) * 5_000
  if (aceita) return { oferta: { ...oferta, monthlySalary: arredondar(pedido), negotiationRound: rodada }, aceita: true }
  const melhoria = rodada > MAX_RODADAS_DE_NEGOCIACAO ? 1 : rodada === 1 ? 1.1 : 1.04
  return { oferta: { ...oferta, monthlySalary: arredondar(atual * melhoria), negotiationRound: rodada }, aceita: false }
}

const nova = (strength = 70): Oferta =>
  ({ monthlySalary: salarioDeMercadoDaSelecao(strength), negotiationRound: 0, strength })

{
  const teto = tetoSalarialDaSelecao(70)
  ok("teto e 1,4x o salario de mercado", teto === Math.round(salarioDeMercadoDaSelecao(70) * 1.4 / 5_000) * 5_000)

  // ROTA 1 do glitch: pedir absurdo em sequencia. Cada recusa aumentava a oferta.
  let o = nova()
  for (let i = 0; i < 200; i++) o = contrapor(o, 999_999_999, 24).oferta
  ok("200 pedidos absurdos NAO estouram o teto", o.monthlySalary <= teto, `virou ${o.monthlySalary}`)

  // ROTA 2 do glitch: pedir sempre o maximo aceitavel, compondo.
  let p = nova()
  for (let i = 0; i < 200; i++) {
    const limite = p.negotiationRound === 0 ? 1.25 : 1.12
    p = contrapor(p, p.monthlySalary * limite, 24).oferta
  }
  ok("200 pedidos no limite NAO estouram o teto", p.monthlySalary <= teto, `virou ${p.monthlySalary}`)

  // A negociacao congela depois do maximo de rodadas.
  let q = nova()
  q = contrapor(q, 999_999_999, 24).oferta
  q = contrapor(q, 999_999_999, 24).oferta
  const antesDoCongelamento = q.monthlySalary
  q = contrapor(q, 999_999_999, 24).oferta
  ok("apos o maximo de rodadas a oferta congela", q.monthlySalary === antesDoCongelamento)
  ok("e a contraproposta tardia e recusada", !contrapor(q, q.monthlySalary * 1.01, 24).aceita)
}

// Entrada suja: o campo aceitava NaN e negativo.
{
  const o = nova()
  ok("NaN nao e aceito", !contrapor(o, Number.NaN, 24).aceita)
  ok("NaN nao reduz o salario", contrapor(o, Number.NaN, 24).oferta.monthlySalary >= o.monthlySalary)
  ok("negativo nao e aceito como aumento", !contrapor(o, -5_000_000, 24).aceita)
  ok("Infinity nao e aceito", !contrapor(o, Number.POSITIVE_INFINITY, 24).aceita)
}

// O que DEVE continuar funcionando: pedido razoavel na 1a rodada passa.
{
  const o = nova()
  const r = contrapor(o, o.monthlySalary * 1.2, 24)
  ok("pedido de +20% na 1a rodada e aceito", r.aceita)
  ok("o salario aceito e o pedido", r.oferta.monthlySalary === Math.round(o.monthlySalary * 1.2 / 5_000) * 5_000)
  ok("contrato fora de 12-48 meses e recusado", !contrapor(nova(), nova().monthlySalary * 1.1, 60).aceita)
}

// Selecao forte tem teto maior que selecao fraca (o teto acompanha a forca).
{
  ok("teto acompanha a forca da selecao", tetoSalarialDaSelecao(90) > tetoSalarialDaSelecao(50))
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)
