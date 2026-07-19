import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const [source, mappingFile, projectRoot = process.cwd()] = process.argv.slice(2)
if (!source || !mappingFile) throw new Error("Uso: node scripts/import-mapped-kits.mjs <pasta-kits> <mapeamento.json>")
const mapping = JSON.parse(await fs.readFile(mappingFile, "utf8"))
const output = path.resolve(projectRoot, "public/kits-imported")
await fs.mkdir(output, { recursive: true })

const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase()
const manifest = {}
let imported = 0
for (const [id, club] of Object.entries(mapping)) {
  const variants = {}
  for (const variant of ["home", "away", "third"]) {
    const input = path.join(source, `${id}_${variant}.png`)
    try { await fs.access(input) } catch { continue }
    const filename = `${id}_${variant}.webp`
    await sharp(input).resize(256, 256, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(output, filename))
    variants[variant] = filename
    imported++
  }
  if (Object.keys(variants).length) manifest[normalize(club)] = { id, club, needsReview: club.endsWith("_CHECAR"), ...variants }
}
await fs.mkdir(path.resolve(projectRoot, "data/seeds"), { recursive: true })
await fs.writeFile(path.resolve(projectRoot, "data/seeds/kits-manifest.json"), JSON.stringify(manifest), "utf8")
console.log(JSON.stringify({ clubs: Object.keys(manifest).length, files: imported }))
