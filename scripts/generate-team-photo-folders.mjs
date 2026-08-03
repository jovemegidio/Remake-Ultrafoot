import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const output = path.join(root, "Jogadores por Times")
const brasileiros = JSON.parse(await readFile(path.join(root, "data", "seeds", "teams_br.json"), "utf8"))
const importados = JSON.parse(await readFile(path.join(root, "data", "seeds", "imported-bf2026.json"), "utf8"))

const clubes = new Map()
const adicionar = (fileKey, nome, pais = "") => {
  if (typeof fileKey !== "string" || !/^[a-zA-Z0-9_-]+$/.test(fileKey)) return
  if (!clubes.has(fileKey)) clubes.set(fileKey, { nome: String(nome || fileKey), pais: String(pais || "") })
}

for (const liga of Object.values(brasileiros)) {
  if (!Array.isArray(liga)) continue
  for (const clube of liga) adicionar(clube.file_key, clube.nome, "Brasil")
}
for (const clube of importados.teams ?? []) adicionar(clube.fileKey, clube.nome, clube.pais)

await mkdir(output, { recursive: true })
const chaves = [...clubes.keys()]
// Em pastas sincronizadas (Google Drive/OneDrive), criar uma por vez leva vários
// minutos. Lotes moderados mantêm o processo rápido sem abrir milhares de I/Os.
for (let inicio = 0; inicio < chaves.length; inicio += 64) {
  await Promise.all(chaves.slice(inicio, inicio + 64).map(fileKey =>
    mkdir(path.join(output, fileKey), { recursive: true })))
}

const csv = ["file_key;clube;pais"]
for (const [fileKey, clube] of [...clubes].sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"))) {
  const campo = value => `"${String(value).replaceAll('"', '""')}"`
  csv.push([campo(fileKey), campo(clube.nome), campo(clube.pais)].join(";"))
}
await writeFile(path.join(output, "INDICE-DE-CLUBES.csv"), `${csv.join("\n")}\n`)
console.log(`pastas de clubes=${clubes.size}`)
