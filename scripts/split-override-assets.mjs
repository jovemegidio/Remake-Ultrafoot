// Tira as imagens base64 de dentro de team-overrides.json e grava como arquivos
// em public/, deixando no JSON apenas o caminho.
//
// POR QUE: team-overrides.json tinha 20,1 MB — 199 imagens embutidas como data
// URI. E ele é importado ESTATICAMENTE por components/team-crest.tsx, que
// aparece em praticamente toda tela com escudo. Resultado: todo carregamento de
// página baixava, parseava e segurava 20 MB de JSON na memória só para desenhar
// um escudo. Era a causa principal da lentidão relatada.
//
// Como arquivo, o navegador busca só o escudo que a tela precisa, em paralelo,
// e ainda guarda em cache. Nada se perde: os escudos importados continuam
// embutidos no build, agora em public/ em vez de dentro do JS.
//
//   node scripts/split-override-assets.mjs
//
// Idempotente: entradas que já viraram caminho são ignoradas.

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const JSON_PATH = path.resolve("data/seeds/team-overrides.json")
const BACKUP = path.resolve("data/seeds/team-overrides.inline-backup.json")
const ASSET_DIR = path.resolve("public/overrides")
const PUBLIC_PREFIX = "/overrides"

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" }

let escritos = 0, bytesAntes = 0, bytesDepois = 0

async function extrair(dataUri, nomeBase) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUri)
  if (!m) return null
  const buf = Buffer.from(m[2], "base64")
  const ext = EXT[m[1]] ?? "png"
  const file = `${nomeBase}.${ext}`
  await writeFile(path.join(ASSET_DIR, file), buf)
  escritos++
  bytesAntes += dataUri.length
  bytesDepois += buf.length
  return `${PUBLIC_PREFIX}/${file}`
}

/** Troca in-place todo data URI por um caminho. Devolve o objeto alterado. */
async function processar(entry, key) {
  if (typeof entry?.logoUrl === "string" && entry.logoUrl.startsWith("data:")) {
    const p = await extrair(entry.logoUrl, `${key}-logo`)
    if (p) entry.logoUrl = p
  }
  for (const slot of ["home", "away", "third"]) {
    const kit = entry?.kits?.[slot]
    if (typeof kit?.imageUrl === "string" && kit.imageUrl.startsWith("data:")) {
      const p = await extrair(kit.imageUrl, `${key}-kit-${slot}`)
      if (p) kit.imageUrl = p
    }
  }
  return entry
}

async function main() {
  const antes = (await readFile(JSON_PATH)).length
  const data = JSON.parse(await readFile(JSON_PATH, "utf8"))

  // Backup só na primeira vez: rodar de novo não pode sobrescrever o original
  // com uma versão já sem as imagens.
  if (!existsSync(BACKUP)) await copyFile(JSON_PATH, BACKUP)
  await mkdir(ASSET_DIR, { recursive: true })

  for (const [key, entry] of Object.entries(data)) await processar(entry, key)

  await writeFile(JSON_PATH, JSON.stringify(data, null, 1))
  const depois = (await readFile(JSON_PATH)).length

  const mb = n => (n / 1048576).toFixed(2) + " MB"
  console.log(`imagens extraidas : ${escritos}  -> ${path.relative(process.cwd(), ASSET_DIR)}`)
  console.log(`base64 -> binario : ${mb(bytesAntes)} -> ${mb(bytesDepois)}`)
  console.log(`team-overrides.json: ${mb(antes)} -> ${mb(depois)}`)
  console.log(`\nbackup do original: ${path.basename(BACKUP)}`)
}

main()
