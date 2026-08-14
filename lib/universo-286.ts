// UNIVERSO PERSISTENTE 1.0.286
//
// O elenco dos clubes da CPU deixou de ser apenas uma fotografia recalculada do
// seed. Este módulo guarda um estado compacto por clube, atleta e liga e o faz
// avançar junto com a carreira. Ele é puro: recebe os dados iniciais e devolve
// um novo estado, o que permite testar vinte temporadas sem React/localStorage.

export const UNIVERSO_286_SCHEMA = 1

export type SetorUniverso286 = "GOL" | "DEF" | "MEI" | "ATA"
export type EstiloClube286 = "posse" | "pressao" | "transicao" | "direto" | "equilibrado"

export interface EntradaJogadorUniverso286 {
  id?: string
  nome: string
  posicao: string
  idade: number
  overall: number
  nacionalidade?: string
  pace?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
}

export interface EntradaClubeUniverso286 {
  curto: string
  nome: string
  pais?: string
  divisao: string
  prestigio: number
  saldo: number
  jogadores: EntradaJogadorUniverso286[]
}

export interface EstatisticasJogador286 {
  jogos: number
  gols: number
  assistencias: number
  jogosSemSofrer: number
  minutos: number
  notaMedia: number
}

export interface TemporadaJogador286 extends EstatisticasJogador286 {
  temporada: number
  clubeCurto: string
}

export interface ContratoJogador286 {
  ateTemporada: number
  salarioSemanal: number
}

export interface JogadorUniverso286 {
  id: string
  nome: string
  posicao: string
  setor: SetorUniverso286
  idade: number
  overall: number
  potencial: number
  nacionalidade?: string
  clubeCurto: string | null
  contrato: ContratoJogador286
  moral: number
  condicao: number
  lesaoSemanas: number
  valor: number
  atributos: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    physical: number
  }
  temporada: EstatisticasJogador286
  historico: TemporadaJogador286[]
}

export interface CarenciaElenco286 {
  setor: SetorUniverso286
  prioridade: number
  motivo: "quantidade" | "qualidade" | "idade" | "equilibrio"
  quantidadeAtual: number
  overallMedio: number
}

export interface ClubeUniverso286 {
  curto: string
  nome: string
  pais: string
  divisao: string
  prestigio: number
  saldo: number
  orcamentoTransferencias: number
  tetoFolhaSemanal: number
  folhaSemanal: number
  /** Tamanho do plantel na fotografia inicial; a base repõe até este piso. */
  tamanhoAlvoElenco: number
  estabilidadeTecnico: number
  estilo: EstiloClube286
  carencias: CarenciaElenco286[]
  temporada: {
    jogos: number
    vitorias: number
    empates: number
    derrotas: number
    golsPro: number
    golsContra: number
  }
}

export interface LinhaTabelaUniverso286 {
  clubeCurto: string
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  golsPro: number
  golsContra: number
  pontos: number
}

export interface LigaUniverso286 {
  id: string
  nome: string
  pais: string
  temporada: number
  clubes: string[]
  rodada: number
  tabela: LinhaTabelaUniverso286[]
  historico: { temporada: number; campeao: string; vice: string }[]
}

export interface NegocioUniverso286 {
  id: string
  temporada: number
  semana: number
  jogadorId: string
  jogador: string
  posicao: string
  idade: number
  overall: number
  deCurto: string
  de: string
  paraCurto: string
  para: string
  valor: number
  concorrentes: string[]
  motivo: string
}

export interface UniversoPersistente286 {
  schema: typeof UNIVERSO_286_SCHEMA
  temporada: number
  ultimaSemanaProcessada: number
  clubeDoUsuario: string
  clubes: Record<string, ClubeUniverso286>
  jogadores: Record<string, JogadorUniverso286>
  ligas: Record<string, LigaUniverso286>
  negocios: NegocioUniverso286[]
  geradoEm: number
}

export interface ResultadoAvancoUniverso286 {
  estado: UniversoPersistente286
  novosNegocios: NegocioUniverso286[]
  resultadosSimulados: number
}

const SETORES: SetorUniverso286[] = ["GOL", "DEF", "MEI", "ATA"]
const MINIMO_SETOR: Record<SetorUniverso286, number> = { GOL: 2, DEF: 7, MEI: 6, ATA: 4 }

function hash(texto: string): number {
  let h = 2166136261
  for (const char of texto) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return h >>> 0
}

function aleatorio(chave: string): number {
  return hash(chave) / 4294967295
}

function limitar(valor: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, valor))
}

