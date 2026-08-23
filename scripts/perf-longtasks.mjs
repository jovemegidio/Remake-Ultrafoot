// Mede as LONG TASKS (blocos que prendem a thread da interface) de cada tela,
// servindo o build estatico e observando com PerformanceObserver de verdade.
//
// Complementa scripts/perf-audit.mjs: aquele diz QUANTO uma tela demora; este
// diz se o tempo foi gasto em UM bloco sincrono que congela o jogo. Uma tela de
// 1,7 s feita de 30 tarefas de 50 ms responde ao mouse; a mesma 1,7 s em uma
// tarefa unica de 1.400 ms nao responde a nada.
//
//   node scripts/perf-longtasks.mjs
import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { existsSync, statSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript"],[".css","text/css"],[".json","application/json"],[".png","image/png"],[".jpg","image/jpeg"],[".jpeg","image/jpeg"],[".svg","image/svg+xml"],[".ico","image/x-icon"],[".webm","audio/webm"],[".mp3","audio/mpeg"],[".woff2","font/woff2"]])

function resolveReq(urlPath) {
  const dec = decodeURIComponent(urlPath.split("?")[0])
  const clean = dec === "/" ? "/index.html" : dec
  const raw = path.join(outDir, clean)
  if (existsSync(raw) && statSync(raw).isFile()) return raw
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

const ROTAS = process.env.PERF_ROUTES
  ? process.env.PERF_ROUTES.split(",").map(r => r.trim()).filter(Boolean)
  : ["/", "/mercado", "/elenco", "/elenco/gerenciamento", "/calendario", "/competicoes", "/financas", "/olheiros"]

const SAVE = { version: 8, careerId: "perf", selectedTeamShort: "FLARJ", managerName: "Perf", season: 2026, week: 8 }

await new Promise(r => server.listen(0, r))
const port = server.address().port
const browser = await chromium.launch()

const linhas = []
for (const rota of ROTAS) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  // O observer precisa existir ANTES de qualquer script da pagina, senao as
  // tarefas do boot — justamente as caras — acontecem sem ninguem olhando.
  await ctx.addInitScript(save => {
    try {
      localStorage.setItem("ultrafoot:save:perf", JSON.stringify(save))
      localStorage.setItem("ultrafoot:active-career", "perf")
      sessionStorage.setItem("ultrafoot:session-active", "true")
    } catch {}
    window.__longTasks = []
    try {
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration))
      }).observe({ type: "longtask", buffered: true })
    } catch {}
  }, SAVE)
  const page = await ctx.newPage()
  try {
    await page.goto(`http://localhost:${port}${rota}`, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
  } catch {}
  const tarefas = await page.evaluate(() => window.__longTasks ?? []).catch(() => [])
  const total = tarefas.reduce((a, b) => a + b, 0)
  const maior = tarefas.length ? Math.max(...tarefas) : 0
  // TBT: o que passa de 50 ms em cada tarefa e o que o usuario sente como travo.
  const tbt = tarefas.reduce((a, b) => a + Math.max(0, b - 50), 0)
  linhas.push({ rota, n: tarefas.length, maior, total, tbt })
  await ctx.close()
}

await browser.close()
server.close()

linhas.sort((a, b) => b.maior - a.maior)
console.log("\n===== TRAVAMENTOS DA THREAD POR TELA =====")
console.log("(maior = pior bloco unico | soma = tempo total travado | tbt = o que passa de 50ms)\n")
console.log(`${"rota".padEnd(26)} ${"n".padStart(4)} ${"maior".padStart(8)} ${"soma".padStart(8)} ${"tbt".padStart(8)}`)
for (const l of linhas) {
  const alerta = l.maior > 500 ? "  <- CONGELA" : l.maior > 200 ? "  <- atenção" : ""
  console.log(`${l.rota.padEnd(26)} ${String(l.n).padStart(4)} ${(l.maior + "ms").padStart(8)} ${(l.total + "ms").padStart(8)} ${(l.tbt + "ms").padStart(8)}${alerta}`)
}
