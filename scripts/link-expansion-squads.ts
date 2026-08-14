/**
 * Reaproveita elencos coletados do MESMO clube quando a expansão UEFA cria uma
 * nova identidade curta. O vínculo é deliberadamente estrito: nome normalizado
 * idêntico e uma única origem. Não há aproximação/fuzzy nem inferência por país.
 *
 *   tsx scripts/link-expansion-squads.ts          # auditoria
 *   tsx scripts/link-expansion-squads.ts --write  # grava os aliases
 */
import fs from "node:fs"
import { UEFA_EXPANSION_CLUBS } from "../lib/uefa-expansion"

type SourcePlayer = Record<string, unknown>
type SourceSquads = Record<string, SourcePlayer[]>

const path = "data/seeds/real-squads-tm.json"
const write = process.argv.includes("--write")
const normalize = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()

const squads = JSON.parse(fs.readFileSync(path, "utf8")) as SourceSquads
const sourcesByName = new Map<string, string[]>()
for (const key of Object.keys(squads)) {
  const name = key.split("|").slice(1).join("|")
  const sources = sourcesByName.get(name) ?? []
  sources.push(key)
  sourcesByName.set(name, sources)
}

let linked = 0
let ambiguous = 0
for (const club of UEFA_EXPANSION_CLUBS) {
  const name = normalize(club.nome)
  const target = `${club.curto}|${name}`
  if (squads[target]?.length) continue
  const sources = (sourcesByName.get(name) ?? []).filter(key => squads[key]?.length >= 7)
  if (sources.length !== 1) {
    if (sources.length > 1) ambiguous++
    continue
  }
  // Cópia estrutural: futuras atualizações do coletor podem substituir apenas
  // uma chave sem compartilhar referência em memória com o alias.
  squads[target] = squads[sources[0]].map(player => ({ ...player }))
  linked++
  console.log(`${club.nome}: ${sources[0]} -> ${target}`)
}

if (write && linked > 0) fs.writeFileSync(path, JSON.stringify(squads), "utf8")
console.log(`${linked} elencos vinculados; ${ambiguous} nomes ambíguos ignorados; modo=${write ? "gravação" : "auditoria"}`)

