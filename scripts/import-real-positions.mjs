// Importa POSICOES REAIS de jogadores a partir dos CSVs de elenco.
//
// Problema que isto resolve: o seed `imported-bf2026.json` atribui posicao por INDICE do
// array (o 1o vira GOL, os 4 seguintes DEF, etc). Por isso Nick Pope e Aaron Ramsdale
// (goleiros do Newcastle) apareciam como ZAGUEIROS, e Trippier (lateral) como meia.
//
// Aqui lemos os CSVs (dado factual: quem joga em que posicao) e produzimos um OVERLAY
// que o players-data aplica por cima do seed. Nao inventamos nada: se um jogador nao
// esta no CSV, a posicao dele fica como estava.
//
// Uso: node scripts/import-real-positions.mjs

import { readFile, writeFile, readdir } from "node:fs/promises"
import path from "node:path"

const SRC_DIR = path.resolve("Nova pasta/Elencos")
const OUT = path.resolve("data/seeds/real-positions.json")

/** Normaliza nome (clube ou jogador) para casar entre fontes diferentes. */
function norm(s) {
  return (s ?? "")
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Posicao em PT-BR -> codigo do jogo.
 * Compostas ("Zagueiro / lateral direito") usam a PRIMEIRA, que e a principal.
 */
const POSITION_MAP = [
  [/goleiro|goalkeeper/, "GOL"],
  [/lateral\s*direit/, "LD"],
  [/lateral\s*esquerd/, "LE"],
  [/zagueiro|defensor\s*central|zaga/, "ZAG"],
  [/volante|primeiro\s*volante|meio-?campo\s*defensivo/, "VOL"],
  [/ponta\s*direita|extremo\s*direit/, "PD"],
  [/ponta\s*esquerda|extremo\s*esquerd/, "PE"],
  [/centroavante|atacante|centro-?avante/, "ATA"],
  [/meia-?atacante|meio-?campo\s*ofensivo/, "MEI"],
  [/meia|meio-?campo|meio-?campista/, "MEI"],
  // "Defensor" generico (Serie B/C) — sem lado definido, vira zagueiro.
  [/defensor/, "ZAG"],
]

function toPos(raw) {
  if (!raw) return null
  // Composta: fica com a primeira parte.
  const first = String(raw).split("/")[0].trim().toLowerCase()
  if (!first || first === "unknown") return null
  for (const [re, code] of POSITION_MAP) {
    if (re.test(first)) return code
  }
  return null
}

/** Parser de CSV que respeita aspas (os campos de observacao tem virgula/;). */
function parseCsv(text, sep) {
  const rows = []
  let field = ""
  let row = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === sep) {
      row.push(field); field = ""
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = ""
    } else if (c !== "\r") {
      field += c
    }
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim() !== ""))
}

/** Detecta o separador olhando o cabecalho. */
function detectSep(headerLine) {
  return (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ";" : ","
}

async function main() {
  let files
  try {
    files = (await readdir(SRC_DIR)).filter(f => f.toLowerCase().endsWith(".csv"))
  } catch {
    console.error(`ERRO: nao achei ${SRC_DIR}`)
    process.exit(1)
  }

  // clube -> [{ nome, pos, titular }]  (ORDEM do CSV = ordem do elenco)
  const byClub = {}
  const clubLabel = {}
  let totalRows = 0
  let mapped = 0
  const unmappedPositions = new Map()

  for (const file of files) {
    const text = await readFile(path.join(SRC_DIR, file), "utf8")
    const firstLine = text.slice(0, text.indexOf("\n"))
    const sep = detectSep(firstLine)
    const rows = parseCsv(text, sep)
    if (rows.length < 2) continue

    const header = rows[0].map(h => norm(h))
    // Os dois CSVs tem nomes de coluna diferentes — achamos por sinonimo.
    const idxClub = header.findIndex(h => h === "clube")
    const idxName = header.findIndex(h => h === "jogador" || h === "nomejogador")
    const idxPos = header.findIndex(h => h === "posicao" || h === "posicaogrupo")
    // "Titular provavel" / "Titular" vs reserva — vira a ordem do elenco.
    const idxGroup = header.findIndex(h => h === "grupo" || h === "grupoelenco")

    if (idxClub < 0 || idxName < 0 || idxPos < 0) {
      console.log(`  ! ${file}: colunas nao reconhecidas (clube/jogador/posicao) — pulado`)
      continue
    }

    let fileMapped = 0
    for (const r of rows.slice(1)) {
      const club = (r[idxClub] ?? "").trim()
      const name = (r[idxName] ?? "").trim()
      const rawPos = (r[idxPos] ?? "").trim()
      if (!club || !name) continue
      totalRows++

      const pos = toPos(rawPos)
      if (!pos) {
        if (rawPos) unmappedPositions.set(rawPos, (unmappedPositions.get(rawPos) ?? 0) + 1)
        continue
      }

      const grupo = idxGroup >= 0 ? (r[idxGroup] ?? "") : ""
      const titular = /titular/i.test(grupo)

      const ck = norm(club)
      if (!byClub[ck]) { byClub[ck] = []; clubLabel[ck] = club }
      // Evita duplicata do mesmo jogador.
      if (byClub[ck].some(p => norm(p.nome) === norm(name))) continue
      byClub[ck].push({ nome: name, pos, titular })
      mapped++
      fileMapped++
    }
    console.log(`  ${file}: ${fileMapped} jogadores`)
  }

  // Titulares primeiro, mantendo a ordem original dentro de cada grupo.
  for (const ck of Object.keys(byClub)) {
    const list = byClub[ck]
    byClub[ck] = [...list.filter(p => p.titular), ...list.filter(p => !p.titular)]
  }

  await writeFile(OUT, JSON.stringify(byClub, null, 2), "utf8")

  console.log("\n─────────────────────────────────────────")
  console.log(`clubes:     ${Object.keys(byClub).length}`)
  console.log(`jogadores:  ${mapped} (de ${totalRows} linhas)`)
  console.log(`saida:      data/seeds/real-positions.json`)

  if (unmappedPositions.size) {
    console.log(`\nPOSICOES NAO MAPEADAS (ficam como estavam):`)
    for (const [p, n] of [...unmappedPositions].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${n}x  "${p}"`)
    }
  }

  // Sanidade: todo clube precisa de ao menos 1 goleiro e 10 de linha.
  let semGol = 0
  for (const [ck, list] of Object.entries(byClub)) {
    const gks = list.filter(p => p.pos === "GOL").length
    if (gks === 0 || list.length - gks < 10) {
      semGol++
      console.log(`  ! ${clubLabel[ck]}: ${gks} GOL, ${list.length} jogadores — elenco fraco`)
    }
  }
  if (semGol === 0) console.log("\nOK — todo clube tem goleiro e ao menos 10 de linha")

  const nw = byClub[norm("Newcastle United")]
  if (nw) {
    const pope = nw.find(p => norm(p.nome) === norm("Nick Pope"))
    console.log(`CHECK Newcastle: ${nw.length} jogadores | Nick Pope -> ${pope?.pos ?? "(nao achado)"}`)
  }
}

main()
