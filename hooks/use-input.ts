"use client"

// A PORTA DO REACT PARA O SISTEMA DE INPUT.
//
// Todo o motor vive fora do React (lib/input, lib/focus, lib/display) porque ele
// roda a 60 Hz e o React nao pode ser convidado para essa festa. Estes hooks sao
// a fronteira: eles assinam o que muda RARO e devolvem valores estaveis.
//
// A regra ao usar: se voce se pegar querendo o eixo do analogico dentro de um
// componente, pare. Use `useEixosDeInput`, que entrega no maximo a 30 Hz e por
// callback — nunca por estado.

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react"

import type { GameAction } from "@/lib/input/actions"
import { barramentoDeAcoes, PRIORIDADE, type OuvinteConsumidor } from "@/lib/input/bus"
import { pilhaDeContextos, type InputContext } from "@/lib/input/contexts"
import { gerenteDeInput, type RetratoDoInput } from "@/lib/input/manager"
import { lerPreferencias, observarPreferencias, type PreferenciasDeInput } from "@/lib/input/preferences"
import { pilhaDeDicas, type DicaDeControle } from "@/lib/input/hints"
import { gerenteDeFoco, type OpcoesDoFocavel } from "@/lib/focus/manager"
import { gerenteDeExibicao, type DisplayMode } from "@/lib/display/manager"
import { familiaDeGlifo } from "@/lib/controller/devices"
import type { FamiliaDeGlifo } from "@/lib/controller/glyphs"

/**
 * Retrato do sistema de entrada. Rerenderiza quando o MODO muda ou quando um
 * controle conecta/desconecta — nao a cada aperto, e nunca a cada quadro.
 */
export function useRetratoDoInput(): RetratoDoInput {
  return useSyncExternalStore(
    cb => gerenteDeInput.assinar(cb),
    () => gerenteDeInput.retrato(),
    // No servidor nao ha controle nenhum. Sem este terceiro argumento o Next
    // quebraria a hidratacao da pagina inteira ao pre-renderizar.
    () => RETRATO_NO_SERVIDOR,
  )
}

const RETRATO_NO_SERVIDOR: RetratoDoInput = {
  inputMode: "mouse",
  dispositivos: [],
  primario: null,
  centro: { capability: "UNKNOWN", backend: "nenhuma", reason: "renderização no servidor" },
  avisoDeConexao: null,
  avisoDeDesconexao: false,
}

/** Atalho: o jogo esta em Modo Controle agora? */
export function useModoControle(): boolean {
  return useRetratoDoInput().inputMode === "gamepad"
}

/** Familia de glifo a desenhar. Segue a preferencia; em "auto", o controle ligado. */
export function useFamiliaDeGlifo(): FamiliaDeGlifo {
  const { primario } = useRetratoDoInput()
  const prefs = usePreferenciasDeInput()
  if (prefs.glifo === "xbox" || prefs.glifo === "playstation") return prefs.glifo
  // Sem controle ligado, Xbox: e o layout que a maioria dos jogadores de PC
  // reconhece, e o mesmo padrao que o jogo ja usava.
  return primario ? familiaDeGlifo(primario.family) : "xbox"
}

export function usePreferenciasDeInput(): PreferenciasDeInput {
  return useSyncExternalStore(
    cb => observarPreferencias(cb),
    () => lerPreferencias(),
    () => lerPreferencias(),
  )
}

/**
 * Declara o contexto desta tela/modal.
 *
 * Empilha na montagem, desempilha na desmontagem. Enquanto ele estiver no topo,
 * so ele recebe as acoes — e a peca que impede o B de fechar o modal E voltar de
 * tela no mesmo aperto, sem cada tela precisar lembrar de se desligar.
 */
export function useContextoDeInput(contexto: InputContext, ativo = true): void {
  useEffect(() => {
    if (!ativo) return
    return pilhaDeContextos.push(contexto)
  }, [contexto, ativo])
}

/**
 * Ouve acoes.
 *
 * `acoes` deve ser uma lista ESTAVEL (fora do componente ou memorizada), senao
 * a inscricao se refaz a cada render. O handler pode ser instavel — ele e lido
 * por ref, exatamente como o `useTelaGamepad` faz, porque foi um handler
 * instavel que uma vez desmontou e remontou o laco de polling a cada render e
 * matou a deteccao do controle.
 */
