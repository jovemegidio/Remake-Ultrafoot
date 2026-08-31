// O PORTAO DA PRELECAO (1.0.383).
//
//   node node_modules/tsx/dist/cli.mjs scripts/qa-prelecao.ts
//
// ⚠️ POR QUE ELE EXISTE. Falar com o elenco e o tipo de sistema que apodrece
// sozinho de duas maneiras conhecidas nesta base:
//
//   1. VIRA ENFEITE — cinco botoes com textos diferentes e o mesmo efeito. Foi o
//      que aconteceu com os doze controles de tatica antes da 1.0.277 e com o
//      `focoTatico` da preparacao ate a 1.0.383. Aqui o portao cobra que os tons
//      DIVIRJAM: se dois tons rendem o mesmo em todo contexto, a escolha e
//      decorativa e o teste reprova.
//   2. VIRA BOLA DE NEVE — repetir o tom certo empilha moral ate o teto, que e o
//      irmao vestiario do glitch da bilheteria. Aqui o portao cobra o teto e a
//      margem que o freia.
//
// E cobra a regra estrutural que impede contar a mesma prelecao duas vezes: no
// "pre" e no "fim" o efeito no jogo tem de ser ZERO, porque nesses dois momentos
// ela chega ao campo pela moral gravada; so o intervalo usa o canal direto.

import assert from "node:assert"
import {
  EFEITO_ZERO, TETO_DA_PRELECAO, TONS, acertoDoTom, prelecao,
  type AtletaNaPrelecao, type ContextoDaPrelecao, type TomDaPrelecao,
} from "../lib/prelecao"

const elenco: AtletaNaPrelecao[] = Array.from({ length: 18 }, (_, i) => ({
  id: 1000 + i,
  nome: `Atleta ${i + 1}`,
  overall: 70 + (i % 9),
  moralePoints: 55,
  titular: i < 11,
}))

const ctx = (over: Partial<ContextoDaPrelecao> = {}): ContextoDaPrelecao => ({
  momento: "intervalo",
  golsFavor: 0,
  golsContra: 0,
  favoritismo: 0,
  decisivo: false,
  mandante: true,
  ...over,
})

// ── 1. O efeito no jogo so existe no INTERVALO ──────────────────────────────
//
// Esta e a regra que impede a contagem dupla: no pre e no fim a prelecao entra
// pela moral gravada, que `userForces` ja soma na forca do XI. Um efeito direto
// nesses momentos somaria por cima do que a moral ja diz.
for (const momento of ["pre", "fim"] as const) {
  const r = prelecao("cobranca", ctx({ momento, golsContra: 1 }), elenco)
  assert.deepEqual(
    r.efeitoNoJogo, EFEITO_ZERO,
    `no momento "${momento}" o efeito direto no jogo tem de ser zero (a moral gravada e o canal)`,
  )
}
const noIntervalo = prelecao("cobranca", ctx({ golsFavor: 1 }), elenco)
assert.ok(noIntervalo.efeitoNoJogo.durationMinutes > 0, "no intervalo a prelecao tem de chegar ao jogo")

// ── 2. Os cinco tons NAO podem ser a mesma coisa ────────────────────────────
//
// O teste do enfeite. Se dois tons rendem identico em todos os contextos, um
// deles e texto.
const contextos: ContextoDaPrelecao[] = [
  ctx({ momento: "pre", favoritismo: 20 }),
  ctx({ momento: "pre", favoritismo: -20 }),
  ctx({ golsFavor: 2, golsContra: 0 }),
  ctx({ golsFavor: 0, golsContra: 2 }),
  ctx({ golsFavor: 1, golsContra: 1 }),
  ctx({ momento: "fim", golsFavor: 3, golsContra: 0 }),
]
const assinatura = new Map<TomDaPrelecao, string>()
for (const tom of TONS) {
  assinatura.set(tom.id, contextos.map(c => prelecao(tom.id, c, elenco).saldo).join("|"))
}
const vistas = new Set(assinatura.values())
assert.equal(
  vistas.size, TONS.length,
  `os ${TONS.length} tons tem de render diferente em algum contexto; ${TONS.length - vistas.size} sao duplicata`,
)

// ── 3. Nao existe tom que sirva sempre ──────────────────────────────────────
//
// Se um tom fosse bom em todo contexto, escolher seria trivial e a mecanica nao
// teria decisao nenhuma dentro.
for (const tom of TONS) {
  const acertos = contextos.map(c => acertoDoTom(tom.id, c).acerto)
  assert.ok(
    Math.min(...acertos) <= 0,
    `"${tom.nome}" nunca erra — um tom universalmente bom torna a escolha decorativa`,
  )
}

