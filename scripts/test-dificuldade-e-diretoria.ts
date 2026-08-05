// DIFICULDADE E DIRETORIA — as duas travas que a 1.0.265 não pode perder.
//
// Dificuldade: o motor dava +9 fixo ao adversário sempre que o usuário jogava.
// Virou nível escolhido pelo jogador, e "Normal" TEM de continuar valendo 9 —
// senão toda carreira em andamento muda de equilíbrio ao atualizar o jogo.
//
// Diretoria: renovar não bastava (o elenco convergia para o piso de 18). Ela
// agora contrata — e contratar tem de custar MAIS do que o atleta vale, senão
// comprar e revender vira impressora de dinheiro, a mesma armadilha que fez o
// reforço emergencial valer 0.
//
//   npx tsx scripts/test-dificuldade-e-diretoria.ts
import assert from "node:assert/strict"
import { NIVEIS, DIFICULDADE_PADRAO, nivelDeDificuldade } from "../lib/dificuldade"
import { decidirContratacoes, ALVO_DE_ELENCO, PREMIO_SOBRE_O_VALOR } from "../lib/diretoria"
import { FRACAO_DO_CUSTO_OPERACIONAL, custoOperacionalSemanal, weeklyIncomeFor } from "../lib/club-economy"

let ok = 0
const teste = (nome: string, fn: () => void) => { fn(); console.log(`OK    ${nome}`); ok++ }

const elencoDe = (n: number, overall = 60) =>
  Array.from({ length: n }, (_, i) => ({
    overall: overall + (i % 5),
    age: 22 + (i % 10),
    position: ["GOL", "ZAG", "LD", "VOL", "MEI", "ATA"][i % 6],
  }))

const ctxBase = {
  agora: 100,
  caixa: 50_000_000,
  folhaAtual: 500_000,
  tetoDeFolha: 3_000_000,
  janelaAberta: true,
  salarioDe: (o: number) => o * 1_000,
  valorDe: (o: number) => o * 100_000,
}

// ── Dificuldade ──────────────────────────────────────────────────────────────

teste("o padrão é 'normal' e vale exatamente o 9 histórico", () => {
  assert.equal(DIFICULDADE_PADRAO, "normal")
  const normal = nivelDeDificuldade("normal")
  assert.equal(normal.bonusBase, 9)
  assert.equal(normal.pesoDoContexto, 1)
})

teste("save sem dificuldade e valor desconhecido caem no padrão", () => {
  assert.equal(nivelDeDificuldade(undefined).id, DIFICULDADE_PADRAO)
  assert.equal(nivelDeDificuldade(null).id, DIFICULDADE_PADRAO)
  assert.equal(nivelDeDificuldade("qualquer-coisa").id, DIFICULDADE_PADRAO)
})

teste("'justo' não dá vantagem nenhuma, nem por contexto", () => {
  const justo = nivelDeDificuldade("justo")
  assert.equal(justo.bonusBase, 0)
  assert.equal(justo.pesoDoContexto, 0)
})

teste("os níveis sobem em ordem", () => {
  const bonus = NIVEIS.map(n => n.bonusBase)
  for (let i = 1; i < bonus.length; i++) {
    assert.ok(bonus[i] > bonus[i - 1], `nível ${NIVEIS[i].id} não é mais difícil que o anterior`)
  }
})

// ── Diretoria no mercado ─────────────────────────────────────────────────────

teste("elenco cheio: a diretoria não contrata", () => {
  assert.deepEqual(decidirContratacoes(elencoDe(ALVO_DE_ELENCO), ctxBase), [])
})

teste("janela fechada: a diretoria não contrata", () => {
  assert.deepEqual(decidirContratacoes(elencoDe(18), { ...ctxBase, janelaAberta: false }), [])
})

teste("caixa zerado: a diretoria não contrata", () => {
  assert.deepEqual(decidirContratacoes(elencoDe(18), { ...ctxBase, caixa: 0 }), [])
})

teste("elenco curto na janela: contrata", () => {
  const d = decidirContratacoes(elencoDe(18), ctxBase)
  assert.ok(d.length > 0, "não contratou ninguém com 18 atletas e caixa cheio")
})

teste("comprar e revender DÁ PREJUÍZO (sem impressora de dinheiro)", () => {
  for (const c of decidirContratacoes(elencoDe(18), ctxBase)) {
    assert.ok(c.custo > c.marketValue, `custo ${c.custo} <= valor ${c.marketValue}`)
  }
  assert.ok(PREMIO_SOBRE_O_VALOR > 1)
})

teste("teto de folha é respeitado", () => {
  const d = decidirContratacoes(elencoDe(18), { ...ctxBase, folhaAtual: 2_999_000, tetoDeFolha: 3_000_000 })
  assert.deepEqual(d, [], "estourou o teto de folha")
})

teste("a diretoria guarda reserva de caixa", () => {
  // Caixa que cobre exatamente um reforço, mas não a reserva.
  const umReforco = 58 * 100_000 * PREMIO_SOBRE_O_VALOR
  const d = decidirContratacoes(elencoDe(18), { ...ctxBase, caixa: umReforco })
  assert.deepEqual(d, [], "gastou o caixa até o fim")
})

teste("o reforço não é estrela: fica na régua do elenco", () => {
  const d = decidirContratacoes(elencoDe(18, 60), ctxBase)
  for (const c of d) assert.ok(c.overall <= 64, `reforço acima da régua do elenco: ${c.overall}`)
})

// ── Custo operacional ────────────────────────────────────────────────────────

teste("o custo operacional escala com a divisão", () => {
  const serieA = custoOperacionalSemanal("serie_a", 70)
  const serieD = custoOperacionalSemanal("serie_d", 40)
  assert.ok(serieA > serieD, "Série A não custa mais que Série D")
  assert.equal(serieA, Math.round(weeklyIncomeFor("serie_a", 70) * FRACAO_DO_CUSTO_OPERACIONAL))
})

teste("o custo operacional não consome a receita inteira", () => {
  assert.ok(FRACAO_DO_CUSTO_OPERACIONAL > 0 && FRACAO_DO_CUSTO_OPERACIONAL < 0.5)
})

console.log(`\n${ok} verificações, tudo OK`)
