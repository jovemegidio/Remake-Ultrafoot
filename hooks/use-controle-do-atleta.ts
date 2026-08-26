"use client"

/**
 * O CONTROLE NA CARREIRA DE JOGADOR (1.0.374).
 *
 * ─── O DEFEITO QUE ELE CONSERTA ─────────────────────────────────────────────
 *
 * Na 1.0.373 as cinco telas do atleta faziam exatamente isto:
 *
 *     useTelaGamepad({ aoVoltar: () => hardNavigate("/carreira/jogador") })
 *
 * E só. Nada de navegar, nada de confirmar, nada de trocar de tela. Pior: como
 * `useTelaGamepad` marca a tela como dona do gamepad, essa linha DESLIGA a
 * `GamepadNavegacaoGlobal`, que teria dado navegação de graça. Declarar meio
 * handler deixava a tela pior do que não declarar nenhum — e o sintoma era o
 * que o relatório descreveu: "o suporte de controle cobre basicamente voltar".
 *
 * ─── O QUE ESTE HOOK ENTREGA ────────────────────────────────────────────────
 *
 *   D-pad / analógico   navega entre os focáveis por geometria
 *   A                   confirma o que está em foco
 *   B                   volta (o que a tela já tinha)
 *   LB / RB             tela anterior / próxima da carreira
 *   LT / RT             rola a lista
 *   X                   ação secundária da tela, quando ela declara uma
 *
 * ⚠️ LB/RB NAVEGAM ENTRE AS TELAS DO ATLETA, e essa foi a decisão que fez o
 * controle valer a pena aqui. A carreira de jogador é cinco páginas separadas
 * (visão, calendário, evolução, trajetória, vida); sem um gesto para trocar
 * entre elas, o jogador teria de voltar ao hub e descer de novo a cada consulta
 * — três apertos para o que no controle tem de ser um.
 */

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { criarCursorDeFoco, type CursorDeFoco } from "@/lib/focus/varredura"
import { hardNavigate } from "@/lib/hard-navigation"

/**
 * AS TELAS DA CARREIRA, na ordem em que os ombros passam por elas.
 *
 * ⚠️ A ORDEM É A DA LEITURA, não a alfabética: onde estou (visão), o que vem
 * (calendário), como melhoro (evolução), como está a vida fora (vida), o que
 * já fiz (trajetória). Um ciclo que segue a pergunta seguinte do jogador.
 */
export const TELAS_DO_ATLETA = [
  "/carreira/jogador",
  "/carreira/jogador/calendario",
  "/carreira/jogador/evolucao",
  "/carreira/jogador/loja",
  "/carreira/jogador/vida",
  "/carreira/jogador/trajetoria",
] as const

export interface OpcoesControleDoAtleta {
  /** A rota desta tela — decide para onde LB/RB vão. */
  rota: string
  /** O que B faz. Padrão: volta à visão geral (ou ao escritório, na visão). */
  aoVoltar?: () => void
  /** Ação secundária no X, quando a tela tem uma. */
  aoDetalhes?: () => void
  /** Desliga o hook — a partida ao vivo o desliga enquanto a mira está aberta. */
  quando?: boolean
  /**
   * Troca de tela pelos ombros. Padrão: ligada.
   *
   * A tela de partida a desliga: sair da carreira no meio de um jogo em
   * andamento por um aperto de ombro seria perder o lance pendente.
   */
  trocarDeTela?: boolean
}

export function useControleDoAtleta(opcoes: OpcoesControleDoAtleta): CursorDeFoco {
  const cursor = useMemo(() => criarCursorDeFoco(), [])
  const ref = useRef(opcoes)
  ref.current = opcoes

  // O cursor guarda estado no DOM (o atributo de foco). Sair da tela sem
  // limpá-lo deixaria a marca colada num elemento que a próxima rota reusa.
  useEffect(() => () => cursor.limpar(), [cursor])

  const irPara = useCallback((passo: 1 | -1) => {
    const o = ref.current
    if (o.trocarDeTela === false) return
    const i = TELAS_DO_ATLETA.indexOf(o.rota as typeof TELAS_DO_ATLETA[number])
    if (i < 0) return
    const destino = TELAS_DO_ATLETA[(i + passo + TELAS_DO_ATLETA.length) % TELAS_DO_ATLETA.length]
    if (destino !== o.rota) hardNavigate(destino)
  }, [])

  useTelaGamepad({
    quando: opcoes.quando,
    aoVoltar: opcoes.aoVoltar ?? (() => hardNavigate(
      opcoes.rota === "/carreira/jogador" ? "/" : "/carreira/jogador",
    )),
    aoNavegar: direcao => cursor.navegar(direcao),
    aoConfirmar: () => { cursor.confirmar() },
    aoDetalhes: opcoes.aoDetalhes,
    aoAbaAnterior: () => irPara(-1),
    aoAbaProxima: () => irPara(1),
    aoRolar: direcao => cursor.rolar(direcao),
  })

  return cursor
}
