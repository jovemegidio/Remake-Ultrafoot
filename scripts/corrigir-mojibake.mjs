// CORRECAO DE MOJIBAKE NOS SEEDS.
//
//   node scripts/corrigir-mojibake.mjs             # so mostra o que faria
//   node scripts/corrigir-mojibake.mjs --aplicar   # corrige (backup .bak-mojibake)
//
// O DEFEITO: em algum import, texto UTF-8 foi lido como CP1252 e regravado.
// "İstanbul Başakşehir" virou "Ä°stanbul BaÅŸakÅŸehir"; "Dejan Stanković"
// virou "Dejan StankoviÄ‡".
//
// POR QUE IMPORTA: nome de clube e CHAVE de casamento no jogo —
// `saiuDoClube(team.nome, ...)` e `chegouAoClube(team.nome)` comparam texto com
// texto. Uma transferencia que cite o clube pela grafia certa nunca casa, e
// ninguem ve erro: a atualizacao apenas nao acontece. O mesmo vale para
// `escudo`, que aponta para um arquivo cujo nome no disco esta CERTO — ou seja,
// hoje esses escudos ja dao 404.
//
// CP1252 E NAO LATIN-1. Essa distincao e o que faz a correcao funcionar: os
// bytes 0x80-0x9F nao existem em latin-1, mas existem em CP1252 (’ ‚ Ÿ Š ...),
// e sao justamente os que aparecem no mojibake de aspas e de letras eslavas.
// Tentar desfazer com latin-1 falha silenciosamente na metade dos casos.
//
// TRES TRAVAS antes de trocar qualquer string:
//   1. todo caractere tem de vir de UM byte (via CP1252) — senao nao e mojibake;
//   2. reinterpretar como UTF-8 nao pode gerar caractere de substituicao;
//   3. a volta tem de reproduzir a string original, byte a byte.
// Com isso, texto que ja esta correto ("São Paulo") nunca e tocado.
//
// NAO mexemos em espaco no inicio/fim: existem clubes distintos cujo nome so
// difere por isso ("Al-Hilal" e "Al-Hilal "), e aparar juntaria dois registros.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const aplicar = process.argv.includes("--aplicar")

const ARQUIVOS = [
  "data/seeds/imported-bf2026.json",
  "data/seeds/tm-squads.json",
  "data/seeds/bf2026-teams.json",
  "data/seeds/real-squads-tm.json",
  "data/seeds/teams_br.json",
  "data/seeds/players_br.json",
  "data/seeds/leagues.json",
  "data/seeds/leagues-bf2026.json",
]

/** Campos que podemos reescrever. Fora desta lista, nada e tocado. */
const CAMPOS = new Set([
  "nome", "nomeOficial", "curto", "estadio", "tecnico", "pais", "liga",
  "nac", "escudo", "id", "fileKey", "file_key", "name", "stadium",
])

// Onde CP1252 difere de latin-1 (bytes 0x80-0x9F).
const CP1252_INVERSO = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A],
  [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92],
  [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C],
  [0x017E, 0x9E], [0x0178, 0x9F],
])

function paraBytes(s) {
  const bytes = []
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    if (cp <= 0xff) bytes.push(cp)
    else if (CP1252_INVERSO.has(cp)) bytes.push(CP1252_INVERSO.get(cp))
    else return null // trava 1
  }
  return Buffer.from(bytes)
}

function desfazer(s) {
  const buf = paraBytes(s)
  if (!buf) return null
  const volta = buf.toString("utf8")
  if (volta.includes("�")) return null // trava 2
  if (Buffer.compare(Buffer.from(volta, "utf8"), buf) !== 0) return null // trava 3
  return volta === s ? null : volta
}

let total = 0
const porCampo = {}
const amostras = []
const chavesAntes = new Set()
const chavesDepois = new Map()

function andar(no) {
  if (Array.isArray(no)) {
    for (const x of no) if (x && typeof x === "object") andar(x)
    return
  }
  if (!no || typeof no !== "object") return
  for (const k of Object.keys(no)) {
    const v = no[k]
    if (typeof v === "string" && CAMPOS.has(k)) {
      const novo = desfazer(v)
      if (novo) {
        total++
        porCampo[k] = (porCampo[k] || 0) + 1
        if (amostras.length < 12) amostras.push(`    ${k}: ${JSON.stringify(v)} -> ${JSON.stringify(novo)}`)
        // Colisao de chave: se o valor corrigido ja existe em outro registro,
        // a correcao FUNDIRIA dois clubes. Melhor saber antes.
        if (k === "fileKey" || k === "file_key" || k === "id") {
          chavesDepois.set(novo, (chavesDepois.get(novo) || 0) + 1)
        }
        no[k] = novo
      }
    } else if (v && typeof v === "object") andar(v)
  }
}

function coletarChaves(no) {
  if (Array.isArray(no)) { for (const x of no) if (x && typeof x === "object") coletarChaves(x); return }
  if (!no || typeof no !== "object") return
  for (const k of Object.keys(no)) {
    const v = no[k]
    if (typeof v === "string" && (k === "fileKey" || k === "file_key" || k === "id")) chavesAntes.add(v)
    else if (v && typeof v === "object") coletarChaves(v)
  }
}

const resumo = []
for (const rel of ARQUIVOS) {
  const caminho = path.join(RAIZ, rel)
  if (!existsSync(caminho)) { resumo.push([0, "ausente", rel]); continue }
  let dado
  try { dado = JSON.parse(readFileSync(caminho, "utf-8")) }
  catch (e) { resumo.push([0, "ilegivel", rel]); continue }
  coletarChaves(dado)
  const antes = total
  andar(dado)
  const n = total - antes
  resumo.push([n, n ? "corrigido" : "limpo", rel])
  if (n && aplicar) {
    const bak = `${caminho}.bak-mojibake`
    if (!existsSync(bak)) copyFileSync(caminho, bak)
    writeFileSync(caminho, JSON.stringify(dado))
  }
}

console.log(`${aplicar ? "APLICADO" : "SIMULACAO"} — ${total} strings\n`)
for (const [n, estado, rel] of resumo) console.log(`  ${String(n).padStart(5)}  ${estado.padEnd(10)} ${rel}`)
console.log("\nPor campo:")
for (const [k, v] of Object.entries(porCampo).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`)

const colisoes = [...chavesDepois.keys()].filter((k) => chavesAntes.has(k))
console.log(`\nColisao de chave apos correcao: ${colisoes.length}`)
for (const c of colisoes.slice(0, 10)) console.log(`  !! ${c}`)

console.log("\nAmostra:")
for (const a of amostras) console.log(a)
if (!aplicar && total) console.log("\nNada foi gravado. Rode com --aplicar para valer.")
