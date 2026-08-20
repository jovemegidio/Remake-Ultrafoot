import { test, expect } from "@playwright/test"

// QUANTA MEMÓRIA O JOGO SEGURA — a catraca do "roda liso em 4 GB".
//
// ⚠️ POR QUE ESTE GATE EXISTE. O `qa:low-spec` mede o MOTOR no Node (RSS e heap
// de simulação); ninguém media o que a INTERFACE segura no navegador, que é onde
// o jogo de verdade roda. Medido em 19/08/2026, no app compilado: a splash
// ocupa 57 MB de heap, o escritório 174 MB, o elenco 200 MB, o mercado 224 MB —
// e o calendário chega a 391 MB na primeira visita de uma carreira, porque é ali
// que o universo 286 é semeado (42 MB de JSON viram ~74 MB de objeto mais o
// texto).
//
// Numa máquina de 4 GB, com Windows e a WebView já ocupando o seu, esse pico é a
// diferença entre rodar liso e engasgar.
//
// ⚠️ O QUE ESTA MEDIÇÃO ACHOU (19/08/2026). O universo ficava na memória DUAS
// vezes: os ~42 MB de texto no cache do store e os ~74 MB do objeto depois do
// `JSON.parse` — e `lerUniverso` relia o texto a cada chamada só para comparar.
// Soltando o texto depois de interpretar (ver `esquecerDoCache`), o pior caso
// caiu de 380 MB para 183 MB, medido na mesma carreira e no mesmo passeio:
//
//     tela                     antes    depois
//     escritorio ............. 259 MB   183 MB
//     /elenco ................ 191 MB   130 MB
//     /calendario ............ 380 MB   154 MB
//     /mercado ............... 116 MB   116 MB
//
// O teto abaixo é uma CATRACA: ele só desce. Quem acrescentar tela nova mede
// antes; quem enxugar, baixa o número.
//
// Uso: npm run qa:memoria-telas   (precisa do jogo servido em :3000)

const TETO_MB = 300

test("nenhuma tela passa do teto de memoria", async ({ page }) => {
  test.setTimeout(600_000)
  await page.addInitScript(() => { sessionStorage.setItem("ultrafoot:session-active", "true") })
  await page.goto("/splash")
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.290") })
  await page.setViewportSize({ width: 1366, height: 768 })

  // A carreira nasce pela interface: um save montado à mão não tem universo
  // gravado e faria TODA tela semear de novo — o gate mediria um caso que só
  // existe no teste.
  await page.goto("/novo-jogo")
  await page.waitForLoadState("networkidle")
  const clicar = async (nome: RegExp) => {
    for (let i = 0; i < 15; i++) {
      await page.evaluate((t: string) => {
        const b = [...document.querySelectorAll("button")].find(x => new RegExp(t, "i").test(x.textContent ?? ""))
        b?.scrollIntoView({ block: "center" })
      }, nome.source).catch(() => undefined)
      try { await page.getByRole("button", { name: nome }).click({ timeout: 4_000 }); return } catch {
        // O clique pode ter funcionado e levado a tela embora: aí o botão some e
        // a tentativa seguinte "falha" numa ação que deu certo.
        if (!page.url().includes("/novo-jogo")) return
        await page.waitForTimeout(400)
      }
    }
    throw new Error("nao consegui clicar em " + nome)
  }
  // O painel de configurações iniciais só abre sozinho na porta do atleta; em
  // carreira de técnico ele pode nem estar na tela.
  if (await page.getByRole("button", { name: /Aplicar à carreira/i }).count()) {
    await clicar(/Aplicar à carreira/i)
  }
  await page.getByPlaceholder(/Nome do t.cnico/i).fill("Medidor")
  await clicar(/Iniciar carreira/i)
  await page.waitForTimeout(20_000)

  const cdp = await page.context().newCDPSession(page)
  const medir = async (rotulo: string) => {
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {})
    const m = await cdp.send("Runtime.getHeapUsage") as { usedSize: number }
    const mb = Math.round(m.usedSize / 1048576)
    console.log(rotulo.padEnd(30), mb, "MB")
    return mb
  }

  let pior = await medir("escritorio (apos criar)")
  let telaDoPior = "escritorio"
  // As telas online entram na conta porque carregam os mesmos dados pesados das
  // telas de carreira (clubes e, na Carreira Online, o elenco do clube) — e uma
  // tela nova é exatamente onde o teto costuma estourar sem ninguém ver.
  for (const rota of ["/elenco", "/calendario", "/mercado", "/elenco/gerenciamento",
    "/online", "/online/eventos", "/online/carreira", "/calendario"]) {
    await page.evaluate((r: string) => window.dispatchEvent(new CustomEvent("ultrafoot:navigate", { detail: { href: r } })), rota).catch(() => undefined)
    await page.waitForTimeout(6000)
    const mb = await medir(rota)
    if (mb > pior) { pior = mb; telaDoPior = rota }
  }

  console.log("PIOR CASO:", pior, "MB em", telaDoPior, "| teto", TETO_MB, "MB")
  expect(pior, `${telaDoPior} passou do teto: ${pior} MB > ${TETO_MB} MB`).toBeLessThanOrEqual(TETO_MB)
})
