// Auditoria end-to-end: injeta um save e navega por TODAS as telas do jogo,
// capturando pageerror / console.error / respostas 4xx / requests falhos, e
// medindo o texto visivel (para detectar telas vazias). Serve o export estatico.
import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { assertFreshBuild } from "./qa-lib.mjs"

assertFreshBuild()

const outDir = path.resolve("out")
// ⚠️ O `out/` NAO E O JOGO INSTALADO — e por ignorar isso que esta auditoria
// mentia (17/08/2026, 1.0.347).
//
// O build REMOVE de proposito as pastas pesadas de imagem do `out/` (escudos,
// camisas, jogadores): no app instalado elas nao viajam pelo HTML, viajam como
// `bundle.resources` do Tauri. Servindo so o `out/`, todo escudo virava 404 e a
// auditoria reprovava 39 de 40 TELAS por um defeito que nao existe — 74 alarmes
// falsos que enterraram os DOIS defeitos reais que ela tinha achado de verdade.
//
// A reserva no `public/` faz o servidor entregar o que o jogo instalado entrega.
// Uma ferramenta de QA que grita errado e uma ferramenta que ninguem le.
const publicDir = path.resolve("public")
const mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript"],[".css","text/css"],[".json","application/json"],[".png","image/png"],[".jpg","image/jpeg"],[".jpeg","image/jpeg"],[".webp","image/webp"],[".avif","image/avif"],[".gif","image/gif"],[".svg","image/svg+xml"],[".ico","image/x-icon"],[".webm","audio/webm"],[".mp3","audio/mpeg"],[".ogg","audio/ogg"],[".woff2","font/woff2"],[".woff","font/woff"]])

function resolveReq(urlPath) {
  const dec = decodeURIComponent(urlPath.split("?")[0])
  const clean = dec === "/" ? "/index.html" : dec
  const raw = path.join(outDir, clean)
  if (existsSync(raw)) return raw
  if (!path.extname(clean)) {
    const idx = path.join(outDir, clean, "index.html")
    if (existsSync(idx)) return idx
  }
  // Reserva: o que o build podou do `out/` continua em `public/`, e e de la que
  // o app instalado le. Sem isto a auditoria acusa 404 no que o jogador enxerga.
  const doPublic = path.join(publicDir, clean)
  if (existsSync(doPublic)) return doPublic
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
const YOUTH_SAVE = { ...SAVE, youthPlayers: [], youthCareer: { active: true, category: "sub20", clubCurto: "FLA", clubNome: "Flamengo Sub-20", startedSeason: 2026, currentSeason: 2026, round: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0, coachReputation: 8, coachXP: 0, titles: [], promotedPlayerIds: [], alumni: [], professionalOffers: [], seasonFinished: false } }

const ROUTES = [
  "/", "/sem-clube", "/elenco", "/elenco/gerenciamento", "/elenco/taticas", "/elenco/escalacoes",
  "/mercado", "/transferencias", "/contratos", "/olheiros", "/base", "/base/carreira", "/treinamento",
  "/partida", "/partida/escalacao", "/partida/ao-vivo", "/calendario", "/competicoes",
  "/clube", "/financas", "/infraestrutura", "/taticas", "/estatisticas", "/historico",
  "/mensagens", "/notificacoes", "/central", "/comissao", "/dashboard",
  "/reunioes", "/imprensa", "/vestiario", "/desafios", "/relatorios", "/adversarios",
  "/analise-partida", "/selecao", "/salvar", "/configuracoes", "/editar",
]
const INTENTIONAL_REDIRECTS = new Set(["/dashboard"])

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
  if (route === "/base/carreira") await page.addInitScript(s => window.localStorage.setItem("ultrafoot:save", JSON.stringify(s)), YOUTH_SAVE)
  const errors = []
  page.on("pageerror", e => errors.push("JS: " + (e.stack || e.message)))
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()) })
  page.on("response", r => { const s = r.status(); const u = r.url(); if (s >= 400 && !u.includes("favicon") && !/\.(png|jpg|jpeg|webm|mp3|svg)(\?|$)/i.test(u)) errors.push(`${s} ${u.replace(base,"")}`) })
  let bodyText = "", mockHits = []
  try {
    const routeUrl = route === "/" ? `${base}/` : `${base}${route}/`
    await page.goto(routeUrl, { waitUntil: "networkidle", timeout: 20000 })
    // ⚠️ 600 ms MEDIA A TELA NO MEIO DO CAMINHO. As telas que esperam o save
    // (portao de hidratacao — /central, /editar) mostram um "Abrindo…" de 17
    // caracteres por alguns centesimos, e a auditoria acusava "TELA VAZIA" de
    // uma tela que estava perfeitamente viva 600 ms depois (medido: /editar
    // assenta em 1.572 caracteres aos 600-1500 ms). Medir cedo demais e a mesma
    // familia de erro que reprovar por CORS de outro ambiente: o problema esta
    // no medidor. Tela que continuar vazia aos 1,5 s segue reprovando.
    await page.waitForTimeout(1500)
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
  if (r.textLen < 120 && !INTENTIONAL_REDIRECTS.has(r.route)) flags.push(`TELA VAZIA? (${r.textLen} chars)`)
  if (r.mock.length) flags.push(`MOCK: ${r.mock.join(", ")}`)
  const status = flags.length ? "⚠ " + flags.join(" | ") : "OK"
  if (flags.length) problems++
  console.log(`${flags.length ? "FAIL" : "OK  "} ${r.route.padEnd(26)} ${status}`)
  for (const e of r.errs) console.log(`        ${e.slice(0, 160)}`)
}
console.log(`\n${problems} tela(s) com possiveis problemas de ${results.length} auditadas.`)
