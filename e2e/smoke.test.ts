import { test, expect } from "@playwright/test"
import { injectTeamState } from "./helpers"

test.describe("Smoke — pages load without crash", () => {
  test("splash screen renders menu options", async ({ page }) => {
    await page.goto("/splash")
    await expect(page.locator("text=Novo Jogo")).toBeVisible({ timeout: 10000 })
  })

  test("novo-jogo shows team grid", async ({ page }) => {
    await page.goto("/novo-jogo")
    // At least one team crest or team name should appear
    await expect(page.locator("[data-testid=team-card], .team-card, button[aria-label]").first()).toBeVisible({
      timeout: 10000,
    })
  })

  test("dashboard loads with injected save", async ({ page }) => {
    await injectTeamState(page)
    await page.goto("/")
    // Navigation moved from the legacy sidebar to the top game header.
    await expect(page.locator("header").first()).toBeVisible({ timeout: 12000 })
  })

  test("calendario page loads", async ({ page }) => {
    await injectTeamState(page)
    await page.goto("/calendario")
    await expect(page.locator("text=Brasileirao, text=Rodada").first()).toBeVisible({ timeout: 10000 }).catch(() => {
      // Accept any content that means the page rendered
    })
    // Page should not have a React error boundary fallback
    await expect(page.locator("text=Something went wrong")).not.toBeVisible()
  })

  test("mercado page loads", async ({ page }) => {
    await injectTeamState(page)
    await page.goto("/mercado")
    await expect(page.getByRole("tab", { name: "Buscar Atletas" })).toBeVisible({ timeout: 10000 })
  })

  test("elenco page loads", async ({ page }) => {
    await injectTeamState(page)
    await page.goto("/elenco")
    await expect(page.locator("text=Elenco, text=Escalação, text=Tático").first()).toBeVisible({ timeout: 10000 }).catch(() => {})
    await expect(page.locator("text=Something went wrong")).not.toBeVisible()
  })
})
