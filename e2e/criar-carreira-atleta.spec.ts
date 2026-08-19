import { test, expect } from "@playwright/test"

// CRIAR UMA CARREIRA DE ATLETA DO ZERO — o caminho que travava (1.0.358).
//
// ⚠️ O RELATO: "coloco os dados e simplesmente não termina". A tela de criação
// pedia, no rodapé, o "Nome do técnico..." — e quem entra pela porta do ATLETA
// preenche o nome dele no painel de criação, não ali. `handleStart` batia no
// guarda do nome, marcava um erro num campo fora do olhar da pessoa e voltava
// sem fazer nada: nenhum erro no console, nenhuma navegação, tela parada.
//
// Este teste percorre o caminho INTEIRO de uma pessoa: abre a porta do atleta,
// preenche o nome no painel, aplica e clica em "Iniciar carreira".
test("cria a carreira de atleta e cai no escritorio", async ({ page }) => {
  test.setTimeout(180_000)
  const problemas: string[] = []
  page.on("pageerror", e => problemas.push("PAGEERROR: " + e.message))

  await page.addInitScript(() => { sessionStorage.setItem("ultrafoot:session-active", "true") })
  await page.goto("/splash")
  await page.evaluate(() => localStorage.clear())
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto("/novo-jogo?modo=jogador")
  await page.waitForLoadState("networkidle")

  // As "novidades da versão" cobrem a tela na primeira entrada.
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => {
      const m = [...document.querySelectorAll("div")].find(d => d.className.toString().includes("z-[9998]"))
      const b = m?.querySelectorAll("button"); if (b?.length) b[b.length - 1].click()
    })
    await page.waitForTimeout(150)
  }

  // O nome vai no painel de criação — como a pessoa faz.
  await page.getByPlaceholder("Nome do atleta", { exact: true }).fill("Atleta Repro")
  // ⚠️ AS "NOVIDADES DA VERSÃO" VOLTAM POR `setTimeout`, já com esta tela aberta,
  // e engolem o clique. Por isso cada tentativa fecha o que estiver por cima
  // antes de tentar de novo — é o que uma pessoa faria.
  const fecharNovidades = async () => {
    await page.evaluate(() => {
      const m = [...document.querySelectorAll("div")].find(d => d.className.toString().includes("z-[9998]"))
      const b = m?.querySelectorAll("button"); if (b?.length) b[b.length - 1].click()
    })
  }
  const clicarComPaciencia = async (nome: RegExp) => {
    for (let i = 0; i < 12; i++) {
      await fecharNovidades()
      // ⚠️ O painel de criação rola POR DENTRO (`max-h-[92vh] overflow-y-auto`):
      // numa janela de 768 px o botão "Aplicar à carreira" fica abaixo da
      // dobra, e o clique cai no vazio. Trazer o botão para a área visível
      // antes é o que uma pessoa faz com a roda do mouse.
      await page.evaluate((texto: string) => {
        const b = [...document.querySelectorAll("button")].find(x => new RegExp(texto, "i").test(x.textContent ?? ""))
        b?.scrollIntoView({ block: "center" })
      }, nome.source)
      try {
        await page.getByRole("button", { name: nome }).click({ timeout: 5_000 })
        return
      } catch { await page.waitForTimeout(500) }
    }
    throw new Error("nao consegui clicar em " + nome)
  }

  await clicarComPaciencia(/Aplicar à carreira/i)
  await page.waitForTimeout(800)

  await clicarComPaciencia(/Iniciar carreira/i)

  // Chegar ao escritório é o que "terminar" significa aqui.
  await expect(page.getByRole("heading", { name: "Atleta Repro", level: 1 }))
    .toBeVisible({ timeout: 90_000 })
  expect(problemas, problemas.join(" | ")).toHaveLength(0)
})
