// AUDITORIA: cada pais tem 1a a 4a divisao? Licenciada? Regulamentada?
//
//   node auditar-divisoes.mjs <manifesto elencos.json>
//
// ⚠️ O INVENTARIO SAI DO CAMPO `divisao` DE CADA CLUBE, nao do array em que ele
// esta declarado. Os ~27 clubes criados para as competicoes reais de 2026
// (Libertadores/Sul-Americana/Champions) foram escritos DENTRO de
// `primeraDivChileTeams`, mas cada um tem `divisao: "primera_div_per"`,
// `"super_league_gre"` etc. Auditar por array dizia "Chile tem 59 clubes" e
// escondia 11 ligas inteiras.
//
// "Licenciada" = o clube tem ESCUDO que aparece no app instalado. A resolucao e
// a MESMA de getEscudoUrl (lib/escudos-map):
//     localEscudoMap[fileKey]  ??  /escudos/<fileKey>.png
// com localEscudoMap = escudos-generated-map + user-crest-overrides + literais.
// ⚠️ Conferir so a RAIZ de public/escudos da falso negativo em massa: o PSG
// existe, mas como `/escudos/ligue_1/psg.png`.
//
// "Regulamentada" = competicao propria em competitionsByLeague (lib/
// international-competitions) + acesso/rebaixamento em PYRAMIDS.
import fs from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const ler = p => fs.readFileSync(path.join(RAIZ, p), "utf8")
const lerJson = p => JSON.parse(ler(p))

const fonte = ler("lib/international-teams.ts") + "\n" + ler("lib/teams-data.ts")
const comps = ler("lib/international-competitions.ts")
const pyr = ler("lib/league-pyramid.ts")

// ─── Todos os clubes CURADOS, com divisao e pais ─────────────────────────────
const clubes = []
for (const m of fonte.matchAll(/\{[^{}]*\}/g)) {
  const b = m[0]
  const fk = b.match(/file_key:\s*"([^"]+)"/)
  const div = b.match(/divisao:\s*"([^"]+)"/)
  if (!fk || !div) continue
  const pais = b.match(/pais:\s*"([^"]+)"/)
  const estado = b.match(/estado:\s*"([^"]+)"/)
  clubes.push({ fk: fk[1], divisao: div[1], pais: pais?.[1] ?? estado?.[1] ?? "?" })
}

// ─── Pais e nivel de cada divisao ────────────────────────────────────────────
const PAIS_TIER = {
  serie_a: ["Brasil", 1], serie_b: ["Brasil", 2], serie_c: ["Brasil", 3], serie_d: ["Brasil", 4],
  premier_league: ["Inglaterra", 1], championship: ["Inglaterra", 2],
  la_liga: ["Espanha", 1], la_liga_2: ["Espanha", 2],
  serie_a_ita: ["Italia", 1], serie_b_ita: ["Italia", 2],
  bundesliga: ["Alemanha", 1], bundesliga_2: ["Alemanha", 2],
  ligue_1: ["Franca", 1], ligue_2: ["Franca", 2],
  saudi_pro: ["Arabia Saudita", 1], saudi_first_div: ["Arabia Saudita", 2],
  primeira_liga: ["Portugal", 1], eredivisie: ["Holanda", 1], liga_argentina: ["Argentina", 1],
  mls: ["EUA", 1], liga_mx: ["Mexico", 1], j_league: ["Japao", 1], k_league_1: ["Coreia do Sul", 1],
  chinese_super: ["China", 1], scottish_prem: ["Escocia", 1], super_lig: ["Turquia", 1],
  pro_league_bel: ["Belgica", 1], russian_prem: ["Russia", 1], primera_a_col: ["Colombia", 1],
  primera_div_chi: ["Chile", 1], primera_b_chi: ["Chile", 2], primera_div_ury: ["Uruguai", 1], primera_a_ecu: ["Equador", 1],
  primera_div_per: ["Peru", 1], primera_div_bol: ["Bolivia", 1], primera_div_par: ["Paraguai", 1],
  primera_div_ven: ["Venezuela", 1], super_league_gre: ["Grecia", 1], superliga_den: ["Dinamarca", 1],
  fortuna_liga_cze: ["Chequia", 1], premyer_liqa_aze: ["Azerbaijao", 1], eliteserien_nor: ["Noruega", 1],
  protathlima_cyp: ["Chipre", 1], premier_liga_kaz: ["Cazaquistao", 1],
  // Segundas divisoes ligadas em 04/08 (ver ultrafoot-configuracao-das-ligas).
  k_league_2: ["Coreia do Sul", 2], liga_portugal_2: ["Portugal", 2],
  eerste_divisie: ["Holanda", 2], challenger_pro: ["Belgica", 2],
  tff_1_lig: ["Turquia", 2], russian_first: ["Russia", 2],
  primera_b_arg: ["Argentina", 2], torneo_betplay: ["Colombia", 2],
  segunda_div_ury: ["Uruguai", 2], china_league_one: ["China", 2],
  scottish_champ: ["Escocia", 2], serie_b_ecu: ["Equador", 2],
}

const naPiramide = new Set()
for (const m of pyr.matchAll(/tiers:\s*\[([^\]]+)\]/g)) for (const t of m[1].matchAll(/"([^"]+)"/g)) naPiramide.add(t[1])

