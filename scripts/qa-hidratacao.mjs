// ONDE O HTML DO BUILD DISCORDA DO PRIMEIRO RENDER DO CLIENTE.
//
// O erro React #418 ("hydration failed") chega minificado no bundle de produção
// e não diz QUAL nó divergiu — só "text" ou "HTML". Esta ferramenta responde
// isso do jeito mais direto possível: carrega a mesma rota DUAS vezes, uma com
// JavaScript desligado (o HTML que o build gerou) e outra normal (o que o
// cliente desenha), e imprime as primeiras linhas de texto que diferem.
//
//   node scripts/qa-hidratacao.mjs /central /editar
//
// ⚠️ Nem toda diferença é defeito: conteúdo que só existe depois de ler o save
// é esperado. O que interessa é diferença no MESMO nó — número, data, moeda,
// nome — porque é ela que quebra a hidratação.

import { chromium } from "playwright"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const publicDir = path.resolve("public")
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript"], [".css", "text/css"],
  [".json", "application/json"], [".png", "image/png"], [".webp", "image/webp"],
  [".svg", "image/svg+xml"], [".woff2", "font/woff2"],
])

function resolveReq(u) {
  const dec = decodeURIComponent(u.split("?")[0])
  const clean = dec === "/" ? "/index.html" : dec
  const raw = path.join(outDir, clean)
  if (existsSync(raw)) return raw
  if (!path.extname(clean)) {
    const idx = path.join(outDir, clean, "index.html")
    if (existsSync(idx)) return idx
  }
  const pub = path.join(publicDir, clean)
  if (existsSync(pub)) return pub
  return raw
}

const srv = createServer(async (req, res) => {
  try {
    const target = path.resolve(resolveReq(req.url ?? "/"))
    const st = await stat(target)
    const fp = st.isDirectory() ? path.join(target, "index.html") : target
    res.writeHead(200, {
      "content-type": mime.get(path.extname(fp).toLowerCase()) ?? "application/octet-stream",
      "cache-control": "no-store",
    })
    res.end(await readFile(fp))
  } catch { res.writeHead(404); res.end("Not found") }
})
await new Promise(r => srv.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${srv.address().port}`

const SAVE = {
  version: 4, selectedTeamShort: "FLA", managerName: "QA Auditor", season: 2026, week: 0,
  language: "pt-BR", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(),
  multiplayerEnabled: false, managers: [], activeManagerId: null,
  controllerType: "playstation", controllerBindings: {},
}

const rotas = process.argv.slice(2)
if (!rotas.length) rotas.push("/central", "/editar")

const browser = await chromium.launch({ headless: true })

async function textoDaRota(rota, comJS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: comJS })
  if (comJS) {
    await ctx.addInitScript(s => {
      localStorage.setItem("ultrafoot:save", JSON.stringify(s))
      sessionStorage.setItem("ultrafoot:session-active", "true")
    }, SAVE)
  }
  const page = await ctx.newPage()
  await page.goto(`${base}${rota}/`, { waitUntil: comJS ? "networkidle" : "load", timeout: 30000 }).catch(() => {})
  if (comJS) await page.waitForTimeout(1200)
  const linhas = await page.evaluate(() => (document.body.innerText || "")
    .split("\n").map(s => s.trim()).filter(Boolean))
  await ctx.close()
  return linhas
}

for (const rota of rotas) {
  const doBuild = await textoDaRota(rota, false)
  const doCliente = await textoDaRota(rota, true)
  const soNoBuild = doBuild.filter(l => !doCliente.includes(l))
  const soNoCliente = doCliente.filter(l => !doBuild.includes(l))
  console.log(`\n=== ${rota}`)
  console.log(`  linhas: build ${doBuild.length} | cliente ${doCliente.length}`)
  if (soNoBuild.length) console.log(`  SÓ NO HTML DO BUILD (${soNoBuild.length}): ${soNoBuild.slice(0, 8).join(" · ").slice(0, 400)}`)
  if (soNoCliente.length) console.log(`  SÓ NO CLIENTE (${soNoCliente.length}): ${soNoCliente.slice(0, 8).join(" · ").slice(0, 400)}`)
  if (!soNoBuild.length && !soNoCliente.length) console.log("  sem diferença de texto")
}

await browser.close()
await new Promise(r => srv.close(r))
