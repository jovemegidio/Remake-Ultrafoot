// Casa os times SEM escudo REAL com os arquivos da pasta "Escudos/" (raiz do
// projeto) e copia o crest para public/escudos/<file_key>.png, gravando um override
// em data/seeds/user-crest-overrides.json (que escudos-map.ts aplica por cima do
// mapa gerado). "Sem escudo real" = arquivo inexistente OU placeholder gerado
// (logo automatico em /generated/ ou .svg) — nesses casos o escudo da pasta entra.
//
// Conservador: so casa quando o nome normalizado bate de forma UNICA (escudo errado
// e pior que placeholder). Ambiguos e sem-match sao apenas reportados.
//
// Uso:  npx tsx scripts/import-missing-crests.ts <ROOT> [--write]

import { readdirSync, existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, basename } from "node:path"
import { allBrazilianTeams, allPoolTeams } from "../lib/teams-data"
import { allInternationalTeams } from "../lib/international-teams"
import { localEscudoMap } from "../lib/escudos-map"

const ROOT = process.argv[2] ?? process.cwd()
const WRITE = process.argv.includes("--write")
// --force: substitui o escudo ATUAL do jogo pelo arquivo do usuario para TODO time
// que exista no jogo e tenha match unico na pasta (nao so os sem escudo). Pedido
// do usuario ("use a minha arte por cima").
const FORCE = process.argv.includes("--force")
const SRC = join(ROOT, "Escudos")
const DEST = join(ROOT, "public", "escudos")
const OVERRIDE_FILE = join(ROOT, "data", "seeds", "user-crest-overrides.json")

// Inclui enches espanhois (Chile), sauditas E turcos ("Kulübü"->"kulubu",
// "Futbol", "Spor" isolado), para clubes de nome oficial longo baterem com o nome
// curto do jogo: "Konyaspor Kulübü" -> "konyaspor".
const TOKENS_LIXO = new Set(["fc","sc","ec","cf","ca","cd","ac","afc","fk","sk","club","clube","de","do","da","futebol","futbol","football","sport","sports","sporting","spor","kulubu","kulup","associacao","deportivo","deportes","social","provincial","escuela","y","saudi","del","los","las"])
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(/\s+/).filter(t => t && !TOKENS_LIXO.has(t)).join(" ")
}
function baseNome(arquivo: string): { nome: string; pais: string | null } {
  const semExt = arquivo.replace(/\.png$/i, "")
  const m = /^(.*?)\s*-\s*([A-Za-z]{2,4})$/.exec(semExt)
  if (m) return { nome: m[1].trim(), pais: m[2].toUpperCase() }
  return { nome: semExt.trim(), pais: null }
}

// Um time PRECISA de escudo se o arquivo resolvido nao existe OU e um placeholder
// gerado (logo automatico de iniciais em /generated/ ou .svg).
function precisaEscudo(fileKey: string): boolean {
  const resolved = localEscudoMap[fileKey] ?? `/escudos/${fileKey}.png`
  if (resolved.includes("/generated/") || /\.svg$/i.test(resolved)) return true
  return !existsSync(join(DEST, basename(resolved)))
}

const fontePorNome = new Map<string, { arquivo: string; pais: string | null }[]>()
for (const arquivo of readdirSync(SRC)) {
  if (!/\.png$/i.test(arquivo)) continue
  const { nome, pais } = baseNome(arquivo)
  const k = norm(nome)
  if (!k) continue
  const arr = fontePorNome.get(k) ?? []
  arr.push({ arquivo, pais })
  fontePorNome.set(k, arr)
}

const todos = [...allBrazilianTeams, ...allPoolTeams, ...allInternationalTeams]
const vistos = new Set<string>()
const overrides: Record<string, string> = {}

let semEscudo = 0, casados = 0, ambiguos = 0, semMatch = 0
const relAmbiguos: string[] = []
const relSemMatch: string[] = []
const relCasados: string[] = []

if (WRITE && !existsSync(DEST)) mkdirSync(DEST, { recursive: true })

// Copia o crest para /escudos/<fileKey>.png e registra o override para o jogo
// resolver por ele (vencendo qualquer placeholder do mapa gerado).
function aplicar(fileKey: string, arquivo: string, nomeTime: string, nota = "") {
  casados++; relCasados.push(`${nomeTime} <- ${arquivo}${nota}`)
  if (WRITE) {
    copyFileSync(join(SRC, arquivo), join(DEST, `${fileKey}.png`))
    overrides[fileKey] = `/escudos/${fileKey}.png`
  }
}

for (const t of todos) {
  const fileKey = String((t as { file_key?: string }).file_key ?? t.curto ?? "")
  if (!fileKey || vistos.has(fileKey)) continue
  vistos.add(fileKey)

  if (!FORCE && !precisaEscudo(fileKey)) continue // ja tem escudo real (sem --force)
  semEscudo++

  const k = norm(t.nome)
  let cands = fontePorNome.get(k) ?? []
  if (cands.length === 0) {
    const cands2 = fontePorNome.get(norm(fileKey)) ?? []
    if (cands2.length === 1) { aplicar(fileKey, cands2[0].arquivo, t.nome); continue }
    semMatch++; relSemMatch.push(`${t.nome} [${fileKey}]`)
    continue
  }
  if (cands.length === 1) { aplicar(fileKey, cands[0].arquivo, t.nome); continue }

  // Multiplos: desambigua por pais/estado do time.
  const paisTime = norm(String((t as { pais?: string; estado?: string }).estado ?? (t as { pais?: string }).pais ?? ""))
  const porPais = cands.filter(c => c.pais && norm(c.pais) === paisTime)
  if (porPais.length === 1) { aplicar(fileKey, porPais[0].arquivo, t.nome, " (por pais)"); continue }
  ambiguos++; relAmbiguos.push(`${t.nome} [${fileKey}] -> ${cands.map(c => c.arquivo).join(" | ")}`)
}

if (WRITE) {
  let existente: Record<string, string> = {}
  try { existente = JSON.parse(readFileSync(OVERRIDE_FILE, "utf8")) } catch { /* primeiro run */ }
  const merged = { ...existente, ...overrides }
  writeFileSync(OVERRIDE_FILE, JSON.stringify(merged, null, 2) + "\n", "utf8")
}

console.log(`\n=== Precisam de escudo: ${semEscudo} | casados: ${casados} | ambiguos: ${ambiguos} | sem match: ${semMatch} ===`)
if (relCasados.length) { console.log(`\n-- CASADOS (${relCasados.length}) --`); relCasados.slice(0, 80).forEach(l => console.log("  " + l)) }
if (relAmbiguos.length) { console.log(`\n-- AMBIGUOS (${relAmbiguos.length}) --`); relAmbiguos.slice(0, 40).forEach(l => console.log("  " + l)) }
console.log(WRITE ? `\n(WRITE) ${Object.keys(overrides).length} escudos aplicados + overrides gravados.` : "\n(dry-run) rode com --write para aplicar.")
