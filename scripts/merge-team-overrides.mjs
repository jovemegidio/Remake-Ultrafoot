// Funde as edicoes de clube exportadas do editor no seed que VIAJA COM O BUILD.
//
// Problema que isto resolve: o editor de clubes gravava as edicoes (escudo, uniforme,
// cores, nome) no persistent-store — o save LOCAL. Ou seja, ficavam so na maquina de quem
// editou e NUNCA chegavam aos outros jogadores.
//
// Agora ha um seed embutido (data/seeds/team-overrides.json). Este script pega o arquivo
// que voce exportou pelo editor e funde nele. O proximo build ja sai com as edicoes, e
// todo jogador que instalar recebe seus escudos e uniformes.
//
// Uso:
//   node scripts/merge-team-overrides.mjs <arquivo-exportado.json>
//   node scripts/merge-team-overrides.mjs --list     (so mostra o que ja esta no seed)

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const SEED = path.resolve("data/seeds/team-overrides.json")

const arg = process.argv[2]

async function readSeed() {
  try {
    return JSON.parse(await readFile(SEED, "utf8"))
  } catch {
    return {}
  }
}

/** Peso aproximado de um data URL, so para avisar sobre o tamanho do build. */
function weight(o) {
  let bytes = 0
  const add = (s) => { if (typeof s === "string" && s.startsWith("data:")) bytes += s.length * 0.75 }
  add(o?.escudoUrl)
  add(o?.logoUrl)
  for (const k of ["home", "away", "third"]) add(o?.kits?.[k]?.imageUrl)
  return bytes
}

const mb = (b) => (b / 1048576).toFixed(2)

async function main() {
  const seed = await readSeed()

  if (!arg || arg === "--list") {
    const keys = Object.keys(seed)
    console.log(`seed atual: ${keys.length} clube(s) com edicao embutida`)
    let total = 0
    for (const k of keys) {
      const w = weight(seed[k])
      total += w
      const parts = []
      if (seed[k].nome) parts.push("nome")
      if (seed[k].cor1 || seed[k].cor2) parts.push("cores")
      if (seed[k].kits) parts.push(`kits(${Object.keys(seed[k].kits).join(",")})`)
      console.log(`  ${k.padEnd(20)} ${parts.join(" ") || "-"}  ${w ? mb(w) + " MB" : ""}`)
    }
    if (total) console.log(`\npeso das imagens embutidas: ${mb(total)} MB`)
    if (!arg) console.log(`\nPara fundir: node scripts/merge-team-overrides.mjs <exportado.json>`)
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
    console.error("ERRO: o arquivo exportado deve ser um objeto { file_key: edicao }")
    process.exit(1)
  }

  let added = 0
  let updated = 0
  let totalWeight = 0

  for (const [fileKey, override] of Object.entries(incoming)) {
    if (!fileKey || typeof override !== "object") continue
    const exists = Boolean(seed[fileKey])
    // Merge: preserva o que ja havia e sobrescreve o que veio.
    seed[fileKey] = {
      ...(seed[fileKey] ?? {}),
      ...override,
      kits: { ...(seed[fileKey]?.kits ?? {}), ...(override.kits ?? {}) },
    }
    if (exists) updated++
    else added++
    totalWeight += weight(seed[fileKey])
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2), "utf8")

  console.log(`clubes novos:      ${added}`)
  console.log(`clubes atualizados: ${updated}`)
  console.log(`total no seed:     ${Object.keys(seed).length}`)
  console.log(`peso das imagens:  ${mb(totalWeight)} MB`)
  // Obrigatorio: o editor exporta as imagens como data URI, e deixa-las dentro do
  // JSON faz o modulo ser importado inteiro por components/team-crest.tsx — que
  // aparece em quase toda tela. Ja custou 20 MB de JSON parseado por navegacao.
  // Extrair para public/ deixa o navegador buscar so o escudo que a tela usa.
  console.log(`\nextraindo imagens para public/overrides...`)
  const { execFileSync } = await import("node:child_process")
  execFileSync(process.execPath, ["scripts/split-override-assets.mjs"], { stdio: "inherit" })

  console.log(`\nOK — edicoes gravadas em data/seeds/team-overrides.json`)
  console.log(`O PROXIMO BUILD ja sai com elas: todo jogador recebe seus escudos/uniformes.`)
}

main()
