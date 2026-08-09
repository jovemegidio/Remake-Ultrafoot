// Compara, clube a clube, o escudo do EDITOR com o que o canal serve HOJE — e
// ordena por DIFERENCA VISUAL, nao por sha.
//
//   node scripts/comparar-escudos-editor-canal.mjs --manifesto elencos.json
//
// ⚠️ POR QUE NAO BASTA O SHA. Em 06/08/2026 o sha discordava em 288 dos 380
// escudos do editor — mas quase todos eram a MESMA arte com bytes diferentes
// (outro redimensionamento, outra compressao). Publicar os 288 trocaria 12 MB de
// imagem no canal e no orcamento de cada jogador para nao mudar nada na tela.
// Os que importam de verdade eram tres, e nesses o canal servia OUTRO CLUBE:
// Santos com o escudo do Santos Laguna, Flamengo com o do Flamengo-PI e
// Fluminense com o de outro Fluminense.
//
// A assinatura e 32x32 em cinza, sobre fundo branco e normalizada: some com
// diferenca de tamanho, de compressao e de contraste, e sobra a FORMA. Nos casos
// conhecidos a separacao foi limpa — clube errado deu 33 a 45, mesma arte deu
// 0 a 20.
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import https from "node:https"
import sharp from "sharp"

const args = process.argv.slice(2)
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const SAVE = opt("--save") ?? path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "com.ultrafoot.remake", "ultrafoot-clubs.json")
const MANIFESTO = opt("--manifesto")
const SAIDA = opt("--exportar")
if (!MANIFESTO) {
  console.error('uso: --manifesto <elencos.json> [--save <caminho>] [--exportar distancias.txt]')
  process.exit(1)
}

const FUNDO = { r: 255, g: 255, b: 255, alpha: 1 }
const assinatura = async (buf) =>
  (await sharp(buf).resize(32, 32, { fit: "contain", background: FUNDO })
    .flatten({ background: FUNDO }).greyscale().normalise()
    .raw().toBuffer({ resolveWithObject: true })).data

const distancia = (a, b) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

const baixar = (url) => new Promise((ok, err) => {
  https.get(url, (r) => {
    const partes = []
    r.on("data", (d) => partes.push(d))
    r.on("end", () => ok(Buffer.concat(partes)))
  }).on("error", err)
})

const save = JSON.parse(await readFile(SAVE, "utf8"))
const manifesto = JSON.parse(await readFile(MANIFESTO, "utf8"))
const PREFIXO = "ultrafoot:logo:"

const linhas = []
for (const chave of Object.keys(save)) {
  if (!chave.startsWith(PREFIXO)) continue
  const fileKey = chave.slice(PREFIXO.length)
  const url = manifesto.times?.[fileKey]?.logoUrl
  if (!url) continue
  const dataUrl = save[chave]
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) continue
  try {
    const a = await assinatura(Buffer.from(dataUrl.split(",").pop(), "base64"))
    const b = await assinatura(await baixar(url))
    linhas.push([fileKey, distancia(a, b)])
  } catch (e) {
    // Mensagem CURTA de proposito: o `e` do sharp carrega o buffer inteiro, e
    // imprimi-lo despeja megabytes de base64 no terminal.
    console.error(`  falhou ${fileKey}: ${String(e.message).slice(0, 80)}`)
  }
}

linhas.sort((x, y) => y[1] - x[1])
console.log(`comparados: ${linhas.length}`)
for (const corte of [40, 30, 25, 20]) {
  console.log(`  acima de ${corte}: ${linhas.filter(l => l[1] > corte).length}`)
}
console.log("\nTOP 40 (maior diferenca visual primeiro):")
for (const [k, d] of linhas.slice(0, 40)) console.log(`  ${k.padEnd(26)}${d.toFixed(1)}`)

if (SAIDA) {
  await writeFile(path.resolve(SAIDA), linhas.map(([k, d]) => `${k}\t${d.toFixed(1)}`).join("\n"), "utf8")
  console.log(`\nGravado em ${path.resolve(SAIDA)}`)
}
