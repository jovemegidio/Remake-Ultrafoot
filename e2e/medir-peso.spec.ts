import { test } from "@playwright/test"
// Quanto pesa ABRIR o escritório do atleta pela primeira vez, na build.
test("peso da rota do atleta", async ({ page }) => {
  test.setTimeout(240_000)
  const recursos: { url: string; bytes: number; ms: number }[] = []
  page.on("response", async r => {
    try {
      const h = r.headers()
      const bytes = Number(h["content-length"] ?? 0)
      recursos.push({ url: (r.status() === 200 ? "" : r.status() + " ") + r.url().replace(/^https?:..[^/]+/, ""), bytes, ms: Date.now() })
    } catch {}
  })
  await page.addInitScript(() => { sessionStorage.setItem("ultrafoot:session-active", "true") })
  await page.goto("/splash/")
  await page.evaluate(() => localStorage.clear())
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto("/novo-jogo/?modo=jogador")
  await page.waitForLoadState("networkidle")
  // O modal de novidades tem 14 páginas: fechá-lo é clicar "Avançar" até o fim.
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      const m = [...document.querySelectorAll("div")].find(d => d.className.toString().includes("z-[9998]"))
      const b = m?.querySelectorAll("button"); if (b?.length) b[b.length - 1].click()
    })
    await page.waitForTimeout(120)
  }
  const fechar = async () => { await page.evaluate(() => { const m = [...document.querySelectorAll("div")].find(d => d.className.toString().includes("z-[9998]")); const b = m?.querySelectorAll("button"); if (b?.length) b[b.length - 1].click() }) }
  const clicar = async (nome: RegExp) => { for (let i = 0; i < 15; i++) { await fechar(); try { await page.getByRole("button", { name: nome }).click({ timeout: 5_000 }); return } catch { await page.waitForTimeout(500) } } throw new Error("clique") }
  // Uma pessoa de verdade demora escolhendo clube e digitando: o aquecimento
  // acontece nesse tempo. Sem esta pausa o teste mede o pior caso possível.
  await page.waitForTimeout(12_000)
  await page.getByPlaceholder("Nome do atleta", { exact: true }).fill("Medidor")
  await clicar(/Aplicar à carreira/i)
  await page.waitForTimeout(500)
  const t0 = Date.now()
  await clicar(/Iniciar carreira/i)
  await page.getByRole("heading", { name: "Medidor", level: 1 }).waitFor({ state: "visible", timeout: 180_000 })
  const total = Date.now() - t0
  const antes = recursos.filter(r => r.ms < t0)
  const depois = recursos.filter(r => r.ms >= t0)
  const kb = (l: typeof recursos) => Math.round(l.reduce((n, r) => n + r.bytes, 0) / 1024)
  console.log("TOTAL ate o escritorio:", total, "ms")
  console.log("ANTES do clique:", antes.length, "req |", kb(antes), "KB")
  console.log("DEPOIS do clique:", depois.length, "req |", kb(depois), "KB")
  for (const r of depois.filter(r => r.bytes > 200_000).sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
    console.log("  depois:", String(Math.round(r.bytes / 1024)).padStart(5), "KB", r.url.slice(0, 70))
  }
  const ruins = recursos.filter(r => /^[45]\d\d /.test(r.url))
  console.log("respostas com erro:", ruins.length)
  for (const r of ruins.slice(0, 10)) console.log("   ", r.url.slice(0, 100))
})
