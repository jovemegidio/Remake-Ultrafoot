import { chromium, expect } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".webm", "audio/webm"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".woff2", "font/woff2"],
])

function resolveRequest(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0])
  const cleanPath = decodedPath === "/" ? "/index.html" : decodedPath
  const rawTarget = path.join(outDir, cleanPath)

  if (existsSync(rawTarget)) {
    return rawTarget
  }

  if (!path.extname(cleanPath)) {
    const routeIndex = path.join(outDir, cleanPath, "index.html")
    if (existsSync(routeIndex)) {
      return routeIndex
    }
  }

  return rawTarget
}

function createStaticServer() {
  return createServer(async (req, res) => {
    try {
      const target = path.resolve(resolveRequest(req.url ?? "/"))
      const root = outDir.endsWith(path.sep) ? outDir : outDir + path.sep

      if (target !== outDir && !target.startsWith(root)) {
        res.writeHead(403)
        res.end("Forbidden")
        return
      }

      const fileStat = await stat(target)
      const filePath = fileStat.isDirectory() ? path.join(target, "index.html") : target
      const ext = path.extname(filePath).toLowerCase()
      const body = await readFile(filePath)

      res.writeHead(200, {
        "content-type": mimeTypes.get(ext) ?? "application/octet-stream",
        "cache-control": "no-store",
      })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end("Not found")
    }
  })
}

async function startServer() {
  const server = createStaticServer()
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
}

function makeSave(teamShort = "BGT", managerName = "QA Tester") {
  const now = Date.now()
  return {
    version: 2,
    selectedTeamShort: teamShort,
    managerName,
    season: 2026,
    week: 0,
    language: "pt-BR",
    selectedUniform: "home",
    createdAt: now,
    updatedAt: now,
    multiplayerEnabled: false,
    managers: [],
    activeManagerId: null,
    controllerType: "playstation",
    controllerBindings: {},
  }
}

async function newTestPage(browser, controllerId, save = null) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  })

  await context.addInitScript(({ controllerId: id, saveState }) => {
    window.localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.97")
    window.localStorage.setItem("ultrafoot:onboarding-seen", "1")
    if (saveState) {
      window.localStorage.setItem("ultrafoot:save", JSON.stringify(saveState))
      window.sessionStorage.setItem("ultrafoot:session-active", "true")
    }

    let timestamp = 0
    const buttons = Array.from({ length: 17 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }))

    const pad = {
      id,
      index: 0,
      connected: true,
      mapping: "standard",
      buttons,
      axes: [0, 0, 0, 0],
      get timestamp() {
        return timestamp
      },
    }

    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad, null, null, null],
    })

    window.__connectMockGamepad = nextId => {
      pad.id = nextId || id
      pad.connected = true
      timestamp += 16
      const event = new Event("gamepadconnected")
      Object.defineProperty(event, "gamepad", { value: pad })
      window.dispatchEvent(event)
    }

    window.__pressMockButton = index => new Promise(resolve => {
      buttons[index].pressed = true
      buttons[index].touched = true
      buttons[index].value = 1
      timestamp += 16

      setTimeout(() => {
        buttons[index].pressed = false
        buttons[index].touched = false
        buttons[index].value = 0
        timestamp += 16
        setTimeout(resolve, 100)
      }, 120)
    })
  }, { controllerId, saveState: save })

  const page = await context.newPage()
  const browserErrors = []

  page.on("pageerror", error => browserErrors.push(error.message))
  page.on("console", message => {
    if (message.type() === "error") {
      browserErrors.push(message.text())
    }
  })
  page.on("response", response => {
    const status = response.status()
    const url = response.url()
    if (status >= 400 && !url.includes("favicon.ico")) {
      browserErrors.push(`${status} ${url}`)
    }
  })
  page.on("requestfailed", request => {
    browserErrors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim())
  })

  return { context, page, browserErrors }
}

async function press(page, index) {
  await page.evaluate(buttonIndex => window.__pressMockButton(buttonIndex), index)
}

