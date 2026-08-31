export type ModoDeMundo = "original" | "mundo_real" | "seu_mundo"
export type Principio = "disciplina" | "meritocracia" | "base" | "intensidade" | "lealdade" | "ousadia"
export type PautaComissao = "treino" | "mercado" | "medico" | "base" | "adversario"
export type EntregaPauta = "reuniao" | "resumo" | "ignorar"

export interface RotinaBolaParada {
  id: string
  nome: string
  tipo: "escanteio_ofensivo" | "escanteio_defensivo" | "falta_ofensiva" | "falta_defensiva"
  zona: "primeira_trave" | "segunda_trave" | "centro" | "curta"
  cobradorId?: number
  ameacaAereaId?: number
  sobraId?: number
  ativa: boolean
}

export interface PreparacaoAdversario {
  season: number
  week: number
  adversario: string
  focoTatico: "pressionar" | "contra_atacar" | "controlar" | "fechar_espacos"
  focoBolaParada1: "defender_escanteios" | "atacar_escanteios" | "defender_faltas"
  focoBolaParada2: "penaltis" | "segunda_bola" | "cobranca_curta"
  bonus: number
  /**
   * Até dois atletas do adversário marcados sob pressão, por NOME.
   *
   * Opcional de propósito: save anterior à 1.0.383 não tem o campo e continua
   * valendo — `normalizarGestao282` espalha a preparação inteira, então nada
   * precisa migrar. Quem resolve isto em números é
   * `lib/plano-contra-o-adversario.ts`.
   */
  marcacaoIndividual?: string[]
}

export interface MetaIndividual282 {
  id: string
  playerId: number
  jogador: string
  tipo: "gols" | "assistencias" | "treino" | "jogos_emprestimo"
  alvo: number
  inicial: number
  prazoSemana: number
  concluida: boolean
  falhou: boolean
}

export interface GrupoMentoria {
  id: string
  mentorId: number
  mentor: string
  jovensIds: number[]
  jovens: string[]
  foco: "mentalidade" | "profissionalismo" | "lideranca"
}

export interface PedidoDiretoria282 {
  id: string
  tipo: "orcamento" | "estadio" | "treino" | "base" | "staff"
  justificativa: string
  prioridade: boolean
  season: number
  status: "analise" | "aprovado" | "recusado"
  /** Quanto a diretoria efetivamente liberou. Ausente em pedidos não aprovados
   *  e nos pedidos gravados antes da 1.0.283, quando aprovar não dava dinheiro. */
  verbaLiberada?: number
}

export interface EventoCarreira282 {
  id: string
  season: number
  week: number
  tipo: "clube" | "titulo" | "mercado" | "elenco" | "diretoria" | "ranking"
  titulo: string
  descricao: string
}

export type TipoConduta291 = "tres_amarelos" | "vermelho" | "falta_treino" | "rede_social"
export type PunicaoConduta291 = "advertencia" | "multa_leve" | "multa_pesada" | "suspensao_interna"

export interface RegraConduta291 {
  tipo: TipoConduta291
  punicao: PunicaoConduta291
  multaPercentualSalario: number
}

export interface IncidenteConduta291 {
  id: string
  season: number
  week: number
  playerId: number
  jogador: string
  tipo: TipoConduta291
  punicao: PunicaoConduta291
  multa: number
}

export interface CodigoConduta291 {
  regras: Record<TipoConduta291, RegraConduta291>
  incidentes: IncidenteConduta291[]
  ultimoCartoes: Record<number, { amarelos: number; vermelhos: number }>
}

export interface RegistroAcademia291 {
  season: number
  clube: string
  nivel: number
  graduados: number
  minutosDeJovens: number
  mediaPotencial: number
  pontuacao: number
}

