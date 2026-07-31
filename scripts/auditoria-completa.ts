// AUDITORIA COMPLETA DO CONTEUDO DO JOGO.
//
// Responde, com numeros e nao com impressao: o jogo tem todos os times, ligas,
// divisoes, campeonatos, copas, elencos e a categoria de base? E onde estao os
// buracos?
//
// Nao e um teste (nao reprova nada): e um RAIO-X. Cada secao imprime o que
// existe e, em seguida, o que esta FALTANDO — porque um total bonito esconde
// bem um clube sem elenco ou uma divisao sem campeonato.
//
// Uso: npx tsx scripts/auditoria-completa.ts
import { existsSync } from "node:fs"
import {
  allTeams, allBrazilianTeams, allPoolTeams, getTeamsByDivision,
  serieATeams, serieBTeams, serieCTeams, serieDTeams, type Team,
  completarLigaComPool,
} from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"
import { localEscudoMap } from "../lib/escudos-map"
import { LEAGUE_COMPETITIONS, hasStateChampionship } from "../lib/country-competitions"
import { COMPETITION_REGULATIONS_2026 } from "../lib/competition-regulations-2026"
import { generateYouthMarketProspects } from "../lib/youth-academy"

const linha = (t = "") => console.log(t)
const titulo = (t: string) => { linha(); linha(`${"=".repeat(72)}`); linha(t); linha("=".repeat(72)) }
const sub = (t: string) => { linha(); linha(`── ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`) }

const problemas: string[] = []
const anotar = (t: string) => problemas.push(t)

// ─────────────────────────────────────────────────────────────────────────────
titulo("1. TIMES")

linha(`catalogo curado ....... ${allTeams.length}`)
linha(`  brasileiros ......... ${allBrazilianTeams.length}`)
linha(`  internacionais ...... ${allTeams.length - allBrazilianTeams.length}`)
linha(`pool importado (BF) ... ${allPoolTeams.length}`)

// Siglas repetidas quebram tabela e calendario (o round-robin monta "clube
// contra ele mesmo"). O codigo ja desambigua, mas vale medir o estrago.
const porCurto = new Map<string, Team[]>()
for (const t of allTeams) {
  const l = porCurto.get(t.curto) ?? []
  l.push(t); porCurto.set(t.curto, l)
}
const siglasRepetidas = [...porCurto.entries()].filter(([, l]) => l.length > 1)
linha(`siglas repetidas ...... ${siglasRepetidas.length}`)
if (siglasRepetidas.length) {
  for (const [c, l] of siglasRepetidas.slice(0, 8)) linha(`    ${c}: ${l.map(t => t.nome).join(" | ")}`)
  if (siglasRepetidas.length > 8) linha(`    ... e mais ${siglasRepetidas.length - 8}`)
  anotar(`${siglasRepetidas.length} siglas repetidas no catalogo`)
}

// Nome corrompido: mojibake ou fileKey cortado vazando para o nome exibido.
const suspeitos = allTeams.filter(t =>
  /Ã|Â|�/.test(t.nome) || (/^[A-Z]{6,}$/.test(t.nome) && t.nome === t.nome.toUpperCase()))
