// CÓPIA DA PASTA DO CANAL EM WEBP — origem intacta, destino convertido.
//
// O acervo de origem (`Downloads\Canal de Atualização`, ~2,9 GB em PNG) é a
// matéria-prima dos lotes de escudo, uniforme e rosto. Este script produz uma
// CÓPIA em WebP SEM PERDAS dentro da árvore do jogo, preservando a estrutura de
// pastas e sem tocar no original.
//
//   node scripts/copiar-canal-em-webp.mjs --origem "<pasta>" --destino "<pasta>"
//   node scripts/copiar-canal-em-webp.mjs ... --amostra 20   # só mede, não grava
//
// ⚠️ SEM PERDAS DE VERDADE (`lossless: true`): o bitmap sai idêntico e o canal
// alfa vai junto. Estas artes existem para virar escudo/camisa no jogo — perder
// pixel aqui contamina todo lote publicado daqui para a frente.
//
// ⚠️ SÓ TROCA O QUE ENCOLHER. Escudo monocromático de área chapada é o caso em
// que o PNG paletizado ganha do WebP (medido em 05/08 e de novo em 15/08). Onde
// o WebP sair maior, o arquivo original é copiado como está — o objetivo é uma
// cópia mais leve, não uma cópia com outra extensão.
//
// ⚠️ `effort: 6` custa 54x mais tempo por ~3% de bytes nestas artes com alfa
// (medido em 06/08). Fica no 4.
//
// Arquivo que não é imagem (config.xml, desktop.ini, .zip do pacote de rostos)
// é copiado byte a byte: a cópia tem de continuar servindo como origem.
//
// Retomável: arquivo de destino mais novo que a origem é pulado, então rodar de
// novo depois de uma interrupção continua de onde parou.

import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const arg = (n, padrao = "") => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : padrao
}

const origem = arg("--origem")
const destino = arg("--destino")
const amostra = Number(arg("--amostra", "0"))
const relatorio = arg("--relatorio")
if (!origem || !destino) {
  console.error('uso: --origem "<pasta>" --destino "<pasta>" [--amostra N] [--relatorio x.json]')
  process.exit(1)
}

const EXTENSOES = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"])

/** Caminhos relativos de TODOS os arquivos, em ordem estável. */
async function listar(raiz, base = "") {
  const saida = []
  const itens = await fs.readdir(path.join(raiz, base), { withFileTypes: true })
  for (const item of itens.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? path.join(base, item.name) : item.name
    if (item.isDirectory()) saida.push(...(await listar(raiz, rel)))
    else if (item.isFile()) saida.push(rel)
  }
  return saida
}

const arquivos = await listar(origem)
const alvos = amostra > 0 ? arquivos.filter(f => EXTENSOES.has(path.extname(f).toLowerCase())).slice(0, amostra) : arquivos
console.log(`${arquivos.length} arquivos na origem${amostra > 0 ? ` — medindo ${alvos.length}` : ""}`)

// ⚠️ A MESMA ARTE APARECE EM MAIS DE UM LUGAR: "Women - Mulheres/Escudos para
// Licenciar Times" é cópia byte a byte da pasta de escudos da raiz (676
// arquivos). Reencodar de novo é tempo jogado fora — o resultado é indexado
// pelo sha do ORIGINAL e reusado.
const porSha = new Map()

let convertidos = 0, mantidos = 0, copiados = 0, pulados = 0, falhas = 0
let bytesOrigem = 0, bytesDestino = 0
const erros = []
const inicio = Date.now()

for (const [n, rel] of alvos.entries()) {
  const fonte = path.join(origem, rel)
  const stat = await fs.stat(fonte)
  const ext = path.extname(rel).toLowerCase()
  const ehImagem = EXTENSOES.has(ext)
  const alvoWebp = path.join(destino, rel.slice(0, -ext.length) + ".webp")
  const alvoIgual = path.join(destino, rel)

  if (amostra === 0) {
    // Retomada: qualquer um dos dois destinos já pronto e mais novo que a origem.
    let jaFeito = false
    for (const alvo of ehImagem ? [alvoWebp, alvoIgual] : [alvoIgual]) {
      const s = await fs.stat(alvo).catch(() => null)
      if (s && s.mtimeMs >= stat.mtimeMs) { bytesOrigem += stat.size; bytesDestino += s.size; jaFeito = true; break }
    }
    if (jaFeito) { pulados++; continue }
    await fs.mkdir(path.dirname(alvoIgual), { recursive: true })
  }

  bytesOrigem += stat.size

  if (!ehImagem) {
    await fs.copyFile(fonte, alvoIgual)
    bytesDestino += stat.size
    copiados++
    continue
  }

  try {
    const bruto = await fs.readFile(fonte)
    const sha = createHash("sha256").update(bruto).digest("hex")
    const visto = porSha.get(sha)
    let webp = visto?.webp
    if (!webp) {
      webp = await sharp(bruto).webp({ lossless: true, effort: 4 }).toBuffer()
      porSha.set(sha, { webp })
    }
    const encolheu = webp.length < bruto.length
    if (amostra === 0) {
      await fs.writeFile(encolheu ? alvoWebp : alvoIgual, encolheu ? webp : bruto)
    }
    bytesDestino += encolheu ? webp.length : bruto.length
    if (encolheu) convertidos++
    else mantidos++
  } catch (e) {
    // Arquivo corrompido ou formato que o sharp não abre: a cópia leva o
    // original. Perder o arquivo seria pior do que perder a compressão.
    falhas++
    erros.push({ arquivo: rel, erro: String(e?.message ?? e) })
    if (amostra === 0) await fs.copyFile(fonte, alvoIgual).catch(() => {})
    bytesDestino += stat.size
  }

  if ((n + 1) % 200 === 0 || n + 1 === alvos.length) {
    const s = (Date.now() - inicio) / 1000
    const mb = (b) => (b / 1024 / 1024).toFixed(0)
    console.log(`[${n + 1}/${alvos.length}] ${s.toFixed(0)}s · ${((n + 1) / s).toFixed(1)}/s · ${mb(bytesOrigem)}→${mb(bytesDestino)} MB · webp ${convertidos} · png mantido ${mantidos} · outros ${copiados} · pulados ${pulados} · falhas ${falhas}`)
  }
}

const resumo = {
  origem, destino,
  arquivos: alvos.length,
  convertidos, mantidos, copiados, pulados, falhas,
  bytesOrigem, bytesDestino,
  reducaoPct: bytesOrigem ? Number((100 - (bytesDestino / bytesOrigem) * 100).toFixed(1)) : 0,
  segundos: Number(((Date.now() - inicio) / 1000).toFixed(0)),
  erros: erros.slice(0, 50),
}
console.log(JSON.stringify(resumo, null, 2))
if (relatorio) await fs.writeFile(relatorio, JSON.stringify(resumo, null, 2))