function normalizar(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function setorDaPosicao286(posicao: string): SetorUniverso286 {
  const pos = String(posicao || "").toUpperCase()
  if (pos === "GOL" || pos === "GK") return "GOL"
  if (["ZAG", "DEF", "LD", "LE", "DC", "DL", "DR"].includes(pos)) return "DEF"
  if (["ATA", "CA", "PE", "PD", "ST", "CF", "LW", "RW"].includes(pos)) return "ATA"
  return "MEI"
}

export function idJogadorUniverso286(clubeCurto: string, jogador: Pick<EntradaJogadorUniverso286, "id" | "nome">): string {
  if (jogador.id?.trim()) return `ufp-${normalizar(jogador.id)}`
  return `ufp-${normalizar(clubeCurto)}-${normalizar(jogador.nome)}`
}

function valorDeMercado(overall: number, idade: number, potencial: number): number {
  const idadeFator = idade <= 21 ? 1.45 : idade <= 25 ? 1.2 : idade <= 29 ? 1 : idade <= 32 ? 0.72 : 0.42
  const potencialFator = 1 + Math.max(0, potencial - overall) / 35
  return Math.max(75_000, Math.round((overall ** 3) * 42 * idadeFator * potencialFator / 10_000) * 10_000)
}

function salarioSemanal(overall: number, prestigio: number): number {
  return Math.max(1_000, Math.round((overall ** 2.35) * (0.8 + prestigio / 220) / 100) * 100)
}

function atributos(jogador: EntradaJogadorUniverso286) {
  const base = limitar(Math.round(jogador.overall), 35, 99)
  const setor = setorDaPosicao286(jogador.posicao)
  const padrao = {
    pace: setor === "ATA" ? base + 3 : base,
    shooting: setor === "ATA" ? base + 4 : setor === "GOL" ? base - 20 : base - 3,
    passing: setor === "MEI" ? base + 4 : base,
    dribbling: setor === "ATA" || setor === "MEI" ? base + 2 : base - 2,
    defending: setor === "DEF" || setor === "GOL" ? base + 4 : base - 8,
    physical: setor === "DEF" ? base + 3 : base,
  }
  return {
    pace: limitar(jogador.pace ?? padrao.pace, 1, 99),
    shooting: limitar(jogador.shooting ?? padrao.shooting, 1, 99),
    passing: limitar(jogador.passing ?? padrao.passing, 1, 99),
    dribbling: limitar(jogador.dribbling ?? padrao.dribbling, 1, 99),
    defending: limitar(jogador.defending ?? padrao.defending, 1, 99),
    physical: limitar(jogador.physical ?? padrao.physical, 1, 99),
  }
}

function estatisticasVazias(): EstatisticasJogador286 {
  return { jogos: 0, gols: 0, assistencias: 0, jogosSemSofrer: 0, minutos: 0, notaMedia: 0 }
}

function estiloDoClube(curto: string): EstiloClube286 {
  const estilos: EstiloClube286[] = ["posse", "pressao", "transicao", "direto", "equilibrado"]
  return estilos[hash(`estilo:${curto}`) % estilos.length]
}

function tabelaVazia(clubes: string[]): LinhaTabelaUniverso286[] {
  return clubes.map(clubeCurto => ({
    clubeCurto, jogos: 0, vitorias: 0, empates: 0, derrotas: 0,
    golsPro: 0, golsContra: 0, pontos: 0,
  }))
}

function ordenarTabela(tabela: LinhaTabelaUniverso286[]): LinhaTabelaUniverso286[] {
  return [...tabela].sort((a, b) =>
    b.pontos - a.pontos ||
    (b.golsPro - b.golsContra) - (a.golsPro - a.golsContra) ||
    b.golsPro - a.golsPro ||
    a.clubeCurto.localeCompare(b.clubeCurto),
  )
}

/**
 * ELENCO POR CLUBE, INDEXADO.
 *
 * ⚠️ POR QUE ISTO EXISTE (relato: "trava na tela de partida ao vivo").
 *
 * `elencoDoClube` e `calcularCarencias` varriam os 42 mil atletas do universo A
 * CADA CHAMADA — e são chamadas quatro vezes por partida simulada, mais uma vez
 * por clube em cada passada do mercado. Numa semana comum isso dá ~145 milhões
 * de iterações, TODAS síncronas na thread da interface e dentro do apito final.
 * Medido no navegador: 98 s numa semana normal, 214 s com a janela aberta, 100 s
 * só para semear o universo. A tela ficava parada no 93' sem abrir o modal, que
 * é exatamente o congelamento relatado.
 *
 * O índice é montado UMA vez por estado e mantido em dia nas trocas de clube
 * (`moverDeClube`). A ordem de inserção é a mesma de `Object.values`, então os
 * desempates dos `sort` continuam caindo do mesmo lado: a semana simulada dá no
 * mesmo resultado, só deixa de travar.
 */
function agruparPorClube(
  jogadores: Record<string, JogadorUniverso286>,
): Map<string, JogadorUniverso286[]> {
  const indice = new Map<string, JogadorUniverso286[]>()
  for (const jogador of Object.values(jogadores)) {
    if (!jogador.clubeCurto) continue
    const lista = indice.get(jogador.clubeCurto)
    if (lista) lista.push(jogador)
    else indice.set(jogador.clubeCurto, [jogador])
  }
  return indice
}

const indicePorEstado = new WeakMap<UniversoPersistente286, Map<string, JogadorUniverso286[]>>()

function indiceDeElencos(estado: UniversoPersistente286): Map<string, JogadorUniverso286[]> {
  let indice = indicePorEstado.get(estado)
  if (!indice) {
    indice = agruparPorClube(estado.jogadores)
    indicePorEstado.set(estado, indice)
  }
  return indice
}

/**
 * Troca o clube de um atleta SEM invalidar o índice.
 *
 * Passar por aqui é obrigatório: mexer em `clubeCurto` na mão deixa o índice
 * mentindo, e elenco errado é bem pior que elenco lento.
 */
function moverDeClube(
  estado: UniversoPersistente286,
  jogador: JogadorUniverso286,
  destino: string | null,
): void {
  const indice = indiceDeElencos(estado)
  if (jogador.clubeCurto) {
    const anterior = indice.get(jogador.clubeCurto)
    const posicao = anterior ? anterior.indexOf(jogador) : -1
    if (anterior && posicao >= 0) anterior.splice(posicao, 1)
  }
  jogador.clubeCurto = destino
  if (!destino) return
  const lista = indice.get(destino)
  if (lista) lista.push(jogador)
  else indice.set(destino, [jogador])
}

function calcularCarencias(
  clube: ClubeUniverso286,
  elenco: readonly JogadorUniverso286[],
): CarenciaElenco286[] {
  return SETORES.map(setor => {
    const doSetor = elenco.filter(jogador => jogador.setor === setor)
    const quantidade = doSetor.length
    const media = quantidade ? doSetor.reduce((soma, jogador) => soma + jogador.overall, 0) / quantidade : 0
    const idade = quantidade ? doSetor.reduce((soma, jogador) => soma + jogador.idade, 0) / quantidade : 40
    const falta = Math.max(0, MINIMO_SETOR[setor] - quantidade)
    const qualidadeEsperada = limitar(clube.prestigio - 9, 48, 84)
    const deficitQualidade = Math.max(0, qualidadeEsperada - media)
    const prioridade = limitar(Math.round(falta * 26 + deficitQualidade * 3 + Math.max(0, idade - 29) * 4), 5, 100)
    const motivo: CarenciaElenco286["motivo"] = falta > 0
      ? "quantidade"
      : deficitQualidade >= 5 ? "qualidade" : idade >= 30 ? "idade" : "equilibrio"
    return { setor, prioridade, motivo, quantidadeAtual: quantidade, overallMedio: Math.round(media) }
  }).sort((a, b) => b.prioridade - a.prioridade)
}

/** Cria o retrato inicial de todas as ligas carregadas na base do jogo. */
export function criarUniversoPersistente286(params: {
  temporada: number
  clubeDoUsuario: string
  clubes: EntradaClubeUniverso286[]
  geradoEm?: number
}): UniversoPersistente286 {
  const clubes: Record<string, ClubeUniverso286> = {}
  const jogadores: Record<string, JogadorUniverso286> = {}
  const entradasUnicas = params.clubes.filter((clube, indice, lista) =>
    clube.curto && lista.findIndex(item => item.curto === clube.curto) === indice,
  )

  for (const entrada of entradasUnicas) {
    const prestigio = limitar(Math.round(entrada.prestigio || 55), 20, 99)
    clubes[entrada.curto] = {
      curto: entrada.curto,
      nome: entrada.nome,
      pais: entrada.pais || "Desconhecido",
      divisao: entrada.divisao,
      prestigio,
      saldo: Math.max(0, Math.round(entrada.saldo || prestigio * 1_000_000)),
      orcamentoTransferencias: Math.max(300_000, Math.round((entrada.saldo || prestigio * 1_000_000) * 0.28)),
      tetoFolhaSemanal: 0,
      folhaSemanal: 0,
      tamanhoAlvoElenco: limitar(entrada.jogadores.length, 18, 30),
      estabilidadeTecnico: 65 + hash(`tecnico:${entrada.curto}`) % 26,
      estilo: estiloDoClube(entrada.curto),
      carencias: [],
      temporada: { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0 },
    }

    for (const atleta of entrada.jogadores) {
      const idBase = idJogadorUniverso286(entrada.curto, atleta)
      let id = idBase
      let repeticao = 2
      while (jogadores[id]) id = `${idBase}-${repeticao++}`
      const overall = limitar(Math.round(atleta.overall || 55), 35, 99)
      const potencialNatural = overall + (atleta.idade <= 18 ? 12 : atleta.idade <= 21 ? 8 : atleta.idade <= 24 ? 4 : 1)
      const potencial = limitar(potencialNatural + (hash(`pot:${id}`) % 7) - 3, overall, 96)
      jogadores[id] = {
        id,
        nome: atleta.nome,
        posicao: atleta.posicao,
        setor: setorDaPosicao286(atleta.posicao),
        idade: limitar(Math.round(atleta.idade || 24), 15, 44),
        overall,
        potencial,
        nacionalidade: atleta.nacionalidade,
        clubeCurto: entrada.curto,
        contrato: {
          ateTemporada: params.temporada + 1 + hash(`contrato:${id}`) % 4,
          salarioSemanal: salarioSemanal(overall, prestigio),
        },
        moral: 55 + hash(`moral:${id}`) % 31,
        condicao: 92 + hash(`condicao:${id}`) % 9,
        lesaoSemanas: 0,
        valor: valorDeMercado(overall, atleta.idade, potencial),
        atributos: atributos(atleta),
        temporada: estatisticasVazias(),
        historico: [],
      }
    }
  }

  // Um índice só, em vez de duas varreduras dos 42 mil atletas POR CLUBE — era
  // isto que fazia a semeadura levar 100 s. Ver `agruparPorClube`.
  const elencosIniciais = agruparPorClube(jogadores)
  for (const clube of Object.values(clubes)) {
    const elenco = elencosIniciais.get(clube.curto) ?? []
    const folha = elenco.reduce((soma, jogador) => soma + jogador.contrato.salarioSemanal, 0)
    clube.folhaSemanal = folha
    clube.tetoFolhaSemanal = Math.max(Math.round(folha * 1.18), Math.round(clube.prestigio ** 2.25 * 18))
    clube.carencias = calcularCarencias(clube, elenco)
  }

  const grupos = new Map<string, EntradaClubeUniverso286[]>()
  for (const entrada of entradasUnicas) {
    if (!entrada.divisao) continue
    const lista = grupos.get(entrada.divisao) ?? []
    lista.push(entrada)
    grupos.set(entrada.divisao, lista)
  }
  const ligas: Record<string, LigaUniverso286> = {}
  for (const [id, entradas] of grupos) {
    const participantes = entradas.map(item => item.curto).filter(curto => clubes[curto])
    if (participantes.length < 2) continue
    ligas[id] = {
      id,
      nome: id.replaceAll("_", " "),
      pais: entradas[0]?.pais || "Desconhecido",
      temporada: params.temporada,
      clubes: participantes,
      rodada: 0,
      tabela: tabelaVazia(participantes),
      historico: [],
    }
  }

  return {
    schema: UNIVERSO_286_SCHEMA,
    temporada: params.temporada,
    ultimaSemanaProcessada: 0,
    clubeDoUsuario: params.clubeDoUsuario,
    clubes,
    jogadores,
    ligas,
    negocios: [],
    geradoEm: params.geradoEm ?? Date.now(),
  }
}

function elencoDoClube(estado: UniversoPersistente286, clubeCurto: string): readonly JogadorUniverso286[] {
  return indiceDeElencos(estado).get(clubeCurto) ?? []
}

function forcaClube(estado: UniversoPersistente286, clubeCurto: string): number {
  const clube = estado.clubes[clubeCurto]
  const disponiveis = elencoDoClube(estado, clubeCurto)
    .filter(jogador => jogador.lesaoSemanas <= 0)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 11)
  if (!disponiveis.length) return clube?.prestigio ?? 50
  const media = disponiveis.reduce((soma, jogador) => soma + jogador.overall + (jogador.moral - 65) / 18, 0) / disponiveis.length
  return media + ((clube?.estabilidadeTecnico ?? 65) - 65) / 25
}