linha(`nomes suspeitos ....... ${suspeitos.length}`)
if (suspeitos.length) {
  for (const t of suspeitos.slice(0, 10)) linha(`    "${t.nome}" (${t.curto} / ${t.file_key})`)
  anotar(`${suspeitos.length} clubes com nome possivelmente corrompido`)
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("2. DIVISOES E LIGAS")

const porDivisao = new Map<string, Team[]>()
for (const t of allTeams) {
  const d = String(t.divisao ?? "?")
  const l = porDivisao.get(d) ?? []
  l.push(t); porDivisao.set(d, l)
}
const divisoes = [...porDivisao.entries()].sort((a, b) => b[1].length - a[1].length)
linha(`divisoes distintas .... ${divisoes.length}`)
linha()
// A contagem que importa nao e a do CATALOGO, e a da liga que o jogo MONTA:
// `completarLigaComPool` completa as divisoes curtas com clubes do proprio pais
// (pool importado). Medir so o catalogo acusava onze "ligas curtas" que na
// pratica ja viram campeonato de verdade — um alarme que envelheceu mal.
linha("  divisao                     catalogo  na partida   rodadas   estadual?")
for (const [d, times] of divisoes) {
  const efetiva = completarLigaComPool(d).length
  const rodadas = (efetiva - 1) * 2
  const estadual = hasStateChampionship(d) ? "sim" : "-"
  const marca = efetiva > times.length ? ` (+${efetiva - times.length} do pool)` : ""
  linha(`  ${d.padEnd(28)} ${String(times.length).padStart(5)}  ${String(efetiva).padStart(9)}  ${String(rodadas).padStart(8)}   ${estadual}${marca}`)
  // So e problema se NEM COM O POOL a liga fecha.
  if (efetiva < 8) anotar(`divisao "${d}": nem com o pool passa de ${efetiva} clube(s) — liga curta demais`)
}

// A liga declarada existe para cada divisao?
sub("divisoes SEM competicoes declaradas (country-competitions)")
const semComp = divisoes.map(([d]) => d).filter(d => !LEAGUE_COMPETITIONS[d])
linha(semComp.length ? `  ${semComp.length}: ${semComp.slice(0, 20).join(", ")}` : "  nenhuma — todas declaradas")
if (semComp.length) anotar(`${semComp.length} divisoes sem entrada em LEAGUE_COMPETITIONS`)

// ─────────────────────────────────────────────────────────────────────────────
titulo("3. CAMPEONATOS, COPAS E REGULAMENTOS")

const regs = Object.values(COMPETITION_REGULATIONS_2026) as unknown as Array<Record<string, unknown>>
linha(`regulamentos 2026 ..... ${regs.length}`)
const porTipo = new Map<string, number>()
for (const r of regs) {
  const tipo = String((r as { tipo?: string; type?: string }).tipo ?? (r as { type?: string }).type ?? "?")
  porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1)
}
for (const [tipo, n] of [...porTipo].sort((a, b) => b[1] - a[1])) linha(`  ${tipo.padEnd(24)} ${n}`)

// ATENCAO — esta checagem ja produziu um FALSO POSITIVO. Ela procurava uma LISTA
// em `participantes`/`clubes`/`times` e acusava "103 de 103 regulamentos sem
// participantes". O campo real chama-se `participants` e e um NUMERO (quantos
// clubes a competicao tem), nao a lista deles: `brasileirao_a` traz
// `participants: 20`. Ou seja: o dado estava la, quem estava errado era a
// pergunta. Agora conferimos o campo certo, e so acusamos o que de fato falta.
sub("regulamentos sem numero de participantes")
const semTimes = regs.filter(r => {
  const n = (r as { participants?: number }).participants
  return typeof n !== "number" || n <= 0
})
linha(`  ${semTimes.length} de ${regs.length}`)
if (semTimes.length) {
  for (const r of semTimes.slice(0, 12)) linha(`    ${String((r as { name?: string; id?: string }).name ?? (r as { id?: string }).id)}`)
  if (semTimes.length > 12) linha(`    ... e mais ${semTimes.length - 12}`)
  anotar(`${semTimes.length} regulamentos sem numero de participantes`)
}

