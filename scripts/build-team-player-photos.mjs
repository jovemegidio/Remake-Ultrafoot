import { cp, mkdir, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const source = path.join(root, "Jogadores por Times")
const destination = path.join(root, "public", "jogadores")
const manifestFile = path.join(root, "data", "seeds", "team-player-photos.json")
const supported = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"])
const slug = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

await mkdir(source, { recursive: true })
await mkdir(destination, { recursive: true })
const entries = {}

for (const team of await readdir(source, { withFileTypes: true })) {
  if (!team.isDirectory()) continue
  for (const photo of await readdir(path.join(source, team.name), { withFileTypes: true })) {
    if (!photo.isFile()) continue
    const extension = path.extname(photo.name).toLowerCase()
    if (!supported.has(extension)) continue
    const player = slug(path.basename(photo.name, extension))
    if (!player) continue
    const outputName = `time-${slug(team.name)}__${player}${extension === ".jpeg" ? ".jpg" : extension}`
    await cp(path.join(source, team.name, photo.name), path.join(destination, outputName))
    entries[`${team.name}__${player}`] = `/jogadores/${outputName}`
  }
}

await writeFile(manifestFile, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), entries }, null, 2)}\n`)
console.log(`fotos por time=${Object.keys(entries).length}`)
