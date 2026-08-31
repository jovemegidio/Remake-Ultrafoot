// O PORTAO DAS CLAUSULAS DO NEGOCIO (1.0.383).
//
//   node node_modules/tsx/dist/cli.mjs scripts/qa-clausulas-do-negocio.ts
//
// ⚠️ POR QUE ELE EXISTE. Este bloco mexe em DINHEIRO, e dinheiro e onde este
// projeto ja teve os piores defeitos: o glitch da bilheteria, o dinheiro
// infinito da diretoria (1.0.379) e a venda que pagava 100% de direitos que o
// clube nao tinha (corrigido em `lib/repartir-venda.ts`). Todos tinham a mesma
// forma: uma conta que criava ou destruia dinheiro do nada.
//
// O que este portao cobra:
//   1. parcelar ENCARECE — senao ninguem paga a vista de novo e a escolha some;
//   2. a soma das partes fecha EXATAMENTE com o total — centavo perdido por
//      negocio vira dinheiro destruido ao longo de uma carreira;
//   3. a parcela cai UMA vez, no ano certo, e some da lista depois;
//   4. o saldo de uma semana e a diferenca entre receber e pagar, num numero so;
//   5. a recompra tem prazo e o prazo VALE;
//   6. sem clausula nenhuma, tudo se comporta como antes da 1.0.383.

import assert from "node:assert"
import {
  JUROS_POR_PARCELA, MAX_PARCELAS, MAX_REVENDA, TERMOS_A_VISTA,
  descontoPorRecompra, descontoPorRevenda, parcelasRestantes, parcelasVencidas,
  recompraValida, resolverNegocio, saldoDasParcelas, totalComParcelamento,
  type Parcela,
} from "../lib/clausulas-do-negocio"

const ctx = (tipo: "receber" | "pagar", semana = 1000) => ({
  atleta: "Atleta", clube: "Clube", semanaAtual: semana, tipo,
})

// ── 1. PARCELAR ENCARECE ────────────────────────────────────────────────────
//
// Se parcelar fosse de graca, ninguem pagaria a vista nunca mais e a clausula
// deixaria de ser uma escolha.
const aVista = resolverNegocio(20_000_000, TERMOS_A_VISTA, ctx("pagar"))
assert.equal(aVista.total, 20_000_000, "a vista o total e o valor cheio")
assert.equal(aVista.parcelas.length, 0, "a vista nao agenda nada")
assert.equal(aVista.aVista, 20_000_000, "a vista sai tudo agora")

let anterior = 20_000_000
for (let n = 1; n <= MAX_PARCELAS; n++) {
  const total = totalComParcelamento(20_000_000, n)
  assert.ok(total > anterior, `${n} parcela(s) tem de custar mais que ${n - 1}`)
  anterior = total
}
assert.equal(
  totalComParcelamento(20_000_000, 1), Math.round(20_000_000 * (1 + JUROS_POR_PARCELA)),
  "o juro tem de ser o declarado, nao um numero improvisado",
)

// ── 2. A SOMA FECHA EXATAMENTE ──────────────────────────────────────────────
//
// A verificacao mais importante do arquivo. Arredondamento que nao fecha cria
// ou destroi dinheiro, e o erro se acumula em silencio por uma carreira inteira.
for (let n = 1; n <= MAX_PARCELAS; n++) {
  for (const valor of [1, 999, 1_000_000, 33_333_333, 87_654_321]) {
    const r = resolverNegocio(valor, { parcelas: n }, ctx("pagar"))
    const soma = r.aVista + r.parcelas.reduce((s, p) => s + p.valor, 0)
    assert.equal(soma, r.total, `valor ${valor} em ${n}x: soma ${soma} != total ${r.total}`)
    assert.equal(r.total, totalComParcelamento(valor, n), "o total tem de ser o do parcelamento")
    assert.ok(r.aVista >= 0, "a entrada nunca pode ser negativa")
  }
}

// ── 3. A PARCELA CAI UMA VEZ, NO ANO CERTO ──────────────────────────────────
const negocio = resolverNegocio(30_000_000, { parcelas: 3 }, ctx("pagar", 1000))
assert.deepEqual(
  negocio.parcelas.map(p => p.semana), [1052, 1104, 1156],
  "as parcelas sao ANUAIS a partir do ano seguinte, nao semanais",
)
assert.equal(
  parcelasVencidas(negocio.parcelas, 1051).length, 0,
  "uma semana antes do aniversario nada vence",
)
assert.equal(parcelasVencidas(negocio.parcelas, 1052).length, 1, "no aniversario vence UMA")
assert.equal(
  parcelasRestantes(negocio.parcelas, 1052).length, 2,
  "a parcela paga tem de sair da lista, senao seria cobrada de novo toda semana",
)
// ⚠️ A REGRESSAO CLASSICA: liquidar e nao remover cobra para sempre.
let emAberto: Parcela[] = negocio.parcelas
let cobrado = 0
for (let semana = 1000; semana <= 1200; semana++) {
  const vencidas = parcelasVencidas(emAberto, semana)
  cobrado += vencidas.reduce((s, p) => s + p.valor, 0)
  emAberto = parcelasRestantes(emAberto, semana)
}
assert.equal(
  cobrado, negocio.parcelas.reduce((s, p) => s + p.valor, 0),
  "rodando 200 semanas, o cobrado tem de ser EXATAMENTE o agendado — nem centavo a mais",
)
assert.equal(emAberto.length, 0, "no fim nao pode sobrar parcela")

