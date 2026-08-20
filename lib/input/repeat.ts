// REPETICAO — segurar para baixo tem de descer a lista, nao despencar.
//
// O comportamento certo e o do TECLADO: dispara na hora, ESPERA um bom tempo, e
// so entao repete rapido. A versao antiga (components/gamepad-provider.tsx)
// repetia com 200 ms desde o primeiro disparo — um toque normal no analogico
// dura uns 250 ms, entao ele disparava DUAS vezes e o menu pulava opcoes. O
// delay inicial longo existe exatamente para separar "toquei" de "segurei".
//
// Numeros: 250 ms para comecar, 70 ms entre repeticoes (~14 itens/s). Em lista
// de 700 atletas isso ainda e lento, e por isso os gatilhos existem: PAGE_NEXT
// anda de tela em tela. Acelerar a repeticao alem disso passa do ponto em que o
// olho acompanha e o jogador perde o lugar.

export interface AjustesDeRepeticao {
  atrasoInicialMs: number
  intervaloMs: number
}

export const REPETICAO_PADRAO: AjustesDeRepeticao = {
  atrasoInicialMs: 250,
  intervaloMs: 70,
}

/**
 * Uma chave = uma coisa que pode estar "segurada" (um botao, uma direcao).
 *
 * O controlador e puramente temporal: nao sabe o que a chave significa e nao
 * agenda `setTimeout` nenhum. Quem chama pergunta a cada quadro "esta chave
 * deve disparar agora?". Timers seriam mais elegantes e MUITO piores: com
 * timers, largar o botao entre dois quadros deixa um disparo orfao na fila e a
 * lista anda depois de o jogador ter soltado.
 */
export class ControladorDeRepeticao {
  private ajustes: AjustesDeRepeticao
  private desde = new Map<string, number>()
  private ultimo = new Map<string, number>()

  constructor(ajustes: Partial<AjustesDeRepeticao> = {}) {
    this.ajustes = { ...REPETICAO_PADRAO, ...ajustes }
  }

  ajustar(ajustes: Partial<AjustesDeRepeticao>): void {
    this.ajustes = { ...this.ajustes, ...ajustes }
  }

  get valores(): AjustesDeRepeticao {
    return this.ajustes
  }

  /**
   * @returns `"inicial"` no aperto, `"repeticao"` quando o tempo venceu,
   *          `null` quando nao e para disparar nada agora.
   */
  consultar(chave: string, segurado: boolean, agora: number): "inicial" | "repeticao" | null {
    if (!segurado) {
      this.desde.delete(chave)
      this.ultimo.delete(chave)
      return null
    }

    const inicio = this.desde.get(chave)
    if (inicio === undefined) {
      this.desde.set(chave, agora)
      this.ultimo.set(chave, agora)
      return "inicial"
    }

    if (agora - inicio < this.ajustes.atrasoInicialMs) return null

    const anterior = this.ultimo.get(chave) ?? inicio
    if (agora - anterior >= this.ajustes.intervaloMs) {
      this.ultimo.set(chave, agora)
      return "repeticao"
    }
    return null
  }

  /**
   * Esquece tudo. Chamado ao trocar de contexto (modal abriu, tela mudou).
   *
   * Sem isto, um D-pad ainda segurado quando o modal abre continua repetindo
   * DENTRO do modal, com a cadencia ja acelerada — o modal abre e a selecao
   * dele ja saiu correndo antes de o jogador ver o que apareceu.
   */
  limpar(): void {
    this.desde.clear()
    this.ultimo.clear()
  }
}
