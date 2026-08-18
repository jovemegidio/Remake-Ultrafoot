// CONVERTE UM ACERVO INTEIRO PARA WEBP — e leva as REFERÊNCIAS junto.
//
// ⚠️ POR QUE ESTE EXISTE, SE JÁ HÁ `converter-para-webp.mjs`. Aquele converte e
// para ali, de propósito: deixa o original no lugar e não toca em código. É a
// ferramenta certa para experimentar. Ela não serve para migrar um acervo, e a
// razão está no cabeçalho dela mesma — "o arquivo novo tem OUTRA EXTENSÃO, e
// quem aponta para `.png` para de achar".
//
// Este aqui fecha o ciclo, na única ordem que não quebra o jogo no meio:
//
//   1. converte cada PNG/JPG para WebP AO LADO do original;
//   2. reescreve as referências (`.png` → `.webp`) nos arquivos indicados;
//   3. confere que toda referência nova aponta para um arquivo que EXISTE;
//   4. só então apaga os originais — e só se o passo 3 passou inteiro.
//
// Se o passo 3 falhar, nada é apagado e o jogo continua com os PNG, que ainda
// estão lá. É a diferença entre uma migração e uma perda de acervo.
//
// Uso:
//   node scripts/converter-acervo-para-webp.mjs <pasta> [--refs a.json,b.json] [--apagar]
//
//   node scripts/converter-acervo-para-webp.mjs public/stadiums --refs public/stadiums/manifest.json
//   node scripts/converter-acervo-para-webp.mjs public/stadiums --refs public/stadiums/manifest.json --apagar

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const args = process.argv.slice(2)
const pasta = args.find(a => !a.startsWith("--"))
const apagar = args.includes("--apagar")
const refsArg = args[args.indexOf("--refs") + 1]
const arquivosDeReferencia = args.includes("--refs") && refsArg ? refsArg.split(",") : []

if (!pasta) {
  console.error("uso: node scripts/converter-acervo-para-webp.mjs <pasta> [--refs a.json,b.json] [--apagar]")
  process.exit(1)
}

const CONVERSIVEIS = new Set([".png", ".jpg", ".jpeg"])
const mb = n => (n / 1048576).toFixed(1)

// ─── 1. Converter ────────────────────────────────────────────────────────────

const arquivos = readdirSync(pasta)
  .filter(n => CONVERSIVEIS.has(path.extname(n).toLowerCase()))
  .map(n => path.join(pasta, n))

if (arquivos.length === 0) {
  console.log(`nada a converter em ${pasta}`)
  process.exit(0)
}

console.log(`${arquivos.length} arquivo(s) em ${pasta}`)
let bytesAntes = 0
let bytesDepois = 0
let convertidos = 0
let falhas = 0

for (const origem of arquivos) {
  const destino = origem.replace(/\.(png|jpe?g)$/i, ".webp")
  bytesAntes += statSync(origem).size
  try {
    if (!existsSync(destino)) {
      // ⚠️ `alphaQuality: 100` NÃO é exagero: escudo e uniforme são recortados, e
      // alfa degradado vira franja branca na borda — o tipo de defeito que só
      // aparece sobre fundo escuro, ou seja, no jogo inteiro.
      await sharp(origem).webp({ quality: 90, alphaQuality: 100, effort: 5 }).toFile(destino)
      convertidos++
    }
    bytesDepois += statSync(destino).size
  } catch (e) {
    console.error(`  FALHA ao converter ${origem}: ${e.message}`)
    falhas++
  }
}

console.log(`  convertidos ${convertidos} | ${mb(bytesAntes)} MB -> ${mb(bytesDepois)} MB `
  + `(${Math.round((1 - bytesDepois / bytesAntes) * 100)}% menor)`)
if (falhas > 0) {
  console.error(`\n${falhas} conversao(oes) falharam. Nada foi reescrito nem apagado.`)
  process.exit(1)
}

// ─── 2. Reescrever as referências ────────────────────────────────────────────

const nomeDaPasta = path.basename(pasta)
let referenciasTrocadas = 0

for (const arquivo of arquivosDeReferencia) {
  if (!existsSync(arquivo)) {
    console.error(`  arquivo de referencia nao encontrado: ${arquivo}`)
    process.exit(1)
  }
  const antes = readFileSync(arquivo, "utf-8")
  // Só troca o que aponta para ESTA pasta: um `.png` de outro acervo no mesmo
  // JSON continuaria valendo, e trocá-lo criaria a referência quebrada que este
  // script existe para evitar.
  const depois = antes.replace(
    new RegExp(`(/${nomeDaPasta}/[^"']+?)\\.(png|jpe?g)`, "gi"),
    (_m, base) => { referenciasTrocadas++; return `${base}.webp` },
  )
  if (depois !== antes) writeFileSync(arquivo, depois)
}
console.log(`  referencias trocadas: ${referenciasTrocadas} em ${arquivosDeReferencia.length} arquivo(s)`)

// ─── 3. Conferir que TODA referência nova existe ─────────────────────────────
//
// ⚠️ ESTE PASSO É O QUE AUTORIZA O PASSO 4. Sem ele, "converti e troquei" é uma
// afirmação sobre o que eu quis fazer, não sobre o que está no disco.

let quebradas = 0
for (const arquivo of arquivosDeReferencia) {
  const texto = readFileSync(arquivo, "utf-8")
  const apontadas = texto.match(new RegExp(`/${nomeDaPasta}/[^"']+?\\.webp`, "gi")) ?? []
  for (const ref of new Set(apontadas)) {
    const noDisco = path.join(path.dirname(pasta), ref.replace(/^\//, ""))
    if (!existsSync(noDisco)) {
      if (quebradas < 5) console.error(`  REFERENCIA QUEBRADA: ${ref}`)
      quebradas++
    }
  }
}

if (quebradas > 0) {
  console.error(`\n${quebradas} referencia(s) apontam para arquivo inexistente. NADA foi apagado.`)
  process.exit(1)
}
console.log("  conferencia: toda referencia nova existe em disco")

// ─── 4. Apagar os originais ──────────────────────────────────────────────────

if (!apagar) {
  console.log(`\nEnsaio concluido. Os originais continuam no lugar.`)
  console.log(`Para apagar: repita com --apagar`)
  process.exit(0)
}

let apagados = 0
for (const origem of arquivos) {
  const destino = origem.replace(/\.(png|jpe?g)$/i, ".webp")
  if (existsSync(destino)) { unlinkSync(origem); apagados++ }
}
console.log(`\n${apagados} original(is) apagado(s). Acervo em WebP: ${mb(bytesDepois)} MB.`)
