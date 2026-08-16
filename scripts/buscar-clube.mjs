// Busca clube no pool por NOME e por fileKey (os dois, porque um acha o que o
// outro nao acha: `qarabag_aze` guarda o estadio no campo `nome`).
//   node scripts/buscar-clube.mjs "aucas" "barcelona" ...
import { readFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const seed = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8"))
const norm = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

for (const alvo of process.argv.slice(2)) {
  const a = norm(alvo)
  const achados = seed.teams.filter(t => norm(t.nome).includes(a) || norm(t.fileKey ?? "").includes(a))
  console.log(`\n== ${alvo} == (${achados.length})`)
  for (const t of achados.slice(0, 25)) {
    console.log(`   ${t.fileKey}  "${t.nome}"  pais=${t.pais ?? ""} liga=${t.liga ?? ""}`)
  }
}
