// INTENCAO — a diferenca entre "encostou" e "quis".
//
// ── O problema que isto evita ───────────────────────────────────────────────
// Trocar de modo por leitura crua e um desastre em duas direcoes:
//
// 1. Analogico gasto. Um DualShock 4 com dois anos parado repousa em 0.03–0.08,
//    e alguns chegam a 0.12 num eixo. Ligar o Modo Controle com qualquer leitura
//    diferente de zero faz o cursor sumir sozinho enquanto a pessoa usa o mouse.
//
// 2. Mouse encostado. Um trackpad ou um mouse na mesa de alguem digitando emite
//    eventos de 1–2 px. Voltar ao Modo Desktop com isso derruba o Modo Controle
//    no meio de uma navegacao, e a barra de glifos pisca.
//
// Por isso ha DOIS limiares por dispositivo, e nao um:
//
//   deadzone (~0.18)  — abaixo disso o eixo vale ZERO para navegar.
//   intencao (~0.45)  — abaixo disso o eixo navega, mas NAO troca o modo.
//
// Ou seja: o analogico continua movendo o foco com meio curso, mas so um
// movimento franco assume o modo. O botao central (e qualquer botao apertado)
// continua sendo o caminho prioritario — botao nao tem drift.

export interface LimiaresDeIntencao {
  /** Abaixo disto o eixo e ruido. Configuravel em Configuracoes ▸ Controles. */
  deadzone: number
  /** Acima disto o eixo pode ASSUMIR o Modo Controle. */
  intencao: number
  /** Pixels de mouse acumulados para voltar ao Modo Desktop. */
  mousePx: number
  /** Janela (ms) em que os pixels contam. Fora dela o acumulado zera. */
  mouseJanelaMs: number
}

export const LIMIARES_PADRAO: LimiaresDeIntencao = {
  deadzone: 0.18,
  intencao: 0.45,
  // 24 px em 400 ms: mais do que qualquer tremor de mesa, menos do que um
  // movimento curto de quem foi pegar o mouse de proposito.
  mousePx: 24,
  mouseJanelaMs: 400,
}

/**
 * Deadzone RADIAL, nao por eixo.
 *
 * Por eixo (`abs(x) < dz ? 0 : x`) o campo morto vira um QUADRADO: na diagonal
 * o stick precisa de 1.41x mais curso para sair dele, e o resultado e a
 * navegacao diagonal falhando enquanto a reta funciona. Radial trata o par como
 * o circulo que ele fisicamente e.
 *
 * O reescalonamento (dividir pelo curso restante) tambem importa: sem ele, o
 * primeiro milimetro util pula de 0 direto para 0.18 e o movimento nasce
 * empurrado.
 */
export function deadzoneRadial(x: number, y: number, deadzone: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y)
  if (magnitude < deadzone) return { x: 0, y: 0 }
  const util = Math.min(1, (magnitude - deadzone) / (1 - deadzone))
  const escala = util / magnitude
  return { x: x * escala, y: y * escala }
}

export type DispositivoDeEntrada = "gamepad" | "mouse" | "keyboard" | "touch"

/**
 * Decide QUEM esta no comando.
 *
 * Fica fora do React (o laco de input o consulta a 60 Hz) e nao guarda estado
 * de interface — so responde "isto foi intencional?". Quem troca o modo e o
 * InputManager, que e o unico com direito a essa decisao.
 */
export class DetectorDeIntencao {
  private limiares: LimiaresDeIntencao
  private mouseAcumulado = 0
  private mouseDesde = 0

  constructor(limiares: Partial<LimiaresDeIntencao> = {}) {
    this.limiares = { ...LIMIARES_PADRAO, ...limiares }
  }

  ajustar(limiares: Partial<LimiaresDeIntencao>): void {
    this.limiares = { ...this.limiares, ...limiares }
  }

  get valores(): LimiaresDeIntencao {
    return this.limiares
  }

  /** Botao apertado sempre e intencao: botao nao tem drift. */
  botaoDoControle(): boolean {
    return true
  }

  /** Um par de eixos foi movido de verdade? */
  eixoDoControle(x: number, y: number): boolean {
    return Math.hypot(x, y) > this.limiares.intencao
  }

  /**
   * Movimento de mouse. Acumula dentro de uma janela; fora dela, recomeca.
   *
   * Sem a janela, um mouse que anda 1 px por minuto acabaria somando 24 px ao
   * longo de meia hora de jogo no controle e derrubaria o modo do nada.
   */
  mouseMoveu(dx: number, dy: number, agora: number): boolean {
    if (agora - this.mouseDesde > this.limiares.mouseJanelaMs) {
      this.mouseAcumulado = 0
      this.mouseDesde = agora
    }
    this.mouseAcumulado += Math.hypot(dx, dy)
    if (this.mouseAcumulado >= this.limiares.mousePx) {
      this.mouseAcumulado = 0
      this.mouseDesde = agora
      return true
    }
    return false
  }

  /** Clique e sempre intencao — ninguem clica sem querer duas vezes seguidas. */
  mouseClicou(): boolean {
    this.mouseAcumulado = 0
    return true
  }

  zerarMouse(): void {
    this.mouseAcumulado = 0
  }
}

/**
 * Direcao resolvida a partir do par de eixos.
 *
 * Um eixo so vira direcao quando DOMINA o outro. Sem essa regra, o stick na
 * diagonal dispara "baixo" e "direita" no mesmo quadro e o foco anda duas
 * casas por empurrao — o relato "o menu pula opcoes".
 */
export type Direcao = "up" | "down" | "left" | "right" | null

export function direcaoDoEixo(x: number, y: number, limiar = 0.5): Direcao {
  if (Math.abs(y) > Math.abs(x)) {
    if (y <= -limiar) return "up"
    if (y >= limiar) return "down"
    return null
  }
  if (x <= -limiar) return "left"
  if (x >= limiar) return "right"
  return null
}
