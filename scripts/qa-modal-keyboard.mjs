// Prova o bug de EVENT BUBBLING no modal de negociacao — e prova o fix.
//
// Bug: o listener de teclado do /mercado vive no window e troca a aba com ArrowLeft/
// ArrowRight. O slider do Radix e um <span role="slider">, nao um <input>, entao
// escapava do guarda isTyping: apertar a seta no slider da proposta movia o slider E,
// ao borbulhar ate o window, trocava a aba do mercado ATRAS do modal.
//
// Este teste abre o modal, aperta ArrowRight e verifica DUAS coisas:
//   1. o slider REAGIU (a proposta mudou de valor)      -> o modal funciona
//   2. a aba de fundo NAO mudou                          -> o evento nao vazou
//
// Rode ANTES do fix (deve FALHAR no item 2) e DEPOIS (deve passar).
//
// Uso: npm run build && node scripts/qa-modal-keyboard.mjs

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { assertFreshBuild } from "./qa-lib.mjs"

// Recusa rodar contra bundle velho (ver qa-lib.mjs).
assertFreshBuild()

const outDir = path.resolve("out")
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript"], [".css", "text/css"],
  [".json", "application/json"], [".png", "image/png"], [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"], [".svg", "image/svg+xml"], [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
])

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

const srv = createServer(async (req, res) => {
  try {
    const target = path.resolve(resolveReq(req.url ?? "/"))
    const st = await stat(target)
    const fp = st.isDirectory() ? path.join(target, "index.html") : target
    const body = await readFile(fp)
    res.writeHead(200, {
      "content-type": mime.get(path.extname(fp).toLowerCase()) ?? "application/octet-stream",
      "cache-control": "no-store",
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end("Not found")
  }
})

await new Promise((r) => srv.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${srv.address().port}`

const SAVE = {
  version: 4, selectedTeamShort: "FLA", managerName: "QA", season: 2026, week: 0,
  language: "pt-BR", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(),
  multiplayerEnabled: false, managers: [], activeManagerId: null,
  controllerType: "playstation", controllerBindings: {},
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.addInitScript((save) => {
  localStorage.setItem("ultrafoot-save", JSON.stringify(save))
  sessionStorage.setItem("ultrafoot:session-active", "true")
}, SAVE)

const fail = (msg) => { console.error(`FALHOU: ${msg}`); process.exitCode = 1 }
const ok = (msg) => console.log(`OK    ${msg}`)

try {
  await page.goto(`${base}/mercado/`, { waitUntil: "networkidle", timeout: 30000 })

  // Vai para a aba "Rede Mundial", onde ficam os jogadores negociaveis.
  await page.getByRole("tab", { name: /rede mundial/i }).click()
  await page.waitForTimeout(600)

  // Seleciona um jogador e abre o modal de negociacao.
  await page.getByRole("button", { name: /comprar/i }).first().click()
  const dialog = page.locator('[role="dialog"][data-state="open"]')
  await dialog.waitFor({ state: "visible", timeout: 8000 })
  ok("modal de negociacao abriu")

  // Estado ANTES: qual aba esta ativa, e qual o valor do slider.
  const tabBefore = await page.locator('[role="tab"][data-state="active"]').innerText()
  const slider = dialog.locator('[role="slider"]').first()
  const valueBefore = await slider.getAttribute("aria-valuenow")

  // Foca o slider e aperta a seta — exatamente o gesto que o usuario relatou.
  await slider.focus()
  await page.keyboard.press("ArrowRight")
  await page.waitForTimeout(400)

  const valueAfter = await slider.getAttribute("aria-valuenow")
  const tabAfter = await page.locator('[role="tab"][data-state="active"]').innerText()

  // 1) O slider precisa REAGIR — senao o fix quebrou o modal.
  if (valueBefore === valueAfter) {
    fail(`o slider NAO reagiu a ArrowRight (${valueBefore} -> ${valueAfter}). O modal quebrou.`)
  } else {
    ok(`slider reagiu: ${valueBefore} -> ${valueAfter}`)
  }

  // 2) A aba de fundo NAO pode ter mudado — este e o bug.
  if (tabBefore !== tabAfter) {
    fail(`EVENT BUBBLING: a aba de fundo mudou de "${tabBefore}" para "${tabAfter}" enquanto o modal estava aberto.`)
  } else {
    ok(`aba de fundo intacta: "${tabBefore}"`)
  }

  // 3) O modal precisa continuar aberto (a troca de aba costumava desmonta-lo).
  if (!(await dialog.isVisible())) {
    fail("o modal fechou sozinho apos a tecla de seta")
  } else {
    ok("modal continua aberto")
  }
} catch (err) {
  fail(`erro na execucao: ${err.message}`)
} finally {
  await browser.close()
  srv.close()
}

console.log(process.exitCode ? "\nRESULTADO: BUG PRESENTE" : "\nRESULTADO: OK — sem vazamento de evento")
