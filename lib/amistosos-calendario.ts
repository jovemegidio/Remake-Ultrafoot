// AMISTOSO COMO FIXTURE DE VERDADE.
//
// Ate a 1.0.222 o amistoso e o calendario eram dois mundos: o amistoso vivia
// solto no save (`amistososAgendados`, marcado na Area do Treinador) e o
// calendario da temporada nascia inteiro de generateSeasonFixtures. Quem marcava
// um amistoso nao o via em lugar nenhum — so num botao "Jogar" perdido na Area
// do Treinador.
//
// Aqui o amistoso vira um `Fixture` injetado no calendario. Duas regras mandam,
// e as duas existem por causa de bugs caros:
//
//   1. NAO COLIDE COM A RODADA OFICIAL. O amistoso so ocupa uma semana em que o
//      clube nao tem NENHUM compromisso (liga, estadual, copa, continental).
//      Semana de pausa FIFA e livre de proposito: e exatamente quando os clubes
//      jogam amistoso na vida real.
//
//   2. NAO ENTRA NA CONTA DE FIM DE TEMPORADA. `isSeasonOver` fecha o ano quando
//      o clube nao tem mais nada para jogar; `seasonEndWeek` sai da maior semana
//      do calendario. Um amistoso pendente entrando em qualquer uma das duas
//      contas ressuscita o bug historico do "a temporada nunca termina". Por isso
//      TODO consumidor dessas contas filtra `competitionType === "friendly"`, e
//      este modulo expoe `ehAmistoso` para que ninguem precise repetir a string.
//
// O modulo e puro (sem React, sem store) para ser testavel: ver
// scripts/test-amistoso-calendario.ts.

import type { Team } from "@/lib/teams-data"
import { getGameDate } from "@/lib/game-date"

/** Um amistoso marcado pelo tecnico, como fica guardado no save. */
export interface AmistosoAgendado {
  oppShort: string
  oppNome: string
  /** Rotulo legivel da data ("Sab, 14 Mar") — so para exibicao. */
  dateLabel: string
  userIsHome: boolean
  /**
   * Semana da carreira em que o jogo acontece. Opcional porque saves anteriores
   * a 1.0.223 guardavam apenas `dateLabel`; sem semana o amistoso nao entra no
   * calendario (ver `migrarAmistososSemSemana`).
   */
  week?: number
  /** Ja disputado? Fica no calendario com o placar em vez de sumir. */
  jogado?: boolean
  golsPro?: number
  golsContra?: number
}

/** Formato minimo de fixture que este modulo precisa enxergar. */
export interface FixtureBasico {
  week: number
  isUserMatch: boolean
  competitionType: string
  played?: boolean
}

/** O fixture e um amistoso? Fonte unica da verdade — nao repita a string por ai. */
export function ehAmistoso(fixture: { competitionType?: string } | null | undefined): boolean {
  return fixture?.competitionType === "friendly"
}

/**
 * Os compromissos que CONTAM para o fim da temporada.
 *
 * Amistoso nunca conta: nem para a ultima semana da temporada, nem para o
 * "acabou tudo que o clube tinha para jogar".
 */
export function fixturesQueContamNaTemporada<T extends { competitionType?: string }>(
  fixtures: readonly T[],
): T[] {
  return fixtures.filter(f => !ehAmistoso(f))
}

const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

/** Rotulo legivel da semana ("Sáb, 14 Mar"), na mesma data que o calendario usa. */
export function rotuloDaSemana(season: number, week: number): string {
  const d = getGameDate(season, week)
  // Amistoso e jogo de fim de semana: empurra a data da semana para o sabado.
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7))
  return `${DIAS_CURTO[d.getDay()]}, ${d.getDate()} ${MESES_CURTO[d.getMonth()]}`
}

/** Mes (0-11) em que a semana cai — o mesmo eixo do campo `month` do fixture. */
export function mesDaSemana(season: number, week: number): number {
  return getGameDate(season, week).getMonth()
}

