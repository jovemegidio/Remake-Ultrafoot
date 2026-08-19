import { test } from "@playwright/test"
test("criar carreira de jogador do zero", async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on("pageerror", e => erros.push("PAGEERROR: " + e.message))
  page.on("console", m => { if (m.type() === "error") erros.push("CONSOLE: " + m.text().slice(0, 300)) })
  page.on("requestfailed", r => erros.push("REQFAIL: " + r.url().slice(0, 140) + " :: " + (r.failure()?.errorText ?? "")))
  await page.addInitScript(() => { sessionStorage.setItem("ultrafoot:session-active", "true") })
  await page.goto("/splash")
  await page.evaluate(() => localStorage.clear())
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto("/novo-jogo?modo=jogador")
  await page.waitForLoadState("networkidle")
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => {
      const m = [...document.querySelectorAll("div")].find(d => d.className.toString().includes("z-[9998]"))
      const b = m?.querySelectorAll("button"); if (b?.length) b[b.length - 1].click()
    })
    await page.waitForTimeout(150)
  }
  const nome = page.locator("input[type=text]").first()
  await nome.fill("Atleta Repro")
  const t0 = Date.now()
  await page.getByRole("button", { name: /Iniciar carreira/i }).click({ timeout: 30_000 })
  let destino = ""
  try {
    await page.waitForURL(u => u.pathname.includes("/carreira/jogador"), { timeout: 90_000 })
    destino = "CHEGOU em " + (Date.now() - t0) + " ms"
  } catch {
    destino = "NAO CHEGOU em 90 s. URL atual: " + page.url()
  }
  console.log(destino)
  console.log("texto:", (await page.locator("body").innerText()).slice(0, 240).split(String.fromCharCode(10)).join(" | "))
  console.log(erros.length ? erros.slice(0, 12).join(String.fromCharCode(10)) : "sem erros")
})
