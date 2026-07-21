// Recalibra os OVERALLS pelo valor de mercado do Transfermarkt.
//
// O TM NAO tem "overall" (conceito de FIFA/FM); tem VALOR DE MERCADO. Derivar um
// overall absoluto de € seria uma formula arbitraria e ainda quebraria o
// equilibrio de liga que o seed ja tem (Serie A capada em 92, C em 74, etc.).
//
// O que fazemos, dentro de cada clube ACEITO: mantemos EXATAMENTE o conjunto de
// overalls do clube e apenas o PERMUTAMOS para acompanhar a ordem de valor — o
// atleta mais valioso recebe o maior overall do clube, o segundo o segundo, e
// assim por diante. Corrige o caso real ("craque avaliado abaixo de um reserva")
// sem inflar nem achatar ninguem: a media e a faixa do clube ficam identicas.
//
// So mexe em atletas que TEM valor e cujo clube casou com o TM (mesma regra de
// nome do apply-tm-squads). Roda depois de import-tm-values.mjs.
//
//   node scripts/apply-tm-overalls.mjs

import { readFile, writeFile, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const SEED = path.resolve("data/seeds/imported-bf2026.json")
const TM = path.resolve("data/seeds/tm-squads.json")
const BACKUP = path.resolve("data/seeds/imported-bf2026.pre-overalls.json")

const nameKey = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

async function main() {
  const tm = JSON.parse(await readFile(TM, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8"))
  if (!existsSync(BACKUP)) await copyFile(SEED, BACKUP)

  let clubes = 0, reordenados = 0, trocas = 0
  const amostra = []

  for (const team of seed.teams ?? []) {
    const club = tm.clubs?.[`${team.curto}|${nameKey(team.nome)}`]
    if (!club?.players?.length) continue

    // valor por nome (do elenco TM casado com este clube)
    const valorPorNome = new Map()
    for (const p of club.players) if (p.valor != null) valorPorNome.set(nameKey(p.nome), p.valor)
    if (valorPorNome.size < 2) continue

    // Atletas do seed que tem valor conhecido. Reordenamos SO entre eles.
    const comValor = (team.jogadores ?? [])
      .map((j, idx) => ({ j, idx, valor: valorPorNome.get(nameKey(j.nome)) }))
      .filter(x => x.valor != null)
    if (comValor.length < 2) continue

    // O conjunto de overalls desses atletas, do maior para o menor.
    const overallsOrdenados = comValor.map(x => x.j.overall).sort((a, b) => b - a)
    // Os atletas por valor, do mais caro para o mais barato.
    const porValor = [...comValor].sort((a, b) => b.valor - a.valor)

    let mudouAlgum = false
    porValor.forEach((x, i) => {
      const novo = overallsOrdenados[i]
      if (x.j.overall !== novo) {
        if (amostra.length < 20 && Math.abs(x.j.overall - novo) >= 3)
          amostra.push(`${team.curto} ${x.j.nome}: ${x.j.overall} -> ${novo} (€${(x.valor / 1e6).toFixed(1)}mi)`)
        x.j.overall = novo
        mudouAlgum = true
        trocas++
      }
    })
    if (mudouAlgum) { clubes++; reordenados += porValor.length }
  }

  seed.overallsAppliedAt = new Date().toISOString()
  await writeFile(SEED, JSON.stringify(seed))

  console.log(`clubes recalibrados : ${clubes}`)
  console.log(`atletas reordenados : ${reordenados}`)
  console.log(`overalls alterados  : ${trocas}`)
  console.log(`backup: ${path.basename(BACKUP)}`)
  console.log(`\namostra (mudanca >= 3 pontos):`)
  for (const a of amostra) console.log("  " + a)
}

main()