/**
 * Semanas em que o clube pode marcar amistoso: da proxima semana em diante, sem
 * NENHUM compromisso oficial e sem outro amistoso ja marcado.
 *
 * `limite` existe porque a lista vira um <select> na tela — oferecer 40 datas
 * nao ajuda ninguem a escolher.
 */
export function semanasLivresParaAmistoso(
  fixtures: readonly FixtureBasico[],
  currentWeek: number,
  amistososJaMarcados: readonly AmistosoAgendado[] = [],
  limite = 8,
): number[] {
  const ocupadas = new Set<number>()
  let ultimaSemana = currentWeek
  for (const f of fixtures) {
    if (f.week > ultimaSemana) ultimaSemana = f.week
    // Pausa FIFA nao ocupa: e justamente a janela de amistoso.
    if (!f.isUserMatch || ehAmistoso(f)) continue
    ocupadas.add(f.week)
  }
  for (const a of amistososJaMarcados) {
    if (a.week != null) ocupadas.add(a.week)
  }

  const livres: number[] = []
  // Vai um pouco alem da ultima semana com jogo: a pre-temporada seguinte e um
  // destino legitimo para amistoso, e um clube eliminado de tudo teria zero
  // opcoes sem esta folga.
  const teto = Math.max(ultimaSemana, currentWeek) + 6
  for (let w = Math.max(1, currentWeek + 1); w <= teto && livres.length < limite; w++) {
    if (!ocupadas.has(w)) livres.push(w)
  }
  return livres
}

/**
 * Saves anteriores a 1.0.223 guardam amistosos sem `week`. Em vez de descarta-los
 * (o tecnico marcou de verdade), realocamos cada um para a proxima semana livre.
 * Devolve `null` quando nada mudou, para o chamador nao gravar save a toa.
 */
export function migrarAmistososSemSemana(
  amistosos: readonly AmistosoAgendado[],
  fixtures: readonly FixtureBasico[],
  currentWeek: number,
): AmistosoAgendado[] | null {
  if (!amistosos.some(a => a.week == null && !a.jogado)) return null
  const resultado: AmistosoAgendado[] = []
  for (const a of amistosos) {
    if (a.week != null || a.jogado) { resultado.push(a); continue }
    const livres = semanasLivresParaAmistoso(fixtures, currentWeek, resultado, 1)
    if (livres.length === 0) { resultado.push(a); continue }
    resultado.push({ ...a, week: livres[0] })
  }
  return resultado
}

/**
 * Amistosos que ficaram para tras sem serem disputados. Amistoso nao e simulado
 * automaticamente como partida atrasada: um jogo-treino que o tecnico deixou
 * passar simplesmente nao aconteceu. Isto tambem impede que ele fique preso como
 * "proxima partida" para sempre.
 */
export function amistososVencidos(
  amistosos: readonly AmistosoAgendado[],
  currentWeek: number,
): AmistosoAgendado[] {
  return amistosos.filter(a => !a.jogado && a.week != null && a.week < currentWeek)
}

/**
 * Marca o amistoso daquela semana como disputado, guardando o placar.
 *
 * Ele NAO sai da lista: some do calendario seria estranho — o jogo aconteceu, e
 * ver o resultado no dia dele e metade da graca de o amistoso existir na agenda.
 * Devolve `null` quando nao havia amistoso pendente naquela semana, para o
 * chamador nao gravar save a toa.
 */
export function concluirAmistoso(
  amistosos: readonly AmistosoAgendado[],
  week: number,
  golsPro: number,
  golsContra: number,
): AmistosoAgendado[] | null {
  const alvo = amistosos.findIndex(a => a.week === week && !a.jogado)
  if (alvo < 0) return null
  return amistosos.map((a, i) =>
    i === alvo ? { ...a, jogado: true, golsPro, golsContra } : a,
  )
}

