// REPARA O MANIFESTO DE ESTADIOS depois de uma conversao interrompida.
//
//   node scripts/reparar-manifesto-estadios.mjs [--aplicar]
//
// A primeira versao do conversor apagava o PNG a cada arquivo mas so gravava o
// manifesto no fim. Interrompido no meio (o drive do Google Drive escreve devagar
// e 1.804 arquivos levariam horas), o manifesto fica apontando para PNGs que ja
// nao existem — e a tela de pre-jogo perde o fundo, sem erro nenhum.
//
// O reparo e deterministico e nao depende de saber onde parou: para cada entrada
// cujo arquivo sumiu, procura o mesmo nome com outra extensao. Se achar, aponta
// para ele. Se nao achar, a entrada e REMOVIDA — apontar para arquivo inexistente
// e pior do que nao ter a entrada, porque o codigo trata "sem foto" e nao trata
// "foto 404".
//
// Sem `--aplicar` ele so relata. Serve tambem de conferencia de rotina.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import path from "node:path"

const RAIZ = process.env.ULTRAFOOT_RAIZ ?? path.resolve(import.meta.dirname, "..")
const PASTA = path.join(RAIZ, "public/stadiums")
const MANIFESTO = path.join(PASTA, "manifest.json")
const APLICAR = process.argv.includes("--aplicar")

const manifesto = JSON.parse(readFileSync(MANIFESTO, "utf-8"))
const naPasta = new Set(readdirSync(PASTA))

// Indice por nome-sem-extensao: e como se acha o substituto de um arquivo que
// mudou de formato.
const porBase = new Map()
for (const f of naPasta) {
  const base = f.replace(/\.[^.]+$/, "")
  if (!porBase.has(base)) porBase.set(base, [])
  porBase.get(base).push(f)
}

let ok = 0, remendados = 0, removidos = 0
const exemplos = []

for (const [chave, url] of Object.entries(manifesto)) {
  if (typeof url !== "string") continue
  const nome = path.basename(url)
  if (naPasta.has(nome)) { ok++; continue }

  const base = nome.replace(/\.[^.]+$/, "")
  // Preferencia por webp: e o formato para o qual estamos indo.
  const candidatos = porBase.get(base) ?? []
  const escolhido = candidatos.find((f) => f.endsWith(".webp")) ?? candidatos[0]

  if (escolhido) {
    if (APLICAR) manifesto[chave] = `/stadiums/${escolhido}`
    remendados++
    if (exemplos.length < 5) exemplos.push(`  ${nome} -> ${escolhido}`)
  } else {
    if (APLICAR) delete manifesto[chave]
    removidos++
  }
}

console.log(`entradas: ${Object.keys(manifesto).length}`)
console.log(`  arquivo existe:      ${ok}`)
console.log(`  remendadas (webp):   ${remendados}`)
console.log(`  removidas (sem par): ${removidos}`)
if (exemplos.length) console.log(exemplos.join("\n"))

if (APLICAR && (remendados || removidos)) {
  writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + "\n", "utf-8")
  console.log("\nmanifesto gravado")
} else if (!APLICAR) {
  console.log("\n(relatorio apenas — use --aplicar para gravar)")
}
