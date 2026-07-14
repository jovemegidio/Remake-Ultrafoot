// Reproduz: "os nomes dos jogadores nao aparecem no Gerenciamento".
//
// Compara o elenco RENDERIZADO em /elenco/gerenciamento com os jogadores REAIS do
// clube no seed. Se a tela mostrar nomes que nao existem no elenco do time, ela esta
// caindo no elenco MOCK (buildElencoPlayers volta playersData/benchData quando nao
// encontra >= 11 jogadores reais).
//
// Roda para varios clubes, para separar "bug do time europeu" de "bug geral".
//
// Uso: npm run build:qa && node scripts/qa-squad-names.mjs

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat, readFile as rf } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { assertFreshBuild } from "./qa-lib.mjs"

assertFreshBuild()

const outDir = path.resolve("out")
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript"], [".css", "text/css"],
  [".json", "application/json"], [".png", "image/png"], [".jpg", "image/jpeg"],
  [".svg", "image/svg+xml"], [".woff2", "font/woff2"],
])
function resolveReq(u) {
  const d = decodeURIComponent(u.split("?")[0])
  const c = d === "/" ? "/index.html" : d
  const r = path.join(outDir, c)
  if (existsSync(r)) return r
  if (!path.extname(c)) {
    const i = path.join(outDir, c, "index.html")
    if (existsSync(i)) return i
  }
  return r
}
const srv = createServer(async (q, s) => {
  try {
    const t = path.resolve(resolveReq(q.url ?? "/"))
    const st = await stat(t)
    const fp = st.isDirectory() ? path.join(t, "index.html") : t
    const b = await readFile(fp)
    s.writeHead(200, { "content-type": mime.get(path.extname(fp).toLowerCase()) ?? "application/octet-stream", "cache-control": "no-store" })
    s.end(b)
  } catch { s.writeHead(404); s.end("nf") }
})
await new Promise((r) => srv.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${srv.address().port}`

// Elenco REAL de cada clube, direto do seed — a fonte da verdade.
const seed = JSON.parse(readFileSync("data/seeds/imported-bf2026.json", "utf8"))
const seedTeams = seed.teams ?? []
function realSquad(nome) {
  const t = seedTeams.find((x) => (x.nome || "").toLowerCase() === nome.toLowerCase())
  return (t?.jogadores ?? []).map((p) => p.nome).filter(Boolean)
}

// short = como o save identifica; nome = como o teams-data chama.
const CLUBS = [
  { short: "JVT", nome: "Juventus" },
  { short: "BAR", nome: "Barcelona" },
  { short: "PAL", nome: "Palmeiras" },
  { short: "FLA", nome: "Flamengo" },
]

const browser = await chromium.launch({ headless: true })
let failures = 0

for (const club of CLUBS) {
  const real = realSquad(club.nome)
  const page = await browser.newPage()
  await page.addInitScript((short) => {
    localStorage.setItem("ultrafoot-save", JSON.stringify({
      version: 4, selectedTeamShort: short, managerName: "QA", season: 2026, week: 0,
      language: "pt-BR", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(),
      multiplayerEnabled: false, managers: [], activeManagerId: null,
      controllerType: "playstation", controllerBindings: {},
    }))
    sessionStorage.setItem("ultrafoot:session-active", "true")
  }, club.short)

  await page.goto(`${base}/elenco/gerenciamento/`, { waitUntil: "networkidle", timeout: 30000 })
  await page.waitForTimeout(1200)

  // Nomes visiveis na secao de RESERVAS (nomes completos, nao truncados como no campo).
  const rendered = await page.evaluate(() => {
    const out = []
    document.querySelectorAll("*").forEach(() => {})
    // Os cards de reserva trazem o nome em um <span>/<div> curto; pegamos o texto todo
    // e deixamos a comparacao por inclusao resolver.
    return document.body.innerText
  })

  const found = real.filter((n) => rendered.includes(n))
  const pct = real.length ? Math.round((found.length / real.length) * 100) : 0

  const label = `${club.nome} (${club.short})`.padEnd(22)
  if (real.length === 0) {
    console.log(`?? ${label} sem elenco no seed — nada a comparar`)
  } else if (found.length === 0) {
    console.log(`XX ${label} NENHUM dos ${real.length} jogadores reais aparece na tela -> ELENCO MOCK`)
    failures++
  } else if (pct < 30) {
    console.log(`XX ${label} so ${found.length}/${real.length} (${pct}%) dos jogadores reais aparecem`)
    failures++
  } else {
    console.log(`OK ${label} ${found.length}/${real.length} (${pct}%) jogadores reais na tela`)
  }

  await page.close()
}

await browser.close()
srv.close()

console.log(failures ? `\nRESULTADO: ${failures} clube(s) com elenco MOCK` : "\nRESULTADO: OK — todos com elenco real")
process.exitCode = failures ? 1 : 0
