import { test, expect } from "@playwright/test"
import { injectTeamState } from "./helpers"

// MANAGER RIVALS DE PONTA A PONTA — cliente + servidor de verdade.
//
// ⚠️ ESTE TESTE FALA COM A VPS e por isso NÃO entra no `qa:gates` (gate que
// depende de rede vira gate que reprova por queda de internet). Ele é a prova,
// rodada à mão, de que a fila e o pareamento funcionam do botão ao relay:
//
//     npx playwright test e2e/rivals-ao-vivo.spec.ts --project=chromium
//
// O adversário entra pela API, como entraria o outro técnico. O que se verifica
// é que a TELA muda de "procurando" para "adversário encontrado" — que é
// exatamente o que não acontecia antes de 19/08/2026: o primeiro da fila nunca
// era avisado (ver `partidaAbertaDe` no relay).
const RELAY = "https://ultrafoot.179-198-103-30.sslip.io/relay"
const EU = "convidado"
const OUTRO = "e2e-rivals-adversario"

test("a fila pareia e a tela mostra o adversario", async ({ page, request }) => {
  test.setTimeout(180_000)
  for (const id of [EU, OUTRO]) {
    await request.post(RELAY + "/v1/competitivo/sair", { data: { modo: "rivals", managerId: id } }).catch(() => undefined)
  }
  await injectTeamState(page, "BAH")
  await page.evaluate(() => {
    localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.290")
    localStorage.setItem("ultrafoot:relay-url", "https://ultrafoot.179-198-103-30.sslip.io/relay")
    const s = JSON.parse(localStorage.getItem("ultrafoot:save") || "{}")
    s.multiplayerEnabled = true
    localStorage.setItem("ultrafoot:save", JSON.stringify(s))
  })
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto("/online/rivals/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /Procurar partida/i }).click({ timeout: 30_000 })
  await page.waitForTimeout(2500)

  const r = await request.post(RELAY + "/v1/competitivo/fila", {
    data: { modo: "rivals", managerId: OUTRO, managerName: "Adversario E2E", forcaDoClube: 74, gameVersion: "1.0.191" },
  })
  const corpo = await r.json()
  expect(corpo.estado, "o adversario devia parear com quem ja estava na fila").toBe("pareado")

  // ⚠️ ASSERÇÃO PRECISA: o nome do adversário também aparece na TABELA DE
  // RANKING, e conferir só o nome deu teste verde com a tela ainda dizendo
  // "Procurando adversário…". O que prova o pareamento é o painel — título,
  // código da sala e o botão de entrar.
  await expect(page.getByRole("heading", { name: /Advers.rio encontrado/i })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole("button", { name: /Entrar na partida/i })).toBeVisible()
  console.log("TELA:", (await page.locator("body").innerText()).slice(0, 300).split(String.fromCharCode(10)).join(" | "))

  for (const id of [EU, OUTRO]) {
    await request.post(RELAY + "/v1/competitivo/sair", { data: { modo: "rivals", managerId: id } }).catch(() => undefined)
  }
})
