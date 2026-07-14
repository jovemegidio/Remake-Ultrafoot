"use client"

import { useEffect } from "react"
import { type Team } from "@/lib/teams-data"
import { KitImage, type KitVariant } from "@/components/match/kit-image"
import { cn } from "@/lib/utils"

const VARIANTS: KitVariant[] = ["home", "away", "third"]
const LABEL: Record<KitVariant, string> = { home: "Casa", away: "Visitante", third: "Terceiro" }

// Modal de selecao de uniformes: escolhe o kit (casa/visitante/terceiro) do time da casa
// e do adversario. Abre com a tecla Q na pre-partida, no lugar de "Opcoes de vantagem".
//
// As camisas usam KitImage: quando o clube nao tem arte (25 clubes nao tem), ela desenha
// a camisa com as cores do time em vez de mostrar o texto alternativo — que era o que
// deixava o modal com cara de quebrado.
function TeamKits({
  team, selected, onSelect,
}: {
  team: Team
  selected: KitVariant
  onSelect: (v: KitVariant) => void
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-lg font-bold text-white">{team.nome}</h3>
      <div className="flex gap-3">
        {VARIANTS.map((v) => {
          const isSel = selected === v
          return (
            <button
              key={v}
              onClick={() => onSelect(v)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                isSel
                  ? "border-[#00ffc8] bg-[#00ffc8]/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/30",
              )}
            >
              <div className="relative h-24 w-24">
                <KitImage team={team} variant={v} />
              </div>
              <span className={cn("text-xs font-semibold", isSel ? "text-[#00ffc8]" : "text-white/50")}>
                {LABEL[v]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function UniformSelectorModal({
  open,
  homeTeam,
  awayTeam,
  homeKit,
  awayKit,
  onHomeKit,
  onAwayKit,
  onClose,
}: {
  open: boolean
  homeTeam: Team
  awayTeam: Team
  homeKit: KitVariant
  awayKit: KitVariant
  onHomeKit: (v: KitVariant) => void
  onAwayKit: (v: KitVariant) => void
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "q") { e.preventDefault(); onClose() }
    }
    // CONTROLE: LB/RB trocam o kit da casa, LT/RT o do visitante, A/B fecham.
    // (O modal foi criado depois do sistema de gamepad e nao respondia ao controle.)
    const cycle = (cur: KitVariant, dir: 1 | -1): KitVariant => {
      const i = VARIANTS.indexOf(cur)
      return VARIANTS[(i + dir + VARIANTS.length) % VARIANTS.length]
    }
    const onPad = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "LB": onHomeKit(cycle(homeKit, -1)); break
        case "RB": onHomeKit(cycle(homeKit, 1)); break
        case "LT": onAwayKit(cycle(awayKit, -1)); break
        case "RT": onAwayKit(cycle(awayKit, 1)); break
        case "A":
        case "B": onClose(); break
      }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("gamepad:button", onPad)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("gamepad:button", onPad)
    }
  }, [open, onClose, homeKit, awayKit, onHomeKit, onAwayKit])

  if (!open) return null

  return (
    <div
      role="dialog"
      data-state="open"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0c1214] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-white">Uniformes</h2>
          <p className="text-xs text-white/40">Escolha o uniforme de cada time</p>
        </div>

        <div className="flex flex-col items-center justify-center gap-8 md:flex-row md:items-start md:gap-12">
          <TeamKits team={homeTeam} selected={homeKit} onSelect={onHomeKit} />
          <div className="text-2xl font-black text-white/20">VS</div>
          <TeamKits team={awayTeam} selected={awayKit} onSelect={onAwayKit} />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#00ffc8] px-8 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            Confirmar
          </button>
          <p className="text-[10px] text-white/25">
            Controle: LB/RB trocam o uniforme da casa · LT/RT o do visitante · A confirma
          </p>
        </div>
      </div>
    </div>
  )
}
