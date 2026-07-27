import { createHash } from "node:crypto"
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = path.resolve(process.argv[2] ?? path.join(root, "Estadios"))
const output = path.join(root, "public", "stadiums")
const manifestPath = path.join(output, "manifest.json")

const keyOf = value => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("en-US")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()

const files = (await readdir(source, { withFileTypes: true }))
  .filter(entry => entry.isFile() && /\.(png|jpe?g|webp|avif)$/i.test(entry.name))
  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

await mkdir(output, { recursive: true })

let manifest = {}
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"))
} catch {
  // Primeira importacao: o manifesto ainda nao existe ou esta invalido.
}
const imports = []
for (const entry of files) {
  const extension = path.extname(entry.name).toLowerCase()
  const original = path.basename(entry.name, extension)
  const key = keyOf(original)
  if (!key) continue
  const slug = key.replace(/ /g, "-").slice(0, 80)
  const suffix = createHash("sha1").update(entry.name).digest("hex").slice(0, 8)
  const targetName = `${slug}-${suffix}${extension}`
  imports.push([path.join(source, entry.name), path.join(output, targetName)])
  const targetUrl = `/stadiums/${targetName}`
  const aliases = new Set([
    key,
    key.replace(/^arena (do |da |de )?/, ""),
    keyOf(original.replace(/\([^)]*\)/g, " ")),
    ...[...original.matchAll(/\(([^)]+)\)/g)].flatMap(match => [
      keyOf(match[1]),
      keyOf(match[1].replace(/\bestadio\b/gi, " ")),
    ]),
  ])
  for (const alias of aliases) {
    if (alias) manifest[alias] = targetUrl
  }
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
async function copyWithRetry(from, to) {
  let lastError
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await copyFile(from, to)
      return
    } catch (error) {
      lastError = error
      if (!new Set(["EBUSY", "EPERM", "EACCES"]).has(error?.code)) throw error
      await wait(200 * (attempt + 1))
    }
  }
  throw lastError
}

// Drive sincronizado fica muito lento em copia serial. Lotes mantem o importador rapido
// sem abrir os 1.700 arquivos ao mesmo tempo (o que estouraria handles no Windows).
for (let index = 0; index < imports.length; index += 24) {
  await Promise.all(imports.slice(index, index + 24).map(([from, to]) => copyWithRetry(from, to)))
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
console.log(`Imported ${imports.length} stadium photos (${Object.keys(manifest).length} indexed) into ${output}`)