async function expectClean(browserErrors, label) {
  const filtered = browserErrors.filter(entry =>
    !entry.includes("favicon.ico") &&
    !entry.includes("net::ERR_ABORTED") &&
    !entry.includes("raw.githubusercontent.com") &&
    !entry.includes("game-asset:") &&
    !entry.startsWith("Failed to load resource:"),
  )

  if (filtered.length > 0) {
    throw new Error(`${label} browser errors:\n${filtered.join("\n")}`)
  }
}

async function runControllerCareerFlow(browser, baseUrl, controllerId, label) {
  const { context, page, browserErrors } = await newTestPage(browser, controllerId)

  await page.goto(`${baseUrl}/novo-jogo/`, { waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 })
  await expect.poll(
    () => page.evaluate(() => navigator.getGamepads()[0]?.id ?? ""),
    { timeout: 5000 },
  ).toContain(controllerId.split(" ")[0])

  await page.evaluate(() => window.__connectMockGamepad())
  // O aviso de conexao agora e `${label} detectado` (components/input/
  // aviso-de-controle.tsx) — "Xbox Wireless Controller detectado". O texto
  // fixo "Controle Conectado" e da implementacao anterior; procurar por ele
  // deixava este gate vermelho contra a UI nova, que faz o que foi pedido.
  await expect(page.getByText(/detectado/i).first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(label).first()).toBeVisible({ timeout: 5000 })

  await page.getByPlaceholder(/Nome do t[eé]cnico/i).fill(`QA ${label}`)
  await expect(page.getByRole("button", { name: /Iniciar carreira/i })).toBeEnabled({ timeout: 5000 })
  await press(page, 9)
  // A carreira agora abre uma cutscene antes do escritorio; pula no teste para nao
  // depender da duracao/autoplay do video.
  await page.getByRole("button", { name: /Pular/i }).click({ timeout: 5000 })
  await page.waitForURL((url) => url.origin === new URL(baseUrl).origin && url.pathname === "/", { timeout: 10000 })
  await expect(page.getByRole("link", { name: "Proxima Partida" })).toBeVisible({ timeout: 15000 })

  const teamName = (await page.locator("main h1").first().textContent())?.trim()
  await expectClean(browserErrors, `controller ${label}`)
  await context.close()

  return teamName
}

async function runRouteSmoke(browser, baseUrl) {
  const { context, page, browserErrors } = await newTestPage(
    browser,
    "Sony Interactive Entertainment Wireless Controller",
    makeSave(),
  )

  const routes = [
    ["/", /Proxima Partida/i],
    ["/elenco/", /Gerenciamento do Time/i],
    ["/mercado/", /Transferencias/i],
    ["/partida/", /INICIAR PARTIDA/i],
    ["/calendario/", /Simular ate data/i],
  ]

  for (const [route, expected] of routes) {
    browserErrors.length = 0
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" })
    await expect(page.getByText(expected).first()).toBeVisible({ timeout: 15000 })
    await expectClean(browserErrors, `route smoke ${route}`)
  }

  await context.close()
}

async function runInteractiveNavigation(browser, baseUrl) {
  const splash = await newTestPage(
    browser,
    "Sony Interactive Entertainment Wireless Controller",
  )

  await splash.page.goto(`${baseUrl}/splash/?menu=1`, { waitUntil: "networkidle" })
  await splash.page.getByText("NOVO JOGO", { exact: true }).click()
  await splash.page.waitForURL(url => url.pathname === "/novo-jogo/", { timeout: 10000 })
  await expect(splash.page.getByPlaceholder(/Nome do t[eé]cnico/i)).toBeVisible({ timeout: 15000 })
  await expectClean(splash.browserErrors, "interactive splash navigation")
  await splash.context.close()

  const office = await newTestPage(
    browser,
    "Sony Interactive Entertainment Wireless Controller",
    makeSave(),
  )

  await office.page.goto(`${baseUrl}/`, { waitUntil: "networkidle" })
  await office.page.keyboard.press("w")
  const quickSquad = office.page.getByRole("button", { name: "Elenco", exact: true })
  await expect(quickSquad).toBeVisible({ timeout: 5000 })
  await quickSquad.click()
  await office.page.waitForURL(url => url.pathname === "/elenco/", { timeout: 10000 })
  await expect(office.page.getByText(/Gerenciamento do Time/i).first()).toBeVisible({ timeout: 15000 })
  await expectClean(office.browserErrors, "interactive office navigation")
  await office.context.close()
}

