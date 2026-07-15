// Analisa (sem escrever nada) as diferencas entre o nome do clube NO JOGO e o nome NO CSV.
// Base para decidir o rename "conforme os CSVs".
//
// Uso: npx tsx scripts/analyze-club-names.ts

import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { allTeams } from "../lib/teams-data"

const SRC_DIR = path.resolve("Nova pasta/Elencos")

function norm(s: string) {
  return (s ?? "").replace(/^﻿/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
const CLUB_NAME_ALIAS: Record<string, string> = {
  bayernmunich: "Bayern München", hamburgersv: "Hamburgo SV", scpaderborn: "Paderborn 07",
  tsghoffenheim: "Hoffenheim", "1fcheidenheim": "Heidenheim", "1fckaiserslautern": "Kaiserslautern",
  "1fcmagdeburg": "Magdeburg", "1fcnurnberg": "FC Nürnberg", herthabsc: "Hertha Berlin",
  vflbochum: "Bochum", vflosnabruck: "Osnabrück", vflwolfsburg: "Wolfsburg",
}
function clubKey(s: string) {
  const alias = CLUB_NAME_ALIAS[norm(s)]
  if (alias) s = alias
  return norm(s).replace(/^(fc|cf|ac|as|rc|sc|ss|afc|rcd|ud|cd|sv|ogc|losc|stade)/, "").replace(/(fc|cf|cfc|ac|sc|afc|club)$/, "").replace(/^olympiquede/, "olympique")
}

function parseCsv(text: string, sep: string) {
  const rows: string[][] = []; let field = ""; let row: string[] = []; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false } else field += c }
    else if (c === '"') q = true
    else if (c === sep) { row.push(field); field = "" }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else if (c !== "\r") field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim() !== ""))
}

async function main() {
  // clubKey do jogo -> nome(s) do jogo (ignora reservas "II" e nomes vazios)
  const gameByKey = new Map<string, { nome: string; file_key: string }[]>()
  for (const t of allTeams) {
    if (/ II$/.test(t.nome)) continue
    const k = clubKey(t.nome)
    if (!gameByKey.has(k)) gameByKey.set(k, [])
    gameByKey.get(k)!.push({ nome: t.nome, file_key: t.file_key })
  }

  const files = (await readdir(SRC_DIR)).filter(f => f.toLowerCase().endsWith(".csv"))
  const seen = new Set<string>()
  let same = 0
  const diffs: { csv: string; game: string; file_key: string; liga: string }[] = []
  const unmatched: { csv: string; liga: string }[] = []
  const ambiguous: { csv: string; games: string }[] = []

  for (const file of files) {
    const text = await readFile(path.join(SRC_DIR, file), "utf8")
    const sep = (text.slice(0, text.indexOf("\n")).match(/;/g)?.length ?? 0) > (text.slice(0, text.indexOf("\n")).match(/,/g)?.length ?? 0) ? ";" : ","
    const rows = parseCsv(text, sep)
    const header = rows[0].map(norm)
    const idxClub = header.findIndex(h => h === "clube")
    const idxLiga = header.findIndex(h => h === "liga")
    if (idxClub < 0) continue
    for (const r of rows.slice(1)) {
      const club = (r[idxClub] ?? "").trim()
      const liga = idxLiga >= 0 ? (r[idxLiga] ?? "").trim() : ""
      if (!club) continue
      const key = clubKey(club)
      if (seen.has(key)) continue
      seen.add(key)
      const hits = gameByKey.get(key)
      if (!hits || !hits.length) { unmatched.push({ csv: club, liga }); continue }
      if (hits.length > 1) ambiguous.push({ csv: club, games: hits.map(h => h.nome).join(" | ") })
      const g = hits[0]
      if (g.nome === club) same++
      else diffs.push({ csv: club, game: g.nome, file_key: g.file_key, liga })
    }
  }

  console.log(`clubes distintos no CSV: ${seen.size}`)
  console.log(`ja com nome igual:       ${same}`)
  console.log(`nome DIFERENTE:          ${diffs.length}`)
  console.log(`nao casaram no jogo:     ${unmatched.length}`)
  console.log(`ambiguos (chave repetida): ${ambiguous.length}`)

  console.log(`\n=== NOMES A ATUALIZAR (jogo -> csv) ===`)
  for (const d of diffs.sort((a, b) => a.liga.localeCompare(b.liga))) {
    console.log(`  [${d.liga.padEnd(16)}] "${d.game}"  ->  "${d.csv}"   (${d.file_key})`)
  }
  if (unmatched.length) {
    console.log(`\n=== NAO CASARAM (ficam como estao) ===`)
    for (const u of unmatched.slice(0, 60)) console.log(`  [${u.liga}] ${u.csv}`)
    if (unmatched.length > 60) console.log(`  ...+${unmatched.length - 60}`)
  }
}

main()
