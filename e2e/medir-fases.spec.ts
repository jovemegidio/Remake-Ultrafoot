import { test } from "@playwright/test"
test("medir fases da criacao", async ({ page }) => {
  test.setTimeout(240_000)
  const marcas: string[] = []
  page.on("console", m => { const t = m.text(); if (t.startsWith("[t]")) marcas.push(t) })
  await page.addInitScript(() => { sessionStorage.setItem("ultrafoot:session-active", "true") })
  await page.goto("/splash")
  await page.evaluate(() => localStorage.clear())
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto("/novo-jogo?modo=jogador")
  await page.waitForLoadState("networkidle")
  const fechar = async () => { await page.evaluate(() => { const m = [...document.querySelectorAll("div")].find(d => d.className.toString().includes("z-[9998]")); const b = m?.querySelectorAll("button"); if (b?.length) b[b.length - 1].click() }) }
  const clicar = async (nome: RegExp) => { for (let i = 0; i < 15; i++) { await fechar(); try { await page.getByRole("button", { name: nome }).click({ timeout: 5_000 }); return } catch { await page.waitForTimeout(500) } } throw new Error("clique") }
  await page.getByPlaceholder("Nome do atleta", { exact: true }).fill("Medidor")
  await clicar(/Aplicar à carreira/i)
  await page.waitForTimeout(500)
  const t0 = Date.now()
  await clicar(/Iniciar carreira/i)
  await page.getByRole("heading", { name: "Medidor", level: 1 }).waitFor({ state: "visible", timeout: 180_000 })
  console.log("TOTAL:", Date.now() - t0, "ms")
  for (const m of marcas) console.log(m)
})
