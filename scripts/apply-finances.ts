// Aplica a estabilidade financeira REAL dos clubes brasileiros no `saldo` (caixa) do jogo.
//
// Fonte: estab.xlsx (156 clubes A/B/C/D) com Receita/Custo/Divida 2025 e "Nota final" (0-100).
// O jogo nao tem conceito de divida/receita — so `saldo`. Entao traduzimos a saude financeira
// para o caixa: clube forte e pouco endividado comeca com mais dinheiro; clube de risco (muita
// divida) comeca com pouco. Editamos a fonte (teams-data.ts) ancorando no file_key.
//
// Uso: npx tsx scripts/apply-finances.ts [--apply]

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import * as XLSX from "xlsx"
import { allTeams } from "../lib/teams-data"

const APPLY = process.argv.includes("--apply")
const XLSX_PATH = path.resolve("estab.xlsx")
const TEAMS_FILE = path.resolve("lib/teams-data.ts")

function norm(s: string) { return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") }
function clubKey(s: string) { return norm(s).replace(/^(fc|cf|ac|as|rc|sc|ss|afc|rcd|ud|cd|sv|ogc|losc|stade)/, "").replace(/(fc|cf|cfc|ac|sc|afc|club)$/, "").replace(/^olympiquede/, "olympique") }
const num = (v: unknown) => { const n = typeof v === "number" ? v : parseFloat(String(v)); return Number.isFinite(n) ? n : 0 }

const SERIE_BASE: Record<string, number> = { "Série A": 25e6, "Série B": 10e6, "Série C": 4e6, "Série D": 1.5e6 }
// Teto e piso por serie: mantem a saude financeira relativa SEM estourar o balanceamento
// (Flamengo real tem ~1 bi de superavit — vira caixa demais; e um clube de Serie A em crise
// nao pode cair ao nivel de um clube da Serie D).
const CAP = 250e6
const FLOOR: Record<string, number> = { "Série A": 10e6, "Série B": 4e6, "Série C": 2e6, "Série D": 1e6 }
// Clubes cujo nome no xlsx difere do jogo (chave csv -> chave do jogo).
const FIN_ALIAS: Record<string, string> = { vasco: "vascodagama", bragantino: "rbbragantino" }

/** Caixa inicial a partir da saude financeira real. */
function computeSaldo(row: Record<string, unknown>): number {
  const receita = num(row["Receita 2025 (R$ mi)"])
  const custo = num(row["Custo futebol 2025 (R$ mi)"])
  const divida = num(row["Dívida 2025 (R$ mi)"])
  const nota = num(row["Nota final"]) || 60
  const serie = String(row["Série"])
  let base: number
  if (receita > 0) {
    // Superavit anual (receita-custo) menos um peso da divida (5%): reflete folga real.
    base = (receita - custo) * 1e6 - divida * 0.05 * 1e6
  } else {
    // Sem financeiro real (nota proxy): base por serie escalada pela nota.
    base = (SERIE_BASE[serie] ?? 3e6) * (nota / 65)
  }
  const floor = FLOOR[serie] ?? 1.5e6
  return Math.min(CAP, Math.max(floor, Math.round(base / 1e5) * 1e5))
}

async function main() {
  const wb = XLSX.readFile(XLSX_PATH)
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Base_Clubes"], { defval: "" })

  const gameByKey = new Map<string, { nome: string; file_key: string; saldo: number }>()
  for (const t of allTeams) {
    if ((t as unknown as { pais?: string }).pais && (t as unknown as { pais?: string }).pais !== "Brasil") {
      // so brasileiros (o xlsx e do Brasil); mas teams-data brasileiros nao tem pais setado
    }
    const k = clubKey(t.nome)
    if (!gameByKey.has(k)) gameByKey.set(k, { nome: t.nome, file_key: t.file_key, saldo: t.saldo })
  }

  const updates: { file_key: string; nome: string; old: number; neu: number; cls: string }[] = []
  const unmatched: string[] = []
  for (const r of rows) {
    const club = String(r["Clube"] ?? "").trim()
    if (!club) continue
    const ck = clubKey(club)
    const g = gameByKey.get(FIN_ALIAS[ck] ?? ck)
    if (!g) { unmatched.push(`${club} (${r["Série"]})`); continue }
    updates.push({ file_key: g.file_key, nome: g.nome, old: g.saldo, neu: computeSaldo(r), cls: String(r["Classificação"] ?? "") })
  }

  const mi = (n: number) => (n / 1e6).toFixed(1) + "M"
  console.log(`clubes no xlsx: ${rows.length} | casaram: ${updates.length} | nao casaram: ${unmatched.length}`)
  console.log("--- amostra (20) ---")
  for (const u of updates.slice(0, 20)) console.log(`  ${u.nome.padEnd(20)} ${mi(u.old).padStart(8)} -> ${mi(u.neu).padStart(8)}  [${u.cls}]`)
  if (unmatched.length) { console.log(`--- nao casaram (${unmatched.length}) ---`); console.log("  " + unmatched.slice(0, 40).join(" | ")) }

  if (!APPLY) { console.log("\n(dry-run) rode com --apply."); return }

  let content = await readFile(TEAMS_FILE, "utf8")
  let done = 0
  for (const u of updates) {
    const anchor = `file_key: "${u.file_key}"`
    const at = content.indexOf(anchor)
    if (at < 0) continue
    const sStart = content.lastIndexOf("saldo:", at)
    if (sStart < 0 || sStart > at) continue
    const numStart = sStart + "saldo:".length
    const numEnd = content.indexOf(",", numStart)
    content = content.slice(0, numStart) + " " + u.neu + content.slice(numEnd)
    done++
  }
  await writeFile(TEAMS_FILE, content, "utf8")
  console.log(`\naplicados: ${done}/${updates.length} em teams-data.ts`)
}

main()
