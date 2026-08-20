// PRESETS DE EXIBICAO — Desktop, TV e Handheld.
//
// ── Por que NAO e `transform: scale()` ──────────────────────────────────────
// Escalar a pagina inteira e o atalho obvio e ja custou caro neste projeto: a
// tentativa de "zoom 0.8" no celular deixou textos em 5,6 px reais, porque o
// scale multiplica TUDO — inclusive o que ja estava no limite da legibilidade —
// e ainda embaralha a conta de altura da viewport (`h-dvh` perdia 20%).
//
// Preset de verdade mexe em TOKENS. Na TV, o texto cresce mais que o
// espacamento e o alvo de foco cresce mais que os dois — porque o problema da
// TV nao e "tudo pequeno", e "leio de longe e miro com o D-pad". Um scale
// uniforme nao sabe fazer essa distincao.
//
// ── O que cada preset resolve ───────────────────────────────────────────────
//   Desktop   monitor a 60 cm, mouse. A referencia; escala 1.
//   TV        3 m de distancia, D-pad. Fonte +15%, alvo de foco +30%.
//   Handheld  Steam Deck (1280x800, 7"). Tela PEQUENA e PERTO: a fonte cresce
//             pouco, mas o ALVO cresce muito, porque o dedo/analogico erra mais
//             do que o olho.

export type DisplayMode = "desktop" | "tv" | "handheld"

export interface TokensDeExibicao {
  /**
   * `--game-view-scale`, o zoom base que o jogo JA usava (0.80 no desktop).
   *
   * Reusar em vez de inventar um segundo mecanismo foi decisao consciente. O
   * projeto ja tem esse zoom plumbado com cuidado: existe um bloco inteiro de
   * utilitarios em app/globals.css que divide `h-screen`, `w-screen` e afins por
   * ele, porque `vh` mede a janela SEM escala e sobrava uma faixa morta embaixo
   * das telas. Criar um `--uf-escala` paralelo significaria refazer essa
   * compensacao toda — e a primeira tela esquecida traria a faixa morta de volta.
   *
   * `zoom` tambem NAO e `transform: scale()`: ele refluia o layout de verdade,
   * entao o texto requebra e nada fica borrado. A ressalva do pedido continua
   * valendo e esta atendida pelos tokens abaixo: o que precisa crescer DIFERENTE
   * do resto (alvo de foco, anel, barra de dicas) cresce por token proprio, nao
   * pelo zoom.
   */
  viewScale: number
  /** Multiplica raio, sombra e tamanho de icone. */
  uiScale: number
  /** Multiplica a escala tipografica. */
  fontScale: number
  /** Multiplica margens e espacos. */
  spacingScale: number
  /** Multiplica a area minima clicavel/focavel. */
  targetScale: number
  /** Espessura do anel de foco, em px. */
  focusRing: number
  /** Altura da barra de dicas de controle, em px. */
  hintBar: number
}

/**
 * ⚠️ `desktop` TEM DE SER O ESTADO ATUAL DO JOGO, valor por valor.
 *
 * Todo mundo que joga hoje esta, na pratica, no preset Desktop. Se ele mudar
 * qualquer coisa, a atualizacao "adiciona modo TV" chega como "mexeram no
 * tamanho de tudo sem me avisar". `viewScale: 0.80` e exatamente o
 * `--game-view-scale` que ja estava em app/globals.css, e os multiplicadores
 * sao todos 1.
 *
 * O aumento na TV vem principalmente do `viewScale` (o mecanismo do jogo), e os
 * multiplicadores fazem so o ajuste FINO por cima — por isso sao modestos aqui.
 * Empilhar +19% de zoom com +16% de fonte daria +38% e estouraria a tabela de
 * elenco na largura.
 */
