// ROSTOS EM WEBP — o maior peso solto do instalador.
//
// Medido em 16/08/2026 na árvore de build: `public/jogadores` tinha 33.108
// arquivos, dos quais **20.238 ainda eram JPG/PNG somando 98 MB** (o resto já
// era WebP). Rosto é foto: no q82 a economia fica na casa dos 85%, e são ~80 MB
// a menos no `.exe` que todo jogador baixa.
//
// ⚠️ CONVERTER O ARQUIVO NÃO BASTA — E ESTE É O ERRO QUE APAGARIA 20 MIL FOTOS.
// O `faces-manifest.json` é DERIVADO: `build-faces-manifest.mjs` percorre
// `player_photo_overrides.json` e só mantém a entrada cujo arquivo EXISTE na
// pasta. Convertendo `x.jpg` para `x.webp` sem reescrever o override, a entrada
// deixa de casar, é descartada em silêncio e o atleta perde o retrato. Por isso
// este script faz as duas coisas na mesma passada, e só apaga o original depois
// de o override novo estar gravado.
//
// Uso:
//   node scripts/converter-rostos-para-webp.mjs            # ensaio (não grava)
//   node scripts/converter-rostos-para-webp.mjs --aplicar
//   node scripts/converter-rostos-para-webp.mjs --aplicar --apagar-originais

import { readdir, readFile, writeFile, stat, unlink } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const RAIZ = process.cwd()
const PASTA = path.join(RAIZ, "public", "jogadores")
const OVERRIDES = path.join(RAIZ, "data", "seeds", "player_photo_overrides.json")
const QUALIDADE = 82

const aplicar = process.argv.includes("--aplicar")
const apagar = process.argv.includes("--apagar-originais")
const limite = Number(process.argv[process.argv.indexOf("--limite") + 1]) || Infinity

const mb = bytes => (bytes / 1048576).toFixed(1)

const arquivos = (await readdir(PASTA)).filter(f => /\.(jpe?g|png)$/i.test(f))
console.log(`rostos em JPG/PNG: ${arquivos.length}`)
if (!arquivos.length) process.exit(0)

let antes = 0, depois = 0, convertidos = 0, falhas = 0, maiores = 0
/** nome antigo -> nome novo, para reescrever o override. */
const trocas = new Map()

for (const nome of arquivos.slice(0, limite)) {
  const origem = path.join(PASTA, nome)
  const destino = path.join(PASTA, nome.replace(/\.(jpe?g|png)$/i, ".webp"))
  try {
    const tamanhoOriginal = (await stat(origem)).size
    const buffer = await sharp(origem).webp({ quality: QUALIDADE }).toBuffer()
    antes += tamanhoOriginal
    // ⚠️ Só troca o que ENCOLHE. Foto pequena e já comprimida às vezes cresce no
    // WebP; trocar por princípio engordaria o instalador, que é o oposto do
    // pedido. (Mesma regra do `converter-canal-para-webp`.)
    if (buffer.length >= tamanhoOriginal) { depois += tamanhoOriginal; maiores++; continue }
    depois += buffer.length
    convertidos++
    trocas.set(nome, path.basename(destino))
    if (aplicar) await writeFile(destino, buffer)
  } catch (e) {
    falhas++
    console.log(`falhou ${nome}: ${e.message}`)
  }
  if (convertidos % 2000 === 0 && convertidos) console.log(`  ... ${convertidos} convertidos`)
}

console.log(`\nconvertidos: ${convertidos} | maiores em webp (mantidos): ${maiores} | falhas: ${falhas}`)
console.log(`antes: ${mb(antes)} MB → depois: ${mb(depois)} MB (${(100 - depois / antes * 100).toFixed(0)}% menor)`)

if (!aplicar) { console.log("\nensaio. rode com --aplicar para gravar."); process.exit(0) }

// ── O OVERRIDE, na mesma passada ────────────────────────────────────────────
const overrides = JSON.parse(await readFile(OVERRIDES, "utf8"))
let reapontados = 0
for (const [chave, url] of Object.entries(overrides)) {
  if (typeof url !== "string" || !url.startsWith("/jogadores/")) continue
  const nome = decodeURIComponent(url.slice("/jogadores/".length))
  const novo = trocas.get(nome)
  if (!novo) continue
  overrides[chave] = `/jogadores/${novo}`
  reapontados++
}
await writeFile(OVERRIDES, JSON.stringify(overrides, null, 2) + "\n")
console.log(`player_photo_overrides.json: ${reapontados} entradas reapontadas para .webp`)

if (apagar) {
  let apagados = 0
  for (const nome of trocas.keys()) {
    try { await unlink(path.join(PASTA, nome)); apagados++ } catch {}
  }
  console.log(`originais apagados: ${apagados}`)
}
console.log("\nagora rode: node scripts/build-faces-manifest.mjs")
