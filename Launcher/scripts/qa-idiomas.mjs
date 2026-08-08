// COBERTURA DAS TRADUÇÕES.
//
//   node scripts/qa-idiomas.mjs            # resumo
//   node scripts/qa-idiomas.mjs --faltando # lista as chaves que faltam em cada idioma
//
// Serve para saber onde continuar: um idioma parcial não quebra nada (a cadeia
// de reserva cobre), mas ninguém adivinha quais chaves faltam sem varrer o
// arquivo na mão. É o mesmo número que o seletor mostra ao jogador.

import fs from "node:fs"
import path from "node:path"

const raiz = path.resolve(import.meta.dirname, "..", "lib", "i18n")
const detalhar = process.argv.includes("--faltando")

const chaves = [...fs.readFileSync(path.join(raiz, "catalogo.ts"), "utf8")
  .matchAll(/^\s{2}"([a-z]+\.[A-Za-z]+)":/gm)].map(m => m[1])

const idiomas = [...fs.readFileSync(path.join(raiz, "idiomas.ts"), "utf8")
  .matchAll(/codigo:\s*"([^"]+)"/g)].map(m => m[1])

/** Um bloco `const xx: PacoteDeIdioma = { … }` por idioma. */
const pacotes = new Map()
for (const arquivo of fs.readdirSync(path.join(raiz, "textos"))) {
  const texto = fs.readFileSync(path.join(raiz, "textos", arquivo), "utf8")
  // O mapa final (`{ ru, uk, … }`) diz qual variável é qual código.
  const apelidos = new Map()
  const mapa = texto.match(/PACOTES: Record<string, PacoteDeIdioma> = \{([\s\S]*?)\}/)
  if (mapa) {
    for (const par of mapa[1].split(",")) {
      const m = par.trim().match(/^(?:"([^"]+)":\s*)?(\w+)$/)
      if (m) apelidos.set(m[2], m[1] ?? m[2])
    }
  }
  for (const bloco of [...texto.matchAll(/const (\w+): PacoteDeIdioma = \{([\s\S]*?)\n\}/g)]) {
    const codigo = apelidos.get(bloco[1]) ?? bloco[1]
    const presentes = new Set([...bloco[2].matchAll(/"([a-z]+\.[A-Za-z]+)":/g)].map(m => m[1]))
    pacotes.set(codigo, presentes)
  }
}

let completos = 0
const parciais = []
for (const codigo of idiomas) {
  if (codigo === "pt-BR") { completos++; continue }
  // Variantes herdam do idioma base; o português cai no pt-BR, que é a fonte.
  const base = codigo.split("-")[0]
  const proprio = pacotes.get(codigo) ?? new Set()
  const doBase = base !== codigo ? (pacotes.get(base) ?? new Set()) : new Set()
  const tem = new Set([...proprio, ...doBase])
  const faltando = base === "pt" ? [] : chaves.filter(c => !tem.has(c))
  if (faltando.length === 0) completos++
  else parciais.push({ codigo, faltando })
}

console.log(`chaves no catálogo: ${chaves.length}`)
console.log(`idiomas oferecidos: ${idiomas.length}`)
console.log(`  completos: ${completos}`)
console.log(`  parciais.: ${parciais.length}`)
if (parciais.length) {
  console.log("\nParciais (cobertura):")
  for (const p of parciais.sort((a, b) => a.faltando.length - b.faltando.length)) {
    const pct = Math.round(((chaves.length - p.faltando.length) / chaves.length) * 100)
    console.log(`  ${p.codigo.padEnd(6)} ${String(pct).padStart(3)}%  faltam ${p.faltando.length}`)
    if (detalhar) console.log(`         ${p.faltando.join(", ")}`)
  }
}
