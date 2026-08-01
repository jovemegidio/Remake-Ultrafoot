// REGRESSAO: a categoria de base devolvia os juniores que ja tinham saido.
//
// Relato do usuario (reincidente, sobreviveu a dois consertos): "vendi os
// juniores, sai da tela, voltei e eles estavam la — e a venda nao pagou".
//
// A causa NAO era a gravacao da venda. Era um efeito da propria tela: os efeitos
// do componente rodam no mesmo commit, com o fechamento do PRIMEIRO render, e
// nesse instante `useGameState()` ainda devolve DEFAULT_STATE. A semeadura via
// entao `youthDeparted` vazio, `youthPlayers` vazio e — porque `useUserTeam` cai
// num FALLBACK que e o Botafogo — gerava a base do BOT por cima do save real.
// Como a geracao e deterministica, cada visita regravava os mesmos garotos.
//
// Estes testes cobrem os dois lados: nao ressuscitar quem saiu, e nao injetar
// atleta de outro clube. A navegacao usada e a MESMA do jogo (evento
// `ultrafoot:navigate`, que o hardNavigate despacha para o router do Next) — um
// `page.goto` recarregaria a pagina e esfriaria o cache do store, escondendo o bug.

import { test, expect, type Page } from "@playwright/test"

const CARREIRA = "career-qa-base"
const CHAVE_SAVE = `ultrafoot:save:${CARREIRA}`
/** Palmeiras: qualquer clube que NAO seja o fallback (Botafogo) serve. */
const CLUBE = "PAL"

function jovem(indice: number) {
  return {
    id: `youth_${CLUBE}_2026_${indice}`,
    name: `Garoto ${indice}`,
    position: "MEI",
    age: 16,
    overall: 55,
    potential: 72,
    value: 500_000,
    pace: 60, shooting: 55, passing: 60, dribbling: 58, defending: 45, physical: 50,
    fromTeam: "Categoria de Base",
    trend: "up",
    seasonSigned: 2025,
  }
}

async function prepararSave(page: Page, jovens: ReturnType<typeof jovem>[], saidos: string[]) {
  await page.addInitScript(
    ({ carreira, chave, clube, jovens, saidos }) => {
      sessionStorage.setItem("ultrafoot:session-active", "true")
      // Sem isto o modal "O que ha de novo" cobre a tela e engole os cliques.
      localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.187")
      localStorage.setItem("ultrafoot:active-career", carreira)
      // ⚠️ SEMEAR UMA VEZ SO. `addInitScript` roda a CADA carga de pagina, e o
      // jogo cai em reload completo quando o router demora (ver navegarNoJogo).
      // Semear de novo reescreveria o save original por cima do que o teste
      // acabou de fazer — parecia bug do jogo e era do harness.
      if (localStorage.getItem(chave)) return
      localStorage.setItem(chave, JSON.stringify({
        version: 7,
        careerId: carreira,
        saveName: "QA base",
        selectedTeamShort: clube,
        managerName: "Tecnico QA",
        season: 2026,
        // Semana 20: fora da janela de transferencias, que e o caso mais comum.
        week: 20,
        preOfficeVisitado: true,
        createdAt: 1, updatedAt: 1,
        youthPlayers: jovens,
        youthDeparted: saidos,
        // Ja semeada e ja envelhecida nesta temporada: nenhum dos dois efeitos
        // tem trabalho legitimo a fazer. Se algo mudar na base, e bug.
        youthSeededSeason: 2026,
        youthAgedSeason: 2026,
      }))
    },
    { carreira: CARREIRA, chave: CHAVE_SAVE, clube: CLUBE, jovens, saidos },
  )
}

async function lerBase(page: Page): Promise<string[]> {
  return page.evaluate(chave => {
    const bruto = localStorage.getItem(chave)
    if (!bruto) return ["<SAVE AUSENTE>"]
    return (JSON.parse(bruto).youthPlayers ?? []).map((p: { id: string }) => p.id)
  }, CHAVE_SAVE)
}

/** Ids de quem esta com venda ACERTADA aguardando a janela abrir. */
async function lerPendentes(page: Page): Promise<string[]> {
  return page.evaluate(chave => {
    const bruto = localStorage.getItem(chave)
    if (!bruto) return ["<SAVE AUSENTE>"]
    return (JSON.parse(bruto).youthPlayers ?? [])
      .filter((p: { vendaPendente?: unknown }) => p.vendaPendente)
      .map((p: { id: string }) => p.id)
  }, CHAVE_SAVE)
}

/**
 * Navega como o jogo navega: dispara o mesmo evento que o `hardNavigate`, que o
 * provider entrega ao router do Next — SPA, com o cache do store quente. E nesse
 * caminho que o bug vivia; um `page.goto` recarrega, esfria o cache e o esconde.
 *
 * (O provider tem um plano B: se em 900 ms a URL nao mudou, ele recarrega de
 * verdade. No `next dev` a primeira visita a uma rota compila e estoura esse
 * prazo — por isso o teste AQUECE as rotas antes de medir.)
 */
async function navegarNoJogo(page: Page, destino: string) {
  await page.evaluate(href => {
    window.dispatchEvent(new CustomEvent("ultrafoot:navigate", { detail: { href } }))
  }, destino)
}

const TITULO_DA_BASE = { role: "heading" as const, nome: "CATEGORIA DE BASE" }

