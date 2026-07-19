/**
 * Importa kits e indexa faces a partir de pacotes no formato usado pelo FM.
 *
 * Os config.xml de alguns pacotes são apenas o template do Resource Manager e
 * não possuem <record>. Nessa situação os nomes dos arquivos são a fonte de
 * verdade: kits `ID_home/away/third.png` e faces `face_ID.png`.
 *
 * Uso:
 *   node scripts/import-config-assets.mjs --kits "C:\\Users\\SnyX\\Documents\\kits\\kits" \
 *     --kits-config "C:\\Users\\SnyX\\Documents\\kits\\config.xml" \
 *     --faces "G:\\...\\sortitoutsi_cutout_megapack_2026.07" \
 *     --faces-config "G:\\...\\sortitoutsi_cutout_megapack_2026.07\\config.xml"
 *
 * Kits conhecidos pelo manifesto são convertidos para WebP e vão para
 * public/kits-imported (dados do jogo, não save). Faces não são copiadas em
 * massa: apenas o mapa confirmado em data/seeds/face-id-map.json é importado,
 * evitando um instalador desnecessariamente grande.
 */
import fs from "node:fs/promises"
import path from "node:path"
let sharp
try { sharp = (await import("sharp")).default } catch { /* optional: existing WebP files can be reused */ }

const args = process.argv.slice(2).reduce((out, arg, index, all) => {
  if (arg.startsWith("--") && all[index + 1] && !all[index + 1].startsWith("--")) out[arg.slice(2)] = all[index + 1]
  return out
}, {})

const root = path.resolve(args.root || process.cwd())
const kitsDir = args.kits ? path.resolve(args.kits) : ""
const facesDir = args.faces ? path.resolve(args.faces) : ""
const kitsConfig = args["kits-config"] ? path.resolve(args["kits-config"]) : path.join(kitsDir, "..", "config.xml")
const facesConfig = args["faces-config"] ? path.resolve(args["faces-config"]) : path.join(facesDir, "config.xml")
const imageExt = /\.(png|jpe?g|webp)$/i

async function filesUnder(dir) {
  if (!dir) return []
  try { return (await fs.readdir(dir, { withFileTypes: true, recursive: true }))
    .filter(entry => entry.isFile() && imageExt.test(entry.name))
    .map(entry => path.join(entry.parentPath || dir, entry.name))
  } catch { return [] }
}

async function readConfig(file) {
  try {
    const xml = await fs.readFile(file, "utf8")
    const records = [...xml.matchAll(/<record\b[^>]*\bfrom=["']([^"']+)["'][^>]*\bto=["']([^"']+)["'][^>]*\/?\s*>/gi)]
      .map(match => ({ from: match[1], to: match[2] }))
    return { exists: true, records }
  } catch { return { exists: false, records: [] } }
}

const relativePosix = file => {
  const relative = path.relative(root, file)
  // Nunca empacota o caminho absoluto do computador do desenvolvedor.
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return `external/${path.basename(file)}`
  return relative.replaceAll(path.sep, "/")
}
const parseKit = file => {
  const name = path.basename(file)
  const match = name.match(/^(\d+)_(home|away|third)\.(png|jpe?g|webp)$/i)
  return match ? { id: match[1], variant: match[2].toLowerCase(), file } : undefined
}
const parseFace = file => {
  const name = path.basename(file)
  const match = name.match(/^face_(\d+)\.(png|jpe?g|webp)$/i)
  return match ? { id: match[1], file } : undefined
}

