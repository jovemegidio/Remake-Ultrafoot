// CONVERSOR PARA WEBP — imagem por imagem, com ensaio e relatório.
//
// O jogo carrega centenas de MB de imagem: 748 MB só em `public/`. PNG de fundo
// custa 10 a 30 VEZES o equivalente em WebP (medido aqui: calendario-bg saiu de
// 1.745 KB para 53 KB), e cada MB a menos é RAM que a WebView não precisa
// segurar — que é exatamente o que trava máquina modesta.
//
// ⚠️ CONVERTER NÃO É SUFICIENTE: o arquivo novo tem OUTRA EXTENSÃO, e quem
// aponta para `.png` no código para de achar. Este script NÃO mexe em código —
// ele converte, relata, e deixa o original no lugar. Trocar as referências e só
// então apagar o original é passo separado, de propósito: apagar antes de o
// código apontar para o novo arquivo é como se apaga um jogo em produção.
//
// Uso:
//   node scripts/converter-para-webp.mjs public/images            # ensaio
//   node scripts/converter-para-webp.mjs public/images --aplicar
//   node scripts/converter-para-webp.mjs public/escudos --aplicar --qualidade 90
//
// `--apagar-originais` só depois de o código já apontar para o `.webp`.

import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const args = process.argv.slice(2)
const alvo = args.find(a => !a.startsWith("--"))
const aplicar = args.includes("--aplicar")
const apagarOriginais = args.includes("--apagar-originais")
const qualidade = Number(args[args.indexOf("--qualidade") + 1]) || 82
// SEM PERDAS: o WebP resultante é pixel a pixel IDÊNTICO ao PNG de origem — não
// é "quase igual", é o mesmo bitmap com outro empacotamento. É o modo certo para
// escudo, uniforme e qualquer arte de borda dura, onde compressão com perda suja
// o contorno e aparece na hora. Rende menos que o modo com perda (tipicamente
// 20-40% em vez de 90%), mas não há o que discutir sobre qualidade.
//
// ⚠️ NÃO use sem perdas em cima de JPG: a origem já perdeu informação, e
// reempacotar sem perdas o RUÍDO da compressão anterior costuma gerar um arquivo
// MAIOR que o original.
const semPerdas = args.includes("--sem-perdas")

if (!alvo) {
  console.error("informe a pasta. ex: node scripts/converter-para-webp.mjs public/images --aplicar")
  process.exit(1)
}

const RAIZ = process.env.RAIZ_ULTRAFOOT ?? process.cwd()
const DIR = path.isAbsolute(alvo) ? alvo : path.join(RAIZ, alvo)
const CONVERSIVEIS = /\.(png|jpe?g)$/i

/** Anda a pasta inteira, inclusive subpastas. */
async function listar(dir) {
  const achados = []
  async function andar(atual) {
    let entradas
    try { entradas = await fs.readdir(atual, { withFileTypes: true }) } catch { return }
    for (const e of entradas) {
      const p = path.join(atual, e.name)
      if (e.isDirectory()) await andar(p)
      else if (CONVERSIVEIS.test(e.name)) achados.push(p)
    }
  }
  await andar(dir)
  return achados
}

const kb = n => Math.round(n / 1024)
const arquivos = await listar(DIR)
if (!arquivos.length) {
  console.log(`nenhum PNG/JPG em ${DIR}`)
  process.exit(0)
}

let origemTotal = 0, destinoTotal = 0, convertidos = 0, pulados = 0, falhas = 0
const maiores = []

for (const src of arquivos) {
  const dst = src.replace(CONVERSIVEIS, ".webp")
  const tamanhoOrigem = (await fs.stat(src)).size

  // Já existe WebP: não reconverte. Reconverter de um PNG que já foi substituído
  // só gasta tempo e pode PIORAR a imagem (recompressão em cima de perda).
  try {
    const jaTem = await fs.stat(dst)
    origemTotal += tamanhoOrigem
    destinoTotal += jaTem.size
    pulados++
    continue
  } catch { /* não existe: converte */ }

  try {
    // `alphaQuality` alto preserva a borda de escudo e logo, que é onde a perda
    // aparece primeiro. `effort: 5` equilibra tempo e tamanho em lote grande.
    const buffer = semPerdas
      ? await sharp(src).webp({ lossless: true, effort: 5 }).toBuffer()
      : await sharp(src).webp({ quality: qualidade, alphaQuality: 100, effort: 5 }).toBuffer()
    origemTotal += tamanhoOrigem
    destinoTotal += buffer.length
    convertidos++
    maiores.push({ nome: path.relative(DIR, src), de: tamanhoOrigem, para: buffer.length })
    if (aplicar) {
      await fs.writeFile(dst, buffer)
      if (apagarOriginais) await fs.rm(src, { force: true })
    }
  } catch (e) {
    falhas++
    console.error(`  FALHA ${path.relative(DIR, src)}: ${e.message}`)
  }
}

maiores.sort((a, b) => (b.de - b.para) - (a.de - a.para))
console.log(`\npasta: ${DIR}`)
console.log(`arquivos: ${arquivos.length}  convertidos: ${convertidos}  já tinham webp: ${pulados}  falhas: ${falhas}`)
console.log(`origem: ${kb(origemTotal)} KB  ->  webp: ${kb(destinoTotal)} KB  (${Math.round((1 - destinoTotal / Math.max(1, origemTotal)) * 100)}% menor)`)
if (maiores.length) {
  console.log("\nmaiores ganhos:")
  for (const m of maiores.slice(0, 10)) {
    console.log(`  ${String(kb(m.de)).padStart(6)} KB -> ${String(kb(m.para)).padStart(5)} KB   ${m.nome}`)
  }
}
if (!aplicar) console.log("\nENSAIO — nada foi gravado. Use --aplicar.")
else if (!apagarOriginais) console.log("\nOriginais MANTIDOS. Troque as referências no código e só então rode com --apagar-originais.")
