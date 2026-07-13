// Corrige MOJIBAKE nos seeds de dados (nomes com acento corrompido).
//
// Sintoma: "JoaquÃ­n Piquerez" em vez de "Joaquín Piquerez".
// Causa: o texto UTF-8 foi decodificado como latin1 em algum passo da importacao,
// entao cada byte >0x7F virou um caractere separado (í = C3 AD -> "Ã" + "­").
// Correcao: reinterpretar a string como bytes latin1 e decodificar de novo em UTF-8.
//
// Aplica-se APENAS a strings que realmente parecem mojibake, para nao corromper
// texto que ja esta correto.
//
// Uso:  node scripts/fix-mojibake-seeds.mjs [--dry]
import { readFile, writeFile, copyFile } from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const FILES = [
  "data/seeds/imported-bf2026.json",
  "data/seeds/bf2026-teams.json",
  "data/seeds/players_br.json",
]
const dry = process.argv.includes("--dry")

// Sequencias tipicas de UTF-8 lido como latin1: Ã/Â/â/ð seguidos de um byte alto.
const MOJIBAKE_RE = /[Â-ÃâÅÆ][-¿]/

function looksMojibake(s) {
  return typeof s === "string" && MOJIBAKE_RE.test(s)
}

function repair(s) {
  const fixed = Buffer.from(s, "latin1").toString("utf8")
  // Se a "correcao" gerou o caractere de substituicao, o palpite estava errado:
  // devolve o original para nao piorar.
  if (fixed.includes("�")) return s
  return fixed
}

let repaired = 0
let scanned = 0

function walk(node) {
  if (typeof node === "string") {
    scanned++
    if (looksMojibake(node)) {
      const out = repair(node)
      if (out !== node) {
        repaired++
        return out
      }
    }
    return node
  }
  if (Array.isArray(node)) return node.map(walk)
  if (node && typeof node === "object") {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = walk(v)
    return out
  }
  return node
}

for (const rel of FILES) {
  const file = path.join(ROOT, rel)
  let raw
  try {
    raw = await readFile(file, "utf8")
  } catch {
    console.log(`(pulado, nao existe) ${rel}`)
    continue
  }

  const before = repaired
  const data = JSON.parse(raw)
  const fixedData = walk(data)
  const changed = repaired - before

  console.log(`${rel.padEnd(38)} strings corrigidas: ${changed}`)

  if (changed > 0 && !dry) {
    await copyFile(file, file + ".bak") // backup antes de sobrescrever
    await writeFile(file, JSON.stringify(fixedData, null, 2), "utf8")
  }
}

console.log(`\nstrings analisadas: ${scanned}`)
console.log(`strings corrigidas: ${repaired}${dry ? " (dry-run, nada gravado)" : " (backups .bak criados)"}`)
