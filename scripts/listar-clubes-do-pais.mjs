// Lista os clubes do pool de um pais, para conferir a mao os slugs que o
// casamento automatico recusou. Auxiliar de publicar-uniformes-pasta.mjs.
//
//   node scripts/listar-clubes-do-pais.mjs ING
import { readFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const alvo = (process.argv[2] ?? "").toUpperCase()

const PAISES = {
  ARG: { pais: ["argentina", "ar"], sufixos: ["arg", "ar"] },
  ITA: { pais: ["italia", "it"], sufixos: ["ita", "it"] },
  ESP: { pais: ["espanha", "es"], sufixos: ["esp"] },
  ING: { pais: ["inglaterra", "eng"], sufixos: ["ing", "eng"] },
  ALE: { pais: ["alemanha", "ger", "de"], sufixos: ["ale", "ger"] },
  FRA: { pais: ["franca", "fr"], sufixos: ["fra", "fr"] },
  POR: { pais: ["portugal", "pt"], sufixos: ["por", "pt"] },
  COL: { pais: ["colombia"], sufixos: ["col"] },
  EQU: { pais: ["equador"], sufixos: ["equ", "ecu"] },
  JAP: { pais: ["japao", "jpn"], sufixos: ["jap", "jpn"] },
  CHN: { pais: ["china", "chn"], sufixos: ["chn"] },
}
const norm = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

const p = PAISES[alvo]
if (!p) { console.error(`use um de: ${Object.keys(PAISES).join(", ")}`); process.exit(1) }

const seed = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf8"))
const lista = (seed.teams ?? [])
  .filter(t => t.fileKey && t.nome)
  .filter(t => p.pais.includes(norm(t.pais)) || p.sufixos.includes((t.fileKey.split("_").at(-1) ?? "").toLowerCase()))
  .sort((a, b) => a.nome.localeCompare(b.nome))

for (const t of lista) console.log(`${t.fileKey}\t${t.nome}`)
console.log(`\n${lista.length} clubes`)
