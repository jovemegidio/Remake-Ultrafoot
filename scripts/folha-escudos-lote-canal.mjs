// Folha de contato: o escudo que o CANAL serve hoje ao lado do que o LOTE quer
// publicar, para toda chave que o lote substitui.
//
//   node scripts/folha-escudos-lote-canal.mjs --lote lote-final.json \
//     --manifesto elencos.json --saida folha.png
//
// Irmão do folha-escudos-editor-canal.mjs, do outro lado: lá a comparação é
// contra o save do editor, aqui contra o pacote que está prestes a subir.
//
// ⚠️ ESTE É O PASSO QUE DECIDE. Nome, sigla e UF batendo não provam nada — em
// 06/08 o "Santos" do canal era o Santos Laguna e o nome casava perfeitamente.
// E como o canal VENCE o embutido, escudo errado publicado APAGA o certo que já
// viajava dentro da build: substituir é mais perigoso do que não publicar.
// Renderizar os dois lado a lado e LER o que está desenhado é o único filtro
// que pega troca de clube.

import { readFile, writeFile } from "node:fs/promises"
import https from "node:https"
import sharp from "sharp"

const args = process.argv.slice(2)
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const LOTE = opt("--lote")
const MANIFESTO = opt("--manifesto")
const SAIDA = opt("--saida") ?? "folha.png"
if (!LOTE || !MANIFESTO) {
  console.error("uso: --lote lote.json --manifesto elencos.json [--saida folha.png]")
  process.exit(1)
}

const FUNDO = { r: 255, g: 255, b: 255, alpha: 1 }
const L = 130, COLS = 4, LARG = L * 2 + 14, ALT = L + 22

const baixar = (url) => new Promise((ok, err) => {
  https.get(url, { rejectUnauthorized: false }, (r) => {
    const p = []
    r.on("data", d => p.push(d))
    r.on("end", () => ok(Buffer.concat(p)))
  }).on("error", err)
})

const quadro = async (buf) => sharp(buf)
  .resize(L, L, { fit: "contain", background: FUNDO })
  .flatten({ background: FUNDO }).png().toBuffer()

const rotulo = async (texto, largura) => sharp(Buffer.from(
  `<svg width="${largura}" height="20"><rect width="100%" height="100%" fill="white"/>` +
  `<text x="4" y="14" font-family="sans-serif" font-size="13" fill="#111">${texto.replace(/[<&>]/g, "")}</text></svg>`,
)).png().toBuffer()

const lote = JSON.parse(await readFile(LOTE, "utf8"))
const manifesto = JSON.parse(await readFile(MANIFESTO, "utf8"))

const celulas = []
for (const item of lote.clubes || []) {
  const antigoUrl = manifesto.times?.[item.file_key]?.logoUrl
  if (!antigoUrl) continue // só interessa o que SUBSTITUI
  const novoBuf = Buffer.from(item.escudo_data.split(",")[1], "base64")
  let antigoBuf
  try { antigoBuf = await baixar(antigoUrl) } catch { antigoBuf = null }
  celulas.push({ fk: item.file_key, antigo: antigoBuf, novo: novoBuf })
}

if (!celulas.length) {
  console.log("nenhuma substituicao no lote — nada a conferir")
  process.exit(0)
}

const linhas = Math.ceil(celulas.length / COLS)
const folha = sharp({
  create: { width: COLS * LARG, height: linhas * ALT, channels: 3, background: FUNDO },
})

const camadas = []
for (const [i, c] of celulas.entries()) {
  const x = (i % COLS) * LARG
  const y = Math.floor(i / COLS) * ALT
  if (c.antigo) camadas.push({ input: await quadro(c.antigo), left: x, top: y })
  camadas.push({ input: await quadro(c.novo), left: x + L + 14, top: y })
  camadas.push({ input: await rotulo(`${c.fk}   canal | lote`, LARG), left: x, top: y + L })
}

await writeFile(SAIDA, await folha.composite(camadas).png().toBuffer())
console.log(`${celulas.length} substituicoes na folha -> ${SAIDA}`)