// ── 4. Furia acende quem tem casca e derruba quem nao tem ───────────────────
//
// O ponto do tom mais arriscado. Num elenco perdendo, a furia tem de produzir
// reacoes dos DOIS sinais — senao ela e so "cobranca com outro nome".
const perdendo = prelecao("furia", ctx({ golsContra: 1 }), elenco)
assert.ok(
  perdendo.reacoes.some(r => r.humor === "acende") && perdendo.reacoes.some(r => r.humor === "encolhe"),
  "a furia tem de dividir o vestiario: quem peita e quem encolhe",
)

// ── 5. Teto e piso ──────────────────────────────────────────────────────────
for (const tom of TONS) {
  for (const c of contextos) {
    for (const r of prelecao(tom.id, c, elenco).reacoes) {
      assert.ok(
        Math.abs(r.delta) <= TETO_DA_PRELECAO,
        `${tom.id}: delta ${r.delta} estourou o teto de ${TETO_DA_PRELECAO}`,
      )
    }
  }
}

// ── 6. A margem trava a bola de neve ────────────────────────────────────────
//
// Moral no teto tem pouco a ganhar; moral no chao tem pouco a perder. Sem isto,
// repetir o tom certo levaria todo mundo a 100 em poucas partidas.
const noTeto = elenco.map(a => ({ ...a, moralePoints: 100 }))
const noChao = elenco.map(a => ({ ...a, moralePoints: 0 }))
//
// ⚠️ A INVARIANTE E A TRAVESSIA, NAO O ZERO. Com a moral no chao, quem tem casca
// grossa ainda pode SUBIR com um grito mal colocado (a furia e bimodal): o que
// nao pode acontecer e alguem cair abaixo do piso. O contrario vale no teto.
// Exigir zero em todo mundo seria proibir a metade legitima do efeito.
for (const tom of TONS) {
  for (const c of contextos) {
    assert.ok(
      prelecao(tom.id, c, noTeto).reacoes.every(r => r.delta <= 0),
      `${tom.id}: com a moral no teto ninguem pode somar mais`,
    )
    assert.ok(
      prelecao(tom.id, c, noChao).reacoes.every(r => r.delta >= 0),
      `${tom.id}: com a moral no chao ninguem pode cair mais`,
    )
  }
}

// ── 7. Determinismo ─────────────────────────────────────────────────────────
//
// Sem isto o jogador recarrega a tela ate o vestiario reagir bem, e falar deixa
// de ser uma escolha.
for (const tom of TONS) {
  const a = prelecao(tom.id, ctx({ golsContra: 1 }), elenco)
  const b = prelecao(tom.id, ctx({ golsContra: 1 }), elenco)
  assert.deepEqual(a.reacoes, b.reacoes, `${tom.id}: a mesma prelecao tem de dar sempre a mesma reacao`)
}

// ── 8. O reserva sente menos que o titular ──────────────────────────────────
const misto = prelecao("confianca", ctx({ momento: "pre", favoritismo: -20 }), elenco)
const somaTitulares = misto.reacoes.filter((_, i) => elenco[i].titular).reduce((s, r) => s + r.delta, 0)
const somaBanco = misto.reacoes.filter((_, i) => !elenco[i].titular).reduce((s, r) => s + r.delta, 0)
assert.ok(
  somaTitulares / 11 > somaBanco / 7,
  "quem entra em campo tem de sentir mais a prelecao do que quem fica no banco",
)

// ── 9. O silencio e a opcao segura, e a furia a arriscada ───────────────────
//
// ⚠️ RISCO SE MEDE PELA DISPERSAO, NAO PELA MEDIA. A furia e bimodal de
// proposito (acende uns, derruba outros), entao o saldo MEDIO dela quase se
// anula — comparar medias diria que gritar e mais seguro que ficar calado, que e
// o oposto da verdade. O que separa um tom seguro de um arriscado e o tamanho da
// distancia entre a melhor e a pior reacao individual.
const espalhamento = (tom: TomDaPrelecao) => Math.max(...contextos.map(c => {
  const deltas = prelecao(tom, c, elenco).reacoes.map(r => r.delta)
  return Math.max(...deltas) - Math.min(...deltas)
}))
assert.ok(
  espalhamento("silencio") < espalhamento("furia"),
  "o silencio tem de dividir menos o vestiario que a furia — e o que faz dele o caminho seguro",
)
assert.ok(
  espalhamento("furia") === Math.max(...TONS.map(t => espalhamento(t.id))),
  "a furia tem de ser o tom que mais divide o elenco; se nao for, o risco dela e retorica",
)

console.log("qa:prelecao OK — 9 verificacoes")
