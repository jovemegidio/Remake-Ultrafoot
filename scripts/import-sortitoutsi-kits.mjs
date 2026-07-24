// Importa os kits do sortitoutsi JA CASADOS (scripts/match-sortitoutsi-kits.ts
// --write gerou data/seeds/sortitoutsi-kit-map.json).
//
// - _1/_2/_3 -> home/away/third; redimensiona pra 256x256 webp (igual ao pack
//   existente); grava em public/kits-imported/sts_<key>_<variant>.webp.
// - MERGE no kits-manifest.json: parte do manifest atual (1505 kits) e adiciona/
//   atualiza SO as chaves casadas. A chave e normalizeKitKey(file_key), que e a
//   mesma que o jogo usa em getCamisaUrl -> casa direto.
//
// Roda em C:\Ultrafoot (sharp quebra no G: por causa do Google Drive).

import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const root = process.cwd()
const mapFile = path.join(root, "data/seeds/sortitoutsi-kit-map.json")
const manifestFile = path.join(root, "data/seeds/kits-manifest.json")
const outDir = path.join(root, "public/kits-imported")
await fs.mkdir(outDir, { recursive: true })

const normalizeKitKey = v => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase()

const mapa = JSON.parse(await fs.readFile(mapFile, "utf8"))
const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"))
const antes = Object.keys(manifest).length

const VAR = { 1: "home", 2: "away", 3: "third" }
let files = 0, clubs = 0, overwrites = 0
const semArte = []

for (const [fileKey, info] of Object.entries(mapa)) {
  const key = normalizeKitKey(fileKey)
  const variants = {}
  for (const idx of [1, 2, 3]) {
    const input = path.join(info.dir, `${info.base}_${idx}.png`)
    try { await fs.access(input) } catch { continue }
    const filename = `sts_${key}_${VAR[idx]}.webp`
    await sharp(input).resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(outDir, filename))
    variants[VAR[idx]] = filename
    files++
  }
  if (!Object.keys(variants).length) { semArte.push(fileKey); continue }
  if (manifest[key]) overwrites++
  manifest[key] = { id: `sts_${key}`, club: info.nome, needsReview: false, ...variants }
  clubs++
}

await fs.writeFile(manifestFile, JSON.stringify(manifest), "utf8")
console.log(JSON.stringify({
  clubsImportados: clubs, arquivos: files, sobrescritos: overwrites,
  manifestAntes: antes, manifestDepois: Object.keys(manifest).length,
  semArte,
}, null, 2))
