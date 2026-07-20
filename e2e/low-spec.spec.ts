import { expect, test } from "@playwright/test"
import { injectTeamState } from "./helpers"

const ROUTES = ["/", "/elenco", "/calendario", "/mercado", "/competicoes", "/partida"]

test("perfil de 4 GB navega nas telas críticas com CPU 4x e heap controlado", async ({ page, context }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 4 })
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 4 })
    localStorage.removeItem("ultrafoot:performance-profile")
  })

  const cdp = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await cdp.send("Performance.enable")

  const failures: string[] = []
  page.on("requestfailed", request => {
    const url = request.url()
    const error = request.failure()?.errorText
    if (url.startsWith("http://localhost") && error !== "net::ERR_ABORTED") failures.push(`${error}: ${url}`)
  })

  await injectTeamState(page)
  for (const route of ROUTES) {
    const started = Date.now()
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 30_000 })
    await expect(page.locator("body")).not.toBeEmpty()
    await expect(page.locator("text=Something went wrong")).not.toBeVisible()
    expect(Date.now() - started, `${route} excedeu 30 s com CPU 4x`).toBeLessThan(30_000)
  }

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.performance)).toBe("economy")
  const metrics = await cdp.send("Performance.getMetrics")
  const jsHeap = metrics.metrics.find(metric => metric.name === "JSHeapUsedSize")?.value ?? 0
  expect(jsHeap / 1024 / 1024, "heap JS deve ficar abaixo de 350 MB").toBeLessThan(350)
  expect(failures, "recursos locais não podem falhar").toEqual([])
})

test("layout mínimo permanece utilizável em 1280x720", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => localStorage.setItem("ultrafoot:performance-profile", "economy"))
  await injectTeamState(page)
  await page.goto("/elenco", { waitUntil: "domcontentloaded" })
  await expect(page.locator("body")).not.toBeEmpty()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, "não deve haver estouro horizontal relevante").toBeLessThanOrEqual(4)
})
