// MEDE O JOGO NUM CELULAR — o que o APK de fato mostra.
//
// O app mobile e um WebView da versao web: o que aparece no telefone e
// exatamente este `out/`. Entao medir aqui e medir o APK.
//
// ⚠️ MEDIR, NAO OPINAR. Da ultima vez a hipotese obvia ("deve estar
// transbordando") estava ERRADA: o jogo nao transbordava em lugar nenhum, o
// defeito era ESCALA — o menor texto media 5,6px porque `--game-view-scale: 0.8`
// encolhe o jogo mais 20% em cima de um estilo que ja escreve em 9 e 10px.
// Rolagem lateral zero e tela ilegivel sao coisas diferentes, e so a medicao
// separa as duas.
//
// O que sai daqui, por tela:
//   menor       — o menor tamanho de fonte RENDERIZADO (ja com o zoom aplicado)
//   ilegiveis   — quantos trechos de texto ficam abaixo de 10px reais
//   alvos       — quantos botoes/links tem menos de 40px de lado (dedo)
//   rolagemX    — rolagem horizontal, que num telefone e defeito
//
// Uso: node medir-celular.mjs [pasta-de-capturas]

import { chromium, devices } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const capturas = process.argv[2] ?? null

const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".webp": "image/webp",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp3": "audio/mpeg",
  ".webm": "audio/webm", ".mp4": "video/mp4", ".ogg": "audio/ogg",
}

function resolver(u) {
  const d = decodeURIComponent(u.split("?")[0])
  const c = d === "/" ? "/index.html" : d
  const a = path.join(outDir, c)
  if (existsSync(a)) return a
  if (!path.extname(c)) {
    const i = path.join(outDir, c, "index.html")
    if (existsSync(i)) return i
  }
  return a
}

const servidor = createServer(async (q, res) => {
  try {
    const a = path.resolve(resolver(q.url ?? "/"))
    const st = await stat(a)
    const f = st.isDirectory() ? path.join(a, "index.html") : a
    res.writeHead(200, { "content-type": mime[path.extname(f).toLowerCase()] ?? "application/octet-stream" })
    res.end(await readFile(f))
  } catch {
    res.writeHead(404); res.end()
  }
})

// As telas que o jogador de celular de fato abre.
const ROTAS = [
  "/splash", "/", "/elenco", "/elenco/gerenciamento", "/mercado",
  "/calendario", "/competicoes", "/financas", "/partida", "/configuracoes",
]

await new Promise(r => servidor.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${servidor.address().port}`
if (capturas) mkdirSync(capturas, { recursive: true })

const navegador = await chromium.launch()
// Pixel 7: 393x873, DPR 2.625, touch, sem hover — o alvo do `@media (hover: none)`.
const contexto = await navegador.newContext({ ...devices["Pixel 7"] })
await contexto.addInitScript(() => {
  localStorage.setItem("ultrafoot:save", JSON.stringify({
    version: 2, selectedTeamShort: "BGT", managerName: "QA", season: 2026, week: 0,
    language: "pt-BR", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(),
    multiplayerEnabled: false, managers: [], activeManagerId: null,
    controllerType: "playstation", controllerBindings: {},
  }))
  localStorage.setItem("ultrafoot:onboarding-seen", "1")
  localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.290")
  sessionStorage.setItem("ultrafoot:session-active", "true")
})

const pagina = await contexto.newPage()
let somaIlegiveis = 0
let piorMenor = 99
const linhas = []

for (const rota of ROTAS) {
  try {
    await pagina.goto(`${base}${rota}`, { waitUntil: "load" })
    await pagina.waitForTimeout(2200)

    const m = await pagina.evaluate(() => {
      // O zoom do `body` multiplica TUDO que e desenhado. Um `font-size` de 9px
      // sob `zoom: 0.8` chega ao olho como 7,2px — e e o olho que importa.
      const zoom = parseFloat(getComputedStyle(document.body).zoom || "1") || 1
      let menor = 99
      let ilegiveis = 0
      let alvos = 0

      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const s = getComputedStyle(el)
        if (s.visibility === "hidden" || s.display === "none") continue

        const temTexto = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
        if (temTexto) {
          const px = parseFloat(s.fontSize) * zoom
          if (px > 0) {
            if (px < menor) menor = px
            if (px < 10) ilegiveis++
          }
        }
        if (el.matches("button, a[href], [role='button'], input, select")) {
          if (r.width * zoom < 40 || r.height * zoom < 40) alvos++
        }
      }

      const de = document.documentElement
      return {
        zoom,
        menor: menor === 99 ? null : Math.round(menor * 10) / 10,
        ilegiveis,
        alvos,
        rolagemX: de.scrollWidth - de.clientWidth,
        largura: window.innerWidth,
      }
    })

    if (capturas) {
      await pagina.screenshot({
        path: path.join(capturas, `${rota === "/" ? "hub" : rota.slice(1).replace(/\//g, "-")}.png`),
      })
    }

    somaIlegiveis += m.ilegiveis
    if (m.menor !== null && m.menor < piorMenor) piorMenor = m.menor
    linhas.push({ rota, ...m })
    await pagina.goto("about:blank").catch(() => {})
  } catch (e) {
    linhas.push({ rota, erro: String(e.message ?? e).slice(0, 60) })
    await pagina.goto("about:blank").catch(() => {})
  }
}

await navegador.close()
await new Promise(r => servidor.close(r))

console.log(`\nCELULAR — Pixel 7 (${linhas[0]?.largura ?? "?"}px), zoom do body = ${linhas[0]?.zoom ?? "?"}\n`)
console.log("  rota                    menor   <10px   alvos<40   rolagemX")
console.log("  " + "-".repeat(62))
for (const l of linhas) {
  if (l.erro) { console.log(`  ${l.rota.padEnd(22)} ${l.erro}`); continue }
  console.log(
    `  ${l.rota.padEnd(22)} ${String(l.menor).padStart(5)}   ${String(l.ilegiveis).padStart(5)}   ${String(l.alvos).padStart(8)}   ${String(l.rolagemX).padStart(8)}`,
  )
}
console.log("  " + "-".repeat(62))
console.log(`  menor texto do jogo: ${piorMenor}px   |   trechos abaixo de 10px: ${somaIlegiveis}`)
console.log("")
