// REALISMO DO ATLETA estilo Football Manager: nota de partida por jogador,
// acumulo de cartoes -> suspensao, e personalidade/atributos ocultos.
//
// Antes: a nota de partida era do TIME inteiro (uma so), ninguem era suspenso
// por cartao e todo jogador se comportava igual. Estas tres coisas juntas sao o
// que da a "cara de FM" que o usuario pediu.

import type { MatchEvent } from "@/lib/game-engine"

// ─── PERSONALIDADE E ATRIBUTOS OCULTOS ────────────────────────────────────────

export type Temperamento = "líder" | "profissional" | "equilibrado" | "explosivo" | "displicente"

export interface PlayerPersona {
  /** 1-20. Sobe overall mais rapido rumo ao potencial. */
  determinacao: number
  /** 1-20. Treina melhor, menos lesao boba, mantem forma. */
  profissionalismo: number
  /** 1-20. Reage bem a pressao/decisao; baixo = "cabeca fraca". */
  temperamentoNum: number
  /** 1-20. Consistencia — nota varia menos de jogo a jogo. */
  consistencia: number
  /** Rotulo derivado, para exibir na UI. */
  rotulo: Temperamento
}

/** Aleatorio deterministico por semente (id do atleta) — nao muda ao recarregar. */
function rng(semente: number): () => number {
  let h = (semente * 2654435761) >>> 0
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0
    return h / 4294967296
  }
}

/**
 * Gera a persona de um atleta. Craque tende a ser mais profissional/determinado
 * (nao e regra, mas inclina a distribuicao), o que explica por que um talento
 * vira estrela e outro se perde.
 */
export function gerarPersona(playerId: number, overall: number): PlayerPersona {
  const r = rng(playerId || 1)
  const vies = Math.round((overall - 65) / 6) // -6..+6 aprox
  const atrib = () => Math.max(1, Math.min(20, 8 + Math.floor(r() * 9) + vies))
  const determinacao = atrib()
  const profissionalismo = atrib()
  const temperamentoNum = Math.max(1, Math.min(20, 6 + Math.floor(r() * 12)))
  const consistencia = atrib()

  let rotulo: Temperamento
  const media = (determinacao + profissionalismo + temperamentoNum) / 3
  if (determinacao >= 15 && profissionalismo >= 13) rotulo = "líder"
  else if (profissionalismo >= 15) rotulo = "profissional"
  else if (temperamentoNum <= 7) rotulo = "explosivo"
  else if (media <= 8) rotulo = "displicente"
  else rotulo = "equilibrado"

  return { determinacao, profissionalismo, temperamentoNum, consistencia, rotulo }
}

// ─── NOTA DE PARTIDA (6.0 - 10.0) ─────────────────────────────────────────────

export interface ContribJogador {
  gols: number
  assistencias: number
  amarelos: number
  vermelho: boolean
  /**
   * Natureza da expulsao, quando houve. Sem isto o pos-jogo so sabia "foi
   * expulso" e aplicava 1 jogo para tudo — de segundo amarelo a agressao.
   */
  motivoExpulsao?: "segundo_amarelo" | "vermelho_direto"
  expulsaoViolenta?: boolean
}

/** Extrai a contribuicao de cada atleta (por id) a partir dos eventos da partida. */
export function contribuicoesPorJogador(events: MatchEvent[]): Map<number, ContribJogador> {
  const mapa = new Map<number, ContribJogador>()
  const get = (id: number) => {
    let c = mapa.get(id)
    if (!c) { c = { gols: 0, assistencias: 0, amarelos: 0, vermelho: false }; mapa.set(id, c) }
    return c
  }
  for (const e of events) {
    if (e.type === "goal") {
      get(e.playerId).gols++
      if (e.assistPlayerId) get(e.assistPlayerId).assistencias++
    } else if (e.type === "assist" && e.playerId) {
      get(e.playerId).assistencias++
    } else if (e.type === "yellow") {
      get(e.playerId).amarelos++
    } else if (e.type === "red") {
      const c = get(e.playerId)
      c.vermelho = true
      // Save antigo (ou simulacao interna) nao traz o motivo: assume o caso
      // comum, segundo amarelo, que mantem a pena de 1 jogo de antes.
      c.motivoExpulsao = e.motivoExpulsao ?? "segundo_amarelo"
      c.expulsaoViolenta = e.expulsaoViolenta ?? false
    }
  }
  return mapa
}

