// Prova as regras novas da base: teto de 100, evolucao semanal, valor de venda
// e cobranca da diretoria.
//
//   npx tsx scripts/test-youth-rules.ts

import {
  capacidadeDaBase, vagasNaBase, evoluirSemana, valorDeMercadoJovem,
  propostaPorJovem, cobrancaDaDiretoria, type JovemBase,
} from "../lib/youth-academy-rules"

let falhas = 0
const checa = (nome: string, cond: boolean, detalhe = "") => {
  if (!cond) falhas++
  console.log(`${cond ? "OK  " : "FALHA"} ${nome}${detalhe ? " — " + detalhe : ""}`)
}

// ── Teto ─────────────────────────────────────────────────────────────────────
checa("academia nivel 5 comporta 100 (pedido)", capacidadeDaBase(5) === 100, `${capacidadeDaBase(5)}`)
checa("nivel 1 comporta menos", capacidadeDaBase(1) < capacidadeDaBase(5), `${capacidadeDaBase(1)}`)
checa("vagas nunca negativas", vagasNaBase(200, 1) === 0)
checa("vagas corretas", vagasNaBase(30, 1) === capacidadeDaBase(1) - 30)

// ── Evolucao semanal ─────────────────────────────────────────────────────────
const base: JovemBase[] = [
  { id: "a", name: "Joia", position: "ATA", age: 16, overall: 55, potential: 88 },
  { id: "b", name: "Limitado", position: "ZAG", age: 17, overall: 70, potential: 70 },
  { id: "c", name: "Pronto", position: "MEI", age: 17, overall: 67, potential: 80 },
]
// rng fixo em 0 = sempre evolui (chance sempre > 0)
const semana = evoluirSemana(base, 3, () => 0)
const joia = semana.jovens.find(j => j.id === "a")!
const limitado = semana.jovens.find(j => j.id === "b")!
checa("jovem com margem evolui na semana", joia.overall === 56, `${joia.overall}`)
checa("quem ja atingiu o potencial NAO evolui", limitado.overall === 70)
checa("nunca ultrapassa o potencial", semana.jovens.every(j => j.overall <= j.potential))
checa("aponta quem esta pronto para subir", semana.prontosParaSubir.includes("Pronto"),
  semana.prontosParaSubir.join(","))
// rng fixo em 1 = nunca evolui
const parado = evoluirSemana(base, 3, () => 1)
checa("sem sorte, ninguem evolui", parado.destaques.length === 0)

// ── Valor de venda ───────────────────────────────────────────────────────────
const caro = valorDeMercadoJovem({ id: "x", name: "Promessa", position: "ATA", age: 15, overall: 55, potential: 90 })
const barato = valorDeMercadoJovem({ id: "y", name: "Comum", position: "ZAG", age: 18, overall: 55, potential: 60 })
checa("potencial alto vale mais que overall igual", caro > barato, `${caro} > ${barato}`)
checa("valor tem piso", valorDeMercadoJovem({ id: "z", name: "Fraco", position: "GOL", age: 19, overall: 40, potential: 41 }) >= 50_000)

const p = propostaPorJovem(base[0], "Clube X", () => 0) // multiplicador minimo
checa("proposta minima fica abaixo do valor justo", p.abaixoDoValor, `${p.valor}`)
const pCheia = propostaPorJovem(base[0], "Clube X", () => 1) // multiplicador maximo
checa("proposta cheia nao e marcada como baixa", !pCheia.abaixoDoValor, `${pCheia.valor}`)

// ── Cobranca da diretoria ────────────────────────────────────────────────────
checa("nao cobra no inicio da temporada", cobrancaDaDiretoria({ semana: 5, promovidosNaTemporada: 0 }) === null)
const cobra = cobrancaDaDiretoria({ semana: 12, nivelAcademia: 3, promovidosNaTemporada: 0 })
checa("cobra na semana 12", cobra !== null)
checa("cobranca nao cumprida quando ninguem subiu", cobra !== null && !cobra.cumprida)
const ok = cobrancaDaDiretoria({ semana: 26, nivelAcademia: 3, promovidosNaTemporada: 5 })
checa("aprova quando a meta e batida", ok !== null && ok.cumprida)
checa("nao cobra toda semana", cobrancaDaDiretoria({ semana: 13, promovidosNaTemporada: 0 }) === null)

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)
