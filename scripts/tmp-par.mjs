import { writeFileSync } from "node:fs"
import sharp from "sharp"
const L = 240, FUNDO = { r: 255, g: 255, b: 255, alpha: 1 }
const arquivos = process.argv.slice(3)
const camadas = []
for (const [i, f] of arquivos.entries()) {
  camadas.push({ input: await sharp(f).resize(L, L, { fit: "contain", background: FUNDO }).flatten({ background: FUNDO }).png().toBuffer(), left: i * L, top: 0 })
  const nome = f.split(/[\/]/).pop().replace(/[<&>]/g, "").slice(0, 30)
  camadas.push({ input: await sharp(Buffer.from(`<svg width="${L}" height="22"><rect width="100%" height="100%" fill="white"/><text x="3" y="16" font-family="sans-serif" font-size="13" fill="#111">${nome}</text></svg>`)).png().toBuffer(), left: i * L, top: L })
}
writeFileSync(process.argv[2], await sharp({ create: { width: L * arquivos.length, height: L + 22, channels: 3, background: FUNDO } }).composite(camadas).png().toBuffer())
