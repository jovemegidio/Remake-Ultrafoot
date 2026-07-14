// Mede o buraco de dados dos elencos — o que produz os jogadores INVENTADOS.
//
// Quando um time tem menos de 18 jogadores, ensurePlayableSquad (lib/players-data.ts)
// completa o elenco inventando gente:
//
//     nome: `Reserva ${team.curto} ${squadNumber}`     // -> "Reserva SCR 12"
//
// E isso que aparece na narracao da partida e nas telas de elenco.
//
// POR QUE NAO DA PARA CONSERTAR SO COM O QUE TEMOS:
// o seed principal (imported-bf2026.json) traz o jogador completo —
//     {"nome":"Dyogo Alves","posicao":"GOL","overall":95,"idade":22,"salario":46700}
// mas o seed secundario (bf2026-teams.json) traz SO O NOME —
//     "players": ["Pinheirinho", "Matheus Antony"]
// Sem posicao e overall esses nomes nao sao jogaveis. Usa-los exigiria INVENTAR os
// atributos e chutar a posicao de cada um — um nome real com stats falsos mascara a
// ausencia do dado, o que e pior que um placeholder assumido.
//
// Este script quantifica o buraco para decidir onde investir dados de verdade.
//
// Uso: node scripts/audit-squad-gaps.mjs

import { readFileSync } from "node:fs"

const MIN_SQUAD = 18 // MIN_PLAYABLE_SQUAD_SIZE em lib/players-data.ts

const main = JSON.parse(readFileSync("data/seeds/imported-bf2026.json", "utf8"))

const rows = main.teams.map((t) => ({
  nome: t.nome,
  curto: t.curto,
  liga: t.liga ?? "?",
  divisao: t.divisao ?? "?",
  reais: (t.jogadores ?? []).length,
}))

const thin = rows.filter((r) => r.reais < MIN_SQUAD)
const inventados = thin.reduce((s, r) => s + (MIN_SQUAD - r.reais), 0)
const vazios = rows.filter((r) => r.reais === 0).length

console.log(`Times no seed              : ${rows.length}`)
console.log(`Com elenco completo (>=${MIN_SQUAD}) : ${rows.length - thin.length}`)
console.log(`Com elenco INCOMPLETO     : ${thin.length}  (${((thin.length / rows.length) * 100).toFixed(1)}%)`)
console.log(`  ...destes, SEM NENHUM jogador: ${vazios}`)
console.log(`\nJogadores INVENTADOS ("Reserva XXX N") em jogo: ${inventados}`)

// Onde doi mais: as ligas que o usuario efetivamente joga.
const porLiga = new Map()
for (const r of thin) {
  const k = r.liga
  const cur = porLiga.get(k) ?? { times: 0, faltam: 0 }
  cur.times++
  cur.faltam += MIN_SQUAD - r.reais
  porLiga.set(k, cur)
}

const top = [...porLiga.entries()].sort((a, b) => b[1].faltam - a[1].faltam).slice(0, 12)
console.log(`\nLIGAS COM MAIS JOGADORES INVENTADOS:`)
for (const [liga, v] of top) {
  console.log(`  ${String(liga).padEnd(28)} ${String(v.times).padStart(4)} times   ${String(v.faltam).padStart(5)} inventados`)
}

// Os clubes grandes — os que o jogador provavelmente escolhe.
const GRANDES = [
  "Barcelona", "Real Madrid", "Juventus", "Manchester City", "Liverpool", "Bayern Munich",
  "Flamengo", "Palmeiras", "São Paulo", "Corinthians", "Santos", "Grêmio", "Internacional",
]
console.log(`\nCLUBES DE DESTAQUE:`)
for (const nome of GRANDES) {
  const r = rows.find((x) => x.nome === nome)
  if (!r) { console.log(`  ${nome.padEnd(20)} NAO ESTA NO SEED`); continue }
  const falta = Math.max(0, MIN_SQUAD - r.reais)
  const marca = falta > 0 ? `${falta} inventados` : "completo"
  console.log(`  ${nome.padEnd(20)} ${String(r.reais).padStart(2)} reais   ${marca}`)
}
