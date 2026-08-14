// OS ARQUIVOS DE VERSÃO DO JOGO APONTAM PARA A MESMA VERSÃO?
//
// Irmão do `qa-versao-do-launcher.mjs`, para o lado do JOGO — que não tinha
// gate nenhum. Encontrado em 12/08/2026 com `package.json` na 1.0.299 e
// `src-tauri/tauri.conf.json` na 1.0.296.
//
// Por que este gate existe
// ────────────────────────
// A versão do jogo é lida de DOIS arquivos, por consumidores diferentes:
//
//   • `package.json`      → `deploy-tudo.mjs` (VERSAO_JOGO). Decide o NOME do
//                           instalador que ele procura, a versão gravada no
//                           `latest.json` e o `EXIGIR_VERSAO` das novidades do
//                           launcher.
//   • `tauri.conf.json`   → é com esta que o Tauri BATIZA o instalador, e é
//                           dela que o `publish-release.mjs` tira a tag
//                           `build-X.Y.Z` e o nome do `.exe`.
//
// Desalinhados, o Tauri gera `Ultrafoot 26_1.0.296_x64-setup.exe`, o
// `deploy-tudo` procura `..._1.0.299_...`, não acha e anuncia "SEM INSTALADOR";
// e o `publish-release` publicaria a tag `build-1.0.296` levando as notas da
// 1.0.299. Nenhum dos dois diz "as versões divergem" — o sintoma chega
// disfarçado de arquivo faltando.
//
// ⚠️ O `Cargo.toml` do jogo NÃO entra aqui, e isso é de propósito. Ele está em
// "0.1.0" e nada lê `CARGO_PKG_VERSION` em `src-tauri/src` — diferente do
// launcher, onde o `check_launcher_update` compara com ele e o desalinhamento
// prende o jogador num laço de atualização. Alinhar o do jogo não conserta nada
// e só cria um quarto lugar para esquecer.
//
// ⚠️ AS ÁRVORES SÃO DUAS. O `deploy-tudo` lê o `package.json` do REPOSITÓRIO
// (G:) mas o instalador foi compilado no DISCO DE BUILD (C:\Ultrafoot). Um
// `package.json` sincronizado e um `tauri.conf.json` que ficou para trás batem
// dentro de cada árvore e divergem entre elas. Por isso o gate aceita
// `EXIGIR_VERSAO`: rodando no disco de build com a versão do repositório, ele
// fecha também esse buraco.
//
//   node scripts/qa-versao-do-jogo.mjs
//   EXIGIR_VERSAO=1.0.302 node scripts/qa-versao-do-jogo.mjs

import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(".")

const ARQUIVOS = [
  {
    caminho: "package.json",
    ler: (t) => JSON.parse(t).version,
    nota: "o deploy tira daqui o nome do instalador que procura",
  },
  {
    caminho: "src-tauri/tauri.conf.json",
    ler: (t) => JSON.parse(t).version,
    nota: "é com esta que o Tauri batiza o .exe e o publish-release cria a tag",
  },
]

const lidos = []
let ausentes = 0
for (const a of ARQUIVOS) {
  const alvo = path.join(RAIZ, a.caminho)
  if (!existsSync(alvo)) {
    console.error(` FALHA ${a.caminho} — arquivo não encontrado`)
    ausentes++
    continue
  }
  const versao = a.ler(readFileSync(alvo, "utf-8"))
  lidos.push({ ...a, versao })
  console.log(`  ${String(versao).padEnd(10)} ${a.caminho}   (${a.nota})`)
}

console.log("")

if (ausentes) {
  console.error(`${ausentes} arquivo(s) de versão do jogo não existe(m).`)
  process.exit(1)
}

const distintas = [...new Set(lidos.map((l) => l.versao))]
if (distintas.length > 1) {
  console.error(`FALHA: os arquivos apontam para versões DIFERENTES: ${distintas.join(", ")}`)
  console.error("O Tauri batiza o instalador com a do tauri.conf.json e o deploy procura a do")
  console.error("package.json — publicar assim faz o deploy dizer 'SEM INSTALADOR', ou taguear")
  console.error("a release antiga levando as notas da nova.")
  process.exit(1)
}

// Cruzamento entre árvores (repositório × disco de build).
const exigida = process.env.EXIGIR_VERSAO?.trim()
if (exigida && exigida !== distintas[0]) {
  console.error(`FALHA: aqui os arquivos dizem ${distintas[0]}, mas o deploy espera ${exigida}.`)
  console.error("Isto é o repositório e o disco de build em versões diferentes: sincronize antes")
  console.error("de publicar, senão o instalador que subir não é o que foi verificado.")
  process.exit(1)
}

console.log(
  `OK: os ${lidos.length} arquivos de versão do jogo dizem ${distintas[0]}` +
    `${exigida ? `, e batem com a ${exigida} esperada pelo deploy.` : "."}`,
)
