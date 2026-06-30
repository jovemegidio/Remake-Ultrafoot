import fs from "node:fs"
import path from "node:path"
const ROOT = "c:/dev/Ultrafoot/public/escudos"
const files = []
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name)
    if (e.isDirectory()) walk(f)
    else if (f.endsWith(".png")) {
      files.push("/" + path.relative("c:/dev/Ultrafoot/public", f).replace(/\\/g, "/"))
    }
  }
}
walk(ROOT)
for (const term of ["mirassol", "novorizontino", "trem", "limeira", "athleticclub", "athletic_mg", "saojose", "caxias", "guarany", "santacruz_pe", "santacruzpe"]) {
  console.log("---", term)
  for (const f of files) if (f.toLowerCase().includes(term.toLowerCase())) console.log("  ", f)
}
