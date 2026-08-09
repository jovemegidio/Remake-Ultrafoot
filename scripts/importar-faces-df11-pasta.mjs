// Importa rostos do DF11 a partir de PASTAS JÁ EXTRAÍDAS (uma por clube), em vez
// do zip de 13 GB que o `importar-faces-df11.mjs` consome.
//
//   node scripts/importar-faces-df11-pasta.mjs --raiz "C:/.../DF11 Catalogo/Brasil"
//   node scripts/importar-faces-df11-pasta.mjs --raiz "..." --gravar
//
// POR QUE UM SEGUNDO SCRIPT, e não um parâmetro no primeiro: o do zip resolve um
// problema diferente — ele decide QUAIS rostos extrair de 13 GB antes de gastar
// I/O, e por isso é todo organizado em torno da lista de alvos. Aqui os arquivos
// já estão em disco e a pergunta é a inversa: dado este arquivo, a quem ele
// pertence? Espremer os dois fluxos numa função só deixaria as duas metades
// piores.
//
// A CHAVE É O FM ID, que vem no PRÓPRIO NOME DO ARQUIVO: "Bruno Henrique
// (19258642).png". O nome do atleta ao lado é conferência humana, não chave —
// casar por nome é o que faz xará roubar rosto (ver a memória do projeto sobre
// as três armadilhas que colaram rosto errado).
//
// SAÍDA idêntica à do script do zip, de propósito: public/jogadores/df11-<id>.webp
// mais a entrada em player_photo_overrides.json. Assim as duas origens convivem
// e o jogo não precisa saber de onde o rosto veio.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const RAIZ = path.resolve(import.meta.dirname, "..")
const argRaiz = process.argv.indexOf("--raiz")
const ORIGEM = argRaiz >= 0 ? path.resolve(process.argv[argRaiz + 1]) : null
const GRAVAR = process.argv.includes("--gravar")

const MAPA = path.join(RAIZ, "data/seeds/face-id-map.json")
const OVERRIDES = path.join(RAIZ, "data/seeds/player_photo_overrides.json")
const DESTINO = path.join(RAIZ, "public/jogadores")

// Mesmos números do script do zip: 200px de altura e q82. Ver o comentário lá —
// 3.604 PNGs de 58 KB dariam 205 MB no instalador; em webp ficam ~5 KB cada.
const ALTURA = 200
const QUALIDADE = 82

if (!ORIGEM || !existsSync(ORIGEM)) {
  console.error(`pasta de origem não encontrada: ${ORIGEM ?? "(faltou --raiz)"}`)
  process.exit(1)
}

const mapa = JSON.parse(readFileSync(MAPA, "utf-8"))
console.log(`mapa FM ID -> atleta: ${Object.keys(mapa).length} entradas`)
console.log(`origem: ${ORIGEM}`)

/** Todos os PNG/WEBP das subpastas, com o FM ID extraído do nome. */
function varrer(dir) {
  const achados = []
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome)
    if (statSync(p).isDirectory()) { achados.push(...varrer(p)); continue }
    if (!/\.(png|webp|jpg)$/i.test(nome)) continue
    // "Bruno Henrique (19258642).png" -> 19258642
    const m = /\((\d{5,})\)/.exec(nome)
    if (!m) { achados.push({ arquivo: p, fmId: null, nome }); continue }
    achados.push({ arquivo: p, fmId: m[1], nome })
  }
  return achados
}

const arquivos = varrer(ORIGEM)
const semId = arquivos.filter(a => !a.fmId)
const comId = arquivos.filter(a => a.fmId)
const casados = comId.filter(a => mapa[a.fmId])
const semAtleta = comId.filter(a => !mapa[a.fmId])

console.log(`\narquivos       : ${arquivos.length}`)
console.log(`sem FM ID no nome: ${semId.length}`)
console.log(`FM ID sem atleta no jogo: ${semAtleta.length}`)
console.log(`CASADOS        : ${casados.length}`)

if (!GRAVAR) {
  console.log("\namostra:")
  for (const a of casados.slice(0, 8)) console.log(`  ${a.nome} -> atleta ${mapa[a.fmId]}`)
  if (semAtleta.length) {
    console.log("\nsem atleta no jogo (amostra):")
    for (const a of semAtleta.slice(0, 8)) console.log(`  ${a.nome}`)
  }
  console.log("\n(ensaio — rode com --gravar para importar)")
  process.exit(0)
}

mkdirSync(DESTINO, { recursive: true })
let gravados = 0, pulados = 0, erros = 0
for (const a of casados) {
  const jogadorId = mapa[a.fmId]
  const saida = path.join(DESTINO, `df11-${jogadorId}.webp`)
  if (existsSync(saida)) { pulados++; continue }
  try {
    await sharp(a.arquivo)
      .resize({ height: ALTURA, withoutEnlargement: true })
      // `alphaQuality` alto preserva o recorte — é o que faz o cutout parecer
      // cutout em vez de um retângulo com franja.
      .webp({ quality: QUALIDADE, alphaQuality: 90 })
      .toFile(saida)
    gravados++
    if (gravados % 200 === 0) console.log(`  ${gravados} rostos...`)
  } catch (e) {
    erros++
    if (erros <= 3) console.warn(`  ERRO em ${a.nome}: ${e.message.slice(0, 70)}`)
  }
}

// Registra no override de fotos — é ele que o jogo consulta por ID do atleta.
const overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf-8")) : {}
let novosNoOverride = 0
for (const a of casados) {
  const jogadorId = mapa[a.fmId]
  const arquivo = `df11-${jogadorId}.webp`
  if (!existsSync(path.join(DESTINO, arquivo))) continue
  if (overrides[jogadorId] === arquivo) continue
  overrides[jogadorId] = arquivo
  novosNoOverride++
}
writeFileSync(OVERRIDES, `${JSON.stringify(overrides, null, 2)}\n`)

console.log(JSON.stringify({ gravados, pulados, erros, novosNoOverride, overridesTotal: Object.keys(overrides).length }, null, 2))
