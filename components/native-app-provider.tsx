"use client"

import { useEffect, useState } from "react"
import { normalizeAppHref } from "@/lib/hard-navigation"
import { initPersistentStore } from "@/lib/persistent-store"
import { applySavedFullscreen, toggleFullscreen } from "@/lib/fullscreen"
import { accessibilityStore } from "@/lib/accessibility-store"

export function NativeAppProvider({ children }: { children: React.ReactNode }) {
  // Confirmacao antes de fechar o app (Alt+F4, botao X, barra de tarefas).
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)

  // Intercepta o fechamento da janela no Tauri: pede confirmacao em vez de sair
  // direto. onCloseRequested cobre Alt+F4, o X e o fechar pela barra de tarefas.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("__TAURI_INTERNALS__" in window)) return

    let unlisten: (() => void) | undefined
    let cancelled = false
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      if (cancelled) return
      getCurrentWindow()
        .onCloseRequested((event) => {
          // Impede o fechamento imediato e mostra o aviso.
          event.preventDefault()
          setShowQuitConfirm(true)
        })
        .then((fn) => {
          if (cancelled) fn()
          else unlisten = fn
        })
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  const confirmQuit = () => {
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      // destroy() fecha de fato — close() re-dispararia o onCloseRequested.
      void getCurrentWindow().destroy()
    })
  }

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

  return (
    <>
      {children}
      {showQuitConfirm && (
        <QuitConfirmDialog
          onCancel={() => setShowQuitConfirm(false)}
          onConfirm={confirmQuit}
        />
      )}
    </>
  )
}

// Aviso de saida. O jogo salva sozinho, mas o usuario pediu a confirmacao para nao
// fechar sem querer. Esc/B cancela, Enter/A confirma (teclado + controle).
function QuitConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel() }
      else if (e.key === "Enter") { e.preventDefault(); onConfirm() }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onCancel, onConfirm])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-[380px] max-w-[90vw] rounded-2xl border border-white/10 bg-[#0c0c14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Sair do Ultrafoot 26?</h2>
        <p className="mt-2 text-sm text-white/60">
          Seu progresso é salvo automaticamente. Deseja fechar o jogo?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
          >
            Cancelar <span className="text-white/30">(Esc)</span>
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
          >
            Sair <span className="text-white/50">(Enter)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
