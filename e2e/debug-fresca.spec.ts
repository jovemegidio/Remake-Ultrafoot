import { test } from "@playwright/test"
import { execFileSync } from "node:child_process"
import path from "node:path"
const carreira = execFileSync("npx", ["tsx", path.join(process.cwd(), "scripts", "fixture-carreira-de-atleta.ts")], { encoding: "utf-8", maxBuffer: 64*1024*1024, shell: process.platform === "win32", env: { ...process.env, RODADAS: "0" } }).trim()
test("carreira recem-criada abre", async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on("pageerror", e => erros.push("PAGEERROR: " + e.message))
  page.on("console", m => { if (m.type() === "error") erros.push("CONSOLE: " + m.text().slice(0, 200)) })
  await page.addInitScript(() => { sessionStorage.setItem("ultrafoot:session-active", "true") })
  await page.goto("/splash")
  await page.evaluate((c) => {
    localStorage.setItem("ultrafoot:save", JSON.stringify({ version: 3, selectedTeamShort: null, modalidade: "jogador", carreiraDeJogador: JSON.parse(c), week: 0, season: 2026, managerName: "Atleta Teste", language: "pt-BR", controllerType: "xbox", selectedUniform: "home", createdAt: Date.now(), updatedAt: Date.now(), multiplayerEnabled: false, managers: [], activeManagerId: null, controllerBindings: {}, coachSkills: [], coachXP: 0, coachCrisisCount: 0, coachWinStreak: 0, coachTotalTitles: 0, coachLegacy: { totalSeasons: 0, totalTitles: 0, careerRecords: [], legacySkills: [], reputationLevel: 0, legacyXP: 0 } }))
  }, carreira)
  await page.setViewportSize({ width: 1366, height: 768 })
  const t0 = Date.now()
  await page.goto("/carreira/jogador")
  await page.waitForLoadState("networkidle")
  const achouTitulo = await page.getByRole("heading", { name: "Atleta Teste", level: 1 }).count()
  console.log("tempo ate networkidle:", Date.now() - t0, "ms | titulo visivel:", achouTitulo)
  console.log("texto:", (await page.locator("body").innerText()).slice(0, 300).split(String.fromCharCode(10)).join(" | "))
  console.log(erros.length ? erros.slice(0, 8).join(String.fromCharCode(10)) : "sem erros de console")
})
