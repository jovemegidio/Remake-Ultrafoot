// O MUNDO PASSA A TER CAMPEÕES.
//
// O buraco, medido na 1.0.385: o jogo só registrava o campeão da competição que
// o USUÁRIO disputou. Se ele foi eliminado nas oitavas da Copa do Brasil,
// ninguém levantou a taça; se ele joga na Série B, a Libertadores daquele ano
// não teve campeão; e a Supercopa da UEFA era decidida contra um clube europeu
// SORTEADO, não contra o campeão da Europa League. O mundo tinha calendário,
// tabela e mercado — não tinha palmarés.
//
// ⚠️ ESTE MÓDULO NÃO SIMULA NADA. Resolver 154 ligas mais as copas por simulação
// cobraria o que a 1.0.300 já cobrou uma vez (o apito travava com O(n²) sobre o
// universo). Aqui o campeão é DERIVADO: sorteio ponderado pelo prestígio,
// determinístico na semente `competição:temporada`. A mesma pergunta feita duas
// vezes devolve a mesma resposta, em qualquer tela e em qualquer sessão, sem
// gravar um byte no save.
//
// É a mesma saída que `lib/finalissima.ts` já usava para descobrir quem ganhou a
// Eurocopa enquanto o usuário disputava a Copa América — generalizada de seleção
// para clube. O cabeçalho de lá enuncia o problema com todas as letras: "o jogo
// registra o campeão da competição que o USUÁRIO disputou e nada sobre o resto
// do mundo".
//
// ⚠️ O REGISTRO SEMPRE VENCE A DERIVAÇÃO. `seasonHistory` é a verdade: havendo
// registro daquela competição naquela temporada, é ele que responde. E a
// derivação NUNCA devolve o clube do usuário — um título só é dele se ele o
// ganhou em campo. Sem essa regra o palmarés daria ao técnico uma taça que a
// carreira dele não tem, que é o pior defeito possível numa tela de histórico.

import type { SeasonRecord } from "@/lib/career-types"
import {
  LEAGUE_COMPETITIONS,
  getConfederation,
  getCountryCompetitions,
} from "@/lib/country-competitions"
import { leagueNameForDivision } from "@/lib/domestic-league-engine"
import { PYRAMIDS } from "@/lib/league-pyramid"
import { ehDivisaoFeminina } from "@/lib/futebol-feminino"
import { allPoolTeams, allTeams, getTeamsByDivision, type Team } from "@/lib/teams-data"

export interface CampeaoDoMundo {
  /** Id da competição quando existe um (`libertadores`, `premier_league`). */
  competicaoId: string
  /** Nome exibido — é por ele que o `seasonHistory` guarda o título. */
  competicao: string
  temporada: number
  /** Código curto do clube campeão. */
  clube: string
  nome: string
  /**
   * `registro` = veio do `seasonHistory` (o jogo viu acontecer).
   * `derivado` = ninguém do save disputou, e o mundo resolveu.
   */
  origem: "registro" | "derivado"
}

/** O que a derivação precisa saber do save para não contradizê-lo. */
export interface VerdadeDoSave {
  /** Histórico da carreira — o registro vence sempre. */
  historico?: readonly SeasonRecord[]
  /** Clube do usuário: a derivação nunca o coroa. */
  clubeDoUsuario?: string
}

// ── Semente ───────────────────────────────────────────────────────────────

function semente(texto: string): number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/** Normaliza nome de competição — o histórico guarda nome, não id. */
function chave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

