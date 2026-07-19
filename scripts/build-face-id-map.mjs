// Converte uma exportação autorizada do FM26 em vínculos UID -> jogador do Ultrafoot.
// Aceita CSV/TSV com colunas: UID/Unique ID, Name/Nome, Age/Idade, Club/Clube.
// Só grava correspondências determinísticas de nome + idade + clube; ambiguidades viram relatório.
import fs from "node:fs/promises"
import path from "node:path"

const input = process.argv[2]
if (!input) throw new Error("Uso: node scripts/build-face-id-map.mjs <exportacao-fm26.csv>")

const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
const slug = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const parseLine = (line, separator) => {
  const values = []; let value = ""; let quoted = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index++; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === separator && !quoted) { values.push(value.trim()); value = ""; continue }
    value += char
  }
  values.push(value.trim()); return values
}

const imported = JSON.parse(await fs.readFile("data/seeds/imported-bf2026.json", "utf8"))
const index = new Map()
for (const team of imported.teams ?? []) {
  for (const player of team.jogadores ?? []) {
    // O destino é o ID interno estável do atleta. Assim dois homônimos nunca
    // compartilham foto e transferências não quebram o vínculo visual.
    const record = { name: player.nome, age: Number(player.idade), club: team.nome, slug: player.id || slug(`${player.nome}-${team.nome}`) }
    const key = `${normalize(record.name)}:${record.age}`
    index.set(key, [...(index.get(key) ?? []), record])
  }
}

const text = (await fs.readFile(input, "utf8")).replace(/^\uFEFF/, "")
const lines = text.split(/\r?\n/).filter(Boolean)
const separator = (lines[0].match(/\t/g)?.length ?? 0) > (lines[0].match(/;/g)?.length ?? 0) ? "\t" : lines[0].includes(";") ? ";" : ","
const headers = parseLine(lines.shift(), separator).map(normalize)
const column = (...names) => headers.findIndex(header => names.map(normalize).includes(header))
const uidColumn = column("uid", "unique id", "id unico", "identificador unico")
const nameColumn = column("name", "nome", "full name")
const ageColumn = column("age", "idade")
const clubColumn = column("club", "clube", "team", "time")
if (uidColumn < 0 || nameColumn < 0 || ageColumn < 0 || clubColumn < 0) throw new Error("Colunas obrigatórias ausentes: UID, Name, Age e Club")

const mapping = {}; const ambiguous = []; const unmatched = []
for (const line of lines) {
  const row = parseLine(line, separator)
  const uid = row[uidColumn]?.match(/\d+/)?.[0]
  if (!uid) continue
  const candidates = index.get(`${normalize(row[nameColumn])}:${Number(row[ageColumn])}`) ?? []
  const exactClub = candidates.filter(candidate => {
    const a = normalize(candidate.club), b = normalize(row[clubColumn])
    return a === b || (a.length >= 5 && b.includes(a)) || (b.length >= 5 && a.includes(b))
  })
  if (exactClub.length === 1) mapping[uid] = exactClub[0].slug
  else if (exactClub.length > 1 || candidates.length > 1) ambiguous.push({ uid, name: row[nameColumn], age: row[ageColumn], club: row[clubColumn], candidates })
  else unmatched.push({ uid, name: row[nameColumn], age: row[ageColumn], club: row[clubColumn] })
}

await fs.mkdir("data/seeds", { recursive: true })
await fs.writeFile("data/seeds/face-id-map.json", `${JSON.stringify(mapping, null, 2)}\n`)
await fs.writeFile("data/seeds/face-id-map-report.json", `${JSON.stringify({ matched: Object.keys(mapping).length, ambiguous, unmatched }, null, 2)}\n`)
console.log(JSON.stringify({ matched: Object.keys(mapping).length, ambiguous: ambiguous.length, unmatched: unmatched.length }))
