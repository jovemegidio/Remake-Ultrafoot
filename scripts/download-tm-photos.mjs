// Baixa as fotos do Transfermarkt que o JOGO usa, para funcionarem offline.
//
// Baixa SOMENTE os `ft` assados no seed (~3.1 mil), nao os 46 mil do cache:
// foto de atleta que nenhuma tela resolve seria peso morto no instalador.
// Em "medium" (~8,8 KB/foto, medido) o lote custa ~27 MB.
//
// Destino: public/jogadores/tm/{ft}.jpg — a pasta public/jogadores ja e
// empacotada como resource do Tauri e servida offline por gameAssetUrl, entao
// nenhuma configuracao de build muda.
//
// No fim grava data/seeds/tm-fotos-local.json com a lista do que EXISTE em
// disco: lib/player-photos.ts so aponta para arquivo local se ele estiver
// nessa lista; o resto continua caindo na URL remota (e, offline, no avatar
// de iniciais). Assim uma falha de download nunca vira imagem quebrada.
//
//   node scripts/download-tm-photos.mjs [--delay ms] [--conc n]

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const SEED = path.resolve("data/seeds/imported-bf2026.json")
const DIR = path.resolve("public/jogadores/tm")
const MANIFEST = path.resolve("data/seeds/tm-fotos-local.json")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

const args = process.argv.slice(2)
const delayMs = args.includes("--delay") ? Number(args[args.indexOf("--delay") + 1]) : 150
const conc = args.includes("--conc") ? Number(args[args.indexOf("--conc") + 1]) : 3
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const seed = JSON.parse(await readFile(SEED, "utf8"))
  const fts = new Set()
  for (const t of seed.teams ?? []) for (const j of t.jogadores ?? []) if (j.ft) fts.add(j.ft)

  await mkdir(DIR, { recursive: true })
  const existentes = new Set((await readdir(DIR)).filter(f => f.endsWith(".jpg")).map(f => f.slice(0, -4)))
  const fila = [...fts].filter(ft => !existentes.has(ft))
  console.log(`fotos usadas pelo jogo: ${fts.size} | ja em disco: ${existentes.size} | baixando: ${fila.length}`)

  let ok = 0, falha = 0, bytes = 0
  let i = 0
  const t0 = Date.now()
  async function tarefa() {
    while (i < fila.length) {
      const ft = fila[i++]
      try {
        const res = await fetch(`https://img.a.transfermarkt.technology/portrait/medium/${ft}.jpg`, {
          headers: { "User-Agent": UA },
        })
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          await writeFile(path.join(DIR, `${ft}.jpg`), buf)
          bytes += buf.length
          ok++
        } else falha++
      } catch { falha++ }
      const n = ok + falha
      if (n % 250 === 0) {
        const min = (Date.now() - t0) / 60000
        console.log(`${n}/${fila.length} | ${(bytes / 1048576).toFixed(1)} MB | ~${((fila.length - n) / (n / min)).toFixed(0)} min restantes`)
      }
      await sleep(delayMs)
    }
  }
  await Promise.all(Array.from({ length: conc }, tarefa))

  // Manifesto = o que DE FATO esta em disco (inclui downloads de rodadas anteriores).
  const locais = (await readdir(DIR)).filter(f => f.endsWith(".jpg")).map(f => f.slice(0, -4)).sort()
  await writeFile(MANIFEST, JSON.stringify({ fts: locais }))

  console.log(`\nbaixadas: ${ok} | falhas: ${falha} | ${(bytes / 1048576).toFixed(1)} MB nesta rodada`)
  console.log(`total local: ${locais.length} fotos | manifesto: ${path.basename(MANIFEST)}`)
}

main()