/**
 * PESO DO PRESTÍGIO — e por que ele NÃO é uma potência do prestígio bruto.
 *
 * ⚠️ A PRIMEIRA VERSÃO DESTE ARQUIVO USAVA `(prestigio - 32)³`, copiado da
 * Finalíssima, e a prova de mesa a reprovou na hora: em 40 temporadas da Premier
 * League o Hull City levantava QUATRO títulos, ao lado de Brentford, Fulham,
 * Sunderland e Coventry. Não era "zebra possível" — era liga sorteada.
 *
 * A causa é que a potência mede distância até um piso FIXO, e dentro de uma liga
 * de elite todo mundo está longe do piso: 98 e 62 viram 66³ e 30³, uma razão de
 * 10 para 1 que a cauda de dezenove clubes engole. O que decide um campeonato é
 * a distância até o MELHOR do torneio, não até o pior clube do mundo.
 *
 * Daí a exponencial sobre a diferença para o topo (softmax): cada `T` pontos de
 * prestígio abaixo do favorito dividem a chance por `e`. É estável para pools de
 * 20 ou de 800 clubes, que é justamente o intervalo em que este módulo trabalha
 * — a liga tem vinte, a copa nacional do Brasil tem centenas.
 *
 * ⚠️ OS DOIS SENTIDOS SÃO COBRADOS PELO PORTÃO, e é a lição do fator de fúria da
 * 1.0.383: `qa:campeoes` exige que o favorito NÃO ganhe sempre e que a zebra NÃO
 * seja rotina. Um número que só é testado num sentido está pela metade.
 */
//
// ⚠️ OS TRÊS NÚMEROS FORAM MEDIDOS, NÃO ESCOLHIDOS. Com `T = 4` a Bundesliga saía
// com 63% dos títulos no Bayern e o Brasileirão com 21 de 40 no Flamengo — mais
// concentrado que a vida real, onde nem a era Guardiola/Bayern chega a isso numa
// janela de quarenta anos. Em `T = 6` a mesma medição dá Bayern 42%, Real 41%,
// Flamengo 32%, City 25% e Inter 21%, que é a ordem de grandeza certa para cada
// uma dessas ligas. O portão trava a faixa.
const TEMPERATURA: Record<TipoDeTorneio, number> = {
  // Liga: 38 rodadas achatam a sorte — o título concentra no topo.
  liga: 6,
  // Copa: mata-mata de jogo único; a zebra é parte do regulamento.
  copa: 8,
  // Continental: elite contra elite, e o pool já é só a elite.
  continental: 5,
}

export type TipoDeTorneio = "liga" | "copa" | "continental"

function sortearPonderado(
  candidatos: readonly Team[],
  sementeTexto: string,
  tipo: TipoDeTorneio,
): Team | null {
  if (candidatos.length === 0) return null
  const melhor = candidatos.reduce((max, t) => Math.max(max, t.prestigio ?? 50), 0)
  const temperatura = TEMPERATURA[tipo]
  const pesos = candidatos.map(t => Math.exp(((t.prestigio ?? 50) - melhor) / temperatura))
  const total = pesos.reduce((a, b) => a + b, 0)
  if (total <= 0) return candidatos[0]
  let alvo = ((semente(sementeTexto) % 1_000_000) / 1_000_000) * total
  for (let i = 0; i < candidatos.length; i++) {
    alvo -= pesos[i]
    if (alvo <= 0) return candidatos[i]
  }
  return candidatos[candidatos.length - 1]
}

// ── Pools de candidatos (memoizados: a tela pergunta por várias temporadas) ──

const cachePorPais = new Map<string, Team[]>()
const cachePorConfederacao = new Map<string, Team[]>()

/** Divisões de um país, para varrer os clubes dele sem varrer o mundo. */
function divisoesDoPais(pais: string): string[] {
  return Object.entries(LEAGUE_COMPETITIONS)
    .filter(([, c]) => c.country === pais)
    .map(([div]) => div)
}

/**
 * As duas divisões de cima do país — de onde sai o campeão de uma copa nacional.
 *
 * ⚠️ SEGUNDA TENTATIVA DE RESOLVER O MESMO DEFEITO, e a primeira foi um remendo.
 * Cortar "os 64 mais prestigiados do país" consertou o Brasil e deixou a Espanha
 * e a Inglaterra piores: a Copa del Rey saía com `Real Madrid II`, `Osasuna II` e
 * `Barcelona II` — times B, que a regra REAL da competição proíbe de inscrever —
 * e a FA Cup com Fylde e Havant & Waterlooville campeões três vezes em quarenta
 * anos.
 *
 * A causa é que o prestígio do pool não está na mesma escala do catálogo curado
 * (Hull City chega a 88, acima do Tottenham), então "os 64 melhores" não é a elite
 * do país — é uma lista misturada. É a mesma armadilha de duas escalas que esta
 * base já pagou quatro vezes; medir com a régua errada não melhora com ajuste
 * fino do peso.
 *
 * A pirâmide nacional (`lib/league-pyramid`) é a hierarquia REAL e já existe: é
 * ela que decide acesso e queda. Duas divisões de cima é uma afirmação sobre o
 * futebol — a copa tem cento e tantos inscritos e um punhado de candidatos reais
 * ao título —, não um número escolhido até o resultado ficar bonito.
 */
