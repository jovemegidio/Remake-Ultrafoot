// Coleta o VALOR DE MERCADO de cada atleta no Transfermarkt, para recalibrar
// os overalls do jogo.
//
// O TM nao tem "overall" — isso e conceito de FIFA/FM. O que ele tem, e mantem
// atualizado, e o valor de mercado (€). E dele que o overall sera derivado no
// passo seguinte (apply), por mapeamento de quantis: preserva a DISTRIBUICAO de
// overalls que o jogo ja tem e reordena os atletas pela realidade, sem formula
// arbitraria de € -> pontos.
//
// Reaproveita as URLs de elenco ja resolvidas em tm-squads.json (1 req/clube).
//
//   node scripts/import-tm-values.mjs [--limit N] [--delay ms]

import { readFile, writeFile, rename } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const OUT = path.resolve("data/seeds/tm-squads.json")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

const args = process.argv.slice(2)
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity
const delayMs = args.includes("--delay") ? Number(args[args.indexOf("--delay") + 1]) : 1800
const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * "€ 12.00 mi." -> 12000000 | "€ 200 mil" -> 200000 | "-" -> null
 *
 * O DECIMAL AQUI E PONTO, nao virgula — conferido na pagina real ("€ 12.00
 * mi."). A primeira versao assumiu formato pt-BR, removia o ponto como
 * separador de milhar e inflava tudo em 100x (Brazao saiu €1,2 BILHAO).
 */
export function parseValor(txt) {
  const m = /€\s*([\d.,]+)\s*(mil|mi)/i.exec(txt ?? "")
  if (!m) return null
  const bruto = m[1]
  // Com ponto E virgula, o ponto e milhar; so virgula, ela e o decimal.
  const limpo = bruto.includes(".") && bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto.replace(",", ".")
  const n = Number(limpo)
  if (!Number.isFinite(n)) return null
  return Math.round(n * (m[2].toLowerCase() === "mi" ? 1_000_000 : 1_000))
}

/** Extrai tmId -> valor da pagina de elenco. */
export function extrairValores(html) {
  const mapa = new Map()
  for (const linha of html.split(/<tr class="(?:odd|even)[^"]*">/).slice(1)) {
    const id = linha.match(/\/profil\/spieler\/(\d+)"/)
    // O valor fica no link marktwertverlauf, ultima celula da linha.
    const val = linha.match(/marktwertverlauf[^>]*>\s*([^<]+?)\s*</)
    if (!id) continue
    const v = parseValor(val?.[1])
    if (v !== null) mapa.set(id[1], v)
  }
  return mapa
}

async function main() {
  const cache = JSON.parse(await readFile(OUT, "utf8"))
  const pendentes = Object.entries(cache.clubs)
    .filter(([, c]) => c.url && c.players?.length && !c.valoresEm)
    .slice(0, limit)
  const feitos = Object.values(cache.clubs).filter(c => c.valoresEm).length
  console.log(`${feitos} clubes ja com valores | processando ${pendentes.length}`)

  const salvar = async () => {
    const tmp = `${OUT}.tmp`
    await writeFile(tmp, JSON.stringify(cache, null, 1))
    await rename(tmp, OUT)
  }

  let ok = 0, erro = 0, atletas = 0
  const t0 = Date.now()
  for (const [, clube] of pendentes) {
    try {
      const res = await fetch(clube.url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
      if (!res.ok) { erro++; await sleep(delayMs); continue }
      const mapa = extrairValores(await res.text())
      for (const p of clube.players) {
        const v = mapa.get(String(p.tmId))
        if (v !== undefined) { p.valor = v; atletas++ }
      }
      clube.valoresEm = new Date().toISOString()
      ok++
    } catch { erro++ }
    const n = ok + erro
    if (n % 25 === 0) {
      const min = (Date.now() - t0) / 60000
      console.log(`${n}/${pendentes.length} | ${atletas} valores | ~${((pendentes.length - n) / (n / min)).toFixed(0)} min restantes`)
      await salvar()
    }
    await sleep(delayMs)
  }
  await salvar()
  const total = Object.values(cache.clubs).reduce((n, c) => n + (c.players ?? []).filter(p => p.valor != null).length, 0)
  console.log(`\nclubes ok: ${ok} | erro: ${erro} | atletas com valor (total): ${total}`)
}

if (process.argv[1]?.includes("import-tm-values")) main()