function golsDeterministas(expectativa: number, chave: string): number {
  // Poisson inversa com números determinísticos: mantém placares plausíveis e
  // garante que recarregar a mesma semana não sorteie outro campeão.
  const limite = Math.exp(-limitar(expectativa, 0.15, 3.4))
  let produto = 1
  let gols = 0
  while (gols < 8) {
    produto *= Math.max(0.0001, aleatorio(`${chave}:${gols}`))
    if (produto <= limite) break
    gols++
  }
  return gols
}

function pareamentosDaRodada(clubes: string[], rodada: number): [string, string][] {
  const participantes = [...clubes]
  if (participantes.length % 2 === 1) participantes.push("")
  const fixo = participantes[0]
  const rotativos = participantes.slice(1)
  const giro = rodada % rotativos.length
  const ordem = [fixo, ...rotativos.slice(giro), ...rotativos.slice(0, giro)]
  const pares: [string, string][] = []
  for (let i = 0; i < ordem.length / 2; i++) {
    const a = ordem[i]
    const b = ordem[ordem.length - 1 - i]
    if (!a || !b) continue
    const inverte = rodada >= rotativos.length || (rodada + i) % 2 === 1
    pares.push(inverte ? [b, a] : [a, b])
  }
  return pares
}

function atualizarLinha(linha: LinhaTabelaUniverso286, pro: number, contra: number): void {
  linha.jogos++
  linha.golsPro += pro
  linha.golsContra += contra
  if (pro > contra) { linha.vitorias++; linha.pontos += 3 }
  else if (pro === contra) { linha.empates++; linha.pontos++ }
  else linha.derrotas++
}

