// Coleta a URL da FOTO de cada atleta, reaproveitando o cache de elencos.
//
// Por que uma passada separada: a URL da foto embute um carimbo de tempo
// (`portrait/medium/834397-1782074650.jpg`) e SEM ele o servidor devolve 404 —
// testei `834397.jpg` e os demais sem carimbo, todos 404. Ou seja, não dá para
// derivar a foto a partir do tmId; ela tem de ser lida da página do elenco.
//
// Barato porque não repete a BUSCA do clube: `tm-squads.json` já guarda a `url`
// de cada elenco, então é 1 requisição por clube em vez de 2.
//
// Este script só coleta ENDEREÇOS (poucos bytes). Baixar as imagens é o passo
// seguinte e deliberadamente separado — ver scripts/download-tm-photos.mjs — para
// que a decisão de quanto peso entra no instalador seja tomada com o número na
// mão, e não como efeito colateral.
//
//   node scripts/import-tm-photos.mjs [--limit N] [--delay ms]

import { readFile, writeFile, rename } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const OUT = path.resolve("data/seeds/tm-squads.json")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

const args = process.argv.slice(2)
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity
const delayMs = args.includes("--delay") ? Number(args[args.indexOf("--delay") + 1]) : 2000
const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Casa cada atleta da página com a foto da própria linha (nunca por posição). */
export function extrairFotos(html) {
  const mapa = new Map()
  for (const linha of html.split(/<tr class="(?:odd|even)[^"]*">/).slice(1)) {
    const id = linha.match(/\/profil\/spieler\/(\d+)"/)
    // `data-src` e não `src`: as imagens entram por lazy-load e o `src` inicial
    // é um GIF transparente de 1px embutido em base64.
    const foto = linha.match(/data-src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/[^"]+)"/)
    if (id && foto) mapa.set(id[1], foto[1].replace(/\?.*$/, ""))
  }
  return mapa
}

async function main() {
  if (!existsSync(OUT)) {
    console.error("Falta data/seeds/tm-squads.json — rode antes: node scripts/import-tm-squads.mjs")
    process.exit(1)
  }
  const cache = JSON.parse(await readFile(OUT, "utf8"))

  const pendentes = Object.entries(cache.clubs)
    .filter(([, c]) => c.url && c.players?.length && !c.fotosEm)
    .slice(0, limit)

  const jaFeitos = Object.values(cache.clubs).filter(c => c.fotosEm).length
  console.log(`${jaFeitos} clubes ja processados | processando ${pendentes.length}`)

  let ok = 0, semFoto = 0, erro = 0, fotos = 0
  const t0 = Date.now()

  const salvar = async () => {
    const tmp = `${OUT}.tmp`
    await writeFile(tmp, JSON.stringify(cache, null, 1))
    await rename(tmp, OUT) // atômico: interromper não corrompe horas de trabalho
  }

  for (const [chave, clube] of pendentes) {
    try {
      const res = await fetch(clube.url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
      if (!res.ok) { erro++; await sleep(delayMs); continue }
      const mapa = extrairFotos(await res.text())
      let achadas = 0
      for (const p of clube.players) {
        const url = mapa.get(String(p.tmId))
        if (url) { p.foto = url; achadas++ }
      }
      clube.fotosEm = new Date().toISOString()
      fotos += achadas
      if (achadas === 0) semFoto++
      else ok++
    } catch {
      erro++
    }
    if ((ok + semFoto + erro) % 25 === 0) {
      const min = (Date.now() - t0) / 60000
      const restam = ((pendentes.length - ok - semFoto - erro) / ((ok + semFoto + erro) / min)).toFixed(0)
      console.log(`${ok + semFoto + erro}/${pendentes.length} | ${fotos} fotos | ~${restam} min restantes`)
      await salvar()
    }
    await sleep(delayMs)
  }

  await salvar()
  const total = Object.values(cache.clubs).reduce(
    (n, c) => n + (c.players ?? []).filter(p => p.foto).length, 0)
  console.log(`\nclubes com foto: ${ok} | sem nenhuma: ${semFoto} | erro: ${erro}`)
  console.log(`atletas com foto no cache: ${total}`)
  console.log(`tempo: ${((Date.now() - t0) / 60000).toFixed(1)} min`)
}

if (process.argv[1]?.includes("import-tm-photos")) main()
