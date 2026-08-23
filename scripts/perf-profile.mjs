// Tira um PERFIL DE CPU de uma tela e imprime as funcoes que mais custaram.
// Serve para responder "o que exatamente esta travando", em vez de deduzir.
//
//   node scripts/perf-profile.mjs /calendario
import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { existsSync, statSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript"],[".css","text/css"],[".json","application/json"],[".png","image/png"],[".jpg","image/jpeg"],[".svg","image/svg+xml"],[".ico","image/x-icon"],[".woff2","font/woff2"]])

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

const rota = process.argv[2] ?? "/calendario"
const SAVE = { version: 8, careerId: "perf", selectedTeamShort: "FLARJ", managerName: "Perf", season: 2026, week: 8 }

await new Promise(r => server.listen(0, r))
const port = server.address().port
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
await ctx.addInitScript(save => {
  try {
    localStorage.setItem("ultrafoot:save:perf", JSON.stringify(save))
    localStorage.setItem("ultrafoot:active-career", "perf")
    sessionStorage.setItem("ultrafoot:session-active", "true")
  } catch {}
}, SAVE)
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await cdp.send("Profiler.enable")
await cdp.send("Profiler.setSamplingInterval", { interval: 100 })
await cdp.send("Profiler.start")
await page.goto(`http://localhost:${port}${rota}`, { waitUntil: "domcontentloaded", timeout: 30000 })
await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
const { profile } = await cdp.send("Profiler.stop")

// Tempo PROPRIO de cada funcao (self time), a partir das amostras.
const porId = new Map(profile.nodes.map(n => [n.id, n]))
const self = new Map()
const total = profile.samples?.length ?? 0
const dt = profile.timeDeltas ?? []
profile.samples?.forEach((id, i) => {
  const n = porId.get(id)
  if (!n) return
  const cf = n.callFrame
  const arquivo = (cf.url || "").split("/").pop() || "(nativo)"
  const chave = process.env.PERF_POR_ARQUIVO ? arquivo : `${cf.functionName || "(anonima)"}  @ ${arquivo}:${cf.lineNumber + 1}`
  self.set(chave, (self.get(chave) ?? 0) + (dt[i] ?? 0))
})

const ordenado = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
console.log(`\n===== PERFIL DE CPU — ${rota} =====`)
console.log(`amostras: ${total}\n`)
console.log(`${"ms".padStart(8)}  funcao`)
for (const [chave, us] of ordenado) {
  const ms = Math.round(us / 1000)
  if (ms < 1) continue
  console.log(`${String(ms).padStart(8)}  ${chave}`)
}

await browser.close()
server.close()
