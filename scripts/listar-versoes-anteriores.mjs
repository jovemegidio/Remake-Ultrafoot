// MONTA A LISTA DE VERSÕES ÀS QUAIS DÁ PARA VOLTAR.
//
// O launcher JÁ SABE fazer isso: `versoes_anteriores()` (Launcher/src-tauri) lê
// o campo `anteriores` do `latest.json` e devolve versão, url e notas. O comando
// existe desde a 1.0.2x e **nunca funcionou**, porque nada nunca escreveu esse
// campo — nem a tela do launcher chegou a chamá-lo. É o padrão recorrente deste
// projeto: a peça está pronta e desligada dos dois lados.
//
// Este script fecha o lado de cima: pergunta ao GitHub quais releases `build-*`
// têm instalador publicado e devolve a lista pronta para entrar no manifesto.
//
//   node scripts/listar-versoes-anteriores.mjs [--limite 12]
//
// Saída: JSON no stdout. O deploy consome; rodando à mão dá para conferir.

import { execFileSync } from "node:child_process"

const argLimite = process.argv.indexOf("--limite")
const LIMITE = argLimite >= 0 ? Number(process.argv[argLimite + 1]) : 12
const REPO = "jovemegidio/Ultrafoot26"

/** Peso numérico de "1.0.294" para ordenar sem depender da data do release. */
function peso(versao) {
  const [a = 0, b = 0, c = 0] = String(versao).split(".").map(Number)
  return a * 1_000_000 + b * 1_000 + c
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 })
}

const releases = JSON.parse(gh([
  "release", "list", "--repo", REPO, "--limit", "200", "--json", "tagName,name,isDraft",
]))

const candidatas = releases
  .filter(r => !r.isDraft && /^build-\d+\.\d+\.\d+$/.test(r.tagName))
  .map(r => ({ tag: r.tagName, versao: r.tagName.replace("build-", ""), nome: r.name }))
  .sort((a, b) => peso(b.versao) - peso(a.versao))

const anteriores = []
for (const c of candidatas) {
  if (anteriores.length >= LIMITE) break
  let assets
  try {
    assets = JSON.parse(gh(["release", "view", c.tag, "--repo", REPO, "--json", "assets"])).assets ?? []
  } catch {
    continue
  }
  // ⚠️ SÓ ENTRA QUEM TEM INSTALADOR **E** ASSINATURA. Oferecer uma versão cujo
  // `.sig` não subiu é oferecer um download que o jogador baixa (753 MB) e o
  // instalador recusa no fim — pior do que não oferecer.
  const exe = assets.find(a => /_x64-setup\.exe$/i.test(a.name))
  const sig = assets.find(a => /_x64-setup\.exe\.sig$/i.test(a.name))
  if (!exe || !sig) continue

  anteriores.push({
    version: c.versao,
    url: `https://github.com/${REPO}/releases/download/${c.tag}/${exe.name}`,
    notes: c.nome || `Ultrafoot 26 v${c.versao}`,
    sizeMb: Math.round(exe.size / 1024 / 1024),
  })
}

process.stdout.write(`${JSON.stringify(anteriores, null, 2)}\n`)
process.stderr.write(`versoes com instalador e assinatura: ${anteriores.length} de ${candidatas.length} tags\n`)