async function runEditorAndHubSmoke(browser, baseUrl) {
  const session = await newTestPage(
    browser,
    "Sony Interactive Entertainment Wireless Controller",
    makeSave(),
  )

  await session.page.goto(`${baseUrl}/editar/`, { waitUntil: "networkidle" })
  await session.page.getByRole("button", { name: "Editar", exact: true }).first().click()
  const clubName = session.page.locator('label:has-text("Nome completo")').locator("..").locator("input")
  await clubName.fill("Botafogo QA Persistente")
  await session.page.getByRole("button", { name: "Salvar alterações" }).click()
  await expect(session.page.getByText("Botafogo QA Persistente", { exact: true }).first()).toBeVisible()
  await session.page.reload({ waitUntil: "networkidle" })
  await expect(session.page.getByText("Botafogo QA Persistente", { exact: true }).first()).toBeVisible({ timeout: 10000 })

  await session.page.goto(`${baseUrl}/`, { waitUntil: "networkidle" })
  await expect(session.page.getByRole("button", { name: /FC HUB Tab/i })).toBeVisible()
  await session.page.waitForTimeout(1000)
  await session.page.keyboard.press("Tab")
  await expect(session.page.getByRole("heading", { name: "FC Hub Social" })).toBeVisible()
  await expect(session.page.getByRole("button", { name: "Amigos" })).toBeVisible()
  await expect(session.page.getByRole("button", { name: "Grupo" })).toBeVisible()
  await session.page.keyboard.press("Tab")
  await expect(session.page.getByRole("heading", { name: "FC Hub Social" })).toBeHidden()

  // A escolha de preset precisa voltar do motor persistido para o cartão do elenco;
  // era aqui que "Posse de Bola" ainda aparecia como "Padrão".
  await session.page.goto(`${baseUrl}/elenco/taticas/`, { waitUntil: "networkidle" })
  await session.page.getByText("Posse de Bola", { exact: true }).first().click()
  await session.page.getByRole("button", { name: /Aplicar Tatica/i }).click()
  await session.page.waitForURL(url => url.pathname === "/elenco/", { timeout: 10000 })
  await expect(session.page.getByText("Posse de Bola", { exact: true }).first()).toBeVisible({ timeout: 10000 })
  await expectClean(session.browserErrors, "editor persistence and FC Hub")
  await session.context.close()
}

const { server, baseUrl } = await startServer()
const browser = await chromium.launch({ headless: true })

try {
  if (process.env.QA_UI_INTERACTIVE_ONLY === "1") {
    await runInteractiveNavigation(browser, baseUrl)
    console.log("OK cliques reais navegaram: menu -> novo jogo e escritorio -> elenco")
    process.exitCode = 0
  } else {
  const xboxTeam = await runControllerCareerFlow(
    browser,
    baseUrl,
    "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
    "Xbox",
  )
  const playstationTeam = await runControllerCareerFlow(
    browser,
    baseUrl,
    "Sony Interactive Entertainment Wireless Controller",
    "PlayStation",
  )
  await runRouteSmoke(browser, baseUrl)
  await runInteractiveNavigation(browser, baseUrl)
  await runEditorAndHubSmoke(browser, baseUrl)

  console.log(`OK fluxo Xbox iniciou carreira com ${xboxTeam}`)
  console.log(`OK fluxo PlayStation iniciou carreira com ${playstationTeam}`)
  console.log("OK rotas principais carregaram: dashboard, elenco, mercado, partida, calendario")
  console.log("OK cliques reais navegaram: menu -> novo jogo e escritorio -> elenco")
  console.log("OK editor persistiu nome, FC Hub abriu/fechou com Tab e preset tático refletiu no elenco")
  }
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
