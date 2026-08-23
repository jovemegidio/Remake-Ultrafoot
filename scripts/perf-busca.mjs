// Mede o custo de DIGITAR na busca de jogadores do mercado.
//
// A tela filtra o catalogo inteiro (53 mil atletas) a cada tecla. O harness
// digita uma palavra DEPRESSA — uma tecla atras da outra, como um jogador digita
// de verdade — e mede duas coisas SEPARADAS:
//
//   PIOR TECLA        quanto a tecla mais lenta demorou para voltar. E o que o
//                     jogador sente como "o campo engasga".
//   LISTA ASSENTAR    quanto faltou, depois da ultima tecla, para a lista parar.
//
// A separacao importa: `useDeferredValue` troca "toda tecla espera a lista" por
// "a tecla responde e a lista chega logo depois". Medir so o total esconde isso
// — e foi o que aconteceu na primeira versao deste harness, que esperava dois
// quadros entre as teclas e por isso nunca deixava o adiamento interromper nada.
//
//   node scripts/perf-busca.mjs
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

const SAVE = { version: 8, careerId: "perf", selectedTeamShort: "FLARJ", managerName: "Perf", season: 2026, week: 8 }
const PALAVRA = process.env.PERF_PALAVRA ?? "martinez"
const RODADAS = Number(process.env.PERF_RODADAS ?? 3)

await new Promise(r => server.listen(0, r))
const port = server.address().port
const browser = await chromium.launch()

const rodadas = []
for (let r = 0; r < RODADAS; r++) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  await ctx.addInitScript(save => {
    try {
      localStorage.setItem("ultrafoot:save:perf", JSON.stringify(save))
      localStorage.setItem("ultrafoot:active-career", "perf")
      sessionStorage.setItem("ultrafoot:session-active", "true")
    } catch {}
    window.__lt = []
    try {
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)) })
        .observe({ type: "longtask", buffered: true })
    } catch {}
  }, SAVE)
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${port}/mercado`, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})

  // A aba "Buscar Atletas" precisa estar aberta: sem ela o input nem existe.
  // NAO usamos Escape para dispensar cortinas — no jogo, Escape e "voltar", e a
  // medicao saia da tela de mercado sem avisar.
  const aba = page.locator('[role="tab"]').filter({ hasText: /buscar/i }).first()
  if (await aba.count().then(n => n > 0).catch(() => false)) {
    await aba.click({ timeout: 5000, force: true }).catch(() => {})
    await page.waitForTimeout(500)
  }

  const campo = page.locator('input[type="text"]').first()
  if (!(await campo.count().then(n => n > 0).catch(() => false))) {
    console.log("nao encontrei o campo de busca — a tela pode ter mudado de estrutura")
    await browser.close()
    server.close()
    process.exit(0)
  }
  // Focar por JS: uma cortina intercepta o ponteiro e o click falha.
  await campo.evaluate(el => el.focus())
  await page.evaluate(() => { window.__lt = [] })

  const porTecla = []
  for (const letra of PALAVRA) {
    const t = performance.now()
    await campo.press(letra, { delay: 0 })
    porTecla.push(Math.round(performance.now() - t))
  }
  // Depois da ultima tecla: quanto falta ate a thread ficar quieta.
  const tAssentar = Date.now()
  await page.evaluate(() => new Promise(res => {
    let quietos = 0
    let ultimo = performance.now()
    const olhar = () => {
      const agora = performance.now()
      quietos = agora - ultimo < 20 ? quietos + 1 : 0
      ultimo = agora
      if (quietos >= 5) return res()
      requestAnimationFrame(olhar)
    }
    requestAnimationFrame(olhar)
  })).catch(() => {})
  const assentar = Date.now() - tAssentar
  const tarefas = await page.evaluate(() => window.__lt ?? [])

  rodadas.push({ porTecla, assentar, tarefas })
  await ctx.close()
}

const mediana = arr => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)]
const piorPorRodada = rodadas.map(r => Math.max(...r.porTecla))
const mediaPorRodada = rodadas.map(r => Math.round(r.porTecla.reduce((a, b) => a + b, 0) / r.porTecla.length))

console.log(`\n===== BUSCA — digitando "${PALAVRA}" depressa, ${RODADAS} rodadas =====\n`)
for (let i = 0; i < rodadas.length; i++) {
  const r = rodadas[i]
  const soma = r.tarefas.reduce((a, b) => a + b, 0)
  console.log(`  rodada ${i + 1}: teclas [${r.porTecla.join(", ")}]  assentar ${r.assentar}ms  longtasks ${r.tarefas.length}/${soma}ms`)
}
console.log(`\n  PIOR TECLA (mediana das rodadas)   ${mediana(piorPorRodada)} ms`)
console.log(`  media por tecla (mediana)          ${mediana(mediaPorRodada)} ms`)
console.log(`  lista assentar (mediana)           ${mediana(rodadas.map(r => r.assentar))} ms`)

await browser.close()
server.close()
