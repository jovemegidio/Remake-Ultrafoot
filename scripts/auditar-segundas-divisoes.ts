// QUAIS LIGAS JOGÁVEIS SÃO BECO SEM SAÍDA, E DÁ PARA CONSERTAR QUAIS?
//
// `auditar-piramide-jogavel.ts` disse QUEM não sobe nem desce. Este diz o
// PORQUÊ de cada caso e se o material para consertar já existe:
//   - a segunda divisão está declarada mas sem participantes?
//   - o pool do país tem clube livre suficiente para preenchê-la?
//
//   npx tsx scripts/auditar-segundas-divisoes.ts

import { competitionsByLeague } from "../lib/international-competitions"
import { promotionCount, relegationCount, PYRAMIDS } from "../lib/league-pyramid"
import { UEFA_EXPANSION_FEDERATIONS } from "../lib/uefa-expansion"
import { completarLigaComPool, allPoolTeams, allTeams } from "../lib/teams-data"

const emPiramide = new Set(PYRAMIDS.flatMap(p => p.tiers))

// Clubes do pool por país, tirando quem já está em alguma divisão jogável.
const jaEmLiga = new Set<string>()
for (const divisao of Object.keys(competitionsByLeague)) {
  for (const t of completarLigaComPool(divisao)) jaEmLiga.add(t.file_key)
}
for (const t of allTeams) jaEmLiga.add(t.file_key)

const livresPorPais = new Map<string, number>()
for (const t of allPoolTeams) {
  if (jaEmLiga.has(t.file_key)) continue
  const pais = (t as { pais?: string }).pais ?? "?"
  livresPorPais.set(pais, (livresPorPais.get(pais) ?? 0) + 1)
}

const segundaDeclarada = new Map<string, { pais: string; participantes: number; rebaixa: number }>()
for (const f of UEFA_EXPANSION_FEDERATIONS) {
  if (f.second && f.top) {
    segundaDeclarada.set(f.top.id, {
      pais: f.country,
      participantes: f.second.participants.length,
      rebaixa: f.top.relegation,
    })
  }
}

const becos: string[] = []
for (const divisao of Object.keys(competitionsByLeague)) {
  const times = completarLigaComPool(divisao)
  if (!times.length) continue
  if (promotionCount(divisao) > 0 || relegationCount(divisao) > 0) continue
  becos.push(divisao)
}

console.log(`divisões jogáveis com clube: ${Object.keys(competitionsByLeague).filter(d => completarLigaComPool(d).length).length}`)
console.log(`em alguma pirâmide: ${[...emPiramide].filter(d => completarLigaComPool(d).length).length}`)
console.log(`becos sem saída (com clube): ${becos.length}`)
console.log("")

let comMaterial = 0
for (const divisao of becos) {
  const times = completarLigaComPool(divisao)
  const pais = (times[0] as { pais?: string })?.pais ?? "?"
  const decl = segundaDeclarada.get(divisao)
  const livres = livresPorPais.get(pais) ?? 0
  const material = decl ? decl.participantes : 0
  const podeConsertar = material >= 8 || livres >= 8
  if (podeConsertar) comMaterial++
  console.log(
    `${divisao.padEnd(22)} ${String(times.length).padStart(2)} clubes | país ${pais.padEnd(22)}` +
    ` | 2ª declarada: ${decl ? `${decl.participantes} participantes, rebaixa ${decl.rebaixa}` : "não"}` +
    ` | pool livre do país: ${livres}` +
    ` | ${podeConsertar ? "DÁ PARA CONSERTAR" : "sem material"}`,
  )
}
console.log("")
console.log(`becos que dão para consertar com o material que já existe: ${comMaterial}/${becos.length}`)