function registrarAtuacoes(
  estado: UniversoPersistente286,
  clubeCurto: string,
  gols: number,
  sofreu: number,
  chave: string,
): void {
  const titulares = elencoDoClube(estado, clubeCurto)
    .filter(jogador => jogador.lesaoSemanas <= 0)
    .sort((a, b) => b.overall + aleatorio(`${chave}:xi:${b.id}`) * 5 - (a.overall + aleatorio(`${chave}:xi:${a.id}`) * 5))
    .slice(0, 11)
  if (!titulares.length) return
  for (const jogador of titulares) {
    const stats = jogador.temporada
    const notaDoJogo = limitar(6.1 + (gols - sofreu) * 0.18 + (aleatorio(`${chave}:nota:${jogador.id}`) - 0.5), 4, 9.8)
    stats.notaMedia = (stats.notaMedia * stats.jogos + notaDoJogo) / (stats.jogos + 1)
    stats.jogos++
    stats.minutos += 90
    if (sofreu === 0 && (jogador.setor === "GOL" || jogador.setor === "DEF")) stats.jogosSemSofrer++
    jogador.condicao = limitar(jogador.condicao - 4 - Math.round(aleatorio(`${chave}:fadiga:${jogador.id}`) * 4), 55, 100)
  }
  for (let gol = 0; gol < gols; gol++) {
    const candidatos = titulares.flatMap(jogador => {
      const peso = jogador.setor === "ATA" ? 5 : jogador.setor === "MEI" ? 3 : jogador.setor === "DEF" ? 1 : 0
      return Array.from({ length: peso }, () => jogador)
    })
    const autor = candidatos[hash(`${chave}:gol:${gol}`) % Math.max(1, candidatos.length)]
    if (autor) autor.temporada.gols++
    const assistentes = titulares.filter(jogador => jogador.id !== autor?.id && jogador.setor !== "GOL")
    const assistente = assistentes[hash(`${chave}:assist:${gol}`) % Math.max(1, assistentes.length)]
    if (assistente && aleatorio(`${chave}:tem-assist:${gol}`) < 0.76) assistente.temporada.assistencias++
  }
}

