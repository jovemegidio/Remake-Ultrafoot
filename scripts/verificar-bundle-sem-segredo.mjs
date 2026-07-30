// ETAPA 8 — PROVA QUE O SEGREDO NAO ESTA NO QUE VAI PARA O COMPRADOR.
//
//   node scripts/verificar-bundle-sem-segredo.mjs
//   node scripts/verificar-bundle-sem-segredo.mjs --alvo out --alvo .next
//
// POR QUE ISTO E UM SCRIPT, E NAO UM `grep` NO CHECKLIST.
//
// O plano (§3.6) pedia conferir a mao depois do build:
//
//     grep -r "ULTRAFOOT_LICENSE_SECRET" out/ .next/
//
// Esse grep passa quando NAO devia em dois casos reais:
//
//   1. O Next substitui `process.env.NEXT_PUBLIC_*` pelo VALOR. O nome da
//      variavel nao sobra no bundle — some junto. Procurar o nome da uma falsa
//      sensacao de seguranca: o segredo pode estar la, em texto puro, e o grep
//      volta vazio porque o rotulo dele nao esta.
//
//   2. Rodado antes do build, ou com a pasta de saida vazia, ele tambem volta
//      vazio. "Nenhum resultado" fica indistinguivel de "nao verifiquei nada".
//
// Este script cobre os dois: procura o VALOR do segredo (se ainda houver um por
// aqui), procura o nome como reforco, e FALHA quando nao encontra nada para
// verificar — em vez de dizer que esta tudo bem.
//
// Roda depois de `pnpm build` / `pnpm tauri:build`. No CI, antes de publicar.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const RAIZ = path.resolve(import.meta.dirname, "..")

function args(nome) {
  const saida = []
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === `--${nome}` && process.argv[i + 1]) saida.push(process.argv[i + 1])
  }
  return saida
}

// Onde o build do Next e do Tauri deixam o que o comprador recebe.
const ALVOS_PADRAO = ["out", ".next", "src-tauri/target/release", "dist"]
const alvos = args("alvo").length ? args("alvo") : ALVOS_PADRAO

// Extensoes que de fato viajam para o jogador. Varrer .map/.md/.txt sem sentido
// alonga a busca e gera achado que nao e risco.
const EXTENSOES = new Set([".js", ".mjs", ".cjs", ".html", ".json", ".css", ".exe", ".dll", ".wasm"])

/**
 * O SEGREDO ANTIGO, se ainda existir nesta maquina.
 *
 * Procurar o VALOR e o que realmente importa: e ele que o Next inlina. Quando o
 * arquivo nao existe (maquina limpa, ou etapa 9 concluida), a busca pelo valor
 * nao roda e o script diz isso em voz alta em vez de fingir aprovacao.
 */
function segredoLocal() {
  // Caminho sobrescrevivel para o CI (onde o segredo chega por outro meio) e
  // para o proprio teste deste script.
  const arq = process.env.ULTRAFOOT_SECRET_FILE
    || path.join(os.homedir(), ".ultrafoot-keys", "ultrafoot-license.secret")
  if (!existsSync(arq)) return null
  const v = readFileSync(arq, "utf8").trim()
  return v.length >= 8 ? v : null
}

/** Tambem procura o que esta no .env.local, que e o que o build de fato leu. */
function segredoDoEnvLocal() {
  const arq = path.join(RAIZ, ".env.local")
  if (!existsSync(arq)) return null
  const m = readFileSync(arq, "utf8").match(/NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET=(.+)/)
  const v = m?.[1]?.trim()
  return v && v.length >= 8 ? v : null
}

function* arquivos(dir) {
  let entradas
  try { entradas = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entradas) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      // node_modules dentro da saida nao e o que o jogador executa, e varre-lo
      // multiplica o tempo por dez.
      if (e.name === "node_modules" || e.name === "cache") continue
      yield* arquivos(p)
    } else if (EXTENSOES.has(path.extname(e.name).toLowerCase())) {
      yield p
    }
  }
}

