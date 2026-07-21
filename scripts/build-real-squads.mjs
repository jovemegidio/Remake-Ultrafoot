// Constroi a camada de ELENCOS REAIS a partir do que foi coletado no
// Transfermarkt (tm-squads.json), para o jogo usar jogadores reais.
//
// Decisao do usuario (21/07/2026): overall derivado do VALOR DE MERCADO,
// calibrado por faixa. O TM nao tem overall; o valor e o melhor proxy de nivel.
//
// Saida: data/seeds/real-squads-tm.json
//   { "<curto>|<nomeNormalizado>": [ {nome, pos, nac, ft, idade, overall}, ... ] }
// Consumida como camada de MAIOR prioridade em lib/players-data (clubes sem
// entrada aqui seguem como antes — a maioria dos ~1.050 clubes ficticios).
//
//   node scripts/build-real-squads.mjs

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const TM = path.resolve("data/seeds/tm-squads.json")
const SEED = path.resolve("data/seeds/imported-bf2026.json")
const OUT = path.resolve("data/seeds/real-squads-tm.json")

const nameKey = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/**
 * VALOR DE MERCADO (€) -> OVERALL, calibrado por ancoras reais:
 *   €200M -> 91 | €80M -> 87 | €30M -> 83 | €10M -> 78
 *   €3M  -> 72 | €1M -> 68 | €300k -> 63 | €50k -> 57
 * Interpola em log10 do valor (o valor cresce por ordens de grandeza; o overall,
 * linear). Fora das ancoras, extrapola preso ao intervalo [52, 93].
 */
const ANCORAS = [
  [200_000_000, 91], [80_000_000, 87], [30_000_000, 83], [10_000_000, 78],
  [3_000_000, 72], [1_000_000, 68], [300_000, 63], [50_000, 57],
].map(([v, o]) => [Math.log10(v), o])

function overallDeValor(valor) {
  if (!valor || valor <= 0) return null
  const x = Math.log10(valor)
  // acima/abaixo das pontas: extrapola com a inclinacao da ponta
  if (x >= ANCORAS[0][0]) return Math.min(93, Math.round(ANCORAS[0][1] + (x - ANCORAS[0][0]) * 3))
  if (x <= ANCORAS.at(-1)[0]) return Math.max(52, Math.round(ANCORAS.at(-1)[1] + (x - ANCORAS.at(-1)[0]) * 3))
  for (let i = 0; i < ANCORAS.length - 1; i++) {
    const [xa, oa] = ANCORAS[i], [xb, ob] = ANCORAS[i + 1]
    if (x <= xa && x >= xb) {
      const t = (x - xb) / (xa - xb)
      return Math.round(ob + t * (oa - ob))
    }
  }
  return null
}

async function main() {
  const tm = JSON.parse(await readFile(TM, "utf8"))
  const seed = JSON.parse(await readFile(SEED, "utf8"))

  // idade real do seed por (clube, nome) — carregada quando o TM nao tem idade.
  const idadeSeed = new Map()
  for (const t of seed.teams ?? []) {
    for (const j of t.jogadores ?? []) {
      idadeSeed.set(`${t.curto}|${nameKey(t.nome)}|${nameKey(j.nome)}`, j.idade)
    }
  }

  const saida = {}
  let clubes = 0, atletas = 0, semValor = 0

  for (const [chave, club] of Object.entries(tm.clubs)) {
    if (!club.players?.length) continue
    const curto = chave.split("|")[0]
    const clubeNorm = chave.split("|")[1] ?? ""

    // Overalls a partir do valor; idade do TM ou do seed; mediana como reserva.
    const idadesConhecidas = club.players.map(p => p.idade).filter(n => n != null).sort((a, b) => a - b)
    const idadeMediana = idadesConhecidas.length ? idadesConhecidas[Math.floor(idadesConhecidas.length / 2)] : 25

    const overallsConhecidos = club.players.map(p => overallDeValor(p.valor)).filter(n => n != null).sort((a, b) => a - b)
    const overallMediano = overallsConhecidos.length ? overallsConhecidos[Math.floor(overallsConhecidos.length / 2)] : 66

    const roster = club.players
      .filter(p => p.nome && p.posicao)
      .map(p => {
        const ov = overallDeValor(p.valor)
        if (ov == null) semValor++
        return {
          nome: p.nome,
          pos: p.posicao,
          nac: p.nacionalidade ?? undefined,
          ft: p.foto ? /portrait\/\w+\/([\d-]+)\.jpg/.exec(p.foto)?.[1] : undefined,
          idade: p.idade ?? idadeSeed.get(`${curto}|${clubeNorm}|${nameKey(p.nome)}`) ?? idadeMediana,
          overall: ov ?? overallMediano,
        }
      })

    if (roster.length < 7) continue // elenco curto demais nao substitui nada
    saida[chave] = roster
    clubes++
    atletas += roster.length
  }

  await writeFile(OUT, JSON.stringify(saida))
  console.log(`clubes com elenco real : ${clubes}`)
  console.log(`atletas reais          : ${atletas}`)
  console.log(`  sem valor (overall estimado pela mediana do clube): ${semValor}`)
  console.log(`arquivo: ${path.relative(process.cwd(), OUT)}`)
}

main()
