// Coloca o segredo de licenca em .env.local antes do build.
//
// O Next so enxerga NEXT_PUBLIC_* que existam no ambiente OU em .env.local no
// momento do build. Sem isto o jogo sai sem como validar codigo e TODO comprador
// recebe "esta versao nao consegue validar codigos".
//
// O segredo mora fora do repositorio (~/.ultrafoot-keys) e .env.local ja esta no
// .gitignore — nada disso entra no git.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const arquivo = path.join(os.homedir(), ".ultrafoot-keys", "ultrafoot-license.secret")
const envLocal = path.resolve(".env.local")
const CHAVE = "NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET"

if (!existsSync(arquivo)) {
  console.warn(`\n  AVISO: segredo de licenca nao encontrado em ${arquivo}`)
  console.warn("  A build vai sair SEM validacao de codigo. Nao publique assim.\n")
  process.exit(0)
}

const segredo = readFileSync(arquivo, "utf8").trim()
const anterior = existsSync(envLocal) ? readFileSync(envLocal, "utf8") : ""
const semAChave = anterior.split("\n").filter(l => l && !l.startsWith(`${CHAVE}=`)).join("\n")
writeFileSync(envLocal, `${semAChave}${semAChave ? "\n" : ""}${CHAVE}=${segredo}\n`, "utf8")
console.log(`segredo de licenca escrito em .env.local (${segredo.length} caracteres)`)
