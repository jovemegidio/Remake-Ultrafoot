"use client"

// MODAL NO CONTROLE — a peça que faltava para "tudo funciona no gamepad".
//
// A tabela oficial (lib/gamepad-controls.ts) sempre teve o contexto `modal`:
// A confirma, B cancela, D-pad navega. Só que NADA o consumia. Os modais do
// jogo são Radix Dialog e só ouvem teclado/mouse — então, no controle, abrir
// a mesa de negociação, o modal de demissão ou qualquer confirmação era um
// beco sem saída: dava para ABRIR com o A e não dava para fechar nem confirmar.
// A pessoa tinha de largar o controle e pegar o mouse.
//
// Esta ponte é global (montada uma vez no GamepadProvider) e trabalha sobre o
// DOM do diálogo aberto, sem que cada modal precise saber que existe gamepad:
//
//   A     → aciona o botão primário (o último do rodapé, por convenção do
//            projeto: "Cancelar" à esquerda, ação principal à direita)
//   B     → cancela/fecha (Escape, que é o que o Radix já entende)
//   D-pad → move o foco entre os focáveis do diálogo
//   LB/RB → idem esquerda/direita
//
// Um modal pode dizer o que é o quê com `data-gamepad-confirm` e
// `data-gamepad-cancel` num botão — aí a heurística não é usada.

import { useEffect } from "react"

const SELETOR_DIALOGO =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'

const SELETOR_FOCAVEL = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[role="slider"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",")

/** O diálogo aberto mais acima na pilha (o último no DOM). */
export function dialogoAberto(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const todos = document.querySelectorAll<HTMLElement>(SELETOR_DIALOGO)
  return todos.length ? todos[todos.length - 1] : null
}

function focaveis(dialogo: HTMLElement): HTMLElement[] {
  return Array.from(dialogo.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
    el => el.offsetParent !== null || el.getClientRects().length > 0,
  )
}

function mover(dialogo: HTMLElement, passo: number): void {
  const itens = focaveis(dialogo)
  if (!itens.length) return
  const atual = itens.indexOf(document.activeElement as HTMLElement)
  // Sem foco dentro do diálogo, entra pelo primeiro (ou pelo último se veio de baixo).
  const proximo = atual < 0
    ? (passo > 0 ? 0 : itens.length - 1)
    : (atual + passo + itens.length) % itens.length
  itens[proximo]?.focus()
  itens[proximo]?.scrollIntoView({ block: "nearest" })
}

function acionarPrimario(dialogo: HTMLElement): void {
  // 1) O modal marcou explicitamente qual é o botão de confirmar.
  const marcado = dialogo.querySelector<HTMLElement>("[data-gamepad-confirm]:not([disabled])")
  if (marcado) return marcado.click()

  // 2) O elemento em foco já é acionável — respeita a escolha da pessoa.
  const foco = document.activeElement as HTMLElement | null
  if (foco && dialogo.contains(foco) && foco.matches("button:not([disabled]), [href]")) {
    return foco.click()
  }

  // 3) Convenção do projeto: a ação principal é o ÚLTIMO botão habilitado do
  //    rodapé. Sem rodapé, o último botão habilitado do diálogo — exceto o "X"
  //    de fechar, que é cancelar disfarçado.
  const escopo = dialogo.querySelector<HTMLElement>("[data-slot='dialog-footer'], footer") ?? dialogo
  const botoes = Array.from(escopo.querySelectorAll<HTMLButtonElement>("button:not([disabled])"))
    .filter(b =>
      !b.hasAttribute("data-gamepad-cancel") &&
      b.getAttribute("type") !== "reset" &&
      // O "X" do canto é cancelar disfarçado — nunca é a ação principal.
      b.getAttribute("data-slot") !== "dialog-close",
    )
  botoes[botoes.length - 1]?.click()
}

function cancelar(dialogo: HTMLElement): void {
  const marcado = dialogo.querySelector<HTMLElement>("[data-gamepad-cancel]:not([disabled])")
  if (marcado) return marcado.click()
  // Escape é o caminho que o Radix já trata (fecha e devolve o foco). Vai no
  // próprio diálogo para não vazar para a tela de trás.
  dialogo.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
  )
}

export function GamepadModalBridge() {
  useEffect(() => {
    const aoBotao = (evento: Event) => {
      const dialogo = dialogoAberto()
      if (!dialogo) return
      const { button } = (evento as CustomEvent<{ button: string }>).detail ?? {}

      switch (button) {
        case "A":
          acionarPrimario(dialogo)
          break
        case "B":
          cancelar(dialogo)
          break
        case "DPAD_DOWN":
        case "DPAD_RIGHT":
        case "RB":
          mover(dialogo, 1)
          break
        case "DPAD_UP":
        case "DPAD_LEFT":
        case "LB":
          mover(dialogo, -1)
          break
      }
    }

    window.addEventListener("gamepad:button", aoBotao)
    return () => window.removeEventListener("gamepad:button", aoBotao)
  }, [])

  return null
}