/**
 * Espera pela TELA, nao pela URL.
 *
 * O App Router do Next 16 troca a pagina sem mexer na barra de enderecos neste
 * app (e por isso que o provider tem um plano B por tempo). Esperar a URL
 * prendia o teste com a tela certa na frente.
 */
async function sairDaBase(page: Page) {
  await navegarNoJogo(page, "/elenco")
  await expect(page.getByRole("heading", { name: TITULO_DA_BASE.nome }))
    .toBeHidden({ timeout: 120_000 })
  // Esperar o titulo SUMIR nao basta: o router ainda esta assentando, e um push
  // disparado nessa janela e engolido (medido). Espera a tela de destino.
  await expect(page.getByRole("heading", { name: "Palmeiras", level: 1 }))
    .toBeVisible({ timeout: 120_000 })
}

async function voltarParaBase(page: Page) {
  await navegarNoJogo(page, "/base")
  await esperarATela(page)
}

/** Compila as rotas usadas, para que a navegacao medida seja SPA de verdade. */
async function aquecerRotas(page: Page) {
  await page.goto("/elenco")
  await page.goto("/base")
}

async function esperarATela(page: Page) {
  await expect(page.getByRole("heading", { name: "CATEGORIA DE BASE" })).toBeVisible({ timeout: 60_000 })
  // A hidratacao do save e assincrona; da um respiro para qualquer gravacao
  // indevida acontecer antes de conferirmos.
  await page.waitForTimeout(1500)
}

test.describe("categoria de base", () => {
  // `next dev` compila cada rota na primeira visita; o padrao de 30 s nao cobre.
  test.describe.configure({ timeout: 180_000 })

  test("abrir a tela nao devolve quem ja saiu nem injeta garoto de outro clube", async ({ page }) => {
    // Tecnico do Palmeiras que vendeu a base inteira: lista vazia, saidas registradas.
    const saidos = [0, 1, 2, 3, 4, 5].map(i => `youth_${CLUBE}_2026_${i}`)
    await prepararSave(page, [], saidos)

    await aquecerRotas(page)
    await esperarATela(page)

    expect(await lerBase(page)).toEqual([])

    // E tambem depois de sair e voltar pela navegacao do jogo (cache quente).
    await sairDaBase(page)
    await voltarParaBase(page)

    const ids = await lerBase(page)
    expect(ids.filter(id => id.startsWith("youth_BOT_"))).toEqual([])
    expect(ids).toEqual([])
  })

  test("dispensar e voltar a tela nao traz o garoto de volta", async ({ page }) => {
    const jovens = [0, 1, 2, 3, 4, 5].map(jovem)
    await prepararSave(page, jovens, [])

    await aquecerRotas(page)
    await esperarATela(page)
    // Por id, e nao por quantidade: seis garotos do clube ERRADO tambem dariam
    // seis, e era exatamente esse o bug.
    expect(await lerBase(page)).toEqual(jovens.map(j => j.id))

    // Dispensar e o caminho deterministico (vender sorteia interesse do mercado).
    await page.getByRole("button", { name: "Dispensar" }).first().click()
    await page.getByRole("button", { name: "Dispensar", exact: true }).last().click()
    await expect.poll(async () => (await lerBase(page)).length, { timeout: 15_000 }).toBe(5)
    const restantes = await lerBase(page)

    await sairDaBase(page)
    await voltarParaBase(page)

    // Nem o dispensado volta, nem aparece gente do clube fallback.
    expect(await lerBase(page)).toEqual(restantes)
  })

  test("venda acertada fora da janela sobrevive a troca de tela", async ({ page }) => {
    // Semana 20 = janela FECHADA (30 das 52 semanas sao assim). A venda fica
    // ACERTADA e o jovem so sai quando a janela abre — esse acerto era gravado
    // so pelo setState e se perdia ao trocar de tela: o garoto voltava inteiro,
    // sem venda e sem dinheiro.
    const jovens = [0, 1, 2, 3, 4, 5].map(jovem)
    await prepararSave(page, jovens, [])

    await aquecerRotas(page)
    await esperarATela(page)

    // Nem toda tentativa acha comprador (o interesse do mercado e sorteado, de
    // proposito). Tenta ate aparecer a proposta, dispensando o "sem interesse".
    //
    // NAO troque isto por um `Math.random` fixo via addInitScript: com ele o
    // clique em "Vender" nao abria dialogo NENHUM (nem a proposta, nem o "sem
    // interesse") e o teste morria no timeout sem sintoma. Repetir e mais feio
    // e funciona.
    const proposta = page.getByRole("button", { name: "Aceitar venda" })
    for (let tentativa = 0; tentativa < 15; tentativa++) {
      await page.getByRole("button", { name: "Vender" }).first().click()
      if (await proposta.isVisible().catch(() => false)) break
      const semInteresse = page.getByRole("button", { name: "Entendi" })
      if (await semInteresse.isVisible().catch(() => false)) await semInteresse.click()
      await page.waitForTimeout(250)
    }
    await expect(proposta).toBeVisible({ timeout: 15_000 })
    await proposta.click()
    await expect.poll(async () => await lerPendentes(page), { timeout: 15_000 }).toHaveLength(1)
    const pendentes = await lerPendentes(page)

    await sairDaBase(page)
    await voltarParaBase(page)

    expect(await lerPendentes(page)).toEqual(pendentes)
  })
})
