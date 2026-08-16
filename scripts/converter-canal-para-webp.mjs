// Converte para WEBP SEM PERDAS as imagens PNG que o canal ainda serve.
//
//   node scripts/converter-canal-para-webp.mjs --pasta "<png baixados>" \
//     --exportar troca.json [--forcar]
//
// ⚠️ SEM PERDAS DE VERDADE (`lossless: true`). O pedido foi "sem perder
// qualidade e propriedades": o bitmap sai IDENTICO e o canal alfa vai junto.
// Nao confundir com o webp q82 dos rostos, que e com perda de proposito (la a
// origem e foto e a economia e de 14x).
//
// ⚠️ E SO TROCA O QUE ENCOLHER. Medido em 05/08 e de novo aqui: no ESCUDO o PNG
// paletizado costuma ganhar do webp sem perdas — sao artes chapadas e
// monocromaticas, o caso em que a paleta e imbativel. Converter tudo por
// principio ENGORDARIA o canal, que e o oposto do pedido. Por isso cada imagem
// e comparada uma a uma e a maior fica de fora (o `--forcar` existe so para
// medir).
//
// A saida e o pacote que o trocar-imagens-por-webp.py aplica na VPS: para cada
// sha antigo, o data URL novo. A troca de sha muda a URL no manifesto, entao o
// cliente rebaixa a imagem — e por isso ela so vale a pena quando encolhe.

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : "" }
const pasta = arg("--pasta")
const saida = arg("--exportar")
const forcar = process.argv.includes("--forcar")
if (!pasta) {
  console.error('uso: --pasta "<pasta com os .png>" [--exportar troca.json] [--forcar]')
  process.exit(1)
}

const arquivos = readdirSync(pasta).filter(f => f.toLowerCase().endsWith(".png"))
const trocas = []
let antes = 0, depois = 0, mantidos = 0, bytesMantidos = 0

for (const f of arquivos) {
  const origem = path.join(pasta, f)
  const png = readFileSync(origem)
  // ⚠️ `effort: 4`. O 6 liga uma busca cara no plano de transparencia e chega a
  // 54x mais lento por 3% de bytes (medido em 06/08 nas camisas com alfa).
  const webp = await sharp(origem).webp({ lossless: true, effort: 4 }).toBuffer()

  antes += png.length
  if (webp.length < png.length || forcar) {
    depois += webp.length
    trocas.push({
      sha: f.replace(/\.png$/i, ""),
      data: `data:image/webp;base64,${webp.toString("base64")}`,
      de: png.length,
      para: webp.length,
    })
  } else {
    depois += png.length
    mantidos++
    bytesMantidos += png.length
  }
}

const mb = n => (n / 1024 / 1024).toFixed(1)
console.log(`${arquivos.length} PNG lidos`)
console.log(`  trocados por webp: ${trocas.length}`)
console.log(`  mantidos em PNG (o webp ficaria maior): ${mantidos}  (${mb(bytesMantidos)} MB)`)
console.log(`\n${mb(antes)} MB -> ${mb(depois)} MB  (economia ${mb(antes - depois)} MB, ${((1 - depois / antes) * 100).toFixed(1)}%)`)

// Conferencia obrigatoria: o webp sem perdas tem de devolver o MESMO bitmap.
// Barato, e e a unica prova de que "sem perder qualidade" foi cumprido.
if (trocas.length) {
  // ⚠️ `Buffer.equals` ACUSA DIFERENCA ONDE NAO HA. A libwebp reescreve o RGB
  // que fica DEBAIXO de pixel totalmente transparente (alfa 0) para comprimir
  // melhor — 51 mil pixels por escudo, todos invisiveis. O alfa em si e o RGB
  // de tudo que aparece saem identicos. Comparar o buffer cru reprovava 100%
  // das imagens; a conferencia certa e "todo pixel com alfa > 0 e igual, e o
  // canal alfa e igual em toda parte".
  const amostra = trocas.slice(0, 12)
  let visiveis = 0
  for (const t of amostra) {
    const a = await sharp(path.join(pasta, `${t.sha}.png`)).ensureAlpha().raw().toBuffer()
    const b = await sharp(Buffer.from(t.data.split(",")[1], "base64")).ensureAlpha().raw().toBuffer()
    if (a.length !== b.length) throw new Error(`${t.sha}: dimensao mudou`)
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] !== b[i + 3]) throw new Error(`${t.sha}: canal alfa mudou`)
      if (a[i + 3] === 0) continue
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
        throw new Error(`${t.sha}: pixel VISIVEL mudou — nao e sem perdas`)
      }
      visiveis++
    }
  }
  console.log(`\n${amostra.length} amostras conferidas: ${visiveis.toLocaleString("pt-BR")} pixels visiveis identicos, alfa intacto.`)
}

if (saida) {
  writeFileSync(saida, JSON.stringify({ trocas: trocas.map(({ sha, data }) => ({ sha, data })) }))
  console.log(`\nExportado para ${saida}`)
} else {
  console.log("\nEnsaio. Use --exportar <arquivo> para gravar o pacote de troca.")
}
