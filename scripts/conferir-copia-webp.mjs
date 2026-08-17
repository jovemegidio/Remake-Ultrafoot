// Confere a cópia produzida pelo copiar-canal-em-webp.mjs.
//
//   node scripts/conferir-copia-webp.mjs --origem "<pasta>" --destino "<pasta>" [--amostra 60]
//
// Duas perguntas, e as duas já deram errado antes:
//
//   1. FALTA ARQUIVO? Cada arquivo da origem tem de existir no destino, com o
//      mesmo nome ou com `.webp` no lugar da extensão.
//   2. O "SEM PERDAS" É SEM PERDAS MESMO? ⚠️ Comparar o buffer cru REPROVA 100%
//      das imagens sem que nada esteja errado: a libwebp reescreve o RGB que
//      fica DEBAIXO de pixel totalmente transparente (dezenas de milhares por
//      escudo) para comprimir melhor. A conferência certa é "todo pixel com
//      alfa > 0 idêntico, e o canal alfa idêntico em toda parte".

import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const arg = (n, padrao = "") => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : padrao
}
const origem = arg("--origem")
const destino = arg("--destino")
const amostra = Number(arg("--amostra", "60"))
if (!origem || !destino) {
  console.error('uso: --origem "<pasta>" --destino "<pasta>" [--amostra 60]')
  process.exit(1)
}

function listar(raiz, base = "") {
  const saida = []
  for (const item of readdirSync(path.join(raiz, base), { withFileTypes: true })) {
    const rel = base ? path.join(base, item.name) : item.name
    if (item.isDirectory()) saida.push(...listar(raiz, rel))
    else if (item.isFile()) saida.push(rel)
  }
  return saida
}

const naOrigem = listar(origem)
const noDestino = new Set(listar(destino))

const faltando = []
const paresWebp = []
for (const rel of naOrigem) {
  const ext = path.extname(rel)
  const comWebp = rel.slice(0, -ext.length) + ".webp"
  if (noDestino.has(comWebp) && ext.toLowerCase() !== ".webp") paresWebp.push([rel, comWebp])
  else if (!noDestino.has(rel) && !noDestino.has(comWebp)) faltando.push(rel)
}

console.log(`origem ${naOrigem.length} arquivos | destino ${noDestino.size} arquivos`)
console.log(`convertidos para webp: ${paresWebp.length} | faltando no destino: ${faltando.length}`)
for (const f of faltando.slice(0, 20)) console.log(`  ! ${f}`)

// Amostra espalhada por toda a lista, não os primeiros N (as pastas estão em
// ordem alfabética e os primeiros N seriam todos da mesma liga).
const passo = Math.max(1, Math.floor(paresWebp.length / amostra))
const sorteados = paresWebp.filter((_, i) => i % passo === 0).slice(0, amostra)

let iguais = 0, diferentes = 0
for (const [rel, relWebp] of sorteados) {
  const a = await sharp(path.join(origem, rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const b = await sharp(path.join(destino, relWebp)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    console.log(`  ! ${rel}: dimensao ${a.info.width}x${a.info.height} -> ${b.info.width}x${b.info.height}`)
    diferentes++
    continue
  }
  let ok = true
  for (let i = 0; i < a.data.length && ok; i += 4) {
    if (a.data[i + 3] !== b.data[i + 3]) ok = false
    else if (a.data[i + 3] > 0 && (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2])) ok = false
  }
  if (ok) iguais++
  else { diferentes++; console.log(`  ! ${rel}: pixel visivel diferente`) }
}

console.log(`amostra conferida pixel a pixel: ${iguais} identicas, ${diferentes} diferentes`)
const mb = (b) => (b / 1024 / 1024).toFixed(0)
const soma = (raiz, lista) => lista.reduce((n, f) => n + statSync(path.join(raiz, f)).size, 0)
console.log(`peso: origem ${mb(soma(origem, naOrigem))} MB -> destino ${mb(soma(destino, [...noDestino]))} MB`)
process.exit(faltando.length || diferentes ? 1 : 0)
