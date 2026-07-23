// Supercopas: decisões entre campeões da temporada ANTERIOR.
//
// Supercopa do Brasil, Recopa Sul-Americana, Supercopa da UEFA e Mundial de
// Clubes já tinham troféu e tela de abertura em lib/competition-intro.ts, mas
// nenhuma gerava partida — eram arte sem jogo.
//
// Diferente das copas normais, não há sorteio nem chaveamento: os participantes
// são conhecidos pelo próprio histórico do save. Isso só se tornou possível
// depois que `seasonHistory` passou a ser preenchido de verdade (antes era um
// array vazio permanente).

import type { SeasonRecord } from "@/lib/career-types"

export type SuperCupId = "supercopa_brasil" | "recopa_sulamericana" | "supercopa_uefa" | "mundial_clubes"

export interface SuperCupBerth {
  id: SuperCupId
  name: string
  /** Como o clube se classificou — mostrado ao jogador. */
  reason: string
  /** Jogo único ou ida e volta. */
  matchCount: number
  /** Ordem de disputa dentro da pré-temporada. */
  priority: number
}

const CATALOGO: Record<SuperCupId, Omit<SuperCupBerth, "reason">> = {
  supercopa_brasil:   { id: "supercopa_brasil",   name: "Supercopa do Brasil",     matchCount: 1, priority: 1 },
  recopa_sulamericana:{ id: "recopa_sulamericana",name: "Recopa Sul-Americana",    matchCount: 2, priority: 2 },
  supercopa_uefa:     { id: "supercopa_uefa",     name: "Supercopa da UEFA",       matchCount: 1, priority: 2 },
  mundial_clubes:     { id: "mundial_clubes",     name: "Mundial de Clubes FIFA",  matchCount: 2, priority: 3 },
}

/** Normaliza para comparar nomes de competição vindos de fontes diferentes. */
function chave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function foiCampeao(registro: SeasonRecord, clubeCurto: string): boolean {
  return registro.position === 1 || registro.champion === clubeCurto
}

/**
 * Vagas conquistadas para a temporada `temporadaAtual`, a partir do que o clube
 * fez na anterior.
 *
 * Só considera a última temporada: ser campeão em 2026 dá direito à Supercopa de
 * 2027, não a todas as seguintes.
 */
export function berthsForSeason(
  seasonHistory: readonly SeasonRecord[] | undefined,
  clubeCurto: string,
  temporadaAtual: number,
): SuperCupBerth[] {
  if (!seasonHistory?.length || !clubeCurto) return []

  const anterior = seasonHistory.filter(r => r.season === temporadaAtual - 1 && r.teamCurto === clubeCurto)
  if (anterior.length === 0) return []

  const vagas: SuperCupBerth[] = []
  const conquistou = (id: SuperCupId, reason: string) => {
    if (vagas.some(v => v.id === id)) return
    vagas.push({ ...CATALOGO[id], reason })
  }

  for (const registro of anterior) {
    if (!foiCampeao(registro, clubeCurto)) continue
    const comp = chave(registro.competition)

    // Brasil: campeão do Brasileirão OU da Copa do Brasil disputa a Supercopa.
    if (comp.includes("brasileirao") || comp.includes("copadobrasil")) {
      conquistou("supercopa_brasil", `Campeão: ${registro.competition} ${registro.season}`)
    }
    // Libertadores dá Recopa e Mundial; Sul-Americana dá só a Recopa.
    if (comp.includes("libertadores")) {
      conquistou("recopa_sulamericana", `Campeão da Libertadores ${registro.season}`)
      conquistou("mundial_clubes", `Campeão da Libertadores ${registro.season}`)
    }
    if (comp.includes("sulamericana") || comp.includes("sudamericana")) {
      conquistou("recopa_sulamericana", `Campeão da Sul-Americana ${registro.season}`)
    }
    // Europa: Champions dá Supercopa da UEFA e Mundial; Europa League dá a Supercopa.
    if (comp.includes("championsleague")) {
      conquistou("supercopa_uefa", `Campeão da Champions ${registro.season}`)
      conquistou("mundial_clubes", `Campeão da Champions ${registro.season}`)
    }
    if (comp.includes("europaleague")) {
      conquistou("supercopa_uefa", `Campeão da Europa League ${registro.season}`)
    }
  }

  return vagas.sort((a, b) => a.priority - b.priority)
}

/** Quantas partidas as supercopas somam à temporada. */
export function superCupMatchCount(vagas: readonly SuperCupBerth[]): number {
  return vagas.reduce((total, vaga) => total + vaga.matchCount, 0)
}

/**
 * Vaga na continental PRINCIPAL por titulo continental na temporada anterior,
 * como na vida real: campeao da Sul-Americana entra na Libertadores; campeao da
 * Europa League entra na Champions. Vencer a principal (Libertadores/Champions)
 * tambem garante a vaga do ano seguinte.
 *
 * Retorna "primary" quando o clube tem vaga garantida na continental de topo do
 * seu continente — independentemente da posicao na liga.
 */
export function continentalTitleBerth(
  seasonHistory: readonly SeasonRecord[] | undefined,
  clubeCurto: string,
  temporadaAtual: number,
): "primary" | null {
  if (!seasonHistory?.length || !clubeCurto) return null
  const anterior = seasonHistory.filter(r => r.season === temporadaAtual - 1 && r.teamCurto === clubeCurto)
  for (const r of anterior) {
    if (!foiCampeao(r, clubeCurto)) continue
    const c = chave(r.competition)
    if (/sulamericana|sudamericana|europaleague|libertadores|championsleague/.test(c)) return "primary"
  }
  return null
}
