// O GATE DO MANIFESTO DE FOTOS (1.0.344).
//
// ⚠️ POR QUE ELE EXISTE. O manifesto passou a ser gravado compactado: a pasta
// `/jogadores/` e a extensão `.webp`, repetidas em 26.702 entradas, saíram do
// arquivo e são reconstruídas na carga.
//
// Errar aqui é INVISÍVEL no code review e visível para o jogador do pior jeito:
// uma chave reconstruída errado não dá erro, dá o ROSTO DE OUTRO ATLETA — e este
// projeto já colou rosto no jogador errado antes. Por isso o gate não confere
// amostra: reconstrói o mapa inteiro e compara entrada por entrada com o
// original.
//
// Uso: npx tsx scripts/test-manifesto-de-fotos.ts

import { readFileSync, existsSync, statSync } from "node:fs"
import path from "node:path"

import { __expandirManifestoDeFotos } from "@/lib/player-photos"

const RAIZ = process.cwd()
const FONTE = path.join(RAIZ, "data/seeds/faces-manifest.json")
const COMPACTO = path.join(RAIZ, "data/seeds/faces-manifest-compacto.json")

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

if (!existsSync(COMPACTO)) {
  console.log("FALHA: faces-manifest-compacto.json nao existe — rode "
    + "node scripts/compactar-manifesto-de-fotos.mjs. O bundle importa ESTE arquivo.")
  process.exit(1)
}

const original = (JSON.parse(readFileSync(FONTE, "utf-8")).entries ?? {}) as Record<string, string>
const reconstruido = __expandirManifestoDeFotos(JSON.parse(readFileSync(COMPACTO, "utf-8")))

const chavesOriginais = Object.keys(original)
const chavesVoltadas = Object.keys(reconstruido)
if (chavesOriginais.length !== chavesVoltadas.length) {
  erro(`entradas: ${chavesOriginais.length} no original x ${chavesVoltadas.length} no reconstruido`)
}

let divergencias = 0
for (const chave of chavesOriginais) {
  if (original[chave] !== reconstruido[chave]) {
    divergencias++
    if (divergencias <= 5) {
      erro(`"${chave}": ${JSON.stringify(original[chave])} -> ${JSON.stringify(reconstruido[chave])}`)
    }
  }
}
if (divergencias > 5) erro(`... e mais ${divergencias - 5} foto(s) divergente(s)`)

// Nenhuma chave INVENTADA: uma entrada a mais apontaria foto para quem nao tem.
for (const chave of chavesVoltadas) {
  if (!(chave in original)) { erro(`"${chave}" existe no reconstruido e NAO no original`); break }
}

console.log(`${chavesOriginais.length} fotos conferidas uma a uma`)

const antesMB = statSync(FONTE).size / 1048576
const depoisMB = statSync(COMPACTO).size / 1048576
const ganho = Math.round((1 - depoisMB / antesMB) * 100)
if (ganho < 15) erro(`o compacto so ficou ${ganho}% menor (${antesMB.toFixed(2)} -> ${depoisMB.toFixed(2)} MB)`)
console.log(`tamanho: ${antesMB.toFixed(2)} MB -> ${depoisMB.toFixed(2)} MB (${ganho}% menor)`)

console.log(falhas === 0
  ? "\nMANIFESTO OK — cada atleta continua com a MESMA foto de antes."
  : `\n${falhas} problema(s): o manifesto compacto NAO reproduz o original.`)
process.exit(falhas === 0 ? 0 : 1)