function divisoesDeElite(pais: string): string[] | null {
  const piramide = PYRAMIDS.find(p => p.country === pais)
  if (!piramide || piramide.tiers.length === 0) return null
  return piramide.tiers.slice(0, 2)
}

/**
 * Clubes que disputam a copa nacional de um país, NA MODALIDADE pedida.
 *
 * ⚠️ NÃO É SÓ A PRIMEIRA DIVISÃO. Copa nacional é aberta às divisões de baixo —
 * é dela que sai a zebra que o torneio existe para produzir. O prestígio já
 * cuida de a quarta divisão quase nunca levantar a taça.
 *
 * ⚠️ MAS É SÓ UMA MODALIDADE, e a prova de mesa pegou o contrário: a Copa do
 * Brasil MASCULINA saiu sendo disputada pelo `Athletico Paranaense` de chave
 * `atleticopr_bra__fem`, que joga o Brasileirão Feminino A2. Varrer "as divisões
 * do país" junta as duas modalidades num balde só — o mesmo erro de raiz que a
 * 1.0.335 fechou em três fontes quando o sufixo "Feminino" ainda era trava.
 */
export function clubesDoPais(pais: string, feminino = false): Team[] {
  const cacheKey = `${pais}:${feminino ? "fem" : "masc"}`
  const emCache = cachePorPais.get(cacheKey)
  if (emCache) return emCache
  const vistos = new Set<string>()
  const lista: Team[] = []
  // Sem pirâmide cadastrada (país de divisão única), o país inteiro é a elite.
  const elite = feminino ? null : divisoesDeElite(pais)
  for (const divisao of elite ?? divisoesDoPais(pais)) {
    if (ehDivisaoFeminina(divisao) !== feminino) continue
    for (const time of getTeamsByDivision(divisao)) {
      // ⚠️ DEDUPLICAR POR `file_key` NÃO BASTA, e a prova de mesa mostrou por quê:
      // a Copa do Brasil saiu com "São Paulo" e "Sao Paulo" como dois campeões
      // diferentes, e o mesmo com "Grêmio"/"Gremio". O clube curado e o mesmo
      // clube vindo do pool têm chaves distintas — é a família de defeito que
      // [[copias-de-clube]] descreve. O NOME normalizado é o desempate.
      const id = time.file_key || time.curto
      const nome = chave(time.nome ?? "")
      if (!id || vistos.has(id) || (nome && vistos.has(nome))) continue
      vistos.add(id)
      if (nome) vistos.add(nome)
      lista.push(time)
    }
  }
  cachePorPais.set(cacheKey, lista)
  return lista
}

/**
 * Elite de uma confederação — quem de fato disputa a competição continental.
 *
 * O corte em 48 segue o mesmo espírito do pool de adversários continentais do
 * calendário (que fatia os 60 mais prestigiados): torneio continental reúne a
 * elite, e deixar 1.350 clubes concorrendo faria o campeão da Champions sair da
 * quarta divisão inglesa de tempos em tempos.
 */
export function eliteDaConfederacao(confederacao: string, feminino = false): Team[] {
  const cacheKey = `${confederacao}:${feminino ? "fem" : "masc"}`
  const emCache = cachePorConfederacao.get(cacheKey)
  if (emCache) return emCache
  const lista = allTeams
    .filter(t => ehDivisaoFeminina(String(t.divisao)) === feminino)
    .filter(t => getConfederation(String(t.divisao)) === confederacao)
    .sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
    .slice(0, 48)
  cachePorConfederacao.set(cacheKey, lista)
  return lista
}

// ── Registro: o que o save já sabe ────────────────────────────────────────