function simularRodadaDaLiga(estado: UniversoPersistente286, liga: LigaUniverso286, semana: number): number {
  const totalTurnos = Math.max(1, (liga.clubes.length - 1) * 2)
  if (liga.rodada >= totalTurnos) return 0
  const pares = pareamentosDaRodada(liga.clubes, liga.rodada)
  for (const [mandante, visitante] of pares) {
    // A liga do usuário continua tendo sua tabela oficial no game-manager. O
    // universo não sobrescreve aquela classificação, mas registra jogadores e
    // clubes da CPU para manter o resto do mundo coerente.
    const forcaCasa = forcaClube(estado, mandante)
    const forcaFora = forcaClube(estado, visitante)
    const diferenca = limitar((forcaCasa - forcaFora) / 18, -1.2, 1.2)
    const chave = `${estado.temporada}:${semana}:${liga.id}:${liga.rodada}:${mandante}:${visitante}`
    const golsCasa = golsDeterministas(1.28 + diferenca + 0.18, `${chave}:casa`)
    const golsFora = golsDeterministas(1.08 - diferenca, `${chave}:fora`)
    const linhaCasa = liga.tabela.find(linha => linha.clubeCurto === mandante)
    const linhaFora = liga.tabela.find(linha => linha.clubeCurto === visitante)
    if (linhaCasa) atualizarLinha(linhaCasa, golsCasa, golsFora)
    if (linhaFora) atualizarLinha(linhaFora, golsFora, golsCasa)
    const clubeCasa = estado.clubes[mandante]
    const clubeFora = estado.clubes[visitante]
    if (clubeCasa && clubeFora) {
      for (const [clube, pro, contra] of [[clubeCasa, golsCasa, golsFora], [clubeFora, golsFora, golsCasa]] as const) {
        clube.temporada.jogos++
        clube.temporada.golsPro += pro
        clube.temporada.golsContra += contra
        if (pro > contra) clube.temporada.vitorias++
        else if (pro === contra) clube.temporada.empates++
        else clube.temporada.derrotas++
        clube.estabilidadeTecnico = limitar(clube.estabilidadeTecnico + (pro > contra ? 1 : pro < contra ? -1 : 0), 15, 98)
      }
    }
    registrarAtuacoes(estado, mandante, golsCasa, golsFora, `${chave}:casa`)
    registrarAtuacoes(estado, visitante, golsFora, golsCasa, `${chave}:fora`)
  }
  liga.rodada++
  liga.tabela = ordenarTabela(liga.tabela)
  return pares.length
}

function atualizarCondicaoELesoes(estado: UniversoPersistente286, semana: number): void {
  for (const jogador of Object.values(estado.jogadores)) {
    if (jogador.lesaoSemanas > 0) {
      jogador.lesaoSemanas--
      jogador.condicao = limitar(jogador.condicao + 5, 50, 100)
      continue
    }
    jogador.condicao = limitar(jogador.condicao + 7, 50, 100)
    // Aproximadamente duas lesões por mil atletas/semana; determinístico.
    if (aleatorio(`lesao:${estado.temporada}:${semana}:${jogador.id}`) < 0.0022) {
      jogador.lesaoSemanas = 1 + hash(`duracao-lesao:${estado.temporada}:${semana}:${jogador.id}`) % 7
      jogador.moral = limitar(jogador.moral - 4, 1, 100)
    }
  }
}

function adequacaoAoEstilo(jogador: JogadorUniverso286, clube: ClubeUniverso286): number {
  const a = jogador.atributos
  if (clube.estilo === "posse") return a.passing * 0.55 + a.dribbling * 0.3 + jogador.overall * 0.15
  if (clube.estilo === "pressao") return a.physical * 0.45 + a.pace * 0.35 + jogador.overall * 0.2
  if (clube.estilo === "transicao") return a.pace * 0.5 + a.passing * 0.25 + jogador.overall * 0.25
  if (clube.estilo === "direto") return a.physical * 0.45 + a.shooting * 0.3 + jogador.overall * 0.25
  return jogador.overall
}

