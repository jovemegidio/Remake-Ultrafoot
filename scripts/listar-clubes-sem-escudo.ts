// LISTA, PARA LER, OS CLUBES JOGÁVEIS QUE ESTÃO SEM ESCUDO.
//
// `auditar-escudos-faltantes.ts` conta e agrupa; este ESCREVE a lista inteira,
// clube a clube, agrupada por país e com a liga de cada um — que é o formato
// útil para quem vai atrás do arquivo.
//
//   npx tsx scripts/listar-clubes-sem-escudo.ts            (imprime)
//   npx tsx scripts/listar-clubes-sem-escudo.ts --arquivo  (grava .md e .csv)

import { existsSync, writeFileSync } from "node:fs"
import path from "node:path"
import { allTeams } from "../lib/teams-data"
import { getLocalEscudoPath } from "../lib/escudos-map"
import { competitionsByLeague } from "../lib/international-competitions"
import { completarLigaComPool } from "../lib/teams-data"

const raiz = process.cwd()
const temEscudo = (fileKey: string) =>
  existsSync(path.join(raiz, "public", getLocalEscudoPath(fileKey).replace(/^\//, "")))

// Em que liga jogável cada clube aparece — a informação que diz se o buraco é
// visível para o jogador ou só existe no pool.
const ligaDoClube = new Map<string, string>()
for (const divisao of Object.keys(competitionsByLeague)) {
  for (const t of completarLigaComPool(divisao)) {
    if (!ligaDoClube.has(t.file_key)) ligaDoClube.set(t.file_key, divisao)
  }
}

interface Linha { pais: string; nome: string; fileKey: string; liga: string }

const faltantes: Linha[] = allTeams
  .filter(t => !temEscudo(t.file_key))
  .map(t => ({
    pais: (t as { pais?: string }).pais || "(sem país)",
    nome: t.nome,
    fileKey: t.file_key,
    liga: ligaDoClube.get(t.file_key) ?? "—",
  }))
  .sort((a, b) => a.pais.localeCompare(b.pais) || a.nome.localeCompare(b.nome))

const porPais = new Map<string, Linha[]>()
for (const l of faltantes) porPais.set(l.pais, [...(porPais.get(l.pais) ?? []), l])

const paisesOrdenados = [...porPais.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))

const linhas: string[] = []
linhas.push(`# Clubes sem escudo: ${faltantes.length} de ${allTeams.length}`)
linhas.push("")
linhas.push(`${porPais.size} países afetados. Ordenados pelo tamanho do buraco.`)
linhas.push("")
for (const [pais, clubes] of paisesOrdenados) {
  linhas.push(`## ${pais} — ${clubes.length}`)
  linhas.push("")
  for (const c of clubes) linhas.push(`- ${c.nome}  \`${c.fileKey}\`  ·  ${c.liga}`)
  linhas.push("")
}

const texto = linhas.join("\n")

if (process.argv.includes("--arquivo")) {
  const md = path.resolve("clubes-sem-escudo.md")
  writeFileSync(md, `${texto}\n`)
  const csv = ["pais,nome,file_key,liga", ...faltantes.map(l =>
    `"${l.pais}","${l.nome.replace(/"/g, '""')}","${l.fileKey}","${l.liga}"`)].join("\n")
  const arqCsv = path.resolve("clubes-sem-escudo.csv")
  writeFileSync(arqCsv, `${csv}\n`)
  console.log(`escrito: ${md}`)
  console.log(`escrito: ${arqCsv}`)
  console.log(`${faltantes.length} clubes, ${porPais.size} países`)
} else {
  console.log(texto)
}
