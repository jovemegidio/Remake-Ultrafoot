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

/** Padrao do endereco proprio, sem depender do IP atual. */
const ENDERECO = /ultrafoot\.[\d-]+\.sslip\.io/

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
