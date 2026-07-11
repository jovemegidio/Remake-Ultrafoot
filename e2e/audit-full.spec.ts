/**
 * Full end-to-end audit script for Ultrafoot
 * Tests every major flow and captures errors/visual issues
 */
import { test, expect, Page, ConsoleMessage } from "@playwright/test"
import { injectTeamState, injectMatchedState, SAVE_KEY } from "./helpers"
import * as fs from "fs"
import * as path from "path"

const REPORT_DIR = "C:/Users/agencia/AppData/Local/Temp/ultrafoot-audit"
const SCREENSHOTS_DIR = `${REPORT_DIR}/screenshots`

// Ensure dirs exist
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

interface BugReport {
  section: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  description: string
  details?: string
  screenshot?: string
}

const bugs: BugReport[] = []
const consoleErrors: { page: string; msg: string }[] = []

function addBug(bug: BugReport) {
  bugs.push(bug)
  console.log(`[BUG] [${bug.severity}] ${bug.section}: ${bug.description}`)
}

async function captureConsoleErrors(page: Page, section: string) {
  const errors: string[] = []
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      const text = msg.text()
      errors.push(text)
      consoleErrors.push({ page: section, msg: text })
    }
  })
  page.on("pageerror", (err) => {
    const text = err.message
    errors.push(text)
    consoleErrors.push({ page: section, msg: `PAGE ERROR: ${text}` })
  })
  return errors
}

async function screenshot(page: Page, name: string): Promise<string> {
  const filePath = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path: filePath, fullPage: true })
  return filePath
}

// ─── 1. SPLASH SCREEN ────────────────────────────────────────────────────────

test("AUDIT-01: Splash screen loads and menu is visible", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/splash")

  await page.goto("/splash")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(3000) // wait for animations

  const shot = await screenshot(page, "01-splash")

  // Check menu items are present
  const body = await page.content()

  const hasNovoJogo =
    body.includes("Novo Jogo") || body.includes("novo-jogo") || body.includes("NOVO JOGO")
  const hasCarregar =
    body.includes("Carregar") || body.includes("carregar") || body.includes("CARREGAR")

  if (!hasNovoJogo) {
    addBug({
      section: "SPLASH",
      severity: "CRITICAL",
      description: '"Novo Jogo" button not visible on splash screen',
      screenshot: shot,
    })
  }

  if (errors.length > 0) {
    errors.forEach((e) =>
      addBug({
        section: "SPLASH",
        severity: "HIGH",
        description: `Console error on splash: ${e.substring(0, 200)}`,
        screenshot: shot,
      })
    )
  }

  // Check page doesn't crash (not blank)
  const textContent = await page.locator("body").textContent()
  if (!textContent || textContent.trim().length < 10) {
    addBug({
      section: "SPLASH",
      severity: "CRITICAL",
      description: "Splash screen appears blank (no text content)",
      screenshot: shot,
    })
  }
})

test("AUDIT-02: Splash - Serial key validation", async ({ page }) => {
  await captureConsoleErrors(page, "/splash-serial")
  await page.goto("/splash")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  // Look for Registrar option
  const body = await page.content()
  const hasRegistrar = body.includes("Registrar") || body.includes("registrar")

  if (hasRegistrar) {
    // Try to click Registrar
    try {
      const registrarBtn = page.getByText(/registrar/i)
      if (await registrarBtn.isVisible()) {
        await registrarBtn.click()
        await page.waitForTimeout(1000)

        // Try invalid serial
        const input = page.locator('input[type="text"], input[placeholder*="ULTRA"]')
        if (await input.isVisible()) {
          await input.fill("INVALID-KEY")
          await page.keyboard.press("Enter")
          await page.waitForTimeout(500)

          const shot = await screenshot(page, "02-serial-invalid")
          const afterBody = await page.content()
          if (!afterBody.includes("inválid") && !afterBody.includes("Invalid") && !afterBody.includes("erro")) {
            addBug({
              section: "SPLASH/SERIAL",
              severity: "MEDIUM",
              description: "No error feedback shown for invalid serial key",
              screenshot: shot,
            })
          }
        }
      }
    } catch (e) {
      addBug({
        section: "SPLASH/SERIAL",
        severity: "LOW",
        description: `Could not interact with Registrar flow: ${e}`,
      })
    }
  }
})

