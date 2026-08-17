// COMPACTA O MANIFESTO DE FOTOS PARA O BUNDLE (1.0.344).
//
// ⚠️ O PROBLEMA MEDIDO. `faces-manifest.json` (1,36 MB) é importado
// ESTATICAMENTE por `lib/player-photos.ts`, que por sua vez é alcançado por
// praticamente toda tela. Ele cai no chunk COMPARTILHADO — 2,20 MB que o jogo
// baixa mesmo numa tela que não desenha foto nenhuma.
//
// ⚠️ POR QUE COMPACTAR E NÃO TORNAR ASSÍNCRONO. O caminho "carregar sob demanda"
// é o que resolveu os elencos, mas aqui ele tem um custo visível: o manifesto é
// lido em RENDER para decidir a foto, e com cache frio o jogador veria as
// iniciais no lugar do rosto até o arquivo chegar. Compactar não muda o momento
// da carga — só o tamanho — então não troca peso por regressão na tela.
//
// A REDUNDÂNCIA, medida no próprio arquivo (26.702 entradas):
//   · TODAS apontam para a mesma pasta `/jogadores/`;
//   · 26.660 terminam em `.webp` (só 42 são `.jpg`);
//   · 1.971 têm o valor inteiramente derivável da chave.
// Ou seja, o arquivo repetia `"/jogadores/"` e `".webp"` 26 mil vezes.
//
// Uso: node scripts/compactar-manifesto-de-fotos.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

const RAIZ = process.cwd()
const FONTE = path.join(RAIZ, "data/seeds/faces-manifest.json")
const DESTINO = path.join(RAIZ, "data/seeds/faces-manifest-compacto.json")

const DIR = "/jogadores/"
const EXT = ".webp"

if (!existsSync(FONTE)) {
  console.log("manifesto de fotos: fonte ausente, nada a compactar")
  process.exit(0)
}

const original = JSON.parse(readFileSync(FONTE, "utf-8"))
const entradas = original.entries ?? {}

/** Valor = DIR + chave + EXT. Só a chave precisa ser gravada. */
const deriv = []
/** Valor = DIR + <base> + EXT. Grava só a base. */
const base = {}
/** Qualquer outra coisa: grava o caminho inteiro, sem interpretar. */
const excecoes = {}

for (const [chave, valor] of Object.entries(entradas)) {
  const s = String(valor)
  if (s === DIR + chave + EXT) { deriv.push(chave); continue }
  if (s.startsWith(DIR) && s.endsWith(EXT)) { base[chave] = s.slice(DIR.length, -EXT.length); continue }
  excecoes[chave] = s
}

writeFileSync(
  DESTINO,
  JSON.stringify({ v: 1, dir: DIR, ext: EXT, deriv, base, excecoes }),
  "utf-8",
)

const antes = readFileSync(FONTE).length / 1048576
const depois = readFileSync(DESTINO).length / 1048576
console.log(
  `manifesto de fotos: ${antes.toFixed(2)} MB -> ${depois.toFixed(2)} MB `
  + `(${Math.round((1 - depois / antes) * 100)}% menor, ${Object.keys(entradas).length} fotos; `
  + `${deriv.length} derivadas, ${Object.keys(base).length} por base, ${Object.keys(excecoes).length} excecoes)`,
)
