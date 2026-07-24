// Escudos locais para os clubes da LigaPro (Equador). O sortitoutsi nao traz
// escudo de clube e o jogo exige escudo local (qa-smoke). Gera um crest limpo
// com as cores do clube + a sigla — nao e o oficial, mas some o generico e a
// liga fica apresentavel. Grava em public/escudos/<file_key>.png, que e o
// caminho padrao de getLocalEscudoPath (sem precisar mexer no escudos-map).
//
// Para trocar pelos oficiais depois: baixar do Transfermarkt e sobrepor.

import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const OUT = path.join(process.cwd(), "public/escudos")
await fs.mkdir(OUT, { recursive: true })

// file_key, sigla, cor de fundo, cor de detalhe (iguais aos do time em international-teams)
const TIMES = [
  ["independiente_del_valle", "IDV", "#1B1B1B", "#0B5CA5"],
  ["ldu_quito", "LDU", "#FFFFFF", "#0B2A5B"],
  ["barcelona_sc", "BSC", "#FDE100", "#D9231F"],
  ["emelec", "EME", "#0B4DA2", "#FFFFFF"],
  ["aucas", "AUC", "#D9231F", "#FDE100"],
  ["cd_universidad_catolica", "UCA", "#0B4DA2", "#FFFFFF"],
  ["deportivo_cuenca", "DCU", "#D9231F", "#FFFFFF"],
  ["delfin_sc", "DEL", "#0B2A5B", "#FFFFFF"],
  ["orense", "ORE", "#0B7C3F", "#FFFFFF"],
  ["macara", "MAC", "#0B4DA2", "#FFFFFF"],
  ["tecnico_universitario", "TEC", "#D9231F", "#FFFFFF"],
  ["mushuc_runa", "MUS", "#0B7C3F", "#FDE100"],
  ["libertad_fc", "LIB", "#0B7C3F", "#FFFFFF"],
  ["manta", "MAN", "#0B7C3F", "#FFFFFF"],
  ["guayaquil_city", "GYC", "#0B4DA2", "#FFFFFF"],
  ["leones_del_norte", "LEO", "#D9231F", "#FDE100"],
]

// Cor de texto legivel sobre o fundo (preto/branco por luminancia).
function textoSobre(hex) {
  const n = hex.replace("#", "")
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? "#111111" : "#FFFFFF"
}

let feitos = 0
for (const [fileKey, sigla, cor1, cor2] of TIMES) {
  const txt = textoSobre(cor1)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs><clipPath id="c"><circle cx="128" cy="128" r="120"/></clipPath></defs>
    <circle cx="128" cy="128" r="124" fill="${cor2}"/>
    <circle cx="128" cy="128" r="112" fill="${cor1}"/>
    <circle cx="128" cy="128" r="112" fill="none" stroke="${cor2}" stroke-width="6"/>
    <text x="128" y="128" fill="${txt}" font-family="Arial, sans-serif" font-size="72"
          font-weight="700" text-anchor="middle" dominant-baseline="central">${sigla}</text>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${fileKey}.png`))
  feitos++
}
console.log(JSON.stringify({ escudosGerados: feitos, pasta: "public/escudos" }))
