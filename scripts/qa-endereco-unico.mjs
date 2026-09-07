// O ENDERECO DO SERVIDOR MORA EM UM LUGAR SO.
//
//   node scripts/qa-endereco-unico.mjs
//
// ⚠️ POR QUE ELE EXISTE. Em 31/08/2026 o endereco da VPS estava copiado em 27
// pontos do repositorio — seis bibliotecas do jogo, o launcher, testes e
// scripts. Trocar o servidor significava cacar as copias, e **esquecer uma nao
// quebra a compilacao**: quebra uma funcao, em producao, na maquina do jogador.
// Save na nuvem funcionando e login falhando, por exemplo.
//
// ⚠️ E O `sslip.io` TORNA A TROCA INEVITAVEL UM DIA: ele codifica o IP no nome
// (`ultrafoot.179-198-103-30.sslip.io`), entao IP novo = dominio morto. Nao ha
// DNS para reapontar.
//
// A regra: no codigo do JOGO (`lib/`, `app/`, `components/`), o endereco so
// pode aparecer em `lib/servidor-ultrafoot.ts`. Fora dali, importe de la.
//
// O que fica de fora da regra, e por que:
//   · `Launcher/` — projeto separado, com o proprio ponteiro (`endpoints.json`)
//     que o Rust dele le a cada abertura;
//   · `scripts/`, `services/`, `e2e/` — ferramentas e testes que rodam fora do
//     jogo e nao viajam para o jogador;
//   · `public/endpoints.json` — e justamente o ponteiro, o lugar certo.

import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

/** A fonte unica. Aqui o endereco PODE aparecer. */
const FONTE = path.normalize("lib/servidor-ultrafoot.ts")

/**
 * Padrao do endereco proprio.
 *
 * ⚠️ COBRE OS DOIS DOMINIOS, e isso importa mais do que parece. O padrao antigo
 * era so `ultrafoot.<ip>.sslip.io`; quando o servidor mudou para
 * `ultrafoot.zyntraerp.com.br` (05/09/2026) esta regex deixaria de casar com
 * qualquer coisa e o portao passaria a aprovar TUDO — a protecao sumiria em
 * silencio exatamente na versao em que o endereco mudou, que e quando ela mais
 * vale. O sslip.io continua na lista para pegar copia velha esquecida.
 */
const ENDERECO = /ultrafoot\.(?:[\d-]+\.sslip\.io|zyntraerp\.com\.br)/

function arquivos(dir, achados = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) arquivos(p, achados)
    else if (/\.(ts|tsx)$/.test(e)) achados.push(p)
  }
  return achados
}

const alvos = []
for (const d of ["lib", "app", "components"]) {
  try { arquivos(d, alvos) } catch { /* pasta ausente */ }
}

const copias = []
for (const p of alvos) {
  if (path.normalize(p) === FONTE) continue
  const src = readFileSync(p, "utf8")
  src.split(/\r?\n/).forEach((linha, i) => {
    if (!ENDERECO.test(linha)) return
    // Comentario explicando nao e copia: o que quebra e URL montada no codigo.
    const limpa = linha.trim()
    if (limpa.startsWith("//") || limpa.startsWith("*")) return
    copias.push({ arquivo: p, linha: i + 1, texto: limpa.slice(0, 90) })
  })
}

console.log(`\n  arquivos varridos: ${alvos.length}`)
console.log(`  fonte unica ......: ${FONTE}`)
console.log(`  copias fora dela .: ${copias.length}\n`)

for (const c of copias) {
  console.log(`  ${c.arquivo}:${c.linha}`)
  console.log(`    ${c.texto}`)
}

if (copias.length > 0) {
  console.log(`\n${copias.length} copia(s) do endereco fora de \`${FONTE}\`.`)
  console.log("Importe de la: SERVIDOR_ULTRAFOOT, SERVIDOR_AUTH, SERVIDOR_RELAY,")
  console.log("SERVIDOR_DOWNLOADS ou SERVIDOR_ATUALIZACOES.")
  console.log("Endereco copiado nao quebra a compilacao — quebra uma funcao na maquina do jogador.\n")
  process.exit(1)
}

console.log("ENDERECO UNICO OK — trocar o servidor e mexer em um arquivo so.\n")