/**
 * Dia do mes em que o fixture aparece no calendario.
 *
 * Os jogos oficiais nao tem data real: o dia sai de uma tabela fixa por rodada
 * (`roundToDay`), com a copa de meio de semana deslocada em 2 dias. O amistoso
 * traz `dayOfMonth` proprio, calculado da semana real — por isso a preferencia.
 */
const DIAS_DA_RODADA = [1, 5, 8, 12, 15, 19, 22, 26, 29]

export function roundToDay(round: number): number {
  return DIAS_DA_RODADA[(round - 1) % 9] || 15
}

/** O que `atribuirDiasDoMes` precisa enxergar de um fixture. */
export interface FixtureComDia {
  month: number
  week: number
  midweek?: boolean
  isUserMatch?: boolean
  competitionType?: string
  dayOfMonth?: number
}

/**
 * DIA DO MES DE CADA JOGO DO USUARIO — em ordem cronologica e sem dois jogos no
 * mesmo dia.
 *
 * O que estava errado: o dia saia de `roundToDay(fixture.round)`, e `round` NAO
 * e a rodada do mes — para um jogo de copa ele e a posicao do confronto dentro
 * do caminho da copa (1º, 2º, 3º...). Como a copa entra em MEIO DE SEMANA de
 * uma rodada de liga, os dois jogos da mesma semana recebiam dias de tabelas
 * diferentes e o mes saia embaralhado. Medido num Flamengo campeao de tudo:
 *
 *   agosto → dia 10 = semana 33 (semifinal da Copa do Brasil)
 *            dia 14 = semana 34 (FINAL da Copa do Brasil)
 *            dia 22 = semana 32 (rodada da liga, ANTERIOR as duas)
 *
 * Ou seja, a FINAL aparecia no comeco do mes, antes de jogos que vinham antes
 * dela — e quem tinha acabado de ganhar a semifinal olhava para a frente do mes
 * e nao via jogo nenhum: o proximo compromisso estava desenhado para tras.
 * Pior: quando o dia calculado batia com o de outro jogo (janeiro, com o
 * estadual e a sobra da liga no mesmo mes), a celula so desenha UM deles —
 * `monthFixtures.find(...)` — e o outro sumia da tela de vez.
 *
 * A regra agora e uma so: dentro de um mes, os jogos do usuario sao espalhados
 * na ORDEM DA SEMANA em que acontecem. Jogo de meio de semana vem logo depois
 * da rodada com que divide a semana. Amistoso ja traz `dayOfMonth` proprio
 * (calculado da data real) e nao e tocado.
 *
 * Puro de proposito: ver scripts/test-amistoso-calendario.ts.
 */
export function atribuirDiasDoMes<T extends FixtureComDia>(
  fixtures: readonly T[],
  season: number,
): T[] {
  const porMes = new Map<number, number[]>()
  fixtures.forEach((f, indice) => {
    if (!f.isUserMatch || ehAmistoso(f) || f.dayOfMonth != null) return
    const lista = porMes.get(f.month)
    if (lista) lista.push(indice)
    else porMes.set(f.month, [indice])
  })
  if (!porMes.size) return [...fixtures]

  const saida = [...fixtures]
  for (const [mes, indices] of porMes) {
    // Meio de semana DEPOIS da rodada com que divide a semana (e a convencao que
    // o calendario ja usava com o "+2 dias").
    indices.sort((a, b) => {
      const x = fixtures[a]
      const y = fixtures[b]
      return x.week - y.week || Number(Boolean(x.midweek)) - Number(Boolean(y.midweek)) || a - b
    })
    const ultimoDia = new Date(season, mes + 1, 0).getDate()
    const total = indices.length
    let anterior = 0
    indices.forEach((indice, i) => {
      const alvo = Math.round(((i + 1) * ultimoDia) / (total + 1))
      // `ultimoDia - (total - 1 - i)` reserva um dia para cada jogo que ainda
      // vem depois: sem isso os ultimos do mes se empilhariam no dia 31.
      const dia = Math.max(1, Math.min(ultimoDia - (total - 1 - i), Math.max(anterior + 1, alvo)))
      anterior = dia
      saida[indice] = { ...fixtures[indice], dayOfMonth: dia }
    })
  }
  return saida
}

