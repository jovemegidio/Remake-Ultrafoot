// Zonas de classificacao de uma tabela (titulo, continental, rebaixamento, etc.).
// Cada zona cobre um intervalo de posicoes e define cor e rotulo para destacar
// as linhas na tabela de classificacao.

import { FORMATOS, zonaDePlayoff } from "@/lib/formato-de-liga"
import { IDS_DE_ACESSO } from "@/lib/divisao-de-acesso"

export interface StandingZone {
  id: string
  label: string
  color: string
  /** Primeira posicao (inclusiva) coberta pela zona. */
  from: number
  /** Ultima posicao (inclusiva) coberta pela zona. */
  to: number
}

interface ZoneTemplate {
  id: string
  label: string
  color: string
  from: number
  /** Quantidade de posicoes a partir do topo (positivo) ou da base (negativo). */
  count: number
  /** Se true, conta a partir do final da tabela. */
  fromBottom?: boolean
}

// Cores alinhadas ao tema do app
const C = {
  title: "#ffd700",
  libertadores: "#00ffc8",
  preLib: "#22d3ee",
  sudamericana: "#3b82f6",
  promotion: "#00ffc8",
  playoff: "#f59e0b",
  relegation: "#ef4444",
}

// Templates por divisao. Posicoes calculadas com base no total de times.
const DIVISION_ZONES: Record<string, ZoneTemplate[]> = {
  serie_a: [
    { id: "libertadores", label: "Libertadores", color: C.libertadores, from: 1, count: 6 },
    { id: "pre-lib", label: "Pre-Libertadores", color: C.preLib, from: 7, count: 1 },
    { id: "sudamericana", label: "Sul-Americana", color: C.sudamericana, from: 8, count: 6 },
    { id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 4, fromBottom: true },
  ],
  serie_b: [
    { id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 4 },
    { id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 4, fromBottom: true },
  ],
  serie_c: [
    { id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 4 },
    { id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 4, fromBottom: true },
  ],
  serie_d: [
    { id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 4 },
  ],
  // Primeiras divisoes europeias: 3 rebaixados (piramide viva).
  premier_league: [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  la_liga:        [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  serie_a_ita:    [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  bundesliga:     [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  ligue_1:        [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  saudi_pro:      [{ id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true }],
  // Segundas divisoes: 3 sobem para a elite (sem rebaixamento no jogo — sao a base).
  //
  // Championship e a excecao e estava ERRADO aqui: sao 2 vagas DIRETAS e a
  // terceira sai do playoff entre 3o e 6o. Marcar "Acesso 1-3" dava ao 3o
  // colocado um acesso que ele nao tem, e colidia com a zona de playoff que
  // lib/formato-de-liga define — colisao que fazia o playoff nao aparecer.
  championship:     [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 2 }],
  la_liga_2:        [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  serie_b_ita:      [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  bundesliga_2:     [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  ligue_2:          [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
  saudi_first_div:  [{ id: "promotion", label: "Acesso", color: C.promotion, from: 1, count: 3 }],
}

// Template generico para ligas internacionais e divisoes nao mapeadas.
const DEFAULT_ZONES: ZoneTemplate[] = [
  { id: "title", label: "Titulo / Champions", color: C.title, from: 1, count: 4 },
  { id: "continental", label: "Competicao Continental", color: C.sudamericana, from: 5, count: 2 },
  { id: "relegation", label: "Rebaixamento", color: C.relegation, from: 0, count: 3, fromBottom: true },
]

/**
 * Divisao -> formato em lib/formato-de-liga.
 *
 * NAO substitui os templates acima: eles descrevem coisas que o formato nao
 * modela (Libertadores, Pre-Libertadores, Sul-Americana). O formato entra para
 * COMPLEMENTAR o que falta aqui — hoje, a zona de PLAYOFF de acesso, que o
 * Championship tem na vida real (3o ao 6o disputam a terceira vaga) e que esta
 * tabela simplesmente nao mostrava.
 *
 * Duas fontes de verdade para a mesma informacao seria o mesmo defeito que o
 * leilao teve com o valor de mercado; por isso o formato so ACRESCENTA.
 */
const DIVISAO_PARA_FORMATO: Record<string, string> = {
  serie_a: "brasileirao_a",
  serie_b: "brasileirao_b",
  serie_c: "brasileirao_c",
  serie_d: "brasileirao_d",
  // Todas as divisoes de acesso compartilham o MESMO formato — sao 13 e a
  // estrutura e identica; uma entrada por pais aqui so criaria 13 chances de
  // divergir. Ver lib/divisao-de-acesso.
  ...Object.fromEntries(IDS_DE_ACESSO.map(id => [id, "divisao_de_acesso"])),
  premier_league: "premier_league",
  championship: "championship",
  la_liga: "la_liga",
}

/**
 * Retorna as zonas de classificacao concretas para uma divisao,
 * resolvidas com base no numero total de times na tabela.
 */
export function getStandingZones(division: string, totalTeams: number): StandingZone[] {
  const templates = DIVISION_ZONES[division] ?? DEFAULT_ZONES
  const zones: StandingZone[] = []

  for (const tpl of templates) {
    let from: number
    let to: number
    if (tpl.fromBottom) {
      to = totalTeams
      from = Math.max(1, totalTeams - tpl.count + 1)
    } else {
      from = tpl.from
      to = Math.min(totalTeams, tpl.from + tpl.count - 1)
    }
    if (from > totalTeams || to < 1 || from > to) continue
    zones.push({ id: tpl.id, label: tpl.label, color: tpl.color, from, to })
  }

  // Playoff de acesso, quando o formato da liga define um. Entra depois para
  // nao competir com as zonas acima; e recusado se colidir com alguma delas —
  // uma posicao pintada por duas zonas confundiria mais do que informaria.
  const formato = FORMATOS[DIVISAO_PARA_FORMATO[division] ?? ""]
  if (formato && formato.vagasPorPlayoff > 0) {
    const posicoes = zonaDePlayoff(formato).filter((p) => p <= totalTeams)
    if (posicoes.length > 0) {
      const de = Math.min(...posicoes)
      const ate = Math.max(...posicoes)
      const colide = zones.some((z) => de <= z.to && ate >= z.from)
      if (!colide) {
        zones.push({ id: "playoff", label: "Playoff de Acesso", color: C.playoff, from: de, to: ate })
      }
    }
  }

  return zones
}

/**
 * Retorna a zona que cobre uma determinada posicao, ou null se nenhuma.
 */
export function getStandingZone(position: number, zones: StandingZone[]): StandingZone | null {
  return zones.find(z => position >= z.from && position <= z.to) ?? null
}
