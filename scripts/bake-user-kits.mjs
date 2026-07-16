// Restaura no build os UNIFORMES (kits) que o usuario importou no editor e que sumiram
// (foram removidos quando o save foi de-inchado; o backup ficou em team-overrides-export.json).
//
// Le o export, COMPRIME cada camisa (sharp, 400px) e funde no seed data/seeds/team-overrides.json
// (campo kits.<variant>.imageUrl), PRESERVANDO os escudos (logoUrl) ja embutidos. Assim os
// uniformes voltam E passam a viajar no build para todos os jogadores, sem inchar.
//
// Uso: node scripts/bake-user-kits.mjs ["<caminho export.json>"]

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import sharp from "sharp"

const EXPORT =
  process.argv[2] ||
  path.join(process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"), "com.ultrafoot.remake", "team-overrides-export.json")
const SEED = path.resolve("data/seeds/team-overrides.json")

const kb = (n) => (n / 1024).toFixed(0) + " KB"

async function compress(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return { url: dataUrl, before: 0, after: 0 }
  if (dataUrl.startsWith("data:image/svg")) return { url: dataUrl, before: 0, after: 0 }
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
  const buf = Buffer.from(b64, "base64")
  try {
    const out = await sharp(buf).resize(400, 400, { fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
    const final = out.length < buf.length ? out : buf
    return { url: `data:image/png;base64,${final.toString("base64")}`, before: buf.length, after: final.length }
  } catch {
    return { url: dataUrl, before: buf.length, after: buf.length }
  }
}

async function main() {
  const exp = JSON.parse(await readFile(EXPORT, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8").catch(() => "{}"))

  let clubs = 0, kits = 0, before = 0, after = 0
  for (const [fileKey, ovr] of Object.entries(exp)) {
    if (!ovr?.kits) continue
    const outKits = { ...(seed[fileKey]?.kits ?? {}) }
    for (const [variant, kit] of Object.entries(ovr.kits)) {
      if (!kit) continue
      let imageUrl = kit.imageUrl
      if (imageUrl) {
        const r = await compress(imageUrl)
        imageUrl = r.url; before += r.before; after += r.after; kits++
      }
      outKits[variant] = { ...(seed[fileKey]?.kits?.[variant] ?? {}), ...kit, ...(imageUrl ? { imageUrl } : {}) }
    }
    seed[fileKey] = { ...(seed[fileKey] ?? {}), kits: outKits }
    clubs++
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2), "utf8")
  console.log(`clubes com kit restaurados: ${clubs} | imagens: ${kits}`)
  console.log(`tamanho antes: ${kb(before)} -> depois: ${kb(after)} (${before ? Math.round((1 - after / before) * 100) : 0}% menor)`)
  console.log(`total de clubes no seed: ${Object.keys(seed).length}`)
}

main()
