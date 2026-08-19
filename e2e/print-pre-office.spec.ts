import { test } from "@playwright/test"
import { injectTeamState } from "./helpers"
test("print do pre-office", async ({ page }) => {
  test.setTimeout(120_000)
  await injectTeamState(page, "BAH")
  await page.evaluate(() => localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.290"))
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto("/pre-office")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2500)
  await page.screenshot({ path: (process.env.PRINT_DIR ?? ".") + "/11-pre-office.png" })
  const m = await page.evaluate(() => {
    const doc = document.documentElement
    const rolam = [...document.querySelectorAll<HTMLElement>("main *")]
      .filter(el => { const e = getComputedStyle(el); return (e.overflowY === "auto" || e.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 4 })
      .map(el => el.className.toString().slice(0, 60) + " :: " + el.scrollHeight + "/" + el.clientHeight)
    return { janela: doc.clientHeight, rolam }
  })
  console.log("janela:", m.janela)
  console.log("rolando por dentro:", m.rolam.join(" | ") || "nada")
})