export interface EstadoGestao282 {
  schema: 1
  modoDeMundo: ModoDeMundo
  rotinasBolaParada: RotinaBolaParada[]
  preparacao?: PreparacaoAdversario
  intermediarios: Record<number, { consultadoNaSemana: number; interesse: string[]; valorSugerido: number }>
  metasIndividuais: MetaIndividual282[]
  principios: Principio[]
  adesao: Record<number, number>
  unidadesTreino: Record<number, "goleiros" | "defesa" | "ataque">
  mentorias: GrupoMentoria[]
  pedidosDiretoria: PedidoDiretoria282[]
  pautaComissao: Record<PautaComissao, EntregaPauta>
  /** Relatórios da semana marcados para chegar "na reunião". Recalculado a cada
   *  virada de semana — não é histórico. */
  relatoriosComissao: RelatorioComissao282[]
  linhaDoTempo: EventoCarreira282[]
  codigoConduta291: CodigoConduta291
  historicoAcademia291: RegistroAcademia291[]
}

export const PUNICOES_CONDUTA_291: Record<PunicaoConduta291, { nome: string; moral: number; multa: number }> = {
  advertencia: { nome: "Advertência", moral: 0, multa: 0 },
  multa_leve: { nome: "Multa leve", moral: -1, multa: 25 },
  multa_pesada: { nome: "Multa pesada", moral: -2, multa: 60 },
  suspensao_interna: { nome: "Suspensão interna", moral: -3, multa: 100 },
}

export function codigoCondutaPadrao291(): CodigoConduta291 {
  const regra = (tipo: TipoConduta291, punicao: PunicaoConduta291): RegraConduta291 => ({
    tipo,
    punicao,
    multaPercentualSalario: PUNICOES_CONDUTA_291[punicao].multa,
  })
  return {
    regras: {
      tres_amarelos: regra("tres_amarelos", "advertencia"),
      vermelho: regra("vermelho", "multa_pesada"),
      falta_treino: regra("falta_treino", "multa_leve"),
      rede_social: regra("rede_social", "suspensao_interna"),
    },
    incidentes: [],
    ultimoCartoes: {},
  }
}

export const PRINCIPIOS: { id: Principio; nome: string; efeito: string }[] = [
  { id: "disciplina", nome: "Disciplina", efeito: "Reações melhores a cobranças coerentes." },
  { id: "meritocracia", nome: "Meritocracia", efeito: "Forma e treino pesam mais na adesão." },
  { id: "base", nome: "Desenvolver a base", efeito: "Jovens aceitam melhor rotação e mentoria." },
  { id: "intensidade", nome: "Intensidade", efeito: "Treino forte rende mais, mas exige energia." },
  { id: "lealdade", nome: "Lealdade", efeito: "Promessas cumpridas fortalecem o grupo." },
  { id: "ousadia", nome: "Ousadia", efeito: "Planos ofensivos recebem maior adesão." },
]

export function criarEstadoGestao282(modo: ModoDeMundo = "original"): EstadoGestao282 {
  return {
    schema: 1, modoDeMundo: modo, rotinasBolaParada: [], intermediarios: {},
    metasIndividuais: [], principios: ["disciplina", "meritocracia", "base"], adesao: {},
    unidadesTreino: {}, mentorias: [], pedidosDiretoria: [],
    pautaComissao: { treino: "reuniao", mercado: "resumo", medico: "reuniao", base: "resumo", adversario: "reuniao" },
    relatoriosComissao: [],
    linhaDoTempo: [],
    codigoConduta291: codigoCondutaPadrao291(),
    historicoAcademia291: [],
  }
}

export function normalizarGestao282(valor?: Partial<EstadoGestao282> | null): EstadoGestao282 {
  const base = criarEstadoGestao282(valor?.modoDeMundo)
  return {
    ...base,
    ...valor,
    pautaComissao: { ...base.pautaComissao, ...(valor?.pautaComissao ?? {}) },
    codigoConduta291: {
      ...base.codigoConduta291,
      ...(valor?.codigoConduta291 ?? {}),
      regras: { ...base.codigoConduta291.regras, ...(valor?.codigoConduta291?.regras ?? {}) },
    },
    historicoAcademia291: valor?.historicoAcademia291 ?? [],
  }
}

