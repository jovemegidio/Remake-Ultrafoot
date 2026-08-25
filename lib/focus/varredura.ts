/**
 * NAVEGAÇÃO POR VARREDURA DO DOM — extraída para ser usada em DOIS lugares.
 *
 * ─── POR QUE ELA SAIU DE DENTRO DO COMPONENTE (1.0.374) ─────────────────────
 *
 * Esta geometria nasceu dentro de `components/gamepad-navegacao-global.tsx`, a
 * camada que dá controle às telas que não declararam nenhum. Ela funciona, e
 * funciona bem — o problema é que só funcionava LÁ.
 *
 * ⚠️ E ISSO CRIOU UM DEFEITO QUE PARECE O CONTRÁRIO DE UM DEFEITO. A camada
 * global só age quando `telaAssumiuOGamepad()` é falso, ou seja, quando nenhuma
 * tela chamou `useTelaGamepad`. As cinco telas da carreira de jogador CHAMAM o
 * hook — e declaram só `aoVoltar`. Resultado medido na 1.0.373: elas assumem o
 * gamepad, desligam a camada global, e entregam um controle que só volta.
 *
 * Declarar meio handler deixava a tela PIOR do que não declarar nenhum. Não
 * havia como perceber isso lendo qualquer um dos dois arquivos sozinho.
 *
 * A saída não é duplicar a geometria (dois cálculos de vizinho envelhecem
 * separados, e este projeto já pagou por duas escalas da mesma grandeza mais de
 * uma vez): é tirá-la daqui e deixar que as telas a chamem também.
 */

export type Direcao = "up" | "down" | "left" | "right"

/** Só o que a geometria precisa saber — deixa a escolha testável sem DOM. */
export interface Caixa { left: number; top: number; width: number; height: number }

export const ATRIBUTO_FOCADO = "data-gamepad-focused"

const SELETOR = [
  "button:not([disabled])",
  "a[href]",
  '[role="tab"]',
  '[role="button"]',
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

/** Focáveis visíveis na tela, em ordem de leitura (cima→baixo, esquerda→direita). */
export function focaveis(raiz: ParentNode = document): HTMLElement[] {
  const todos = Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR))
  return todos
    .filter(el => {
      if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) return false
      // Fora da janela não conta: a lista longa só entra no alcance depois de rolar.
      if (r.bottom < 0 || r.top > window.innerHeight) return false
      const s = getComputedStyle(el)
      return s.visibility !== "hidden" && s.display !== "none" && s.pointerEvents !== "none"
    })
    .sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      // Mesma "linha" (tolerância de 12px) ordena pela horizontal.
      if (Math.abs(ra.top - rb.top) > 12) return ra.top - rb.top
      return ra.left - rb.left
    })
}

/**
 * Qual caixa recebe o foco ao empurrar o direcional. Devolve o ÍNDICE em
 * `candidatos`, ou -1 quando não há ninguém naquela direção.
 *
 * O desvio lateral pesa 2,5x o avanço de propósito: sem isso o "para baixo" num
 * formulário de duas colunas pula para a outra coluna em vez de descer na sua.
 */
export function escolherVizinho(atual: Caixa, candidatos: Caixa[], direcao: Direcao): number {
  const cx = atual.left + atual.width / 2, cy = atual.top + atual.height / 2
  let melhor = -1, melhorCusto = Infinity
  candidatos.forEach((r, i) => {
    const dx = r.left + r.width / 2 - cx
    const dy = r.top + r.height / 2 - cy
    const naDirecao =
      direcao === "up" ? dy < -4 :
      direcao === "down" ? dy > 4 :
      direcao === "left" ? dx < -4 : dx > 4
    if (!naDirecao) return
    const vertical = direcao === "up" || direcao === "down"
    const custo = (vertical ? Math.abs(dy) : Math.abs(dx)) + (vertical ? Math.abs(dx) : Math.abs(dy)) * 2.5
    if (custo < melhorCusto) { melhorCusto = custo; melhor = i }
  })
  return melhor
}

/** O vizinho na direção pedida, por distância com peso no eixo do movimento. */
export function vizinho(atual: HTMLElement, direcao: Direcao): HTMLElement | null {
  const lista = focaveis().filter(el => el !== atual)
  const i = escolherVizinho(atual.getBoundingClientRect(), lista.map(el => el.getBoundingClientRect()), direcao)
  return i < 0 ? null : lista[i]
}

/** O contêiner que realmente rola sob este elemento (o corpo, quando nenhum). */
export function rolavel(de: HTMLElement | null): HTMLElement {
  let no: HTMLElement | null = de
  while (no && no !== document.body) {
    const s = getComputedStyle(no)
    if ((s.overflowY === "auto" || s.overflowY === "scroll") && no.scrollHeight > no.clientHeight + 8) return no
    no = no.parentElement
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

/**
 * O CURSOR DE FOCO — um por tela que o usa.
 *
 * Guarda o elemento em foco e sabe navegar, confirmar e rolar. Ele existe como
 * objeto (e não como funções soltas) porque "onde eu estou" é estado, e estado
 * de foco espalhado em módulo global brigaria entre a camada global e a tela —
 * que é exatamente o conflito que fez desligarem o piloto automático antigo.
 */
export function criarCursorDeFoco() {
  let focado: HTMLElement | null = null

  const marcar = (el: HTMLElement | null) => {
    if (focado && focado !== el) focado.removeAttribute(ATRIBUTO_FOCADO)
    focado = el
    if (!el) return
    el.setAttribute(ATRIBUTO_FOCADO, "true")
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
    try { el.focus({ preventScroll: true }) } catch { /* elemento sem foco próprio */ }
  }

  return {
    elemento: () => focado,
    limpar: () => { if (focado) focado.removeAttribute(ATRIBUTO_FOCADO); focado = null },

    navegar(direcao: Direcao) {
      // Sem foco ainda (ou o foco morreu numa troca de tela): começa no primeiro.
      if (!focado || !focado.isConnected) { marcar(focaveis()[0] ?? null); return }
      const proximo = vizinho(focado, direcao)
      if (proximo) { marcar(proximo); return }
      // Chegou na borda: rola e tenta de novo, senão a lista longa trava no fim
      // do que está visível.
      const cx = rolavel(focado)
      const passo = direcao === "down" ? 240 : direcao === "up" ? -240 : 0
      if (passo) {
        const alvo = focado
        cx.scrollBy({ top: passo, behavior: "smooth" })
        setTimeout(() => {
          const depois = vizinho(alvo, direcao)
          if (depois) marcar(depois)
        }, 180)
      }
    },

    confirmar(): boolean {
      const el = focado
      if (el?.isConnected) { el.click(); return true }
      // ⚠️ SEM FOCO, CONFIRMAR NÃO CLICA NADA A ESMO. A primeira versão focava
      // o primeiro elemento E clicava — e o A, apertado por reflexo ao entrar
      // numa tela, disparava o primeiro botão dela (que numa tela de carreira
      // pode ser "avançar semana"). Aqui ele só assume o foco.
      const primeiro = focaveis()[0] ?? null
      marcar(primeiro)
      return false
    },

    rolar(direcao: "up" | "down") {
      rolavel(focado).scrollBy({ top: direcao === "down" ? 420 : -420, behavior: "smooth" })
    },
  }
}

export type CursorDeFoco = ReturnType<typeof criarCursorDeFoco>
