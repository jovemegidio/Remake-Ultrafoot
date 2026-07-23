// MERCADO DE TREINADORES — propostas para quem esta SEM CLUBE.
//
// O problema que isto resolve: a tela /sem-clube gerava ofertas por um hash que
// IGNORAVA a carreira do tecnico. Um campeao que pedia demissao recebia as
// mesmas vagas de 2a divisao que um tecnico fracassado. A "otima temporada" nao
// contava nada depois de sair.
//
// Aqui a reputacao define QUE clubes te procuram: quanto melhor a carreira,
// maior o teto de prestigio dos clubes interessados. Funcao pura e deterministica
// (semente = rodada), para a tela poder testar e para "recusar e continuar"
// trazer um novo lote coerente.

import type { Team } from "@/lib/teams-data"

export interface CoachStanding {
  /** Reputacao 0-100 de buildCareerStats (titulos + aproveitamento + acessos). */
  reputation: number
  /** Titulos de carreira (coachTotalTitles + coachLegacy.totalTitles). */
  totalTitles: number
  /** coachLegacy.reputationLevel, 0-5 (sobe ao encerrar ciclo com titulo). */
  reputationLevel: number
}

const SECOND_DIVISIONS = new Set([
  "championship", "la_liga_2", "serie_b_ita", "bundesliga_2", "ligue_2",
  "liga_portugal_2", "eerste_divisie", "challenger_pro", "tff_1_lig", "russian_first",
  "primera_b_arg", "torneo_betplay", "primera_b_chi", "segunda_div_ury",
  "saudi_first_div", "j2_league", "k_league_2", "china_league_one",
])

const BRAZILIAN_TIERS = ["serie_a", "serie_b", "serie_c", "serie_d"]

function hash(value: string): number {
  let h = 2166136261
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * Pontuacao 0-100 que resume o quanto o tecnico "vale" no mercado. A reputacao
 * pesa mais; titulos e nivel de legado empurram para cima um teto que satura em
 * 100 (nao adianta ter 30 titulos para estourar a escala).
 */
export function coachStandingScore(s: CoachStanding): number {
  const bruto =
    s.reputation * 0.6 +
    Math.min(s.totalTitles, 12) * 3 +
    Math.min(s.reputationLevel, 5) * 4
  return Math.max(0, Math.min(100, Math.round(bruto)))
}

/**
 * Teto de prestigio dos clubes que sondam o tecnico. Um iniciante (score 0)
 * chega a ~64 — 2a divisao e Serie A de baixo investimento, como era antes.
 * Um campeao consagrado (score ~100) alcanca ~94, ou seja, os gigantes passam a
 * ligar. A curva e suave para nao pular de "modesto" a "elite" com um titulo so.
 */
export function prestigeCeilingForStanding(score: number): number {
  return Math.round(63 + (score / 100) * 31) // 63..94
}

/**
 * Clubes que abririam o cargo para este tecnico, na semente dada. Retorna ate
 * `quantidade` propostas das divisoes jogaveis e 2as divisoes do mundo.
 *
 * O teto de prestigio cresce com a reputacao — so um consagrado atrai gigantes.
 * Mas NAO ha piso: um campeao tambem recebe sondagem de clubes pequenos (um
 * clube modesto adora fisgar um tecnico vitorioso). Para o consagrado ver um
 * MIX de verdade — grande, medio e pequeno — o pool e dividido em faixas de
 * prestigio e sorteamos uma de cada. Semente = rodada, entao "recusar e
 * continuar" traz outro lote.
 */
export function ofertasParaDesempregado(
  clubs: readonly Team[],
  standing: CoachStanding,
  seed: number,
  quantidade = 3,
): Team[] {
  const score = coachStandingScore(standing)
  const teto = prestigeCeilingForStanding(score)

  const pool = clubs
    .filter(t => {
      const d = String(t.divisao)
      return (BRAZILIAN_TIERS.includes(d) || SECOND_DIVISIONS.has(d)) && t.prestigio <= teto
    })
    .sort((a, b) => b.prestigio - a.prestigio) // do mais forte ao mais fraco

  if (pool.length <= quantidade) {
    if (pool.length > 0) return pool
    // Sem ninguem sob o teto? Pega os de menor prestigio das divisoes permitidas.
    return clubs
      .filter(t => BRAZILIAN_TIERS.includes(String(t.divisao)) || SECOND_DIVISIONS.has(String(t.divisao)))
      .sort((a, b) => a.prestigio - b.prestigio)
      .slice(0, quantidade)
  }

  // Faixas por VALOR DE PRESTIGIO relativo ao teto (nao por contagem): o pool tem
  // milhares de clubes, quase todos modestos, entao "o terco de cima por
  // quantidade" ainda seria pequeno. Ancorando no teto, a faixa ALTA pega os
  // clubes de fato grandes disponiveis, e a BAIXA os pequenos — o consagrado ve
  // as duas pontas de uma vez.
  const bandas: Array<(p: number) => boolean> = [
    p => p >= teto - 12,                       // fortes
    p => p >= teto - 28 && p < teto - 12,      // medios
    p => p < teto - 28,                        // modestos
  ]
  const escolhidas: Team[] = []
  const usados = new Set<string>()
  const pegar = (faixa: Team[], tag: string) => {
    const livres = faixa.filter(t => !usados.has(t.file_key ?? t.curto))
    if (livres.length === 0) return
    const escolhido = livres[hash(`${seed}:${tag}`) % livres.length]
    usados.add(escolhido.file_key ?? escolhido.curto)
    escolhidas.push(escolhido)
  }
  bandas.slice(0, quantidade).forEach((teste, i) => pegar(pool.filter(t => teste(t.prestigio)), `b${i}`))
  // Faixa vazia (ex.: iniciante sem clubes fortes) deixa vaga; completa com os
  // melhores restantes para sempre entregar `quantidade` propostas.
  for (const t of pool) {
    if (escolhidas.length >= quantidade) break
    const chave = t.file_key ?? t.curto
    if (!usados.has(chave)) { usados.add(chave); escolhidas.push(t) }
  }
  return escolhidas.sort((a, b) => b.prestigio - a.prestigio)
}
