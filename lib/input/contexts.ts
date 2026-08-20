// PILHA DE CONTEXTOS — quem manda no botao AGORA.
//
// O problema que ela resolve ja existia e doia. Antes, a tela ouvia
// `gamepad:button` direto e cada uma decidia sozinha se devia reagir. Quando um
// modal abria por cima, as DUAS reagiam: o B fechava o modal e voltava de tela
// no mesmo aperto. A gambiarra era cada tela lembrar de passar `quando: false`
// — e quem esquecesse gerava o bug de novo, em silencio, meses depois
// (hooks/use-tela-gamepad.ts documenta essa cicatriz).
//
// Com pilha, ninguem precisa lembrar de nada: o contexto do topo recebe a acao,
// os de baixo nao recebem. Fechar o modal e desempilhar.
//
//   GLOBAL          <- sempre no fundo; QUICK_MENU e PAUSE moram aqui
//     SQUAD         <- a tela
//       PLAYER_MODAL  <- o topo recebe tudo
//
// GLOBAL e a excecao proposital: um punhado de acoes (menu rapido, pausa)
// precisa funcionar mesmo com modal aberto, senao o jogador fica sem saida.
// A lista esta em `ACOES_SEMPRE_GLOBAIS` e e curta de proposito.

import type { GameAction } from "./actions"

export type InputContext =
  | "GLOBAL"
  | "MENU"
  | "DASHBOARD"
  | "INBOX"
  | "SQUAD"
  | "PLAYER_PROFILE"
  | "TACTICS"
  | "TRANSFER"
  | "SCOUTING"
  | "MATCH"
  | "MODAL"
  | "QUICK_MENU"

/**
 * Acoes que atravessam a pilha inteira.
 *
 * Curta de proposito. Cada item aqui e uma excecao a regra "so o topo recebe",
 * e excecao demais devolve o conflito que a pilha veio resolver. O criterio:
 * so entra o que, faltando, deixaria o jogador SEM SAIDA no controle.
 */
export const ACOES_SEMPRE_GLOBAIS: ReadonlySet<GameAction> = new Set<GameAction>([
  "TOGGLE_INPUT_MODE",
])

interface Camada {
  id: string
  contexto: InputContext
}

type Ouvinte = (topo: InputContext, pilha: readonly InputContext[]) => void

/**
 * A pilha vive FORA do React de proposito.
 *
 * Ela e consultada dentro do laco de input, que roda a 60 Hz. Se morasse num
 * `useState`, cada leitura dependeria de um render ja ter acontecido — e o
 * aperto seria julgado pelo contexto do frame ANTERIOR. Num modal que acabou de
 * abrir, isso e exatamente o "voltou em dobro" de novo.
 */
class PilhaDeContextos {
  private camadas: Camada[] = [{ id: "raiz", contexto: "GLOBAL" }]
  private ouvintes = new Set<Ouvinte>()
  private proximoId = 0

  topo(): InputContext {
    return this.camadas[this.camadas.length - 1]?.contexto ?? "GLOBAL"
  }

  atual(): readonly InputContext[] {
    return this.camadas.map(c => c.contexto)
  }

  /** Empilha e devolve o desfazedor. O chamador NAO precisa guardar o id. */
  push(contexto: InputContext): () => void {
    const id = `ctx-${this.proximoId++}`
    this.camadas.push({ id, contexto })
    this.avisar()
    return () => this.remover(id)
  }

  /**
   * Remove POR ID, nunca por `pop()`.
   *
   * Componentes React desmontam fora de ordem (um modal pode sair depois da
   * tela que o abriu, durante uma transicao). Um `pop()` cego tiraria a camada
   * errada e o input ficaria preso num contexto que nao existe mais na tela —
   * um travamento invisivel, dificil de reproduzir e pior de diagnosticar.
   */
  private remover(id: string): void {
    const i = this.camadas.findIndex(c => c.id === id)
    if (i <= 0) return // a raiz GLOBAL nunca sai
    this.camadas.splice(i, 1)
    this.avisar()
  }

  /** O contexto recebe esta acao? */
  aceita(contexto: InputContext, acao: GameAction): boolean {
    if (ACOES_SEMPRE_GLOBAIS.has(acao)) return true
    return contexto === this.topo()
  }

  observar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte)
    return () => this.ouvintes.delete(ouvinte)
  }

  private avisar(): void {
    const topo = this.topo()
    const pilha = this.atual()
    this.ouvintes.forEach(o => o(topo, pilha))
  }
}

export const pilhaDeContextos = new PilhaDeContextos()
