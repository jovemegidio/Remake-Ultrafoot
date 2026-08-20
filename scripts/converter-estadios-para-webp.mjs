// CONVERTE AS FOTOS DE ESTADIO PARA WEBP.
//
//   node scripts/converter-estadios-para-webp.mjs --amostra 30   (mede, nao grava)
//   node scripts/converter-estadios-para-webp.mjs                (converte tudo)
//
// POR QUE ESTA PASTA PRIMEIRO: `public/stadiums` tinha 1.783 PNG somando
// 113 MB — a maior pasta nao convertida do jogo, e a pior escolha de formato
// possivel, porque PNG e sem perdas e o conteudo e FOTOGRAFIA. O resto do
// public/ ja estava em WebP em boa parte (jogadores: 13 mil ja convertidos).
//
// ⚠️ O CAMINHO COM A EXTENSAO MORA NO MANIFESTO, e e por ele que o jogo acha a
// foto (`lib/pre-match-bg.ts` importa `public/stadiums/manifest.json`). Trocar o
// arquivo sem reescrever o manifesto deixaria TODAS as telas de pre-jogo sem
// fundo — e sem erro, porque o codigo so nao acha a imagem.
//
// ⚠️ E POR ISSO A ORDEM E: grava o .webp -> reescreve o manifesto -> so entao
// apaga o original. Em qualquer ponto que isso pare no meio, o manifesto aponta
// para um arquivo que existe.
//
// ⚠️ "REESCREVE O MANIFESTO" TEM DE SER DE VERDADE, NAO SO NA MEMORIA. A
// primeira versao deste script guardava as trocas num objeto e gravava o
// manifesto uma unica vez, no fim — mas apagava o PNG a cada arquivo. Uma
// interrupcao (e sao 1.804 arquivos num drive do Google Drive, com escrita
// lenta) deixaria N estadios com o manifesto apontando para um PNG que ja nao
// existe. Agora o manifesto e gravado a cada lote, entao o disco esta sempre
// coerente consigo mesmo.
//
// ⚠️ O IMPORTADOR TAMBEM PRECISA MUDAR. `scripts/import-stadiums.mjs` grava o
// que baixa; se ele continuar gravando PNG, a proxima importacao traz os 113 MB
// de volta e ninguem percebe.

import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

// O `sharp` nao existe no node_modules do drive do Google Drive (ele corrompe
// pacote nativo). Entao o script roda de uma copia em C: e aponta para ca:
//   ULTRAFOOT_RAIZ="G:/.../Ultrafoot - PC" node scripts/converter-estadios-para-webp.mjs
const RAIZ = process.env.ULTRAFOOT_RAIZ ?? path.resolve(import.meta.dirname, "..")
const PASTA = path.join(RAIZ, "public/stadiums")
const MANIFESTO = path.join(PASTA, "manifest.json")

const arg = (nome) => {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : null
}
const AMOSTRA = Number(arg("--amostra") ?? 0)
const QUALIDADE = Number(arg("--qualidade") ?? 82)

const CONVERSIVEL = /\.(png|jpg|jpeg)$/i
// A cada quantos arquivos o manifesto vai ao disco (ver a nota sobre interrupcao).
const LOTE = 25
const mb = (n) => (n / 1024 / 1024).toFixed(1)

if (!existsSync(MANIFESTO)) {
  console.error(`ERRO: ${MANIFESTO} nao existe`)
  process.exit(1)
}

const manifesto = JSON.parse(readFileSync(MANIFESTO, "utf-8"))

// O manifesto e a fonte: converter arquivo solto que ninguem referencia so
// gastaria tempo. Mas contamos os orfaos para o relatorio nao mentir.
const referenciados = new Set(
  Object.values(manifesto)
    .filter((u) => typeof u === "string")
    .map((u) => path.basename(u)),
)
const naPasta = readdirSync(PASTA).filter((f) => CONVERSIVEL.test(f))
const orfaos = naPasta.filter((f) => !referenciados.has(f))

const alvos = Object.entries(manifesto).filter(
  ([, url]) => typeof url === "string" && CONVERSIVEL.test(url),
)

console.log(`manifesto: ${Object.keys(manifesto).length} entradas`)
console.log(`a converter: ${alvos.length} | orfaos na pasta (nao referenciados): ${orfaos.length}`)
if (AMOSTRA) console.log(`\nMODO AMOSTRA: ${AMOSTRA} arquivos, NADA e gravado nem apagado\n`)

let antes = 0, depois = 0, feitos = 0, faltando = 0, falhas = 0
const lista = AMOSTRA ? alvos.slice(0, AMOSTRA) : alvos

// ⚠️ UM ARQUIVO TEM VARIAS CHAVES. O importador cria apelidos ("allianz parque",
// "nubank parque allianz parque", o nome sem "arena"...) e todos apontam para a
// MESMA foto. Percorrendo chave a chave, a primeira converte e apaga o original
// — e as outras encontram "sem arquivo" e ficam com o caminho velho, apontando
// para um PNG que nao existe mais. Foram 10 assim na primeira passada.
// Por isso a troca e registrada por URL e aplicada a TODAS as chaves no fim.
const trocaPorUrl = new Map()

for (const [chave, url] of lista) {
  const jaTrocado = trocaPorUrl.get(url)
  if (jaTrocado) { manifesto[chave] = jaTrocado; continue }

  const nome = path.basename(url)
  const origem = path.join(PASTA, nome)
  if (!existsSync(origem)) {
    faltando++
    continue
  }
  const destinoNome = nome.replace(CONVERSIVEL, ".webp")
  const destino = path.join(PASTA, destinoNome)

  try {
    const tamOrigem = statSync(origem).size
    const buf = await sharp(origem).webp({ quality: QUALIDADE, effort: 5 }).toBuffer()

    antes += tamOrigem
    depois += buf.length

    if (!AMOSTRA) {
      // 1. grava o novo
      writeFileSync(destino, buf)
      // 2. aponta o manifesto para ele — e guarda a troca para os apelidos
      manifesto[chave] = `/stadiums/${destinoNome}`
      trocaPorUrl.set(url, `/stadiums/${destinoNome}`)
      // 3. so agora o original pode sair
      if (destino !== origem) unlinkSync(origem)
    }
    feitos++
    // Ponto de coerencia: manifesto no disco antes de seguir. `LOTE` pequeno
    // porque o custo de reescrever 100 KB e desprezivel perto do de reconverter.
    if (!AMOSTRA && feitos % LOTE === 0) {
      writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + "\n", "utf-8")
      console.log(`  ${feitos}/${lista.length}… (manifesto gravado)`)
    }
  } catch (e) {
    falhas++
    console.error(`  ! ${nome}: ${e.message}`)
  }
}

if (!AMOSTRA) {
  writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + "\n", "utf-8")
  console.log("\nmanifesto reescrito")
}

const economia = antes - depois
console.log(
  `\nconvertidos: ${feitos} | falhas: ${falhas} | sem arquivo: ${faltando}` +
  `\nantes: ${mb(antes)} MB -> depois: ${mb(depois)} MB` +
  `\neconomia: ${mb(economia)} MB (${antes ? ((economia / antes) * 100).toFixed(1) : 0}%)`,
)
if (AMOSTRA) {
  const proj = alvos.length ? (economia / lista.length) * alvos.length : 0
  console.log(`projecao para os ${alvos.length}: ~${mb(proj)} MB economizados`)
}