interface AtletaParaConduta291 {
  id: number
  name: string
  salary?: number
  morale?: string
  energy?: number
  seasonStats: { yellowCards: number; redCards: number }
}

/** Avalia cartoes e ocorrencias internas de forma deterministica uma vez por semana. */
export function avaliarConduta291(
  codigo: CodigoConduta291,
  elenco: AtletaParaConduta291[],
  season: number,
  week: number,
): { codigo: CodigoConduta291; novos: IncidenteConduta291[]; totalMultas: number } {
  const novos: IncidenteConduta291[] = []
  const ultimoCartoes = { ...codigo.ultimoCartoes }
  const registrar = (atleta: AtletaParaConduta291, tipo: TipoConduta291) => {
    const regra = codigo.regras[tipo]
    const salario = Math.max(0, atleta.salary ?? 0)
    novos.push({
      id: `${season}-${week}-${atleta.id}-${tipo}`,
      season,
      week,
      playerId: atleta.id,
      jogador: atleta.name,
      tipo,
      punicao: regra.punicao,
      multa: Math.round(salario * regra.multaPercentualSalario / 100),
    })
  }
  for (const atleta of elenco) {
    const anterior = codigo.ultimoCartoes[atleta.id] ?? { amarelos: 0, vermelhos: 0 }
    const amarelos = atleta.seasonStats.yellowCards ?? 0
    const vermelhos = atleta.seasonStats.redCards ?? 0
    if (Math.floor(amarelos / 3) > Math.floor(anterior.amarelos / 3)) registrar(atleta, "tres_amarelos")
    if (vermelhos > anterior.vermelhos) registrar(atleta, "vermelho")
    // Ocorrencias fora de campo sao raras, reproduziveis e exigem contexto ruim.
    const roll = hash(`${season}:${week}:${atleta.id}`) % 1000
    if ((atleta.energy ?? 100) < 35 && roll < 6) registrar(atleta, "falta_treino")
    if (atleta.morale === "Infeliz" && roll >= 6 && roll < 10) registrar(atleta, "rede_social")
    ultimoCartoes[atleta.id] = { amarelos, vermelhos }
  }
  const incidentes = [...novos, ...codigo.incidentes].slice(0, 200)
  return {
    codigo: { ...codigo, ultimoCartoes, incidentes },
    novos,
    totalMultas: novos.reduce((total, incidente) => total + incidente.multa, 0),
  }
}

export function registrarTemporadaAcademia291(input: Omit<RegistroAcademia291, "pontuacao">): RegistroAcademia291 {
  const pontuacao = Math.round(
    input.nivel * 120 + input.graduados * 85 + Math.min(600, input.minutosDeJovens / 30) + input.mediaPotencial * 7,
  )
  return { ...input, pontuacao }
}

