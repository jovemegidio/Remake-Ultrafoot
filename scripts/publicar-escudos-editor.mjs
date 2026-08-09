// Publica pelo canal os ESCUDOS que voce importou no editor de clubes.
//
// Irmao de publicar-fotos-editor.mjs (rostos) e de publicar-escudos-pasta.mjs
// (uma pasta de arquivos). Este le o SAVE do jogo instalado, onde o editor
// grava cada escudo em `ultrafoot:logo:<fileKey>`.
//
//   node scripts/publicar-escudos-editor.mjs                 (ensaio, so os novos)
//   node scripts/publicar-escudos-editor.mjs --exportar escudos-editor.json
//   ... [--todos] [--save "<caminho>"] [--manifesto "<elencos.json>"]
//
// ⚠️ SO RODA DE UM DIRETORIO COM node_modules (C:\Ultrafoot) — precisa do sharp.
//
// ⚠️ POR PADRAO SO SAI O QUE AINDA NAO CHEGOU A NINGUEM. O save acumula anos de
// edicao (375 escudos hoje), e a maioria ja viaja no seed embutido
// (data/seeds/team-overrides.json) ou ja foi publicada no canal. Republicar tudo
// substituiria escudo que veio de outra fonte — inclusive o lote mundial — sem
// necessidade. `--todos` desliga o filtro, de proposito com nome feio.
//
// ⚠️ A CHAVE NAO PRECISA DE CASAMENTO, e essa e a diferenca para os outros dois
// scripts: o editor ja grava o `fileKey` que a tela usa. Nao invente nome nem
// procure no seed — o que estiver na chave e o certo.

import { readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"
import os from "node:os"
import sharp from "sharp"

const args = process.argv.slice(2)
const opt = (nome) => (args.includes(nome) ? args[args.indexOf(nome) + 1] : null)

const SAVE = opt("--save") ?? path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "com.ultrafoot.remake", "ultrafoot-clubs.json")
const RAIZ = path.resolve(import.meta.dirname, "..")
const SEED = path.join(RAIZ, "data/seeds/team-overrides.json")
const manifesto = opt("--manifesto")
const exportar = opt("--exportar")
const todos = args.includes("--todos")
// ⚠️ `--conflitos`: PUBLICA SO ONDE O CANAL DISCORDA DO EDITOR.
//
// O filtro padrao e por PRESENCA ("ja tem escudo, nao mexo") e foi ele que
// deixou passar o pior caso possivel: em 06/08/2026 o Santos estava com o
// escudo do Santos LAGUNA, o Flamengo com o do Flamengo-PI e o Fluminense com o
// de outro Fluminense — todos "ja tinham escudo", entao o editor nunca corrigia.
//
// Este modo compara o CONTEUDO: a url do manifesto termina no sha256 da imagem,
// e o escudo do editor passa exatamente pelo mesmo processamento (256px, PNG
// nivel 9), entao os dois shas sao comparaveis. Sha igual = mesma arte, nao
// republica; sha diferente = o canal esta servindo OUTRA coisa, e o editor
// vence, porque foi voce quem licenciou aquilo a mao.
const soConflitos = args.includes("--conflitos")
// `--clubes a,b,c`: publica SO estes, ignorando qualquer filtro. E o modo de
// corrigir um caso apontado ("o Santos esta com o escudo do Santos Laguna") sem
// arrastar junto as centenas de escudos que so diferem em bytes.
const soEstes = new Set((opt("--clubes") ?? "").split(",").map(s => s.trim()).filter(Boolean))

const LADO = 256 // o mesmo de publicar-escudos-pasta.mjs (TeamCrest vai a 176)

const raw = JSON.parse(await readFile(SAVE, "utf8"))
const chaves = Object.keys(raw).filter(k => k.startsWith("ultrafoot:logo:"))
if (!chaves.length) {
  console.error(`nenhum escudo em ${SAVE}`)
  process.exit(1)
}

