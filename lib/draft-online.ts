// DRAFT ONLINE — técnico contra técnico, montando elenco na escolha alternada.
//
// ⚠️ POR QUE ISTO EXISTE (pedido de 12/08/2026: "remova a opção modos locais,
// draft seria bom para o online como um modo online draft x draft").
//
// O Draft já existia em "Modos locais", e era um formulário: um campo de texto
// onde se DIGITAVA o nome do atleta, sem catálogo, sem elenco montado no fim e
// sem partida. Ele nunca virou jogo. Aqui ele vira — e no lugar certo, que é o
// online: draft só tem graça quando o atleta que você não pegou vai para a mão
// de alguém que está do outro lado.
//
// ── AS DUAS DECISÕES QUE FAZEM ISTO FUNCIONAR SEM MEXER NO SERVIDOR ─────────
//
// 1. O CATÁLOGO NÃO TRAFEGA. Ele é DERIVADO do código da sala: todo mundo gera
//    a mesma lista, na mesma ordem, a partir da mesma semente. Mandar 200
//    atletas pelo relay a cada entrada de participante seria o caminho fácil e
//    o mais frágil — bastaria um cliente com dado de versão diferente para as
//    listas divergirem sem ninguém perceber.
//
// 2. A ORDEM É DO RELAY, NÃO DO RELÓGIO. Cada escolha viaja como `career_command`
//    (canal genérico que o relay já replica com `sequence` monotônico) e o
//    estado do draft é RECONSTRUÍDO a partir da lista ordenada de comandos. Dois
//    técnicos clicando no mesmo atleta no mesmo instante não empatam: vence o
//    menor `sequence`, e o outro recebe a lista já sem o atleta. Sem isto seria
//    preciso um árbitro no servidor — e o relay teria de aprender o protocolo do
//    draft, o que trava a publicação atrás de um deploy de VPS.
//
// O relay continua sem saber o que é um draft. Ele só carrega comandos.

/** Um atleta disponível no catálogo do draft. */
export interface AtletaDoDraft {
  id: string
  nome: string
  posicao: string
  setor: "GOL" | "DEF" | "MEI" | "ATA"
  overall: number
  idade: number
  clube: string
}

/** Uma escolha já registrada, na ordem em que o relay a aceitou. */
export interface EscolhaDoDraft {
  sequence: number
  participantId: string
  atletaId: string
}

export interface ConfiguracaoDoDraft {
  /** Participantes, na ordem de entrada na sala. */
  participantes: string[]
  /** Quantos atletas cada técnico monta. 11 = time titular. */
  escolhasPorTecnico: number
  /** Tamanho do catálogo. Precisa sobrar escolha para o último da fila. */
  tamanhoDoCatalogo: number
}

export interface EstadoDoDraft {
  /** De quem é a vez. `null` quando acabou. */
  daVez: string | null
  /** Número da escolha atual (1 é a primeira). */
  rodada: number
  totalDeEscolhas: number
  escolhasFeitas: number
  encerrado: boolean
  /** Elenco montado por técnico, na ordem em que foi escolhido. */
  elencos: Record<string, AtletaDoDraft[]>
  /** Quem ainda está na mesa. */
  disponiveis: AtletaDoDraft[]
}

export const MINIMO_DE_TECNICOS = 2
export const ESCOLHAS_PADRAO = 11

/** Hash estável: a mesma sala gera o mesmo catálogo em qualquer máquina. */
function semente(texto: string): number {
  let valor = 2166136261
  for (let i = 0; i < texto.length; i++) {
    valor ^= texto.charCodeAt(i)
    valor = Math.imul(valor, 16777619)
  }
  return valor >>> 0
}

function sorteio(chave: string): number {
  return semente(chave) / 4294967295
}

/**
 * ORDEM SERPENTINA (1-2-3-3-2-1), como em qualquer draft de verdade.
 *
 * Ordem fixa daria uma vantagem grande demais a quem escolhe primeiro: ele
 * levaria o melhor de cada rodada, sempre. Na serpentina, quem escolhe por
 * último fecha a rodada e abre a seguinte — o custo de escolher tarde volta
 * como compensação.
 */
export function ordemDasEscolhas(participantes: string[], escolhasPorTecnico: number): string[] {
  const ordem: string[] = []
  for (let rodada = 0; rodada < escolhasPorTecnico; rodada++) {
    const fila = rodada % 2 === 0 ? participantes : [...participantes].reverse()
    ordem.push(...fila)
  }
  return ordem
}

/**
 * O catálogo da sala, igual para todos.
 *
 * A distribuição por setor não é enfeite: um catálogo sorteado sem regra
 * entrega salas com três goleiros e nenhum zagueiro, e aí o draft deixa de ser
 * escolha e vira sorte. As cotas garantem que dá para montar 11 de verdade.
 */
