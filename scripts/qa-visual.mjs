// PORTAO VISUAL — mede o que a revisao do sistema `uf-*` prometeu.
//
// Por que um harness e nao um print: "conferi e nao transborda" e opiniao, e
// nesta base ela ja errou. As tres coisas que este arquivo mede sao as tres que
// o pedido exige por escrito, e todas sao verificaveis:
//
//   1. ROLAGEM LATERAL a 1280x720 — a resolucao minima declarada. O corpo do
//      jogo nunca pode rolar na horizontal.
//   2. FOCO VISIVEL pelo teclado — depois de um Tab, o elemento focado tem de
//      ter contorno ou sombra propria. Interface que so responde ao ponteiro e
//      meia interface num jogo que se joga de controle.
//   3. A CAMADA DE FUNDO montada e COBRINDO a janela — e o ponto onde a
//      armadilha do `zoom: 0.8` apareceria: `inset: 0` num filho `fixed` mede a
//      janela inteira e depois encolhe 20%, deixando faixa sem fundo. Aqui isso
//      falha o portao em vez de virar relato de bug.
//
// ⚠️ Roda sobre `out/`, que so e reescrito com TAURI_BUILD=1. Sem a variavel o
// harness mede um export velho e MENTE — ja aconteceu. Por isso ele confere a
// idade da pasta antes de comecar.

import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { existsSync, readdirSync, readFileSync, mkdirSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")

// `--capturar <pasta>` grava um PNG de 1280x720 por tela.
//
// Nao roda por padrao: escrever 73 imagens a cada execucao tornaria o portao
// lento e o disco sujo. Serve para gerar a referencia visual de uma versao e
// comparar com a proxima — alinhamento, contraste, densidade, foco, overflow.
const indiceCaptura = process.argv.indexOf("--capturar")
const PASTA_DE_CAPTURA = indiceCaptura >= 0 ? process.argv[indiceCaptura + 1] : null

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".mp3", "audio/mpeg"],
  [".webm", "audio/webm"],
])

// TODAS as rotas exportadas, descobertas no proprio `out/`.
//
// A primeira versao trazia dez telas escolhidas a mao, e a lista envelheceria
// sozinha: tela nova nasce fora do portao e ninguem percebe. Pior — o defeito
// que motivou o teste de oclusao aparecia justamente nas telas que a lista NAO
// citava. Enumerar o build e o unico jeito de a cobertura acompanhar o jogo.
//
// Rotas fora: as que so existem dentro de um fluxo (a splash roda uma vez e
// navega sozinha; o 404 nao e tela de jogo).
const FORA_DO_PORTAO = new Set(["/splash", "/404", "/_not-found"])

// As janelas em que o jogo tem de caber. 1280x720 e a referencia e onde todas
// as medidas sao feitas; nas outras cobramos so o que quebra de verdade quando
// a janela muda — rolagem lateral e o fundo deixar de cobrir a tela.
//
// A medicao acontece por REDIMENSIONAMENTO da mesma pagina, sem recarregar.
// Recarregar 73 rotas cinco vezes levaria mais de vinte minutos e o portao
// deixaria de ser rodado; redimensionar custa um reflow e pega o mesmo defeito.
const JANELAS = [
  { largura: 1024, altura: 640 },
  { largura: 1280, altura: 720 },
  { largura: 1366, altura: 768 },
  { largura: 1440, altura: 900 },
  { largura: 1920, altura: 1080 },
]

function descobrirRotas(base = outDir, prefixo = "") {
  const achadas = []
  for (const entrada of readdirSync(base, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue
    if (entrada.name.startsWith("_") || entrada.name === "images") continue
    const caminho = path.join(base, entrada.name)
    const rota = `${prefixo}/${entrada.name}`
    const indice = path.join(caminho, "index.html")
    // ⚠️ NEM TODO index.html em `out/` e tela do jogo.
    //
    // `public/` inteiro e copiado para o build, e ha pagina estatica escrita a
    // mao la dentro — `/recibo` e um recibo de compra feito para o comprador
    // abrir e salvar em PDF, sem shell, sem React, sem tema. O portao cobrava
    // dela a camada de fundo do jogo e reprovava com razao aparente e conclusao
    // errada.
    //
    // O que separa as duas e a presenca do runtime do Next: pagina de verdade
    // do App Router sempre referencia `/_next/`. A regra se mantem sozinha —
    // pagina estatica nova entra em `public/` e fica de fora sem ninguem editar
    // uma lista.
    if (existsSync(indice) && readFileSync(indice, "utf-8").includes("/_next/")) {
      achadas.push(rota)
    }
    achadas.push(...descobrirRotas(caminho, rota))
  }
  return achadas
}

const ROTAS = ["/", ...descobrirRotas()]
  .filter(r => !FORA_DO_PORTAO.has(r))
  .sort()

function resolveRequest(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0])
  const limpo = decoded === "/" ? "/index.html" : decoded
  const alvo = path.join(outDir, limpo)
  if (existsSync(alvo)) return alvo
  if (!path.extname(limpo)) {
    const indice = path.join(outDir, limpo, "index.html")
    if (existsSync(indice)) return indice
  }
  return alvo
}

