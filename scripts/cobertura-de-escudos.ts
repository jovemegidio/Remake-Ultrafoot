// QUANTOS DOS CLUBES SEM ESCUDO AS PASTAS LOCAIS REALMENTE COBREM?
//
// `import-escudos-pasta.mjs --dry --todos` diz o que ela consegue casar. Este
// script cruza esse casamento com quem de fato está SEM escudo hoje — que é a
// única pergunta que importa antes de mover arquivo.
//
// A distinção não é acadêmica: a maior parte do que as pastas casam são clubes
// que JÁ TÊM escudo (brasileiros, sauditas, argentinos). Importar por cima deles
// não fecha buraco nenhum e ainda arrisca trocar arte boa por arte pior — o
// canal vence o embutido, e foi assim que o Santos ficou anos com o escudo do
// Santos Laguna.
//
//   node scripts/import-escudos-pasta.mjs --dry --todos --origem <pasta> > casamentos.txt
//   npx tsx scripts/cobertura-de-escudos.ts casamentos.txt [outro.txt ...]

import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { allTeams } from "../lib/teams-data"
import { getLocalEscudoPath } from "../lib/escudos-map"

const raiz = process.cwd()
const temEscudo = (fileKey: string) =>
  existsSync(path.join(raiz, "public", getLocalEscudoPath(fileKey).replace(/^\//, "")))

const semEscudo = new Set(allTeams.filter(t => !temEscudo(t.file_key)).map(t => t.file_key))
const nomePorChave = new Map(allTeams.map(t => [t.file_key, t.nome]))

const arquivos = process.argv.slice(2)
if (!arquivos.length) {
  console.error("uso: npx tsx scripts/cobertura-de-escudos.ts <casamentos.txt> [...]")
  process.exit(1)
}

/** "Arsenal - ING.png -> Arsenal [arsenal]" -> { arquivo, fileKey } */
const LINHA = /^\s{2}(.+?) -> .+? \[([^\]]+)\]\s*$/

const cobre = new Map<string, string>()   // fileKey -> arquivo de origem
const jaTem = new Map<string, string>()

for (const arq of arquivos) {
  for (const linha of readFileSync(arq, "utf-8").split(/\r?\n/)) {
    const m = LINHA.exec(linha)
    if (!m) continue
    const [, origem, fileKey] = m
    if (semEscudo.has(fileKey)) {
      // Primeira fonte que cobre vence; a segunda só entra no que sobrou.
      if (!cobre.has(fileKey)) cobre.set(fileKey, `${path.basename(arq)}: ${origem}`)
    } else if (!jaTem.has(fileKey)) {
      jaTem.set(fileKey, origem)
    }
  }
}

console.log(`clubes sem escudo hoje : ${semEscudo.size}`)
console.log(`casamentos que FECHAM buraco: ${cobre.size}`)
console.log(`casamentos em clube que JA TEM escudo: ${jaTem.size}  <- nao fecham nada`)
console.log(`continuariam sem escudo: ${semEscudo.size - cobre.size}`)
console.log("")
if (cobre.size) {
  console.log("── os que fechariam buraco ──")
  for (const [chave, origem] of [...cobre].sort()) {
    console.log(`  ${(nomePorChave.get(chave) ?? chave).padEnd(28)} [${chave}]  <- ${origem}`)
  }
}
