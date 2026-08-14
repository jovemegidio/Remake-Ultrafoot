// QUANTOS CLUBES ESTÃO SEM ESCUDO LOCAL, E QUAIS?
//
// `qa:smoke` reprova em "escudos locais de todos os times" com uma lista longa
// demais para ler. Antes de tratar isso como regressão da versão, é preciso
// saber o tamanho e a natureza do buraco: é dado que nunca foi baixado (as
// federações da expansão UEFA) ou algo que sumiu?
//
//   npx tsx scripts/auditar-escudos-faltantes.ts

import { existsSync } from "node:fs"
import path from "node:path"
import { allTeams } from "../lib/teams-data"
import { getLocalEscudoPath } from "../lib/escudos-map"

const raiz = process.cwd()
const existe = (p: string) => existsSync(path.join(raiz, "public", p.replace(/^\//, "")))

const semEscudo = allTeams.filter(t => !existe(getLocalEscudoPath(t.file_key)))

const porPais = new Map<string, number>()
for (const t of semEscudo) {
  const pais = (t as { pais?: string }).pais ?? "?"
  porPais.set(pais, (porPais.get(pais) ?? 0) + 1)
}
const totalPorPais = new Map<string, number>()
for (const t of allTeams) {
  const pais = (t as { pais?: string }).pais ?? "?"
  totalPorPais.set(pais, (totalPorPais.get(pais) ?? 0) + 1)
}

console.log(`clubes em allTeams: ${allTeams.length}`)
console.log(`sem escudo local:   ${semEscudo.length} (${((semEscudo.length / allTeams.length) * 100).toFixed(1)}%)`)
console.log("")
console.log("── PAÍSES INTEIROS SEM ESCUDO (nenhum clube tem) ──")
const inteiros = [...porPais.entries()].filter(([p, n]) => n === totalPorPais.get(p)).sort((a, b) => b[1] - a[1])
for (const [pais, n] of inteiros) console.log(`  ${pais.padEnd(24)} ${n} clubes`)
console.log("")
console.log("── PAÍSES PARCIAIS (alguns têm, outros não) ──")
const parciais = [...porPais.entries()].filter(([p, n]) => n !== totalPorPais.get(p)).sort((a, b) => b[1] - a[1])
for (const [pais, n] of parciais.slice(0, 20)) console.log(`  ${pais.padEnd(24)} ${n} de ${totalPorPais.get(pais)}`)
console.log("")
console.log(`países inteiros sem escudo: ${inteiros.length} | parciais: ${parciais.length}`)
