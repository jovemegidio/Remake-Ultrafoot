/**
 * DIVISÃO DE ACESSO — a base da pirâmide, em cada país que a sustenta.
 *
 * Nasceu no Brasil na 1.0.318 para resolver "Cariacica e Vitória-ES não têm como
 * chegar à Série D": os clubes do pool viviam em `pool:<País>`, que NÃO é
 * divisão — apareciam no editor, tinham escudo e elenco, e não podiam ser
 * dirigidos nem subir para lugar nenhum.
 *
 * O problema nunca foi brasileiro. Medido em 15/08/2026: **1.618 clubes do pool
 * em 138 países** estavam nessa situação, e 23 países têm 20 ou mais.
 *
 * ⚠️ ESTE ARQUIVO É A FONTE ÚNICA. Sete lugares precisam conhecer uma divisão
 * nova (pirâmide, rótulo, regulamento, calendário, confederação, tela de nova
 * carreira, tamanho de liga) e, escritos à mão, eles saem de sincronia — foi
 * assim que onze segundas divisões existiram declaradas e VAZIAS por meses. Aqui
 * a lista é uma só e cada consumidor a espalha, do mesmo jeito que
 * `UEFA_EXPANSION_FEDERATIONS` já fazia.
 *
 * ⚠️ OS `id` SÃO PERMANENTES. Eles vão para o save em `clubDivisions`; renomear
 * um faz o clube do jogador cair numa divisão que não existe mais. `Brasil` é o
 * caso especial: shipou como `divisao_acesso_br` na 1.0.318 e continua assim,
 * mesmo fora do padrão `acesso_<pais>`.
 */

export interface DivisaoDeAcesso {
  /** Como o país é escrito nas PIRÂMIDES (`lib/league-pyramid`). */
  country: string
  /** Id da divisão. PERMANENTE — vai para o save. */
  id: string
  /** Rótulo exibido. Usa o nome REAL do degrau de base do país quando existe. */
  rotulo: string
  /** Divisão imediatamente acima; é para ela que os campeões sobem. */
  acima: string
  /** Quantos sobem por temporada. Segue o `swaps` do resto daquela pirâmide. */
  sobem: number
}

/**
 * ⚠️ SÓ ENTRA PAÍS QUE CUMPRE AS DUAS CONDIÇÕES:
 *
 *   1. já tem pirâmide em `PYRAMIDS` — sem um degrau acima, "acesso" não leva a
 *      lugar nenhum e a divisão vira um beco, que é o defeito que 37 ligas
 *      isoladas já tinham;
 *   2. tem 20+ clubes livres no pool, o tamanho de uma tabela. Abaixo disso a
 *      liga nasceria menor que o próprio regulamento — o erro que doze divisões
 *      cometeram até a auditoria de 04/08.
 *
 * Os rótulos são os nomes REAIS do degrau de base de cada país sempre que ele
 * existe (Torneo Federal A, Serie D italiana, Oberliga...). Inventar "Quinta
 * Divisão" seria pior do que usar o nome que o torcedor conhece.
 */
export const DIVISOES_DE_ACESSO: readonly DivisaoDeAcesso[] = [
  // Brasil — o primeiro, e o único cujo id foge do padrão (ver o aviso acima).
  { country: "Brasil", id: "divisao_acesso_br", rotulo: "Divisão de Acesso", acima: "serie_d", sobem: 4 },

  // América do Sul
  { country: "Argentina", id: "acesso_arg", rotulo: "Torneo Federal A", acima: "primera_b_arg", sobem: 2 },
  { country: "Chile", id: "acesso_chi", rotulo: "Segunda División Profesional", acima: "primera_b_chi", sobem: 2 },
  // ⚠️ PERU, PARAGUAI E BOLÍVIA FORAM TIRADOS DAQUI (medido em 15/08/2026).
  //
  // A contagem crua do pool prometia 39, 26 e 24 clubes livres — acima do
  // mínimo. Mas essa contagem é ANTES de as divisões de cima reservarem a parte
  // delas: a Liga 2 peruana, a Intermedia e a Simón Bolívar consomem quase tudo,
  // e sobravam **8, 5 e 2**. Dois clubes não são uma divisão.
  //
  // A lição vale para quem for acrescentar um país: conte os livres DEPOIS da
  // partição, nunca antes. O `scripts/test-divisao-de-acesso.ts` faz essa
  // contagem e falha se alguma divisão nascer menor que `MIN_TIMES_PARA_LIGA`.

  // Europa
  { country: "Alemanha", id: "acesso_ger", rotulo: "Regionalliga", acima: "dritte_liga_ger", sobem: 3 },
  { country: "Franca", id: "acesso_fra", rotulo: "National 2", acima: "national_fra", sobem: 3 },
  { country: "Italia", id: "acesso_ita", rotulo: "Serie C", acima: "serie_b_ita", sobem: 3 },
  { country: "Espanha", id: "acesso_esp", rotulo: "Tercera Federación", acima: "segunda_federacion_esp", sobem: 4 },
  { country: "Portugal", id: "acesso_por", rotulo: "Distritais", acima: "campeonato_portugal", sobem: 2 },
  { country: "Holanda", id: "acesso_hol", rotulo: "Tweede Divisie", acima: "eerste_divisie", sobem: 2 },
  { country: "Belgica", id: "acesso_bel", rotulo: "Belgian National Division 2", acima: "first_national_bel", sobem: 2 },
  { country: "Turquia", id: "acesso_tur", rotulo: "TFF 3. Lig", acima: "tff_2_lig", sobem: 3 },
  { country: "Russia", id: "acesso_rus", rotulo: "Segunda Liga Russa", acima: "russian_first", sobem: 2 },

  // Ásia
  { country: "China", id: "acesso_chn", rotulo: "China League Two", acima: "china_league_one", sobem: 2 },
]

/** Abaixo disto a divisão nasceria menor que a própria tabela. Ver o aviso acima. */
export const MIN_CLUBES_PARA_ACESSO = 20

const POR_PAIS = new Map(DIVISOES_DE_ACESSO.map(d => [d.country, d]))
const POR_ID = new Map(DIVISOES_DE_ACESSO.map(d => [d.id, d]))

export function acessoDoPais(country: string): DivisaoDeAcesso | undefined {
  return POR_PAIS.get(country)
}

export function acessoPorId(id: string): DivisaoDeAcesso | undefined {
  return POR_ID.get(id)
}

export function ehDivisaoDeAcesso(id: string | undefined): boolean {
  return Boolean(id && POR_ID.has(id))
}

/** Todos os ids, para os consumidores que só precisam saber "quais são". */
export const IDS_DE_ACESSO: readonly string[] = DIVISOES_DE_ACESSO.map(d => d.id)
