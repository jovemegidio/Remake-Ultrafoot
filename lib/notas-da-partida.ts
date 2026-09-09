// A NOTA DE CADA ATLETA DURANTE A PARTIDA.
//
// ⚠️ POR QUE ISTO EXISTE. Na partida ao vivo as listas laterais mostravam o
// nome e uma barrinha de condicao — e nada mais. Quem simula um jogo inteiro
// olhando aquela tela nao tinha COMO saber quem estava indo bem: o placar diz o
// resultado, a narracao diz os lances, mas ninguem dizia "o seu lateral direito
// esta em 5,4". Sem isso, decidir uma substituicao no minuto 60 era chute.
//
// ⚠️ ISTO NAO MUDA A SIMULACAO, E A DISTINCAO E O PONTO.
//
// A nota e DERIVADA dos eventos que o motor ja produziu — ela nao entra em
// nenhuma conta, nao altera probabilidade de gol, nao realimenta o motor. E
// leitura, no sentido estrito: se este arquivo sumisse, o placar de toda partida
// do jogo continuaria exatamente o mesmo. Foi escrito assim de proposito, porque
// mexer no equilibrio do motor para ganhar um numero na tela seria trocar uma
// coisa barata por uma cara.
//
// A escala e a do futebol: 6,0 e a nota de quem cumpriu, e ela sobe e desce a
// partir dali. Nao ha 0 nem 10 — atleta que so entrou nao leva zero, e nem o
// autor de tres gols chega a nota cheia. Esse e o comportamento que se espera de
// uma nota de jogo, e o contrario (escala aberta) faz a coluna inteira parecer
// aleatoria.

import type { MatchEvent } from "@/lib/match-engine"

/** Onde a nota comeca. Quem entrou em campo e nao fez nada termina aqui. */
export const NOTA_BASE = 6.0

const PISO = 3.0
const TETO = 9.8

/**
 * Quanto cada acontecimento vale.
 *
 * ⚠️ O GOL SOFRIDO NAO PUNE O GOLEIRO SOZINHO. O motor diz quem FEZ o gol, nao
 * quem falhou — e deduzir a culpa a partir do lado puniria o arqueiro por um
 * contra-ataque que nasceu de erro do meio. Enquanto o evento nao trouxer o
 * responsavel, o time inteiro leva um desconto pequeno e ninguem carrega a
 * culpa sozinho. Chutar um culpado seria pior do que nao apontar nenhum.
 */
const PESO: Partial<Record<MatchEvent["type"], number>> = {
  goal: 1.4,
  yellow_card: -0.4,
  red_card: -1.6,
  // Chance perdida custa pouco: quem finaliza e quem tenta, e uma nota que pune
  // a tentativa ensinaria o jogador a nao gostar do proprio atacante.
  miss: -0.25,
  // ⚠️ `save` E O QUE FINALMENTE DA NOTA AO GOLEIRO. Sem ele o arqueiro
  // terminava toda partida em 6,0 cravado — o unico atleta do time que nunca
  // aparecia nos eventos de ataque. Defesa e o trabalho dele; e o evento que o
  // motor ja emitia e ninguem lia.
  save: 0.35,
  post: 0.1,
}

/** O que o passe para o gol vale para quem deu. */
const PESO_ASSISTENCIA = 0.8

/** Desconto no time que sofreu o gol, dividido por todo mundo. */
const DESCONTO_POR_GOL_SOFRIDO = -0.12

export interface NotaDoAtleta {
  /** 3,0 a 9,8. */
  nota: number
  /** Quantos acontecimentos entraram nesta nota — para a tela saber se ha o que mostrar. */
  eventos: number
  /**
   * ── O QUE ESTE ATLETA FEZ, para a coluna lateral marcar ──────────────────
   *
   * Pedido do PDF Ultra26 (p.2): "jogadores com cartao amarelo/vermelho devem
   * ter um destaque, quem fez os gols e deu assistencias tambem".
   *
   * Sai daqui, e nao de uma segunda varredura na tela, porque a varredura dos
   * eventos ja acontece nesta funcao: contar de novo do lado de fora seria a
   * mesma regra escrita duas vezes, com duas chances de divergir. Continua
   * valendo o aviso do topo — isto e LEITURA, nao entra em conta nenhuma.
   */
  gols: number
  assistencias: number
  amarelo: boolean
  vermelho: boolean
}

