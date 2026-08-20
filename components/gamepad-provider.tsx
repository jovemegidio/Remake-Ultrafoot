"use client"

// ⚠️ CASCA DE COMPATIBILIDADE. O motor esta em lib/input, lib/focus e
// components/input/sistema-de-input.
//
// ── O que este arquivo era ─────────────────────────────────────────────────
// Ele fazia de tudo: registrava focaveis, convertia analogico em D-pad, mostrava
// aviso de conexao, chip de bateria, decidia a familia de glifo e ainda montava
// a ponte de modais. E a parte mais importante dele estava DESLIGADA — a
// navegacao global (`void handleNavigate`), porque ligada ela clicava itens da
// barra lateral no meio de outras acoes e o B voltava de tela em dobro.
//
// Cada uma dessas responsabilidades virou um modulo com dono:
//
//   registro de focaveis + navegacao  → lib/focus/manager.ts (agora COM escopo,
//                                       que e o que faltava para ligar de novo)
//   analogico → direcao               → lib/input/manager.ts
//   aviso, chip, familia de glifo     → components/input/*
//   ponte de modais                   → continua em gamepad-modal-bridge
//
// ── Por que a casca continua existindo ─────────────────────────────────────
// `useGamepadFocusable` e importado pela barra lateral, e o provider e montado
// no layout. Apagar o arquivo obrigaria a mexer nos dois no mesmo commit que
// troca o motor — e misturar "troquei o motor" com "mexi na barra lateral" e
// exatamente o tipo de commit em que um bug se esconde. A casca mantem o
// contrato; a migracao de quem a usa e um passo separado.

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react"

import { ControllerTypeContext } from "@/components/controller-buttons"
import { GamepadModalBridge } from "@/components/gamepad-modal-bridge"
import { SistemaDeInput } from "@/components/input/sistema-de-input"
import { gerenteDeFoco } from "@/lib/focus/manager"
import { useFamiliaDeGlifo, useRetratoDoInput } from "@/hooks/use-input"
import { useGamepad, type GamepadState } from "@/hooks/use-gamepad"

interface GamepadContextType {
  gamepad: GamepadState
  registerFocusableElement: (id: string, element: HTMLElement, onSelect?: () => void) => void
  unregisterFocusableElement: (id: string) => void
  setFocusedElement: (id: string | null) => void
  focusedElementId: string | null
  isGamepadConnected: boolean
  controllerType: "xbox" | "playstation" | "generic"
}

const GamepadContext = createContext<GamepadContextType | null>(null)

export function useGamepadContext() {
  const context = useContext(GamepadContext)
  if (!context) {
    throw new Error("useGamepadContext must be used within a GamepadProvider")
  }
  return context
}

export function GamepadProvider({ children }: { children: ReactNode }) {
  const gamepad = useGamepad()
  const retrato = useRetratoDoInput()
  const familia = useFamiliaDeGlifo()

  const registerFocusableElement = useCallback(
    (id: string, element: HTMLElement, onSelect?: () => void) => {
      // O gerente devolve o desfazedor, mas o contrato antigo desregistra por
      // id. Guardar o desfazedor num mapa aqui seria uma segunda contabilidade
      // do mesmo registro; `desregistrar(id)` faz o mesmo trabalho.
      gerenteDeFoco.registrar(id, element, { aoAtivar: onSelect })
    },
    [],
  )

  const unregisterFocusableElement = useCallback((id: string) => {
    gerenteDeFoco.desregistrar(id)
  }, [])

  const setFocusedElement = useCallback((id: string | null) => {
    if (id) gerenteDeFoco.focar(id)
    else gerenteDeFoco.limparFoco()
  }, [])

  // `focusedElementId` era estado do provider e agora e do gerente. Lemos por
  // ref e forcamos render so quando muda — o contrato antigo devolve um valor,
  // nao uma assinatura.
  const focoRef = useRef<string | null>(null)
  focoRef.current = gerenteDeFoco.currentFocus

  // Familia de glifo EFETIVA para todo o jogo. A regra nao mudou: preferencia
  // do jogador manda; em "auto", o controle detectado; sem controle, Xbox.
  // O que mudou e de onde ela vem (lib/controller + preferencias da MAQUINA, em
  // vez do `controllerType` do save) — e a preferencia antiga continua sendo
  // respeitada, ver `preferirGlifoDoSave`.
  const tipoEfetivo: "xbox" | "playstation" = familia === "playstation" ? "playstation" : "xbox"

  // O atributo `data-controller` continua no <html> para a folha de estilo e
  // para quem le glifo por CSS. `data-input-mode` agora e escrito pelo gerente,
  // que e quem sabe se o jogador esta REALMENTE no controle.
  useEffect(() => {
    const raiz = document.documentElement
    if (retrato.dispositivos.length) raiz.dataset.controller = tipoEfetivo
    else delete raiz.dataset.controller
  }, [retrato.dispositivos.length, tipoEfetivo])

  return (
    <ControllerTypeContext.Provider value={tipoEfetivo}>
      <GamepadContext.Provider
        value={{
          gamepad,
          registerFocusableElement,
          unregisterFocusableElement,
          setFocusedElement,
          focusedElementId: focoRef.current,
          isGamepadConnected: retrato.dispositivos.length > 0,
          controllerType: gamepad.controllerType,
        }}
      >
        {children}

        {/* A/B/D-pad dentro de qualquer modal. Sem isto o controle abria o modal
            e nao conseguia confirmar nem fechar — ver gamepad-modal-bridge. */}
        <GamepadModalBridge />

        {/* Anel de foco, barra de dicas, menu rapido, avisos e depuracao. */}
        <SistemaDeInput />
      </GamepadContext.Provider>
    </ControllerTypeContext.Provider>
  )
}

/**
 * Torna um elemento alcancavel pelo D-pad. Contrato antigo, motor novo.
 *
 * Codigo novo deve usar `useFocavel` de `@/hooks/use-input`, que devolve o
 * `ref` pronto e nao exige criar um `useRef` do lado de fora.
 */
export function useGamepadFocusable(
  id: string,
  ref: React.RefObject<HTMLElement | null>,
  onSelect?: () => void,
) {
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return
    return gerenteDeFoco.registrar(id, elemento, {
      aoAtivar: () => onSelectRef.current?.(),
    })
    // Registra na montagem e desregistra na desmontagem, como antes. O `ref.current`
    // de propósito fora das dependências: ele muda de valor sem mudar de
    // identidade, e listá-lo não faria o efeito rodar de novo mesmo assim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isFocused = gerenteDeFoco.currentFocus === id

  return {
    isFocused,
    "data-gamepad-focused": isFocused ? "true" : "false",
    tabIndex: 0,
  }
}