// Camada 1: o seed que viaja no build. Camada 2: o canal (se o manifesto for
// passado). O que estiver nas duas ja chega ao jogador — nao republico.
const seed = JSON.parse(await readFile(SEED, "utf8").catch(() => "{}"))
const noCanal = new Set()
/** fileKey -> sha256 da imagem que o canal serve hoje (a url termina nele). */
const shaNoCanal = new Map()
if (manifesto) {
  const m = JSON.parse(await readFile(manifesto, "utf8"))
  for (const [fk, t] of Object.entries(m.times ?? {})) {
    if (!t.logoUrl) continue
    noCanal.add(fk)
    shaNoCanal.set(fk, t.logoUrl.split("/").pop().replace(/\.[a-z]+$/i, ""))
  }
}
if (soConflitos && !shaNoCanal.size) {
  console.error("--conflitos exige --manifesto <elencos.json> baixado do servidor")
  process.exit(1)
}

const itens = []
const pulados = { seed: 0, canal: 0, foraDoCanal: 0, iguais: 0, invalidos: [] }
const conflitos = []
let bytesAntes = 0

for (const chave of chaves) {
  const fileKey = chave.slice("ultrafoot:logo:".length)
  const dataUrl = raw[chave]
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    pulados.invalidos.push(fileKey)
    continue
  }
  if (soEstes.size) {
    if (!soEstes.has(fileKey)) continue
  } else if (soConflitos) {
    // So interessa clube que o canal JA serve — o que falta e assunto do modo
    // padrao. Aqui a pergunta e outra: o que esta no ar e a mesma arte?
    if (!shaNoCanal.has(fileKey)) { pulados.foraDoCanal++; continue }
  } else if (!todos) {
    if (noCanal.has(fileKey)) { pulados.canal++; continue }
    if (seed[fileKey]?.logoUrl) { pulados.seed++; continue }
  }

  // SVG e vetorial e leve — passa direto, como no bake-user-logos.
  if (dataUrl.startsWith("data:image/svg")) {
    itens.push({ file_key: fileKey, escudo_data: dataUrl })
    continue
  }
  const bruto = Buffer.from(dataUrl.split(",").pop(), "base64")
  bytesAntes += bruto.length
  // `contain` com fundo transparente: escudo e brasao, nunca corta nem estica.
  const png = await sharp(bruto)
    .resize(LADO, LADO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
  if (soConflitos && !soEstes.size) {
    // O servidor guarda o sha do BINARIO da imagem, nao do data url.
    const sha = createHash("sha256").update(png).digest("hex")
    if (sha === shaNoCanal.get(fileKey)) { pulados.iguais++; continue }
    conflitos.push(fileKey)
  }
  itens.push({ file_key: fileKey, escudo_data: `data:image/png;base64,${png.toString("base64")}` })
}

console.log(`save    : ${SAVE}`)
console.log(`escudos no save: ${chaves.length}`)
if (soEstes.size) {
  const faltando = [...soEstes].filter(k => !itens.some(i => i.file_key === k))
  if (faltando.length) console.log(`⚠️ NAO estao no save do editor: ${faltando.join(", ")}`)
} else if (soConflitos) {
  console.log(`fora do canal (nao e assunto deste modo): ${pulados.foraDoCanal} | mesma arte no canal: ${pulados.iguais}`)
  console.log(`CONFLITOS — o canal serve arte DIFERENTE da do editor: ${conflitos.length}`)
} else if (!todos) {
  console.log(`ja no seed embutido: ${pulados.seed} | ja no canal: ${pulados.canal}`)
}
if (pulados.invalidos.length) console.log(`sem imagem valida: ${pulados.invalidos.join(", ")}`)
console.log(`\nA PUBLICAR: ${itens.length}`)
console.log("  " + itens.map(i => i.file_key).join(", "))
const kb = itens.reduce((s, i) => s + i.escudo_data.length, 0) / 1024
console.log(`\n${(bytesAntes / 1024).toFixed(0)} KB no save -> ${kb.toFixed(0)} KB em base64`)

if (!exportar) {
  console.log("\nEnsaio. Use --exportar <arquivo> para gravar o pacote.")
} else {
  await writeFile(path.resolve(exportar), JSON.stringify({ clubes: itens }, null, 1), "utf8")
  console.log(`\nExportado para ${path.resolve(exportar)}`)
}
