/**
 * CRITERIO DE DESEMPATE DA CLASSIFICACAO, POR COMPETICAO.
 *
 * ⚠️ O JOGO ORDENAVA O MUNDO INTEIRO PELA MESMA REGRA (ate a 1.0.386): pontos →
 * saldo de gols → gols marcados. Havia TRES implementacoes independentes disso
 * — `career-engine.sortStandings`, `national-competitions.sortTable` e uma
 * ordenacao solta dentro de `use-game-manager` — e as tres concordavam no erro.
 *
 * ⚠️ E O CRITERIO CERTO JA ESTAVA DECLARADO, SEM LEITOR. Cada competicao em
 * `competition-regulations-2026.ts` traz `tiebreakers`, e NADA no jogo lia esse
 * campo. Era o padrao da casa outra vez: a regra escrita no dado, a decisao
 * tomada em outro lugar por conta propria.
 *
 * ⚠️ NO BRASIL ISSO MUDA CAMPEAO E REBAIXADO. A regra da CBF desempata por
 * NUMERO DE VITORIAS logo depois dos pontos, ANTES do saldo — e dois clubes
 * empatados em pontos com saldos diferentes ficavam na ordem errada. Em 38
 * rodadas com quatro rebaixados, isso decide temporada.
 *
 * O `DEFAULT_TIEBREAKERS` do arquivo de regulamentos sequer listava vitorias,
 * entao ler o campo sem corrigi-lo apenas trocaria um erro por outro.
 */

/** Uma linha de tabela, no minimo que o desempate precisa ler. */
export interface LinhaDeTabela {
  points: number
  won: number
  goalsFor: number
  goalsAgainst: number
  /** Nome para o ultimo desempate estavel. */
  nome: string
}

/**
 * Criterios que o jogo sabe aplicar. O texto e o mesmo escrito em
 * `tiebreakers`, para que dado e codigo falem a mesma lingua.
 *
 * ⚠️ "confronto direto" e "fair play" NAO estao aqui de proposito: o primeiro
 * exige a lista de partidas entre os empatados e o segundo, cartoes por clube —
 * nenhum dos dois chega a esta funcao hoje. Declarar que sabemos aplicar o que
 * nao aplicamos seria repetir exatamente o defeito que este arquivo conserta.
 * Quando o criterio nao e conhecido, ele e PULADO e o proximo decide.
 */
const COMPARADORES: Record<string, (a: LinhaDeTabela, b: LinhaDeTabela) => number> = {
  "pontos": (a, b) => b.points - a.points,
  "numero de vitorias": (a, b) => b.won - a.won,
  "vitorias": (a, b) => b.won - a.won,
  "saldo de gols": (a, b) => (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst),
  "gols marcados": (a, b) => b.goalsFor - a.goalsFor,
  "gols pro": (a, b) => b.goalsFor - a.goalsFor,
}

/** Normaliza acento e caixa: "Saldo de Gols" e "saldo de gols" sao o mesmo criterio. */
function chave(criterio: string): string {
  return criterio.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

/**
 * Regra da CBF, usada por Brasileirao e estaduais.
 * Ordem oficial: pontos, vitorias, saldo, gols pro, confronto direto, cartoes.
 */
export const DESEMPATE_CBF = [
  "pontos", "numero de vitorias", "saldo de gols", "gols marcados",
] as const

/** Ordem europeia mais comum: pontos, saldo, gols pro. */
export const DESEMPATE_PADRAO = [
  "pontos", "saldo de gols", "gols marcados",
] as const

/**
 * Ordena a tabela pelos criterios declarados, na ordem em que vierem.
 * Criterio desconhecido e pulado — nunca inventa desempate.
 *
 * O nome fecha a ordenacao para que ela seja ESTAVEL: sem isso, duas linhas
 * empatadas em tudo trocariam de lugar a cada rodada e a tela piscaria sozinha.
 */
export function ordenarPorCriterios<T extends LinhaDeTabela>(
  linhas: readonly T[],
  criterios: readonly string[] = DESEMPATE_PADRAO,
): T[] {
  return [...linhas].sort((a, b) => {
    for (const criterio of criterios) {
      const comparar = COMPARADORES[chave(criterio)]
      if (!comparar) continue
      const r = comparar(a, b)
      if (r !== 0) return r
    }
    return a.nome.localeCompare(b.nome)
  })
}

/**
 * O desempate de uma divisao. Brasil segue a CBF; o resto segue o padrao.
 *
 * ⚠️ A CHAVE DA DIVISAO BRASILEIRA e o prefixo, e nao uma lista fixa: os
 * estaduais entram como `paulistao_a1`, `carioca` e afins, e uma lista
 * enumerada envelheceria a cada estadual novo.
 */
export function desempateDaDivisao(divisao?: string): readonly string[] {
  if (!divisao) return DESEMPATE_PADRAO
  const d = divisao.toLowerCase()
  const brasileira = /^(serie_[abcd]|brasileirao|paulistao|carioca|mineiro|gaucho|baiano|pernambucano|paranaense|catarinense|goiano|cearense|divisao_acesso_br|brasileirao_fem)/.test(d)
  return brasileira ? DESEMPATE_CBF : DESEMPATE_PADRAO
}
