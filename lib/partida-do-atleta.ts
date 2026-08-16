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
  }
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
): { partida: PartidaEmCurso; resultado: ResultadoDoMomento } {
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
export function partidaTerminou(partida: PartidaEmCurso): boolean {
  return partida.atual >= partida.momentos.length
}