/**
 * Nota 6.0-10.0 de um atleta na partida. Base 6.5, ajustada por:
 *  - resultado do time (ganhou/empatou/perdeu);
 *  - gol (+1.1), assistencia (+0.7), amarelo (-0.3), vermelho (-2.0);
 *  - clean sheet para defensores/goleiro (+0.5);
 *  - consistencia da persona reduz a variacao aleatoria.
 * Goleiro e zaga ganham menos por gol e mais por nao levar gol.
 */
export function calcularNota(params: {
  posicao: string
  contrib: ContribJogador
  resultado: "win" | "draw" | "loss"
  golsSofridos: number
  consistencia?: number
  semente: number
}): number {
  const { posicao, contrib, resultado, golsSofridos } = params
  const defensivo = ["GOL", "ZAG", "LE", "LD"].includes(posicao)

  let nota = 6.5
  nota += resultado === "win" ? 0.5 : resultado === "draw" ? 0.1 : -0.3
  nota += contrib.gols * (defensivo ? 1.4 : 1.1)
  nota += contrib.assistencias * 0.7
  nota -= contrib.amarelos * 0.3
  if (contrib.vermelho) nota -= 2.0
  if (defensivo) nota += golsSofridos === 0 ? 0.6 : golsSofridos >= 3 ? -0.5 : 0

  // Variacao aleatoria, menor para quem e consistente.
  const r = rng(params.semente)
  const amplitude = 0.9 - ((params.consistencia ?? 10) / 20) * 0.7 // 0.2..0.9
  nota += (r() - 0.5) * 2 * amplitude

  return Math.max(4.5, Math.min(10, Math.round(nota * 10) / 10))
}

// ─── MORAL CONTINUA (0-100) ───────────────────────────────────────────────────
//
// A moral do jogo e um ROTULO ("Feliz".."Infeliz") em 112 lugares — refatorar
// tudo seria arriscado. Em vez disso guardamos um valor 0-100 que SUSTENTA o
// rotulo: a nota de partida move os pontos de forma fina, e o rotulo e derivado
// deles. Codigo antigo que le o rotulo continua funcionando.

export type MoralLabel = "Infeliz" | "Insatisfeito" | "Normal" | "Motivado" | "Feliz"

export function rotuloDaMoral(pontos: number): MoralLabel {
  if (pontos >= 82) return "Feliz"
  if (pontos >= 64) return "Motivado"
  if (pontos >= 42) return "Normal"
  if (pontos >= 22) return "Insatisfeito"
  return "Infeliz"
}

/** Ponto de partida quando so existe o rotulo (saves antigos). */
export function pontosDoRotulo(label: MoralLabel): number {
  return { Feliz: 90, Motivado: 74, Normal: 55, Insatisfeito: 32, Infeliz: 12 }[label] ?? 55
}

// ─── CARTOES → SUSPENSAO ──────────────────────────────────────────────────────

/**
 * Suspensao apos a partida. A cada 5 amarelos acumulados na temporada, +1 jogo
 * (e o contador reduz 5). Devolve a suspensao a aplicar e os amarelos que sobram.
 *
 * `jogosPorExpulsao` e quanto o vermelho custa. O default 1 e o comportamento
 * historico; quem julga no tribunal (lib/tribunal) passa a pena de verdade, que
 * vai de 1 (segundo amarelo) a 8 (agressao agravada). Esta funcao NAO importa o
 * tribunal de proposito — ela e pura e o julgamento tem sorteio.
 */
export function suspensaoPorCartoes(
  amarelosAcumulados: number,
  amarelosNaPartida: number,
  vermelho: boolean,
  jogosPorExpulsao = 1,
): { suspender: number; amarelosRestantes: number } {
  let total = amarelosAcumulados + amarelosNaPartida
  let suspender = 0
  while (total >= 5) { suspender += 1; total -= 5 }
  if (vermelho) suspender += Math.max(1, Math.round(jogosPorExpulsao))
  return { suspender, amarelosRestantes: total }
}
