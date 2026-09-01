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
import { getCountryCompetitions } from "@/lib/country-competitions"
import { leagueNameForDivision } from "@/lib/domestic-league-engine"

export type SuperCupId =
  | "supercopa_brasil"
  | "recopa_sulamericana"
  | "supercopa_uefa"
  | "mundial_clubes"
  | "copa_intercontinental"
  /**
   * A SUPERCOPA DO PAIS DO CLUBE (1.0.381) — campeao da liga x campeao da copa.
   *
   * ⚠️ E UM SO ID PARA TODOS OS PAISES, de proposito. O NOME sai de
   * `country-competitions.superCup` na hora de montar a vaga: "Community
   * Shield" na Inglaterra, "Supercoppa Italiana" na Italia. Um id por pais
   * significaria mexer neste tipo a cada federacao nova, e o resto do jogo
   * (calendario, trofeu, historico) trata supercopa como supercopa.
   */
  | "supercopa_nacional"

/** O Mundial de 32 clubes acontece de 4 em 4 anos (2025, 2029, 2033...). */
export const ANO_BASE_MUNDIAL = 2025
export function temMundialNaTemporada(season: number): boolean {
  return (season - ANO_BASE_MUNDIAL) % 4 === 0
}

/**
 * De onde sai o ADVERSÁRIO de uma decisão entre campeões.
 *
 * ⚠️ ANTES DA 1.0.385 NÃO SAÍA DE LUGAR NENHUM: o calendário sorteava um clube
 * da região. O campeão da Champions decidia a Supercopa da UEFA contra um time
 * do meio da tabela do Chipre, e quem levantou a Libertadores enfrentava na
 * Recopa um clube que não tinha ganho nada. A definição da competição —
 * "campeão x campeão" — era o único lugar do jogo onde ela não valia.
 *
 * `divisao` só é usada quando o tipo é `liga` ou `copa`: é ela que diz de qual
 * país é o troféu.
 */
export interface OrigemDoAdversario {
  tipo: "liga" | "copa" | "continental"
  id: string
  divisao?: string
}

export interface SuperCupBerth {
  id: SuperCupId
  name: string
  /** Como o clube se classificou — mostrado ao jogador. */
  reason: string
  /** Campeão de QUAL competição é o adversário desta decisão. */
  adversarioCampeaoDe?: OrigemDoAdversario
  /** Jogo único ou ida e volta. */
  matchCount: number
  /** Ordem de disputa dentro da pré-temporada. */
  priority: number
}

