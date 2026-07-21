// Assa os dados do Transfermarkt (tm-squads.json) dentro do seed principal.
//
// Por que assar no seed em vez de consultar em runtime: o seed já é a fonte de
// verdade de TODA tela (elenco, mercado, partida, olheiros). Corrigindo lá, as
// telas herdam a posição e a nacionalidade certas sem nenhuma delas precisar
// saber que o Transfermarkt existe — e sem carregar um segundo JSON no bundle.
//
//   node scripts/import-tm-squads.mjs   (baixa; ~2h, retomável)
//   node scripts/apply-tm-squads.mjs    (aplica; segundos)
//
// Idempotente: rodar duas vezes dá o mesmo resultado.

import { readFile, writeFile, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const SEED = path.resolve("data/seeds/imported-bf2026.json")
const TM = path.resolve("data/seeds/tm-squads.json")
const BACKUP = path.resolve("data/seeds/imported-bf2026.pre-tm.json")

const nameKey = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/**
 * Só sobrescreve quando o casamento é confiável. Nome idêntico dentro do MESMO
 * clube é forte; nome parcial ("R. Gaúcho" x "Ronaldinho Gaúcho") é fraco e por
 * isso exige que o sobrenome bata inteiro, senão preferimos manter o que havia.
 */
function buildIndex(players) {
  const exato = new Map()
  const porSobrenome = new Map()
  for (const p of players) {
    const k = nameKey(p.nome)
    if (!k) continue
    if (!exato.has(k)) exato.set(k, p)
    const sob = k.split(" ").slice(-1)[0]
    if (sob.length >= 4) {
      // Sobrenome ambíguo dentro do elenco não serve para casar ninguém.
      porSobrenome.set(sob, porSobrenome.has(sob) ? null : p)
    }
  }
  return { exato, porSobrenome }
}

function match(nome, idx) {
  const k = nameKey(nome)
  const hit = idx.exato.get(k)
  if (hit) return hit
  const sob = k.split(" ").slice(-1)[0]
  if (sob.length >= 4) {
    const bySob = idx.porSobrenome.get(sob)
    if (bySob) return bySob
  }
  return null
}

async function main() {
  if (!existsSync(TM)) {
    console.error("Falta data/seeds/tm-squads.json — rode antes: node scripts/import-tm-squads.mjs")
    process.exit(1)
  }
  const tm = JSON.parse(await readFile(TM, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8"))

  if (!existsSync(BACKUP)) await copyFile(SEED, BACKUP)

  let clubesComDados = 0, atletas = 0, posCorrigida = 0, nacDefinida = 0, semMatch = 0
  const mudancasPos = []

  for (const team of seed.teams ?? []) {
    const club = tm.clubs?.[team.curto]
    if (!club?.players?.length) continue
    clubesComDados++
    const idx = buildIndex(club.players)

    for (const jog of team.jogadores ?? []) {
      atletas++
      const real = match(jog.nome, idx)
      if (!real) { semMatch++; continue }

      if (real.posicao && real.posicao !== jog.posicao) {
        mudancasPos.push(`${team.curto} ${jog.nome}: ${jog.posicao} -> ${real.posicao}`)
        jog.posicao = real.posicao
        posCorrigida++
      }
      if (real.nacionalidade && jog.nac !== real.nacionalidade) {
        jog.nac = real.nacionalidade
        nacDefinida++
      }
    }
  }

  seed.tmAppliedAt = new Date().toISOString()
  await writeFile(SEED, JSON.stringify(seed))

  console.log(`clubes com dados do TM : ${clubesComDados}`)
  console.log(`atletas nesses clubes  : ${atletas}`)
  console.log(`  posição corrigida    : ${posCorrigida}`)
  console.log(`  nacionalidade real   : ${nacDefinida}`)
  console.log(`  sem correspondência  : ${semMatch} (mantêm o que já tinham)`)
  console.log(`\nbackup do original: ${path.basename(BACKUP)}`)
  console.log(`\namostra de correções de posição:`)
  for (const m of mudancasPos.slice(0, 25)) console.log("  " + m)
}

main()
