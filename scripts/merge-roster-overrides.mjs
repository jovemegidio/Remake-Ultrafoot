// Funde os ELENCOS EDITADOS exportados do editor no seed que viaja com o build.
//
// Irmao de merge-team-overrides.mjs, e pelo mesmo motivo: criar, excluir e
// transferir atletas (lib/roster-overrides) grava no persistent-store, ou seja,
// so na maquina de quem editou. Este script embute as edicoes em
// data/seeds/roster-overrides.json, e a partir do proximo build todo mundo que
// instalar recebe o mesmo elenco.
//
// Uso:
//   node scripts/merge-roster-overrides.mjs <arquivo-exportado.json>
//   node scripts/merge-roster-overrides.mjs --list

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const SEED = path.resolve("data/seeds/roster-overrides.json")
const arg = process.argv[2]

const norm = (nome) =>
  (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

async function readSeed() {
  try {
    return JSON.parse(await readFile(SEED, "utf8"))
  } catch {
    return {}
  }
}

const resumo = (patch) => {
  const criados = patch?.criados?.length ?? 0
  const removidos = patch?.removidos?.length ?? 0
  return `${criados > 0 ? `+${criados}` : "  "} ${removidos > 0 ? `-${removidos}` : ""}`.trim() || "-"
}

async function main() {
  const seed = await readSeed()

  if (!arg || arg === "--list") {
    const keys = Object.keys(seed)
    console.log(`seed atual: ${keys.length} clube(s) com elenco editado`)
    for (const k of keys) console.log(`  ${k.padEnd(24)} ${resumo(seed[k])}`)
    if (!arg) console.log(`\nPara fundir: node scripts/merge-roster-overrides.mjs <exportado.json>`)
    return
  }

  let incoming
  try {
    incoming = JSON.parse(await readFile(path.resolve(arg), "utf8"))
  } catch (e) {
    console.error(`ERRO ao ler "${arg}": ${e.message}`)
    process.exit(1)
  }
  if (typeof incoming !== "object" || Array.isArray(incoming)) {
    console.error("ERRO: o arquivo exportado deve ser um objeto { file_key: patch }")
    process.exit(1)
  }

  let novos = 0
  let atualizados = 0

  for (const [fileKey, patch] of Object.entries(incoming)) {
    if (!fileKey || typeof patch !== "object" || patch === null) continue
    const antes = seed[fileKey]
    // Uniao das duas camadas, com a mesma regra do runtime: a remocao vence a
    // criacao do mesmo nome, senao o atleta "removido" reapareceria no build.
    const removidos = [...new Set([...(antes?.removidos ?? []), ...(patch.removidos ?? [])])]
    const fora = new Set(removidos)
    const porNome = new Map()
    for (const a of [...(antes?.criados ?? []), ...(patch.criados ?? [])]) {
      if (!a?.nome || fora.has(norm(a.nome))) continue
      porNome.set(norm(a.nome), a) // o que vem depois (a exportacao nova) vence
    }
    const junto = { criados: [...porNome.values()], removidos }
    if (junto.criados.length === 0 && junto.removidos.length === 0) {
      delete seed[fileKey]
      continue
    }
    seed[fileKey] = junto
    if (antes) atualizados++
    else novos++
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2), "utf8")

  const totalCriados = Object.values(seed).reduce((n, p) => n + (p.criados?.length ?? 0), 0)
  const totalRemovidos = Object.values(seed).reduce((n, p) => n + (p.removidos?.length ?? 0), 0)
  console.log(`clubes novos:       ${novos}`)
  console.log(`clubes atualizados: ${atualizados}`)
  console.log(`total no seed:      ${Object.keys(seed).length} clube(s)`)
  console.log(`atletas criados:    ${totalCriados}`)
  console.log(`atletas removidos:  ${totalRemovidos}`)
  console.log(`\nOK — gravado em data/seeds/roster-overrides.json. O PROXIMO BUILD ja sai com isto.`)
}

main()
