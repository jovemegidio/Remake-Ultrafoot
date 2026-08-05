// AMISTOSO NEGOCIADO — o clube do outro lado decide e cobra.
//
// Antes, marcar amistoso era clicar num nome: o Real Madrid vinha jogar contra
// um clube da Serie D, de graca, na semana que voce escolhesse.
//
//   npx tsx scripts/qa-amistoso-negociacao.ts
import assert from "node:assert/strict"
import {
  avaliarConvite, contaDoAmistoso, cacheDePresenca, chanceDoConvite,
  type ConviteDeAmistoso,
} from "../lib/amistosos-negociacao"
import type { Team } from "../lib/teams-data"

const time = (p: Partial<Team> & { nome: string; curto: string; prestigio: number }): Team => ({
  cidade: "", estado: "", cor1: "#000", cor2: "#fff", torcida: 1_000_000,
  estadio_cap: 30_000, saldo: 0, file_key: p.curto.toLowerCase(), estadio_nome: "",
  patrocinador: "", escudo_url: "", divisao: "serie_a", pais: "Brasil", ...p,
})

const gigante = time({ nome: "Real Madrid", curto: "RMA", prestigio: 88, torcida: 40_000_000, estadio_cap: 81_000, pais: "Espanha", regiao: "europa" })
const grandeBr = time({ nome: "Flamengo", curto: "FLA", prestigio: 84, torcida: 42_000_000, estadio_cap: 78_000 })
const pequeno = time({ nome: "Brasiliense", curto: "BRS", prestigio: 42, torcida: 300_000, estadio_cap: 20_000 })

const convite = (clube: Team, adversario: Team, extra: Partial<ConviteDeAmistoso> = {}): ConviteDeAmistoso =>
  ({ clube, adversario, semana: 12, temporada: 2026, emCasa: true, ...extra })

// ─── 1. CUSTA DINHEIRO, e o tamanho do clube manda ───────────────────────────
const cacheGigante = cacheDePresenca(gigante)
const cachePequeno = cacheDePresenca(pequeno)
console.log(`cache de presenca — ${gigante.nome}: ${cacheGigante.toLocaleString("pt-BR")}`)
console.log(`cache de presenca — ${pequeno.nome}: ${cachePequeno.toLocaleString("pt-BR")}`)
assert.ok(cacheGigante > 0 && cachePequeno > 0, "amistoso nao pode ser de graca")
assert.ok(cacheGigante > cachePequeno * 10, "clube gigante tem de custar MUITO mais que um pequeno")

// ─── 2. FORA DE CASA custa menos (o mandante fica com a bilheteria) ──────────
const emCasa = contaDoAmistoso(convite(pequeno, grandeBr, { emCasa: true }))
const fora = contaDoAmistoso(convite(pequeno, grandeBr, { emCasa: false }))
console.log(`convidando ${grandeBr.nome} em casa: cache ${emCasa.cache.toLocaleString("pt-BR")}, bilheteria ${emCasa.bilheteria.toLocaleString("pt-BR")}`)
console.log(`jogando na casa dele:               cache ${fora.cache.toLocaleString("pt-BR")}, bilheteria ${fora.bilheteria.toLocaleString("pt-BR")}`)
assert.ok(fora.cache < emCasa.cache, "fora de casa deveria custar menos")
assert.equal(fora.bilheteria, 0, "sem mando nao ha bilheteria")
assert.ok(emCasa.bilheteria > 0, "com mando tem de haver bilheteria")

// ─── 3. VIAGEM encarece ──────────────────────────────────────────────────────
const contraEuropeu = contaDoAmistoso(convite(pequeno, gigante))
const europeuLocal = contaDoAmistoso(convite(pequeno, time({ ...gigante, pais: "Brasil", regiao: undefined } as Partial<Team> & { nome: string; curto: string; prestigio: number })))
assert.ok(contraEuropeu.cache > europeuLocal.cache, "intercontinental tem de custar mais que o mesmo clube em casa")

// ─── 4. O GIGANTE RECUSA o clube pequeno ─────────────────────────────────────
const r1 = avaliarConvite(convite(pequeno, gigante))
console.log(`\n${pequeno.nome} convida ${gigante.nome}: ${r1.aceita ? "ACEITOU" : "recusou"} — ${r1.recado}`)
assert.equal(r1.aceita, false, "um clube de prestigio 88 nao aceita amistoso com um de 42")
assert.ok(r1.motivo, "a recusa tem de dizer o motivo")

// ─── 5. O PEQUENO ACEITA o convite do grande ─────────────────────────────────
const r2 = avaliarConvite(convite(grandeBr, pequeno))
console.log(`${grandeBr.nome} convida ${pequeno.nome}: ${r2.aceita ? "ACEITOU" : "recusou"} — ${r2.recado}`)
assert.equal(r2.aceita, true, "clube menor deveria topar jogar contra um grande")

// ─── 6. DETERMINISTICO: recusar nao pode virar botao de re-rolar ────────────
const a = avaliarConvite(convite(pequeno, gigante))
const b = avaliarConvite(convite(pequeno, gigante))
assert.equal(a.aceita, b.aceita, "a mesma proposta tem de dar sempre a mesma resposta")
assert.equal(a.recado, b.recado)
// Mudar a SEMANA e uma proposta diferente — ai pode mudar.
const outraSemana = avaliarConvite(convite(pequeno, gigante, { semana: 30 }))
assert.ok(typeof outraSemana.aceita === "boolean")

// ─── 7. DATA FIFA abre a porta ───────────────────────────────────────────────
// Um confronto em que a recusa e POSSIVEL — com times parelhos demais o aceite
// e sempre 100% e o teste nao prova nada (foi o que aconteceu na primeira
// versao: 40 de 40 nos dois casos).
const parelho = time({ nome: "Ceara", curto: "CEA", prestigio: 52, torcida: 3_000_000 })
const acimaDele = time({ nome: "Porto", curto: "POR", prestigio: 74, torcida: 6_000_000, pais: "Portugal", regiao: "europa" })
let semFifa = 0, comFifa = 0
for (let s = 1; s <= 40; s++) {
  if (avaliarConvite(convite(parelho, acimaDele, { semana: s })).aceita) semFifa++
  if (avaliarConvite(convite(parelho, acimaDele, { semana: s, dataFifa: true })).aceita) comFifa++
}
console.log(`\naceites em 40 semanas contra ${acimaDele.nome} — normal: ${semFifa} | data FIFA: ${comFifa}`)
assert.ok(semFifa < 40, "este confronto tem de admitir recusa, senao o teste nao mede nada")
assert.ok(comFifa > semFifa, "data FIFA tem de aumentar o aceite de verdade")

// ─── 8. A tela consegue avisar ANTES do clique ───────────────────────────────
assert.equal(chanceDoConvite(convite(pequeno, gigante)), "dificil")
assert.equal(chanceDoConvite(convite(grandeBr, pequeno)), "provavel")

console.log("\nOK amistoso: custa dinheiro, o mando pesa, a viagem pesa, o grande recusa e a resposta nao se re-rola")