const agulhas = []
const s1 = segredoLocal()
const s2 = segredoDoEnvLocal()
if (s1) agulhas.push({ rotulo: "valor do segredo (~/.ultrafoot-keys)", texto: s1, grave: true })
if (s2 && s2 !== s1) agulhas.push({ rotulo: "valor do segredo (.env.local)", texto: s2, grave: true })
// O nome sozinho nao e vazamento — mas indica codigo que ainda espera o segredo.
agulhas.push({ rotulo: "nome NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET", texto: "NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET", grave: false })
agulhas.push({ rotulo: "nome ULTRAFOOT_LICENSE_SECRET", texto: "ULTRAFOOT_LICENSE_SECRET", grave: false })

const presentes = alvos.map(a => path.join(RAIZ, a)).filter(p => existsSync(p) && statSync(p).isDirectory())

console.log()
if (presentes.length === 0) {
  // A falha mais importante deste script: nao deixar "nada encontrado" passar
  // por "aprovado". Sem build, nao ha o que verificar.
  console.error("  NAO HA O QUE VERIFICAR — nenhuma pasta de saida encontrada:")
  for (const a of alvos) console.error(`    ${a}`)
  console.error("\n  Rode o build primeiro (pnpm build / pnpm tauri:build) e chame de novo.")
  console.error("  Falhando de proposito: um 'nenhum resultado' aqui NAO e prova de nada.\n")
  process.exit(1)
}

console.log("  Verificando:")
for (const p of presentes) console.log(`    ${path.relative(RAIZ, p)}`)
if (!s1 && !s2) {
  console.log("\n  NOTA: o segredo antigo nao existe nesta maquina, entao nao da para")
  console.log("  procurar o VALOR dele — so o nome da variavel. Para a prova completa,")
  console.log("  rode isto na maquina que gerou a build de release.")
}
console.log()

let arquivosLidos = 0
const achados = []

for (const raiz of presentes) {
  for (const arq of arquivos(raiz)) {
    let conteudo
    try { conteudo = readFileSync(arq, "latin1") } catch { continue }
    arquivosLidos++
    for (const a of agulhas) {
      if (conteudo.includes(a.texto)) {
        achados.push({ arquivo: path.relative(RAIZ, arq), ...a })
      }
    }
  }
}

console.log(`  ${arquivosLidos} arquivo(s) lido(s).`)

if (arquivosLidos === 0) {
  console.error("\n  As pastas existem mas estao vazias. Build incompleto?")
  console.error("  Falhando de proposito, pelo mesmo motivo de antes.\n")
  process.exit(1)
}

const graves = achados.filter(a => a.grave)
const avisos = achados.filter(a => !a.grave)

if (graves.length) {
  console.error("\n  ⚠️  SEGREDO ENCONTRADO NO QUE VAI PARA O COMPRADOR:\n")
  for (const a of graves) console.error(`    ${a.arquivo}\n      ${a.rotulo}`)
  console.error("\n  NAO PUBLIQUE. Com este valor qualquer pessoa emite licenca.")
  console.error("  Confira se o prebuild ainda injeta o segredo e se lib/license.ts")
  console.error("  ainda o le (etapa 6 do docs/plano-licenca-ed25519.md).\n")
  process.exit(1)
}

if (avisos.length) {
  console.log("\n  Aviso: o NOME da variavel aparece (o valor, nao).\n")
  for (const a of avisos.slice(0, 10)) console.log(`    ${a.arquivo}\n      ${a.rotulo}`)
  console.log("\n  Nao e vazamento — mas indica codigo que ainda espera o segredo.")
  console.log("  Depois da etapa 6 isto deve desaparecer.\n")
  process.exit(1)
}

console.log("\n  OK — nem o valor nem o nome do segredo estao na saida do build.\n")
