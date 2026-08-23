// QUANTO O BOTÃO "AVANÇAR" TRAVA A INTERFACE.
//
// `advanceWeek` (lib/use-game-manager.ts) tem 1.644 linhas num único callback e
// é declarado `async` sem um único `await`: roda inteiro numa tarefa só. Este
// harness aperta o botão e mede quanto tempo a thread ficou sem poder responder.
//
// ⚠️ ELE JÁ MEDIU O NADA — e por isso hoje ele se recusa a medir.
//
// A versão anterior injetava um objeto de cinco campos como "save". O jogo abria
// sem carreira (quatro botões na tela), o `advanceWeek` saía na primeira guarda
// e o relatório dizia "0 ms travado" — um falso "está tudo ótimo", que é o pior
// resultado possível porque encerra a investigação. Agora:
//
//   1. o save vem de `scripts/perf-gerar-save.ts`, gerado pelo PRÓPRIO motor;
//   2. antes de medir, o harness EXIGE sinais de carreira carregada e aborta
//      com erro se não os encontrar.
//
// Uso:
//   node --import tsx scripts/perf-gerar-save.ts 12   # uma vez
//   node scripts/perf-avancar.mjs [quantas vezes]
import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { existsSync, statSync, readFileSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const FIXTURE = path.resolve("scripts/fixtures/save-perf.json")
const mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript"],[".css","text/css"],[".json","application/json"],[".png","image/png"],[".jpg","image/jpeg"],[".webp","image/webp"],[".svg","image/svg+xml"],[".ico","image/x-icon"],[".woff2","font/woff2"],[".mp3","audio/mpeg"],[".webm","audio/webm"]])

if (!existsSync(FIXTURE)) {
  console.error(`FALTA O SAVE: ${FIXTURE}`)
  console.error("Rode antes:  node --import tsx scripts/perf-gerar-save.ts 12")
  process.exit(1)
}
const SAVE = JSON.parse(readFileSync(FIXTURE, "utf8"))

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

const VEZES = Number(process.argv[2] ?? 4)

await new Promise(r => server.listen(0, r))
const port = server.address().port
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })

await ctx.addInitScript(dados => {
  try {
    for (const [chave, valor] of Object.entries(dados)) localStorage.setItem(chave, valor)
    sessionStorage.setItem("ultrafoot:session-active", "true")
  } catch {}
  // Observador de LONG TASK: é esta a métrica que importa. Tempo de relógio
  // entre clique e pintura inclui espera ociosa; long task é a thread REALMENTE
  // bloqueada, sem poder responder a clique nenhum.
  window.__lt = []
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)) })
      .observe({ type: "longtask", buffered: true })
  } catch {}
}, SAVE)

const page = await ctx.newPage()
await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 30000 })
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)

// ── A GUARDA QUE FALTAVA ────────────────────────────────────────────────────
// Uma tela sem carreira também tem um botão "Avançar". Antes de medir, exigimos
// prova de que há carreira: número de controles compatível com o painel.
const botoes = (await page.locator("button").allTextContents().catch(() => [])).filter(Boolean)
if (botoes.length < 8) {
  console.error(`A TELA NAO PARECE UMA CARREIRA (apenas ${botoes.length} botoes: ${botoes.slice(0, 8).join(", ")}).`)
  console.error("Medir assim repetiria o erro de reportar '0 ms travado' sobre uma tela vazia.")
  console.error("Regere o save:  node --import tsx scripts/perf-gerar-save.ts 12")
  await browser.close(); server.close(); process.exit(1)
}

const botao = page.locator("button").filter({ hasText: /avan[çc]ar|continuar/i }).first()
if (!(await botao.count().then(n => n > 0).catch(() => false))) {
  console.error("nao encontrei o botao de avancar — a tela pode ter mudado")
  await browser.close(); server.close(); process.exit(1)
}

console.log(`\n===== AVANCAR O TEMPO — ${VEZES} vezes (${botoes.length} controles na tela) =====\n`)
console.log(`${"#".padStart(3)} ${"clique->UI".padStart(11)} ${"pior bloco".padStart(11)} ${"soma travada".padStart(13)}`)

const resumo = []
for (let i = 1; i <= VEZES; i++) {
  await page.evaluate(() => { window.__lt = [] })
  const t = Date.now()
  await botao.click({ force: true, timeout: 10000 }).catch(() => {})
  // ⚠️ ESPERA ATÉ O SILÊNCIO, nunca um tempo fixo.
  //
  // A versão anterior esperava 700 ms e lia a lista. As entradas de long task
  // chegam ao observador DEPOIS da tarefa terminar — e a maior delas neste jogo
  // passa de 1,2 s. Resultado: o harness lia a lista antes de o bloco existir e
  // reportava "0 ms travado" sobre um congelamento de mais de um segundo. Foi a
  // segunda vez que este arquivo mediu o nada.
  //
  // Agora ele espera a lista PARAR DE CRESCER por 600 ms seguidos, com teto de
  // 20 s para não travar o harness se algo ficar em laço.
  await page.evaluate(async () => {
    const limite = Date.now() + 20000
    let ultimo = -1
    let quieto = 0
    while (Date.now() < limite && quieto < 600) {
      await new Promise(r => setTimeout(r, 100))
      const atual = (window.__lt ?? []).length
      quieto = atual === ultimo ? quieto + 100 : 0
      ultimo = atual
    }
  }).catch(() => {})
  const ms = Date.now() - t
  const lt = await page.evaluate(() => window.__lt ?? []).catch(() => [])
  const pior = lt.length ? Math.max(...lt) : 0
  const soma = lt.reduce((a, b) => a + b, 0)
  resumo.push({ ms, pior, soma })
  console.log(`${String(i).padStart(3)} ${(ms + "ms").padStart(11)} ${(pior + "ms").padStart(11)} ${(soma + "ms").padStart(13)}`)
  const fechar = page.locator("button").filter({ hasText: /fechar|entendi|ok$/i }).first()
  if (await fechar.count().then(n => n > 0).catch(() => false)) {
    await fechar.click({ force: true, timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
}

const piorGeral = Math.max(...resumo.map(r => r.pior))
const somaMedia = Math.round(resumo.reduce((a, r) => a + r.soma, 0) / resumo.length)
console.log(`\n  pior bloco unico em todo o teste: ${piorGeral} ms`)
console.log(`  media de tempo travado por avanco: ${somaMedia} ms`)
console.log(piorGeral > 100
  ? "  ⚠️ acima de 100 ms a interface congela de forma perceptivel."
  : piorGeral > 50 ? "  atencao: bloco acima de 50 ms conta como long task."
    : "  dentro do orcamento.")
console.log("  (a maquina do jogador costuma ser 3 a 5x mais lenta)")

await browser.close()
server.close()
