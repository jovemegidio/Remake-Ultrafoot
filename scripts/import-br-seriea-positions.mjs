// Corrige as POSICOES (formacao) dos 20 clubes da Serie A brasileira em
// data/seeds/players_br.json a partir da fonte confiavel: a planilha
// "Elencos - Serie A - Brasileirao.xlsx" (posicoes reais do Transfermarkt).
//
// PROBLEMA que resolve: o players_br.json tinha as posicoes atribuidas por BLOCO
// (4 goleiros seguidos, varios laterais, varios zagueiros, depois meias) e quase
// nenhum atacante entre os primeiros — por isso a formacao saia errada e o modal de
// penalti so oferecia zagueiros. Aqui trocamos a lista de cada clube da Serie A pela
// do XLSX (posicao real + ordem: titulares primeiro), preservando base/idade por NOME
// quando o jogador ja existia (nao mexemos na forca do time, so na posicao). Para quem
// e novo no elenco, estimamos a base pela mediana do clube.
//
// Uso: node scripts/import-br-seriea-positions.mjs

import { readFile, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"

// sheet1.xml ja extraido do XLSX (descompacte antes com `unzip` no Git Bash e passe o
// caminho): node scripts/import-br-seriea-positions.mjs <caminho/sheet1.xml>
const SHEET1 = process.argv[2]
const SEED = "data/seeds/players_br.json"

const norm = (s) =>
  (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "")

// XLSX -> game tokens. Quase 1:1; so "AT" (abreviacao solta) vira ATA.
const POS_MAP = { AT: "ATA" }
const mapPos = (p) => POS_MAP[p] ?? p

// XLSX inline strings ja vem em UTF-8; so troca &amp; etc.
const decode = (s) =>
  (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim()

function parseSheet1(sheetPath) {
  const xml = readFileSync(sheetPath, "utf8")
  const rows = []
  for (const rm of xml.matchAll(/<x:row[^>]*>([\s\S]*?)<\/x:row>/g)) {
    const cells = {}
    for (const cm of rm[1].matchAll(/<x:c r="([A-Z]+)(\d+)"[^>]*>(?:<x:v>([\s\S]*?)<\/x:v>)?<\/x:c>/g)) {
      cells[cm[1]] = cm[3] !== undefined ? cm[3] : ""
    }
    rows.push(cells)
  }
  // A=Clube B=Status C=Posicao D=Jogador E=Camisa F=Ordem
  return rows.slice(1).filter((r) => r.A).map((r) => ({
    clube: decode(r.A), status: r.B, pos: mapPos(r.C), nome: decode(r.D), ordem: Number(r.F) || 999,
  }))
}

async function main() {
  if (!SHEET1) { console.error("Uso: node scripts/import-br-seriea-positions.mjs <sheet1.xml>"); process.exit(1) }
  const rows = parseSheet1(SHEET1)
  const byClub = {}
  for (const r of rows) (byClub[r.clube] = byClub[r.clube] || []).push(r)

  const seed = JSON.parse(await readFile(SEED, "utf8"))
  const seedKeyByNorm = new Map(Object.keys(seed).map((k) => [norm(k), k]))
  // Aliases: nome do XLSX -> chave do seed quando diferem.
  const ALIAS = { vasco: "vascodagama" }
  const resolveKey = (clube) => seedKeyByNorm.get(norm(clube)) ?? seedKeyByNorm.get(ALIAS[norm(clube)] ?? "")

  let clubsUpdated = 0
  const unmatched = []
  const report = []

  for (const [clube, players] of Object.entries(byClub)) {
    const seedKey = resolveKey(clube)
    if (!seedKey) { unmatched.push(clube); continue }

    // Base/idade antigas por nome, para preservar a forca do time.
    const old = seed[seedKey] || []
    const oldByName = new Map(old.map((p) => [norm(p.nome), p]))
    const matchedBases = players.map((p) => oldByName.get(norm(p.nome))?.base).filter((b) => typeof b === "number")
    const median = matchedBases.length
      ? matchedBases.slice().sort((a, b) => a - b)[Math.floor(matchedBases.length / 2)]
      : 68

    // Ordena: titulares primeiro, depois pela ordem do elenco.
    players.sort((a, b) => {
      const ta = a.status === "Titular" ? 0 : 1
      const tb = b.status === "Titular" ? 0 : 1
      return ta - tb || a.ordem - b.ordem
    })

    const rebuilt = players.map((p, i) => {
      const o = oldByName.get(norm(p.nome))
      const estBase = Math.max(52, Math.round(median - Math.floor(i / 6)))
      return {
        nome: p.nome,
        pos: p.pos,
        idade: o?.idade ?? 25,
        base: o?.base ?? estBase,
      }
    })

    seed[seedKey] = rebuilt
    clubsUpdated++
    const ata = rebuilt.filter((p) => /ATA|PD|PE|SA|CA/.test(p.pos)).length
    report.push(`${seedKey}: ${rebuilt.length} jog, ${ata} ATA`)
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2) + "\n", "utf8")

  console.log(`clubes atualizados: ${clubsUpdated}/20`)
  report.forEach((r) => console.log("  " + r))
  if (unmatched.length) console.log("NAO casaram (revisar):", unmatched.join(", "))
}

main().catch((e) => { console.error(e); process.exit(1) })
