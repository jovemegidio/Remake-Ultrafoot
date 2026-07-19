// Importa somente UIDs confirmados e converte as imagens para WebP compacto.
// Uso recomendado após extrair o megapack uma vez:
// node scripts/import-face-batch.mjs --source C:\ultrafoot-faces-source --map data/seeds/face-id-map.json --limit 200
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => arg.startsWith("--") ? [arg.slice(2), all[index + 1]] : null).filter(Boolean))
const archive = args.archive
const source = args.source ? path.resolve(args.source) : ""
const mapFile = path.resolve(args.map || "data/seeds/face-id-map.json")
const limit = Math.max(1, Math.min(500, Number(args.limit) || 200))
const sevenZip = args.sevenzip || "C:\\Program Files\\7-Zip\\7z.exe"
if ((!archive || !existsSync(archive)) && (!source || !existsSync(source))) throw new Error("Informe --source com o megapack extraído ou --archive com o RAR")
if (!existsSync(mapFile)) throw new Error(`Mapa confirmado ausente: ${mapFile}`)

const mapping = JSON.parse(await readFile(mapFile, "utf8"))
const progressFile = path.resolve("data/seeds/face-import-progress.json")
const progress = existsSync(progressFile) ? JSON.parse(await readFile(progressFile, "utf8")) : { importedIds: [] }
const imported = new Set(progress.importedIds || [])
const batch = Object.entries(mapping).filter(([id]) => !imported.has(id)).slice(0, limit)
if (!batch.length) { console.log("Nenhuma face confirmada pendente"); process.exit(0) }

const temp = path.resolve(".face-import-temp")
let extracted = []
if (!source) {
  await rm(temp, { recursive: true, force: true }); await mkdir(temp, { recursive: true })
  const listFile = path.join(temp, "files.txt")
  await writeFile(listFile, batch.flatMap(([id]) => [`${id}.png`, `face_${id}.png`, `faces/${id}.png`, `faces/face_${id}.png`, `sortitoutsi/faces/face_${id}.png`]).join("\n"))
  execFileSync(sevenZip, ["x", "-y", `-o${temp}`, archive, `@${listFile}`], { stdio: "inherit" })
  extracted = await readdir(temp, { recursive: true })
}

const overridesFile = path.resolve("data/seeds/player_photo_overrides.json")
const overrides = JSON.parse(await readFile(overridesFile, "utf8"))
await mkdir(path.resolve("public/jogadores"), { recursive: true })
let count = 0
for (const [id, playerId] of batch) {
  const directCandidates = source ? [
    path.join(source, `face_${id}.png`), path.join(source, `${id}.png`),
    path.join(source, "faces", `face_${id}.png`),
    path.join(source, "sortitoutsi", "faces", `face_${id}.png`),
  ] : []
  const direct = directCandidates.find(existsSync)
  const relative = source ? undefined : extracted.find(file => new RegExp(`(^|[\\\\/])(face_)?${id}\\.(png|jpg)$`, "i").test(String(file)))
  const input = direct ?? (relative ? path.join(temp, String(relative)) : "")
  if (!input) continue
  const destination = path.resolve("public/jogadores", `${playerId}.webp`)
  await sharp(input).resize(256, 256, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(destination)
  overrides[playerId] = `/jogadores/${playerId}.webp`
  imported.add(id); count++
}
await writeFile(overridesFile, `${JSON.stringify(overrides, null, 2)}\n`)
await writeFile(progressFile, `${JSON.stringify({ importedIds: [...imported], lastRunAt: new Date().toISOString() }, null, 2)}\n`)
if (!source) await rm(temp, { recursive: true, force: true })
console.log(`faces importadas neste lote=${count}; progresso total=${imported.size}`)
