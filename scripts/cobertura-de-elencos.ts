// EXISTE FONTE LOCAL PARA OS CLUBES SEM ELENCO REAL?
//
// A 292 mediu 480 clubes jogáveis com menos de 18 atletas de fonte real e 320
// sem nenhum. Antes de propor baixar dado da internet, a pergunta barata: algum
// dos seeds que já estão em disco cobre esses clubes e simplesmente não está
// sendo lido?
//
// Candidatos em `data/seeds`: tm-squads.json (14,16 MB), real-squads-tm.json
// (4,31 MB), imported-bf2026-elencos.json (7,91 MB).
//
//   npx tsx scripts/cobertura-de-elencos.ts

import { readFileSync, existsSync } from "node:fs"
import { competitionsByLeague } from "../lib/international-competitions"
import { completarLigaComPool } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

function normalizar(valor: string): string {
  return (valor ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Chaves de todo seed de elenco em disco, normalizadas. */
function chavesDoSeed(arquivo: string): Set<string> {
  const chaves = new Set<string>()
  if (!existsSync(arquivo)) return chaves
  const bruto = JSON.parse(readFileSync(arquivo, "utf-8")) as unknown
  const registrar = (k: string) => {
    // As chaves vêm em formatos diferentes por seed: "PAIS|clube", "clube", id.
    for (const parte of String(k).split("|")) if (parte) chaves.add(normalizar(parte))
  }
  if (Array.isArray(bruto)) {
    for (const item of bruto as { nome?: string; clube?: string }[]) {
      if (item?.nome) registrar(item.nome)
      if (item?.clube) registrar(item.clube)
    }
  } else if (bruto && typeof bruto === "object") {
    for (const k of Object.keys(bruto as Record<string, unknown>)) registrar(k)
  }
  return chaves
}

const fontes: Record<string, Set<string>> = {
  "tm-squads.json": chavesDoSeed("data/seeds/tm-squads.json"),
  "real-squads-tm.json": chavesDoSeed("data/seeds/real-squads-tm.json"),
}

// Clubes jogáveis sem NENHUM atleta de fonte real.
const semElenco: { nome: string; fileKey: string; curto?: string }[] = []
const vistos = new Set<string>()
for (const divisao of Object.keys(competitionsByLeague)) {
  for (const time of completarLigaComPool(divisao)) {
    if (vistos.has(time.file_key)) continue
    vistos.add(time.file_key)
    const elenco = getPlayersForTeam(time, { raw: true })
    const reais = elenco.length - elenco.filter(p => p.generatedOrigin === "provisional").length
    if (reais === 0) semElenco.push({ nome: time.nome, fileKey: time.file_key, curto: time.curto })
  }
}

console.log(`clubes jogáveis SEM nenhum atleta de fonte real: ${semElenco.length}`)
console.log("")
for (const [nome, chaves] of Object.entries(fontes)) {
  if (!chaves.size) { console.log(`${nome}: arquivo ausente`); continue }
  const cobertos = semElenco.filter(t =>
    chaves.has(normalizar(t.nome)) || (t.curto ? chaves.has(normalizar(t.curto)) : false) ||
    chaves.has(normalizar(t.fileKey)))
  console.log(`${nome.padEnd(22)} ${chaves.size} chaves | cobre ${cobertos.length} dos ${semElenco.length} sem elenco`)
  if (cobertos.length) console.log(`  exemplos: ${cobertos.slice(0, 8).map(t => t.nome).join(", ")}`)
}

console.log("")
console.log("amostra dos que seguem sem elenco:")
for (const t of semElenco.slice(0, 12)) console.log(`  ${t.nome} [${t.fileKey}]`)