const CATALOGO: Record<SuperCupId, Omit<SuperCupBerth, "reason">> = {
  supercopa_brasil:   { id: "supercopa_brasil",   name: "Supercopa do Brasil",     matchCount: 1, priority: 1 },
  recopa_sulamericana:{ id: "recopa_sulamericana",name: "Recopa Sul-Americana",    matchCount: 2, priority: 2 },
  supercopa_uefa:     { id: "supercopa_uefa",     name: "Supercopa da UEFA",       matchCount: 1, priority: 2 },
  // MUNDIAL DE CLUBES no formato de 32: 3 jogos de grupo + oitavas, quartas,
  // semi e final = 7 partidas. Antes era tratado como supercopa de 2 clubes.
  mundial_clubes:     { id: "mundial_clubes",     name: "Mundial de Clubes FIFA",  matchCount: 7, priority: 3 },
  // COPA INTERCONTINENTAL: anual, entre os campeoes continentais. Nao existia.
  copa_intercontinental: { id: "copa_intercontinental", name: "Copa Intercontinental", matchCount: 2, priority: 3 },
  // O nome real entra em `berthsForSeason`, pelo pais do clube.
  supercopa_nacional: { id: "supercopa_nacional", name: "Supercopa nacional", matchCount: 1, priority: 1 },
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
  /**
   * Divisao do clube — so serve para saber QUAL supercopa nacional ele disputa.
   * Opcional para nao quebrar chamador antigo: sem ela, as continentais
   * continuam funcionando e a nacional simplesmente nao aparece.
   */
  divisao?: string,
): SuperCupBerth[] {
  if (!seasonHistory?.length || !clubeCurto) return []

  const vagas: SuperCupBerth[] = []
  const conquistou = (id: SuperCupId, reason: string, adversarioCampeaoDe?: OrigemDoAdversario) => {
    if (vagas.some(v => v.id === id)) return
    vagas.push({ ...CATALOGO[id], reason, adversarioCampeaoDe })
  }

  // As supercopas dependem da temporada ANTERIOR; o Mundial, do CICLO de 4 anos
  // (bloco mais abaixo). Por isso a ausencia de registro do ano passado nao pode
  // mais encerrar a funcao — o campeao de 2026 tem vaga no Mundial de 2029
  // mesmo sem nada em 2028.
  const anterior = seasonHistory.filter(r => r.season === temporadaAtual - 1 && r.teamCurto === clubeCurto)

  for (const registro of anterior) {
    if (!foiCampeao(registro, clubeCurto)) continue
    const comp = chave(registro.competition)

    // Brasil: campeão do Brasileirão OU da Copa do Brasil disputa a Supercopa.
    if (comp.includes("brasileirao") || comp.includes("copadobrasil")) {
      // O adversário é o campeão do OUTRO troféu — e a Supercopa do Brasil é
      // sempre entre o campeão da SÉRIE A e o da Copa do Brasil, mesmo quando
      // quem ganhou a copa veio da Série B.
      conquistou("supercopa_brasil", `Campeão: ${registro.competition} ${registro.season}`,
        comp.includes("copadobrasil")
          ? { tipo: "liga", id: "serie_a", divisao: "serie_a" }
          : { tipo: "copa", id: "copa_brasil", divisao: "serie_a" })
    }
    // Libertadores dá Recopa e Intercontinental; Sul-Americana dá só a Recopa.
    if (comp.includes("libertadores")) {
      conquistou("recopa_sulamericana", `Campeão da Libertadores ${registro.season}`,
        { tipo: "continental", id: "sulamericana" })
      conquistou("copa_intercontinental", `Campeão da Libertadores ${registro.season}`)
    }
    if (comp.includes("sulamericana") || comp.includes("sudamericana")) {
      conquistou("recopa_sulamericana", `Campeão da Sul-Americana ${registro.season}`,
        { tipo: "continental", id: "libertadores" })
    }
    // Europa: Champions dá Supercopa da UEFA e Intercontinental; Europa League dá a Supercopa.
    if (comp.includes("championsleague")) {
      conquistou("supercopa_uefa", `Campeão da Champions ${registro.season}`,
        { tipo: "continental", id: "europa_league" })
      conquistou("copa_intercontinental", `Campeão da Champions ${registro.season}`)
    }
    if (comp.includes("europaleague")) {
      conquistou("supercopa_uefa", `Campeão da Europa League ${registro.season}`,
        { tipo: "continental", id: "champions_league" })
    }
  }

  // ── SUPERCOPA NACIONAL: campeão da liga x campeão da copa ────────────────
  //
  // ⚠️ NENHUM PAÍS TINHA A SUA ATÉ A 1.0.381. Só existiam as cinco
  // continentais/globais acima; "Supercopa de Espanha" e "DFL-Supercup"
  // apareciam como texto em `international-competitions` e não geravam partida
  // nenhuma — arte sem jogo, o mesmo estado de que a Supercopa do Brasil saiu.
  //
  // ⚠️ O BRASIL FICA DE FORA por já ter a dele acima; entrar aqui daria dois
  // torneios com o mesmo nome na mesma pré-temporada.
  //
  // A regra é a real: quem levantou a LIGA ou a COPA no ano passado abre a
  // temporada decidindo a supercopa. Comparar pelo NOME da competição do
  // registro é o que o resto desta função já faz — o histórico guarda o nome,
  // não um id.
  const compsDoPais = divisao ? getCountryCompetitions(divisao) : null
  if (compsDoPais?.superCup) {
    // ⚠️ O NOME DA LIGA VEM DE `leagueNameForDivision`, NAO DO ID DA DIVISAO.
    // A primeira versao comparava `chave(divisao)` com o nome no historico e
    // funcionava por coincidencia: "premier_league" x "Premier League" casa,
    // mas "serie_a_ita" x "Serie A" nao — e o campeao italiano ficava sem
    // supercopa. Foi o portao que pegou; a leitura nao veria.
    const nomeDaLiga = chave(leagueNameForDivision(divisao ?? ""))
    const alvos = [chave(compsDoPais.domesticCup)]
    for (const registro of anterior) {
      if (!foiCampeao(registro, clubeCurto)) continue
      const comp = chave(registro.competition)
      const ehLiga = Boolean(nomeDaLiga) && (comp === nomeDaLiga || comp.includes(nomeDaLiga))
      if (ehLiga || alvos.some(alvo => comp.includes(alvo))) {
        vagas.push({
          ...CATALOGO.supercopa_nacional,
          name: compsDoPais.superCup,
          reason: `Campeão: ${registro.competition} ${registro.season}`,
          // Ganhou a liga? Enfrenta o campeão da copa. Ganhou a copa? Enfrenta
          // o campeão da liga. É a definição da competição.
          adversarioCampeaoDe: ehLiga
            ? { tipo: "copa", id: `copa_${compsDoPais.country}`, divisao }
            : { tipo: "liga", id: divisao ?? "", divisao },
        })
        break
      }
    }
  }

  // ── MUNDIAL DE CLUBES: janela de 4 anos ─────────────────────────────────
  //
  // O Mundial de 32 nao e uma supercopa da temporada anterior: a vaga vem de
  // ter sido campeao continental em QUALQUER uma das 4 temporadas do ciclo, e o
  // torneio so acontece de 4 em 4 anos. Tratar como "campeao do ano passado"
  // fazia dele uma decisao de 2 clubes todo ano — que era o comportamento antigo.
  if (temMundialNaTemporada(temporadaAtual)) {
    const cicloInicio = temporadaAtual - 4
    const noCiclo = seasonHistory.filter(r =>
      r.teamCurto === clubeCurto && r.season >= cicloInicio && r.season < temporadaAtual && foiCampeao(r, clubeCurto))
    const continental = noCiclo.find(r => {
      const c = chave(r.competition)
      return c.includes("libertadores") || c.includes("championsleague")
        || c.includes("sulamericana") || c.includes("sudamericana") || c.includes("europaleague")
    })
    if (continental) {
      conquistou("mundial_clubes", `Campeão continental em ${continental.season} — vaga no ciclo do Mundial`)
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
