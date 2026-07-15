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
 * Chave do CLUBE — tira os prefixos/sufixos societarios antes de comparar.
 *
 * Sem isto o import falha EM SILENCIO: a planilha diz "FC Barcelona" e o jogo diz
 * "Barcelona"; normalizados viram "fcbarcelona" != "barcelona", nao casam, e o clube
 * simplesmente nao recebe o elenco real — sem nenhum erro aparecer.
 * Mesmo caso de "Olympique de Marseille" x "Olympique Marseille", "AC Milan" x "Milan",
 * "Villarreal CF" x "Villarreal", "AFC Bournemouth" x "Bournemouth".
 *
 * IMPORTANTE: precisa ser identico ao clubKey() de lib/players-data.ts.
 */
/**
 * Aliases de clube: nome NA PLANILHA -> nome COMO ESTA NO JOGO.
 *
 * A planilha e o jogo escrevem alguns clubes diferente (idioma ou prefixo societario que o
 * clubKey nao remove): "Bayern Munich" x "Bayern München", "VfL Bochum" x "Bochum",
 * "1. FC Nürnberg" x "FC Nürnberg". Sem casar, o clube NAO recebe o elenco (falha silenciosa).
 * Chave = norm(nome da planilha); valor = nome do jogo (passa pelo clubKey normal depois).
 */
const CLUB_NAME_ALIAS = {
  // Alemanha (Bundesliga 1 e 2)
  bayernmunich: "Bayern München",
  hamburgersv: "Hamburgo SV",
  scpaderborn: "Paderborn 07",
  tsghoffenheim: "Hoffenheim",
  "1fcheidenheim": "Heidenheim",
  "1fckaiserslautern": "Kaiserslautern",
  "1fcmagdeburg": "Magdeburg",
  "1fcnurnberg": "FC Nürnberg",
  herthabsc: "Hertha Berlin",
  vflbochum: "Bochum",
  vflosnabruck: "Osnabrück",
  vflwolfsburg: "Wolfsburg",
}

function clubKey(s) {
  const alias = CLUB_NAME_ALIAS[norm(s)]
  if (alias) s = alias
  return norm(s)
    // Prefixos societarios ("FC Barcelona" -> "barcelona", "AC Milan" -> "milan").
    .replace(/^(fc|cf|ac|as|rc|sc|ss|afc|rcd|ud|cd|sv|ogc|losc|stade)/, "")
    // Sufixos ("Villarreal CF" -> "villarreal", "Genoa CFC" -> "genoa").
    .replace(/(fc|cf|cfc|ac|sc|afc|club)$/, "")
    // "Olympique DE Marseille" -> "olympiquemarseille" (o jogo escreve sem o "de").
    .replace(/^olympiquede/, "olympique")
}

/**
 * Posicao em PT-BR -> codigo do jogo.
 * Compostas ("Zagueiro / lateral direito") usam a PRIMEIRA, que e a principal.
 */
