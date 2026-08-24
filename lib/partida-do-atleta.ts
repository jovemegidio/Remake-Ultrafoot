// A PARTIDA VIVIDA PELO SEU ATLETA.
//
// É o pedido dos itens 7 e 8 da especificação do usuário — "você controla
// apenas o seu jogador", inclusive a entrada do banco — trazido para o que este
// jogo É.
//
// ⚠️ O QUE ESTE ARQUIVO NÃO FAZ, E POR QUE: não transforma o Ultrafoot num jogo
// de ação. O motor 3D daqui ENCENA o que a simulação já decidiu — o placar
// existe antes da animação (ver [[ultrafoot-motor-3d]]). Controlar um corpo em
// campo exigiria o motor decidir a partir do input quadro a quadro, que é
// reescrever o núcleo da partida e jogar fora a calibração de 20 mil jogos do
// harness.
//
// O que dá para fazer — e é o que um manager pode fazer melhor que um jogo de
// ação — é entregar os MOMENTOS. A partida roda no motor de sempre; quando a
// bola passa pelo seu atleta, o jogo para e a decisão é sua: arrisca o drible
// ou toca? Chuta de fora ou espera o passe? Sobe para o escanteio ou segura a
// posição? Cada escolha é resolvida pelos ATRIBUTOS dele, muda a nota na hora e
// pode virar gol, assistência ou perda de bola.
//
// É "Be a Pro" pela lente de um manager: você não controla o corpo, controla as
// DECISÕES — que é justamente o que o resto do jogo já faz com o técnico.

import type { EstadoCarreiraDeJogador, PosicaoDoAtleta } from "@/lib/carreira-de-jogador"

import {
  avancarAteOLance,
  iniciarPartidaAoVivo,
  partidaAcabou,
  resolverLance,
  type LanceDoAtleta,
  type PartidaAoVivo,
} from "@/lib/partida-ao-vivo-do-atleta"
import type { MatchConfig } from "@/lib/match-engine"

export type TipoDeMomento =
  | "entrada"      // o treinador te chama do banco
  | "ataque"       // bola no seu pé, no último terço
  | "criacao"      // bola no meio, com opções
  | "defesa"       // duelo, cobertura, desarme
  | "bola_parada"  // falta, escanteio, pênalti
  | "fim"          // apito final

export interface EscolhaDoMomento {
  id: string
  texto: string
  /** O atributo que decide se dá certo. */
  atributo: "ritmo" | "finalizacao" | "passe" | "drible" | "defesa" | "fisico"
  /** Quanto o lance é difícil (0–1). Mais alto = mais chance de dar errado. */
  risco: number
  /** O que se ganha quando dá certo. */
  recompensa: "gol" | "assistencia" | "chance" | "posse" | "desarme" | "nada"
}

export interface MomentoDaPartida {
  id: string
  minuto: number
  tipo: TipoDeMomento
  narracao: string
  escolhas: EscolhaDoMomento[]
}

export interface ResultadoDoMomento {
  sucesso: boolean
  narracao: string
  deltaNota: number
  gol: boolean
  assistencia: boolean
}

/** O estado de uma partida em curso, guardado no save enquanto ela não acaba. */
/**
 * UM LANCE DA NARRAÇÃO — a partida inteira, não só os seus momentos.
 *
 * ⚠️ POR QUE ISTO PRECISOU EXISTIR. O usuário pediu que a partida do atleta
 * fosse "como a tela ao vivo do técnico" e depois foi direto ao ponto: "sem
 * narração". Ele estava certo. O modo tinha campo e tinha as SUAS decisões, mas
 * o jogo em volta acontecia no escuro: o placar aparecia pronto no cabeçalho e
 * ninguém contava quando os gols saíram, quem marcou, se veio pênalti.
 *
 * A partida JÁ está decidida quando esta tela abre — isso não muda, e é o que
 * mantém o modo honesto. O que muda é que agora ela é CONTADA.
 */