export function catalogoDoDraft(
  codigoDaSala: string,
  elencoDoMundo: readonly AtletaDoDraft[],
  tamanho: number,
): AtletaDoDraft[] {
  const porSetor: Record<AtletaDoDraft["setor"], AtletaDoDraft[]> = { GOL: [], DEF: [], MEI: [], ATA: [] }
  for (const atleta of elencoDoMundo) porSetor[atleta.setor]?.push(atleta)
  // Cota por setor espelhando um elenco de futebol (1 goleiro para cada 10 de linha).
  const cotas: [AtletaDoDraft["setor"], number][] = [
    ["GOL", Math.max(2, Math.round(tamanho * 0.12))],
    ["DEF", Math.max(4, Math.round(tamanho * 0.32))],
    ["MEI", Math.max(4, Math.round(tamanho * 0.32))],
    ["ATA", Math.max(3, Math.round(tamanho * 0.24))],
  ]
  const escolhidos: AtletaDoDraft[] = []
  for (const [setor, cota] of cotas) {
    const ordenados = [...porSetor[setor]]
      .sort((a, b) => sorteio(`${codigoDaSala}:${a.id}`) - sorteio(`${codigoDaSala}:${b.id}`))
      .slice(0, cota)
    escolhidos.push(...ordenados)
  }
  // Ordem final também determinística — a lista aparece igual para os dois lados.
  return escolhidos.sort((a, b) => sorteio(`${codigoDaSala}:ordem:${a.id}`) - sorteio(`${codigoDaSala}:ordem:${b.id}`))
}

/**
 * Reconstrói o draft a partir do catálogo e da lista de escolhas do relay.
 *
 * É uma função PURA sobre a lista ordenada de comandos: dois clientes com os
 * mesmos comandos chegam ao mesmo estado, sempre. É o que dispensa um árbitro.
 */
export function estadoDoDraft(
  catalogo: readonly AtletaDoDraft[],
  escolhas: readonly EscolhaDoDraft[],
  config: ConfiguracaoDoDraft,
): EstadoDoDraft {
  const ordem = ordemDasEscolhas(config.participantes, config.escolhasPorTecnico)
  const porId = new Map(catalogo.map(atleta => [atleta.id, atleta]))
  const elencos: Record<string, AtletaDoDraft[]> = {}
  for (const participante of config.participantes) elencos[participante] = []

  const jaEscolhidos = new Set<string>()
  // Ordena pelo `sequence` do relay: é ele que decide quem chegou primeiro
  // quando dois clientes pedem o mesmo atleta no mesmo instante.
  const validas = [...escolhas].sort((a, b) => a.sequence - b.sequence)
  let passo = 0
  for (const escolha of validas) {
    if (passo >= ordem.length) break
    // Escolha de quem não era a vez, ou de atleta já levado, é DESCARTADA — não
    // rejeitada com erro. O cliente que a mandou vai reconstruir o mesmo estado
    // e simplesmente ver que o atleta não é dele.
    if (escolha.participantId !== ordem[passo]) continue
    if (jaEscolhidos.has(escolha.atletaId)) continue
    const atleta = porId.get(escolha.atletaId)
    if (!atleta) continue
    jaEscolhidos.add(escolha.atletaId)
    elencos[escolha.participantId] = [...(elencos[escolha.participantId] ?? []), atleta]
    passo++
  }

  const encerrado = passo >= ordem.length
  return {
    daVez: encerrado ? null : ordem[passo],
    rodada: Math.floor(passo / Math.max(1, config.participantes.length)) + 1,
    totalDeEscolhas: ordem.length,
    escolhasFeitas: passo,
    encerrado,
    elencos,
    disponiveis: catalogo.filter(atleta => !jaEscolhidos.has(atleta.id)),
  }
}

/** É a vez deste técnico? A tela só libera o clique quando sim. */
export function podeEscolher(estado: EstadoDoDraft, participantId: string): boolean {
  return !estado.encerrado && estado.daVez === participantId
}

/**
 * Força do elenco montado — serve de placar da sala antes de qualquer partida.
 * Média dos 11 melhores, com o goleiro contando à parte: um draft sem goleiro
 * não pode aparecer com a mesma nota de um com goleiro.
 */
export function forcaDoElenco(elenco: readonly AtletaDoDraft[]): number {
  if (elenco.length === 0) return 0
  const goleiro = elenco.filter(a => a.setor === "GOL").sort((a, b) => b.overall - a.overall)[0]
  const linha = elenco.filter(a => a.setor !== "GOL").sort((a, b) => b.overall - a.overall).slice(0, 10)
  const soma = linha.reduce((total, a) => total + a.overall, 0) + (goleiro?.overall ?? 45)
  return Math.round(soma / (linha.length + 1))
}
