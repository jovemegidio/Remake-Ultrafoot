// AS TELAS DO ATLETA NÃO ROLAM, E O MENU LEVA A CADA UMA (1.0.358).
//
// ⚠️ POR QUE MEDIR EM NAVEGADOR. O relato veio com print: o escritório do atleta
// rolava e o fim do cartão sumia por baixo da barra de controle. "Parece que
// cabe" é opinião — `scrollHeight > clientHeight` é medida. É a mesma lição do
// harness de responsividade: medir antes de opinar.
//
// O estado do atleta é montado no Node (o mesmo `criarCarreiraDeJogador` do
// jogo) e injetado no save antes de a tela abrir; inventar um JSON à mão aqui
// criaria uma segunda ideia de como é uma carreira de atleta.
import { test, expect, type Page } from "@playwright/test"
import { execFileSync } from "node:child_process"
import path from "node:path"

const SAVE_KEY = "ultrafoot:save"

/** Gera a carreira com o motor do jogo, num processo tsx à parte. */
function carreiraDeAtletaJson(): string {
  const script = path.join(process.cwd(), "scripts", "fixture-carreira-de-atleta.ts")
  return execFileSync("npx", ["tsx", script], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  }).trim()
}

const carreira = carreiraDeAtletaJson()

async function abrirComoAtleta(page: Page, rota: string) {
  await page.addInitScript(() => {
    sessionStorage.setItem("ultrafoot:session-active", "true")
  })
  await page.goto("/splash")
  await page.evaluate(
    ({ key, carreira }) => {
      localStorage.setItem(key, JSON.stringify({
        version: 3,
        selectedTeamShort: null,
        modalidade: "jogador",
        carreiraDeJogador: JSON.parse(carreira),
        week: 0,
        season: 2026,
        managerName: "Atleta Teste",
        language: "pt-BR",
        controllerType: "xbox",
        selectedUniform: "home",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        multiplayerEnabled: false,
        managers: [],
        activeManagerId: null,
        controllerBindings: {},
        coachSkills: [],
        coachXP: 0,
        coachCrisisCount: 0,
        coachWinStreak: 0,
        coachTotalTitles: 0,
        coachLegacy: { totalSeasons: 0, totalTitles: 0, careerRecords: [], legacySkills: [], reputationLevel: 0, legacyXP: 0 },
      }))
    },
    { key: SAVE_KEY, carreira },
  )
  // ⚠️ AS "NOVIDADES DA VERSÃO" SÃO A MAIOR FONTE DE INSTABILIDADE AQUI: são 14
  // páginas, o botão do canto é "Avançar" (não "fechar"), e o modal volta por
  // `setTimeout` depois da tela montar. Em vez de brigar com ele a cada clique,
  // o teste diz que JÁ VIU esta versão — é a mesma marca que o jogo grava.
  await page.evaluate(() => localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.290"))
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(rota)
  await page.waitForLoadState("networkidle")
  // As "novidades da versão" cobrem a tela na primeira entrada (z-9998) e
  // engolem qualquer clique.
  //
  // ⚠️ FECHAR NO ESC NÃO SERVE AQUI: o Esc das telas do atleta é "voltar", e o
  // teste terminava no `/treinador` sem ter clicado em nada. Fecha-se pelo
  // botão do próprio modal, que é o que uma pessoa faria.
  // Ele entra por `setTimeout` depois do store durável abrir: procurar uma vez
  // só encontra a tela limpa e o modal aparece logo em seguida, no meio do
  // teste. Por isso o laço INSISTE por alguns segundos.
  for (let i = 0; i < 24; i++) {
    await page.evaluate(() => {
      const modal = [...document.querySelectorAll("div")]
        .find(d => d.className.toString().includes("z-[9998]"))
      const botoes = modal?.querySelectorAll("button")
      if (botoes?.length) botoes[botoes.length - 1].click()
    })
    await page.waitForTimeout(200)
  }
}

/**
 * Quanto a PÁGINA passa da janela, e quanto SOBRA embaixo.
 *
 * ⚠️ NÃO MISTURE `document.body` COM `documentElement` AQUI. O jogo roda em
 * `body { zoom: 0.8 }`: as medidas do body vêm na escala local (960 px numa
 * janela de 768) e as do `documentElement` vêm em pixel de tela. Comparar as
 * duas acusa 192 px de transbordo numa tela que não rola — foi o primeiro
 * resultado deste teste, e era do medidor, não da tela. `getBoundingClientRect`
 * já devolve pixel de tela, e é por ele que se mede o que o olho vê.
 */
async function medir(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const caixas = [...document.querySelectorAll<HTMLElement>("main > div > div, main section")]
      .map(el => el.getBoundingClientRect().bottom)
    return {
      vertical: doc.scrollHeight - doc.clientHeight,
      horizontal: doc.scrollWidth - doc.clientWidth,
      janela: doc.clientHeight,
      fundoDoConteudo: caixas.length ? Math.max(...caixas) : 0,
    }
  })
}

/**
 * Abre o menu do cabeçalho (tecla W) UMA vez.
 *
 * ⚠️ NÃO INSISTA NA TECLA. O menu tem um campo de busca que recebe o foco ao
 * abrir: um segundo "w" não reabre o menu — ele DIGITA "w" na busca e troca a
 * lista pelos resultados. O teste ficava clicando num item que já não estava
 * mais ali, e o erro chegava disfarçado de "clique interceptado".
 */
