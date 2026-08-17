// O GATE DOS DESTINOS DO MENU ONLINE.
//
// ⚠️ POR QUE ELE EXISTE. O mesmo defeito apareceu TRÊS vezes em `MODOS_ONLINE`:
//   · amistoso (até a 1.0.336) — `href: "/multiplayer-local?online=1"`, uma rota
//     que só redireciona para o Draft: clicar num modo levava a outro;
//   · FC Hub (até a 1.0.336)   — `href: "/?hub=1"`, e nenhum arquivo do projeto
//     lê `hub` da query. O item se declarava "pronto" e caía na raiz;
//   · Draft (até a 1.0.336)    — `href: "/?draft=1"`, idem.
//
// O arquivo se abre dizendo "ESTA LISTA DIZ A VERDADE SOBRE O QUE EXISTE", e o
// campo `estado` sempre disse. Quem mentia era o `href` — e nada no caminho de
// publicação olhava para ele. Um estado honesto com link morto é PIOR que um
// modo marcado "planejado": o estado avisa, o link promete.
//
// O que este gate cobra, e só isso:
//   1. modo clicável (estado ≠ "planejado") tem de ter destino — rota ou ação;
//   2. `href` de rota tem de existir como página de verdade em app/;
//   3. parâmetro de query no `href` tem de ser LIDO por algum arquivo — foi
//      exatamente essa a falha do hub e do draft;
//   4. `acao` tem de ser tratada na tela do menu (app/online/page.tsx).
//
// Ele NÃO julga se o modo joga bem: "a rota existe" nunca foi o mesmo que "o
// modo funciona". Isso continua sendo trabalho de ler a tela.
//
// Uso: npx tsx scripts/test-destinos-online.ts

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { MODOS_ONLINE, temDestino } from "../lib/modos-online"

const RAIZ = path.resolve(__dirname, "..")
const PASTAS_DE_CODIGO = ["app", "components", "lib", "hooks"]

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

/** Todo arquivo de código do projeto, para procurar quem lê um parâmetro. */
function arquivosDeCodigo(): string[] {
  const achados: string[] = []
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const completo = path.join(dir, nome)
      if (statSync(completo).isDirectory()) { andar(completo); continue }
      if (/\.(ts|tsx)$/.test(nome)) achados.push(completo)
    }
  }
  for (const pasta of PASTAS_DE_CODIGO) {
    const completo = path.join(RAIZ, pasta)
    if (existsSync(completo)) andar(completo)
  }
  return achados
}

const CODIGO = arquivosDeCodigo().map(f => ({ f, texto: readFileSync(f, "utf8") }))

/** A rota "/x/y" existe se houver app/x/y/page.tsx (ou .jsx). */
function rotaExiste(rota: string): boolean {
  const limpa = rota.split("?")[0].replace(/^\/+|\/+$/g, "")
  const base = path.join(RAIZ, "app", limpa)
  return ["page.tsx", "page.jsx", "page.ts"].some(p => existsSync(path.join(base, p)))
}

/** Alguém lê `param` da query em algum lugar do código? */
function parametroEhLido(param: string, deOndeVem: string): boolean {
  const padroes = [
    `get("${param}")`, `get('${param}')`,
    `["${param}"]`, `['${param}']`,
    `.${param}`,
  ]
  return CODIGO.some(({ f, texto }) =>
    f !== deOndeVem && padroes.some(p => texto.includes(p)),
  )
}

const ARQUIVO_DA_LISTA = path.join(RAIZ, "lib", "modos-online.ts")
const TELA_DO_MENU = readFileSync(path.join(RAIZ, "app", "online", "page.tsx"), "utf8")

console.log(`conferindo ${MODOS_ONLINE.length} modos declarados em lib/modos-online.ts\n`)

for (const modo of MODOS_ONLINE) {
  const rotulo = `${modo.id} (${modo.estado})`

  // 1. Clicável precisa de destino; "planejado" precisa NÃO ter — um modo que
  //    ainda não existe mas já carrega href é um link à espera de mentir.
  if (modo.estado === "planejado") {
    if (temDestino(modo)) erro(`${rotulo} — está "planejado" mas já declara destino`)
    continue
  }
  if (!temDestino(modo)) {
    erro(`${rotulo} — clicável e sem destino: nem href nem acao`)
    continue
  }

  // 2 e 3. Rota de verdade, e query que alguém lê.
  if (modo.href) {
    if (!rotaExiste(modo.href)) {
      erro(`${rotulo} — href "${modo.href}" não corresponde a nenhuma página em app/`)
    }
    const query = modo.href.includes("?") ? modo.href.split("?")[1] : ""
    for (const par of query.split("&").filter(Boolean)) {
      const nome = par.split("=")[0]
      if (!parametroEhLido(nome, ARQUIVO_DA_LISTA)) {
        erro(`${rotulo} — href "${modo.href}" passa "${nome}", e NENHUM arquivo lê esse parâmetro`)
      }
    }
  }

  // 4. Ação tratada na tela do menu.
  if (modo.acao && !TELA_DO_MENU.includes(modo.acao)) {
    erro(`${rotulo} — acao "${modo.acao}" não é tratada em app/online/page.tsx`)
  }
}

console.log(falhas === 0
  ? "\nTODO MODO CLICÁVEL TEM DESTINO REAL — nenhum href promete o que não existe."
  : `\n${falhas} destino(s) mentindo. Esta árvore NÃO pode virar build.`)
process.exit(falhas === 0 ? 0 : 1)
