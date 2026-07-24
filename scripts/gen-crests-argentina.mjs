// Escudos locais para os 10 clubes que completam a Primera argentina. Mesmo
// padrao do Equador (crest limpo com cores + sigla); trocar pelos oficiais
// (Transfermarkt) depois. Grava em public/escudos/<file_key>.png.
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const OUT = path.join(process.cwd(), "public/escudos")
await fs.mkdir(OUT, { recursive: true })

const TIMES = [
  ["argentinos_jrs", "AAAJ", "#D01317", "#FFFFFF"],
  ["platense", "PLA", "#6B4226", "#FFFFFF"],
  ["sarmiento", "SAR", "#006633", "#FFFFFF"],
  ["aldosivi", "ALD", "#F7E017", "#006633"],
  ["instituto_acc", "INS", "#D01317", "#FFFFFF"],
  ["defensa_y_justicia", "DYJ", "#F7E017", "#006633"],
  ["independiente_rivadavia", "IRI", "#0B4DA2", "#FFFFFF"],
  ["deportivo_riestra", "RIE", "#000000", "#FFFFFF"],
  ["union_santa_fe", "UNI", "#D01317", "#FFFFFF"],
  ["central_cordoba", "CCO", "#000000", "#FFFFFF"],
]

function textoSobre(hex) {
  const n = hex.replace("#", "")
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#111111" : "#FFFFFF"
}

let feitos = 0
for (const [fileKey, sigla, cor1, cor2] of TIMES) {
  const txt = textoSobre(cor1)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <circle cx="128" cy="128" r="124" fill="${cor2}"/>
    <circle cx="128" cy="128" r="112" fill="${cor1}"/>
    <circle cx="128" cy="128" r="112" fill="none" stroke="${cor2}" stroke-width="6"/>
    <text x="128" y="128" fill="${txt}" font-family="Arial, sans-serif" font-size="${sigla.length > 3 ? 56 : 72}"
          font-weight="700" text-anchor="middle" dominant-baseline="central">${sigla}</text>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${fileKey}.png`))
  feitos++
}
console.log(JSON.stringify({ escudosGerados: feitos }))
