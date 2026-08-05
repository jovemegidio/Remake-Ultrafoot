// AS SELECOES JOGAM COM ATLETAS DE VERDADE?
//
// O elenco de uma selecao saia de `allTeams.filter(t => t.pais === countryKey)`
// — os clubes DAQUELE PAIS. Isso e o contrario de como uma selecao funciona:
// Mbappe joga na Espanha e defende a Franca. Todo atleta que atua fora do
// proprio pais era invisivel para a sua selecao, e o buraco era tapado por
// `fallbackNationalPlayers`, que INVENTA nomes a partir do id da selecao —
// "Aalbania1", "Aalbania2", "Fitalia3".
//
// Somado a isso, o casamento era CRU: as selecoes usam "Colombia"/"Franca" sem
// acento e os seeds usam "Colômbia"/"França". 29 selecoes davam ZERO atletas
// tendo centenas no banco.
//
//   npx tsx scripts/qa-selecoes-elenco-real.ts
import assert from "node:assert/strict"
import { NATIONAL_TEAMS, getNationalPlayerSources, getNationalPlayerPool } from "../lib/national-teams"

/** Atleta inventado pelo fallback: o "clube" dele e a propria selecao. */
const ehInventado = (nomeDoTime: string, nomeDaSelecao: string) => nomeDoTime === nomeDaSelecao

let zeradas = 0
const parciais: string[] = []

for (const nt of NATIONAL_TEAMS) {
  const fontes = getNationalPlayerSources(nt, { raw: true })
  const reais = fontes.filter(f => !ehInventado(f.team.nome, nt.name)).length
  if (reais === 0) zeradas++
  else if (reais < 23) parciais.push(`${nt.name} (${reais})`)
}

console.log(`selecoes cadastradas      : ${NATIONAL_TEAMS.length}`)
console.log(`sem NENHUM atleta real    : ${zeradas}`)
console.log(`com menos de 23 reais     : ${parciais.length}`)
if (parciais.length) console.log(`  ${parciais.join(", ")}`)

// ─── 1. As grandes selecoes TEM de ter elenco real ───────────────────────────
//
// Estas eram justamente as que davam ZERO por causa do acento. Se alguma voltar
// a zerar, o casamento por nacionalidade quebrou.
for (const id of ["franca", "italia", "colombia", "belgica", "russia", "espanha", "alemanha", "portugal"]) {
  const nt = NATIONAL_TEAMS.find(n => n.id === id)
  assert.ok(nt, `selecao ${id} sumiu do catalogo`)
  const fontes = getNationalPlayerSources(nt, { raw: true })
  const reais = fontes.filter(f => !ehInventado(f.team.nome, nt.name)).length
  assert.ok(reais >= 23, `${nt.name} deveria ter 23+ atletas reais, tem ${reais}`)
}

// ─── 2. O ATLETA NAO PRECISA JOGAR NO PROPRIO PAIS ───────────────────────────
//
// O coracao do conserto: pelo menos uma selecao grande tem de convocar gente de
// clube estrangeiro. Se TODOS forem do proprio pais, voltamos ao filtro antigo.
const franca = NATIONAL_TEAMS.find(n => n.id === "franca")!
const fontesFranca = getNationalPlayerSources(franca, { raw: true })
  .filter(f => !ehInventado(f.team.nome, franca.name))
const foraDoPais = fontesFranca.filter(f => (f.team.pais ?? "") !== franca.countryKey)
console.log(`\nFranca: ${fontesFranca.length} reais, ${foraDoPais.length} atuando fora do pais`)
assert.ok(
  foraDoPais.length > 0,
  "nenhum frances joga fora da Franca? o pool voltou a sair do CLUBE, nao da nacionalidade",
)

// ─── 3. Quase nenhuma selecao pode depender de nome inventado ────────────────
assert.ok(zeradas <= 2, `${zeradas} selecoes sem atleta real (o conserto levou de 29 para 2)`)

// ─── 4. O pool nao pode vir vazio nem com buraco ─────────────────────────────
for (const nt of NATIONAL_TEAMS) {
  const pool = getNationalPlayerPool(nt)
  assert.ok(pool.length >= 23, `${nt.name} tem pool de ${pool.length} — nao da para escalar`)
  assert.ok(pool.every(p => p.nome && p.pos), `${nt.name} tem atleta sem nome ou posicao`)
}

// ─── 5. O indice em cache nao pode mudar a resposta ──────────────────────────
const a = getNationalPlayerPool(franca).length
const b = getNationalPlayerPool(franca).length
assert.equal(a, b, "a segunda consulta devolveu outro tamanho — o cache esta inconsistente")

console.log("\nOK selecoes: elenco por nacionalidade, casamento sem acento e sem depender de nome inventado")
