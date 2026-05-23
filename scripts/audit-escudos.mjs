// Auditoria automatica de escudos
// Cruza file_keys usados em teams-data.ts / international-teams.ts contra:
//  - localEscudoMap em escudos-map.ts
//  - arquivos PNG em public/escudos/**
// Reporta:
//  - file_keys sem entrada em localEscudoMap (caem em fallback remoto)
//  - file_keys que apontam para um arquivo inexistente
//  - entradas em localEscudoMap nao usadas por nenhum time
//  - file_keys cujo "curto"/nome do time diverge fortemente do nome do arquivo (suspeitos)

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..")

const TEAMS_FILE = path.join(ROOT, "lib", "teams-data.ts")
const INTL_FILE = path.join(ROOT, "lib", "international-teams.ts")
const ESCUDOS_MAP_FILE = path.join(ROOT, "lib", "escudos-map.ts")
const ESCUDOS_DIR = path.join(ROOT, "public", "escudos")

// --- 1. Coletar todos os arquivos PNG existentes em public/escudos ---
const existingFiles = new Set()
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.isFile()) {
      const rel = "/" + path.relative(path.join(ROOT, "public"), full).replace(/\\/g, "/")
      existingFiles.add(rel)
    }
  }
}
walk(ESCUDOS_DIR)

// --- 2. Parsear team objects (nome, curto, file_key, divisao) ---
function parseTeams(filePath) {
  const src = fs.readFileSync(filePath, "utf8")
  const teams = []
  const re = /\{\s*([^{}]*?)\}/gs
  for (const m of src.matchAll(re)) {
    const body = m[1]
    if (!body.includes("file_key")) continue
    const get = (k) => {
      const r = new RegExp(`${k}\\s*:\\s*"([^"]*)"`)
      const mm = body.match(r)
      return mm ? mm[1] : null
    }
    const file_key = get("file_key")
    if (!file_key) continue
    teams.push({
      nome: get("nome"),
      curto: get("curto"),
      file_key,
      divisao: get("divisao"),
      pais: get("pais"),
      source: path.basename(filePath),
    })
  }
  return teams
}
const teams = [...parseTeams(TEAMS_FILE), ...parseTeams(INTL_FILE)]

// --- 3. Parsear localEscudoMap ---
function parseLocalMap() {
  const src = fs.readFileSync(ESCUDOS_MAP_FILE, "utf8")
  // pega o bloco do localEscudoMap
  const start = src.indexOf("const localEscudoMap")
  const end = src.indexOf("export function getEscudoUrl", start)
  const block = src.slice(start, end)
  const re = /"([^"]+)"\s*:\s*"([^"]+)"/g
  const map = {}
  for (const m of block.matchAll(re)) {
    map[m[1]] = m[2]
  }
  return map
}
const localMap = parseLocalMap()

// --- 4. Auditoria ---
const missingInMap = []
const fileNotFound = []
const nameMismatchSuspect = []

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "")

for (const team of teams) {
  const mapped = localMap[team.file_key]
  if (!mapped) {
    missingInMap.push(team)
    continue
  }
  if (!existingFiles.has(mapped)) {
    fileNotFound.push({ ...team, mapped })
    continue
  }
  // Verifica se nome do arquivo bate minimamente com o nome do time
  const fileName = path.basename(mapped, path.extname(mapped))
  const nNome = norm(team.nome)
  const nCurto = norm(team.curto)
  const nFile = norm(fileName)
  const nKey = norm(team.file_key)
  const looksOk =
    nFile.includes(nNome) ||
    nNome.includes(nFile) ||
    nFile.includes(nCurto) ||
    nFile.includes(nKey) ||
    nKey.includes(nFile)
  if (!looksOk && nNome && nFile) {
    nameMismatchSuspect.push({ ...team, mapped, fileName })
  }
}

const usedKeys = new Set(teams.map((t) => t.file_key))
const unusedMapEntries = Object.keys(localMap).filter((k) => !usedKeys.has(k))

// --- 5. Output ---
const out = []
const line = (s) => out.push(s)

line("=".repeat(80))
line("RELATORIO DE AUDITORIA DE ESCUDOS")
line("=".repeat(80))
line(`Times totais analisados : ${teams.length}`)
line(`Entradas em localEscudoMap : ${Object.keys(localMap).length}`)
line(`Arquivos PNG em /public/escudos : ${existingFiles.size}`)
line("")

line(`--- [1] FILE_KEYS SEM MAPEAMENTO LOCAL (caem em fallback remoto, podem nao carregar offline): ${missingInMap.length}`)
for (const t of missingInMap.slice(0, 200)) {
  line(`  - ${t.file_key.padEnd(35)} | ${t.nome || "?"} (${t.divisao || t.pais || "?"}) [${t.source}]`)
}
if (missingInMap.length > 200) line(`  ... +${missingInMap.length - 200} mais`)
line("")

line(`--- [2] FILE_KEYS QUE APONTAM PRA ARQUIVO INEXISTENTE (CRITICO - escudo nao renderiza): ${fileNotFound.length}`)
for (const t of fileNotFound) {
  line(`  - ${t.file_key.padEnd(35)} | ${t.nome || "?"} -> ${t.mapped} [NAO EXISTE]`)
}
line("")

line(`--- [3] NOMES DE ARQUIVO SUSPEITOS (file batendo mal com nome do time - pode ser escudo trocado): ${nameMismatchSuspect.length}`)
for (const t of nameMismatchSuspect) {
  line(`  - ${t.file_key.padEnd(35)} | ${t.nome} (${t.curto}) -> ${t.mapped}`)
}
line("")

line(`--- [4] ENTRADAS EM localEscudoMap NAO USADAS POR NENHUM TIME: ${unusedMapEntries.length}`)
for (const k of unusedMapEntries) {
  line(`  - ${k} -> ${localMap[k]}`)
}

console.log(out.join("\n"))
fs.writeFileSync(path.join(__dirname, "audit-escudos-report.txt"), out.join("\n"), "utf8")
console.log("\n--> Relatorio salvo em scripts/audit-escudos-report.txt")