async function importKits() {
  console.error(`[assets] lendo kits: ${kitsDir}`)
  const config = await readConfig(kitsConfig)
  const sourceFiles = (await filesUnder(kitsDir)).map(parseKit).filter(Boolean)
  console.error(`[assets] kits encontrados: ${sourceFiles.length}`)
  const existingPath = path.join(root, "data/seeds/kits-manifest.json")
  let manifest = {}
  try { manifest = JSON.parse(await fs.readFile(existingPath, "utf8")) } catch {}
  const byId = new Map(Object.entries(manifest).map(([key, value]) => [String(value.id), { key, value }]))
  const output = path.join(root, "public/kits-imported")
  await fs.mkdir(output, { recursive: true })
  const existingOutputs = new Set(await fs.readdir(output))
  let converted = 0
  const variantsById = {}
  for (const item of sourceFiles) {
    variantsById[item.id] ??= {}
    const existingWebp = `${item.id}_${item.variant}.webp`
    const outName = existingOutputs.has(existingWebp)
      ? existingWebp
      : `${item.id}_${item.variant}.${sharp ? "webp" : "png"}`
    const outputFile = path.join(output, outName)
    if (!existingOutputs.has(outName)) {
      if (sharp) {
        await sharp(item.file).resize(256, 256, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82, alphaQuality: 90 }).toFile(outputFile)
      } else {
        await fs.copyFile(item.file, outputFile)
      }
      existingOutputs.add(outName)
    }
    variantsById[item.id][item.variant] = outName
    converted++
    const match = byId.get(item.id)
    if (match) manifest[match.key] = { ...match.value, [item.variant]: outName }
  }
  await fs.mkdir(path.dirname(existingPath), { recursive: true })
  await fs.writeFile(existingPath, `${JSON.stringify(manifest)}\n`, "utf8")
  await fs.writeFile(path.join(root, "data/seeds/kits-assets-index.json"), `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    sourcePattern: "ID_(home|away|third).png",
    configFile: relativePosix(kitsConfig),
    configMappings: config.records.length,
    sourceImages: sourceFiles.length,
    importedImages: converted,
    mappedClubIds: [...byId.keys()].filter(id => variantsById[id]).length,
    unmappedClubIds: Object.keys(variantsById).filter(id => !byId.has(id)),
    variantsById,
  }, null, 2)}\n`, "utf8")
  console.error(`[assets] kits importados: ${converted}`)
  return { configMappings: config.records.length, sourceImages: sourceFiles.length, importedImages: converted, mappedClubIds: [...byId.keys()].filter(id => variantsById[id]).length, unmappedClubIds: Object.keys(variantsById).filter(id => !byId.has(id)).length }
}

async function indexFaces() {
  console.error(`[assets] indexando faces: ${facesDir}`)
  const config = await readConfig(facesConfig)
  const sourceFiles = (await filesUnder(facesDir)).map(parseFace).filter(Boolean)
  const sourceIds = new Set(sourceFiles.map(item => item.id))
  let confirmed = {}
  try { confirmed = JSON.parse(await fs.readFile(path.join(root, "data/seeds/face-id-map.json"), "utf8")) } catch {}
  const confirmedAvailable = Object.keys(confirmed).filter(id => sourceIds.has(id))
  await fs.mkdir(path.join(root, "data/seeds"), { recursive: true })
  await fs.writeFile(path.join(root, "data/seeds/faces-assets-index.json"), `${JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    sourcePattern: "face_ID.png",
    configFile: relativePosix(facesConfig),
    configMappings: config.records.length,
    sourceImages: sourceFiles.length,
    confirmedMapEntries: Object.keys(confirmed).length,
    confirmedAvailable: confirmedAvailable.length,
    pendingMapEntries: Object.keys(confirmed).filter(id => !sourceIds.has(id)),
  }, null, 2)}\n`, "utf8")
  console.error(`[assets] faces encontradas: ${sourceFiles.length}`)
  return { configMappings: config.records.length, sourceImages: sourceFiles.length, confirmedMapEntries: Object.keys(confirmed).length, confirmedAvailable: confirmedAvailable.length }
}

if (!kitsDir && !facesDir) throw new Error("Informe --kits e/ou --faces")
const result = {}
if (kitsDir) result.kits = await importKits()
if (facesDir) result.faces = await indexFaces()
console.log(JSON.stringify(result, null, 2))