function criarServidor() {
  return createServer(async (req, res) => {
    try {
      const alvo = path.resolve(resolveRequest(req.url ?? "/"))
      const raiz = outDir.endsWith(path.sep) ? outDir : outDir + path.sep
      if (alvo !== outDir && !alvo.startsWith(raiz)) {
        res.writeHead(403)
        res.end("Forbidden")
        return
      }
      const info = await stat(alvo)
      const arquivo = info.isDirectory() ? path.join(alvo, "index.html") : alvo
      const corpo = await readFile(arquivo)
      res.writeHead(200, {
        "content-type": mimeTypes.get(path.extname(arquivo).toLowerCase()) ?? "application/octet-stream",
        "cache-control": "no-store",
      })
      res.end(corpo)
    } catch {
      res.writeHead(404)
      res.end("Not found")
    }
  })
}

function saveDeTeste() {
  const agora = Date.now()
  return {
    version: 2,
    selectedTeamShort: "BGT",
    managerName: "QA Visual",
    season: 2026,
    week: 0,
    language: "pt-BR",
    selectedUniform: "home",
    createdAt: agora,
    updatedAt: agora,
    multiplayerEnabled: false,
    managers: [],
    activeManagerId: null,
    controllerType: "playstation",
    controllerBindings: {},
  }
}

// ── FIXTURES DE SAVE ────────────────────────────────────────────────────────
//
// Uma reforma visual nao mexe em schema — e este portao PROVA que ela nao
// quebrou quem ja jogava. O risco especifico da camada de apresentacao nao e
// perder dado: e a tela ler um campo que o save antigo nao tem e derrubar a
// rota inteira (ja aconteceu nesta base, com o nome do atleta no meio do erro).
//
// Tres perfis, escolhidos pelo que cada um pode quebrar:
const FIXTURES = [
  {
    nome: "instalacao nova",
    // O save que o jogo cria hoje. E a linha de base.
    save: () => saveDeTeste(),
  },
  {
    nome: "save antigo (campos opcionais ausentes)",
    // ⚠️ CAMPOS DE PROPOSITO AUSENTES, nao vazios. `version: 1`, sem
    // `controllerBindings`, sem `managers`, sem `selectedUniform`. O `migrate`
    // preenche o que sabe; o que ele nao alcanca chega `undefined` na tela, e e
    // exatamente ai que um `.length` ou um `.map` derruba a rota.
    save: () => ({
      version: 1,
      selectedTeamShort: "BGT",
      managerName: "Tecnico Antigo",
      season: 2026,
      week: 12,
      language: "pt-BR",
    }),
  },
  {
    nome: "acentos e nomes longos",
    // Layout quebra por texto, nao por dado. Um nome que nao cabe empurra a
    // linha e cria rolagem lateral — o defeito que a coluna `rolagem` pega.
    save: () => ({
      ...saveDeTeste(),
      managerName: "Joao Guimaraes de Assuncao Villalobos-Netto da Conceicao",
    }),
  },
]