// E o TIPO tambem sai errado pelo mesmo motivo: o campo e `format`, nao `tipo`.
sub("regulamentos por formato")
const porFormato = new Map<string, number>()
for (const r of regs) {
  const f = String((r as { format?: string }).format ?? "?").split(",")[0].trim()
  porFormato.set(f, (porFormato.get(f) ?? 0) + 1)
}
for (const [f, n] of [...porFormato].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  linha(`  ${String(n).padStart(3)}  ${f.slice(0, 60)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("4. ELENCOS")

let semElenco = 0
let elencoCurto = 0
let totalAtletas = 0
const piores: { nome: string; n: number }[] = []
const posicoesFaltando: { nome: string; faltam: string[] }[] = []
const ESSENCIAIS = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "ATA"]

for (const t of allTeams) {
  let elenco: ReturnType<typeof getPlayersForTeam> = []
  try { elenco = getPlayersForTeam(t) } catch { /* clube sem entrada no banco */ }
  totalAtletas += elenco.length
  if (elenco.length === 0) { semElenco++; piores.push({ nome: `${t.nome} (${t.divisao})`, n: 0 }); continue }
  if (elenco.length < 11) { elencoCurto++; piores.push({ nome: `${t.nome} (${t.divisao})`, n: elenco.length }) }
  if (elenco.length >= 11) {
    const tem = new Set(elenco.map(p => String(p.pos ?? "")))
    const faltam = ESSENCIAIS.filter(p => !tem.has(p))
    if (faltam.length) posicoesFaltando.push({ nome: t.nome, faltam })
  }
}

linha(`clubes no catalogo .... ${allTeams.length}`)
linha(`atletas somados ....... ${totalAtletas}`)
linha(`media por clube ....... ${(totalAtletas / Math.max(1, allTeams.length)).toFixed(1)}`)
linha(`SEM elenco nenhum ..... ${semElenco}`)
linha(`elenco < 11 ........... ${elencoCurto}`)
if (semElenco) anotar(`${semElenco} clubes SEM elenco — nao da para escalar nem simular`)
if (elencoCurto) anotar(`${elencoCurto} clubes com menos de 11 atletas`)

if (piores.length) {
  sub("clubes sem elenco jogavel (amostra)")
  for (const p of piores.slice(0, 15)) linha(`  ${String(p.n).padStart(3)} atletas  ${p.nome}`)
  if (piores.length > 15) linha(`  ... e mais ${piores.length - 15}`)
}
if (posicoesFaltando.length) {
  sub("clubes com elenco cheio mas SEM alguma posicao essencial")
  linha(`  ${posicoesFaltando.length} clubes`)
  for (const p of posicoesFaltando.slice(0, 10)) linha(`    ${p.nome}: falta ${p.faltam.join(", ")}`)
  anotar(`${posicoesFaltando.length} clubes sem alguma posicao essencial no elenco`)
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("5. ESCUDOS")

let semArte = 0
const semArteLista: string[] = []
for (const t of allTeams) {
  const caminho = (localEscudoMap as Record<string, string>)[t.file_key] ?? `/escudos/${t.file_key}.png`
  if (!existsSync(`public${caminho}`)) { semArte++; semArteLista.push(`${t.nome} (${t.file_key})`) }
}
linha(`clubes .................... ${allTeams.length}`)
linha(`COM escudo de verdade ..... ${allTeams.length - semArte}`)
linha(`caem no escudo desenhado .. ${semArte}  (${((semArte / allTeams.length) * 100).toFixed(1)}%)`)
if (semArte) {
  sub("sem arte (amostra)")
  for (const s of semArteLista.slice(0, 15)) linha(`  ${s}`)
  if (semArteLista.length > 15) linha(`  ... e mais ${semArteLista.length - 15}`)
  anotar(`${semArte} clubes sem escudo real (desenham o generico)`)
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("6. BASE, PROMESSAS E JOIAS")

// Import estatico: `await import(...)` no topo do arquivo so compila com module
// es2022+, e o tsconfig do projeto nao usa isso — o gate reprovava o script.
const promessas = generateYouthMarketProspects(2026, 1, 60)
linha(`promessas geradas (1 ciclo) ... ${promessas.length}`)
if (promessas.length) {
  const pots = promessas.map(p => p.potential ?? 0)
  const idades = promessas.map(p => p.age ?? 0)
  linha(`potencial ..................... ${Math.min(...pots)} a ${Math.max(...pots)}`)
  linha(`idades ........................ ${Math.min(...idades)} a ${Math.max(...idades)}`)
  linha(`joias (potencial >= 88) ....... ${pots.filter(p => p >= 88).length}`)
  const clubes = new Set(promessas.map(p => p.fromTeam))
  linha(`clubes formadores ............. ${clubes.size}  (${[...clubes].join(", ")})`)
  const posDistintas = new Set(promessas.map(p => p.position))
  linha(`posicoes representadas ........ ${posDistintas.size}  (${[...posDistintas].sort().join(", ")})`)
  const faltam = ESSENCIAIS.filter(p => !posDistintas.has(p))
  if (faltam.length) anotar(`o mercado de juniores nunca oferece: ${faltam.join(", ")}`)
  const semValor = promessas.filter(p => !p.value || p.value <= 0).length
  if (semValor) anotar(`${semValor} promessas sem preco`)
} else {
  anotar("o mercado de juniores nao gerou nenhuma promessa")
}

// ─────────────────────────────────────────────────────────────────────────────
titulo("RESUMO — O QUE PRECISA DE ATENCAO")
if (problemas.length === 0) {
  linha("Nada encontrado. O conteudo esta completo nas dimensoes auditadas.")
} else {
  problemas.forEach((p, i) => linha(`${String(i + 1).padStart(2)}. ${p}`))
}
linha()
linha(`Brasil: A=${serieATeams.length} B=${serieBTeams.length} C=${serieCTeams.length} D=${serieDTeams.length}`)
linha(`Divisao com mais times: ${divisoes[0]?.[0]} (${divisoes[0]?.[1].length})`)
linha()
