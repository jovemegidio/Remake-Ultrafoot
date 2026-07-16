// Renomeia os clubes CURADOS conforme os CSVs (acentos + nomes oficiais).
//
// Usa o alias APENAS para achar a correspondencia CSV<->curado; depois grava o nome do CSV
// direto na fonte (international-teams.ts / teams-data.ts), ancorado no file_key. Como o
// getTeamByShort devolve o time cru, editar a fonte e o que muda o nome em TODO o jogo.
//
// Uso: npx tsx scripts/apply-club-names.ts [--apply]
//   sem --apply: so mostra o que mudaria.

import { readFile, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
import { allTeams } from "../lib/teams-data"

const APPLY = process.argv.includes("--apply")
// Colisoes de clubKey entre ligas: NAO renomear (o CSV de um pais casou com um clube de
// outro). Ex.: "Guarani" (Campinas/BR) x "Guaraní" (Paraguai) normalizam para a mesma chave.
const SKIP_FILE_KEYS = new Set([
  "guaranisp_bra", // Guarani (Campinas/BR) x Guaraní (Paraguai)
  "vitoria",       // Vitoria (Salvador/BA/BR) x Vitória SC (Portugal)
])
const SRC_DIR = path.resolve("Nova pasta/Elencos")
const FILES = [path.resolve("lib/international-teams.ts"), path.resolve("lib/teams-data.ts")]

function norm(s: string) {
  return (s ?? "").replace(/^﻿/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}
// Alias so para CASAR (CSV -> nome atual no jogo). Nao vai pro arquivo.
const MATCH_ALIAS: Record<string, string> = {
  bayernmunich: "Bayern Munich", hamburgersv: "Hamburgo SV", scpaderborn: "Paderborn 07",
  tsghoffenheim: "Hoffenheim", "1fcheidenheim": "Heidenheim", "1fckaiserslautern": "Kaiserslautern",
  "1fcmagdeburg": "Magdeburg", "1fcnurnberg": "1. FC Nurnberg", herthabsc: "Hertha Berlin",
  vflbochum: "Bochum", vflosnabruck: "VfL Osnabruck", vflwolfsburg: "Wolfsburg",
}
function clubKey(s: string) {
  const alias = MATCH_ALIAS[norm(s)]
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
  // clubKey do jogo -> time curado (ignora reservas "II")
  const gameByKey = new Map<string, { nome: string; file_key: string }>()
  for (const t of allTeams) {
    if (/ II$/.test(t.nome)) continue
    const k = clubKey(t.nome)
    if (!gameByKey.has(k)) gameByKey.set(k, { nome: t.nome, file_key: t.file_key })
  }

  const files = (await readdir(SRC_DIR)).filter(f => f.toLowerCase().endsWith(".csv"))
  const seen = new Set<string>()
  const renames: { file_key: string; old: string; neu: string }[] = []

  for (const file of files) {
    const text = await readFile(path.join(SRC_DIR, file), "utf8")
    const first = text.slice(0, text.indexOf("\n"))
    const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ","
    const rows = parseCsv(text, sep)
    const header = rows[0].map(norm)
    const idxClub = header.findIndex(h => h === "clube")
    if (idxClub < 0) continue
    for (const r of rows.slice(1)) {
      const club = (r[idxClub] ?? "").trim()
      if (!club) continue
      const key = clubKey(club)
      if (seen.has(key)) continue
      seen.add(key)
      const g = gameByKey.get(key)
      if (!g || g.nome === club || SKIP_FILE_KEYS.has(g.file_key)) continue
      renames.push({ file_key: g.file_key, old: g.nome, neu: club })
    }
  }

  console.log(`renames a aplicar: ${renames.length}`)
  for (const r of renames) console.log(`  "${r.old}"  ->  "${r.neu}"   (${r.file_key})`)

  if (!APPLY) { console.log(`\n(dry-run) rode com --apply para gravar.`); return }

  // Patch: para cada arquivo, acha `file_key: "<fk>"` e troca o `nome: "..."` mais proximo antes.
  let done = 0
  const warn: string[] = []
  for (const fp of FILES) {
    let content = await readFile(fp, "utf8")
    for (const r of renames) {
      const anchor = `file_key: "${r.file_key}"`
      const at = content.indexOf(anchor)
      if (at < 0) continue
      const nomeStart = content.lastIndexOf('nome: "', at)
      if (nomeStart < 0) { warn.push(`${r.file_key}: nome nao achado`); continue }
      const valStart = nomeStart + 'nome: "'.length
      const valEnd = content.indexOf('"', valStart)
      const cur = content.slice(valStart, valEnd)
      if (cur !== r.old) { warn.push(`${r.file_key}: nome atual "${cur}" != esperado "${r.old}" — pulado`); continue }
      content = content.slice(0, valStart) + r.neu + content.slice(valEnd)
      done++
    }
    await writeFile(fp, content, "utf8")
  }
  console.log(`\naplicados: ${done}/${renames.length}`)
  for (const w of warn) console.log(`  ! ${w}`)
}

main()
