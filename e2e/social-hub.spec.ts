import { expect, test } from "@playwright/test"
import { injectTeamState } from "./helpers"

test("Tab abre o FC Hub com tempo total persistente", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ultrafoot:playtime:total-seconds", "7200")
    sessionStorage.removeItem("ultrafoot:playtime:session-start")
    sessionStorage.removeItem("ultrafoot:playtime:session-visible-ms")
  })
  await injectTeamState(page)
  await page.goto("/elenco", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("button", { name: /FC HUB/ })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("ultrafoot:playtime:session-start"))).not.toBeNull()
  await page.evaluate(() => window.addEventListener("ultrafoot:fc-hub", () => sessionStorage.setItem("ultrafoot:test:hub-event", "yes"), { once: true }))
  await page.getByRole("button", { name: /FC HUB/ }).click()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("ultrafoot:test:hub-event"))).toBe("yes")
  await expect(page.getByRole("heading", { name: "Social" })).toBeVisible()
  await expect(page.getByText("Tempo de jogo", { exact: true })).toBeVisible()
  await expect(page.getByText("2h 00min", { exact: true })).toBeVisible()
  await expect(page.getByText(/Temporada 2026 · Semana 1/)).toBeVisible()
  // Campeonato pela internet fica oculto sem relay público configurado
  // (ONLINE_RELAY_ENABLED). A sala local/LAN não depende de relay e continua.
  await expect(page.getByTestId("fc-hub-internet")).toHaveCount(0)
  await expect(page.getByTestId("fc-hub-online").getByText("Sala local / LAN")).toBeVisible()
  await expect(page.getByTestId("fc-hub-online").getByText(/dados 2026\.07\.18/)).toBeVisible()
  await page.getByRole("button", { name: "Ligar servidor" }).click()
  await expect(page.getByText(/servidor embutido está disponível somente no aplicativo instalado/i)).toBeVisible()
})

test("Hub não interfere no uso de Tab dentro de campos", async ({ page }) => {
  await injectTeamState(page)
  await page.goto("/mercado", { waitUntil: "domcontentloaded" })
  const input = page.locator("input").first()
  await input.focus()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("heading", { name: "Social" })).not.toBeVisible()
})
