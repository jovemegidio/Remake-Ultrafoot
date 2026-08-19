import { test } from "@playwright/test"
test("estado da tela de criacao na build", async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on("pageerror", e => erros.push("PAGEERROR: " + e.message.slice(0, 200)))
  page.on("console", m => { if (m.type() === "error") erros.push("CONSOLE: " + m.text().slice(0, 200)) })
  await page.addInitScript(() => { sessionStorage.setItem("ultrafoot:session-active", "true") })
  await page.goto("/splash/")
  await page.evaluate(() => localStorage.clear())
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto("/novo-jogo/?modo=jogador")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(3000)
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      const m = [...document.querySelectorAll("div")].find(d => d.className.toString().includes("z-[9998]"))
      const b = m?.querySelectorAll("button"); if (b?.length) b[b.length - 1].click()
    })
    await page.waitForTimeout(120)
  }
  const cobrindo = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(x => (x.textContent ?? "").includes("Aplicar"))
    if (!b) return "sem botao Aplicar"
    const r = b.getBoundingClientRect()
    const emCima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return "botao em " + Math.round(r.top) + ".." + Math.round(r.bottom) + " | em cima: " + (emCima?.tagName ?? "?") + "." + (emCima?.className?.toString().slice(0, 60) ?? "")
  })
  console.log("APLICAR:", cobrindo)
  console.log("URL:", page.url())
  console.log("TEXTO:", (await page.locator("body").innerText()).slice(0, 400).split(String.fromCharCode(10)).join(" | "))
  console.log("botoes 'Aplicar':", await page.getByRole("button", { name: /Aplicar/i }).count())
  console.log("erros:", erros.slice(0, 6).join(" || ") || "nenhum")
  await page.screenshot({ path: (process.env.PRINT_DIR ?? ".") + "/10-criacao.png" })
})