function registroDaCompeticao(
  verdade: VerdadeDoSave | undefined,
  nomeDaCompeticao: string,
  temporada: number,
): SeasonRecord | null {
  const historico = verdade?.historico
  if (!historico?.length) return null
  const alvo = chave(nomeDaCompeticao)
  if (!alvo) return null
  return historico.find(r => {
    if (r.season !== temporada) return false
    const nome = chave(r.competition)
    return nome === alvo || nome.includes(alvo) || alvo.includes(nome)
  }) ?? null
}

/**
 * O clube pelo código curto.
 *
 * ⚠️ `allTeams` NÃO CONTÉM O POOL, e foi por aí que a Supercopa da Espanha de
 * 2031 saiu `undefined` na prova de mesa: o campeão da copa do ano anterior era
 * um clube do pool, `allTeams.find` não o achava e a decisão ficava sem os dois
 * finalistas. Quem deriva de um pool tem de saber ler o mesmo pool de volta.
 */
function acharTime(curto: string): Team | undefined {
  return allTeams.find(t => t.curto === curto) ?? allPoolTeams.find(t => t.curto === curto)
}

function doRegistro(
  registro: SeasonRecord,
  competicaoId: string,
  competicao: string,
  temporada: number,
): CampeaoDoMundo | null {
  const curto = registro.champion || (registro.position === 1 ? registro.teamCurto : "")
  if (!curto) return null
  return {
    competicaoId,
    competicao,
    temporada,
    clube: curto,
    nome: acharTime(curto)?.nome ?? curto,
    origem: "registro",
  }
}

function derivar(
  candidatos: readonly Team[],
  competicaoId: string,
  competicao: string,
  temporada: number,
  tipo: TipoDeTorneio,
  clubeDoUsuario?: string,
): CampeaoDoMundo | null {
  // ⚠️ O USUÁRIO SAI DO SORTEIO. Se ele ganhou, o registro já respondeu antes de
  // chegar aqui; se não ganhou, coroá-lo seria inventar um título.
  const elegiveis = clubeDoUsuario
    ? candidatos.filter(t => t.curto !== clubeDoUsuario)
    : candidatos
  const campeao = sortearPonderado(elegiveis, `${competicaoId}:${temporada}`, tipo)
  if (!campeao) return null
  return {
    competicaoId,
    competicao,
    temporada,
    clube: campeao.curto,
    nome: campeao.nome,
    origem: "derivado",
  }
}

// ── As perguntas que o jogo faz ───────────────────────────────────────────

/** Quem levantou a LIGA daquela divisão naquela temporada. */
export function campeaoDaLiga(
  divisao: string,
  temporada: number,
  verdade?: VerdadeDoSave,
): CampeaoDoMundo | null {
  const nome = leagueNameForDivision(divisao)
  const registro = registroDaCompeticao(verdade, nome, temporada)
  if (registro) return doRegistro(registro, divisao, nome, temporada)
  return derivar(getTeamsByDivision(divisao), divisao, nome, temporada, "liga", verdade?.clubeDoUsuario)
}

/** Quem levantou a COPA NACIONAL do país daquela divisão. */
export function campeaoDaCopaNacional(
  divisao: string,
  temporada: number,
  verdade?: VerdadeDoSave,
): CampeaoDoMundo | null {
  const perfil = getCountryCompetitions(divisao)
  if (!perfil?.domesticCup || perfil.country === "Internacional") return null
  const nome = perfil.domesticCup
  const registro = registroDaCompeticao(verdade, nome, temporada)
  const idDaCopa = `copa_${perfil.country}${ehDivisaoFeminina(divisao) ? ":fem" : ""}`
  if (registro) return doRegistro(registro, idDaCopa, nome, temporada)
  const pool = clubesDoPais(perfil.country, ehDivisaoFeminina(divisao))
  return derivar(pool, idDaCopa, nome, temporada, "copa", verdade?.clubeDoUsuario)
}

