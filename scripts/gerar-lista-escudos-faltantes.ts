// GERA A LISTA DOS CLUBES SEM ESCUDO, no formato que o downloader consome.
//
// `Donwloader/uf_downloader.py` lê `data/seeds/bf2026-teams.json` — um seed
// ANTIGO, de antes da expansão UEFA. Justamente os 660 clubes que faltam não
// estão lá, então rodar o downloader como está não baixaria nenhum deles.
//
// Este script escreve a lista de verdade, tirada de `allTeams`, com os campos
// que o downloader usa: fileKey, nome, curto, pais, escudo.
//
//   npx tsx scripts/gerar-lista-escudos-faltantes.ts [--pais Romenia]
//
// Depois:
//   Donwloader\.venv2\Scripts\python.exe Donwloader\uf_downloader.py \
//     --mode escudos --times data/seeds/escudos-faltantes.json --limit 20

import { writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import { allTeams } from "../lib/teams-data"
import { getLocalEscudoPath } from "../lib/escudos-map"

const raiz = process.cwd()
const temEscudo = (fileKey: string) =>
  existsSync(path.join(raiz, "public", getLocalEscudoPath(fileKey).replace(/^\//, "")))

const argPais = process.argv.indexOf("--pais")
const filtroPais = argPais >= 0 ? process.argv[argPais + 1] : null

const faltantes = allTeams
  .filter(t => !temEscudo(t.file_key))
  .filter(t => !filtroPais || ((t as { pais?: string }).pais ?? "").toLowerCase() === filtroPais.toLowerCase())
  .map(t => ({
    fileKey: t.file_key,
    nome: t.nome,
    curto: t.curto,
    pais: (t as { pais?: string }).pais ?? "",
    // O downloader grava em `public/escudos/<basename do escudo>`; manter o
    // mesmo caminho que o jogo procura evita baixar para um nome que a tela
    // nunca consulta — o erro mais chato desta pipeline, porque não dá erro.
    escudo: getLocalEscudoPath(t.file_key),
  }))

const destino = path.resolve("data/seeds/escudos-faltantes.json")
writeFileSync(destino, `${JSON.stringify(faltantes, null, 2)}\n`)

const porPais = new Map<string, number>()
for (const t of faltantes) porPais.set(t.pais, (porPais.get(t.pais) ?? 0) + 1)

console.log(`clubes sem escudo: ${faltantes.length}`)
console.log(`escrito em ${destino}`)
console.log("")
for (const [pais, n] of [...porPais].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${pais.padEnd(24)} ${n}`)
}
