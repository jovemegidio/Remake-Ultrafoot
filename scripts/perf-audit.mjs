// Mede o TEMPO real de carregamento de cada tela do jogo, servindo o build
// estatico e navegando com um browser de verdade. Serve para achar as telas
// lentas de forma objetiva, em vez de por impressao.
//
//   node scripts/perf-audit.mjs
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
  // Uma rota exportada existe como DIRETÓRIO (`out/elenco/`). Devolver esse
  // caminho como application/octet-stream faz o Chromium iniciar um download e
  // o auditor registrar 0 ms. Só retornamos `raw` quando ele é arquivo.
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

const ROTAS_PADRAO = [
  "/", "/elenco", "/elenco/gerenciamento", "/mercado", "/calendario", "/competicoes",
  "/financas", "/estatisticas", "/notificacoes", "/configuracoes", "/partida",
  "/treinamento", "/clube", "/olheiros", "/historico", "/editar",
]
const ROTAS = process.env.PERF_ROUTES
  ? process.env.PERF_ROUTES.split(",").map(rota => rota.trim()).filter(Boolean)
  : ROTAS_PADRAO

// Save minimo para as telas hidratarem como um jogador real (time selecionado).
const SAVE = { version: 8, careerId: "perf", selectedTeamShort: "FLARJ", managerName: "Perf", season: 2026, week: 8 }

await new Promise(r => server.listen(0, r))
const port = server.address().port
const browser = await chromium.launch()

// Contexto novo por rota: mede carga FRIA de verdade. Reutilizar o mesmo contexto
// mantinha todos os chunks no cache depois da primeira tela e fazia as seguintes
// aparecerem como 0 ms. A sessão também precisa estar ativa; sem ela o escritório
// redireciona para a splash e a medição deixa de representar a rota solicitada.
const linhas = []
for (const rota of ROTAS) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await ctx.addInitScript(save => {
    try {
      localStorage.setItem("ultrafoot:save:perf", JSON.stringify(save))
      localStorage.setItem("ultrafoot:active-career", "perf")
      sessionStorage.setItem("ultrafoot:session-active", "true")
    } catch {}
  }, SAVE)
  const page = await ctx.newPage()
  const recursosComFalha = []
  page.on("response", response => {
    if (response.status() >= 400) recursosComFalha.push(`${response.status()} ${response.url()}`)
  })
  page.on("requestfailed", request => {
    recursosComFalha.push(`${request.failure()?.errorText ?? "falhou"} ${request.url()}`)
  })
  const t0 = Date.now()
  let domContentLoaded = null
  let status = null
  let erro = null
  try {
    const response = await page.goto(`http://localhost:${port}${rota}`, { waitUntil: "domcontentloaded", timeout: 30000 })
    status = response?.status() ?? null
    if (!response?.ok()) throw new Error(`HTTP ${status ?? "sem resposta"}`)
    domContentLoaded = Date.now() - t0
    // Espera a tela ficar "quieta" (sem requisicoes por 500ms) ou 8s.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
  } catch (e) {
    erro = e instanceof Error ? e.message.split("\n")[0] : String(e)
  }
  const total = Date.now() - t0
  // Metrica do proprio navegador: quando o primeiro conteudo apareceu.
  const fcp = await page.evaluate(() => {
    const e = performance.getEntriesByName("first-contentful-paint")[0]
    return e ? Math.round(e.startTime) : null
  }).catch(() => null)
  linhas.push({ rota, dom: domContentLoaded, fcp, total, status, erro, recursosComFalha })
  await ctx.close()
}

await browser.close()
server.close()

linhas.sort((a, b) => b.total - a.total)
console.log("\n===== TEMPO DE CARREGAMENTO POR TELA =====")
console.log("(dom = DOM pronto | fcp = 1o conteudo pintado | idle = estabilizou)\n")
console.log(`${"rota".padEnd(26)} ${"http".padStart(5)} ${"dom".padStart(7)} ${"fcp".padStart(7)} ${"idle".padStart(7)}`)
for (const l of linhas) {
  const dom = l.dom == null ? "ERRO" : `${l.dom}ms`
  const alerta = l.total > 3000 ? "  <- LENTA" : l.total > 1800 ? "  <- atenção" : ""
  console.log(`${l.rota.padEnd(26)} ${String(l.status ?? "-").padStart(5)} ${dom.padStart(7)} ${((l.fcp ?? "?") + "ms").padStart(7)} ${(l.total + "ms").padStart(7)}${alerta}`)
  if (l.erro) console.log(`  erro: ${l.erro}`)
  if (l.recursosComFalha.length) {
    console.log(`  recursos com falha: ${l.recursosComFalha.length}`)
    for (const item of l.recursosComFalha.slice(0, 3)) console.log(`    ${item}`)
  }
}
const lentas = linhas.filter(l => l.total > 3000)
const falhas = linhas.filter(l => l.erro)
console.log(`\n${lentas.length} tela(s) acima de 3s; ${falhas.length} falha(s) de navegação.`)

if (falhas.length > 0) process.exitCode = 1