/**
 * Calcula a nota de todos os atletas de um lado a partir dos eventos ate agora.
 *
 * `nomes` e a lista de quem esta em campo por aquele lado; quem nao aparecer em
 * evento nenhum sai com a nota base, que e o correto — um zagueiro sem lance
 * digno de narracao fez o trabalho dele.
 */
export function notasDoLado(
  nomes: readonly string[],
  eventos: readonly MatchEvent[],
  lado: MatchEvent["side"],
  minutoAtual: number,
): Map<string, NotaDoAtleta> {
  const notas = new Map<string, NotaDoAtleta>()
  for (const nome of nomes) {
    notas.set(nome, { nota: NOTA_BASE, eventos: 0, gols: 0, assistencias: 0, amarelo: false, vermelho: false })
  }

  // Gols sofridos: contam para o lado CONTRARIO ao do evento.
  let golsSofridos = 0

  for (const ev of eventos) {
    if (ev.side !== lado) {
      if (ev.type === "goal") golsSofridos++
      continue
    }

    const peso = PESO[ev.type]
    if (peso !== undefined && ev.player) {
      const atual = notas.get(ev.player)
      if (atual) {
        atual.nota += peso
        atual.eventos++
      }
    }
    // Marcadores da coluna lateral. Ficam FORA do `if (peso !== undefined)` de
    // proposito: o peso e o que a nota vale, o marcador e o que aconteceu, e um
    // dia um evento pode valer 0 e ainda assim merecer o icone.
    if (ev.player) {
      const dono = notas.get(ev.player)
      if (dono) {
        if (ev.type === "goal") dono.gols++
        // Segundo amarelo E vermelho: o motor emite os dois eventos, e o atleta
        // sai de campo. Marcar so o amarelo esconderia a expulsao.
        else if (ev.type === "yellow_card") dono.amarelo = true
        else if (ev.type === "red_card") dono.vermelho = true
      }
    }
    if (ev.assist) {
      const assistente = notas.get(ev.assist)
      if (assistente) {
        assistente.nota += PESO_ASSISTENCIA
        assistente.eventos++
        assistente.assistencias++
      }
    }
  }

  if (golsSofridos > 0) {
    for (const registro of notas.values()) {
      registro.nota += DESCONTO_POR_GOL_SOFRIDO * golsSofridos
    }
  }

  // ⚠️ A NOTA SO SE FORMA COM O JOGO ANDANDO. Mostrar 6,0 cravado no minuto zero
  // sugere que o atleta ja foi avaliado; a nota real converge da base conforme o
  // tempo passa. Antes dos 10 minutos ela se aproxima devagar do valor calculado.
  const maturidade = Math.min(1, Math.max(0, minutoAtual / 10))

  for (const registro of notas.values()) {
    const alvo = Math.min(TETO, Math.max(PISO, registro.nota))
    registro.nota = Math.round((NOTA_BASE + (alvo - NOTA_BASE) * maturidade) * 10) / 10
  }

  return notas
}

/** Verde/amarelo/vermelho pela faixa, para a tela nao repetir a regra. */
export function corDaNota(nota: number): string {
  if (nota >= 7.5) return "var(--uf-green)"
  if (nota >= 6.5) return "var(--uf-cyan)"
  if (nota >= 5.5) return "var(--uf-text)"
  if (nota >= 4.5) return "var(--uf-yellow)"
  return "var(--uf-magenta)"
}

/** `6,4` — virgula, como o placar do futebol em portugues. */
export function formatarNota(nota: number): string {
  return nota.toFixed(1).replace(".", ",")
}
