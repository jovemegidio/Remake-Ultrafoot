"use client"

// CHIP PERSISTENTE — qual controle esta ativo e quanta bateria resta.
//
// Herdado do provider antigo e preservado de proposito: era a unica pista
// visual de que o jogo VIU o controle. Quando ele nao aparece, o jogador sabe
// na hora que o problema e de pareamento, e nao do jogo.
//
// ── A unica mudanca de comportamento ────────────────────────────────────────
// Antes ele aparecia sempre que houvesse um controle CONECTADO. Agora aparece
// so em Modo Controle. Motivo: quem esta no mouse com um controle esquecido
// ligado na mesa nao precisa de um chip permanente no canto da tela — e esse
// caso e comum em quem joga no PC com o controle guardado por perto.

import { cn } from "@/lib/utils"
import { useFamiliaDeGlifo, useRetratoDoInput } from "@/hooks/use-input"

export function IndicadorDeControle() {
  const { primario, inputMode } = useRetratoDoInput()
  const familia = useFamiliaDeGlifo()

  if (inputMode !== "gamepad" || !primario) return null

  const bateria = primario.battery
  const corDaBateria =
    bateria == null ? undefined
      : bateria <= 0.15 ? "#ff6b6b"
        : bateria <= 0.35 ? "#ffcc4d"
          : "var(--brand)"

  return (
    <div
      data-gamepad-exclude=""
      className={cn(
        "pointer-events-none fixed right-3 top-3 z-40 flex items-center gap-2",
        "rounded-full border border-white/10 bg-black/70 px-3 py-1.5 backdrop-blur-sm",
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
      </span>

      {familia === "playstation" ? <LogoPlayStation /> : <LogoXbox />}

      <span className="text-[11px] font-medium text-white/80">{primario.label}</span>

      {bateria != null && (
        <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: corDaBateria }}>
          <Pilha nivel={bateria} />
          {Math.round(bateria * 100)}%
        </span>
      )}
    </div>
  )
}

function LogoXbox() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/80" fill="currentColor" aria-hidden="true">
      <path d="M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.898-2.967c1.058-1.074-.438-3.523-2.649-6.106-1.738 2.313-3.767 4.671-5.249 4.671-1.483 0-3.512-2.358-5.249-4.671-2.211 2.583-3.707 5.032-2.649 6.106zM12 0a11.94 11.94 0 0 0-7.898 2.967c-1.058 1.074.438 3.523 2.649 6.106C8.489 6.76 10.518 4.402 12 4.402c1.482 0 3.511 2.358 5.249 4.671 2.211-2.583 3.707-5.032 2.649-6.106A11.94 11.94 0 0 0 12 0zM2.313 18.986c-.945-.932-1.483-2.223-1.796-3.455-.527-2.074-.527-4.988 0-7.062.313-1.232.851-2.523 1.796-3.455.527 1.551 1.483 3.326 2.778 5.135v3.703c-1.295 1.809-2.251 3.583-2.778 5.134zm19.374 0c.945-.932 1.483-2.223 1.796-3.455.527-2.074.527-4.988 0-7.062-.313-1.232-.851-2.523-1.796-3.455-.527 1.551-1.483 3.326-2.778 5.135v3.703c1.295 1.809 2.251 3.583 2.778 5.134z" />
    </svg>
  )
}

function LogoPlayStation() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/80" fill="currentColor" aria-hidden="true">
      <path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.501zm4.659 16.264l6.344-2.003c.725-.246 1.576-.795 1.576-1.753 0-.959-.775-1.261-1.576-1.016l-6.344 2.049v2.723zm-6.329-.423c-2.346-.746-4.315-.326-4.315 1.76 0 2.023 1.756 2.817 4.315 2.283l1.329-.381V19.4l-1.329.424v-1.387z" />
    </svg>
  )
}

function Pilha({ nivel }: { nivel: number }) {
  const largura = Math.max(1, Math.round(nivel * 12))
  return (
    <svg viewBox="0 0 20 12" className="h-3 w-5" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="15" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="17" y="4.5" width="2" height="3" rx="0.5" fill="currentColor" />
      <rect x="2.5" y="3.5" width={largura} height="5" rx="0.5" fill="currentColor" />
    </svg>
  )
}
