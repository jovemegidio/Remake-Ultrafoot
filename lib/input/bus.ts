// BARRAMENTO DE ACOES — como o input chega ao React sem incendiar o React.
//
// ── A regra que este arquivo protege ────────────────────────────────────────
// NADA de eixo cru no estado do React. NADA de `setState` por quadro.
//
// A versao antiga do provider chamava `setState` a 60 Hz com o estado inteiro do
// controle. Isso rerenderizava a arvore toda 60 vezes por segundo: em maquina
// fraca travava, e o proprio laco de polling competia com os renders que ele
// causava. A correcao de entao foi filtrar o `setState`; a correcao definitiva
// e esta — o React nunca ve eixo. Ele recebe ACAO, que acontece dezenas de
// vezes por MINUTO, nao por segundo.
//
// ── Por que nao um Context/Zustand ──────────────────────────────────────────
// Um contexto rerenderiza todo consumidor a cada acao. A barra de dicas, a tela
// e o modal se inscreveriam no mesmo valor e os tres renderizariam a cada D-pad.
// Um barramento com callback entrega a acao SO a quem ela interessa, e quem
// recebe decide se aquilo vira render. Zustand resolveria tambem, mas o projeto
// nao usa e nao vale uma dependencia por 40 linhas.

import type { EventoDeAcao, GameAction } from "./actions"

type Ouvinte = (evento: EventoDeAcao) => void

/**
 * Um ouvinte pode CONSUMIR a acao devolvendo `true`.
 *
 * Serve para o caso em que dois interessados existem legitimamente ao mesmo
 * tempo — a lista virtualizada quer o UI_DOWN, mas se ela ja estiver no ultimo
 * item quem deve receber e a pagina. Sem consumo, os dois agiriam.
 */
export type OuvinteConsumidor = (evento: EventoDeAcao) => boolean | void

interface Inscricao {
  acoes: ReadonlySet<GameAction> | null
  ouvinte: OuvinteConsumidor
  prioridade: number
}

class BarramentoDeAcoes {
  private inscricoes: Inscricao[] = []
  private espioes = new Set<Ouvinte>()

  /**
   * @param acoes  Quais acoes interessam. `null` = todas (use com parcimonia).
   * @param prioridade  Maior recebe antes. Modal usa 100, tela usa 0.
   */
  inscrever(
    acoes: readonly GameAction[] | null,
    ouvinte: OuvinteConsumidor,
    prioridade = 0,
  ): () => void {
    const inscricao: Inscricao = {
      acoes: acoes ? new Set(acoes) : null,
      ouvinte,
      prioridade,
    }
    this.inscricoes.push(inscricao)
    // Ordena na INSCRICAO, nao na emissao: emitir acontece a cada aperto e
    // ordenar ali seria trabalho repetido a toa.
    this.inscricoes.sort((a, b) => b.prioridade - a.prioridade)
    return () => {
      const i = this.inscricoes.indexOf(inscricao)
      if (i >= 0) this.inscricoes.splice(i, 1)
    }
  }

  /**
   * Ouvinte que NAO consome e recebe tudo. So para a tela de depuracao e para
   * telemetria — nunca para logica de jogo, senao a ordem deixa de valer.
   */
  espiar(ouvinte: Ouvinte): () => void {
    this.espioes.add(ouvinte)
    return () => this.espioes.delete(ouvinte)
  }

  emitir(evento: EventoDeAcao): void {
    // Copia a lista: um ouvinte pode se desinscrever (ou abrir um modal que
    // inscreve outro) DENTRO da propria chamada. Iterar o array vivo pularia
    // ouvintes em silencio, e o sintoma seria "as vezes o botao nao funciona".
    for (const { acoes, ouvinte } of [...this.inscricoes]) {
      if (acoes && !acoes.has(evento.action)) continue
      if (ouvinte(evento) === true) break
    }
    this.espioes.forEach(e => e(evento))
  }
}

export const barramentoDeAcoes = new BarramentoDeAcoes()

/** Prioridades nomeadas — numero solto no meio do codigo nao se compara. */
export const PRIORIDADE = {
  DEPURACAO: 1000,
  MODAL: 100,
  MENU_RAPIDO: 90,
  TELA: 10,
  PADRAO: 0,
  ULTIMO_RECURSO: -100,
} as const
