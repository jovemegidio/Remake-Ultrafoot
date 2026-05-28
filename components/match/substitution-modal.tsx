"use client"

import { useState } from "react"
import { ArrowLeftRight, Check, X, ChevronRight, Zap, Heart, Activity, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Team } from "@/lib/teams-data"

export interface MatchPlayer {
  id: number
  name: string
  number: number
  position: string
  rating: number
  stamina: number
  // Atributos de PlayerCard estilo FUT
  pace?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
  // Visual
  goals?: number
  assists?: number
  yellow?: boolean
  red?: boolean
}

interface SubstitutionModalProps {
  open: boolean
  onClose: () => void
  team: Team
  starters: MatchPlayer[]
  bench: MatchPlayer[]
  subsRemaining: number
  onConfirm: (out: MatchPlayer, inPlayer: MatchPlayer) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Player Card (estilo FUT/EA FC 26)
// ─────────────────────────────────────────────────────────────────────────────

function getCardTier(rating: number): {
  bg: string
  ring: string
  label: string
  text: string
} {
  if (rating >= 87) return {
    bg: "linear-gradient(160deg, #f1c768 0%, #c98e2b 60%, #8c5a14 100%)",
    ring: "ring-amber-300",
    label: "TOTW",
    text: "#3a2400",
  }
  if (rating >= 82) return {
    bg: "linear-gradient(160deg, #f8d568 0%, #d4a02b 60%, #97681a 100%)",
    ring: "ring-yellow-300",
    label: "GOLD",
    text: "#2a1f00",
  }
  if (rating >= 75) return {
    bg: "linear-gradient(160deg, #d8d3c0 0%, #aaa490 60%, #6f6957 100%)",
    ring: "ring-zinc-300",
    label: "SILVER",
    text: "#1f1d15",
  }
  return {
    bg: "linear-gradient(160deg, #b08762 0%, #8b6543 60%, #5b3f25 100%)",
    ring: "ring-amber-700",
    label: "BRONZE",
    text: "#fff",
  }
}

function PlayerCard({
  player,
  team,
  selected,
  disabled,
  onClick,
  variant = "out",
}: {
  player: MatchPlayer
  team: Team
  selected: boolean
  disabled?: boolean
  onClick: () => void
  variant?: "out" | "in"
}) {
  const tier = getCardTier(player.rating)
  const stamColor =
    player.stamina > 70 ? "#00ffc8" : player.stamina > 40 ? "#eab308" : "#ef4444"

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col w-full rounded-lg overflow-hidden transition-all",
        "border-2",
        selected
          ? variant === "out"
            ? "border-red-400 scale-[1.02] shadow-[0_0_24px_rgba(248,113,113,0.4)]"
            : "border-[#00ffc8] scale-[1.02] shadow-[0_0_24px_rgba(29,185,84,0.4)]"
          : "border-transparent hover:scale-[1.01]",
        disabled && "opacity-30 cursor-not-allowed",
      )}
      style={{ background: tier.bg }}
    >
      {/* Tier label */}
      <div className="flex items-center justify-between px-2 py-1">
        <span
          className="text-[8px] font-black tracking-[0.15em]"
          style={{ color: tier.text }}
        >
          {tier.label}
        </span>
        <span
          className="text-[8px] font-bold"
          style={{ color: tier.text }}
        >
          {team.curto}
        </span>
      </div>

      {/* Rating + Position */}
      <div className="flex items-start gap-2 px-2 pb-1">
        <div className="flex flex-col items-center">
          <span
            className="text-2xl font-black leading-none"
            style={{ color: tier.text }}
          >
            {player.rating}
          </span>
          <span
            className="text-[9px] font-bold tracking-wider"
            style={{ color: tier.text, opacity: 0.7 }}
          >
            {player.position}
          </span>
        </div>
        {/* Avatar shape */}
        <div className="flex-1 flex items-center justify-center">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-base font-black"
            style={{
              backgroundColor: team.cor1,
              color: team.cor2,
              border: `2px solid ${tier.text}`,
            }}
          >
            #{player.number}
          </div>
        </div>
      </div>

      {/* Name */}
      <div
        className="text-center text-[11px] font-black uppercase tracking-wide truncate px-1"
        style={{ color: tier.text }}
      >
        {player.name}
      </div>

      {/* Stats grid mini */}
      {(player.pace || player.shooting) && (
        <div className="grid grid-cols-3 gap-x-1 gap-y-0 px-2 py-1 text-[8px] font-bold" style={{ color: tier.text }}>
          {player.pace !== undefined && <div className="flex justify-between"><span>RIT</span><span>{player.pace}</span></div>}
          {player.shooting !== undefined && <div className="flex justify-between"><span>FIN</span><span>{player.shooting}</span></div>}
          {player.passing !== undefined && <div className="flex justify-between"><span>PAS</span><span>{player.passing}</span></div>}
          {player.dribbling !== undefined && <div className="flex justify-between"><span>DRI</span><span>{player.dribbling}</span></div>}
          {player.defending !== undefined && <div className="flex justify-between"><span>DEF</span><span>{player.defending}</span></div>}
          {player.physical !== undefined && <div className="flex justify-between"><span>FIS</span><span>{player.physical}</span></div>}
        </div>
      )}

      {/* Stamina bar */}
      <div className="px-2 pb-1.5 pt-0.5">
        <div className="flex items-center justify-between text-[8px] font-bold mb-0.5" style={{ color: tier.text }}>
          <span className="flex items-center gap-0.5">
            <Heart className="h-2 w-2" /> ENERGIA
          </span>
          <span>{player.stamina}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-black/30 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${player.stamina}%`, backgroundColor: stamColor }}
          />
        </div>
      </div>

      {/* Indicators */}
      <div className="absolute top-1 right-1 flex flex-col gap-0.5">
        {player.goals && player.goals > 0 && (
          <div className="h-4 px-1 rounded bg-black/60 flex items-center gap-0.5">
            <span className="text-[9px] font-bold text-white">{player.goals}</span>
            <span className="text-[9px] text-white">G</span>
          </div>
        )}
        {player.yellow && (
          <div className="h-3 w-2 rounded-sm bg-yellow-400" />
        )}
        {player.red && (
          <div className="h-3 w-2 rounded-sm bg-red-500" />
        )}
      </div>

      {/* Selected check */}
      {selected && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center backdrop-blur-[1px]",
            variant === "out" ? "bg-red-500/30" : "bg-[#00ffc8]/30",
          )}
        >
          <div
            className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center shadow-lg",
              variant === "out" ? "bg-red-500" : "bg-[#00ffc8]",
            )}
          >
            {variant === "out" ? (
              <ArrowLeftRight className="h-6 w-6 text-white rotate-180" />
            ) : (
              <Check className="h-6 w-6 text-black" />
            )}
          </div>
        </div>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal principal
// ─────────────────────────────────────────────────────────────────────────────

export function SubstitutionModal({
  open,
  onClose,
  team,
  starters,
  bench,
  subsRemaining,
  onConfirm,
}: SubstitutionModalProps) {
  const [out, setOut] = useState<MatchPlayer | null>(null)
  const [inPlayer, setIn] = useState<MatchPlayer | null>(null)

  if (!open) return null

  const canConfirm = out && inPlayer && subsRemaining > 0

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(out!, inPlayer!)
    setOut(null)
    setIn(null)
  }

  const handleClose = () => {
    setOut(null)
    setIn(null)
    onClose()
  }

  // Sugestão automática: jogador com menor stamina
  const suggestedOut = [...starters].sort((a, b) => a.stamina - b.stamina)[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-white/10 overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div
          className="relative flex items-center justify-between px-6 py-5 border-b border-white/[0.04]"
          style={{
            background: `linear-gradient(90deg, ${team.cor1}30 0%, transparent 60%)`,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: `${team.cor1}20`, border: `1px solid ${team.cor1}40` }}
            >
              <ArrowLeftRight className="h-5 w-5" style={{ color: team.cor1 }} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Substituição
              </h3>
              <p className="text-[11px] text-white/50 tracking-wider uppercase">
                {team.nome} · {subsRemaining} restantes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-bold tracking-wider",
                subsRemaining > 2
                  ? "bg-[#00ffc8]/15 text-[#00ffc8]"
                  : subsRemaining > 0
                    ? "bg-yellow-400/15 text-yellow-400"
                    : "bg-red-400/15 text-red-400",
              )}
            >
              {subsRemaining}/5
            </span>
            <button
              onClick={handleClose}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid lg:grid-cols-2 gap-6">
          {/* SAI */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold text-white/60 tracking-[0.2em] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                SAI DE CAMPO
              </h4>
              {suggestedOut && !out && (
                <button
                  onClick={() => setOut(suggestedOut)}
                  className="flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 font-medium tracking-wider"
                >
                  <Zap className="h-3 w-3" />
                  SUGESTÃO: #{suggestedOut.number}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[480px] overflow-y-auto pr-1">
              {starters.map(p => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  team={team}
                  selected={out?.id === p.id}
                  variant="out"
                  onClick={() => setOut(out?.id === p.id ? null : p)}
                />
              ))}
            </div>
          </div>

          {/* ENTRA */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold text-white/60 tracking-[0.2em] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00ffc8]" />
                ENTRA EM CAMPO
              </h4>
              <span className="text-[10px] text-white/40 tracking-wider">
                {bench.length} no banco
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[480px] overflow-y-auto pr-1">
              {bench.map(p => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  team={team}
                  selected={inPlayer?.id === p.id}
                  variant="in"
                  onClick={() => setIn(inPlayer?.id === p.id ? null : p)}
                />
              ))}
              {bench.length === 0 && (
                <div className="col-span-full rounded-xl border border-white/[0.04] bg-white/[0.02] p-8 text-center text-xs text-white/40">
                  Banco vazio
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer com preview da substituição */}
        <div className="border-t border-white/[0.04] bg-black/40 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {out ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-400 font-bold text-xs flex-shrink-0">
                    #{out.number}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">{out.name}</div>
                    <div className="text-[10px] text-red-400">SAI · {out.stamina}%</div>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-white/40">Selecione quem sai</span>
              )}

              <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />

              {inPlayer ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00ffc8]/15 text-[#00ffc8] font-bold text-xs flex-shrink-0">
                    #{inPlayer.number}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">{inPlayer.name}</div>
                    <div className="text-[10px] text-[#00ffc8]">ENTRA · OVR {inPlayer.rating}</div>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-white/40 flex-1">Selecione quem entra</span>
              )}
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleClose}
                className="text-xs border-white/10 bg-transparent text-white/70 hover:bg-white/5"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="text-xs bg-[#00ffc8] text-black hover:bg-[#00c8ff] disabled:opacity-30 font-bold tracking-wide"
              >
                <Check className="mr-2 h-3.5 w-3.5" />
                CONFIRMAR
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
