// GERA O MANIFESTO DE QUALIDADE DAS LIGAS JOGÁVEIS.
//
// A auditoria da 3.0 pediu "ligas principais sem elencos genéricos ou pirâmides
// incompletas" e "priorize as ligas que aparecem na criação de carreira". Medido
// em 11/08/2026: de 1.879 clubes jogáveis, **480 têm menos de 18 atletas de
// fonte real e 320 não têm nenhum** — o jogo mascara isso com atleta gerado, e
// quem escolhe a liga não tem como saber antes de começar a carreira.
//
// Enquanto os elencos não são importados (é tarefa de dado, não de código), o
// mínimo honesto é DIZER. Este script mede e grava o resultado; a tela de nova
// carreira lê o manifesto e mostra o selo.
//
//   npx tsx scripts/gerar-qualidade-das-ligas.ts
//
// ⚠️ RODE DE NOVO depois de importar elencos ou mexer nas pirâmides. O manifesto
// é derivado: editá-lo à mão faz a tela prometer elenco real que não existe.

import { writeFileSync } from "node:fs"
import path from "node:path"
import { competitionsByLeague } from "../lib/international-competitions"
import { promotionCount, relegationCount } from "../lib/league-pyramid"
import { completarLigaComPool } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

/** Elenco: "real" = todo clube com 18+ atletas de fonte; "parcial"; "generico". */
export type NivelDeElenco = "real" | "parcial" | "generico"
/** Pirâmide: "viva" = sobe e desce; "ponta" = só uma das pontas; "isolada" = nenhuma. */
export type NivelDePiramide = "viva" | "ponta" | "isolada"

interface QualidadeDaLiga {
  clubes: number
  /** Clubes com 18+ atletas de fonte real (não gerados). */
  clubesComElencoReal: number
  elenco: NivelDeElenco
  piramide: NivelDePiramide
  sobe: number
  desce: number
}

const manifesto: Record<string, QualidadeDaLiga> = {}

for (const divisao of Object.keys(competitionsByLeague)) {
  const times = completarLigaComPool(divisao)
  if (!times.length) continue

  let comElencoReal = 0
  for (const time of times) {
    const elenco = getPlayersForTeam(time, { raw: true })
    const reais = elenco.length - elenco.filter(p => p.generatedOrigin === "provisional").length
    if (reais >= 18) comElencoReal++
  }

  const fracao = comElencoReal / times.length
  const sobe = promotionCount(divisao)
  const desce = relegationCount(divisao)

  manifesto[divisao] = {
    clubes: times.length,
    clubesComElencoReal: comElencoReal,
    // Limiares escolhidos para casar com o que o jogador percebe: abaixo de 60%
    // do elenco real o campeonato inteiro "parece inventado" na tela de elenco.
    elenco: fracao >= 0.95 ? "real" : fracao >= 0.6 ? "parcial" : "generico",
    piramide: sobe > 0 && desce > 0 ? "viva" : sobe > 0 || desce > 0 ? "ponta" : "isolada",
    sobe,
    desce,
  }
}

const destino = path.resolve("data/seeds/qualidade-das-ligas.json")
writeFileSync(destino, `${JSON.stringify(manifesto)}\n`)

const porNivel = (n: NivelDeElenco) => Object.values(manifesto).filter(q => q.elenco === n).length
const isoladas = Object.values(manifesto).filter(q => q.piramide === "isolada").length
console.log(`ligas medidas: ${Object.keys(manifesto).length}`)
console.log(`elenco real: ${porNivel("real")} | parcial: ${porNivel("parcial")} | genérico: ${porNivel("generico")}`)
console.log(`pirâmide isolada (não sobe nem desce): ${isoladas}`)
console.log(`escrito em ${destino}`)
