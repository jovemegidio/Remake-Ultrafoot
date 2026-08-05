/**
 * Repara dois defeitos do `imported-bf2026.json` levantados na auditoria:
 *
 * 1. 72 clubes com o campo `pais` preenchido com o PRÓPRIO fileKey em maiúsculas
 *    ("Olympique Lyonnais" com pais="LYON"). O `liga` desses registros também foi
 *    para "Liga Nacional". Como a informação se perdeu no próprio registro, a
 *    recuperação vem do CATÁLOGO CURADO (`allTeams`), casando por nome
 *    normalizado — é a fonte de verdade de país/divisão do jogo.
 *
 * 2. Idades impossíveis (46 a 70 anos) em atletas do pool.
 *
 * Grava backup antes de mexer. Rode com `--aplicar`; sem a flag é ensaio.
 */
import fs from "node:fs"
import path from "node:path"
import { allTeams } from "../lib/teams-data"
import { normalizeCountry } from "../lib/country-normalize"

const RAIZ = process.env.RAIZ_ULTRAFOOT ?? process.cwd()
const ARQ = path.join(RAIZ, "data/seeds/imported-bf2026.json")
const aplicar = process.argv.includes("--aplicar")

const norm = (v: string) =>
  String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

const seed = JSON.parse(fs.readFileSync(ARQ, "utf8"))

// Índice do catálogo curado por nome. Nome repetido em países diferentes fica de
// fora: casar errado é pior do que não casar (ver os homônimos do Botafogo).
const porNome = new Map<string, { pais?: string; divisao?: unknown }>()
const ambiguos = new Set<string>()
for (const t of allTeams) {
  const k = norm(t.nome)
  const anterior = porNome.get(k)
  if (anterior && norm(String(anterior.pais ?? "")) !== norm(String(t.pais ?? ""))) ambiguos.add(k)
  porNome.set(k, { pais: t.pais, divisao: t.divisao })
}
for (const a of ambiguos) porNome.delete(a)

// Segunda régua, MECÂNICA: clube cujo fileKey ou nome termina em UF brasileira é
// do Brasil (santacruzrn, atleticopi, capixabaes...). É dedução por sufixo, não
// palpite sobre o clube — e a maioria dos 42 que sobraram da primeira régua são
// exatamente estaduais que não existem no catálogo curado.
const UFS = ["ac","al","ap","am","ba","ce","df","es","go","ma","mt","ms","mg","pa","pb","pr","pe","pi","rj","rn","rs","ro","rr","sc","sp","se","to"]
const ehBrasileiroPorUF = (nome: string, fileKey: string) => {
  const k = norm(fileKey)
  const n = norm(nome)
  return UFS.some(uf => k.endsWith(uf) || n.endsWith(uf))
}

/** "ALBÂNIA - COPIA (2)" -> "Albânia". Devolve "" quando não sobra país válido. */
const paisAntesDoLixo = (bruto: string): string => {
  const primeiro = String(bruto ?? "").split(/\s*-\s*/)[0]?.trim()
  if (!primeiro || primeiro.length < 4) return ""
  const resolvido = normalizeCountry(primeiro)
  return resolvido && resolvido !== "Indefinido" && norm(resolvido) !== norm(bruto) ? resolvido : ""
}

let paisCorrigidos = 0
let paisPorUF = 0
let paisPorLimpeza = 0
const paisNaoResolvidos: string[] = []
let idadesCorrigidas = 0
const IDADE_MAX = 42
const IDADE_MIN = 16

for (const time of seed.teams) {
  const suspeito = time.pais && time.pais === String(time.pais).toUpperCase() && String(time.pais).length > 3
  if (suspeito) {
    const curado = porNome.get(norm(time.nome))
    if (curado?.pais) {
      time.pais = curado.pais
      paisCorrigidos++
    } else if (paisAntesDoLixo(time.pais)) {
      // "ALBÂNIA - COPIA (2)" — país real com sufixo de pasta duplicada colado.
      time.pais = paisAntesDoLixo(time.pais)
      paisPorLimpeza++
    } else if (ehBrasileiroPorUF(time.nome, time.fileKey ?? "")) {
      time.pais = "Brasil"
      paisPorUF++
    } else {
      paisNaoResolvidos.push(`${time.nome} (pais="${time.pais}")`)
    }
  }
  for (const atleta of time.jogadores ?? []) {
    if (typeof atleta.idade !== "number") continue
    if (atleta.idade > IDADE_MAX) { atleta.idade = IDADE_MAX; idadesCorrigidas++ }
    else if (atleta.idade < IDADE_MIN) { atleta.idade = IDADE_MIN; idadesCorrigidas++ }
  }
}

console.log(`países pelo catálogo:   ${paisCorrigidos}`)
console.log(`países por UF (Brasil): ${paisPorUF}`)
console.log(`países por limpeza:     ${paisPorLimpeza}`)
console.log(`países não resolvidos:  ${paisNaoResolvidos.length}`)
for (const n of paisNaoResolvidos.slice(0, 15)) console.log(`   - ${n}`)
if (paisNaoResolvidos.length > 15) console.log(`   ... +${paisNaoResolvidos.length - 15}`)
console.log(`idades corrigidas:      ${idadesCorrigidas}`)

if (!aplicar) {
  console.log("\nENSAIO — nada foi gravado. Rode com --aplicar para valer.")
  process.exit(0)
}

const backup = `${ARQ}.antes-reparo-pais`
if (!fs.existsSync(backup)) fs.copyFileSync(ARQ, backup)
fs.writeFileSync(ARQ, JSON.stringify(seed))
console.log(`\ngravado. backup em ${path.basename(backup)}`)
