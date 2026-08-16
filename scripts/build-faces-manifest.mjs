import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const photosDir = path.join(root, "public", "jogadores")
const overridesFile = path.join(root, "data", "seeds", "player_photo_overrides.json")
const outputFile = path.join(root, "data", "seeds", "faces-manifest.json")
const overrides = JSON.parse(await readFile(overridesFile, "utf8"))
const files = new Set(await readdir(photosDir))
const entries = {}
let missing = 0

/**
 * ⚠️ O OVERRIDE VEM EM DUAS FORMAS, E IGNORAR UMA DELAS APAGA RETRATO.
 *
 * A maioria das entradas é uma URL (`/jogadores/x.webp`), mas 289 são o NOME
 * CRU do arquivo (`df11-tm_22415.webp`) — vieram do catálogo DF11 por outro
 * caminho. O filtro `startsWith("/jogadores/")` descartava essas em silêncio.
 *
 * Como o manifesto no repositório JÁ TINHA as 289 (foi gerado por uma versão
 * anterior deste script, que as aceitava), o defeito só aparecia quando alguém
 * rodasse o gerador de novo: `available` caía de 26.627 para 26.372 e 289
 * atletas perdiam a foto, sem erro nenhum. Foi o que aconteceu aqui em
 * 16/08/2026, ao regerar o manifesto depois de converter os rostos para WebP —
 * e por pouco não entrou na conta da conversão, que não tinha culpa.
 *
 * Aceitar as duas formas e normalizar para a URL é o conserto: o consumidor
 * (`lib/player-photos`) só entende `/jogadores/...`.
 */
for (const [key, valor] of Object.entries(overrides)) {
  if (key.startsWith("_") || typeof valor !== "string" || !valor) continue
  const url = valor.startsWith("/jogadores/")
    ? valor
    : valor.includes("/") ? null : `/jogadores/${valor}`
  if (!url) continue
  const filename = decodeURIComponent(url.slice("/jogadores/".length))
  if (files.has(filename)) entries[key] = url
  else missing++
}

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  available: Object.keys(entries).length,
  missing,
  entries,
}
await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`faces disponíveis=${manifest.available} referências sem arquivo=${manifest.missing}`)