export const PRESETS: Record<DisplayMode, TokensDeExibicao> = {
  desktop: {
    viewScale: 0.8,
    uiScale: 1, fontScale: 1, spacingScale: 1, targetScale: 1, focusRing: 2, hintBar: 44,
  },
  // 0.80 → 0.95 e +19% em tudo, que e a faixa que a leitura a 3 m pede. O alvo
  // de foco sobe MAIS que o resto (1.2 por cima do zoom): mirar com D-pad erra
  // mais que mirar com mouse, e alvo pequeno na TV e o que faz a navegacao
  // parecer imprecisa mesmo quando o texto ja esta legivel.
  tv: {
    viewScale: 0.95,
    uiScale: 1.1, fontScale: 1.06, spacingScale: 1.02, targetScale: 1.2, focusRing: 4, hintBar: 56,
  },
  // Steam Deck: tela PEQUENA e PERTO. O zoom sobe pouco (o olho esta a 40 cm),
  // mas o alvo sobe muito e o espacamento DIMINUI — numa tela de 7" o problema
  // nao e o tamanho da letra, e caber conteudo util entre as margens.
  handheld: {
    viewScale: 0.86,
    uiScale: 1.04, fontScale: 1.04, spacingScale: 0.94, targetScale: 1.3, focusRing: 3, hintBar: 46,
  },
}

/**
 * Palpite quando o jogador deixou em "Automático".
 *
 * Deliberadamente CONSERVADOR: na duvida, Desktop. Ligar o modo TV sozinho num
 * monitor grande de mesa deixaria tudo enorme sem ninguem ter pedido, e o
 * jogador nao teria como saber que foi o jogo que decidiu isso.
 *
 * Handheld ganha do resto porque 1280x800 (ou 1280x720/800x1280) e uma
 * assinatura de aparelho, nao de janela redimensionada.
 */
export function palpiteDeExibicao(): DisplayMode {
  if (typeof window === "undefined") return "desktop"

  const l = window.screen?.width ?? window.innerWidth
  const a = window.screen?.height ?? window.innerHeight
  const maior = Math.max(l, a)
  const menor = Math.min(l, a)

  // Steam Deck e portateis equivalentes.
  if (maior <= 1360 && menor <= 820 && menor >= 700) return "handheld"

  // TV so quando ha tres sinais juntos: tela grande, densidade BAIXA (TV tem
  // pixel grande) e ponteiro grosseiro ou ausente. Cada um sozinho da falso
  // positivo — monitor 4K de mesa tem tela grande, e tablet tem ponteiro
  // grosseiro.
  const grossoOuAusente =
    window.matchMedia?.("(pointer: coarse)").matches ||
    window.matchMedia?.("(pointer: none)").matches
  const densidadeBaixa = (window.devicePixelRatio ?? 1) <= 1.1
  if (maior >= 1900 && densidadeBaixa && grossoOuAusente) return "tv"

  return "desktop"
}

/**
 * Aplica os tokens no `<html>`.
 *
 * Vira variavel CSS em vez de classe utilitaria porque o Tailwind ja calcula os
 * tamanhos em tempo de build — nao ha como gerar `text-[1.16rem]` para cada
 * combinacao. Com variavel, a folha do jogo (app/globals.css) multiplica na
 * hora e um preset novo nao exige recompilar utilitario nenhum.
 */
export function aplicarPreset(modo: DisplayMode, ajuste = 1): void {
  if (typeof document === "undefined") return
  const t = PRESETS[modo]
  const raiz = document.documentElement
  raiz.dataset.displayMode = modo
  const s = raiz.style
  // No <html>, nao no <body>: a regra do jogo declara `--game-view-scale` em
  // `:root` e o `body` a consome. Escrever no proprio body criaria uma segunda
  // definicao e a que vence dependeria da ordem — o tipo de coisa que funciona
  // no desenvolvimento e falha no build minificado.
  s.setProperty("--game-view-scale", String(+t.viewScale.toFixed(3)))
  s.setProperty("--uf-ui-scale", String(+(t.uiScale * ajuste).toFixed(3)))
  s.setProperty("--uf-font-scale", String(+(t.fontScale * ajuste).toFixed(3)))
  s.setProperty("--uf-spacing-scale", String(+(t.spacingScale * ajuste).toFixed(3)))
  s.setProperty("--uf-target-scale", String(+(t.targetScale * ajuste).toFixed(3)))
  s.setProperty("--uf-focus-ring", `${t.focusRing}px`)
  s.setProperty("--uf-hint-bar", `${Math.round(t.hintBar * ajuste)}px`)
}
