// Auditoria end-to-end: injeta um save e navega por TODAS as telas do jogo,
// capturando pageerror / console.error / respostas 4xx / requests falhos, e
// medindo o texto visivel (para detectar telas vazias). Serve o export estatico.
import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
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
function server() {
  return createServer(async (req, res) => {
    try {
      const target = path.resolve(resolveReq(req.url ?? "/"))
      const st = await stat(target)
      const fp = st.isDirectory() ? path.join(target, "index.html") : target
      const body = await readFile(fp)
      res.writeHead(200, { "content-type": mime.get(path.extname(fp).toLowerCase()) ?? "application/octet-stream", "cache-control": "no-store" })
      res.end(body)
    } catch { res.writeHead(404); res.end("Not found") }
  })
}

const SAVE = {
  version: 4, selectedTeamShort: "FLA", managerName: "QA Auditor", season: 2026, week: 0,
  language: "pt-BR", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(),
  multiplayerEnabled: false, managers: [], activeManagerId: null,
  controllerType: "playstation", controllerBindings: {},
}

const ROUTES = [
  "/", "/elenco", "/elenco/gerenciamento", "/elenco/taticas", "/elenco/escalacoes",
  "/mercado", "/transferencias", "/contratos", "/olheiros", "/base", "/treinamento",
  "/partida", "/partida/escalacao", "/partida/ao-vivo", "/calendario", "/competicoes",
  "/clube", "/financas", "/infraestrutura", "/taticas", "/estatisticas", "/historico",
  "/mensagens", "/notificacoes", "/central", "/central-da-temporada", "/dashboard",
  "/reunioes", "/imprensa", "/vestiario", "/desafios", "/relatorios", "/adversarios",
  "/analise-partida", "/selecao", "/salvar", "/configuracoes", "/editar",
]

// Padroes suspeitos de dado mock/placeholder no texto renderizado.
const MOCK_PATTERNS = [/lorem ipsum/i, /placeholder/i, /\bmock\b/i, /jogador teste/i, /time teste/i, /\bTODO\b/, /undefined/i, /NaN/, /\[object Object\]/]

const srv = server()
await new Promise(r => srv.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${srv.address().port}`
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(s => {
  window.localStorage.setItem("ultrafoot:save", JSON.stringify(s))
  window.sessionStorage.setItem("ultrafoot:session-active", "true")
}, SAVE)

const results = []
for (const route of ROUTES) {
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", e => errors.push("JS: " + e.message))
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()) })
  page.on("response", r => { const s = r.status(); const u = r.url(); if (s >= 400 && !u.includes("favicon") && !/\.(png|jpg|jpeg|webm|mp3|svg)(\?|$)/i.test(u)) errors.push(`${s} ${u.replace(base,"")}`) })
  let bodyText = "", mockHits = []
  try {
    await page.goto(`${base}${route}/`, { waitUntil: "networkidle", timeout: 20000 })
    await page.waitForTimeout(600)
    bodyText = (await page.locator("body").innerText().catch(() => "")) || ""
    mockHits = MOCK_PATTERNS.filter(p => p.test(bodyText)).map(p => p.source)
  } catch (e) { errors.push("NAV: " + e.message.split("\n")[0]) }
  // ignora ruido esperado no modo web (assets remotos/gameasset)
  const real = errors.filter(e => !/net::ERR_ABORTED|Failed to load resource|ERR_NAME_NOT_RESOLVED|raw.githubusercontent|game-asset/i.test(e))
  results.push({ route, errCount: real.length, errs: real.slice(0, 4), textLen: bodyText.trim().length, mock: mockHits })
  await page.close()
}

await browser.close()
await new Promise(r => srv.close(r))

console.log("\n===== AUDITORIA DE TELAS =====")
let problems = 0
for (const r of results) {
  const flags = []
  if (r.errCount > 0) flags.push(`${r.errCount} erro(s)`)
  if (r.textLen < 120) flags.push(`TELA VAZIA? (${r.textLen} chars)`)
  if (r.mock.length) flags.push(`MOCK: ${r.mock.join(", ")}`)
  const status = flags.length ? "⚠ " + flags.join(" | ") : "OK"
  if (flags.length) problems++
  console.log(`${flags.length ? "FAIL" : "OK  "} ${r.route.padEnd(26)} ${status}`)
  for (const e of r.errs) console.log(`        ${e.slice(0, 160)}`)
}
console.log(`\n${problems} tela(s) com possiveis problemas de ${results.length} auditadas.`)
