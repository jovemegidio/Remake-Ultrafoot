// Sincroniza o repositorio no GitHub depois de um build.
//
// O PROBLEMA que isto resolve: o build sai da maquina (instalador publicado via
// publish-release.mjs), mas o CODIGO que gerou aquele build ficava so no disco
// local — o repo jovemegidio/Ultrafoot26 envelhecia e nao dava para saber qual
// fonte correspondia a qual versao instalada nos jogadores.
//
// O que faz: git add -A, commit "chore: sync build v<versao>" (se houver mudanca)
// e push para origin main. Roda automaticamente apos `npm run tauri:build` (hook
// posttauri:build no package.json) e pode ser chamado a mao:
//
//   node scripts/sync-repo.mjs
//   node scripts/sync-repo.mjs --force   (sobrescreve o main remoto — so use se
//                                         souber que o remoto diverge de proposito)

import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execFile)
const FORCE = process.argv.includes("--force")

const git = async (...args) => {
  const { stdout } = await exec("git", args, { maxBuffer: 64 * 1024 * 1024 })
  return stdout.trim()
}

async function main() {
  // O build de RELEASE nao roda no repositorio: o projeto e copiado para
  // C:\Ultrafoot (o Google Drive nao suporta symlink nem npm install confiavel)
  // e la NAO existe .git. Sem esta checagem, o hook posttauri:build morria com
  // "not a git repository" e o `tauri build` inteiro saia com codigo 1 — o
  // instalador e a assinatura JA estavam prontos, mas toda build era reportada
  // como falha. Custou umas dez investigacoes de falha que nao existia.
  //
  // Sincronizar o repo e util, mas e ACESSORIO ao build: nao pode reprova-lo.
  if (!existsSync(".git")) {
    console.log("sem .git aqui (build fora do repositorio) — sincronizacao dispensada")
    return
  }

  const conf = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"))
  const version = conf.version

  await git("add", "-A")

  const staged = await git("status", "--porcelain")
  if (staged) {
    await git("commit", "-m", `chore: sync build v${version}`)
    console.log(`commit criado: chore: sync build v${version}`)
  } else {
    console.log("nada novo para commitar; enviando o que ja existe")
  }

  const pushArgs = ["push", "origin", "HEAD:main"]
  if (FORCE) pushArgs.push("--force")

  try {
    await exec("git", pushArgs)
    console.log(`repo atualizado: https://github.com/jovemegidio/Ultrafoot26 (main)`)
  } catch (err) {
    // Idem: rede caindo nao pode reprovar um instalador que ficou pronto. O
    // commit local esta feito e o push pode ser refeito a mao a qualquer hora.
    console.error("push para origin main falhou (o build NAO foi afetado):")
    console.error(err.stderr ?? err.message)
    console.error("\nRefaca quando a rede voltar:  node scripts/sync-repo.mjs")
    console.error("Se o remoto divergiu de proposito:  node scripts/sync-repo.mjs --force")
  }
}

main().catch((err) => {
  // Nada aqui e essencial ao build. Reportar e sair limpo.
  console.error("sincronizacao do repo falhou (o build NAO foi afetado):")
  console.error(err.stderr ?? err.message ?? err)
})