// ── 4. O SALDO DA SEMANA E UM NUMERO SO ─────────────────────────────────────
const receber = resolverNegocio(10_000_000, { parcelas: 1 }, ctx("receber", 1000))
const pagar = resolverNegocio(4_000_000, { parcelas: 1 }, ctx("pagar", 1000))
const noMesmoDia = [...receber.parcelas, ...pagar.parcelas]
assert.equal(
  saldoDasParcelas(noMesmoDia),
  receber.parcelas[0].valor - pagar.parcelas[0].valor,
  "receber e pagar na mesma semana viram UM saldo",
)
assert.equal(saldoDasParcelas([]), 0, "semana sem vencimento nao mexe no caixa")

// ── 5. AS DUAS TROCAS TEM DE SER TROCAS ─────────────────────────────────────
//
// Clausula que so beneficia um lado nao e clausula, e presente.
assert.ok(descontoPorRevenda(20_000_000, 20) > 0, "ceder revenda tem de baratear a compra")
assert.ok(
  descontoPorRevenda(20_000_000, 20) < 20_000_000 * 0.2,
  "o desconto tem de ser MENOR que o percentual cedido: a revenda e dinheiro futuro e incerto",
)
assert.equal(descontoPorRevenda(20_000_000, 0), 0, "sem revenda, sem desconto")
assert.equal(
  descontoPorRevenda(20_000_000, 100), descontoPorRevenda(20_000_000, MAX_REVENDA),
  "o teto da revenda tem de valer mesmo se pedirem mais",
)

assert.ok(descontoPorRecompra(10_000_000, 10_000_000) > 0, "dar recompra pelo mesmo preco tem de baratear")
assert.ok(
  descontoPorRecompra(10_000_000, 30_000_000) === 0,
  "recompra por um preco alto nao vale desconto: o direito quase nao incomoda o comprador",
)
assert.ok(
  descontoPorRecompra(10_000_000, 5_000_000) > descontoPorRecompra(10_000_000, 15_000_000),
  "quanto mais barata a recompra, mais ela custa a quem compra",
)

// ── 6. A RECOMPRA TEM PRAZO ─────────────────────────────────────────────────
//
// Sem prazo nao e clausula, e opcao eterna — e uma opcao eterna quebra o
// mercado: bastaria vender caro e recomprar barato dez anos depois.
const recompra = { id: "r1", atleta: "Cria", clube: "XPT", valor: 5_000_000, ateTemporada: 2028 }
assert.ok(recompraValida(recompra, 2026), "dentro do prazo, vale")
assert.ok(recompraValida(recompra, 2028), "na ultima temporada, ainda vale")
assert.ok(!recompraValida(recompra, 2029), "passado o prazo, NAO vale")

// ── 7. SEM CLAUSULA, TUDO COMO ANTES ────────────────────────────────────────
//
// A garantia de compatibilidade: carreira que nunca usa a mesa nova tem de se
// comportar exatamente como na 1.0.382.
for (const valor of [0, 1, 500_000, 90_000_000]) {
  const r = resolverNegocio(valor, TERMOS_A_VISTA, ctx("pagar"))
  assert.equal(r.aVista, valor, "a vista: sai o valor cheio, no ato")
  assert.equal(r.total, valor, "a vista: o total e o valor cheio")
  assert.equal(r.parcelas.length, 0, "a vista: nada agendado")
}
assert.equal(TERMOS_A_VISTA.parcelas, 0, "o padrao tem de ser a vista")
assert.equal(TERMOS_A_VISTA.revendaAoVendedor, undefined, "o padrao nao pode pactuar revenda sozinho")

// ── 8. Determinismo do id da parcela ────────────────────────────────────────
//
// Ids repetidos entre dois negocios fariam uma parcela apagar a outra na lista
// do save.
const a = resolverNegocio(10_000_000, { parcelas: 2 }, { ...ctx("pagar", 1000), atleta: "Um" })
const b = resolverNegocio(10_000_000, { parcelas: 2 }, { ...ctx("pagar", 1000), atleta: "Outro" })
const ids = new Set([...a.parcelas, ...b.parcelas].map(p => p.id))
assert.equal(ids.size, 4, "negocios diferentes na mesma semana nao podem gerar ids iguais")

console.log("qa:clausulas-do-negocio OK — 8 verificacoes")
