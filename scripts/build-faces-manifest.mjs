import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const photosDir = path.join(root, "public", "jogadores")
const overridesFile = path.join(root, "data", "seeds", "player_photo_overrides.json")
const outputFile = path.join(root, "data", "seeds", "faces-manifest.json")
const overrides = JSON.parse(await readFile(overridesFile, "utf8"))
const files = new Set(await readdir(photosDir))
const entries = {}
let missing = 0

for (const [key, url] of Object.entries(overrides)) {
  if (key.startsWith("_") || typeof url !== "string" || !url.startsWith("/jogadores/")) continue
  const filename = decodeURIComponent(url.slice("/jogadores/".length))
  if (files.has(filename)) entries[key] = url
  else missing++
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  available: Object.keys(entries).length,
  missing,
  entries,
}
await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`faces disponíveis=${manifest.available} referências sem arquivo=${manifest.missing}`)