export interface LanceNarrado {
  minuto: number
  texto: string
  tipo: "apito" | "gol-pro" | "gol-contra" | "intervalo" | "voce"
}

export interface PartidaEmCurso {
  fixtureId: string
  adversario: string
  emCasa: boolean
  competicao: string
  rodada: number
  /** Placar que o motor produziu — a partida já foi decidida. */
  golsPro: number
  golsContra: number
  /** Minutos que o atleta vai ter (0 = não entrou). */
  minutos: number
  titular: boolean
  momentos: MomentoDaPartida[]
  /** Índice do momento atual. */
  atual: number
  /** Nota viva, que sobe e desce a cada decisão. */
  nota: number
  gols: number
  assistencias: number
  historico: { minuto: number; texto: string; delta: number }[]
  /**
   * A NARRAÇÃO DA PARTIDA INTEIRA (1.0.353). Opcional: partidas já em andamento
   * em saves antigos não têm, e a tela trata a ausência sem quebrar.
   */
  narracaoDaPartida?: LanceNarrado[]
  /**
   * ⚠️ A PARTIDA DE VERDADE, quando o resultado é ABERTO.
   *
   * Presente, ela manda: o placar sai do `MatchState` vivo e os momentos são
   * gerados um a um, conforme o atleta se envolve. Ausente, vale o caminho
   * antigo — que é o que os saves já em andamento têm, e por isso ele continua
   * inteiro aqui em vez de ser apagado.
   *
   * A tela não precisa saber a diferença: `momentos[atual]`, `golsPro` e
   * `decidirMomento` continuam significando a mesma coisa nos dois casos.
   */
  aoVivo?: PartidaAoVivo
}

// ─── Sorteio semeado (mesmo padrão do resto da carreira) ────────────────────