// ─── 2. NOVO JOGO ─────────────────────────────────────────────────────────────

test("AUDIT-03: Novo Jogo - team selection grid loads", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/novo-jogo")
  await page.goto("/novo-jogo")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "03-novo-jogo")

  // Check teams are shown
  const body = await page.content()
  const hasTeams =
    body.includes("Flamengo") ||
    body.includes("FLA") ||
    body.includes("Corinthians") ||
    body.includes("time")

  if (!hasTeams) {
    addBug({
      section: "NOVO JOGO",
      severity: "CRITICAL",
      description: "Team selection grid not populated with teams",
      screenshot: shot,
    })
  }

  if (errors.length > 0) {
    errors.forEach((e) =>
      addBug({
        section: "NOVO JOGO",
        severity: "HIGH",
        description: `Console error: ${e.substring(0, 200)}`,
        screenshot: shot,
      })
    )
  }
})

test("AUDIT-04: Novo Jogo - select team and start career", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/novo-jogo-select")
  await page.goto("/novo-jogo")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  // Try to click a team
  try {
    // Look for Flamengo or any team button
    const teamButtons = page.locator('[data-team], button, [class*="team"], [class*="card"]')
    const count = await teamButtons.count()

    if (count === 0) {
      addBug({
        section: "NOVO JOGO",
        severity: "HIGH",
        description: "No clickable team elements found on team selection page",
      })
      return
    }

    // Try clicking first available team
    const flaButton = page.getByText(/flamengo/i).first()
    if (await flaButton.isVisible()) {
      await flaButton.click()
      await page.waitForTimeout(1000)
    } else {
      await teamButtons.first().click()
      await page.waitForTimeout(1000)
    }

    const shotAfterTeam = await screenshot(page, "04a-team-selected")

    // Look for manager name input
    const nameInput = page.locator('input[placeholder*="nome"], input[placeholder*="treinador"], input[name*="manager"], input[type="text"]').first()
    if (await nameInput.isVisible()) {
      await nameInput.fill("Técnico Teste")
    }

    // Look for start button
    const startBtn = page.getByText(/começar|iniciar|start|carreira/i).first()
    if (await startBtn.isVisible()) {
      await startBtn.click()
      await page.waitForTimeout(3000)

      const shotAfterStart = await screenshot(page, "04b-career-started")
      const currentUrl = page.url()

      if (currentUrl.includes("/novo-jogo") || currentUrl.includes("/splash")) {
        addBug({
          section: "NOVO JOGO",
          severity: "CRITICAL",
          description: `After clicking start, game did not navigate away from ${currentUrl}`,
          screenshot: shotAfterStart,
        })
      }
    } else {
      addBug({
        section: "NOVO JOGO",
        severity: "HIGH",
        description: "Start career button not found after team selection",
        screenshot: shotAfterTeam,
      })
    }
  } catch (e) {
    addBug({
      section: "NOVO JOGO",
      severity: "HIGH",
      description: `Error during team selection flow: ${e}`,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "NOVO JOGO",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
    })
  )
})

// ─── 3. DASHBOARD ─────────────────────────────────────────────────────────────

test("AUDIT-05: Dashboard - all sections render", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/dashboard")
  await injectTeamState(page, "FLA")
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "05-dashboard")
  const body = await page.content()

  // Check key sections
  const checks = [
    { text: /próxim|partida|match/i, label: "Next matches section" },
    { text: /classificação|standings/i, label: "Standings section" },
    { text: /finanças|saldo|balance/i, label: "Finances summary" },
    { text: /notícias|news/i, label: "News feed" },
  ]

  for (const check of checks) {
    if (!check.text.test(body)) {
      addBug({
        section: "DASHBOARD",
        severity: "MEDIUM",
        description: `${check.label} not visible on dashboard`,
        screenshot: shot,
      })
    }
  }

  if (errors.length > 0) {
    errors.forEach((e) =>
      addBug({
        section: "DASHBOARD",
        severity: "HIGH",
        description: `Console error: ${e.substring(0, 200)}`,
        screenshot: shot,
      })
    )
  }
})

