// AUDITA UM LOTE DE ESCUDOS BAIXADOS, sem depender de olhar imagem por imagem.
//
// A pergunta que importa depois de um download em massa não é "quantos vieram",
// é "algum veio errado". Não dá para inspecionar 600 imagens à mão, mas dois
// sinais objetivos pegam a maior parte dos enganos:
//
//   1. ARQUIVOS IDÊNTICOS (mesmo sha) em clubes diferentes. Escudo é arte única
//      por clube; dois clubes com o mesmo byte a byte significa que o casamento
//      levou os dois ao MESMO verein — ou que o Transfermarkt devolveu uma
//      imagem-padrão de "sem escudo".
//   2. ARQUIVOS MINÚSCULOS, que costumam ser justamente esse placeholder.
//
// ⚠️ Escudo errado é pior do que escudo nenhum: o canal vence o embutido e apaga
// a arte boa que já viajava na build (foi assim que o Santos ficou com o escudo
// do Santos Laguna).
//
//   node scripts/auditar-escudos-baixados.mjs [--desde-minutos 240]

import { readdir, readFile, stat } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"

const DIR = path.resolve("public/escudos")
const arg = process.argv.indexOf("--desde-minutos")
const DESDE = arg >= 0 ? Number(process.argv[arg + 1]) : 0
const corte = DESDE ? Date.now() - DESDE * 60_000 : 0

const nomes = (await readdir(DIR)).filter(n => /\.(png|webp|jpg|jpeg)$/i.test(n))
const porSha = new Map()
const minusculos = []
let considerados = 0

for (const nome of nomes) {
  const alvo = path.join(DIR, nome)
  const info = await stat(alvo)
  if (corte && info.mtimeMs < corte) continue
  considerados++
  if (info.size < 900) minusculos.push(`${nome} (${info.size} B)`)
  const sha = createHash("sha256").update(await readFile(alvo)).digest("hex")
  porSha.set(sha, [...(porSha.get(sha) ?? []), nome])
}

const repetidos = [...porSha.values()].filter(l => l.length > 1)

console.log(`escudos considerados: ${considerados}${DESDE ? ` (modificados nos ultimos ${DESDE} min)` : ""}`)
console.log(`arquivos identicos em clubes diferentes: ${repetidos.length} grupos`)
console.log(`arquivos minusculos (provavel placeholder): ${minusculos.length}`)
console.log("")

if (repetidos.length) {
  console.log("── MESMA IMAGEM EM CLUBES DIFERENTES (olhar um a um) ──")
  for (const grupo of repetidos.sort((a, b) => b.length - a.length).slice(0, 25)) {
    console.log(`  ${grupo.length}x  ${grupo.join(", ")}`)
  }
  console.log("")
}
if (minusculos.length) {
  console.log("── MINUSCULOS ──")
  for (const m of minusculos.slice(0, 25)) console.log(`  ${m}`)
}
if (!repetidos.length && !minusculos.length) {
  console.log("OK: nenhum escudo repetido entre clubes e nenhum placeholder.")
}
