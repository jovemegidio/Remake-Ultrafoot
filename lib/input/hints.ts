// DICAS DE CONTROLE — o que a barra de baixo mostra AGORA.
//
// ── Por que uma pilha e nao uma prop ────────────────────────────────────────
// A barra e global (fica no layout), mas quem sabe o que ela deve dizer e a
// tela — e, quando um modal abre, o modal. Passar isso por prop obrigaria cada
// tela a repassar dicas ate o layout, e nenhum modal conseguiria participar.
//
// Com pilha, cada camada declara as suas e a barra mostra as do TOPO. Fechar o
// modal devolve as dicas da tela sozinho, sem ninguem restaurar nada. E o mesmo
// desenho da pilha de contextos, pelo mesmo motivo.
//
// ── A regra de conteudo ─────────────────────────────────────────────────────
// No maximo SEIS dicas. Nao e limite tecnico: uma barra com dez itens vira uma
// faixa de ruido que ninguem le, e a 3 m de TV nem isso. Se uma tela precisa de
// mais de seis, o que ela precisa e de um menu de acoes (X), nao de mais barra.

import type { GameAction } from "./actions"

export interface DicaDeControle {
  acao: GameAction
  /** Texto especifico da tela. Sem ele, usa o rotulo padrao da acao. */
  rotulo?: string
  /** Mostrada apagada (a acao existe, mas nao vale agora). */
  inativa?: boolean
}

export const MAXIMO_DE_DICAS = 6

interface Camada {
  id: number
  dicas: readonly DicaDeControle[]
}

type Ouvinte = (dicas: readonly DicaDeControle[]) => void

class PilhaDeDicas {
  private camadas: Camada[] = []
  private ouvintes = new Set<Ouvinte>()
  private proximoId = 0
  private cache: readonly DicaDeControle[] = []

  publicar(dicas: readonly DicaDeControle[]): { atualizar: (d: readonly DicaDeControle[]) => void; remover: () => void } {
    const id = this.proximoId++
    this.camadas.push({ id, dicas: dicas.slice(0, MAXIMO_DE_DICAS) })
    this.recalcular()
    return {
      atualizar: novas => {
        const camada = this.camadas.find(c => c.id === id)
        if (!camada) return
        camada.dicas = novas.slice(0, MAXIMO_DE_DICAS)
        this.recalcular()
      },
      remover: () => {
        const i = this.camadas.findIndex(c => c.id === id)
        if (i >= 0) this.camadas.splice(i, 1)
        this.recalcular()
      },
    }
  }

  atual(): readonly DicaDeControle[] {
    return this.cache
  }

  observar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte)
    return () => {
      this.ouvintes.delete(ouvinte)
    }
  }

  private recalcular(): void {
    const topo = this.camadas[this.camadas.length - 1]?.dicas ?? []
    // Compara por CONTEUDO antes de trocar a referencia: `useSyncExternalStore`
    // rerenderiza sempre que a referencia muda, e uma tela que republica as
    // mesmas dicas a cada render faria a barra piscar sem parar.
    if (
      topo.length === this.cache.length &&
      topo.every((d, i) => {
        const a = this.cache[i]
        return a && a.acao === d.acao && a.rotulo === d.rotulo && a.inativa === d.inativa
      })
    ) {
      return
    }
    this.cache = topo
    this.ouvintes.forEach(o => o(this.cache))
  }
}

export const pilhaDeDicas = new PilhaDeDicas()
