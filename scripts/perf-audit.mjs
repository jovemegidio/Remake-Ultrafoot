// Mede o TEMPO real de carregamento de cada tela do jogo, servindo o build
// estatico e navegando com um browser de verdade. Serve para achar as telas
// lentas de forma objetiva, em vez de por impressao.
//
//   node scripts/perf-audit.mjs
import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript"],[".css","text/css"],[".json","application/json"],[".png","image/png"],[".jpg","image/jpeg"],[".jpeg","image/jpeg"],[".svg","image/svg+xml"],[".ico","image/x-icon"],[".webm","audio/webm"],[".mp3","audio/mpeg"],[".woff2","font/woff2"]])

function resolveReq(urlPath) {
  const dec = decodeURIComponent(urlPath.split("?")[0])
  const clean = dec === "/" ? "/index.html" : dec
  const raw = path.join(outDir, clean)
  if (existsSync(raw)) return raw
  if (!path.extname(clean)) {
    const idx = path.join(outDir, clean, "index.html")
    if (existsSync(idx)) return idx
  }
  return raw
}

const server = createServer(async (req, res) => {
  try {
    const target = path.resolve(resolveReq(req.url ?? "/"))
    if (!target.startsWith(outDir) || !existsSync(target)) { res.statusCode = 404; res.end("nf"); return }
    res.setHeader("Content-Type", mime.get(path.extname(target)) ?? "application/octet-stream")
    res.end(await readFile(target))
  } catch { res.statusCode = 500; res.end("err") }
})

const ROTAS = [
  "/", "/elenco", "/elenco/gerenciamento", "/mercado", "/calendario", "/competicoes",
  "/financas", "/estatisticas", "/notificacoes", "/configuracoes", "/partida",
  "/treinamento", "/clube", "/olheiros", "/historico", "/editar",
]

// Save minimo para as telas hidratarem como um jogador real (time selecionado).
const SAVE = { version: 8, careerId: "perf", selectedTeamShort: "FLARJ", managerName: "Perf", season: 2026, week: 8 }

await new Promise(r => server.listen(0, r))
const port = server.address().port
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
await ctx.addInitScript(save => {
  try { localStorage.setItem("ultrafoot:save:perf", JSON.stringify(save)); localStorage.setItem("ultrafoot:active-career", "perf") } catch {}
}, SAVE)

// full reload por rota: mede parse+hidratacao isolados, nao SPA
const linhas = []
for (const rota of ROTAS) {
  const page = await ctx.newPage()
  const t0 = Date.now()
  let domContentLoaded = 0
  try {
    await page.goto(`http://localhost:${port}${rota}`, { waitUntil: "domcontentloaded", timeout: 30000 })
    domContentLoaded = Date.now() - t0
    // Espera a tela ficar "quieta" (sem requisicoes por 500ms) ou 8s.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
  } catch {}
  const total = Date.now() - t0
  // Metrica do proprio navegador: quando o primeiro conteudo apareceu.
  const fcp = await page.evaluate(() => {
    const e = performance.getEntriesByName("first-contentful-paint")[0]
    return e ? Math.round(e.startTime) : null
  }).catch(() => null)
  linhas.push({ rota, dom: domContentLoaded, fcp, total })
  await page.close()
}

await browser.close()
server.close()

linhas.sort((a, b) => b.total - a.total)
console.log("\n===== TEMPO DE CARREGAMENTO POR TELA =====")
console.log("(dom = DOM pronto | fcp = 1o conteudo pintado | idle = estabilizou)\n")
console.log(`${"rota".padEnd(26)} ${"dom".padStart(7)} ${"fcp".padStart(7)} ${"idle".padStart(7)}`)
for (const l of linhas) {
  const alerta = l.total > 3000 ? "  <- LENTA" : l.total > 1800 ? "  <- atenção" : ""
  console.log(`${l.rota.padEnd(26)} ${(l.dom + "ms").padStart(7)} ${((l.fcp ?? "?") + "ms").padStart(7)} ${(l.total + "ms").padStart(7)}${alerta}`)
}
const lentas = linhas.filter(l => l.total > 3000)
console.log(`\n${lentas.length} tela(s) acima de 3s.`)
