// POR QUE 15 CLUBES COM ELENCO EM DISCO APARECEM "SEM ELENCO REAL"?
//
// `cobertura-de-elencos.ts` achou 15 clubes que constam de
// `real-squads-tm.json` e mesmo assim entram na conta de "sem nenhum atleta de
// fonte real". Isso não é falta de dado — é dado que o jogo não está lendo, o
// mesmo padrão dos atributos de goleiro que o motor ignorava.
//
//   npx tsx scripts/diagnostico-elenco-nao-lido.ts

import { readFileSync } from "node:fs"
import { competitionsByLeague } from "../lib/international-competitions"
import { completarLigaComPool } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

const seed = JSON.parse(readFileSync("data/seeds/real-squads-tm.json", "utf-8")) as Record<string, unknown[]>

function norm(v: string): string {
  return (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

// nome normalizado -> chaves do seed que o contêm
const porNome = new Map<string, string[]>()
for (const chave of Object.keys(seed)) {
  const nome = norm(chave.split("|")[1] ?? "")
  if (!nome) continue
  porNome.set(nome, [...(porNome.get(nome) ?? []), chave])
}

const vistos = new Set<string>()
const casos: { nome: string; fileKey: string; curto?: string; chaves: string[]; noSeed: number; noJogo: number }[] = []

for (const divisao of Object.keys(competitionsByLeague)) {
  for (const time of completarLigaComPool(divisao)) {
    if (vistos.has(time.file_key)) continue
    vistos.add(time.file_key)
    const elenco = getPlayersForTeam(time, { raw: true })
    const reais = elenco.length - elenco.filter(p => p.generatedOrigin === "provisional").length
    if (reais > 0) continue
    const chaves = porNome.get(norm(time.nome)) ?? []
    if (!chaves.length) continue
    casos.push({
      nome: time.nome,
      fileKey: time.file_key,
      curto: time.curto,
      chaves,
      noSeed: (seed[chaves[0]] ?? []).length,
      noJogo: elenco.length,
    })
  }
}

console.log(`clubes com elenco NO SEED mas sem elenco real no jogo: ${casos.length}`)
console.log("")
for (const c of casos) {
  console.log(`${c.nome}`)
  console.log(`  file_key no jogo : ${c.fileKey}`)
  console.log(`  curto no jogo    : ${c.curto ?? "(sem)"}`)
  console.log(`  chave(s) no seed : ${c.chaves.join(" | ")}`)
  console.log(`  atletas no seed  : ${c.noSeed}   no jogo: ${c.noJogo} (todos gerados)`)
  // A chave composta que `getRealSquad` tenta PRIMEIRO.
  console.log(`  chave tentada    : ${c.curto}|${norm(c.nome)}`)
  console.log("")
}
