"use client"

import { useEffect } from "react"
import { normalizeAppHref } from "@/lib/hard-navigation"
import { initPersistentStore } from "@/lib/persistent-store"
import { applySavedFullscreen, toggleFullscreen } from "@/lib/fullscreen"
import { accessibilityStore } from "@/lib/accessibility-store"

export function NativeAppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initPersistentStore()
    // Acessibilidade primeiro: reaplica fonte/contraste ANTES da UI pintar, senao o
    // usuario que aumentou a fonte veria a tela "pular" a cada boot.
    accessibilityStore.init()
    // Reaplica a tela cheia salva assim que o store carrega.
    void applySavedFullscreen()
  }, [])

  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => e.preventDefault()

    const disableBrowserShortcuts = (e: KeyboardEvent) => {
      // F11 alterna a tela cheia persistente do jogo (em vez do fullscreen do browser).
      if (e.key === "F11") {
        e.preventDefault()
        void toggleFullscreen()
        return
      }
      const blocked =
        e.key === "F5" ||
        e.key === "F12" ||
        (e.ctrlKey && e.key === "r") ||
        (e.ctrlKey && e.key === "R") ||
        (e.ctrlKey && e.key === "u") ||
        (e.ctrlKey && e.key === "U") ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "i") ||
        (e.ctrlKey && e.shiftKey && e.key === "J") ||
        (e.ctrlKey && e.shiftKey && e.key === "j")

      if (blocked) e.preventDefault()
    }

    // Bloqueia o arrasto NATIVO de imagem/link/texto (é o que denuncia "isto é uma
    // pagina web"), mas nao o drag-and-drop do proprio jogo: cancelar todo dragstart
    // matava a escalacao, onde os jogadores sao [draggable].
    const disableDrag = (e: DragEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.("[draggable='true']")) return
      e.preventDefault()
    }

    const forceStaticAnchorNavigation = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }

      const target = e.target as HTMLElement | null
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== "_self")) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return

      const nextHref = normalizeAppHref(`${url.pathname}${url.search}${url.hash}`)
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextHref === currentHref) return

      e.preventDefault()
      window.location.assign(nextHref)
    }

    document.addEventListener("contextmenu", disableContextMenu)
    document.addEventListener("keydown", disableBrowserShortcuts)
    document.addEventListener("dragstart", disableDrag)
    document.addEventListener("click", forceStaticAnchorNavigation, true)
    document.documentElement.style.userSelect = "none"

    // Verifica atualizações silenciosamente alguns segundos após o boot,
    // sem bloquear a splash. No navegador (fora do Tauri) é no-op.
    const updateTimer = window.setTimeout(() => {
      void import("@/lib/updater").then((m) => m.checkForUpdates({ silent: true }))
    }, 5000)

    return () => {
      window.clearTimeout(updateTimer)
      document.removeEventListener("contextmenu", disableContextMenu)
      document.removeEventListener("keydown", disableBrowserShortcuts)
      document.removeEventListener("dragstart", disableDrag)
      document.removeEventListener("click", forceStaticAnchorNavigation, true)
    }
  }, [])

  return <>{children}</>
}
