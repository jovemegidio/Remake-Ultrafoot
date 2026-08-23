import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
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

// ⚠️ Mesmo motivo do build-faces-manifest: reescrever só o carimbo deixava a
// árvore suja depois de toda build, e a CI de Linux/macOS recusa árvore suja.
const novoTexto = `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), entries }, null, 2)}\n`
const anterior = await readFile(manifestFile, "utf8").catch(() => null)
const semCarimbo = texto => texto
  .replace(/\r\n/g, "\n")
  .replace(/"generatedAt": "[^"]*",\n/, "")
if (anterior !== null && semCarimbo(anterior) === semCarimbo(novoTexto)) {
  console.log("manifesto de fotos por time inalterado — carimbo preservado")
} else {
  await writeFile(manifestFile, novoTexto)
}
console.log(`fotos por time=${Object.keys(entries).length}`)
