// Copia o instalador do Ultrafoot Launcher para dentro dos resources do jogo, com
// o nome que o hook NSIS espera (UltrafootLauncher-setup.exe). Rode isto DEPOIS de
// buildar o launcher e ANTES de buildar o jogo, para que a próxima atualização do
// jogo instale o launcher em silêncio para quem já tem o Ultrafoot.
//
// Uso:
//   node scripts/stage-launcher.mjs                       (procura o setup automaticamente)
//   node scripts/stage-launcher.mjs "C:/caminho/para/Ultrafoot Launcher_1.0.0_x64-setup.exe"
//   LAUNCHER_SETUP="C:/.../setup.exe" node scripts/stage-launcher.mjs

import { readdir, copyFile, mkdir, access, stat } from "node:fs/promises"
import path from "node:path"

const DEST_DIR = path.resolve("src-tauri/resources/launcher")
const DEST = path.join(DEST_DIR, "UltrafootLauncher-setup.exe")

const exists = async (p) => {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

// Locais prováveis do bundle NSIS do launcher (build local em C: ou dentro do repo).
const CANDIDATE_DIRS = [
  process.env.LAUNCHER_BUNDLE_DIR,
  "Launcher/src-tauri/target/release/bundle/nsis",
  "C:/ultrafoot-launcher/src-tauri/target/release/bundle/nsis",
].filter(Boolean)

async function findSetup() {
  // 1) caminho explícito por arg/env
  const explicit = process.argv[2] ?? process.env.LAUNCHER_SETUP
  if (explicit) {
    if (await exists(explicit)) return explicit
    throw new Error(`Instalador informado não existe: ${explicit}`)
  }
  // 2) procura nos diretórios de bundle o *-setup.exe mais recente
  let best = null
  for (const dir of CANDIDATE_DIRS) {
    if (!(await exists(dir))) continue
    const files = (await readdir(dir)).filter((f) => /setup\.exe$/i.test(f))
    for (const f of files) {
      const full = path.join(dir, f)
      const s = await stat(full)
      if (!best || s.mtimeMs > best.mtime) best = { full, mtime: s.mtimeMs }
    }
  }
  if (best) return best.full
  return null
}

async function main() {
  const setup = await findSetup()
  if (!setup) {
    console.error("ERRO: não encontrei o instalador do launcher (*-setup.exe).")
    console.error("Builde o launcher primeiro (Launcher/: pnpm tauri:build) ou informe o caminho:")
    console.error('  node scripts/stage-launcher.mjs "C:/.../Ultrafoot Launcher_1.0.0_x64-setup.exe"')
    process.exit(1)
  }
  await mkdir(DEST_DIR, { recursive: true })
  await copyFile(setup, DEST)
  console.log(`Launcher preparado:`)
  console.log(`  origem:  ${setup}`)
  console.log(`  destino: ${DEST}`)
  console.log(`\nAgora builde o jogo (npm run tauri:build). O instalador do jogo passará`)
  console.log(`a instalar o launcher em silêncio no pós-instalação.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
