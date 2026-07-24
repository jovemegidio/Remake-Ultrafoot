// Escudos empacotados que NAO tem clube na base: sao acessos de graca. O
// escudo ja esta no instalador, so falta o clube existir no jogo.
import { allPoolTeams } from "../lib/teams-data"
import { allInternationalTeams } from "../lib/international-teams"
import { readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const todos = [...allInternationalTeams, ...allPoolTeams]
const chavesUsadas = new Set(todos.map(t => String(t.file_key ?? t.curto ?? "").toLowerCase()))

const base = join(process.cwd(), "public", "escudos")
for (const pasta of ["mls", "saudi_pro", "j_league", "liga_argentina", "championship"]) {
  const dir = join(base, pasta)
  if (!existsSync(dir)) { console.log(`${pasta}: sem pasta`); continue }
  const arquivos = readdirSync(dir).filter(f => f.endsWith(".png"))
  const orfaos = arquivos
    .map(f => f.replace(/\.png$/, ""))
    .filter(k => !chavesUsadas.has(k.toLowerCase()))
  console.log(`\n${pasta}: ${arquivos.length} escudos, ${orfaos.length} sem clube na base`)
  for (const o of orfaos) console.log(`   ${o}`)
}
