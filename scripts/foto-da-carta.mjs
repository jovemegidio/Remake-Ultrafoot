// FOTOGRAFA A CARTA DO ATLETA — para conferir arte, e não afirmar que confere.
//
// ⚠️ POR QUE ISTO EXISTE. A carta trocou de desenho CSS para IMAGEM (1.0.348), e
// a arte tem outra silhueta: ombros entalhados e ponta na base, onde antes havia
// um octógono. Todo o texto da carta — overall, nome, as seis siglas — foi
// posicionado para a silhueta ANTIGA. Dizer "deve caber" é chute; a grade de
// atributos já vazou para fora da carta uma vez (1.0.324), e o defeito só
// apareceu num print do usuário.
//
// Serve o export estático, injeta um save e fotografa a tela do elenco.
//
// Uso: node scripts/foto-da-carta.mjs [destino.png]

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const publicDir = path.resolve("public")
const destino = process.argv[2] ?? "carta.png"

const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript"], [".css", "text/css"],
  [".json", "application/json"], [".png", "image/png"], [".jpg", "image/jpeg"],
  [".webp", "image/webp"], [".svg", "image/svg+xml"], [".ico", "image/x-icon"],
  [".woff2", "font/woff2"], [".mp3", "audio/mpeg"],
])

function resolver(url) {
  const limpo = decodeURIComponent(url.split("?")[0])
  const rota = limpo === "/" ? "/index.html" : limpo
  const bruto = path.join(outDir, rota)
  if (existsSync(bruto)) return bruto
  if (!path.extname(rota)) {
    const idx = path.join(outDir, rota, "index.html")
    if (existsSync(idx)) return idx
  }
  // Mesma reserva da auditoria: o build poda imagens do `out/` que o jogo
  // instalado lê de `resources`.
  const doPublic = path.join(publicDir, rota)
  if (existsSync(doPublic)) return doPublic
  return bruto
}

const servidor = createServer(async (req, res) => {
  try {
    const alvo = path.resolve(resolver(req.url ?? "/"))
    const st = await stat(alvo)
    const arquivo = st.isDirectory() ? path.join(alvo, "index.html") : alvo
    res.writeHead(200, {
      "content-type": mime.get(path.extname(arquivo).toLowerCase()) ?? "application/octet-stream",
      "cache-control": "no-store",
    })
    res.end(await readFile(arquivo))
  } catch { res.writeHead(404); res.end("nao encontrado") }
})

const SAVE = {
  version: 4, selectedTeamShort: "FLA", managerName: "QA", season: 2026, week: 3,
  language: "pt-BR", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(),
  multiplayerEnabled: false, managers: [], activeManagerId: null,
  controllerType: "playstation", controllerBindings: {},
  // ⚠️ A CARTA SO EXISTE NA PRANCHETA HORIZONTAL. Na vertical o jogo desenha a
  // CAMISA do clube — e a primeira foto saiu com onze camisas, o que eu quase
  // li como "a arte nao entrou". Sem este ajuste, este script nao fotografa o
  // que ele existe para conferir.
  campoHorizontal: true,
}

await new Promise(r => servidor.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${servidor.address().port}`

const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } })
await pagina.addInitScript(s => window.localStorage.setItem("ultrafoot:save", JSON.stringify(s)), SAVE)
await pagina.goto(`${base}/elenco/gerenciamento`, { waitUntil: "networkidle" })
await pagina.waitForTimeout(2000)

// ⚠️ O MODAL DE NOVIDADES COBRE A TELA. A primeira tentativa fotografou o
// changelog da versao em vez do elenco — e o seletor devolveu "0 cartas", que
// eu quase li como "a arte nao entrou". Dispensar o modal e parte de tirar a
// foto certa.
for (let tentativa = 0; tentativa < 20; tentativa++) {
  const avancar = pagina.getByRole("button", { name: /avan[cç]ar|fechar|come[cç]ar/i })
  if (await avancar.count() === 0) break
  await avancar.first().click({ timeout: 2000 }).catch(() => {})
  await pagina.waitForTimeout(220)
}
await pagina.keyboard.press("Escape").catch(() => {})
await pagina.waitForTimeout(1800)
await pagina.screenshot({ path: destino, fullPage: false })

const cartas = await pagina.locator("[style*='carta-base.webp']").count()
console.log(`cartas desenhadas com a arte: ${cartas}`)
console.log(`foto: ${destino}`)

await navegador.close()
servidor.close()
