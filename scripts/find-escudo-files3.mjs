// Procura o melhor arquivo de escudo para cada file_key faltante
import fs from "node:fs"
import path from "node:path"
const ROOT = "c:/dev/Ultrafoot/public/escudos"
const files = []
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name)
    if (e.isDirectory()) walk(f)
    else if (f.endsWith(".png")) {
      files.push({
        rel: "/" + path.relative("c:/dev/Ultrafoot/public", f).replace(/\\/g, "/"),
        base: path.basename(e.name, ".png").toLowerCase(),
      })
    }
  }
}
walk(ROOT)

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

const keys = [
  "miirassol_sp", "vilago", "amazonas_am", "novorinzontino_sp",
  "remo_pa", "santacruz_pe", "sampaio_ma", "tombense_mg", "botafogo_pb",
  "aparecidense_go", "ferroviario_ce", "confianca_se", "voltaredonda_rj",
  "altos_pi", "floresta_ce", "ypiranga_rs", "saojose_rs", "athletic_mg",
  "caxias_rs", "river_pi", "inter_sp", "portovelho_ro", "trem_ap",
  "saoraimundo_am", "realnoroeste_es", "novaiguacu_rj", "motoclub_ma",
  "guarany_ce",
]

function bestMatch(key) {
  const nKey = norm(key)
  // 1) exact base match
  for (const f of files) if (norm(f.base) === nKey) return { file: f.rel, why: "exato" }
  // 2) base sem sufixo (sem o _XX no fim)
  const trimmed = nKey.replace(/[a-z]{1,3}$/, "")
  // 3) procura sub-string
  const candidates = files
    .map((f) => ({ ...f, n: norm(f.base) }))
    .filter((f) => f.n.includes(nKey) || nKey.includes(f.n))
  if (candidates.length === 1) return { file: candidates[0].rel, why: "unica substring" }
  if (candidates.length > 1) {
    // prefere os com _bra ou estado correspondente
    const stateFromKey = key.match(/_([a-z]{2})$/)?.[1] || ""
    const exactState = candidates.find((c) => c.n.includes(stateFromKey + "bra") || c.n.endsWith(stateFromKey))
    if (exactState) return { file: exactState.rel, why: "estado " + stateFromKey }
    return { file: candidates[0].rel, why: "primeiro de " + candidates.length, all: candidates.map((c) => c.rel) }
  }
  return null
}

for (const k of keys) {
  const m = bestMatch(k)
  if (!m) console.log(`${k.padEnd(30)} -> SEM ARQUIVO`)
  else console.log(`${k.padEnd(30)} -> ${m.file}  (${m.why})${m.all ? "  alt=" + m.all.join("|") : ""}`)
}
