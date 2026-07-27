// OVERALLS REAIS a partir do VALOR DE MERCADO do Transfermarkt (pedido do usuário:
// "os overais devem ser reais, pesquise no transfermarkt").
//
// O TM não tem "overall" (isso é FIFA/FM) — tem VALOR DE MERCADO (€), que é o
// melhor sinal público e pesquisável da qualidade real de um jogador. Aqui
// derivamos um overall ABSOLUTO do valor, com curva logarítmica calibrada e
// ajustes de idade (valor superestima jovens, subestima veteranos) e de posição
// (goleiro é sistematicamente subvalorizado no mercado).
//
// Curva base: overall = 10·log10(valor€) + 9  → €200M≈91, €50M≈86, €8M≈78,
// €1M≈69, €275k≈63, €50k≈55. Clamp [45, 91].
//
// SÓ mexe em quem TEM valor e casou com o TM (por nome). Sem valor = mantém o
// overall/base atual (derivado do seed). Faz backup antes de escrever.
//
//   node scripts/apply-tm-real-overalls.mjs          (dry-run: só relatório)
//   node scripts/apply-tm-real-overalls.mjs --write   (aplica + backup)

import { readFile, writeFile, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const WRITE = process.argv.includes("--write")
const POOL = path.resolve("data/seeds/imported-bf2026.json")
const BR = path.resolve("data/seeds/players_br.json")
const TM = path.resolve("data/seeds/tm-squads.json")

const nameKey = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/** Ajuste de idade: valor de mercado superestima jovens (potencial) e subestima
 *  veteranos (experiência que o skill mantém mesmo com valor em queda). */
function ajusteIdade(idade) {
  if (idade == null) return 0
  if (idade <= 19) return -5
  if (idade === 20) return -4
  if (idade === 21) return -3
  if (idade === 22) return -2
  if (idade === 23) return -1
  if (idade <= 29) return 0
  if (idade === 30) return 1
  if (idade === 31) return 2
  if (idade === 32) return 3
  if (idade === 33) return 4
  return 5
}

/** Overall REAL a partir do valor de mercado (€), idade e posição. */
function overallDoValor(valor, idade, pos) {
  if (!valor || valor < 10000) return null // sem sinal confiável
  let ov = 10 * Math.log10(valor) + 9
  ov += ajusteIdade(idade)
  // Goleiro é subvalorizado no mercado (um GK top vale bem menos que um atacante
  // top de mesmo nível). Corrige levemente para não achatar os goleiros — bônus
  // pequeno (+2) para ajudar os GKs de elite sem inflar os reservas.
  if (pos === "GOL" || pos === "GL") ov += 2
  return Math.max(45, Math.min(91, Math.round(ov)))
}

async function main() {
  const tm = JSON.parse(await readFile(TM, "utf8"))
  const clubs = tm.clubs ?? {}

  // Índice por nome de clube (para casar tanto por curto|nome quanto só por nome).
  const clubPorNome = new Map()
  for (const [key, c] of Object.entries(clubs)) {
    if (c?.nome) clubPorNome.set(nameKey(c.nome), c)
  }
  // valor/idade/pos por (clube -> nome do jogador)
  const infoDoClube = (c) => {
    const m = new Map()
    for (const p of c?.players ?? []) if (p.valor != null) m.set(nameKey(p.nome), { valor: p.valor, idade: p.idade, pos: p.posicao })
    return m
  }

  const amostra = []
  let poolClubes = 0, poolAtletas = 0
  // ── POOL (imported-bf2026): campo .teams[].jogadores[].overall ──────────────
  const pool = JSON.parse(await readFile(POOL, "utf8"))
  for (const team of pool.teams ?? []) {
    const c = clubs[`${team.curto}|${nameKey(team.nome)}`] ?? clubPorNome.get(nameKey(team.nome))
    if (!c) continue
    const info = infoDoClube(c)
    if (!info.size) continue
    let mexeu = false
    for (const j of team.jogadores ?? []) {
      const it = info.get(nameKey(j.nome))
      if (!it) continue
      const novo = overallDoValor(it.valor, it.idade ?? j.idade, j.pos ?? it.pos)
      if (novo == null) continue
      if (j.overall !== novo) {
        if (amostra.length < 25 && Math.abs((j.overall ?? 0) - novo) >= 4)
          amostra.push(`${team.curto} ${j.nome} (${j.pos},${it.idade}a €${(it.valor / 1e6).toFixed(1)}mi): ${j.overall} -> ${novo}`)
        j.overall = novo; mexeu = true; poolAtletas++
      }
    }
    if (mexeu) poolClubes++
  }

  // ── CURADOS BR (players_br.json): keyed por NOME do clube, campo .base ──────
  let brClubes = 0, brAtletas = 0
  const br = JSON.parse(await readFile(BR, "utf8"))
  for (const [clube, lista] of Object.entries(br)) {
    const c = clubPorNome.get(nameKey(clube))
    if (!c) continue
    const info = infoDoClube(c)
    if (!info.size) continue
    let mexeu = false
    for (const j of lista) {
      const it = info.get(nameKey(j.nome))
      if (!it) continue
      const novo = overallDoValor(it.valor, it.idade ?? j.idade, j.pos ?? it.pos)
      if (novo == null) continue
      if (j.base !== novo) {
        if (amostra.length < 50 && Math.abs((j.base ?? 0) - novo) >= 4)
          amostra.push(`${clube} ${j.nome} (${j.pos},${it.idade}a €${(it.valor / 1e6).toFixed(1)}mi): ${j.base} -> ${novo}`)
        j.base = novo; mexeu = true; brAtletas++
      }
    }
    if (mexeu) brClubes++
  }

  // ── ÂNCORA POR CLUBE: um jogador SEM valor TM não pode ficar acima do nível
  // REAL do seu clube. Ancoramos pela MEDIANA dos overalls de quem TEM valor (+4
  // de margem); clubes sem nenhum match caem a um teto de clube obscuro (66).
  // Corrige os ~545 clubes pequenos que ficaram com elenco inteiro ~91 por
  // prestígio corrompido no seed (Flamengo PI, Barcelona II, River Plate Asunción...).
  const median = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2) }
  let ancPool = 0, ancBR = 0
  for (const team of pool.teams ?? []) {
    const c = clubs[`${team.curto}|${nameKey(team.nome)}`] ?? clubPorNome.get(nameKey(team.nome))
    const valSet = new Set(); if (c) for (const p of c.players ?? []) if (p.valor != null) valSet.add(nameKey(p.nome))
    const js = team.jogadores ?? []
    const matched = js.filter(j => valSet.has(nameKey(j.nome))).map(j => j.overall).filter(o => typeof o === "number")
    const anchor = matched.length ? median(matched) + 4 : 66
    for (const j of js) if (!valSet.has(nameKey(j.nome)) && typeof j.overall === "number" && j.overall > anchor) { j.overall = anchor; ancPool++ }
  }
  for (const [clube, lista] of Object.entries(br)) {
    const c = clubPorNome.get(nameKey(clube))
    const valSet = new Set(); if (c) for (const p of c.players ?? []) if (p.valor != null) valSet.add(nameKey(p.nome))
    const matched = lista.filter(j => valSet.has(nameKey(j.nome))).map(j => j.base).filter(o => typeof o === "number")
    const anchor = matched.length ? median(matched) + 4 : 66
    for (const j of lista) if (!valSet.has(nameKey(j.nome)) && typeof j.base === "number" && j.base > anchor) { j.base = anchor; ancBR++ }
  }
  console.log(`ÂNCORA: ${ancPool} atletas de pool + ${ancBR} BR rebaixados ao nível real do clube`)

  // ── NORMALIZAÇÃO GERAL: nenhum overall/base pode passar de 91 nem cair de 40.
  // O pool tinha clubes filler com valores CORROMPIDOS (105-107) em quem não tem
  // valor TM — origem real do relato "overall 99+". Aqui capamos TODOS.
  let capPool = 0, capBR = 0
  for (const team of pool.teams ?? []) for (const j of team.jogadores ?? []) {
    if (typeof j.overall === "number") { const c = Math.max(40, Math.min(91, Math.round(j.overall))); if (c !== j.overall) { j.overall = c; capPool++ } }
  }
  for (const lista of Object.values(br)) for (const j of lista) {
    if (typeof j.base === "number") { const c = Math.max(40, Math.min(91, Math.round(j.base))); if (c !== j.base) { j.base = c; capBR++ } }
  }

  console.log(`POOL  : ${poolClubes} clubes, ${poolAtletas} atletas com overall real (${capPool} capados a [40,91])`)
  console.log(`BR    : ${brClubes} clubes, ${brAtletas} atletas com base real (${capBR} capados)`)
  console.log(`\namostra (mudança >= 4):`)
  for (const a of amostra) console.log("  " + a)

  if (WRITE) {
    if (!existsSync(POOL + ".pre-real-ov")) await copyFile(POOL, POOL + ".pre-real-ov")
    if (!existsSync(BR + ".pre-real-ov")) await copyFile(BR, BR + ".pre-real-ov")
    pool.realOverallsAt = new Date().toISOString()
    await writeFile(POOL, JSON.stringify(pool))
    await writeFile(BR, JSON.stringify(br))
    console.log("\n✔ aplicado + backup (.pre-real-ov)")
  } else {
    console.log("\n(dry-run — rode com --write para aplicar)")
  }
}

main()