/** Quem levantou a SUPERCOPA do país daquela divisão (quando o país tem uma). */
export function campeaoDaSupercopaNacional(
  divisao: string,
  temporada: number,
  verdade?: VerdadeDoSave,
): CampeaoDoMundo | null {
  const perfil = getCountryCompetitions(divisao)
  if (!perfil?.superCup || perfil.country === "Internacional") return null
  const nome = perfil.superCup
  const registro = registroDaCompeticao(verdade, nome, temporada)
  const idDaSupercopa = `supercopa_${perfil.country}${ehDivisaoFeminina(divisao) ? ":fem" : ""}`
  if (registro) return doRegistro(registro, idDaSupercopa, nome, temporada)
  // ⚠️ SUPERCOPA NÃO É SORTEIO DO PAÍS INTEIRO. Ela é decidida entre os dois
  // campeões do ano ANTERIOR — derivar dela é escolher entre esses dois. Sortear
  // o país daria uma Supercopa da Espanha para quem não ganhou liga nem copa.
  const finalistas = [
    campeaoDaLiga(divisao, temporada - 1, verdade),
    campeaoDaCopaNacional(divisao, temporada - 1, verdade),
  ].filter((c): c is CampeaoDoMundo => c !== null)
  const times = finalistas
    .map(c => acharTime(c.clube))
    .filter((t): t is Team => Boolean(t))
  if (times.length === 0) return null
  return derivar(times, idDaSupercopa, nome, temporada, "copa", verdade?.clubeDoUsuario)
}

/**
 * Competições continentais de clube, por id.
 *
 * ⚠️ OS IDS SÃO OS MESMOS QUE O CALENDÁRIO USA (`CONTINENTAL_FALLBACK` em
 * use-game-manager e `competitionsByLeague`). Uma segunda tabela de nomes seria
 * mais uma ocorrência de "duas escalas" nesta base: a Supercopa da UEFA passaria
 * a ser disputada contra o campeão de uma Champions que não é a do calendário.
 */
export const CONTINENTAIS_DE_CLUBE: Record<string, { nome: string; confederacao: string; nivel: number }> = {
  champions_league: { nome: "UEFA Champions League", confederacao: "UEFA", nivel: 1 },
  europa_league: { nome: "UEFA Europa League", confederacao: "UEFA", nivel: 2 },
  conference_league: { nome: "UEFA Conference League", confederacao: "UEFA", nivel: 3 },
  libertadores: { nome: "CONMEBOL Libertadores", confederacao: "CONMEBOL", nivel: 1 },
  sulamericana: { nome: "CONMEBOL Sul-Americana", confederacao: "CONMEBOL", nivel: 2 },
  afc_champions: { nome: "AFC Champions League Elite", confederacao: "AFC", nivel: 1 },
  concacaf_champions: { nome: "CONCACAF Champions Cup", confederacao: "CONCACAF", nivel: 1 },
}

/**
 * Quem levantou a competição CONTINENTAL de clubes.
 *
 * O `nivel` reparte a elite: a principal sai dos mais fortes da confederação, a
 * segunda dos seguintes. Sem isso o campeão da Sul-Americana e o da Libertadores
 * sairiam do mesmo balde, e a segunda competição seria só um nome diferente para
 * a primeira.
 */
export function campeaoContinentalDeClubes(
  competicaoId: string,
  temporada: number,
  verdade?: VerdadeDoSave,
): CampeaoDoMundo | null {
  const def = CONTINENTAIS_DE_CLUBE[competicaoId]
  if (!def) return null
  const registro = registroDaCompeticao(verdade, def.nome, temporada)
  if (registro) return doRegistro(registro, competicaoId, def.nome, temporada)
  const elite = eliteDaConfederacao(def.confederacao)
  if (elite.length === 0) return null
  const fatia = Math.max(8, Math.floor(elite.length / 3))
  const inicio = Math.max(0, Math.min(elite.length - fatia, (def.nivel - 1) * fatia))
  const candidatos = elite.slice(inicio, inicio + fatia)
  return derivar(candidatos, competicaoId, def.nome, temporada, "continental", verdade?.clubeDoUsuario)
}

