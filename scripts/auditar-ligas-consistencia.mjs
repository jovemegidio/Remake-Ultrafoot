// CONSISTENCIA de cada liga nacional: o que a competicao DECLARA x o que existe.
//
//   node scripts/auditar-ligas-consistencia.mjs
//
// Tres perguntas, todas verificaveis:
//   1. `teams` da competicao bate com o numero de clubes que a liga tem?
//   2. `rounds` bate com o turno-returno desses clubes — 2*(n-1)?
//   3. `relegation` da competicao bate com o `swaps` da piramide, e a divisao
//      de baixo existe para receber quem cai?
//
// Um numero errado aqui nao da erro: a tabela roda com o numero de clubes real e
// o texto do regulamento diz outra coisa, ou o rebaixamento manda 3 clubes para
// uma divisao que nao existe.
import fs from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const ler = p => fs.readFileSync(path.join(RAIZ, p), "utf8")

const fonte = ler("lib/international-teams.ts") + "\n" + ler("lib/teams-data.ts")
const comps = ler("lib/international-competitions.ts")
const pyr = ler("lib/league-pyramid.ts")
const clubesEtapa1 = JSON.parse(ler("data/seeds/real-clubs-stage1.json"))
const clubesEtapa1EuropaInferior = JSON.parse(ler("data/seeds/real-clubs-stage1-lower-europe.json"))
const clubesEtapa3Chequia = JSON.parse(ler("data/seeds/real-clubs-stage3-czech-second.json"))

// ─── Clubes por divisao (o campo `divisao` e a verdade) ──────────────────────
const porDivisao = new Map()
const paisDaDivisao = new Map()
for (const m of fonte.matchAll(/\{[^{}]*\}/g)) {
  const d = m[0].match(/divisao:\s*"([^"]+)"/)
  const f = m[0].match(/file_key:\s*"([^"]+)"/)
  if (!d || !f) continue
  porDivisao.set(d[1], (porDivisao.get(d[1]) ?? 0) + 1)
  // Espelha completarLigaComPool: sem `pais`, a UF em `estado` implica Brasil.
  const UF = /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/
  const pa = m[0].match(/pais:\s*"([^"]+)"/)
  const es = m[0].match(/estado:\s*"([^"]+)"/)
  const achado = pa?.[1] ?? (es && UF.test(es[1]) ? "Brasil" : es?.[1])
  if (achado && !paisDaDivisao.has(d[1])) paisDaDivisao.set(d[1], achado)
}
for (const clube of [...clubesEtapa1, ...clubesEtapa1EuropaInferior, ...clubesEtapa3Chequia]) {
  porDivisao.set(clube.divisao, (porDivisao.get(clube.divisao) ?? 0) + 1)
  if (!paisDaDivisao.has(clube.divisao)) paisDaDivisao.set(clube.divisao, clube.pais)
}

// ─── Tamanho JOGADO: o curado, completado pelo pool do proprio pais ──────────
// Espelha `completarLigaComPool` — a liga so CRESCE ate o alvo, nunca encolhe.
// ⚠️ Ler a tabela INTEIRA, nao linha a linha: `TAMANHO_OFICIAL_DA_LIGA` poe
// varios pares na mesma linha, e um regex ancorado em `^` pegava so o primeiro
// de cada uma — nove ligas ficavam sem alvo e o relatorio dizia que elas nao
// cresciam.
const tabela = ler("lib/teams-data.ts")
const iTab = tabela.indexOf("export const TAMANHO_OFICIAL_DA_LIGA")
const blocoTab = tabela.slice(iTab, tabela.indexOf("}", iTab))
const alvoDaLiga = {}
for (const m of blocoTab.matchAll(/([a-z_0-9]+):\s*(\d+)/g)) alvoDaLiga[m[1]] = Number(m[2])
const seed = JSON.parse(ler("data/seeds/imported-bf2026.json"))
// Espelha APELIDOS_DE_PAIS de teams-data: as duas bases escrevem o mesmo pais
// de jeitos diferentes ("EUA" x "Estados Unidos", "ARA" x "Arabia Saudita").
const APELIDOS = { eua: "estados unidos", ara: "arabia saudita", arb: "arabia saudita", ksa: "arabia saudita", holanda: "paises baixos", chequia: "tchequia" }
const norm = s => {
  const b = (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  return APELIDOS[b] ?? b
}
const poolPorPais = new Map()
for (const t of seed.teams ?? []) {
  const p = norm(t.pais)
  poolPorPais.set(p, (poolPorPais.get(p) ?? 0) + 1)
}
function tamanhoJogado(div) {
  const n = porDivisao.get(div) ?? 0
  const alvo = alvoDaLiga[div]
  if (!alvo) return n
  if (n >= alvo) return n
  const disponivel = poolPorPais.get(norm(paisDaDivisao.get(div))) ?? 0
  return Math.min(alvo, n + disponivel)
}

// ─── Piramides ───────────────────────────────────────────────────────────────
const piramides = []
for (const m of pyr.matchAll(/\{\s*country:\s*"([^"]+)",\s*tiers:\s*\[([^\]]+)\],\s*swaps:\s*\[([^\]]*)\]/g)) {
  piramides.push({
    pais: m[1],
    tiers: [...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1]),
    swaps: m[3].split(",").map(s => Number(s.trim())).filter(n => !Number.isNaN(n)),
  })
}
const infoTier = new Map()
for (const p of piramides) p.tiers.forEach((t, i) => infoTier.set(t, { p, i }))

