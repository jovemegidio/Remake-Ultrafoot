// Utilitarios compartilhados dos scripts de QA.
//
// POR QUE ISTO EXISTE: o next.config so liga `output: 'export'` quando TAURI_BUILD=1.
// Ou seja, `npm run build` puro compila mas NAO reescreve o out/. Rodar um teste depois
// disso testa o bundle ANTIGO — e ja aconteceu de um fix parecer "nao funcionar" e, pior,
// de um bug parecer "resolvido sozinho". Teste que roda em bundle velho e teste de fumaca.
//
// assertFreshBuild() aborta o teste se o out/ estiver ausente ou mais velho que o codigo.

import { existsSync, statSync, readdirSync } from "node:fs"
import path from "node:path"

const SOURCE_DIRS = ["app", "components", "lib", "hooks"]
const SOURCE_EXT = new Set([".ts", ".tsx", ".css", ".mjs"])

function newestSourceMtime(dir, acc = { time: 0, file: "" }) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      newestSourceMtime(full, acc)
    } else if (SOURCE_EXT.has(path.extname(entry.name))) {
      const m = statSync(full).mtimeMs
      if (m > acc.time) {
        acc.time = m
        acc.file = full
      }
    }
  }
  return acc
}

/**
 * Garante que o out/ existe e foi gerado DEPOIS da ultima alteracao de codigo.
 * Aborta o processo com instrucao clara quando nao for o caso.
 */
export function assertFreshBuild() {
  const indexHtml = path.resolve("out/index.html")

  if (!existsSync(indexHtml)) {
    console.error(
      "\nERRO: out/ nao existe.\n\n" +
      "O next so exporta o out/ com TAURI_BUILD=1 (ver next.config.mjs).\n" +
      "Rode:  npx cross-env TAURI_BUILD=1 npm run build\n"
    )
    process.exit(1)
  }

  const outTime = statSync(indexHtml).mtimeMs
  const newest = SOURCE_DIRS
    .map((d) => newestSourceMtime(path.resolve(d)))
    .reduce((a, b) => (b.time > a.time ? b : a), { time: 0, file: "" })

  if (newest.time > outTime) {
    const ageMin = Math.round((newest.time - outTime) / 60000)
    console.error(
      `\nERRO: o out/ esta DESATUALIZADO — o teste rodaria contra um bundle velho.\n\n` +
      `  out/index.html : ${new Date(outTime).toLocaleString()}\n` +
      `  codigo mais novo: ${new Date(newest.time).toLocaleString()}  (${newest.file})\n` +
      `  diferenca: ${ageMin} min\n\n` +
      `Lembre: 'npm run build' puro NAO reescreve o out/ (output:'export' exige TAURI_BUILD=1).\n` +
      `Rode:  npx cross-env TAURI_BUILD=1 npm run build\n`
    )
    process.exit(1)
  }

  console.log(`build ok (out/ de ${new Date(outTime).toLocaleTimeString()}, mais novo que o codigo)\n`)
}