// ── SEGUNDA REGRA: nenhum endereco MORTO em lugar nenhum ─────────────────────
//
// ⚠️ ESTA REGRA NASCEU DE UMA PANE REAL (07/09/2026).
//
// A regra de cima cobre so `lib/`, `app/` e `components/` — o codigo do jogo.
// Foi uma decisao correta e uma fresta grande: quando a VPS mudou em 05/09, o
// endereco velho continuou em ONZE lugares fora desse escopo e este portao ficou
// verde o tempo todo. Entre eles:
//
//   · a CSP do launcher (`Launcher/src-tauri/tauri.conf.json`), que liberava
//     `connect-src` SO para o servidor morto. O `fetch` do launcher e o da
//     webview, entao o pedido morria dentro do proprio launcher, antes de sair —
//     e o login com Google parou com o codigo inteiro CORRETO. Foi o defeito
//     mais caro de achar justamente por isso;
//   · a LOJA do launcher e a pagina de recibo, apontando para maquina fora do ar;
//   · o proprio `deploy-tudo.mjs` — o publicador teria falhado no meio.
//
// Entao esta segunda passada nao pergunta "o endereco esta duplicado?", e sim
// "alguem ainda fala com uma maquina que nao existe?". Varre o repositorio TODO,
// inclusive JSON, shell, Rust e YAML, e nao aceita nem em comentario: comentario
// que ensina a apontar para servidor morto tambem ja custou uma tarde.
//
// QUANDO O SERVIDOR MUDAR DE NOVO: mova o endereco recem-aposentado para MORTOS
// e o portao passa a cacar as sobras dele sozinho.

/** Enderecos que ja foram nossos e hoje nao respondem. */
const MORTOS = [
  // Saiu do ar em 05/09/2026, na migracao para ultrafoot.zyntraerp.com.br.
  // O sslip.io codifica o IP no nome, entao IP novo = dominio morto, e nao ha
  // DNS para reapontar.
  {
    padrao: /ultrafoot\.179-198-103-30\.sslip\.io|179\.198\.103\.30/,
    nome: "179.198.103.30 (VPS antiga)",
  },
]

/**
 * Onde a mencao ao endereco morto e REGISTRO, e nao uso.
 *
 * Lista nominal e curta de proposito: liberar uma pasta inteira aqui traria de
 * volta exatamente o ponto cego que esta regra existe para fechar.
 */
const HISTORICO = new Set([
  path.normalize("lib/servidor-ultrafoot.ts"),      // conta a troca, dentro da fonte unica
  path.normalize("scripts/qa-endereco-unico.mjs"),  // este arquivo: o padrao mora aqui
  path.normalize("scripts/auditar-divisoes.mjs"),   // exemplo de uso, num comentario
])

const IGNORAR_PASTA = new Set([
  "node_modules", ".git", ".next", "out", "target", "dist-loja", "dist-patch",
  "public", "data", "test-results", "playwright-report", "coverage",
])

const EXTENSOES = /\.(ts|tsx|js|mjs|cjs|rs|json|sh|py|toml|yml|yaml)$/

function todosOsArquivos(dir, achados = []) {
  let entradas
  try { entradas = readdirSync(dir) } catch { return achados }
  for (const e of entradas) {
    if (IGNORAR_PASTA.has(e)) continue
    const p = path.join(dir, e)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) todosOsArquivos(p, achados)
    else if (EXTENSOES.test(e)) achados.push(p)
  }
  return achados
}

const varridos = todosOsArquivos(".")
const restos = []
for (const p of varridos) {
  if (HISTORICO.has(path.normalize(p))) continue
  let src
  try { src = readFileSync(p, "utf8") } catch { continue }
  for (const m of MORTOS) {
    // `test` com regex sem /g nao guarda estado — seguro chamar em laco.
    if (!m.padrao.test(src)) continue
    src.split(/\r?\n/).forEach((linha, i) => {
      if (m.padrao.test(linha)) {
        restos.push({ arquivo: p, linha: i + 1, nome: m.nome, texto: linha.trim().slice(0, 90) })
      }
    })
  }
}

console.log(`  varredura ampla ..: ${varridos.length} arquivos`)
console.log(`  servidor morto ...: ${restos.length} referencia(s)\n`)

for (const r of restos) {
  console.log(`  ${r.arquivo}:${r.linha}   [${r.nome}]`)
  console.log(`    ${r.texto}`)
}

if (restos.length > 0) {
  console.log(`\n${restos.length} referencia(s) a servidor que nao existe mais.`)
  console.log("Aponte para o endereco atual. Se a mencao for registro historico e nao")
  console.log("uso, adicione o arquivo a `HISTORICO` neste portao — com o motivo.\n")
  process.exit(1)
}

console.log("NENHUM SERVIDOR MORTO REFERENCIADO — nem no launcher, nem nos scripts.\n")

