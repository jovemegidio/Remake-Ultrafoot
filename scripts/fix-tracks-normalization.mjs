// Alinha o tracks.json com os nomes REAIS dos arquivos em public/music.
//
// Cinco faixas com acento no nome (Luxuria, Cassia, CIDADAO...) nunca tocavam: o
// tracks.json guardava o nome em uma forma Unicode (NFD, com acento decomposto) e o
// disco usa outra (NFC). O handler Rust compara byte a byte -> arquivo nao encontrado
// -> 404 -> e, como a playlist e embaralhada, essa faixa caia no comeco e travava o
// player no "carregando".
//
// Em vez de normalizar em runtime (que exigiria uma crate de Unicode no Rust), corrigimos
// o DADO: cada src passa a apontar para o nome exato que existe em disco.
//
// Uso: node scripts/fix-tracks-normalization.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs"

const MUSIC_DIR = "public/music"
const TRACKS = `${MUSIC_DIR}/tracks.json`

const files = readdirSync(MUSIC_DIR).filter((f) => !f.endsWith(".json"))
// Indexa os arquivos reais pela forma NFC, que e a chave de comparacao estavel.
const byNFC = new Map(files.map((f) => [f.normalize("NFC"), f]))

const tracks = JSON.parse(readFileSync(TRACKS, "utf8"))

let fixed = 0
let missing = 0

for (const track of tracks) {
  const current = decodeURIComponent(track.src.replace(/^\/music\//, ""))
  if (files.includes(current)) continue // ja bate exatamente

  const real = byNFC.get(current.normalize("NFC"))
  if (!real) {
    console.log(`AUSENTE  ${current}`)
    missing++
    continue
  }

  track.src = `/music/${encodeURIComponent(real)}`
  console.log(`CORRIGIDO ${current}`)
  fixed++
}

if (fixed) {
  writeFileSync(TRACKS, JSON.stringify(tracks, null, 4), "utf8")
}

console.log(`\n${fixed} faixa(s) corrigida(s), ${missing} sem arquivo em disco.`)
