/**
 * GERA O DESEMPATE DAS SIGLAS (data/seeds/siglas-clubes.json).
 *
 * `siglaDoNome` transforma o slug ilegivel do pool ("MACHESTE", "DEPORTIV") em
 * tres letras que o jogador reconhece. So que tres letras colidem: na Premier
 * League, "Swansea City", "Stoke City" e "Salford City" caem todos em SCI, e
 * uma tabela com tres SCI e tao ruim quanto o slug.
 *
 * O desempate acontece AQUI, na geracao, e nao em tempo de tela: dentro de cada
 * liga (pais + competicao, que e onde os clubes se encontram numa tabela), o
 * primeiro clube fica com a sigla base e os demais recebem a primeira
 * alternativa livre. O resultado e um arquivo pequeno com SO os clubes que
 * precisaram mudar — o resto continua saindo da derivacao, sem tabela nenhuma.
 *
 * A chave e o NOME comparavel, e nao o fileKey, porque e o nome que a tela tem
 * em maos quando desenha a sigla.
 *
 *   node scripts/gerar-siglas-desambiguadas.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"

const semAcento = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
const RUIDO = new Set([
  "fc", "sc", "ec", "ca", "cr", "ac", "se", "afc", "cf", "ud", "cd", "cs", "rc", "as", "ss", "us",
  "sv", "sk", "fk", "nk", "kv", "ks", "gd", "sd", "ad", "ce", "aa", "esporte", "esportivo",
  "clube", "club", "futebol", "football", "atletico", "athletic", "de", "do", "da", "dos", "das",
  "del", "the", "el", "la", "los", "and", "e", "y",
])

const palavrasUteis = nome => {
  const p = semAcento(nome ?? "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim().split(/\s+/)
    .filter(w => w && !RUIDO.has(w.toLowerCase()))
  return p.length ? p : semAcento(nome ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").split(/(?=.)/)
}

function siglaBase(nome) {
  const u = palavrasUteis(nome)
  if (u.length === 0) return "???"
  if (u.length === 1) return u[0].slice(0, 3).padEnd(3, u[0][0] ?? "X")
  if (u.length === 2) return (u[0][0] + u[1].slice(0, 2)).slice(0, 3)
  return u.slice(0, 3).map(w => w[0]).join("")
}

const chaveDeClube = nome =>
  semAcento(nome ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter(w => w && !RUIDO.has(w)).join(" ")

/** Alternativas, da mais parecida com a convencao ate a mais forcada. */
function candidatos(nome) {
  const u = palavrasUteis(nome)
  const [a = "", b = "", c = ""] = u
  const consoantes = w => w.replace(/[AEIOU]/g, "")
  const out = [
    siglaBase(nome),
    a.slice(0, 3),
    b ? a[0] + b.slice(0, 2) : "",
    b ? a.slice(0, 2) + b[0] : "",
    c ? a[0] + b[0] + c[0] : "",
    b ? a.slice(0, 2) + b.slice(0, 2) : "",           // 4 letras
    a.slice(0, 4),
    b ? a[0] + b.slice(0, 3) : "",
    (a[0] ?? "") + consoantes(a.slice(1)).slice(0, 2), // esqueleto: Barnsley -> BRN
    b ? (a[0] ?? "") + (b[0] ?? "") + consoantes(b.slice(1)).slice(0, 1) : "",
    u.length > 3 ? u.slice(0, 4).map(w => w[0]).join("") : "",
    u[u.length - 1] ? a[0] + u[u.length - 1].slice(0, 2) : "",
  ]
  // ultimo recurso deterministico: base + digito
  for (let i = 2; i <= 9; i++) out.push(siglaBase(nome) + i)
  return [...new Set(out.filter(s => s && s.length >= 2 && !/^\d/.test(s)))]
}

const pool = JSON.parse(readFileSync("data/seeds/imported-bf2026.json", "utf8"))
const clubes = Array.isArray(pool) ? pool : (pool.teams ?? pool.clubes ?? [])

const porLiga = new Map()
for (const c of clubes) {
  const liga = `${c.pais ?? "?"} / ${c.liga ?? "?"}`
  if (!porLiga.has(liga)) porLiga.set(liga, [])
  porLiga.get(liga).push(c)
}

const overrides = {}
let mudados = 0, semSaida = 0

for (const [, times] of porLiga) {
  // ordem estavel: quem tem mais prestigio fica com a sigla base (o Manchester
  // United nao pode perder MUN para o Maidenhead United).
  const ordenados = [...times].sort((x, y) =>
    (y.prestigio ?? 0) - (x.prestigio ?? 0) || String(x.nome).localeCompare(String(y.nome)))
  const usadas = new Set()
  for (const t of ordenados) {
    const base = siglaBase(t.nome)
    let escolhida = null
    for (const cand of candidatos(t.nome)) {
      if (!usadas.has(cand)) { escolhida = cand; break }
    }
    if (!escolhida) { escolhida = base; semSaida++ }
    usadas.add(escolhida)
    if (escolhida !== base) {
      const k = chaveDeClube(t.nome)
      if (k) { overrides[k] = escolhida; mudados++ }
    }
  }
}

const ordenado = Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync("data/seeds/siglas-clubes.json", JSON.stringify(ordenado, null, 1) + "\n")
console.log(`${clubes.length} clubes em ${porLiga.size} ligas`)
console.log(`desempates gravados: ${mudados}${semSaida ? ` (${semSaida} sem alternativa livre)` : ""}`)
console.log("-> data/seeds/siglas-clubes.json")