function simularMercado(
  estado: UniversoPersistente286,
  semana: number,
  quantidade: number,
): NegocioUniverso286[] {
  if (quantidade <= 0) return []
  for (const clube of Object.values(estado.clubes)) {
    clube.carencias = calcularCarencias(clube, elencoDoClube(estado, clube.curto))
  }
  const compradores = Object.values(estado.clubes)
    .filter(clube => clube.curto !== estado.clubeDoUsuario && clube.orcamentoTransferencias >= 100_000)
  const jogadores = Object.values(estado.jogadores)
    .filter(jogador => jogador.clubeCurto && jogador.clubeCurto !== estado.clubeDoUsuario && jogador.lesaoSemanas <= 4)
  const jaMovidos = new Set<string>()
  const negocios: NegocioUniverso286[] = []

  for (let tentativa = 0; tentativa < quantidade * 8 && negocios.length < quantidade; tentativa++) {
    const comprador = compradores[hash(`comprador:${estado.temporada}:${semana}:${tentativa}`) % Math.max(1, compradores.length)]
    if (!comprador) break
    const necessidade = comprador.carencias[tentativa % Math.min(2, comprador.carencias.length)]
    if (!necessidade || necessidade.prioridade < 18) continue
    const candidatos = jogadores
      .filter(jogador =>
        !jaMovidos.has(jogador.id) && jogador.clubeCurto !== comprador.curto &&
        jogador.setor === necessidade.setor && jogador.valor <= comprador.orcamentoTransferencias * 1.15,
      )
      .map(jogador => {
        const vendedor = jogador.clubeCurto ? estado.clubes[jogador.clubeCurto] : undefined
        const salto = comprador.prestigio - (vendedor?.prestigio ?? 45)
        const idade = jogador.idade <= 23 ? 8 : jogador.idade >= 31 ? -8 : 2
        const risco = jogador.lesaoSemanas * 4 + Math.max(0, 65 - jogador.condicao) / 3
        const nota = adequacaoAoEstilo(jogador, comprador) + necessidade.prioridade * 0.22 + salto * 0.16 + idade - risco
        return { jogador, vendedor, nota }
      })
      .filter(item => item.vendedor && item.nota >= Math.max(52, comprador.prestigio - 15))
      .sort((a, b) => b.nota - a.nota)
      .slice(0, 12)
    if (!candidatos.length) continue
    const escolhido = candidatos[hash(`alvo:${estado.temporada}:${semana}:${tentativa}`) % Math.min(4, candidatos.length)]
    const jogador = escolhido.jogador
    const vendedor = escolhido.vendedor!
    if (elencoDoClube(estado, vendedor.curto).length <= 15) continue

    const concorrentes = compradores
      .filter(outro => outro.curto !== comprador.curto && outro.curto !== vendedor.curto)
      .filter(outro => outro.orcamentoTransferencias >= jogador.valor * 0.85)
      .filter(outro => outro.carencias.some(carencia => carencia.setor === jogador.setor && carencia.prioridade >= 35))
      .sort((a, b) => {
        const na = adequacaoAoEstilo(jogador, a) + (a.carencias.find(c => c.setor === jogador.setor)?.prioridade ?? 0) * 0.25
        const nb = adequacaoAoEstilo(jogador, b) + (b.carencias.find(c => c.setor === jogador.setor)?.prioridade ?? 0) * 0.25
        return nb - na
      })
      .slice(0, 2)
    const licitantes = [comprador, ...concorrentes]
    const ofertas = licitantes.map((clube, indice) => ({
      clube,
      valor: Math.min(
        clube.orcamentoTransferencias,
        Math.round(jogador.valor * (0.92 + (clube.carencias.find(c => c.setor === jogador.setor)?.prioridade ?? 20) / 220 + indice * 0.025) / 10_000) * 10_000,
      ),
    })).sort((a, b) => b.valor - a.valor)
    const vencedor = ofertas[0]
    if (!vencedor || vencedor.valor < jogador.valor * 0.82) continue
    const folhaProjetada = vencedor.clube.folhaSemanal + salarioSemanal(jogador.overall, vencedor.clube.prestigio)
    if (folhaProjetada > vencedor.clube.tetoFolhaSemanal) continue

    vencedor.clube.saldo = Math.max(0, vencedor.clube.saldo - vencedor.valor)
    vencedor.clube.orcamentoTransferencias = Math.max(0, vencedor.clube.orcamentoTransferencias - vencedor.valor)
    vendedor.saldo += vencedor.valor
    vendedor.orcamentoTransferencias += Math.round(vencedor.valor * 0.55)
    vendedor.folhaSemanal = Math.max(0, vendedor.folhaSemanal - jogador.contrato.salarioSemanal)
    moverDeClube(estado, jogador, vencedor.clube.curto)
    jogador.contrato = {
      ateTemporada: estado.temporada + 3 + hash(`novo-contrato:${jogador.id}:${estado.temporada}`) % 3,
      salarioSemanal: salarioSemanal(jogador.overall, vencedor.clube.prestigio),
    }
    jogador.moral = limitar(jogador.moral + 8, 1, 100)
    vencedor.clube.folhaSemanal += jogador.contrato.salarioSemanal
    jaMovidos.add(jogador.id)
    const negocio: NegocioUniverso286 = {
      id: `u286-${estado.temporada}-${semana}-${jogador.id}-${vencedor.clube.curto}`,
      temporada: estado.temporada,
      semana,
      jogadorId: jogador.id,
      jogador: jogador.nome,
      posicao: jogador.posicao,
      idade: jogador.idade,
      overall: jogador.overall,
      deCurto: vendedor.curto,
      de: vendedor.nome,
      paraCurto: vencedor.clube.curto,
      para: vencedor.clube.nome,
      valor: vencedor.valor,
      concorrentes: ofertas.slice(1).map(oferta => oferta.clube.nome),
      motivo: `${necessidade.setor}: ${necessidade.motivo} (${necessidade.prioridade}/100) · estilo ${vencedor.clube.estilo}`,
    }
    negocios.push(negocio)
  }

  for (const clube of Object.values(estado.clubes)) {
    clube.carencias = calcularCarencias(clube, elencoDoClube(estado, clube.curto))
  }
  return negocios
}