async function main() {
  if (!existsSync(outDir)) {
    console.error("out/ nao existe. Rode: cross-env TAURI_BUILD=1 npm run build")
    process.exit(1)
  }

  const servidor = criarServidor()
  await new Promise(r => servidor.listen(0, "127.0.0.1", r))
  const base = `http://127.0.0.1:${servidor.address().port}`

  if (PASTA_DE_CAPTURA) mkdirSync(PASTA_DE_CAPTURA, { recursive: true })
  const navegador = await chromium.launch()
  const contexto = await navegador.newContext({
    // A resolucao MINIMA declarada. Se passa aqui, passa em tudo acima.
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  await contexto.addInitScript(estado => {
    window.localStorage.setItem("ultrafoot:save", JSON.stringify(estado))
    window.localStorage.setItem("ultrafoot:onboarding-seen", "1")
    // ⚠️ TEM DE SER O VALOR EXATO de WHATS_NEW_VERSION (components/native-app-
    // provider.tsx), nao um numero "maior": o codigo compara por IGUALDADE.
    // Com um valor qualquer o modal de novidades abre, cobre a tela inteira com
    // um `fixed inset-0 z-[9998]` — e o teste de oclusao reprova as 10 telas
    // acusando a propria fixture. Aconteceu.
    window.localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.290")
    window.sessionStorage.setItem("ultrafoot:session-active", "true")
  }, saveDeTeste())

  const falhas = []
  // Telas em que o Tab nao anda pelo foco porque o jogo o usa como botao.
  const tabsCapturados = []
  // Telas que abrem um overlay proprio de tela cheia. Nao e defeito — e nota.
  const sobrepostas = []
  // Telas que nao deu para medir (navegaram sozinhas durante a medicao).
  const naoMedidas = []
  const pagina = await contexto.newPage()

  // ERROS DE CONSOLE, por rota.
  //
  // Sao coletados aqui e nao dentro do laco porque o ouvinte tem de existir
  // ANTES do `goto`: erro de hidratacao acontece nos primeiros milissegundos e
  // um ouvinte registrado depois nunca o veria.
  //
  // ⚠️ O filtro nao e preguica. Estas familias aparecem em qualquer build
  // estatico servido por um servidor de arquivos e nao dizem nada sobre a
  // interface: recurso opcional ausente e o aviso de preload do Next.
  const errosDeConsole = new Map()
  let rotaAtual = "/"
  const IGNORAR = [/favicon/i, /Failed to load resource/i, /was preloaded using link preload/i]
  const anotarErro = texto => {
    // ⚠️ `rotaAtual === null` = estamos na aba em branco entre duas rotas.
    // O `about:blank` que limpa a navegacao pendente tambem roda o initScript,
    // e la o `localStorage` e negado — 73 erros de "Access is denied" que sao
    // do PORTAO, nao do jogo. Atribui-los a ultima rota visitada seria acusar
    // uma tela por um defeito do instrumento.
    if (rotaAtual === null) return
    if (IGNORAR.some(r => r.test(texto))) return
    const lista = errosDeConsole.get(rotaAtual) ?? []
    if (lista.length < 3) lista.push(texto.slice(0, 120).replace(/\s+/g, " "))
    errosDeConsole.set(rotaAtual, lista)
  }
  pagina.on("console", m => { if (m.type() === "error") anotarErro(m.text()) })
  pagina.on("pageerror", e => anotarErro(String(e.message ?? e)))

  for (const rota of ROTAS) {
    // ⚠️ Uma rota so nao pode derrubar a corrida.
    //
    // Algumas telas NAVEGAM sozinhas (a partida ao vivo manda para o resumo, o
    // /campeao encerra a cerimonia e volta). Quando isso acontece no meio de um
    // `page.evaluate`, o Playwright estoura "Execution context was destroyed" e
    // o processo morria ali — as rotas seguintes nem eram medidas, e o portao
    // reportava menos telas do que existe sem dizer que parou no meio.
    rotaAtual = rota
    try {
    await pagina.goto(`${base}${rota}`, { waitUntil: "load" })
    // ⚠️ ESPERAR O DOM PARAR, e nao um numero fixo de milissegundos.
    //
    // Um `waitForTimeout(1400)` fixo tornava este portao INSTAVEL: as telas de
    // lista pesada (/elenco, /mercado, /estatisticas) desenham um estado de
    // carregamento, o motor termina de hidratar o elenco e a subarvore inteira
    // e SUBSTITUIDA. Cair no meio dessa troca faz o elemento recem-focado
    // sumir e o foco voltar para o <body> — e o resultado passava a depender
    // de qual maquina rodou o teste. Um portao que oscila e pior que portao
    // nenhum: ensina a ignorar o vermelho.
    //
    // Aqui esperamos silencio de verdade: 600ms sem nenhuma mutacao no DOM.
    // E o momento em que o jogador de fato interage com a tela.
    await pagina.evaluate(
      () =>
        new Promise(resolve => {
          const LIMITE = 8000
          const SILENCIO = 600
          let relogio = setTimeout(pronto, SILENCIO)
          const desistir = setTimeout(pronto, LIMITE)
          const observador = new MutationObserver(() => {
            clearTimeout(relogio)
            relogio = setTimeout(pronto, SILENCIO)
          })
          observador.observe(document.body, { childList: true, subtree: true, attributes: true })
          function pronto() {
            clearTimeout(relogio)
            clearTimeout(desistir)
            observador.disconnect()
            resolve()
          }
        }),
    )

    const medida = await pagina.evaluate(() => {
      const de = document.documentElement
      const atmos = document.querySelector(".uf-atmos")
      const caixa = atmos ? atmos.getBoundingClientRect() : null
      return {
        rolagemLateral: de.scrollWidth - de.clientWidth,
        larguraJanela: window.innerWidth,
        alturaJanela: window.innerHeight,
        fundoMontado: Boolean(atmos),
        fundoLargura: caixa ? Math.round(caixa.width) : 0,
        fundoAltura: caixa ? Math.round(caixa.height) : 0,
        // A cor efetiva do corpo — se algum passo tivesse deixado a raiz
        // transparente SEM o fundo montado, o jogo ficaria branco.
        fundoDoCorpo: getComputedStyle(document.body).backgroundColor,
      }
    })

    // 1. Rolagem lateral. Uma folga de 1px absorve arredondamento do zoom 0,8.
    if (medida.rolagemLateral > 1) {
      falhas.push(`${rota}: rola ${medida.rolagemLateral}px na horizontal a 1280x720`)
    }

    // 2. A camada de fundo cobre a janela inteira?
    if (!medida.fundoMontado) {
      falhas.push(`${rota}: a camada .uf-atmos nao montou`)
    } else if (
      medida.fundoLargura < medida.larguraJanela - 1 ||
      medida.fundoAltura < medida.alturaJanela - 1
    ) {
      // Este e exatamente o sintoma do `inset: 0` sob `zoom: 0.8`.
      falhas.push(
        `${rota}: o fundo cobre ${medida.fundoLargura}x${medida.fundoAltura} numa janela de ` +
          `${medida.larguraJanela}x${medida.alturaJanela} — sobra faixa sem fundo`,
      )
    }

    // 2b. O CONTEUDO ESTA REALMENTE VISIVEL, ou so presente no DOM?
    //
    // ⚠️ ESTE TESTE NASCEU DE UM DEFEITO QUE PASSOU POR TODOS OS OUTROS.
    //
    // Ao montar o fundo atmosferico com `z-index: 0`, telas inteiras ficaram
    // escondidas atras dele — um elemento posicionado com z-index 0 pinta
    // depois do conteudo de bloco comum. E o pior tipo de defeito: o texto
    // estava no DOM, com `visibility: visible`, `opacity: 1` e cor branca; o
    // `innerText` respondia certo; nenhuma medicao de ESTILO acusava nada. So
    // a captura de tela mostrava a pagina vazia.
    //
    // `elementFromPoint` e o unico que enxerga isso: ele responde quem esta na
    // FRENTE naquele pixel. Se quem responde nao e o proprio texto nem parente
    // dele, tem alguma coisa por cima.
    const oclusao = await pagina.evaluate(() => {
      const alvos = [...document.querySelectorAll("h1, h2, h3, p, span, td, li")]
        .filter(el => {
          if (el.children.length > 0 || !el.textContent.trim()) return false
          const r = el.getBoundingClientRect()
          return r.width > 8 && r.height > 6 && r.top >= 0 && r.bottom <= window.innerHeight
        })
        .slice(0, 14)
      if (alvos.length === 0) return { ok: true, motivo: "" }
      const tapados = alvos.filter(el => {
        const r = el.getBoundingClientRect()
        const naFrente = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return !naFrente || !(naFrente === el || el.contains(naFrente) || naFrente.contains(el))
      })
      if (tapados.length === 0) return { ok: true, culpaDoFundo: false, motivo: "" }
      const exemplo = tapados[0]
      const r = exemplo.getBoundingClientRect()
      const porQuem = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      // ⚠️ QUEM TAPA MUDA O VEREDICTO, e por isso o oclusor e identificado.
      //
      // Tapado pela camada `.uf-atmos` = o defeito que este teste existe para
      // pegar, e reprova. Tapado por um overlay do proprio jogo (a cerimonia de
      // /campeao, o assistente de /novo-jogo, a partida ao vivo) e o jogo
      // fazendo o que deve — abrir uma tela cheia por cima. Reprovar ali
      // ensinaria a ignorar o vermelho, que e como um portao morre.
      const culpaDoFundo = Boolean(porQuem && porQuem.closest(".uf-atmos"))
      return {
        ok: false,
        culpaDoFundo,
        motivo:
          `${tapados.length}/${alvos.length} textos tapados — ex.: ` +
          `"${exemplo.textContent.trim().slice(0, 24)}" coberto por ` +
          `<${porQuem ? porQuem.tagName.toLowerCase() : "?"} class="${porQuem ? String(porQuem.className).slice(0, 46) : ""}">`,
      }
    })
    if (!oclusao.ok) {
      if (oclusao.culpaDoFundo) falhas.push(`${rota}: O FUNDO TAPA O CONTEUDO — ${oclusao.motivo}`)
      else sobrepostas.push(`${rota}: ${oclusao.motivo}`)
    }

    // 3. ANEL DE FOCO VISIVEL.
    //
    // ⚠️ NAO MEDIMOS COM `Tab`, E HA UM MOTIVO — nao e conveniencia de teste.
    //
    // Neste jogo o Tab NAO e a tecla de navegacao do navegador: e um botao de
    // jogo. `components/fc-hub.tsx` escuta `keydown` em fase de CAPTURA e da
    // `preventDefault()` em todo Tab solto para abrir o FC Hub, e a ajuda das
    // Configuracoes o documenta como "Proxima aba (= RB / R1)". E a escolha
    // console-first do produto, tomada de proposito.
    //
    // Medir com Tab, portanto, mediria aquela decisao — e nao o anel de foco.
    // Pior: media de forma INSTAVEL, porque o Hub e carregado sob demanda e
    // antes de ele montar o Tab ainda andava. Foi exatamente o que aconteceu:
    // a mesma tela passava e falhava conforme o cronometro.
    //
    // O que interessa aqui e se um elemento QUE RECEBE FOCO mostra o anel —
    // e e assim que ele chega na pratica: pelas setas do gerente de foco, pelo
    // controle, ou por tecnologia assistiva. `focus-visible` acende para foco
    // programatico, entao a medicao e fiel.
    //
    // A trava do Tab continua sendo RELATADA a cada execucao, logo abaixo.
    const foco = await pagina.evaluate(() => {
      const seletor =
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      const alvo = [...document.querySelectorAll(seletor)].find(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      if (!alvo) return { ok: false, motivo: "a tela nao tem nenhum elemento interativo visivel" }
      alvo.focus()
      const s = getComputedStyle(alvo)
      const temContorno = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0
      const temSombra = s.boxShadow !== "none"
      return {
        ok: temContorno || temSombra,
        motivo: `<${alvo.tagName.toLowerCase()}> recebe foco SEM anel visivel`,
      }
    })
    if (!foco.ok) falhas.push(`${rota}: ${foco.motivo}`)

    if (PASTA_DE_CAPTURA) {
      const arquivo = path.join(
        PASTA_DE_CAPTURA,
        `${rota === "/" ? "hub" : rota.slice(1).replace(/\//g, "-")}.png`,
      )
      await pagina.screenshot({ path: arquivo })
    }

    // 3b. A MESMA TELA NAS OUTRAS JANELAS.
    //
    // So rolagem lateral e cobertura do fundo: sao os dois defeitos que mudam
    // com o tamanho da janela. Hierarquia e foco nao mudam ao redimensionar, e
    // remedi-los aqui so somaria ruido.
    for (const janela of JANELAS) {
      if (janela.largura === 1280 && janela.altura === 720) continue
      await pagina.setViewportSize({ width: janela.largura, height: janela.altura })
      await pagina.waitForTimeout(180)
      const m = await pagina.evaluate(() => {
        const de = document.documentElement
        const atmos = document.querySelector(".uf-atmos")
        const caixa = atmos ? atmos.getBoundingClientRect() : null
        return {
          rolagem: de.scrollWidth - de.clientWidth,
          larguraJanela: window.innerWidth,
          alturaJanela: window.innerHeight,
          fundoL: caixa ? Math.round(caixa.width) : 0,
          fundoA: caixa ? Math.round(caixa.height) : 0,
        }
      })
      const nome = `${janela.largura}x${janela.altura}`
      if (m.rolagem > 1) falhas.push(`${rota} @${nome}: rola ${m.rolagem}px na horizontal`)
      if (m.fundoL < m.larguraJanela - 1 || m.fundoA < m.alturaJanela - 1) {
        falhas.push(`${rota} @${nome}: o fundo cobre so ${m.fundoL}x${m.fundoA} de ${m.larguraJanela}x${m.alturaJanela}`)
      }
    }
    // Volta para a referencia antes da proxima rota.
    await pagina.setViewportSize({ width: 1280, height: 720 })

    // O Tab esta capturado nesta tela? Nao reprova — informa. Quem ler a saida
    // do portao ve o custo da escolha console-first sem precisar descobri-lo.
    //
    // A sonda escuta na FASE DE BOLHA, depois de todos os ouvintes do jogo:
    // se algum deles chamou `preventDefault()`, `defaultPrevented` ja chegou
    // aqui como verdadeiro. Olhar o `document.activeElement` em vez disso nao
    // serviria — o elemento que acabamos de focar acima faria a leitura mentir.
    await pagina.evaluate(() => {
      window.__ufTabBarrado = false
      window.__ufEspiaoTab = e => {
        if (e.key === "Tab" && e.defaultPrevented) window.__ufTabBarrado = true
      }
      window.addEventListener("keydown", window.__ufEspiaoTab)
    })
    await pagina.keyboard.press("Tab")
    const tabCapturado = await pagina.evaluate(() => {
      window.removeEventListener("keydown", window.__ufEspiaoTab)
      return window.__ufTabBarrado === true
    })
    if (tabCapturado) tabsCapturados.push(rota)

    const marca = medida.rolagemLateral > 1 || !foco.ok || oclusao.culpaDoFundo ? "FALHOU" : "ok"
    console.log(
      `${marca.padEnd(7)} ${rota.padEnd(16)} rolagem=${medida.rolagemLateral}px ` +
        `fundo=${medida.fundoLargura}x${medida.fundoAltura} foco=${foco.ok ? "visivel" : "INVISIVEL"} ` +
        `texto=${oclusao.ok ? "a vista" : oclusao.culpaDoFundo ? "TAPADO PELO FUNDO" : "sob overlay"}`,
    )
    } catch (erro) {
      // Nao e aprovacao: fica registrado como tela NAO MEDIDA, para ninguem
      // confundir "o portao passou" com "o portao nem olhou".
      naoMedidas.push(`${rota}: ${String(erro.message ?? erro).slice(0, 90).replace(/\s+/g, " ")}`)
      console.log(`${"?".padEnd(7)} ${rota.padEnd(22)} nao medida (a tela navegou sozinha)`)
    }
    // ⚠️ LIMPAR A ABA ENTRE ROTAS, e nao so no erro.
    //
    // Uma tela que redireciona (/sem-clube manda para o escritorio quando ha
    // clube; /dashboard e so um redirect) deixa uma navegacao PENDENTE. Ela
    // chegava durante o `goto` da rota seguinte e o Playwright abortava com
    // "interrupted by another navigation" — em cascata: uma tela que redireciona
    // levava junto as seis seguintes da lista. O portao dizia "11 nao medidas"
    // quando o jogo tinha problema em zero.
    //
    // `about:blank` encerra qualquer navegacao pendente e a proxima rota comeca
    // do zero. Custa poucos milissegundos.
    rotaAtual = null
    await pagina.goto("about:blank").catch(() => {})
  }

  // ── SEGUNDA PASSADA: OS SAVES QUE JA EXISTEM ─────────────────────────────
  //
  // As mesmas telas, abertas com um save da versao anterior e com um save de
  // nomes hostis. O que se cobra aqui e mais duro e mais simples: a tela nao
  // pode CAIR na rede de erro, e nao pode passar a rolar na horizontal.
  //
  // Um subconjunto, e nao as 73: e a segunda vez que o mesmo codigo de tela
  // roda, e o que muda entre as fixtures e o DADO. Estas dez cobrem os leitores
  // de save mais expostos (elenco, calendario, financas, contratos, taticas).
  const ROTAS_COM_SAVE_ANTIGO = [
    "/", "/elenco", "/calendario", "/mercado", "/financas",
    "/competicoes", "/estatisticas", "/contratos", "/central", "/configuracoes",
  ].filter(r => ROTAS.includes(r))

  for (const fixture of FIXTURES.slice(1)) {
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    await ctx.addInitScript(estado => {
      window.localStorage.setItem("ultrafoot:save", JSON.stringify(estado))
      window.localStorage.setItem("ultrafoot:onboarding-seen", "1")
      window.localStorage.setItem("ultrafoot:last-seen-whats-new", "1.0.290")
      window.sessionStorage.setItem("ultrafoot:session-active", "true")
    }, fixture.save())
    const pg = await ctx.newPage()
    let quebradas = 0

    for (const rota of ROTAS_COM_SAVE_ANTIGO) {
      try {
        await pg.goto(`${base}${rota}`, { waitUntil: "load" })
        await pg.waitForTimeout(1800)
        const r = await pg.evaluate(() => {
          const rede = [...document.querySelectorAll('[role="alert"]')]
            .some(el => /Esta tela travou/i.test(el.textContent ?? ""))
          const de = document.documentElement
          return { rede, rolagem: de.scrollWidth - de.clientWidth }
        })
        if (r.rede) {
          falhas.push(`[${fixture.nome}] ${rota}: a tela CAIU na rede de erro`)
          quebradas++
        }
        if (r.rolagem > 1) {
          falhas.push(`[${fixture.nome}] ${rota}: rola ${r.rolagem}px na horizontal`)
          quebradas++
        }
      } catch {
        // Redirecionou. Nao e defeito desta medicao.
      }
      await pg.goto("about:blank").catch(() => {})
    }
    await ctx.close()
    console.log(
      `${(quebradas === 0 ? "ok" : "FALHOU").padEnd(7)} ${ROTAS_COM_SAVE_ANTIGO.length} telas com fixture "${fixture.nome}"`,
    )
  }

  await navegador.close()
  await new Promise(r => servidor.close(r))

  console.log("")
  if (errosDeConsole.size > 0) {
    console.log(`NOTA — ${errosDeConsole.size} tela(s) escreveram erro no console:`)
    for (const [r, lista] of errosDeConsole) {
      for (const e of lista) console.log(`        • ${r}: ${e}`)
    }
    console.log("")
  }
  if (sobrepostas.length > 0) {
    console.log(`NOTA — ${sobrepostas.length} tela(s) abrem um overlay proprio de tela cheia por cima do conteudo.`)
    console.log("       E o jogo fazendo o que deve (cerimonia, assistente, partida ao vivo), nao o fundo:")
    for (const s of sobrepostas) console.log("        •", s)
    console.log("")
  }
  if (naoMedidas.length > 0) {
    console.log(`NOTA — ${naoMedidas.length} tela(s) NAO foram medidas porque navegam sozinhas:`)
    for (const s of naoMedidas) console.log("        •", s)
    console.log("")
  }
  if (tabsCapturados.length > 0) {
    console.log(
      `NOTA — o Tab e um botao do jogo (FC Hub / proxima aba, = RB/R1) e nao anda pelo foco em ` +
        `${tabsCapturados.length}/${ROTAS.length} telas. E uma escolha console-first documentada nas ` +
        `Configuracoes, nao um defeito deste sistema visual. O anel de foco medido acima acende ` +
        `pelas setas, pelo controle e por tecnologia assistiva. Se um dia o Tab tiver de andar ` +
        `pelo foco, o ponto unico e o keydown de captura em components/fc-hub.tsx.`,
    )
    console.log("")
  }
  if (falhas.length > 0) {
    console.error(`REPROVADO — ${falhas.length} problema(s):`)
    for (const f of falhas) console.error("  •", f)
    process.exit(1)
  }
  console.log(`APROVADO — ${ROTAS.length - naoMedidas.length}/${ROTAS.length} telas medidas em ${JANELAS.length} janelas (1024x640 a 1920x1080): sem rolagem lateral, com fundo inteiro, conteudo a vista e foco visivel.`)
}

main().catch(erro => {
  console.error(erro)
  process.exit(1)
})
