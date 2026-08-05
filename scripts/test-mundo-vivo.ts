// O MUNDO ENVELHECE — e envelhece do jeito certo.
//
// Antes da 1.0.265 `players-data` não sabia o que era temporada: o elenco de
// todo clube que não é o do usuário voltava do seed com as idades de 2026, para
// sempre. Este teste tranca as três propriedades que fazem a correção valer:
//
//   1. DETERMINISMO — o mesmo atleta na mesma temporada dá sempre o mesmo
//      resultado. Sem isso o zagueiro teria um overall na tela de adversários e
//      outro na partida, no mesmo dia de jogo.
//   2. A CURVA TEM SENTIDO — jovem cresce, veterano cai.
//   3. NINGUÉM JOGA PARA SEMPRE — depois dos 40 todo mundo pendurou.
//
//   npx tsx scripts/test-mundo-vivo.ts
import assert from "node:assert/strict"
import { envelhecerAtleta, envelhecerElenco, TEMPORADA_BASE_DO_MUNDO } from "../lib/mundo-vivo"

let ok = 0
const teste = (nome: string, fn: () => void) => {
  fn()
  console.log(`OK    ${nome}`)
  ok++
}

teste("temporada zero não muda nada", () => {
  const a = { nome: "Fulano", idade: 24, base: 70 }
  const r = envelhecerAtleta(a, 0, "clube")
  assert.equal(r.idade, 24)
  assert.equal(r.base, 70)
  assert.equal(r.aposentado, false)
})

teste("mesmo atleta, mesma temporada, mesmo resultado", () => {
  const a = { nome: "Fulano", idade: 22, base: 68 }
  const um = envelhecerAtleta(a, 5, "flarj")
  const dois = envelhecerAtleta(a, 5, "flarj")
  assert.deepEqual(um, dois)
})

teste("clubes diferentes não dão o mesmo desfecho a todo mundo", () => {
  // Não é sorteio por clube: é que a variação individual entra pela chave. Se
  // clube nenhum importasse, dois elencos evoluiriam em bloco idêntico.
  const elenco = Array.from({ length: 20 }, (_, i) => ({ nome: `Atleta ${i}`, idade: 20 + (i % 12), base: 60 + (i % 15) }))
  const a = envelhecerElenco(elenco, 6, "clube-a").elenco.map(p => p.base).join(",")
  const b = envelhecerElenco(elenco, 6, "clube-b").elenco.map(p => p.base).join(",")
  assert.notEqual(a, b)
})

teste("jovem de 19 evolui em 5 temporadas", () => {
  const r = envelhecerAtleta({ nome: "Promessa", idade: 19, base: 62 }, 5, "clube")
  assert.equal(r.idade, 24)
  assert.ok(r.base > 62, `esperava crescimento, veio ${r.base}`)
})

teste("veterano de 31 cai em 5 temporadas", () => {
  const r = envelhecerAtleta({ nome: "Veterano", idade: 31, base: 82 }, 5, "clube")
  assert.equal(r.idade, 36)
  assert.ok(r.base < 82, `esperava queda, veio ${r.base}`)
})

teste("ninguém segue em campo depois dos 40", () => {
  for (let i = 0; i < 50; i++) {
    const r = envelhecerAtleta({ nome: `Eterno ${i}`, idade: 30, base: 75 }, 12, "clube")
    assert.equal(r.aposentado, true, `atleta ${i} chegou aos 42 ainda em campo`)
  }
})

teste("as aposentadorias são contadas — é o que repõe o elenco", () => {
  // A CONTAGEM é o ponto: sem ela o mundo encolheria para sempre, porque a rede
  // de segurança só repõe até o mínimo jogável e nunca de volta ao plantel.
  const elenco = Array.from({ length: 25 }, (_, i) => ({ nome: `Atleta ${i}`, idade: 28 + (i % 8), base: 70 }))
  const depois = envelhecerElenco(elenco, 8, "clube")
  assert.ok(depois.aposentados > 0, "com 8 temporadas alguém tinha de se aposentar")
  assert.equal(depois.elenco.length + depois.aposentados, elenco.length)
})

teste("overall fica dentro dos limites do jogo", () => {
  for (const idade of [17, 24, 31, 35]) {
    for (const base of [42, 60, 78, 92]) {
      const r = envelhecerAtleta({ nome: `A${idade}${base}`, idade, base }, 9, "clube")
      assert.ok(r.base >= 40 && r.base <= 94, `overall fora da faixa: ${r.base}`)
    }
  }
})

teste("a temporada base é a foto do seed", () => {
  assert.equal(TEMPORADA_BASE_DO_MUNDO, 2026)
})

console.log(`\n${ok} verificações, tudo OK`)
