// O QUE ESTÁ EM `public/` REALMENTE ENTROU NO PACOTE?
//
// Por que este gate existe
// ────────────────────────
// O Tauri COPIA os recursos declarados em `bundle.resources` para
// `src-tauri/target/release/<pasta>` num instante do build, e o NSIS empacota
// essa cópia. Quem escreve em `public/` DEPOIS desse instante vê o arquivo no
// repositório, vê o instalador ser gerado, e conclui que está tudo lá.
//
// Aconteceu em 12/08/2026 com a 1.0.295: dez escudos importados durante a
// compilação ficaram de fora do pacote. Os arquivos existiam em
// `public/escudos`, o instalador tinha 752 MB e assinatura válida, e a Croácia
// continuaria sem escudo — um defeito que só apareceria semanas depois, sem
// nada apontando para a causa.
//
//   node scripts/qa-recursos-no-pacote.mjs
//
// Compara a CONTAGEM de cada pasta declarada em `bundle.resources` com a cópia
// empacotada. Sem build recente, não reprova nada: só avisa.

import { readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(".")
const conf = JSON.parse(await import("node:fs").then(fs => fs.readFileSync(path.join(RAIZ, "src-tauri/tauri.conf.json"), "utf-8")))
// `bundle.resources` e um OBJETO { "<padrao de origem>": "<pasta destino>/" },
// nao um array — a doc do Tauri aceita as duas formas e este projeto usa o mapa.
// Tratar como array dava "declarados is not iterable" e o gate nao conferia nada.
const bruto = conf?.bundle?.resources ?? {}
const declarados = Array.isArray(bruto) ? bruto : Object.keys(bruto)
const ALVO = path.join(RAIZ, "src-tauri/target/release")

if (!existsSync(ALVO)) {
  console.log("sem build em src-tauri/target/release — nada a conferir")
  process.exit(0)
}

/**
 * NOMES-BASE ÚNICOS, não contagem de arquivos.
 *
 * ⚠️ O empacotador do Tauri ACHATA os globs: `public/selecoes/camisas/x.png` e
 * `public/selecoes/escudos/x.png` viram os dois `selecoes/x.png`, e o segundo
 * sobrescreve o primeiro. Já era assim antes desta versão — é o mesmo
 * achatamento que fez `jogadores/tm` sumir na 1.0.111.
 *
 * Contando ARQUIVOS, este gate acusaria "faltam 222 em selecoes" em toda build,
 * para sempre, sem nada de errado ter acontecido. Verificação que vive vermelha
 * é desligada, e leva junto as que funcionam — foi o que aconteceu com o
 * `qa:smoke`, que ficou fora dos gates por causa dos escudos e levou doze
 * checks do núcleo do jogo.
 */
async function nomesUnicos(dir, acc = new Set()) {
  if (!existsSync(dir)) return null
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (entrada.name === "desktop.ini") continue
    if (entrada.isDirectory()) await nomesUnicos(path.join(dir, entrada.name), acc)
    else acc.add(entrada.name)
  }
  return acc
}

async function contar(dir) {
  const nomes = await nomesUnicos(dir)
  return nomes ? nomes.size : null
}

let divergencias = 0
let conferidas = 0

for (const padrao of declarados) {
  // Só as entradas do tipo `../public/<pasta>/**/*`.
  const m = /^\.\.\/public\/([^/]+)\/\*\*\/\*$/.exec(String(padrao))
  if (!m) continue
  const pasta = m[1]
  const origem = path.join(RAIZ, "public", pasta)
  const empacotado = path.join(ALVO, pasta)

  const naOrigem = await contar(origem)
  const noPacote = await contar(empacotado)
  if (naOrigem == null) continue
  if (noPacote == null) {
    console.error(` FALHA ${pasta.padEnd(20)} declarado no bundle e AUSENTE do pacote`)
    divergencias++
    continue
  }
  conferidas++
  const faltam = naOrigem - noPacote
  if (faltam > 0) {
    console.error(` FALHA ${pasta.padEnd(20)} origem ${String(naOrigem).padStart(6)}  pacote ${String(noPacote).padStart(6)}  FALTAM ${faltam}`)
    divergencias++
  } else {
    console.log(`  ok   ${pasta.padEnd(20)} origem ${String(naOrigem).padStart(6)}  pacote ${String(noPacote).padStart(6)}`)
  }
}

console.log("")
if (divergencias) {
  console.error(`${divergencias} pasta(s) com arquivo que NAO entrou no instalador.`)
  console.error("Recompile: arquivo escrito em public/ depois da coleta de recursos fica de fora.")
  process.exit(1)
}
console.log(`OK: ${conferidas} pasta(s) de recurso conferem entre public/ e o pacote.`)