/** Resolve qualquer uma das perguntas acima a partir de um id. */
export function campeaoPorId(
  id: string,
  temporada: number,
  verdade?: VerdadeDoSave,
): CampeaoDoMundo | null {
  if (CONTINENTAIS_DE_CLUBE[id]) return campeaoContinentalDeClubes(id, temporada, verdade)
  if (LEAGUE_COMPETITIONS[id]) return campeaoDaLiga(id, temporada, verdade)
  return null
}

/**
 * O quadro de campeões de uma temporada, do ponto de vista de quem joga naquela
 * divisão: a liga dele, a copa dele, a supercopa dele e as continentais da
 * confederação dele — mais as duas que o planeta inteiro acompanha.
 *
 * ⚠️ CHAME SÓ COM TEMPORADA CONCLUÍDA. Numa temporada em andamento a liga do
 * usuário ainda não tem campeão registrado, e a derivação responderia com um
 * palpite que a tabela ao lado desmente. Quem chama é que sabe onde a temporada
 * está — por isso a decisão não mora aqui.
 */
export function campeoesDaTemporada(
  divisaoDoUsuario: string,
  temporada: number,
  verdade?: VerdadeDoSave,
): CampeaoDoMundo[] {
  const saida: CampeaoDoMundo[] = []
  const junta = (c: CampeaoDoMundo | null) => { if (c) saida.push(c) }

  junta(campeaoDaLiga(divisaoDoUsuario, temporada, verdade))
  junta(campeaoDaCopaNacional(divisaoDoUsuario, temporada, verdade))
  junta(campeaoDaSupercopaNacional(divisaoDoUsuario, temporada, verdade))

  // ⚠️ NADA DE CONTINENTAL NO FEMININO — e é omissão deliberada, não esquecimento.
  // O jogo não modela Libertadores nem Champions femininas: `CONTINENTAIS_DE_CLUBE`
  // é masculino, e a `eliteDaConfederacao` de mulheres teria 194 clubes de 19
  // países. Anunciar uma "UEFA Champions League" com clube feminino dentro seria
  // inventar torneio para preencher tabela — exatamente o que a 1.0.382 recusou
  // fazer com as supercopas de países que não disputam uma.
  if (ehDivisaoFeminina(divisaoDoUsuario)) return saida

  const confederacao = getConfederation(divisaoDoUsuario)
  for (const [id, def] of Object.entries(CONTINENTAIS_DE_CLUBE)) {
    if (def.confederacao !== confederacao) continue
    junta(campeaoContinentalDeClubes(id, temporada, verdade))
  }
  // As duas maiores do planeta aparecem para todo mundo — é o que a imprensa do
  // jogo noticiaria em qualquer país.
  for (const id of ["champions_league", "libertadores"]) {
    if (saida.some(c => c.competicaoId === id)) continue
    junta(campeaoContinentalDeClubes(id, temporada, verdade))
  }
  return saida
}

/**
 * O ADVERSÁRIO DE UMA SUPERCOPA — o campeão do OUTRO torneio, não um clube
 * sorteado.
 *
 * ⚠️ ERA AQUI O DEFEITO MAIS VISÍVEL DA AUSÊNCIA DE PALMARÉS. A Supercopa da
 * UEFA é, por definição, Champions x Europa League; a Recopa é Libertadores x
 * Sul-Americana; a supercopa nacional é liga x copa. O calendário sorteava um
 * clube qualquer da região — o campeão da Champions decidia a Supercopa da UEFA
 * contra um time do meio da tabela do Chipre, e nada no jogo acusava.
 */
export function adversarioDaSupercopa(
  origem: { tipo: "liga" | "copa" | "continental"; id: string; divisao?: string },
  temporada: number,
  verdade?: VerdadeDoSave,
): CampeaoDoMundo | null {
  if (origem.tipo === "continental") return campeaoContinentalDeClubes(origem.id, temporada, verdade)
  if (!origem.divisao) return null
  return origem.tipo === "liga"
    ? campeaoDaLiga(origem.divisao, temporada, verdade)
    : campeaoDaCopaNacional(origem.divisao, temporada, verdade)
}

/** Limpa os pools memoizados — o universo muda ao trocar de carreira. */
export function limparCacheDeCampeoes(): void {
  cachePorPais.clear()
  cachePorConfederacao.clear()
}