const blocoComps = comps.slice(comps.indexOf("export const competitionsByLeague"))
const comCompeticao = new Map()
for (const m of blocoComps.matchAll(/^\s{2}([a-z_0-9]+):\s*\[/gm)) {
  const resto = blocoComps.slice(m.index)
  const corte = resto.indexOf("\n  ],")
  const ate = corte > 0 ? resto.slice(0, corte) : resto.slice(0, 4000)
  comCompeticao.set(m[1], [...ate.matchAll(/id:\s*"([^"]+)"/g)].map(x => x[1]))
}

// ─── Escudo: a mesma resolucao do jogo ───────────────────────────────────────
const arquivos = new Set()
;(function anda(dir, base = "/escudos") {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) anda(path.join(dir, e.name), `${base}/${e.name}`)
    else if (/\.(png|webp|svg|jpe?g)$/i.test(e.name)) arquivos.add(`${base}/${e.name}`)
  }
})(path.join(RAIZ, "public/escudos"))

const mapa = { ...lerJson("data/seeds/escudos-generated-map.json"), ...lerJson("data/seeds/user-crest-overrides.json") }
for (const m of ler("lib/escudos-map.ts").matchAll(/"([^"]+)":\s*"(\/escudos\/[^"]+)"/g)) mapa[m[1]] = m[2]

const emb = lerJson("data/seeds/team-overrides.json")
// Manifesto do canal (opcional): sem ele, escudo/uniforme publicados na VPS
// nao contam e as colunas ficam so com o que viaja no build.
//   curl -s https://ultrafoot.179-198-103-30.sslip.io/atualizacoes/elencos.json -o el.json
const canal = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")) : { times: {} }
// ⚠️ `.webp`, NAO `.png`. Os escudos empacotados foram convertidos para WebP sem
// perdas; este fallback continuou em `.png` e o auditor passou a acusar 49 clubes
// "sem escudo" que existem e aparecem em jogo — o numero real era 18. Gate que
// mente e pior que gate nenhum. A fonte da verdade e `getLocalEscudoPath`
// (lib/escudos-map), que resolve `/escudos/<fileKey>.webp`.
const temEscudo = fk => arquivos.has(mapa[fk] ?? `/escudos/${fk}.webp`) || Boolean(emb[fk]?.logoUrl) || Boolean(canal.times?.[fk]?.logoUrl)
const temKit = fk => Boolean(canal.times?.[fk]?.kits)

// ─── Agrega ──────────────────────────────────────────────────────────────────
const porDivisao = new Map()
for (const c of clubes) {
  if (!porDivisao.has(c.divisao)) porDivisao.set(c.divisao, [])
  porDivisao.get(c.divisao).push(c)
}
const porPais = new Map()
const desconhecidas = []
for (const [div, cs] of porDivisao) {
  const info = PAIS_TIER[div]
  if (!info) { desconhecidas.push(`${div} (${cs.length} clubes)`); continue }
  const [pais, tier] = info
  const sem = cs.filter(c => !temEscudo(c.fk))
  if (!porPais.has(pais)) porPais.set(pais, [])
  porPais.get(pais).push({
    div, tier, n: cs.length, comEsc: cs.length - sem.length,
    comKit: cs.filter(c => temKit(c.fk)).length, sem,
    piramide: naPiramide.has(div), regulamento: comCompeticao.get(div)?.[0] ?? null,
  })
}

const pct = (a, b) => (b ? Math.round(100 * a / b) + "%" : "-")
console.log("PAIS             DIV LIGA               CLUBES ESCUDO       UNIFORME     ACESSO REGULAMENTO")
for (const [pais, ls] of [...porPais].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
  for (const l of ls.sort((a, b) => a.tier - b.tier)) {
    console.log(pais.padEnd(16) + String(l.tier).padEnd(4) + l.div.padEnd(19) + String(l.n).padEnd(7) +
      `${l.comEsc}/${l.n} ${pct(l.comEsc, l.n)}`.padEnd(13) + `${l.comKit}/${l.n} ${pct(l.comKit, l.n)}`.padEnd(13) +
      (l.piramide ? "sim" : "NAO").padEnd(7) + (l.regulamento ?? "NENHUM"))
  }
  const faltam = [1, 2, 3, 4].filter(t => !ls.some(l => l.tier === t))
  if (faltam.length) console.log(" ".repeat(16) + `    >>> SEM ${faltam.map(f => f + "a").join(", ")}`)
}
if (desconhecidas.length) console.log("\ndivisoes sem pais mapeado nesta auditoria: " + desconhecidas.join(", "))

const paises = [...porPais]
console.log(`\npaises jogaveis: ${paises.length} | divisoes: ${[...porDivisao].filter(([d]) => PAIS_TIER[d]).length} de ${paises.length * 4} possiveis (1a a 4a)`)
console.log(`4 divisoes: ${paises.filter(([, l]) => l.length >= 4).map(([p]) => p).join(", ") || "nenhum"}`)
console.log(`2 divisoes: ${paises.filter(([, l]) => l.length === 2).map(([p]) => p).join(", ")}`)
console.log(`1 divisao : ${paises.filter(([, l]) => l.length === 1).length} paises`)
const semReg = paises.flatMap(([p, ls]) => ls.filter(l => !l.regulamento).map(l => `${p}/${l.div}`))
console.log(`sem regulamento: ${semReg.join(", ") || "nenhuma"}`)
console.log(`sem acesso/rebaixamento: ${paises.flatMap(([, ls]) => ls).filter(l => !l.piramide).length} divisoes`)
const semEsc = paises.flatMap(([p, ls]) => ls.flatMap(l => l.sem.map(c => `${c.fk} (${p}/${l.div})`)))
console.log(`\nclubes sem escudo (${semEsc.length}): ${semEsc.join(", ") || "nenhum"}`)
