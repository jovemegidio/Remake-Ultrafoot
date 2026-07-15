// Embute no build os ESCUDOS custom que o usuario ja importou no editor.
//
// Os escudos ficam so no save local (ultrafoot-clubs.json, chaves ultrafoot:logo:*). Para
// chegarem aos OUTROS jogadores eles precisam viajar no seed data/seeds/team-overrides.json
// (campo logoUrl). Este script le o save, COMPRIME cada escudo (256px, via sharp) para nao
// inchar o bundle, e funde no seed.
//
// Uso: node scripts/bake-user-logos.mjs ["<caminho-do-ultrafoot-clubs.json>"]
//   (sem argumento, usa %APPDATA%\com.ultrafoot.remake\ultrafoot-clubs.json)

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import sharp from "sharp"

const SAVE =
  process.argv[2] ||
  path.join(process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"), "com.ultrafoot.remake", "ultrafoot-clubs.json")
const SEED = path.resolve("data/seeds/team-overrides.json")

const kb = (n) => (n / 1024).toFixed(0) + " KB"

async function main() {
  const raw = JSON.parse(await readFile(SAVE, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8").catch(() => "{}"))

  const logoKeys = Object.keys(raw).filter((k) => k.startsWith("ultrafoot:logo:"))
  if (!logoKeys.length) {
    console.log("Nenhum escudo custom no save.")
    return
  }

  let baked = 0
  let before = 0
  let after = 0

  for (const key of logoKeys) {
    const fileKey = key.replace("ultrafoot:logo:", "")
    const dataUrl = raw[key]
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) continue

    // SVG e leve e vetorial — passa direto.
    if (dataUrl.startsWith("data:image/svg")) {
      seed[fileKey] = { ...(seed[fileKey] ?? {}), logoUrl: dataUrl }
      baked++
      continue
    }

    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
    const buf = Buffer.from(b64, "base64")
    before += buf.length

    let outBuf
    try {
      outBuf = await sharp(buf)
        .resize(256, 256, { fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer()
    } catch (e) {
      console.log(`  ! ${fileKey}: falhou (${e.message}) — mantém original`)
      seed[fileKey] = { ...(seed[fileKey] ?? {}), logoUrl: dataUrl }
      baked++
      continue
    }
    // So usa o comprimido se ficou menor.
    const finalBuf = outBuf.length < buf.length ? outBuf : buf
    after += finalBuf.length
    const outUrl = `data:image/png;base64,${finalBuf.toString("base64")}`
    seed[fileKey] = { ...(seed[fileKey] ?? {}), logoUrl: outUrl }
    baked++
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2), "utf8")

  console.log(`escudos embutidos: ${baked}`)
  console.log(`tamanho antes:     ${kb(before)}`)
  console.log(`tamanho depois:    ${kb(after)}  (${before ? Math.round((1 - after / before) * 100) : 0}% menor)`)
  console.log(`total de clubes no seed: ${Object.keys(seed).length}`)
  console.log(`\nOK — data/seeds/team-overrides.json atualizado. O proximo build leva os escudos a todos.`)
}

main()
