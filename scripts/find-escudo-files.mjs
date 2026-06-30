// Procura arquivos de escudo que correspondam a um conjunto de file_keys
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..")
const ESCUDOS_DIR = path.join(ROOT, "public", "escudos")

const files = []
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (e.isFile() && full.endsWith(".png")) {
      const rel = "/" + path.relative(path.join(ROOT, "public"), full).replace(/\\/g, "/")
      files.push({ rel, base: path.basename(e.name, ".png").toLowerCase() })
    }
  }
}
walk(ESCUDOS_DIR)

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

const queries = [
  { key: "miirassol_sp", terms: ["mirassol"] },
  { key: "vilago", terms: ["vilanova", "vila_nova"] },
  { key: "amazonas_am", terms: ["amazonas"] },
  { key: "novorinzontino_sp", terms: ["novorizontino"] },
  { key: "remo_pa", terms: ["remo"] },
  { key: "santacruz_pe", terms: ["santacruz"] },
  { key: "sampaio_ma", terms: ["sampaio"] },
  { key: "tombense_mg", terms: ["tombense"] },
  { key: "botafogo_pb", terms: ["botafogopb", "botafogo_pb"] },
  { key: "aparecidense_go", terms: ["aparecidense"] },
  { key: "ferroviario_ce", terms: ["ferroviario"] },
  { key: "confianca_se", terms: ["confianca"] },
  { key: "voltaredonda_rj", terms: ["voltaredonda", "volta_redonda"] },
  { key: "altos_pi", terms: ["altos"] },
  { key: "floresta_ce", terms: ["floresta"] },
  { key: "ypiranga_rs", terms: ["ypiranga"] },
  { key: "saojose_rs", terms: ["saojose"] },
  { key: "athletic_mg", terms: ["athletic"] },
  { key: "caxias_rs", terms: ["caxias"] },
  { key: "river_pi", terms: ["riverpi", "river_pi"] },
  { key: "inter_sp", terms: ["interlimeira", "limeira", "inter_de_limeira", "inter_sp"] },
  { key: "portovelho_ro", terms: ["portovelho"] },
  { key: "trem_ap", terms: ["tremap", "trem_ap"] },
  { key: "saoraimundo_am", terms: ["saoraimundo"] },
  { key: "realnoroeste_es", terms: ["realnoroeste"] },
  { key: "novaiguacu_rj", terms: ["novaiguacu"] },
  { key: "motoclub_ma", terms: ["motoclub"] },
  { key: "guarany_ce", terms: ["guarany"] },
  { key: "monza", terms: ["monza"] },
]

for (const q of queries) {
  const matches = []
  for (const f of files) {
    const nf = norm(f.base)
    for (const t of q.terms) {
      if (nf.includes(norm(t))) {
        matches.push(f.rel)
        break
      }
    }
  }
  console.log(`${q.key.padEnd(30)} -> ${matches.slice(0, 5).join(", ") || "(NENHUM)"}`)
}