function hash(texto: string): number {
  let h = 2166136261
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

export function consultarIntermediario(jogador: { id: number; name: string; marketValue: number; overall: number }, week: number) {
  const clubes = ["clubes da mesma liga", "mercado sul-americano", "clubes europeus", "mercado asiático"]
  const s = hash(`${jogador.id}:${jogador.name}:${week}`)
  const quantidade = jogador.overall >= 78 ? 3 : jogador.overall >= 68 ? 2 : 1
  return {
    consultadoNaSemana: week,
    interesse: clubes.slice(s % 2, s % 2 + quantidade),
    valorSugerido: Math.round(jogador.marketValue * (0.82 + (s % 37) / 100)),
  }
}

export function bonusPreparacao(foco: PreparacaoAdversario["focoTatico"], rotinas: number): number {
  return Math.min(8, 2 + (foco === "controlar" ? 1 : 2) + Math.min(4, rotinas))
}

// ─────────────────────────────────────────────────────────────────────────────
// Ponte para o motor
//
// Tudo abaixo existe para o que era gravado na Central de Gestão chegar ao
// campo. Antes desta versão as rotinas, a preparação e as unidades de treino
// eram gravadas no save e NENHUM motor as lia: a tela era um formulário.
// ─────────────────────────────────────────────────────────────────────────────

interface AtletaParaPlano {
  id: number
  name: string
  physical?: number
  passing?: number
  overall?: number
}

/** Rotina resolvida em números para `MatchConfig.homeSetPiecePlan`. */
export interface PlanoBolaParada282 {
  attackQuality: number
  defenseQuality: number
  aerialTargetName?: string
  secondBallName?: string
}

/**
 * Converte as rotinas ensaiadas no plano que o motor entende.
 *
 * A qualidade não vem só de EXISTIR uma rotina: metade do peso é ter ensaiado o
 * cenário, a outra metade é a adequação de quem foi escalado para o papel
 * (força física no alvo aéreo, passe no cobrador). Ensaiar com o elenco errado
 * rende pouco — que é o ponto de escolher os papéis por atleta.
 */
export function planoDeBolaParada282(
  gestao: Pick<EstadoGestao282, "rotinasBolaParada">,
  elenco: AtletaParaPlano[],
): PlanoBolaParada282 {
  const ativas = gestao.rotinasBolaParada.filter(r => r.ativa)
  const achar = (id?: number) => (id ? elenco.find(p => p.id === id) : undefined)
  // 70 é o atleta mediano do jogo; a escala vai de -1 a +1 em torno dele.
  const acima = (valor: number | undefined) => Math.max(-1, Math.min(1, ((valor ?? 70) - 70) / 25))

  const escOf = ativas.find(r => r.tipo === "escanteio_ofensivo")
  const falOf = ativas.find(r => r.tipo === "falta_ofensiva")
  const escDef = ativas.find(r => r.tipo === "escanteio_defensivo")
  const falDef = ativas.find(r => r.tipo === "falta_defensiva")

  const alvo = achar(escOf?.ameacaAereaId)
  const cobrador = achar(escOf?.cobradorId ?? falOf?.cobradorId)
  const sobra = achar(escOf?.sobraId)

  // Zona combinada: a curta é mais segura e rende menos no alto; a segunda trave
  // é a de maior ganho quando há alvo aéreo de verdade.
  const pesoZona = escOf?.zona === "segunda_trave" ? 1 : escOf?.zona === "primeira_trave" ? 0.9
    : escOf?.zona === "centro" ? 0.85 : 0.6

  const ensaioOfensivo = (escOf ? 0.35 : 0) + (falOf ? 0.15 : 0)
  const papeisOfensivos = escOf
    ? (acima(alvo?.physical) * 0.3 + acima(cobrador?.passing) * 0.2) * pesoZona
    : 0
  const ensaioDefensivo = (escDef ? 0.35 : 0) + (falDef ? 0.15 : 0)

  const limitar = (n: number) => Math.max(0, Math.min(1, n))
  return {
    attackQuality: limitar(ensaioOfensivo + papeisOfensivos),
    defenseQuality: limitar(ensaioDefensivo),
    aerialTargetName: alvo?.name,
    secondBallName: sobra?.name,
  }
}

// ── Modo de mundo ───────────────────────────────────────────────────────────

/**
 * Quantos negócios a IA fecha por quinzena, segundo o modo escolhido na criação
 * da carreira.
 *
 * É o que o modo de mundo significa na prática: o quanto o mundo se afasta do
 * elenco real com que a carreira começou. "Mundo real" segura o mercado para os
 * clubes permanecerem reconhecíveis por mais tempo; "seu mundo" solta, e em
 * poucas temporadas nada está no lugar. Até a 1.0.282 o modo era só uma string
 * gravada no save, sem consumidor nenhum.
 */
export function negociosPorQuinzena282(modo: ModoDeMundo): number {
  return modo === "mundo_real" ? 1 : modo === "seu_mundo" ? 4 : 2
}

// ── Relatórios da comissão ──────────────────────────────────────────────────

export interface RelatorioComissao282 {
  pauta: PautaComissao
  titulo: string
  texto: string
  /** Como o treinador pediu para receber esta pauta. */
  entrega: Exclude<EntregaPauta, "ignorar">
}

interface AtletaParaRelatorio {
  name: string
  age: number
  form?: number
  energy?: number
  overall: number
  potential?: number
  injury?: { weeksRemaining: number } | null
}

/**
 * Monta os relatórios semanais da comissão respeitando a pauta escolhida.
 *
 * A configuração de pauta existia desde a 1.0.282 e não tinha consumidor algum:
 * não havia relatório nenhum a entregar. Aqui cada tema vira um item de verdade,
 * tirado do estado real do elenco — e "ignorar" realmente não gera nada.
 */
export function relatoriosDaComissao282(
  gestao: Pick<EstadoGestao282, "pautaComissao">,
  dados: { elenco: AtletaParaRelatorio[]; proximoAdversario?: string },
): RelatorioComissao282[] {
  const saida: RelatorioComissao282[] = []
  const push = (pauta: PautaComissao, titulo: string, texto: string) => {
    const entrega = gestao.pautaComissao[pauta]
    if (entrega === "ignorar") return
    saida.push({ pauta, titulo, texto, entrega })
  }

  const elenco = dados.elenco
  if (elenco.length > 0) {
    const energiaMedia = Math.round(elenco.reduce((s, p) => s + (p.energy ?? 100), 0) / elenco.length)
    const desgastados = elenco.filter(p => (p.energy ?? 100) < 55).length
    push("treino", "Relatório de treinamento",
      `Energia média do grupo em ${energiaMedia}%.` +
      (desgastados > 0 ? ` ${desgastados} atleta${desgastados === 1 ? "" : "s"} abaixo de 55% — vale poupar.` : " Ninguém no vermelho."))

    const lesionados = elenco.filter(p => p.injury && p.injury.weeksRemaining > 0)
    push("medico", "Departamento médico",
      lesionados.length === 0
        ? "Nenhum atleta no departamento médico."
        : `${lesionados.length} em recuperação: ${lesionados.slice(0, 4).map(p => p.name).join(", ")}.`)

    const promessas = elenco
      .filter(p => p.age <= 21 && (p.potential ?? p.overall) - p.overall >= 6)
      .sort((a, b) => ((b.potential ?? b.overall) - b.overall) - ((a.potential ?? a.overall) - a.overall))
    push("base", "Categorias de base",
      promessas.length === 0
        ? "Sem promessas com margem de evolução relevante no elenco."
        : `${promessas.length} jovem${promessas.length === 1 ? "" : "s"} com margem para crescer. Destaque: ${promessas[0].name}.`)

    const emAlta = elenco.filter(p => (p.form ?? 70) >= 80).sort((a, b) => (b.form ?? 0) - (a.form ?? 0))
    push("mercado", "Recrutamento",
      emAlta.length === 0
        ? "Ninguém em fase de destaque — o mercado não deve procurar o clube esta semana."
        : `${emAlta[0].name} está em evidência e pode atrair sondagens.`)
  }

  if (dados.proximoAdversario) {
    push("adversario", "Próximo adversário",
      `${dados.proximoAdversario} é o próximo compromisso. A sessão de preparação vale só para este jogo.`)
  }

  return saida
}

// ── Diretoria ───────────────────────────────────────────────────────────────

/** Para onde vai a verba de cada tipo de pedido. */
export const DESTINO_DO_PEDIDO: Record<PedidoDiretoria282["tipo"], "transferencias" | "caixa"> = {
  orcamento: "transferencias",
  estadio: "caixa",
  treino: "caixa",
  base: "caixa",
  staff: "caixa",
}

/**
 * Quanto a diretoria libera num pedido aprovado.
 *
 * Proporcional ao tamanho do clube (o valor de mercado do elenco é o melhor
 * termômetro disponível) e à confiança: uma diretoria que confia abre mais o
 * cofre. Pedido marcado como prioridade do ano vale metade a mais.
 *
 * Antes disto o "aprovado" da tela era só um rótulo — nenhum valor mudava.
 */
/**
 * Quantos pedidos a diretoria FINANCIA por temporada.
 *
 * ⚠️ ISTO FECHA UM DINHEIRO INFINITO (1.0.379). Até aqui a única trava do
 * formulário de pedidos era "um prioritário por temporada"; pedido COMUM era
 * ilimitado. Com a confiança da diretoria em 70 ou mais, todo pedido saía
 * "aprovado" e cada um liberava verba na hora — medido num clube de Série A com
 * elenco de R$ 300 milhões, R$ 18,7 MILHÕES POR ENVIO, sem espera, sem custo e
 * sem limite. Bastava escrever qualquer justificativa e clicar em laço.
 *
 * Não dá para resolver só na tela: a tela é reconstruída a cada navegação e
 * qualquer contador dela nasce zerado. A conta tem de sair do que está no SAVE
 * — os pedidos daquela temporada —, que é o que esta função faz.
 */
export const PEDIDOS_FINANCIADOS_POR_TEMPORADA = 2

/**
 * A verba que a diretoria ainda topa liberar nesta temporada.
 *
 * Devolve 0 quando a cota acabou: a diretoria continua ouvindo e o pedido
 * continua sendo registrado — ela só não põe dinheiro de novo. Recusar o
 * pedido inteiro seria pior, porque esconderia do jogador que a cota existe.
 */
export function verbaDisponivel282(
  pedidos: Pick<PedidoDiretoria282, "season" | "verbaLiberada">[],
  season: number,
): { liberado: boolean; usados: number; cota: number } {
  const usados = pedidos.filter(p => p.season === season && (p.verbaLiberada ?? 0) > 0).length
  return { liberado: usados < PEDIDOS_FINANCIADOS_POR_TEMPORADA, usados, cota: PEDIDOS_FINANCIADOS_POR_TEMPORADA }
}

export function verbaDoPedido282(
  pedido: Pick<PedidoDiretoria282, "tipo" | "prioridade">,
  contexto: { valorDoElenco: number; confianca: number },
): number {
  // 4% do elenco é a base; obra de estádio custa mais e recebe mais.
  const fatorTipo = pedido.tipo === "estadio" ? 1.6 : pedido.tipo === "orcamento" ? 1.2 : 1
  const fatorConfianca = 0.6 + Math.max(0, Math.min(100, contexto.confianca)) / 100
  const fatorPrioridade = pedido.prioridade ? 1.5 : 1
  const bruto = Math.max(0, contexto.valorDoElenco) * 0.04 * fatorTipo * fatorConfianca * fatorPrioridade
  // Piso para clube pequeno não receber uma verba simbólica de zero.
  return Math.round(Math.max(500_000, bruto) / 100_000) * 100_000
}

// ── Princípios e adesão ─────────────────────────────────────────────────────

interface AtletaParaAdesao {
  id: number
  age: number
  form?: number
  energy?: number
  jogouNaSemana: boolean
}

export interface ResultadoAdesao282 {
  adesao: Record<number, number>
  /** Quem está tão fora do discurso que a moral cai; e quem está tão dentro que sobe. */
  contentes: number[]
  descontentes: number[]
}

/**
 * Move a adesão de cada atleta na direção do que o treinador FEZ na semana.
 *
 * Antes o percentual da tela era calculado na hora a partir de forma e moral —
 * um número bonito que nunca era gravado e que os princípios não influenciavam.
 * Aqui ele vira estado: escolher "desenvolver a base" e deixar os jovens no
 * banco derruba a adesão; ser coerente sustenta o grupo.
 *
 * A adesão anda no máximo 6 pontos por semana, então virar o vestiário leva
 * tempo — e recuperar também.
 */
export function atualizarAdesao282(
  gestao: Pick<EstadoGestao282, "principios" | "adesao">,
  elenco: AtletaParaAdesao[],
): ResultadoAdesao282 {
  const adesao: Record<number, number> = {}
  const contentes: number[] = []
  const descontentes: number[] = []
  const tem = (p: Principio) => gestao.principios.includes(p)

  for (const atleta of elenco) {
    const atual = gestao.adesao[atleta.id] ?? 50
    let alvo = 50

    // Desenvolver a base: promessa medida em minutos de jovem, não em intenção.
    if (tem("base") && atleta.age <= 21) alvo += atleta.jogouNaSemana ? 22 : -18
    // Meritocracia: quem está em forma espera jogar; quem joga sem forma irrita.
    if (tem("meritocracia")) {
      const emForma = (atleta.form ?? 70) >= 75
      if (emForma) alvo += atleta.jogouNaSemana ? 16 : -16
      else if (atleta.jogouNaSemana) alvo -= 6
    }
    // Intensidade: o grupo compra o discurso enquanto aguenta a carga.
    if (tem("intensidade")) alvo += (atleta.energy ?? 100) >= 65 ? 10 : -14
    // Lealdade e disciplina sustentam o grupo sem depender da semana; ousadia
    // agrada mais quem está inteiro para correr.
    if (tem("lealdade")) alvo += 6
    if (tem("disciplina")) alvo += 4
    if (tem("ousadia")) alvo += (atleta.energy ?? 100) >= 70 ? 6 : -4

    alvo = Math.max(0, Math.min(100, alvo))
    const passo = Math.max(-6, Math.min(6, alvo - atual))
    const novo = Math.max(0, Math.min(100, Math.round(atual + passo)))
    adesao[atleta.id] = novo

    if (novo >= 80) contentes.push(atleta.id)
    else if (novo <= 25) descontentes.push(atleta.id)
  }

  return { adesao, contentes, descontentes }
}

// ── Metas individuais ───────────────────────────────────────────────────────

interface AtletaParaMeta {
  id: number
  seasonStats: { goals: number; assists: number; matchesPlayed: number }
  training: { weeksTrained: number }
}

/** Valor atual do indicador que a meta acompanha. */
function valorDaMeta(meta: MetaIndividual282, atleta: AtletaParaMeta | undefined): number {
  if (!atleta) return meta.inicial
  switch (meta.tipo) {
    case "gols": return atleta.seasonStats.goals
    case "assistencias": return atleta.seasonStats.assists
    case "treino": return atleta.training.weeksTrained
    case "jogos_emprestimo": return atleta.seasonStats.matchesPlayed
  }
}

export interface ResultadoMetas282 {
  metas: MetaIndividual282[]
  /** Bateu o alvo nesta semana. */
  concluidas: MetaIndividual282[]
  /** Passou do prazo sem bater. */
  falhadas: MetaIndividual282[]
  /** Houve mudança? Evita gravar o save à toa toda semana. */
  mudou: boolean
}

/**
 * Fecha as metas vencidas e as cumpridas na virada da semana.
 *
 * Até a 1.0.282 `concluida` e `falhou` nunca viravam `true`: a tela mostrava o
 * progresso e a meta ficava aberta para sempre, sem prêmio nem cobrança. Quem
 * chama aplica a consequência na moral (ver use-game-manager).
 */
export function avaliarMetas282(
  gestao: Pick<EstadoGestao282, "metasIndividuais">,
  elenco: AtletaParaMeta[],
  week: number,
): ResultadoMetas282 {
  const porId = new Map(elenco.map(p => [p.id, p]))
  const concluidas: MetaIndividual282[] = []
  const falhadas: MetaIndividual282[] = []

  const metas = gestao.metasIndividuais.map(meta => {
    if (meta.concluida || meta.falhou) return meta
    const progresso = Math.max(0, valorDaMeta(meta, porId.get(meta.playerId)) - meta.inicial)
    if (progresso >= meta.alvo) {
      const fechada = { ...meta, concluida: true }
      concluidas.push(fechada)
      return fechada
    }
    // O prazo só vence DEPOIS da semana marcada — na semana do prazo ainda dá
    // para bater a meta.
    if (week > meta.prazoSemana) {
      const vencida = { ...meta, falhou: true }
      falhadas.push(vencida)
      return vencida
    }
    return meta
  })

  return { metas, concluidas, falhadas, mudou: concluidas.length > 0 || falhadas.length > 0 }
}

// ── Unidades de treino e mentoria ───────────────────────────────────────────

/** Qual unidade trabalha cada atributo. `passing` é de todos: nenhuma unidade o domina. */
const UNIDADE_DO_ATRIBUTO: Record<string, "goleiros" | "defesa" | "ataque"> = {
  shooting: "ataque",
  dribbling: "ataque",
  pace: "ataque",
  defending: "defesa",
  physical: "defesa",
}

/**
 * Rendimento do treino individual segundo a unidade em que o atleta trabalha.
 *
 * Treinar finalização na unidade de ataque rende mais; treinar finalização na
 * unidade de defesa rende menos. É o que dá sentido a distribuir o elenco — antes
 * a escolha era gravada no save e o treino a ignorava por completo.
 */
export function rendimentoUnidade282(
  unidade: "goleiros" | "defesa" | "ataque" | undefined,
  atributoEmTreino: string | null | undefined,
): number {
  if (!unidade || !atributoEmTreino) return 1
  const esperada = UNIDADE_DO_ATRIBUTO[atributoEmTreino]
  if (!esperada) return 1 // passe e afins: nenhuma unidade tem vantagem
  if (esperada === unidade) return 1.15
  // Goleiro treinando defesa na unidade de goleiros é coerente, não desvio.
  if (unidade === "goleiros" && atributoEmTreino === "defending") return 1.15
  return 0.92
}

/**
 * Ganho de treino do jovem que está num grupo de mentoria.
 *
 * Vale só para quem é ORIENTADO, e apenas enquanto o mentor continua no elenco:
 * vender o veterano desfaz o efeito, que é o comportamento que a mentoria
 * promete. Devolve 1 quando não há grupo — o treino fica igual ao de antes.
 */
export function bonusMentoria282(
  gestao: Pick<EstadoGestao282, "mentorias">,
  playerId: number,
  idsNoElenco: ReadonlySet<number>,
): number {
  const grupo = gestao.mentorias.find(
    m => m.jovensIds.includes(playerId) && idsNoElenco.has(m.mentorId),
  )
  if (!grupo) return 1
  return grupo.foco === "profissionalismo" ? 1.2 : 1.12
}

/**
 * A preparação vale para ESTA partida?
 *
 * Só vale para o adversário e a semana que foram preparados: preparar o clássico
 * e colher o bônus um mês depois contra outro time seria bônus permanente.
 *
 * ⚠️ ANTES DA 1.0.383 ESTA FUNÇÃO DEVOLVIA O BÔNUS EM PONTOS DE FORÇA, e o
 * chamador somava o MESMO número em ataque, meio e defesa. O `focoTatico`
 * escolhido não mudava nada (os quatro focos rendiam quase o mesmo número) e o
 * adversário real não entrava na conta: preparar-se contra quem se fecha atrás
 * valia igual a preparar-se contra quem pressiona a saída. Quem resolve a
 * preparação em números agora é `planoContraOAdversario`, que lê o adversário e
 * distribui com sinal. Aqui ficou só a pergunta da validade, que continua sendo
 * desta camada.
 */
export function preparacaoValeParaEstaPartida282(
  preparacao: PreparacaoAdversario | undefined,
  contexto: { season: number; week: number; adversario: string },
): PreparacaoAdversario | null {
  if (!preparacao) return null
  if (preparacao.season !== contexto.season || preparacao.week !== contexto.week) return null
  if (preparacao.adversario !== contexto.adversario) return null
  return preparacao
}

export function pontuacaoTecnico(t: { titulos: number; reputacao: number; vitorias: number; temporadas: number }) {
  return t.titulos * 120 + t.reputacao * 18 + t.vitorias * 3 + t.temporadas * 8
}

export function pontuacaoTime(t: { prestigio: number; pontos?: number; saldo?: number }) {
  return t.prestigio * 10 + (t.pontos ?? 0) * 4 + (t.saldo ?? 0)
}
