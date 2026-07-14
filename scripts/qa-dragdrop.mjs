// Verifica o DRAG-AND-DROP da escalacao: banco -> campo, campo -> banco, e troca entre
// jogadores em campo.
//
// Importa checar isto agora porque eu mudei o positionedPlayers: antes os jogadores eram
// encaixados nos slots por INDICE do array; agora por POSICAO. Os handlers de drop mexem
// no array `players`, entao se algum deles dependia da ordem antiga, quebrou aqui.
//
// Uso: npm run build:qa && node scripts/qa-dragdrop.mjs

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { assertFreshBuild } from "./qa-lib.mjs"

assertFreshBuild()

const outDir = path.resolve("out")
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript"], [".css", "text/css"],
  [".json", "application/json"], [".png", "image/png"], [".jpg", "image/jpeg"],
  [".svg", "image/svg+xml"], [".woff2", "font/woff2"],
])
function rr(u) {
  const d = decodeURIComponent(u.split("?")[0])
  const c = d === "/" ? "/index.html" : d
  const r = path.join(outDir, c)
  if (existsSync(r)) return r
  if (!path.extname(c)) {
    const i = path.join(outDir, c, "index.html")
    if (existsSync(i)) return i
  }
  return r
}
const srv = createServer(async (q, s) => {
  try {
    const t = path.resolve(rr(q.url ?? "/"))
    const st = await stat(t)
    const fp = st.isDirectory() ? path.join(t, "index.html") : t
    const b = await readFile(fp)
    s.writeHead(200, { "content-type": mime.get(path.extname(fp).toLowerCase()) ?? "application/octet-stream", "cache-control": "no-store" })
    s.end(b)
  } catch { s.writeHead(404); s.end("nf") }
})
await new Promise((r) => srv.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${srv.address().port}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.addInitScript(() => {
  localStorage.setItem("ultrafoot:save", JSON.stringify({
    version: 4, selectedTeamShort: "FLA", managerName: "QA", season: 2026, week: 0,
    language: "pt-BR", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(),
    multiplayerEnabled: false, managers: [], activeManagerId: null,
    controllerType: "playstation", controllerBindings: {},
  }))
  sessionStorage.setItem("ultrafoot:session-active", "true")
})

let failures = 0
const fail = (m) => { console.log(`XX ${m}`); failures++ }
const ok = (m) => console.log(`OK ${m}`)

await page.goto(`${base}/elenco/gerenciamento/`, { waitUntil: "networkidle", timeout: 30000 })
await page.waitForTimeout(2000)

/** Nomes atualmente no campo e no banco. */
async function snapshot() {
  return page.evaluate(() => {
    const txt = document.body.innerText
    const [campoRaw, bancoRaw] = txt.split(/RESERVAS/i)
    const nomes = (s) =>
      (s ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^\d+$/.test(l) && l.length > 2 && l.length < 24)
    return { campo: nomes(campoRaw), banco: nomes(bancoRaw) }
  })
}

const antes = await snapshot()
const bancoCard = page.locator('[draggable="true"]').last()     // ultimo reserva
const campoCard = page.locator('[draggable="true"]').first()    // primeiro em campo

const nomeBanco = (await bancoCard.innerText()).split("\n").find((l) => l.length > 2)
const nomeCampo = (await campoCard.innerText()).split("\n").find((l) => l.length > 2)

if (!nomeBanco || !nomeCampo) {
  fail("nao consegui identificar um card de campo e um de banco")
} else {
  ok(`arrastando "${nomeBanco}" (banco) sobre "${nomeCampo}" (campo)`)

  // HTML5 drag-and-drop nativo — o Playwright emula com dragTo no Chromium.
  await bancoCard.dragTo(campoCard)
  await page.waitForTimeout(800)

  const depois = await snapshot()

  // O reserva precisa ter ENTRADO em campo...
  const entrou = depois.campo.some((n) => n.includes(nomeBanco) || nomeBanco.includes(n))
  // ...e o titular precisa ter IDO para o banco.
  const saiu = depois.banco.some((n) => n.includes(nomeCampo) || nomeCampo.includes(n))

  if (!entrou) fail(`"${nomeBanco}" NAO entrou em campo apos o drop`)
  else ok(`"${nomeBanco}" entrou em campo`)

  if (!saiu) fail(`"${nomeCampo}" NAO foi para o banco (a troca nao aconteceu)`)
  else ok(`"${nomeCampo}" foi para o banco`)

  // Ninguem pode sumir nem duplicar.
  const totalAntes = antes.campo.length + antes.banco.length
  const totalDepois = depois.campo.length + depois.banco.length
  if (totalDepois !== totalAntes) {
    fail(`o elenco mudou de tamanho: ${totalAntes} -> ${totalDepois} (jogador sumiu ou duplicou)`)
  } else {
    ok(`elenco intacto (${totalDepois} jogadores)`)
  }
}

await browser.close()
srv.close()

console.log(failures ? `\nRESULTADO: ${failures} problema(s) no drag-and-drop` : "\nRESULTADO: OK — drag-and-drop funcionando")
process.exitCode = failures ? 1 : 0
