// Publica o build atual como RELEASE do GitHub — e e isso que faz o auto-update chegar
// aos jogadores.
//
// O PROBLEMA que isto resolve: o jogo consulta
//   https://github.com/<repo>/releases/latest/download/latest.json
// para saber se ha versao nova. O build local gera o setup.exe e o .sig, mas NINGUEM
// gerava o latest.json nem publicava o release. O ultimo release publicado era o 1.0.11:
// tudo de 1.0.12 em diante ficou so na maquina de quem buildou. Os jogadores perguntavam
// "tem versao nova?", o servidor respondia "1.0.11", e o updater concluia que estava tudo
// em dia. Resultado: ninguem recebia correcao nenhuma e a unica saida era reinstalar.
//
// Uso:
//   node scripts/publish-release.mjs                 (gera latest.json e mostra o que fazer)
//   node scripts/publish-release.mjs --publish       (publica de verdade, precisa do gh)
//
// Requer, para publicar: GitHub CLI (`gh`) autenticado — https://cli.github.com

import { readFile, writeFile, access } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"

const exec = promisify(execFile)

const REPO = "jovemegidio/Ultrafoot26"
const BUILD_DIR = "C:/ultrafoot-build/src-tauri/target/release/bundle/nsis"
const PUBLISH = process.argv.includes("--publish")

const exists = async (p) => { try { await access(p); return true } catch { return false } }

async function main() {
  const conf = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"))
  const version = conf.version

  const setupName = `Ultrafoot 26_${version}_x64-setup.exe`
  const setupPath = path.join(BUILD_DIR, setupName)
  const sigPath = `${setupPath}.sig`

  if (!(await exists(setupPath))) {
    console.error(`ERRO: nao achei o instalador da ${version}:\n  ${setupPath}`)
    console.error(`Rode o build antes: npm run tauri:build`)
    process.exit(1)
  }
  if (!(await exists(sigPath))) {
    console.error(`ERRO: nao achei a assinatura:\n  ${sigPath}`)
    console.error(`Assine o instalador antes (tauri signer sign).`)
    process.exit(1)
  }

  const signature = (await readFile(sigPath, "utf8")).trim()

  // O GitHub troca espacos por pontos no nome do asset.
  const assetName = setupName.replace(/ /g, ".")
  const tag = `build-${version}`

  const latest = {
    version,
    notes: process.env.RELEASE_NOTES ?? `Ultrafoot 26 v${version}`,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature,
        url: `https://github.com/${REPO}/releases/download/${tag}/${assetName}`,
      },
    },
  }

  const latestPath = path.join(BUILD_DIR, "latest.json")
  await writeFile(latestPath, JSON.stringify(latest, null, 2), "utf8")

  console.log(`versao:      ${version}`)
  console.log(`instalador:  ${setupName}`)
  console.log(`latest.json: ${latestPath}`)
  console.log(`tag:         ${tag}`)

  if (!PUBLISH) {
    console.log(`\nlatest.json GERADO (nao publicado).`)
    console.log(`Para publicar de verdade:  node scripts/publish-release.mjs --publish`)
    console.log(`(precisa do GitHub CLI autenticado: gh auth login)`)
    return
  }

  // ── Publica ────────────────────────────────────────────────────────────────
  try {
    await exec("gh", ["--version"])
  } catch {
    console.error(`\nERRO: o GitHub CLI (gh) nao esta instalado ou nao esta no PATH.`)
    console.error(`Instale: winget install GitHub.cli   e depois: gh auth login`)
    process.exit(1)
  }

  console.log(`\npublicando release ${tag} em ${REPO}...`)
  try {
    await exec("gh", [
      "release", "create", tag,
      setupPath, sigPath, latestPath,
      "--repo", REPO,
      "--title", `Ultrafoot 26 v${version}`,
      "--notes", latest.notes,
    ])
    console.log(`\nOK — release publicado.`)
  } catch (e) {
    // Ja existe: sobe os assets por cima.
    console.log(`release ja existe; atualizando os assets...`)
    await exec("gh", [
      "release", "upload", tag,
      setupPath, sigPath, latestPath,
      "--repo", REPO, "--clobber",
    ])
    console.log(`\nOK — assets atualizados.`)
  }

  console.log(`\nA partir de agora o auto-update FUNCIONA: quem esta numa versao mais`)
  console.log(`antiga recebe a ${version} sozinho, sem reinstalar.`)
}

main()