function hash(seed: string): number {
  let h = 2166136261
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function roll(seed: string): number { return (hash(seed) % 10000) / 10000 }

// ─── Montagem dos momentos ──────────────────────────────────────────────────

const MOMENTOS_POR_POSICAO: Record<PosicaoDoAtleta, TipoDeMomento[]> = {
  GOL: ["defesa", "defesa", "criacao", "bola_parada", "defesa"],
  ZAG: ["defesa", "defesa", "bola_parada", "criacao", "defesa"],
  LD: ["defesa", "criacao", "ataque", "defesa", "criacao"],
  LE: ["defesa", "criacao", "ataque", "defesa", "criacao"],
  VOL: ["defesa", "criacao", "criacao", "defesa", "bola_parada"],
  MEI: ["criacao", "ataque", "criacao", "bola_parada", "ataque"],
  ATA: ["ataque", "ataque", "criacao", "ataque", "bola_parada"],
}

function escolhasDoMomento(tipo: TipoDeMomento, posicao: PosicaoDoAtleta): EscolhaDoMomento[] {
  switch (tipo) {
    case "ataque":
      return [
        { id: "chutar", texto: "Chutar de primeira", atributo: "finalizacao", risco: 0.62, recompensa: "gol" },
        { id: "driblar", texto: "Encarar o marcador", atributo: "drible", risco: 0.5, recompensa: "chance" },
        { id: "tocar", texto: "Tocar para quem está melhor", atributo: "passe", risco: 0.22, recompensa: "assistencia" },
      ]
    case "criacao":
      return [
        { id: "vertical", texto: "Lançar nas costas da defesa", atributo: "passe", risco: 0.55, recompensa: "assistencia" },
        { id: "conduzir", texto: "Conduzir e atrair a marcação", atributo: "drible", risco: 0.4, recompensa: "chance" },
        { id: "seguro", texto: "Passe curto, manter a posse", atributo: "passe", risco: 0.12, recompensa: "posse" },
      ]
    case "defesa":
      return [
        { id: "dividir", texto: "Ir para a dividida", atributo: "fisico", risco: 0.5, recompensa: "desarme" },
        { id: "antecipar", texto: "Antecipar a jogada", atributo: "defesa", risco: 0.42, recompensa: "desarme" },
        { id: "conter", texto: "Segurar e esperar a cobertura", atributo: "defesa", risco: 0.18, recompensa: "posse" },
      ]
    case "bola_parada":
      return posicao === "GOL" || posicao === "ZAG"
        ? [
          { id: "subir", texto: "Subir para a área", atributo: "fisico", risco: 0.68, recompensa: "gol" },
          { id: "marcar", texto: "Ficar na marcação", atributo: "defesa", risco: 0.15, recompensa: "posse" },
        ]
        : [
          { id: "bater", texto: "Bater direto", atributo: "finalizacao", risco: 0.7, recompensa: "gol" },
          { id: "cruzar", texto: "Cruzar na área", atributo: "passe", risco: 0.45, recompensa: "assistencia" },
          { id: "tabelar", texto: "Bater curto e tabelar", atributo: "drible", risco: 0.3, recompensa: "chance" },
        ]
    default:
      return []
  }
}

const NARRACAO: Record<TipoDeMomento, string[]> = {
  ataque: ["A bola sobra para você na entrada da área.", "Você recebe de costas, com espaço para girar.", "Contra-ataque: você entra em velocidade."],
  criacao: ["Você recebe no meio, com o campo à frente.", "A bola chega limpa, e o time sobe.", "Você aparece para a saída de bola."],
  defesa: ["O atacante encara você no um contra um.", "Bola dividida no meio-campo.", "Eles avançam pelo seu lado."],
  bola_parada: ["Falta na entrada da área.", "Escanteio a favor.", "Falta lateral, área cheia."],
  entrada: ["O treinador te chama."],
  fim: ["Apito final."],
}

/**
 * Monta a partida a partir do que o motor JÁ decidiu.
 *
 * ⚠️ O placar entra pronto. Os momentos redistribuem PARTICIPAÇÃO dentro dele —
 * um gol seu sai dos gols que o time fez, exatamente como na simulação
 * automática. Sem isso o modo produziria atacante com 2 gols em derrota por
 * 1 a 0, que é o erro que a carreira evita desde o primeiro dia.
 */
export function montarPartidaDoAtleta(
  estado: EstadoCarreiraDeJogador,
  dados: {
    fixtureId: string; adversario: string; emCasa: boolean; competicao: string; rodada: number
    golsPro: number; golsContra: number; minutos: number; titular: boolean
  },
): PartidaEmCurso {
  const semente = `${estado.atleta.id}:${dados.fixtureId}`
  const momentos: MomentoDaPartida[] = []

  if (!dados.titular && dados.minutos > 0) {
    momentos.push({
      id: "entrada",
      minuto: 90 - dados.minutos,
      tipo: "entrada",
      narracao: `${90 - dados.minutos}': o treinador te chama. Você entra na vaga de um companheiro.`,
      escolhas: [
        { id: "intensidade", texto: "Entrar com intensidade e pressionar", atributo: "fisico", risco: 0.3, recompensa: "posse" },
        { id: "leitura", texto: "Entrar lendo o jogo antes de arriscar", atributo: "passe", risco: 0.15, recompensa: "posse" },
      ],
    })
  }

  // Quantos momentos: proporcional aos minutos. Quem entrou aos 80 vive dois
  // lances, não cinco — é o que faz valer a pena ser titular.
  const quantos = Math.max(1, Math.round((dados.minutos / 90) * 5))
  const tipos = MOMENTOS_POR_POSICAO[estado.atleta.posicao]
  for (let i = 0; i < quantos; i++) {
    const tipo = tipos[i % tipos.length]
    const minuto = Math.round((90 - dados.minutos) + ((i + 1) / (quantos + 1)) * dados.minutos)
    const narracoes = NARRACAO[tipo]
    momentos.push({
      id: `momento_${i}`,
      minuto,
      tipo,
      narracao: `${minuto}': ${narracoes[Math.floor(roll(`${semente}:n:${i}`) * narracoes.length)]}`,
      escolhas: escolhasDoMomento(tipo, estado.atleta.posicao),
    })
  }

  return {
    ...dados,
    momentos,
    atual: 0,
    // Começa em 6.0 como na simulação automática; as decisões movem daqui.
    nota: 6,
    gols: 0,
    assistencias: 0,
    historico: [],
    narracaoDaPartida: montarNarracao(dados, semente),
  }
}

/**
 * A NARRAÇÃO DA PARTIDA — o jogo em volta do atleta, contado.
 *
 * ⚠️ ELA NÃO INVENTA PLACAR. O motor já decidiu quantos gols cada lado fez antes
 * desta tela abrir; o que falta é DISTRIBUIR esses gols no relógio e dar-lhes
 * palavras. Sortear um gol a mais aqui faria a narração mentir sobre o placar
 * que o cabeçalho mostra — o defeito clássico de encenação que contradiz o dado.
 *
 * Os minutos saem do mesmo sorteio semeado do resto do modo, então a mesma
 * partida é contada igual toda vez que o jogador voltar a ela.
 */
function montarNarracao(
  dados: { adversario: string; emCasa: boolean; golsPro: number; golsContra: number; minutos: number; titular: boolean },
  semente: string,
): LanceNarrado[] {
  const lances: LanceNarrado[] = [
    { minuto: 0, tipo: "apito", texto: "Bola rolando." },
  ]

  // Minutos dos gols: sorteados e ORDENADOS, para a narração não voltar no tempo.
  const minutoDoGol = (lado: string, i: number) =>
    1 + Math.floor(roll(`${semente}:gol:${lado}:${i}`) * 89)

  const doTime = Array.from({ length: dados.golsPro }, (_, i) => ({
    minuto: minutoDoGol("pro", i), tipo: "gol-pro" as const,
  }))
  const doAdversario = Array.from({ length: dados.golsContra }, (_, i) => ({
    minuto: minutoDoGol("contra", i), tipo: "gol-contra" as const,
  }))

  // ⚠️ O PLACAR CORRENDO, e não uma frase genérica. "GOL!" sozinho obriga o
  // jogador a olhar para o cabeçalho para saber como o jogo está; a narração de
  // verdade diz o número. Por isso os gols são ordenados ANTES de ganhar texto.
  let pro = 0
  let contra = 0
  for (const g of [...doTime, ...doAdversario].sort((a, b) => a.minuto - b.minuto)) {
    if (g.tipo === "gol-pro") pro++
    else contra++
    lances.push({
      minuto: g.minuto,
      tipo: g.tipo,
      texto: g.tipo === "gol-pro"
        ? `GOL do seu time! ${pro}–${contra}.`
        : `Gol do ${dados.adversario}. ${pro}–${contra}.`,
    })
  }

  lances.push({ minuto: 45, tipo: "intervalo", texto: "Fim do primeiro tempo." })
  if (!dados.titular && dados.minutos > 0) {
    lances.push({
      minuto: 90 - dados.minutos, tipo: "voce",
      texto: "Você entra em campo.",
    })
  }
  lances.push({ minuto: 90, tipo: "apito", texto: "Apito final." })

  return lances.sort((a, b) => a.minuto - b.minuto)
}

/**
 * Resolve a decisão do jogador.
 *
 * O atributo manda, o risco cobra e o acaso tempera — na mesma proporção do
 * resto do jogo. Um atacante de finalização 80 acerta o chute difícil com mais
 * frequência que um de 55, mas nunca sempre.
 */
export function decidirMomento(
  estado: EstadoCarreiraDeJogador,
  partida: PartidaEmCurso,
  escolhaId: string,
  precisaoMira = 1,
): { partida: PartidaEmCurso; resultado: ResultadoDoMomento } {
  // MODO AO VIVO: quem resolve é o módulo da partida real, e o resultado entra
  // no placar. Depois a simulação segue até o próximo envolvimento.
  if (partida.aoVivo) {
    const r = resolverLance(partida.aoVivo, escolhaId, precisaoMira)
    const seguiu = avancarAteOLance(r.partida)
    return {
      partida: comEstadoVivo(partida, seguiu),
      resultado: {
        sucesso: r.desfecho.sucesso, narracao: r.desfecho.narracao,
        deltaNota: r.desfecho.deltaNota, gol: r.desfecho.gol, assistencia: r.desfecho.assistencia,
      },
    }
  }

  const momento = partida.momentos[partida.atual]
  const escolha = momento?.escolhas.find(e => e.id === escolhaId)
  if (!momento || !escolha) return { partida, resultado: { sucesso: false, narracao: "", deltaNota: 0, gol: false, assistencia: false } }

  const valor = estado.atleta.atributos[escolha.atributo]
  // Chance = atributo contra o risco do lance. 50 de atributo num lance de risco
  // médio dá perto de meio a meio; 85 vira favorito claro.
  const chance = Math.max(0.08, Math.min(0.94, (valor / 100) * 1.35 - escolha.risco * 0.75))
  const sorteio = roll(`${estado.atleta.id}:${partida.fixtureId}:${momento.id}:${escolhaId}`)
  const sucesso = sorteio < chance

  // ⚠️ GOL E ASSISTÊNCIA DISPUTAM O MESMO PLACAR — e a conta é a mesma para os
  // dois. O gate pegou a versão anterior: o time fez 1, o atleta saiu com 1 gol
  // E 1 assistência, ou seja, participou de dois gols num jogo de um. A causa
  // era o gol olhar só para `gols` enquanto a assistência olhava para a soma:
  // bastava a assistência vir primeiro. Ninguém assiste o próprio gol, então
  // cada gol do time comporta UMA participação sua.
  const participacoes = partida.gols + partida.assistencias
  const podeGol = participacoes < partida.golsPro
  const podeAssistencia = participacoes < partida.golsPro

  let gol = false, assistencia = false
  let delta: number
  let narracao: string
  if (sucesso) {
    if (escolha.recompensa === "gol" && podeGol) { gol = true; delta = 1.2; narracao = "GOL! Você resolve." }
    else if (escolha.recompensa === "assistencia" && podeAssistencia) { assistencia = true; delta = 0.8; narracao = "Assistência! O passe encontrou o gol." }
    else if (escolha.recompensa === "chance") { delta = 0.45; narracao = "Jogada vencida — o time chega com perigo." }
    else if (escolha.recompensa === "desarme") { delta = 0.4; narracao = "Bola recuperada." }
    else { delta = 0.2; narracao = "Bem resolvido, sem sustos." }
  } else {
    delta = escolha.risco >= 0.5 ? -0.4 : -0.2
    narracao = escolha.risco >= 0.5 ? "Não deu. A jogada morre nos pés do adversário." : "Escolha segura, mas o lance se perde."
  }

  const nova: PartidaEmCurso = {
    ...partida,
    atual: partida.atual + 1,
    nota: Math.max(3, Math.min(10, Math.round((partida.nota + delta) * 10) / 10)),
    gols: partida.gols + (gol ? 1 : 0),
    assistencias: partida.assistencias + (assistencia ? 1 : 0),
    historico: [...partida.historico, { minuto: momento.minuto, texto: narracao, delta }],
  }
  return { partida: nova, resultado: { sucesso, narracao, deltaNota: delta, gol, assistencia } }
}

/** Acabaram os momentos? */

// ─── MODO AO VIVO ────────────────────────────────────────────────────────────
//
// Converte um lance do módulo ao vivo para o formato que a tela já desenha, e
// vice-versa. A ponte existe para NÃO reescrever a tela de partida (417 linhas)
// numa mudança que já é delicada por natureza: trocar quem decide o placar.

const TIPO_DO_LANCE: Record<string, TipoDeMomento> = {
  finalizacao: "ataque",
  falta: "bola_parada",
  penalti: "bola_parada",
  drible: "ataque",
  cabeceio: "ataque",
  passe_decisivo: "criacao",
  cruzamento: "criacao",
  desarme: "defesa",
  defesa: "defesa",
}

function lanceComoMomento(lance: LanceDoAtleta): MomentoDaPartida {
  return {
    id: lance.id,
    minuto: lance.minuto,
    // O vocabulário ao vivo é mais fino (finalização, drible, cruzamento…) que o
    // desta tela, que agrupa em ataque/criação/defesa. Mapear é melhor que
    // inventar um tipo novo: o ícone e a cor que a tela escolhe por `tipo`
    // continuam certos, e nada mais no jogo precisa aprender um valor inédito.
    tipo: TIPO_DO_LANCE[lance.tipo] ?? "criacao",
    narracao: lance.narracao,
    escolhas: lance.opcoes.map(o => ({
      id: o.id,
      texto: o.texto,
      // O vocabulário de atributo é o mesmo dos dois lados.
      atributo: o.atributo as EscolhaDoMomento["atributo"],
      risco: o.risco,
      recompensa: (o.efeito === "gol" ? "gol"
        : o.efeito === "assistencia" ? "assistencia"
          : o.efeito === "desarme" ? "desarme"
            : o.efeito === "chance" ? "chance" : "posse") as EscolhaDoMomento["recompensa"],
    })),
  }
}

/** Sincroniza o que a tela lê a partir do estado vivo. */
function comEstadoVivo(partida: PartidaEmCurso, vivo: PartidaAoVivo): PartidaEmCurso {
  const pro = vivo.emCasa ? vivo.estado.home.goals : vivo.estado.away.goals
  const contra = vivo.emCasa ? vivo.estado.away.goals : vivo.estado.home.goals
  const momentos = vivo.lancePendente ? [lanceComoMomento(vivo.lancePendente)] : []
  return {
    ...partida,
    aoVivo: vivo,
    golsPro: pro,
    golsContra: contra,
    gols: vivo.gols,
    assistencias: vivo.assistencias,
    nota: vivo.nota,
    historico: vivo.historico,
    momentos,
    // Sempre 0: a lista tem no máximo o lance atual. `partidaTerminou` não olha
    // mais para este índice no modo ao vivo.
    atual: 0,
  }
}

/**
 * Monta a partida do atleta COM O RESULTADO EM ABERTO.
 *
 * Diferente de `montarPartidaDoAtleta`, aqui não existe placar de entrada: a
 * partida ainda não foi jogada. Ela corre em `avancarAteOLance` e para quando o
 * atleta se envolve.
 */
export function montarPartidaAoVivo(
  dados: {
    fixtureId: string; adversario: string; emCasa: boolean; competicao: string; rodada: number
    minutos: number; titular: boolean
    config: MatchConfig
    semente: string
    posicao: string
    atributos: Record<string, number>
  },
): PartidaEmCurso {
  const entrada = dados.titular ? 0 : Math.max(0, 90 - dados.minutos)
  const saida = dados.titular && dados.minutos < 90 ? dados.minutos : null
  let vivo = iniciarPartidaAoVivo({
    config: dados.config,
    emCasa: dados.emCasa,
    minutoDeEntrada: entrada,
    minutoDeSaida: saida,
    semente: dados.semente,
    posicao: dados.posicao,
    atributos: dados.atributos,
  })
  vivo = avancarAteOLance(vivo)

  const base: PartidaEmCurso = {
    fixtureId: dados.fixtureId, adversario: dados.adversario, emCasa: dados.emCasa,
    competicao: dados.competicao, rodada: dados.rodada,
    golsPro: 0, golsContra: 0,
    minutos: dados.minutos, titular: dados.titular,
    momentos: [], atual: 0, nota: 6, gols: 0, assistencias: 0, historico: [],
  }
  return comEstadoVivo(base, vivo)
}

export function partidaTerminou(partida: PartidaEmCurso): boolean {
  // Ao vivo, "acabou" é o apito final — não o fim de uma lista montada antes.
  if (partida.aoVivo) return partidaAcabou(partida.aoVivo) && !partida.aoVivo.lancePendente
  return partida.atual >= partida.momentos.length
}