async function abrirMenu(page: Page) {
  const busca = page.getByPlaceholder(/Buscar tela/i)
  // A primeira tecla se perde enquanto a tela ainda hidrata; a partir daí, cada
  // tentativa só acontece com o menu FECHADO, então nenhuma vira texto na busca.
  for (let i = 0; i < 10 && !(await busca.count()); i++) {
    await page.keyboard.press("w")
    await page.waitForTimeout(1000)
  }
  await busca.waitFor({ state: "visible", timeout: 45_000 })
  return busca
}

const TELAS = [
  { rota: "/carreira/jogador", nome: "escritorio" },
  { rota: "/carreira/jogador/calendario", nome: "calendario" },
  { rota: "/carreira/jogador/evolucao", nome: "evolucao" },
  { rota: "/carreira/jogador/trajetoria", nome: "trajetoria" },
]

for (const tela of TELAS) {
  test(`${tela.nome}: abre e nao rola`, async ({ page }) => {
    await abrirComoAtleta(page, tela.rota)
    // A tela é DELE: o nome do atleta aparece no cabeçalho de todas as quatro.
    await expect(page.getByRole("heading", { name: "Atleta Teste", level: 1 })).toBeVisible()
    const m = await medir(page)
    expect(m.vertical, `${tela.nome} passou ${m.vertical}px da altura da janela`).toBeLessThanOrEqual(2)
    expect(m.horizontal, `${tela.nome} passou ${m.horizontal}px da largura`).toBeLessThanOrEqual(2)
    // ⚠️ E O OUTRO LADO DA MESMA QUEIXA: o print marcava de vermelho um RETÂNGULO
    // VAZIO no rodapé. Tela que não rola mas para na metade da altura tem o
    // mesmo defeito visto do avesso — o conteúdo precisa CHEGAR ao fim.
    expect(
      m.fundoDoConteudo,
      `${tela.nome} termina em ${Math.round(m.fundoDoConteudo)}px numa janela de ${m.janela}px — sobra faixa morta`,
    ).toBeGreaterThan(m.janela * 0.85)
  })
}

test("o menu do atleta leva as quatro telas (era o 'nenhuma dessas opcoes funciona')", async ({ page }) => {
  test.setTimeout(120_000)
  await abrirComoAtleta(page, "/carreira/jogador")
  for (const [rotulo, esperado] of [
    ["Calendario e tabela", "/carreira/jogador/calendario"],
    ["Evolucao e atributos", "/carreira/jogador/evolucao"],
    ["Trajetoria", "/carreira/jogador/trajetoria"],
  ] as const) {
    await abrirMenu(page)
    const item = page.getByRole("button", { name: rotulo, exact: true })
    await item.click({ timeout: 30_000 })
    await page.waitForURL(url => url.pathname.replace(/\/$/, "") === esperado, { timeout: 45_000 })
  }
})

test("o resto do menu do atleta tambem leva a algum lugar", async ({ page }) => {
  test.setTimeout(120_000)
  await abrirComoAtleta(page, "/carreira/jogador")

  // ⚠️ A ÁREA MARCADA DE VERMELHO NO PRINT INCLUÍA A BUSCA E O "CONFIGURAÇÕES".
  // Não bastava consertar as três telas: o relato foi "NENHUMA dessas opções
  // funciona", e um item que abre a tela errada é tão quebrado quanto um que
  // não abre nada.
  const busca = await abrirMenu(page)
  await busca.fill("Trajet")
  await page.getByRole("button", { name: /Trajetoria/i }).first().click({ timeout: 30_000 })
  await page.waitForURL(url => url.pathname.includes("/carreira/jogador/trajetoria"), { timeout: 45_000 })

  await abrirMenu(page)
  await page.getByRole("button", { name: "Configuracoes", exact: true }).click({ timeout: 30_000 })
  await page.waitForURL(url => url.pathname.includes("/configuracoes"), { timeout: 45_000 })
  // E a tela de Configurações precisa ABRIR num save de atleta (ela lê o clube
  // do técnico, que aqui não existe) — sem cair na tela de erro do Next.
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator("text=Application error")).toHaveCount(0)
})

test("rescindir deixa o atleta sem clube, com o mercado aberto", async ({ page }) => {
  test.setTimeout(120_000)
  await abrirComoAtleta(page, "/carreira/jogador")
  await abrirMenu(page)
  await page.getByRole("button", { name: /Rescindir contrato/i }).click({ timeout: 30_000 })
  await page.getByRole("button", { name: /Confirmar rescisao/i }).click({ timeout: 30_000 })
  await page.waitForURL(url => url.pathname.includes("/carreira/jogador"), { timeout: 45_000 })

  // O escritório vira a mesa do agente: cartaz, diário e "avançar semana".
  await expect(page.getByRole("button", { name: /Avançar semana/i })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText(/CARTAZ NO MERCADO/i)).toBeVisible()
  const m = await medir(page)
  expect(m.vertical, `a tela de mercado passou ${m.vertical}px da janela`).toBeLessThanOrEqual(2)
})