const POSITION_MAP = [
  // ── Goleiro ──────────────────────────────────────────────────────────────
  [/goleiro|goalkeeper|keeper/, "GOL"],

  // ── Laterais (antes dos zagueiros: "Right-Back" tem "back", nao "centre") ──
  [/lateral\s*direit|right.?back|right\s*wing.?back/, "LD"],
  [/lateral\s*esquerd|left.?back|left\s*wing.?back/, "LE"],

  // ── Zaga ─────────────────────────────────────────────────────────────────
  [/zagueiro|zaga|centre.?back|center.?back|sweeper/, "ZAG"],

  // ── Volante (antes do meio generico: "Defensive Midfield" tem "midfield") ──
  [/volante|defensive\s*midfield|meio-?campo\s*defensivo/, "VOL"],

  // ── Pontas (antes do ataque: "Right Winger" nao pode virar ATA) ───────────
  [/ponta\s*direita|extremo\s*direit|right\s*winger/, "PD"],
  [/ponta\s*esquerda|extremo\s*esquerd|left\s*winger/, "PE"],

  // ── Ataque ───────────────────────────────────────────────────────────────
  [/centroavante|centro-?avante|centre.?forward|center.?forward|second\s*striker|striker|atacante/, "ATA"],

  // ── Meio-campo (por ultimo: e o balde mais generico) ─────────────────────
  [/meia|meio-?campo|meio-?campista|midfield/, "MEI"],

  // "Defensor" generico (Serie B/C) — sem lado definido, vira zagueiro.
  [/defensor|defender/, "ZAG"],
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
  // Buracos na FONTE (linhas que a planilha marcou como pendentes de coleta).
  const pendingByFile = new Map()

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
    // Titular vs reserva — vira a ordem do elenco. Cada planilha chama a coluna de um
    // jeito: "grupo", "grupo_elenco", "status", "status_estimado". E o valor tanto pode
    // ser "Titular provavel" quanto "titular_provavel".
    const idxGroup = header.findIndex(h =>
      h === "grupo" || h === "grupoelenco" || h === "status" || h === "statusestimado",
    )

    if (idxClub < 0 || idxName < 0 || idxPos < 0) {
      console.log(`  ! ${file}: colunas nao reconhecidas (clube/jogador/posicao) — pulado`)
      continue
    }

    let fileMapped = 0
    let filePending = 0   // linhas de placeholder (coleta nao concluida)
    let fileNoPos = 0     // tem jogador, mas ficou sem posicao

    for (const r of rows.slice(1)) {
      const club = (r[idxClub] ?? "").trim()
      const name = (r[idxName] ?? "").trim()
      const rawPos = (r[idxPos] ?? "").trim()
      if (!club || !name) continue

      // Linhas que a planilha marcou como pendentes NAO sao jogadores — sao espaco
      // reservado. Contamos separado para o buraco na fonte ficar VISIVEL, em vez de
      // sumir em silencio e dar a impressao de que o clube tem elenco completo.
      if (/^pendente/i.test(name) || /^pendente/i.test(rawPos)) {
        filePending++
        continue
      }

      totalRows++

      const pos = toPos(rawPos)
      if (!pos) {
        if (rawPos) unmappedPositions.set(rawPos, (unmappedPositions.get(rawPos) ?? 0) + 1)
        else fileNoPos++
        continue
      }

      const grupo = idxGroup >= 0 ? (r[idxGroup] ?? "") : ""
      const titular = /titular/i.test(grupo)

      // clubKey (nao norm): "FC Barcelona" e "Barcelona" precisam cair na MESMA chave,
      // senao o jogo nao acha o elenco e o import falha em silencio.
      const ck = clubKey(club)
      if (!byClub[ck]) { byClub[ck] = []; clubLabel[ck] = club }
      // Evita duplicata do mesmo jogador.
      if (byClub[ck].some(p => norm(p.nome) === norm(name))) continue
      byClub[ck].push({ nome: name, pos, titular })
      mapped++
      fileMapped++
    }
    const gaps = []
    if (filePending) gaps.push(`${filePending} PENDENTE_COLETA`)
    if (fileNoPos) gaps.push(`${fileNoPos} sem posicao`)
    console.log(
      `  ${file}: ${fileMapped} jogadores` +
      (gaps.length ? `  [BURACO NA FONTE: ${gaps.join(", ")}]` : ""),
    )
    if (filePending) pendingByFile.set(file, filePending)
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

  // O buraco esta na FONTE, nao no importador — precisa ficar gritante, senao alguem
  // acha que a liga foi importada inteira quando na verdade veio pela metade.
  if (pendingByFile.size) {
    const totalPending = [...pendingByFile.values()].reduce((a, b) => a + b, 0)
    console.log(`\n!! ${totalPending} linhas marcadas PENDENTE_COLETA na planilha:`)
    for (const [file, n] of pendingByFile) console.log(`   ${n.toString().padStart(4)}  ${file}`)
    console.log(`   Esses jogadores NAO existem na fonte — o clube entra no jogo com o`)
    console.log(`   elenco incompleto. Complete a coleta e rode este script de novo.`)
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
