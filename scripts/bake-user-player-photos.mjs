// Embute no build as FOTOS DE JOGADOR importadas no editor.
//
// O PROBLEMA: `setPlayerPhotoOverride` grava em `ultrafoot:player-photo:<nome>`
// dentro do save LOCAL. Nada levava essas imagens para um seed — os scripts de
// foto que existiam apenas BAIXAM de fontes externas (Transfermarkt, megapack).
// Resultado: quem licenciava um elenco no editor via as fotos so na propria
// maquina; para todos os outros jogadores, e na versao web, elas nao existiam.
// Mesmo buraco que os uniformes tinham antes de bake-user-logos passar a
// mesclar `kits`.
//
// A SAIDA usa o caminho ja comprovado por scripts/import-fotos-pasta.mjs:
// grava PNG em public/jogadores/ e registra em data/seeds/faces-manifest.json,
// que getPlayerPhotoUrl consulta ANTES do Transfermarkt. Assim a foto viaja no
// instalador e no export da web, sem inchar o JSON com base64.
//
// Roda sozinho no prebuild (via embutir-edicoes). Uso manual:
//   node scripts/bake-user-player-photos.mjs

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import sharp from "sharp"

const SAVE = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "com.ultrafoot.remake",
  "ultrafoot-clubs.json",
)
const DESTINO = path.resolve("public/jogadores")
const MANIFESTO = path.resolve("data/seeds/faces-manifest.json")
const PREFIXO = "ultrafoot:player-photo:"

let raw
try {
  raw = JSON.parse(await readFile(SAVE, "utf8"))
} catch {
  console.log("Sem save local — nada de fotos de jogador para embutir.")
  process.exit(0)
}

const chaves = Object.keys(raw).filter(k => k.startsWith(PREFIXO))
if (!chaves.length) {
  console.log("Nenhuma foto de jogador importada no editor.")
  process.exit(0)
}

const manifesto = JSON.parse(await readFile(MANIFESTO, "utf8"))
// ⚠️ GRAVAR SÓ NO MANIFESTO NÃO BASTA — a foto some no próximo build.
//
// `build-faces-manifest.mjs` NÃO acrescenta ao manifesto: ele o REGENERA do
// zero, a partir de `player_photo_overrides.json` cruzado com os arquivos em
// disco. Tudo que existisse apenas no manifesto era apagado na primeira vez que
// alguém rodasse `npm run assets:faces` — sem erro nenhum, o jogador só via a
// silhueta voltar. Foi assim que 17 das 57 fotos licenciadas sumiram do
// manifesto enquanto os PNG continuavam em `public/jogadores`.
//
// Escrevendo TAMBÉM no mapa editorial, a foto sobrevive à regeneração, que é o
// que faz a edição do usuário chegar aos outros jogadores de verdade.
const OVERRIDES = path.resolve("data/seeds/player_photo_overrides.json")
let overrides = {}
try { overrides = JSON.parse(await readFile(OVERRIDES, "utf8")) } catch { /* primeiro uso */ }
await mkdir(DESTINO, { recursive: true })

let gravadas = 0, substituidas = 0, ignoradas = 0
let antes = 0, depois = 0

for (const chave of chaves) {
  // A chave JA e o nome normalizado (normalizePlayerKey), mesmo formato usado
  // como chave do manifesto — nao precisa renormalizar.
  const slug = chave.slice(PREFIXO.length)
  const dataUrl = raw[chave]
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) { ignoradas++; continue }

  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64")
  antes += buf.length

  let saida
  try {
    // 320px: o mesmo teto que o editor ja aplica ao importar (compressImageDataUrl).
    saida = await sharp(buf).resize(320, 320, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 }).toBuffer()
  } catch (e) {
    console.log(`  ! ${slug}: nao consegui processar (${e.message}) — ignorada`)
    ignoradas++
    continue
  }
  const final = saida.length < buf.length ? saida : buf
  depois += final.length

  const arquivo = `${slug}.png`
  await writeFile(path.join(DESTINO, arquivo), final)
  if (manifesto.entries[slug]) substituidas++
  manifesto.entries[slug] = `/jogadores/${arquivo}`
  // A foto do EDITOR manda: se o slot estava com um cutout do DF11 (importacao
  // automatica), ele cede lugar. Quem licenciou escolheu de proposito.
  overrides[slug] = `/jogadores/${arquivo}`
  gravadas++
}

manifesto.available = Object.keys(manifesto.entries).length
manifesto.generatedAt = new Date().toISOString()
await writeFile(MANIFESTO, `${JSON.stringify(manifesto, null, 2)}\n`, "utf8")
// O mapa editorial é a fonte que o `build-faces-manifest.mjs` relê. Sem esta
// gravação, tudo acima seria desfeito na próxima regeração do manifesto.
await writeFile(OVERRIDES, `${JSON.stringify(overrides, null, 2)}\n`, "utf8")

const kb = n => `${(n / 1024).toFixed(0)} KB`
console.log(`fotos de jogador embutidas: ${gravadas} (${substituidas} substituiram entrada existente, ${ignoradas} ignoradas)`)
console.log(`tamanho: ${kb(antes)} -> ${kb(depois)}`)
console.log(`manifesto agora tem ${manifesto.available} entradas`)
