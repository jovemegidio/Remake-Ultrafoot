// Siglas repetidas DENTRO DA MESMA LIGA — o unico lugar onde a repeticao
// atrapalha de verdade. Duas siglas iguais em paises diferentes nunca aparecem
// na mesma tabela; duas na mesma divisao deixam a classificacao ilegivel.
//
//   node scripts/auditar-siglas-por-liga.mjs
import { readFileSync } from "node:fs"

const semAcento = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
const RUIDO = new Set([
  "fc", "sc", "ec", "ca", "cr", "ac", "se", "afc", "cf", "ud", "cd", "cs", "rc", "as", "ss", "us",
  "sv", "sk", "fk", "nk", "kv", "ks", "gd", "sd", "ad", "ce", "aa", "esporte", "esportivo",
  "clube", "club", "futebol", "football", "atletico", "athletic", "de", "do", "da", "dos", "das",
  "del", "the", "el", "la", "los", "and", "e", "y",
])
function siglaDoNome(nome) {
  const palavras = semAcento(nome ?? "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim().split(/\s+/)
    .filter(w => w && !RUIDO.has(w.toLowerCase()))
  const uteis = palavras.length ? palavras : semAcento(nome ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").split(/(?=.)/)
  if (uteis.length === 0) return "???"
  if (uteis.length === 1) return uteis[0].slice(0, 3).padEnd(3, uteis[0][0] ?? "X")
  if (uteis.length === 2) return (uteis[0][0] + uteis[1].slice(0, 2)).slice(0, 3)
  return uteis.slice(0, 3).map(w => w[0]).join("")
}
function ehSlug(curto, nome) {
  const c = (curto ?? "").trim()
  if (!c) return true
  if (c.length >= 8) return true
  const alvo = semAcento(nome ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  return c.length >= 5 && !alvo.startsWith(c.toUpperCase())
}
const DESEMPATE = JSON.parse(readFileSync('data/seeds/siglas-clubes.json', 'utf8'))
const chaveDeClube = nome => semAcento(nome ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w && !RUIDO.has(w)).join(' ')
const siglaExibivel = (curto, nome) => (ehSlug(curto, nome) ? (DESEMPATE[chaveDeClube(nome)] ?? siglaDoNome(nome)) : curto)

const pool = JSON.parse(readFileSync("data/seeds/imported-bf2026.json", "utf8"))
const clubes = Array.isArray(pool) ? pool : (pool.teams ?? pool.clubes ?? [])

// A liga de verdade e pais + competicao. O campo `divisao` do pool tem so DOIS
// valores para 3.064 clubes ("Série A"/"Série B") — agrupar por ele jogaria o
// mundo inteiro numa tabela so e inventaria choque onde nao ha.
const porLiga = new Map()
for (const c of clubes) {
  const liga = `${c.pais ?? "?"} / ${c.liga ?? "?"}`
  if (!porLiga.has(liga)) porLiga.set(liga, [])
  porLiga.get(liga).push(c)
}

let ligasComChoque = 0, choquesTotais = 0
const antes = { ligas: 0, choques: 0 }
const exemplos = []

for (const [liga, times] of porLiga) {
  const conta = (fn) => {
    const m = new Map()
    for (const t of times) {
      const s = fn(t)
      if (!m.has(s)) m.set(s, [])
      m.get(s).push(t.nome)
    }
    return [...m.entries()].filter(([, v]) => v.length > 1)
  }
  const cru = conta(t => (t.curto ?? "").toUpperCase())
  const bom = conta(t => siglaExibivel(t.curto, t.nome))
  if (cru.length) { antes.ligas++; antes.choques += cru.reduce((a, [, v]) => a + v.length, 0) }
  if (bom.length) {
    ligasComChoque++
    choquesTotais += bom.reduce((a, [, v]) => a + v.length, 0)
    if (exemplos.length < 12) exemplos.push(`   ${liga}: ` + bom.map(([s, v]) => `${s} = ${v.join(" / ")}`).join(" | "))
  }
}

console.log(`${clubes.length} clubes do pool em ${porLiga.size} ligas\n`)
console.log(`ANTES (sigla crua):   ${antes.ligas} liga(s) com repeticao, ${antes.choques} clube(s) afetado(s)`)
console.log(`DEPOIS (siglaExibivel): ${ligasComChoque} liga(s) com repeticao, ${choquesTotais} clube(s) afetado(s)\n`)
if (exemplos.length) { console.log("repeticoes que sobram:"); exemplos.forEach(e => console.log(e)) }
