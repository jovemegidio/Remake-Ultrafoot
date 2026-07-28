"use client"

// Brasao/uniforme da SELECAO e a escala de cor da forca. Vivia dentro de
// app/selecao/page.tsx; saiu para ca porque as telas de convocacao, competicoes e
// amistosos precisam exatamente do mesmo fallback (arquivo ausente -> bloco em
// gradiente com o codigo do pais, nunca um quadrado quebrado).

import { useState } from "react"
import { getNationalCrestUrl, getNationalKitUrl } from "@/lib/national-assets"

export function NationalCrest({
  team,
  size = 48,
}: {
  team: { id?: string; code: string; cor1: string; cor2: string }
  size?: number
}) {
  const [erro, setErro] = useState(false)
  if (team.id && !erro) {
    return (
      <img
        src={getNationalCrestUrl(team.id)}
        alt={team.code}
        onError={() => setErro(true)}
        style={{ width: size, height: size }}
        className="rounded-lg object-contain"
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-lg font-bold text-white shadow-inner"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${team.cor1} 0%, ${team.cor2} 100%)`,
        fontSize: size * 0.3,
        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      }}
      aria-hidden
    >
      {team.code}
    </div>
  )
}

/** Uniforme da selecao (home). Some silenciosamente se o arquivo nao existir. */
export function NationalKit({ id, size = 56 }: { id: string; size?: number }) {
  const [erro, setErro] = useState(false)
  if (erro) return null
  return (
    <img
      src={getNationalKitUrl(id, "home")}
      alt=""
      onError={() => setErro(true)}
      style={{ width: size, height: size }}
      className="object-contain drop-shadow"
      aria-hidden
    />
  )
}

export function strengthTone(strength: number): string {
  if (strength >= 85) return "text-[#00ffc8]"
  if (strength >= 75) return "text-emerald-400"
  if (strength >= 65) return "text-yellow-400"
  return "text-white/60"
}
