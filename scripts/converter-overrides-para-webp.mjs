// CONVERTE PARA WEBP OS ESCUDOS/UNIFORMES JA EXTRAIDOS EM public/overrides.
//
//   node scripts/converter-overrides-para-webp.mjs --amostra 30   (mede, nao grava)
//   node scripts/converter-overrides-para-webp.mjs                (converte tudo)
//
// Par do `split-override-assets.mjs`, que a partir de agora ja extrai em WebP.
// Este aqui cuida do que FOI extraido antes: 479 arquivos, 30,6 MB. O splitter
// nao os reconverte sozinho porque e idempotente — entradas que ja viraram
// caminho sao puladas, e essas ja sao caminho.
//
// ⚠️ O CAMINHO MORA NO SEED. `data/seeds/team-overrides.json` guarda
// `logoUrl: "/overrides/xxx-logo.png"` e os slots de uniforme. Trocar o arquivo
// sem reescrever o seed apaga o escudo editado da tela — e ele e conteudo do
// USUARIO, a camada que vence todas as outras. Por isso o seed e a fonte da
// varredura, e nao a pasta.
//
// ⚠️ SVG NAO ENTRA. E vetor; virar bitmap borra o escudo nas telas grandes.
//
// Recuperacao: `data/seeds/team-overrides.inline-backup.json` ainda tem o
// base64 original de tudo. Nada aqui e irreversivel.

import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const RAIZ = process.env.ULTRAFOOT_RAIZ ?? path.resolve(import.meta.dirname, "..")
const SEED = path.join(RAIZ, "data/seeds/team-overrides.json")
const PASTA = path.join(RAIZ, "public/overrides")

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
const AMOSTRA = Number(arg("--amostra") ?? 0)
const QUALIDADE = Number(arg("--qualidade") ?? 88)

const CONVERSIVEL = /\.(png|jpg|jpeg)$/i
const mb = (n) => (n / 1024 / 1024).toFixed(1)

const seed = JSON.parse(readFileSync(SEED, "utf-8"))

/** Todo lugar do seed que guarda um caminho de imagem. */
function* caminhos(obj) {
  for (const [chave, entrada] of Object.entries(obj)) {
    if (!entrada || typeof entrada !== "object") continue
    if (typeof entrada.logoUrl === "string") yield { dono: entrada, campo: "logoUrl", chave }
    for (const slot of ["home", "away", "third"]) {
      const kit = entrada.kits?.[slot]
      if (typeof kit === "string") yield { dono: entrada.kits, campo: slot, chave: `${chave}/${slot}` }
      else if (kit && typeof kit === "object" && typeof kit.url === "string") {
        yield { dono: kit, campo: "url", chave: `${chave}/${slot}` }
      }
    }
  }
}

const alvos = [...caminhos(seed)].filter(({ dono, campo }) => CONVERSIVEL.test(dono[campo]))
console.log(`seed: ${Object.keys(seed).length} clubes | imagens conversiveis referenciadas: ${alvos.length}`)
if (AMOSTRA) console.log(`\nMODO AMOSTRA: ${AMOSTRA}, nada e gravado\n`)

// Um arquivo pode ser referenciado por mais de um clube (mesmo escudo). Igual ao
// caso dos apelidos do manifesto de estadios: converter por referencia deixaria
// a segunda apontando para um arquivo apagado.
const trocaPorUrl = new Map()
let antes = 0, depois = 0, feitos = 0, faltando = 0, falhas = 0
const lista = AMOSTRA ? alvos.slice(0, AMOSTRA) : alvos

for (const { dono, campo } of lista) {
  const url = dono[campo]
  const ja = trocaPorUrl.get(url)
  if (ja) { if (!AMOSTRA) dono[campo] = ja; continue }

  const nome = path.basename(url)
  const origem = path.join(PASTA, nome)
  if (!existsSync(origem)) { faltando++; continue }

  try {
    const tam = statSync(origem).size
    const buf = await sharp(origem).webp({ quality: QUALIDADE, effort: 5 }).toBuffer()
    antes += tam; depois += buf.length

    if (!AMOSTRA) {
      const destinoNome = nome.replace(CONVERSIVEL, ".webp")
      writeFileSync(path.join(PASTA, destinoNome), buf)
      const nova = `/overrides/${destinoNome}`
      dono[campo] = nova
      trocaPorUrl.set(url, nova)
      // O seed vai ao disco a cada troca de lote (ver a licao do conversor de
      // estadios: apagar o original com o seed so na memoria quebra tudo se
      // parar no meio).
      if (feitos % 25 === 0) writeFileSync(SEED, JSON.stringify(seed, null, 1), "utf-8")
      unlinkSync(origem)
    }
    feitos++
  } catch (e) {
    falhas++
    console.error(`  ! ${nome}: ${e.message}`)
  }
}

if (!AMOSTRA) {
  writeFileSync(SEED, JSON.stringify(seed, null, 1), "utf-8")
  console.log("seed reescrito")
}

const economia = antes - depois
console.log(
  `\nconvertidos: ${feitos} | falhas: ${falhas} | sem arquivo: ${faltando}` +
  `\nantes: ${mb(antes)} MB -> depois: ${mb(depois)} MB` +
  `\neconomia: ${mb(economia)} MB (${antes ? ((economia / antes) * 100).toFixed(1) : 0}%)`,
)
