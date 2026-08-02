// Copia o instalador do Ultrafoot Launcher para dentro dos resources do jogo, com
// o nome que o hook NSIS espera (UltrafootLauncher-setup.exe). Rode isto DEPOIS de
// buildar o launcher e ANTES de buildar o jogo, para que a próxima atualização do
// jogo instale o launcher em silêncio para quem já tem o Ultrafoot.
//
// Uso:
//   node scripts/stage-launcher.mjs                       (procura o setup automaticamente)
//   node scripts/stage-launcher.mjs --publicado           (baixa o que ESTA no ar)
//   node scripts/stage-launcher.mjs "C:/caminho/para/Ultrafoot Launcher_1.0.0_x64-setup.exe"
//   LAUNCHER_SETUP="C:/.../setup.exe" node scripts/stage-launcher.mjs
//
// SOBRE `--publicado`: o build local e o binario no ar divergem sozinhos. Medido
// em 02/08/26 — o local era o 1.0.23 de 31/07 e o publicado ja era o 1.0.25, e o
// jogo teria embutido um launcher DUAS versoes atras sem ninguem perceber. A CI
// (launcher-platforms.yml) agora builda o Windows e publica na tag fixa
// `launcher`; `--publicado` pega exatamente esse binario, entao o que o jogo
// embute e o mesmo que o auto-update entrega.

import { readdir, copyFile, mkdir, access, stat, writeFile, readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"

const DEST_DIR = path.resolve("src-tauri/resources/launcher")
const DEST = path.join(DEST_DIR, "UltrafootLauncher-setup.exe")

const URL_PUBLICADO =
  "https://github.com/jovemegidio/Ultrafoot26/releases/download/launcher/Ultrafoot-Launcher-Setup.exe"

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex")

/** Baixa o instalador que esta no ar e devolve o caminho do arquivo salvo. */
async function baixarPublicado() {
  console.log(`→ baixando o instalador publicado`)
  console.log(`  ${URL_PUBLICADO}`)
  const r = await fetch(`${URL_PUBLICADO}?cb=${Date.now()}`, { redirect: "follow" })
  if (!r.ok) throw new Error(`o download falhou: HTTP ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  // Instalador de poucos KB e pagina de erro salva com nome de .exe.
  if (buf.length < 5_000_000) {
    throw new Error(`baixei so ${buf.length} bytes — nao e um instalador valido`)
  }
  await mkdir(DEST_DIR, { recursive: true })
  const tmp = path.join(DEST_DIR, ".launcher-publicado.exe")
  await writeFile(tmp, buf)
  console.log(`  ${(buf.length / 1024 / 1024).toFixed(1)} MB, sha256 ${sha256(buf).slice(0, 16)}...`)
  return tmp
}

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
  const usarPublicado = process.argv.includes("--publicado")

  const setup = usarPublicado ? await baixarPublicado() : await findSetup()
  if (!setup) {
    console.error("ERRO: não encontrei o instalador do launcher (*-setup.exe).")
    console.error("Builde o launcher primeiro (Launcher/: pnpm tauri:build), informe o caminho,")
    console.error("ou use o que já está no ar:")
    console.error("  node scripts/stage-launcher.mjs --publicado")
    process.exit(1)
  }
  await mkdir(DEST_DIR, { recursive: true })
  await copyFile(setup, DEST)

  const embutido = await readFile(DEST)
  console.log(`Launcher preparado:`)
  console.log(`  origem:  ${setup}`)
  console.log(`  destino: ${DEST}`)
  console.log(`  sha256:  ${sha256(embutido)}`)

  // CONFERE CONTRA O QUE ESTA NO AR. Sem isto, o jogo embute um launcher de uma
  // versao e o auto-update entrega outra, e ninguem descobre ate um betatester
  // reclamar. So avisa — buildar com um launcher mais novo que o publicado e
  // legitimo (e o caso de quem vai publicar os dois juntos).
  if (!usarPublicado) {
    try {
      const r = await fetch(`${URL_PUBLICADO}?cb=${Date.now()}`, { redirect: "follow" })
      if (r.ok) {
        const noAr = Buffer.from(await r.arrayBuffer())
        if (sha256(noAr) === sha256(embutido)) {
          console.log(`  em dia:  identico ao instalador publicado`)
        } else {
          console.log(`\nATENCAO: o que voce vai embutir NAO e o que esta publicado.`)
          console.log(`  embutido:  ${sha256(embutido).slice(0, 16)}...  ${(embutido.length / 1048576).toFixed(1)} MB`)
          console.log(`  publicado: ${sha256(noAr).slice(0, 16)}...  ${(noAr.length / 1048576).toFixed(1)} MB`)
          console.log(`  Se nao for proposital, rode com --publicado.`)
        }
      }
    } catch {
      console.log(`  (nao consegui conferir contra o publicado — sem rede?)`)
    }
  }

  console.log(`\nAgora builde o jogo (npm run tauri:build). O instalador do jogo passará`)
  console.log(`a instalar o launcher em silêncio no pós-instalação.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
