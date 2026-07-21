// Coleta a IDADE real de cada atleta, reaproveitando as URLs de elenco ja
// resolvidas (1 req/clube). O parser principal ja extrai idade; aqui so a
// gravamos no cache para os clubes ja baixados sem ela.
//
//   node scripts/import-tm-ages.mjs [--delay ms] [--conc n]
import { readFile, writeFile, rename } from "node:fs/promises"
import path from "node:path"

const OUT = path.resolve("data/seeds/tm-squads.json")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
const args = process.argv.slice(2)
const delayMs = args.includes("--delay") ? Number(args[args.indexOf("--delay")+1]) : 1800
const conc = args.includes("--conc") ? Number(args[args.indexOf("--conc")+1]) : 2
const sleep = ms => new Promise(r => setTimeout(r, ms))

/** tmId -> idade, da pagina de elenco. */
function extrairIdades(html) {
  const mapa = new Map()
  for (const linha of html.split(/<tr class="(?:odd|even)[^"]*">/).slice(1)) {
    const id = linha.match(/\/profil\/spieler\/(\d+)"/)
    const idade = linha.match(/\((\d{2})\)/)
    if (id && idade) mapa.set(id[1], Number(idade[1]))
  }
  return mapa
}

async function main() {
  const cache = JSON.parse(await readFile(OUT, "utf8"))
  const pend = Object.values(cache.clubs).filter(c => c.url && c.players?.length && !c.idadesEm)
  console.log(`clubes sem idade: ${pend.length}`)
  const salvar = async () => { const t = `${OUT}.tmp`; await writeFile(t, JSON.stringify(cache, null, 1)); await rename(t, OUT) }
  let i = 0, ok = 0, n = 0
  const t0 = Date.now()
  async function tarefa() {
    while (i < pend.length) {
      const c = pend[i++]
      try {
        const res = await fetch(c.url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
        if (res.ok) { const m = extrairIdades(await res.text()); for (const p of c.players) { const a = m.get(String(p.tmId)); if (a) p.idade = a } c.idadesEm = new Date().toISOString(); ok++ }
      } catch { /* ignora */ }
      if (++n % 25 === 0) { const min = (Date.now()-t0)/60000; console.log(`${n}/${pend.length} | ~${((pend.length-n)/(n/min)).toFixed(0)} min`); await salvar() }
      await sleep(delayMs)
    }
  }
  await Promise.all(Array.from({length:conc},tarefa))
  await salvar()
  const total = Object.values(cache.clubs).reduce((s,c)=>s+(c.players??[]).filter(p=>p.idade!=null).length,0)
  console.log(`\nclubes ok: ${ok} | atletas com idade: ${total}`)
}
main()