export function useAcaoDeInput(
  acoes: readonly GameAction[] | null,
  handler: OuvinteConsumidor,
  opcoes: { prioridade?: number; ativo?: boolean; contexto?: InputContext } = {},
): void {
  const { prioridade = PRIORIDADE.TELA, ativo = true, contexto } = opcoes
  const ref = useRef(handler)
  ref.current = handler

  const chave = useMemo(() => (acoes ? acoes.join("|") : "*"), [acoes])

  useEffect(() => {
    if (!ativo) return
    return barramentoDeAcoes.inscrever(
      acoes,
      evento => {
        // TRAVA DE CONTEXTO — a rede por baixo da prioridade.
        //
        // A prioridade sozinha só protege quando quem está por cima CONSOME o
        // evento. Um modal que trata UI_CONFIRM mas esquece de devolver `true`
        // deixa o aperto seguir para a tela de trás, e o jogo confirma duas
        // coisas com um botão — em silêncio, e só naquele modal.
        //
        // Declarando o contexto, o ouvinte se cala sozinho quando não é o topo
        // da pilha. É a mesma garantia que o `useTelaGamepad` já tinha com
        // `dialogoAberto()`, agora disponível para código novo e sem depender
        // de heurística de DOM.
        if (contexto && !pilhaDeContextos.aceita(contexto, evento.action)) return
        return ref.current(evento)
      },
      prioridade,
    )
    // `chave` no lugar de `acoes`: um array literal muda de referencia a cada
    // render e reinscreveria sem parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, prioridade, ativo, contexto])
}

/** Eixos ao vivo, por callback. Para tática, partida e mapa — nada mais. */
export function useEixosDeInput(
  handler: (direito: { x: number; y: number }, esquerdo: { x: number; y: number }) => void,
  ativo = true,
): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!ativo) return
    return gerenteDeInput.observarEixos((d, e) => ref.current(d, e))
  }, [ativo])
}

// ── Foco ────────────────────────────────────────────────────────────────────

/**
 * Torna um elemento alcancavel pelo D-pad.
 *
 * Devolve o `ref` e o atributo de foco. O id precisa ser estavel para o mesmo
 * item: e por ele que o gerente lembra onde o jogador estava ao fechar um modal.
 */
export function useFocavel(
  id: string,
  opcoes: OpcoesDoFocavel = {},
): {
  ref: (el: HTMLElement | null) => void
  emFoco: boolean
  tabIndex: number
  "data-uf-focus": string
} {
  const opcoesRef = useRef(opcoes)
  opcoesRef.current = opcoes

  const registrado = useRef<(() => void) | null>(null)

  const ref = useCallback(
    (el: HTMLElement | null) => {
      registrado.current?.()
      registrado.current = null
      if (el) registrado.current = gerenteDeFoco.registrar(id, el, opcoesRef.current)
    },
    [id],
  )

  useEffect(() => () => registrado.current?.(), [])

  const emFoco = useSyncExternalStore(
    cb => gerenteDeFoco.observar(cb),
    () => gerenteDeFoco.currentFocus === id,
    () => false,
  )

  return { ref, emFoco, tabIndex: 0, "data-uf-focus": emFoco ? "true" : "false" }
}

/**
 * Escopo de foco. Um modal chama isto e o D-pad para de alcancar a tela de
 * tras; ao fechar, o foco volta para onde estava.
 */
export function useEscopoDeFoco(id: string, ativo = true): void {
  useEffect(() => {
    if (!ativo) return
    const sair = gerenteDeFoco.pushScope(id)
    // Um quadro depois: os focaveis do modal ainda nao se registraram no
    // instante em que o escopo sobe (o efeito do pai roda antes do dos filhos).
    // Focar agora acharia a lista vazia e o modal abriria sem foco nenhum.
    const t = requestAnimationFrame(() => gerenteDeFoco.focarPrimeiro(false))
    return () => {
      cancelAnimationFrame(t)
      sair()
    }
  }, [id, ativo])
}

// ── Dicas ───────────────────────────────────────────────────────────────────

/**
 * Declara as dicas de controle desta tela ou modal.
 *
 * A lista pode ser um literal: o hook compara por conteudo antes de republicar,
 * porque a alternativa (exigir `useMemo` de quem chama) seria esquecida na
 * primeira tela e a barra ficaria piscando sem que ninguem entendesse por que.
 */
export function useDicasDeControle(dicas: readonly DicaDeControle[], ativo = true): void {
  const assinatura = dicas.map(d => `${d.acao}:${d.rotulo ?? ""}:${d.inativa ? 1 : 0}`).join("|")
  const ref = useRef(dicas)
  ref.current = dicas

  useEffect(() => {
    if (!ativo) return
    const camada = pilhaDeDicas.publicar(ref.current)
    return camada.remover
    // Dispara por `assinatura`, nao pelo array: um literal muda de referencia a
    // cada render e a barra se republicaria sem parar. A lista em si vem da ref.
  }, [assinatura, ativo])
}

// ── Exibicao ────────────────────────────────────────────────────────────────

export function useModoDeExibicao(): DisplayMode {
  return useSyncExternalStore(
    cb => gerenteDeExibicao.assinar(cb),
    () => gerenteDeExibicao.atual,
    () => "desktop" as DisplayMode,
  )
}
