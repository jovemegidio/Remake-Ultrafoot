// Folha de contato: escudo do EDITOR ao lado do que o canal serve, para os
// clubes que voce listar. Companheiro do comparar-escudos-editor-canal.mjs —
// aquele ORDENA por diferenca, este mostra, que e o unico passo que decide se a
// diferenca e "outra arte do mesmo clube" ou "outro clube".
//
//   node scripts/folha-escudos-editor-canal.mjs --manifesto elencos.json \
//     --clubes santos,flarj,flurj --saida folha.png
import { readFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import https from "node:https"
import sharp from "sharp"

const args = process.argv.slice(2)
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const SAVE = opt("--save") ?? path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "com.ultrafoot.remake", "ultrafoot-clubs.json")
const MANIFESTO = opt("--manifesto")
const CLUBES = (opt("--clubes") ?? "").split(",").map(s => s.trim()).filter(Boolean)
const SAIDA = opt("--saida") ?? "folha.png"
if (!MANIFESTO || !CLUBES.length) {
  console.error('uso: --manifesto <elencos.json> --clubes a,b,c [--saida folha.png]')
  process.exit(1)
}

const FUNDO = { r: 255, g: 255, b: 255, alpha: 1 }
const L = 120, COLS = 6, LARG = L * 2 + 12, ALT = L + 18

const baixar = (url) => new Promise((ok, err) => {
  https.get(url, (r) => {
    const p = []
    r.on("data", d => p.push(d))
    r.on("end", () => ok(Buffer.concat(p)))
  }).on("error", err)
})
const quadro = async (buf) => sharp(buf)
  .resize(L, L, { fit: "contain", background: FUNDO })
  .flatten({ background: FUNDO }).png().toBuffer()

const save = JSON.parse(await readFile(SAVE, "utf8"))
const manifesto = JSON.parse(await readFile(MANIFESTO, "utf8"))

const comp = []
let i = 0
for (const fileKey of CLUBES) {
  const dataUrl = save[`ultrafoot:logo:${fileKey}`]
  const url = manifesto.times?.[fileKey]?.logoUrl
  if (!dataUrl || !url) { console.error(`  sem par para ${fileKey}`); continue }
  const x = (i % COLS) * LARG, y = Math.floor(i / COLS) * ALT
  comp.push({ input: await quadro(Buffer.from(String(dataUrl).split(",").pop(), "base64")), left: x, top: y })
  comp.push({ input: await quadro(await baixar(url)), left: x + L + 12, top: y })
  comp.push({
    input: Buffer.from(`<svg width="${LARG}" height="16"><text x="${LARG / 2}" y="12" font-size="10" text-anchor="middle" font-family="sans-serif">${fileKey}  editor | no ar</text></svg>`),
    left: x, top: y + L,
  })
  i++
}
const linhas = Math.max(1, Math.ceil(i / COLS))
await sharp({ create: { width: LARG * Math.min(COLS, i || 1), height: ALT * linhas, channels: 3, background: FUNDO } })
  .composite(comp).png().toFile(path.resolve(SAIDA))
console.log(`${i} pares em ${path.resolve(SAIDA)}`)