function virarTemporada(estado: UniversoPersistente286, novaTemporada: number): void {
  for (const liga of Object.values(estado.ligas)) {
    const ordenada = ordenarTabela(liga.tabela)
    if (ordenada[0]) {
      liga.historico = [
        ...liga.historico,
        { temporada: estado.temporada, campeao: ordenada[0].clubeCurto, vice: ordenada[1]?.clubeCurto ?? ordenada[0].clubeCurto },
      ].slice(-20)
    }
    liga.temporada = novaTemporada
    liga.rodada = 0
    liga.tabela = tabelaVazia(liga.clubes)
  }
  for (const clube of Object.values(estado.clubes)) {
    clube.temporada = { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0 }
    clube.orcamentoTransferencias = Math.max(250_000, Math.round(clube.saldo * 0.22))
  }
  for (const jogador of Object.values(estado.jogadores)) {
    if (jogador.clubeCurto && jogador.temporada.jogos > 0) {
      jogador.historico = [...jogador.historico, {
        temporada: estado.temporada,
        clubeCurto: jogador.clubeCurto,
        ...jogador.temporada,
      }].slice(-12)
    }
    jogador.temporada = estatisticasVazias()
    jogador.idade++
    const crescimento = jogador.idade <= 23
      ? Math.min(jogador.potencial - jogador.overall, 1 + hash(`evolucao:${novaTemporada}:${jogador.id}`) % 2)
      : jogador.idade >= 32 ? -(1 + hash(`declinio:${novaTemporada}:${jogador.id}`) % 2) : 0
    jogador.overall = limitar(jogador.overall + crescimento, 35, 99)
    jogador.valor = valorDeMercado(jogador.overall, jogador.idade, jogador.potencial)
    if (jogador.contrato.ateTemporada <= novaTemporada) {
      const clube = jogador.clubeCurto ? estado.clubes[jogador.clubeCurto] : undefined
      const titular = clube && jogador.overall >= clube.prestigio - 12
      if (clube && titular && clube.folhaSemanal <= clube.tetoFolhaSemanal * 1.05) {
        jogador.contrato.ateTemporada = novaTemporada + 2 + hash(`renova:${novaTemporada}:${jogador.id}`) % 3
        jogador.contrato.salarioSemanal = salarioSemanal(jogador.overall, clube.prestigio)
      } else if (clube) {
        clube.folhaSemanal = Math.max(0, clube.folhaSemanal - jogador.contrato.salarioSemanal)
        moverDeClube(estado, jogador, null)
        jogador.moral = limitar(jogador.moral - 8, 1, 100)
      }
    }
    if (jogador.idade >= 38 || (jogador.idade >= 35 && aleatorio(`aposenta:${novaTemporada}:${jogador.id}`) < 0.28)) {
      if (jogador.clubeCurto) {
        const clube = estado.clubes[jogador.clubeCurto]
        if (clube) clube.folhaSemanal = Math.max(0, clube.folhaSemanal - jogador.contrato.salarioSemanal)
      }
      moverDeClube(estado, jogador, null)
      jogador.condicao = 0
    }
  }
  // INTAKE DA BASE. Sem reposição, o estado persistente tornaria visível um
  // defeito que o seed procedural escondia: após 15–20 anos todos os atletas
  // originais se aposentariam e os clubes acabariam com plantéis vazios.
  for (const clube of Object.values(estado.clubes)) {
    let atuais = elencoDoClube(estado, clube.curto).filter(jogador => jogador.condicao > 0)
    const vagas = Math.max(0, clube.tamanhoAlvoElenco - atuais.length)
    for (let indice = 0; indice < vagas; indice++) {
      const contagem = (setor: SetorUniverso286) => atuais.filter(jogador => jogador.setor === setor).length
      const setor = [...SETORES].sort((a, b) =>
        (MINIMO_SETOR[b] - contagem(b)) - (MINIMO_SETOR[a] - contagem(a)),
      )[0]
      const id = `ufp-newgen-${normalizar(clube.curto)}-${novaTemporada}-${indice}`
      const primeiroNome = ["Lucas","Gabriel","Matheus","Rafael","Diego","Thiago","Bruno","Caio","Enzo","Vinicius"][hash(`${id}:nome`) % 10]
      const sobrenome = ["Silva","Santos","Oliveira","Costa","Souza","Pereira","Almeida","Lima","Rocha","Martins"][hash(`${id}:sobrenome`) % 10]
      const posicao: Record<SetorUniverso286, string[]> = {
        GOL: ["GOL"], DEF: ["ZAG","ZAG","LD","LE"], MEI: ["VOL","MEI","MEI"], ATA: ["ATA","PE","PD"],
      }
      const posicoes = posicao[setor]
      const pos = posicoes[hash(`${id}:pos`) % posicoes.length]
      const idade = 16 + hash(`${id}:idade`) % 4
      const overall = limitar(clube.prestigio - 24 + hash(`${id}:ovr`) % 13, 42, 78)
      const potencial = limitar(overall + 8 + hash(`${id}:pot`) % 14, overall, 95)
      const entrada: EntradaJogadorUniverso286 = { nome: `${primeiroNome} ${sobrenome}`, posicao: pos, idade, overall, nacionalidade: clube.pais }
      const novo: JogadorUniverso286 = {
        id, nome: entrada.nome, posicao: pos, setor, idade, overall, potencial,
        nacionalidade: clube.pais, clubeCurto: clube.curto,
        contrato: { ateTemporada: novaTemporada + 3, salarioSemanal: salarioSemanal(overall, clube.prestigio) },
        moral: 68, condicao: 100, lesaoSemanas: 0,
        valor: valorDeMercado(overall, idade, potencial), atributos: atributos(entrada),
        temporada: estatisticasVazias(), historico: [],
      }
      estado.jogadores[id] = novo
      // O garoto nasce JÁ no índice: sem isto ele existiria em `jogadores` e não
      // apareceria no elenco do clube que acabou de formá-lo.
      const noIndice = indiceDeElencos(estado).get(clube.curto)
      if (noIndice) noIndice.push(novo)
      else indiceDeElencos(estado).set(clube.curto, [novo])
      clube.folhaSemanal += novo.contrato.salarioSemanal
      atuais.push(novo)
    }
  }
  estado.temporada = novaTemporada
  estado.ultimaSemanaProcessada = 0
  for (const clube of Object.values(estado.clubes)) {
    clube.carencias = calcularCarencias(clube, elencoDoClube(estado, clube.curto))
  }
}