test("AUDIT-06: Dashboard - sidebar navigation works", async ({ page }) => {
  await injectTeamState(page, "FLA")
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(1500)

  // Check sidebar links
  const sidebarLinks = [
    { href: "/elenco", label: "Elenco" },
    { href: "/mercado", label: "Mercado" },
    { href: "/calendario", label: "Calendário" },
    { href: "/financas", label: "Finanças" },
  ]

  for (const link of sidebarLinks) {
    const el = page.locator(`a[href="${link.href}"], a[href*="${link.href}"]`).first()
    if (!(await el.isVisible())) {
      addBug({
        section: "DASHBOARD/SIDEBAR",
        severity: "MEDIUM",
        description: `Sidebar link to "${link.label}" (${link.href}) not found`,
      })
    }
  }
})

// ─── 4. PRE-MATCH ─────────────────────────────────────────────────────────────

test("AUDIT-07: Pre-match page loads", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/partida")
  await injectMatchedState(page, "FLA", 1)
  await page.goto("/partida")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "07-partida")
  const body = await page.content()

  const hasMatchInfo =
    body.includes("vs") ||
    body.includes("partida") ||
    body.includes("formação") ||
    body.includes("escalação") ||
    body.includes("tático")

  if (!hasMatchInfo) {
    addBug({
      section: "PRE-MATCH",
      severity: "HIGH",
      description: "Pre-match page does not show match information (no 'vs', formation, or lineup)",
      screenshot: shot,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "PRE-MATCH",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 5. LIVE MATCH ────────────────────────────────────────────────────────────

test("AUDIT-08: Live match simulation", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/partida/ao-vivo")
  await injectMatchedState(page, "FLA", 1)
  await page.goto("/partida/ao-vivo")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(3000)

  const shotInitial = await screenshot(page, "08a-live-match-initial")
  const body = await page.content()

  // Check match time display
  const hasTime = body.includes("'") || body.includes("min") || body.includes("45") || body.includes("90")
  if (!hasTime) {
    addBug({
      section: "LIVE MATCH",
      severity: "HIGH",
      description: "Live match page does not show match time/minute",
      screenshot: shotInitial,
    })
  }

  // Check pitch/board exists
  const hasPitch = body.includes("campo") || body.includes("pitch") || body.includes("live") || body.includes("placar")
  if (!hasPitch) {
    addBug({
      section: "LIVE MATCH",
      severity: "HIGH",
      description: "Live match page does not render pitch/scoreboard",
      screenshot: shotInitial,
    })
  }

  // Wait for match to progress
  await page.waitForTimeout(5000)
  const shotProgress = await screenshot(page, "08b-live-match-progress")

  // Check if match events appear
  const afterBody = await page.content()
  const hasEvents =
    afterBody.includes("gol") ||
    afterBody.includes("goal") ||
    afterBody.includes("cartão") ||
    afterBody.includes("falta") ||
    afterBody.includes("substituição") ||
    afterBody.includes("45'") ||
    afterBody.includes("90'")

  if (!hasEvents) {
    addBug({
      section: "LIVE MATCH",
      severity: "MEDIUM",
      description: "No match events visible after 5 seconds (no goals/cards/fouls/subs shown)",
      screenshot: shotProgress,
    })
  }

  // Wait for match to end (up to 30s for simulation)
  try {
    await page.waitForSelector('[data-match-end], [class*="result"], [class*="final"]', { timeout: 30000 })
    const shotEnd = await screenshot(page, "08c-live-match-end")
  } catch {
    // Match might still be running or no end indicator
    const shotTimeout = await screenshot(page, "08c-live-match-timeout")
    addBug({
      section: "LIVE MATCH",
      severity: "MEDIUM",
      description: "Match end/result modal not detected within 30 seconds",
      screenshot: shotTimeout,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "LIVE MATCH",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
    })
  )
})

// ─── 6. SQUAD PAGE ────────────────────────────────────────────────────────────

test("AUDIT-09: Elenco (squad) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/elenco")
  await injectTeamState(page, "FLA")
  await page.goto("/elenco")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "09-elenco")
  const body = await page.content()

  // Check players list
  const hasPlayers =
    body.includes("goleiro") ||
    body.includes("Goleiro") ||
    body.includes("GK") ||
    body.includes("atacante") ||
    body.includes("zagueiro") ||
    body.includes("overall") ||
    body.includes("OVR")

  if (!hasPlayers) {
    addBug({
      section: "ELENCO",
      severity: "HIGH",
      description: "Squad page does not show player list or position groups",
      screenshot: shot,
    })
  }

  // Check player count is reasonable
  const playerCards = await page.locator('[class*="player"], [data-player]').count()
  if (playerCards === 0) {
    addBug({
      section: "ELENCO",
      severity: "HIGH",
      description: "No player card elements found on squad page",
      screenshot: shot,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "ELENCO",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

test("AUDIT-10: Elenco gerenciamento (squad management)", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/elenco/gerenciamento")
  await injectTeamState(page, "FLA")
  await page.goto("/elenco/gerenciamento")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "10-elenco-gerenciamento")
  errors.forEach((e) =>
    addBug({
      section: "ELENCO/GERENCIAMENTO",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

test("AUDIT-11: Escalacoes (lineups) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/elenco/escalacoes")
  await injectTeamState(page, "FLA")
  await page.goto("/elenco/escalacoes")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "11-escalacoes")
  const body = await page.content()

  const hasFormation =
    body.includes("4-4-2") ||
    body.includes("4-3-3") ||
    body.includes("formação") ||
    body.includes("escalação") ||
    body.includes("campo")

  if (!hasFormation) {
    addBug({
      section: "ESCALACOES",
      severity: "MEDIUM",
      description: "Lineup/formation page does not show tactical formation",
      screenshot: shot,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "ESCALACOES",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 7. MERCADO (TRANSFER MARKET) ─────────────────────────────────────────────

test("AUDIT-12: Mercado (transfer market) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/mercado")
  await injectTeamState(page, "FLA")
  await page.goto("/mercado")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "12-mercado")
  const body = await page.content()

  const hasMarket =
    body.includes("transferência") ||
    body.includes("mercado") ||
    body.includes("valor") ||
    body.includes("contrato") ||
    body.includes("jogador")

  if (!hasMarket) {
    addBug({
      section: "MERCADO",
      severity: "HIGH",
      description: "Transfer market page does not show player market data",
      screenshot: shot,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "MERCADO",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 8. FINANÇAS ───────────────────────────────────────────────────────────────

test("AUDIT-13: Finanças (finances) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/financas")
  await injectTeamState(page, "FLA")
  await page.goto("/financas")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "13-financas")
  const body = await page.content()

  const hasFinances =
    body.includes("R$") ||
    body.includes("saldo") ||
    body.includes("receita") ||
    body.includes("despesa") ||
    body.includes("salário")

  if (!hasFinances) {
    addBug({
      section: "FINANÇAS",
      severity: "HIGH",
      description: "Finances page does not show financial data (R$, saldo, receita)",
      screenshot: shot,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "FINANÇAS",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 9. CALENDÁRIO ────────────────────────────────────────────────────────────

test("AUDIT-14: Calendário (calendar) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/calendario")
  await injectTeamState(page, "FLA")
  await page.goto("/calendario")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "14-calendario")
  const body = await page.content()

  const hasCalendar =
    body.includes("rodada") ||
    body.includes("semana") ||
    body.includes("Rodada") ||
    body.includes("vs") ||
    body.includes("partida")

  if (!hasCalendar) {
    addBug({
      section: "CALENDÁRIO",
      severity: "HIGH",
      description: "Calendar page does not show match schedule (rounds/weeks)",
      screenshot: shot,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "CALENDÁRIO",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 10. COMPETIÇÕES ──────────────────────────────────────────────────────────

test("AUDIT-15: Competições page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/competicoes")
  await injectTeamState(page, "FLA")
  await page.goto("/competicoes")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "15-competicoes")
  errors.forEach((e) =>
    addBug({
      section: "COMPETIÇÕES",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 11. TREINAMENTO ──────────────────────────────────────────────────────────

test("AUDIT-16: Treinamento (training) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/treinamento")
  await injectTeamState(page, "FLA")
  await page.goto("/treinamento")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "16-treinamento")
  const body = await page.content()

  const hasTraining =
    body.includes("treinamento") ||
    body.includes("treino") ||
    body.includes("velocidade") ||
    body.includes("finalização") ||
    body.includes("XP") ||
    body.includes("habilidade")

  if (!hasTraining) {
    addBug({
      section: "TREINAMENTO",
      severity: "MEDIUM",
      description: "Training page does not show training programs or attributes",
      screenshot: shot,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "TREINAMENTO",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 12. VESTIÁRIO ────────────────────────────────────────────────────────────

test("AUDIT-17: Vestiário (dressing room/morale) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/vestiario")
  await injectTeamState(page, "FLA")
  await page.goto("/vestiario")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "17-vestiario")
  errors.forEach((e) =>
    addBug({
      section: "VESTIÁRIO",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 13. INFRAESTRUTURA ───────────────────────────────────────────────────────

test("AUDIT-18: Infraestrutura page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/infraestrutura")
  await injectTeamState(page, "FLA")
  await page.goto("/infraestrutura")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "18-infraestrutura")
  errors.forEach((e) =>
    addBug({
      section: "INFRAESTRUTURA",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 14. CONTRATOS ────────────────────────────────────────────────────────────

test("AUDIT-19: Contratos page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/contratos")
  await injectTeamState(page, "FLA")
  await page.goto("/contratos")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "19-contratos")
  const body = await page.content()

  const hasContracts =
    body.includes("contrato") ||
    body.includes("salário") ||
    body.includes("vencimento") ||
    body.includes("renovar")

  if (!hasContracts) {
    addBug({
      section: "CONTRATOS",
      severity: "MEDIUM",
      description: "Contracts page does not show contract data",
      screenshot: shot,
    })
  }

  errors.forEach((e) =>
    addBug({
      section: "CONTRATOS",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 15. ESTATÍSTICAS & HISTÓRICO ─────────────────────────────────────────────

test("AUDIT-20: Estatísticas page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/estatisticas")
  await injectTeamState(page, "FLA")
  await page.goto("/estatisticas")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "20-estatisticas")
  errors.forEach((e) =>
    addBug({
      section: "ESTATÍSTICAS",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

test("AUDIT-21: Histórico page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/historico")
  await injectTeamState(page, "FLA")
  await page.goto("/historico")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "21-historico")
  errors.forEach((e) =>
    addBug({
      section: "HISTÓRICO",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 16. CONFIGURAÇÕES ────────────────────────────────────────────────────────

test("AUDIT-22: Configurações page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/configuracoes")
  await injectTeamState(page, "FLA")
  await page.goto("/configuracoes")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "22-configuracoes")
  errors.forEach((e) =>
    addBug({
      section: "CONFIGURAÇÕES",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 17. OLHEIROS ─────────────────────────────────────────────────────────────

test("AUDIT-23: Olheiros (scouts) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/olheiros")
  await injectTeamState(page, "FLA")
  await page.goto("/olheiros")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "23-olheiros")
  errors.forEach((e) =>
    addBug({
      section: "OLHEIROS",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 18. SAVE/LOAD CYCLE ──────────────────────────────────────────────────────

test("AUDIT-24: Save/load cycle", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/save-load")
  await injectTeamState(page, "FLA")
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  // Check save exists in localStorage
  const saveData = await page.evaluate((key) => {
    return localStorage.getItem(key)
  }, SAVE_KEY)

  if (!saveData) {
    addBug({
      section: "SAVE/LOAD",
      severity: "CRITICAL",
      description: "No save data found in localStorage after injecting state",
    })
    return
  }

  let save: any
  try {
    save = JSON.parse(saveData)
  } catch {
    addBug({
      section: "SAVE/LOAD",
      severity: "CRITICAL",
      description: "Save data in localStorage is not valid JSON",
    })
    return
  }

  if (!save.version || save.version < 3) {
    addBug({
      section: "SAVE/LOAD",
      severity: "HIGH",
      description: `Save version is ${save.version}, expected >= 3`,
    })
  }

  if (!save.selectedTeamShort) {
    addBug({
      section: "SAVE/LOAD",
      severity: "CRITICAL",
      description: "Save data missing selectedTeamShort — team selection not persisted",
    })
  }

  // Navigate to splash and back to test load
  await page.goto("/splash")
  await page.waitForTimeout(1500)

  const saveAfter = await page.evaluate((key) => {
    return localStorage.getItem(key)
  }, SAVE_KEY)

  if (!saveAfter) {
    addBug({
      section: "SAVE/LOAD",
      severity: "HIGH",
      description: "Save data was lost after navigating to splash screen",
    })
  }
})

// ─── 19. TÁCITAS ──────────────────────────────────────────────────────────────

test("AUDIT-25: Táticas (tactics) page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/taticas")
  await injectTeamState(page, "FLA")
  await page.goto("/taticas")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "25-taticas")
  errors.forEach((e) =>
    addBug({
      section: "TÁTICAS",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 20. ADVERSÁRIOS ──────────────────────────────────────────────────────────

test("AUDIT-26: Adversários page", async ({ page }) => {
  const errors = await captureConsoleErrors(page, "/adversarios")
  await injectTeamState(page, "FLA")
  await page.goto("/adversarios")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const shot = await screenshot(page, "26-adversarios")
  errors.forEach((e) =>
    addBug({
      section: "ADVERSÁRIOS",
      severity: "HIGH",
      description: `Console error: ${e.substring(0, 200)}`,
      screenshot: shot,
    })
  )
})

// ─── 21. NO-SAVE NAVIGATION (edge case) ───────────────────────────────────────

test("AUDIT-27: Pages without save data redirect correctly", async ({ page }) => {
  // Navigating to dashboard without any save should redirect/show error
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)

  const url = page.url()
  const shot = await screenshot(page, "27-no-save-redirect")

  // Should NOT be stuck on dashboard without data
  const body = await page.content()
  const isBlank = !body || body.trim().length < 50
  if (isBlank) {
    addBug({
      section: "NAVIGATION",
      severity: "HIGH",
      description: "Dashboard blank when accessed without save data",
      screenshot: shot,
    })
  }

  // Log URL for info
  console.log(`[INFO] No-save navigation result URL: ${url}`)
})

// ─── FINAL: Write JSON report ─────────────────────────────────────────────────

test("AUDIT-FINAL: Write bug report JSON", async ({ page }) => {
  const reportData = {
    generatedAt: new Date().toISOString(),
    totalBugs: bugs.length,
    bySection: bugs.reduce(
      (acc, b) => {
        acc[b.section] = acc[b.section] || []
        acc[b.section].push(b)
        return acc
      },
      {} as Record<string, BugReport[]>
    ),
    bySeverity: {
      CRITICAL: bugs.filter((b) => b.severity === "CRITICAL"),
      HIGH: bugs.filter((b) => b.severity === "HIGH"),
      MEDIUM: bugs.filter((b) => b.severity === "MEDIUM"),
      LOW: bugs.filter((b) => b.severity === "LOW"),
      INFO: bugs.filter((b) => b.severity === "INFO"),
    },
    consoleErrors,
    allBugs: bugs,
  }

  fs.writeFileSync(
    `${REPORT_DIR}/audit-results.json`,
    JSON.stringify(reportData, null, 2),
    "utf-8"
  )

  console.log(`\n===== AUDIT SUMMARY =====`)
  console.log(`Total bugs found: ${bugs.length}`)
  console.log(`CRITICAL: ${reportData.bySeverity.CRITICAL.length}`)
  console.log(`HIGH: ${reportData.bySeverity.HIGH.length}`)
  console.log(`MEDIUM: ${reportData.bySeverity.MEDIUM.length}`)
  console.log(`LOW: ${reportData.bySeverity.LOW.length}`)
  console.log(`Console errors: ${consoleErrors.length}`)
  console.log(`Report: ${REPORT_DIR}/audit-results.json`)
  console.log(`Screenshots: ${SCREENSHOTS_DIR}/`)
})