export function diaDaPartida(
  fixture: { round: number; midweek?: boolean; dayOfMonth?: number } | null | undefined,
): number {
  if (!fixture) return 15
  if (fixture.dayOfMonth != null) return fixture.dayOfMonth
  return roundToDay(fixture.round) + (fixture.midweek ? 2 : 0)
}

/**
 * Constroi os fixtures dos amistosos marcados e devolve a lista para concatenar
 * ao calendario.
 *
 * `resolveTeam` vem de fora (teams-data) para o modulo continuar puro e
 * testavel. Amistoso de adversario que nao existe mais na base e ignorado em
 * silencio — melhor perder o jogo-treino do que quebrar o calendario inteiro.
 */
export function construirFixturesDeAmistoso<TFixture>(
  amistosos: readonly AmistosoAgendado[],
  opcoes: {
    userTeam: Team
    season: number
    currentWeek: number
    resolveTeam: (curto: string) => Team | undefined
    /** Dias do mes ja ocupados por jogos do usuario, por mes — evita dois cards no mesmo dia. */
    diasOcupadosPorMes: ReadonlyMap<number, ReadonlySet<number>>
    monta: (dados: {
      id: number
      week: number
      month: number
      dayOfMonth: number
      homeTeam: Team
      awayTeam: Team
      played: boolean
      homeScore?: number
      awayScore?: number
      rotulo: string
    }) => TFixture
  },
): TFixture[] {
  const out: TFixture[] = []
  // Faixa própria de IDs: liga usa 1..N, copa 50000+, pausa FIFA 90000+.
  const id = 70000
  const usadosPorMes = new Map<number, Set<number>>()

  amistosos.forEach((a, indice) => {
    if (a.week == null) return
    const rival = opcoes.resolveTeam(a.oppShort)
    if (!rival) return
    // O que ficou para tras e nao foi jogado nao volta ao calendario.
    if (!a.jogado && a.week < opcoes.currentWeek) return

    const month = mesDaSemana(opcoes.season, a.week)
    const dataReal = getGameDate(opcoes.season, a.week)
    const ocupados = usadosPorMes.get(month) ?? new Set<number>(opcoes.diasOcupadosPorMes.get(month) ?? [])
    // Sabado da semana; se o dia ja tem card, anda ate achar um livre. Sem isto
    // dois jogos no mesmo dia do mes se escondem (a celula so mostra um).
    let dia = dataReal.getDate() + ((6 - dataReal.getDay() + 7) % 7)
    const ultimoDia = new Date(opcoes.season, month + 1, 0).getDate()
    let tentativas = 0
    while (ocupados.has(dia) && tentativas < 31) {
      dia = dia >= ultimoDia ? 1 : dia + 1
      tentativas++
    }
    ocupados.add(dia)
    usadosPorMes.set(month, ocupados)

    const home = a.userIsHome ? opcoes.userTeam : rival
    const away = a.userIsHome ? rival : opcoes.userTeam
    const golsPro = a.golsPro ?? 0
    const golsContra = a.golsContra ?? 0

    out.push(opcoes.monta({
      id: id + indice,
      week: a.week,
      month,
      dayOfMonth: dia,
      homeTeam: home,
      awayTeam: away,
      played: Boolean(a.jogado),
      homeScore: a.jogado ? (a.userIsHome ? golsPro : golsContra) : undefined,
      awayScore: a.jogado ? (a.userIsHome ? golsContra : golsPro) : undefined,
      rotulo: `Amistoso · ${a.dateLabel}`,
    }))
  })

  return out
}
