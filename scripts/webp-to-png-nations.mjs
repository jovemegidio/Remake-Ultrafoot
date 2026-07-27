// Converte os uniformes de selecao ja importados de webp -> png (padronizacao
// com os escudos). Resiliente a EBUSY (Drive/antivirus): converte TODOS primeiro,
// depois remove os webp best-effort com retry. O render usa .png, entao um webp
// que sobrar e so peso morto — nao quebra nada.
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const DIR = path.join(process.cwd(), "public/kits-nations")
const sleep = ms => new Promise(r => setTimeout(r, ms))

const webps = (await fs.readdir(DIR)).filter(f => f.endsWith(".webp"))
let convertidos = 0
for (const f of webps) {
  const dst = path.join(DIR, f.replace(/\.webp$/, ".png"))
  await sharp(path.join(DIR, f)).png().toFile(dst)
  convertidos++
}
// Remove os webp com ate 3 tentativas por arquivo.
let removidos = 0, presos = 0
for (const f of webps) {
  const src = path.join(DIR, f)
  let ok = false
  for (let i = 0; i < 3 && !ok; i++) {
    try { await fs.rm(src); ok = true; removidos++ } catch { await sleep(400) }
  }
  if (!ok) presos++
}
console.log(JSON.stringify({
  convertidos, removidos, websPresos: presos,
  png: (await fs.readdir(DIR)).filter(f => f.endsWith(".png")).length,
}))