/**
 * Avança todas as ligas da CPU uma semana e, quando a janela está aberta,
 * executa negociações orientadas por carência com compradores concorrentes.
 */
export function avancarUniverso286(
  atual: UniversoPersistente286,
  params: { temporada: number; semana: number; janelaAberta: boolean; quantidadeNegocios?: number },
): ResultadoAvancoUniverso286 {
  /**
   * ⚠️ ESTE CLONE PARECE DESPERDÍCIO E NÃO É — NÃO O REMOVA SEM LER ISTO.
   *
   * Ele custa **47 ms por semana** sobre um universo de 3,55 MB (medido em
   * `scripts/medir-universo-286.ts`, 14/08/2026), ou seja, mais da metade dos
   * 81 ms que esta função inteira leva. É um alvo óbvio para quem estiver
   * caçando lentidão — e foi exatamente por isso que eu vim aqui.
   *
   * O que ele garante: **atomicidade**. O `atual` que chega aqui é o objeto que
   * está DENTRO DO SAVE (`use-game-manager` passa `currentState.universo286`),
   * e esta função tem centenas de linhas de mutação. Mutar no lugar faria
   * qualquer falha no meio do caminho deixar o save com um universo pela
   * metade: clubes com a tabela da semana nova, outros com a velha, negócios
   * aplicados só de um lado. Não daria erro visível — daria um mundo incoerente
   * que ninguém liga à causa.
   *
   * E a falha no meio do caminho NÃO é hipótese: `app/calendario/page.tsx`
   * trata explicitamente `catch` por semana durante a simulação, justamente
   * porque já aconteceu.
   *
   * Se um dia isto precisar mesmo ser mais barato, o caminho é copiar sob
   * demanda (só o clube tocado), preservando a atomicidade — e não confiar em
   * mutar no lugar porque "o chamador descarta o antigo mesmo".
   */
  const estado = structuredClone(atual)
  const virouTemporada = params.temporada > estado.temporada
  if (virouTemporada) virarTemporada(estado, params.temporada)
  if (params.temporada < estado.temporada || (!virouTemporada && params.semana <= estado.ultimaSemanaProcessada)) {
    return { estado, novosNegocios: [], resultadosSimulados: 0 }
  }
  let resultadosSimulados = 0
  for (let semana = estado.ultimaSemanaProcessada + 1; semana <= params.semana; semana++) {
    atualizarCondicaoELesoes(estado, semana)
    for (const liga of Object.values(estado.ligas)) resultadosSimulados += simularRodadaDaLiga(estado, liga, semana)
  }
  const novosNegocios = params.janelaAberta
    ? simularMercado(estado, params.semana, Math.max(0, params.quantidadeNegocios ?? 2))
    : []
  estado.negocios = [...novosNegocios, ...estado.negocios].slice(0, 600)
  estado.ultimaSemanaProcessada = params.semana
  return { estado, novosNegocios, resultadosSimulados }
}

// ── Ponte de leitura para players-data ─────────────────────────────────────
// O save é a fonte durável; este cache só evita que players-data precise importar
// hooks React. use-game-manager o atualiza sempre que o save muda.

let universoAtivo: UniversoPersistente286 | null = null
let elencosAtivos = new Map<string, JogadorUniverso286[]>()

export function definirUniversoAtivo286(estado?: UniversoPersistente286 | null): void {
  universoAtivo = estado ?? null
  elencosAtivos = new Map()
  if (!universoAtivo) return
  for (const jogador of Object.values(universoAtivo.jogadores)) {
    if (!jogador.clubeCurto || jogador.condicao <= 0) continue
    const lista = elencosAtivos.get(jogador.clubeCurto) ?? []
    lista.push(jogador)
    elencosAtivos.set(jogador.clubeCurto, lista)
  }
}

export function elencoPersistente286(clubeCurto: string): JogadorUniverso286[] | null {
  if (!universoAtivo || clubeCurto === universoAtivo.clubeDoUsuario) return null
  return elencosAtivos.get(clubeCurto) ?? []
}

export function candidatosScouting286(estado?: UniversoPersistente286 | null): JogadorUniverso286[] {
  if (!estado) return []
  return Object.values(estado.jogadores).filter(jogador =>
    jogador.clubeCurto !== estado.clubeDoUsuario && jogador.condicao > 0,
  )
}
