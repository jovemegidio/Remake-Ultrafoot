// AFINA UM LOTE DE ESCUDOS ANTES DE SUBIR: só o que muda, e em WebP.
//
//   node scripts/afinar-lote-de-escudos.mjs --lote escudos.json \
//     --manifesto elencos.json [--forcar chaves.json] --exportar lote-final.json
//
// O `publicar-escudos-pasta.mjs` varre a PASTA INTEIRA e exporta todo clube que
// casou — hoje 719 chaves. Subir isso inteiro tem dois custos que não aparecem
// em erro nenhum:
//
// ⚠️ 1. O CANAL JÁ ESTÁ EM WEBP (troca de 15/08: 60,3 -> 29,0 MB) e este
//    exportador grava PNG paletizado. Republicar as 700 chaves que já estavam
//    lá trocaria WebP por PNG — o canal engorda e TODO cliente rebaixa de novo
//    as imagens, porque a URL termina no sha e o sha mudou.
//
// ⚠️ 2. Escudo republicado é escudo re-decidido. Cada substituição é uma chance
//    de repetir o Santos-Laguna de 06/08 (arte de outro clube derrubando a
//    certa, que o canal VENCE o embutido). Quem não mudou não deve ser tocado.
//
// Então passa: chave que o canal ainda NÃO tem escudo (ganho puro) e chave
// listada em `--forcar` (arquivo novo na pasta, ou seja arte que o usuário
// acabou de acrescentar de propósito). O resto fica de fora.
//
// A conversão para WebP é SEM PERDAS e só vale se encolher — escudo chapado e
// monocromático é justamente o caso em que a paleta do PNG ganha.

import { readFileSync, writeFileSync } from "node:fs"
import sharp from "sharp"

const arg = (n, padrao = "") => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : padrao
}

const lotePath = arg("--lote")
const manifestoPath = arg("--manifesto")
const forcarPath = arg("--forcar")
const saida = arg("--exportar")
if (!lotePath || !manifestoPath || !saida) {
  console.error("uso: --lote x.json --manifesto elencos.json [--forcar chaves.json] --exportar y.json")
  process.exit(1)
}

const lote = JSON.parse(readFileSync(lotePath, "utf-8"))
const manifesto = JSON.parse(readFileSync(manifestoPath, "utf-8"))
const forcar = new Set(forcarPath ? JSON.parse(readFileSync(forcarPath, "utf-8")) : [])

const jaTem = new Set(
  Object.entries(manifesto.times || {}).filter(([, t]) => t?.logoUrl).map(([fk]) => fk),
)

const clubes = []
let novos = 0, substituicoes = 0, pulados = 0
let bytesPng = 0, bytesFinal = 0, viraramWebp = 0

for (const item of lote.clubes || []) {
  const temEscudo = jaTem.has(item.file_key)
  const forcado = forcar.has(item.file_key)
  if (temEscudo && !forcado) { pulados++; continue }

  const m = /^data:image\/([a-z]+);base64,(.+)$/s.exec(item.escudo_data || "")
  if (!m) { console.warn(`sem data URL: ${item.file_key}`); continue }
  const bruto = Buffer.from(m[2], "base64")
  bytesPng += bruto.length

  let dados = item.escudo_data
  let final = bruto
  if (m[1] !== "webp") {
    const webp = await sharp(bruto).webp({ lossless: true, effort: 4 }).toBuffer()
    if (webp.length < bruto.length) {
      dados = `data:image/webp;base64,${webp.toString("base64")}`
      final = webp
      viraramWebp++
    }
  }
  bytesFinal += final.length

  clubes.push({ file_key: item.file_key, escudo_data: dados })
  if (temEscudo) substituicoes++
  else novos++
}

writeFileSync(saida, JSON.stringify({ clubes }, null, 1))

const kb = (b) => (b / 1024).toFixed(0)
console.log(`entrada: ${(lote.clubes || []).length} chaves`)
console.log(`  ficam ${clubes.length}  (${novos} clube que ainda NAO tinha escudo, ${substituicoes} substituicao pedida por --forcar)`)
console.log(`  pulados ${pulados} (ja publicados e sem arte nova)`)
console.log(`  webp venceu em ${viraramWebp}/${clubes.length}: ${kb(bytesPng)} -> ${kb(bytesFinal)} KB`)
if (substituicoes) {
  console.log("\nSUBSTITUEM escudo ja publicado (confira um a um antes de subir):")
  for (const c of clubes) if (jaTem.has(c.file_key)) console.log(`   ${c.file_key}`)
}
console.log(`\nExportado para ${saida}`)
