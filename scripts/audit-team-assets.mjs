// Auditoria: para CADA time do jogo, o escudo e a camisa existem em disco?
//
// O testador relatou "so o escudo/camisa do Botafogo aparece". Em vez de adivinhar,
// isto cruza teams-data com os arquivos reais e diz exatamente quantos times ficam
// sem arte (e quais) — que e o que produz o fallback generico na tela.
//
// Uso: node scripts/audit-team-assets.mjs

import { existsSync, readdirSync } from "node:fs"
import { register } from "node:module"

// teams-data e TS; em vez de compilar, extraimos os file_key por regex do fonte.
import { readFileSync } from "node:fs"

const src = readFileSync("lib/teams-data.ts", "utf8")

// Captura pares nome + file_key na ordem em que aparecem.
const teams = []
const nomeRe = /nome:\s*"([^"]+)"/g
const keyRe = /file_key:\s*"([^"]+)"/g

const nomes = [...src.matchAll(nomeRe)].map((m) => ({ i: m.index, v: m[1] }))
const keys = [...src.matchAll(keyRe)].map((m) => ({ i: m.index, v: m[1] }))

// Para cada file_key, o nome mais proximo ANTES dele e o do time.
for (const k of keys) {
  let nome = "?"
  for (const n of nomes) {
    if (n.i < k.i) nome = n.v
    else break
  }
  teams.push({ nome, fileKey: k.v })
}

const has = (dir, key, exts = [".png"]) =>
  exts.some((e) => existsSync(`public/${dir}/${key}${e}`))

const missingEscudo = []
const missingMini = []
const missingCamisa = []

for (const t of teams) {
  if (!has("escudos", t.fileKey)) missingEscudo.push(t)
  if (!has("escudos-mini", t.fileKey)) missingMini.push(t)
  // Camisas podem estar em qualquer um dos 3 diretorios.
  const kit =
    has("camisas", t.fileKey) || has("camisas2", t.fileKey) || has("camisas3", t.fileKey)
  if (!kit) missingCamisa.push(t)
}

const pct = (n) => `${(((teams.length - n) / teams.length) * 100).toFixed(1)}%`

console.log(`Times em teams-data: ${teams.length}\n`)
console.log(`ESCUDO      presente em ${teams.length - missingEscudo.length}/${teams.length}  (${pct(missingEscudo.length)})`)
console.log(`ESCUDO-MINI presente em ${teams.length - missingMini.length}/${teams.length}  (${pct(missingMini.length)})`)
console.log(`CAMISA      presente em ${teams.length - missingCamisa.length}/${teams.length}  (${pct(missingCamisa.length)})`)

const sample = (arr, n = 15) =>
  arr.slice(0, n).map((t) => `  - ${t.nome} (${t.fileKey})`).join("\n")

if (missingEscudo.length) {
  console.log(`\nSEM ESCUDO (${missingEscudo.length}) — LISTA COMPLETA:`)
  for (const t of missingEscudo) console.log(`  - ${t.nome} (${t.fileKey}.png)`)
}
if (missingCamisa.length) {
  console.log(`\nSEM CAMISA (${missingCamisa.length}) — LISTA COMPLETA:`)
  for (const t of missingCamisa) console.log(`  - ${t.nome} (${t.fileKey}.png)`)
}
