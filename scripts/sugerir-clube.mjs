// Sugere candidatos do pool para cada slug que o casamento automatico recusou.
//
//   node scripts/sugerir-clube.mjs ITA alcione altamura arzignano ...
//
// So SUGERE — a escolha continua sendo a mao, porque token em comum nao e prova
// ("Vitoria Sport Clube" x "Vitoria" tem token em comum e sao clubes diferentes).
import { readFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
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
  TODOS: null,
}
const norm = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

const [alvo, ...slugs] = process.argv.slice(2)
const p = PAISES[(alvo ?? "").toUpperCase()]
if (p === undefined) { console.error(`use um de: ${Object.keys(PAISES).join(", ")}`); process.exit(1) }

const seed = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf8"))
const lista = (seed.teams ?? []).filter(t => t.fileKey && t.nome)
  .filter(t => !p || p.pais.includes(norm(t.pais)) || p.sufixos.includes((t.fileKey.split("_").at(-1) ?? "").toLowerCase()))

for (const slug of slugs) {
  // Cada palavra do slug com 4+ letras vira uma sonda; basta uma bater.
  const sondas = slug.split(/[_\-]/).map(norm).filter(s => s.length >= 4)
  const hits = lista.filter(t => {
    const alvoN = norm(t.nome) + " " + norm(t.fileKey)
    return sondas.some(s => alvoN.includes(s) || s.includes(norm(t.nome)))
  })
  console.log(`\n${slug}:`)
  if (!hits.length) console.log("   (nada)")
  for (const h of hits.slice(0, 6)) console.log(`   ${h.fileKey}\t${h.nome}`)
}