// ─── Competicao de liga de cada divisao ──────────────────────────────────────
const blocoComps = comps.slice(comps.indexOf("export const competitionsByLeague"))
const ligaDaDivisao = new Map()
for (const m of blocoComps.matchAll(/^\s{2}([a-z_0-9]+):\s*\[/gm)) {
  const resto = blocoComps.slice(m.index)
  const corte = resto.indexOf("\n  ],")
  const bloco = corte > 0 ? resto.slice(0, corte) : resto.slice(0, 6000)
  // A competicao de LIGA da divisao e a primeira com type: "league".
  //
  // ⚠️ AS ENTRADAS TEM DOIS FORMATOS no mesmo arquivo: as ligas grandes ocupam
  // varias linhas e as menores cabem numa linha so. Um regex que so casava o
  // multi-linha achava 15 de 33 divisoes e o resto sumia do relatorio calado.
  for (const c of bloco.matchAll(/\{(?:[^{}]|\{[^{}]*\})*\}/g)) {
    if (!/type:\s*"league"/.test(c[0])) continue
    const num = (campo) => {
      const x = c[0].match(new RegExp(campo + ':\\s*(\\d+)'))
      return x ? Number(x[1]) : null
    }
    ligaDaDivisao.set(m[1], {
      id: c[0].match(/id:\s*"([^"]+)"/)?.[1] ?? "?",
      teams: num("teams"), rounds: num("rounds"),
      relegation: num("relegation"), promotion: num("promotion"),
      groups: num("groups"), seasonSegments: num("seasonSegments") ?? 1,
      roundRobinCycles: num("roundRobinCycles") ?? 2,
    })
    break
  }
}

// ⚠️ AS DIVISOES SEM NENHUM CLUBE CURADO PRECISAM ENTRAR NO RELATORIO. Iterando
// so `porDivisao`, as segundas divisoes montadas pelo pool (Liga Portugal 2,
// Eerste Divisie, Primera Nacional...) simplesmente nao apareciam — que e
// exatamente como elas ficaram anos declaradas e vazias sem ninguem notar.
const paisPool = {}
{
  const i = tabela.indexOf("const PAIS_DA_DIVISAO")
  for (const m of tabela.slice(i, tabela.indexOf("}", i)).matchAll(/([a-z_0-9]+):\s*"([^"]+)"/g)) {
    paisPool[m[1]] = m[2]
    if (!paisDaDivisao.has(m[1])) paisDaDivisao.set(m[1], m[2])
  }
}
const todas = [...new Set([...porDivisao.keys(), ...Object.keys(paisPool)])].sort()

const problemas = []
console.log("DIVISAO             CURADO JOGADO DECLARA RODADAS(esp) REBAIX PIRAMIDE ABAIXO")
for (const div of todas) {
  const n = porDivisao.get(div) ?? 0
  const c = ligaDaDivisao.get(div)
  if (!c) continue // divisao sem competicao de liga: tratada na outra auditoria
  const jogado = tamanhoJogado(div)
  const esperado = (c?.roundRobinCycles ?? 2) * (jogado - 1) * (c?.seasonSegments ?? 1)
  const info = infoTier.get(div)
  const swapAbaixo = info && info.i < info.p.swaps.length ? info.p.swaps[info.i] : null
  const abaixo = info ? info.p.tiers[info.i + 1] ?? "-" : "-"

  const marca = []
  if (c.teams !== jogado) { marca.push("TEAMS"); problemas.push(`${div}: competicao diz teams=${c.teams}, a liga joga com ${jogado}`) }
  // `groups` muda a conta de rodadas; so cobro turno-returno em liga corrida.
  if (!c.groups && c.rounds != null && c.rounds !== esperado) {
    marca.push("RODADAS"); problemas.push(`${div}: rounds=${c.rounds}, turno-returno de ${jogado} clubes pede ${esperado}`)
  }
  if (c.relegation && !info) {
    marca.push("SEM-PIRAMIDE"); problemas.push(`${div}: rebaixa ${c.relegation} e nao esta em nenhuma piramide — ninguem cai`)
  }
  // ⚠️ A MESMA ARMADILHA UM NIVEL ABAIXO. A ultima divisao da piramide nao tem
  // para onde rebaixar (`relegationCount` devolve 0 la), mas varias delas
  // anunciavam 2, 3 e ate 4 rebaixados na tela do regulamento.
  if (c.relegation && info && swapAbaixo == null) {
    marca.push("FUNDO"); problemas.push(`${div}: e a ultima divisao do pais e anuncia ${c.relegation} rebaixados — nao existe divisao abaixo`)
  }
  if (c.relegation && swapAbaixo != null && c.relegation !== swapAbaixo) {
    marca.push("SWAP"); problemas.push(`${div}: rebaixa ${c.relegation} mas a piramide troca ${swapAbaixo}`)
  }
  if (!c.relegation && swapAbaixo != null) {
    marca.push("SEM-REBAIX"); problemas.push(`${div}: a piramide troca ${swapAbaixo} e a competicao nao declara relegation`)
  }
  console.log(
    div.padEnd(20) + String(n).padEnd(7) + String(jogado).padEnd(7) + String(c.teams ?? "-").padEnd(8) +
    `${c.rounds ?? "-"} (${esperado})`.padEnd(13) +
    String(c.relegation ?? "-").padEnd(7) + String(swapAbaixo ?? "-").padEnd(9) +
    abaixo.padEnd(18) + marca.join(","))
}

console.log(`\n${problemas.length} inconsistencias:`)
for (const p of problemas) console.log("  ! " + p)
