"use client"

import { cn } from "@/lib/utils"
import { X, Power, MinusSquare } from "lucide-react"

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-secondary",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  )
}

export function SettingsDialog({
  autostart,
  closeToTray,
  onAutostart,
  onCloseToTray,
  onClose,
}: {
  autostart: boolean
  closeToTray: boolean
  onAutostart: (v: boolean) => void
  onCloseToTray: (v: boolean) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-5 backdrop-blur"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">Configurações</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col divide-y divide-border">
          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
            <span className="flex items-start gap-3">
              <Power className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium text-foreground">Iniciar com o Windows</span>
                <span className="block text-xs text-muted-foreground">
                  O launcher abre sozinho quando você liga o computador.
                </span>
              </span>
            </span>
            <Toggle checked={autostart} onChange={onAutostart} />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
            <span className="flex items-start gap-3">
              <MinusSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Minimizar para a bandeja ao fechar
                </span>
                <span className="block text-xs text-muted-foreground">
                  Ao clicar no X, o launcher continua rodando no ícone ao lado do relógio.
                </span>
              </span>
            </span>
            <Toggle checked={closeToTray} onChange={onCloseToTray} />
          </label>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Concluído
          </button>
        </div>
      </section>
    </div>
  )
}
