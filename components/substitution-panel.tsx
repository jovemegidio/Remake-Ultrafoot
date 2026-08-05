"use client"

import { useState, useContext } from "react"
import { X, ArrowLeftRight, ChevronLeft, ChevronRight, User, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatar } from "@/components/player-avatar"
import { ControllerButton, ControllerToolbar, ControllerTypeContext } from "@/components/controller-buttons"
import { cn } from "@/lib/utils"
import { type Team } from "@/lib/teams-data"

interface Player {
  id: number
  name: string
  number: number
  position: string
  rating: number
  stamina?: number
  goals?: number
  assists?: number
  yellowCards?: number
  redCard?: boolean
}

interface SubstitutionPanelProps {
  team: Team
  starters: Player[]
  bench: Player[]
  substitutionsLeft: number
  maxSubstitutions: number
  currentMinute: number
  onClose: () => void
  onSubstitute: (playerOut: Player, playerIn: Player) => void
}

function getRatingColor(rating: number): string {
  if (rating >= 85) return "from-[#d4af37] to-[#ffd700]"
  if (rating >= 80) return "from-[var(--brand)] to-[#2ecc71]"
  if (rating >= 75) return "from-[#3498db] to-[#5dade2]"
  if (rating >= 70) return "from-[#9b59b6] to-[#bb6bd9]"
  return "from-[#7f8c8d] to-[#95a5a6]"
}

function getStaminaColor(stamina: number): string {
  if (stamina >= 70) return "bg-[var(--brand)]"
  if (stamina >= 40) return "bg-[#f59e0b]"
  return "bg-[#ef4444]"
}

export function SubstitutionPanel({
  team,
  starters,
  bench,
  substitutionsLeft,
  maxSubstitutions,
  currentMinute,
  onClose,
  onSubstitute,
}: SubstitutionPanelProps) {
  const controllerType = useContext(ControllerTypeContext)
  const [selectedOut, setSelectedOut] = useState<Player | null>(null)
  const [selectedIn, setSelectedIn] = useState<Player | null>(null)
  const [step, setStep] = useState<"select-out" | "select-in" | "confirm">("select-out")

  const handleSelectOut = (player: Player) => {
    if (player.redCard) return // Can't substitute a sent-off player
    setSelectedOut(player)
    setStep("select-in")
  }

  const handleSelectIn = (player: Player) => {
    setSelectedIn(player)
    setStep("confirm")
  }

  const handleConfirm = () => {
    if (selectedOut && selectedIn) {
      onSubstitute(selectedOut, selectedIn)
      onClose()
    }
  }

  const handleBack = () => {
    if (step === "select-in") {
      setSelectedOut(null)
      setStep("select-out")
    } else if (step === "confirm") {
      setSelectedIn(null)
      setStep("select-in")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-5xl bg-[#0d0d0d] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[var(--brand)]/10 to-transparent">
          <div className="flex items-center gap-4">
            <TeamCrest team={team} size="md" />
            <div>
              <h2 className="text-lg font-bold text-white">Substituicao</h2>
              <div className="text-xs text-white/50">
                {substitutionsLeft} de {maxSubstitutions} substituicoes restantes
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Minuto</div>
              <div className="text-2xl font-black text-white">{currentMinute}&apos;</div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-4 py-4 border-b border-white/[0.04]">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition",
            step === "select-out" ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "text-white/40"
          )}>
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              step === "select-out" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : selectedOut ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/10"
            )}>
              {selectedOut ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : "1"}
            </div>
            <span className="text-sm font-medium">Jogador Sai</span>
          </div>
          
          <div className="w-12 h-px bg-white/10" />
          
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition",
            step === "select-in" ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "text-white/40"
          )}>
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              step === "select-in" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : selectedIn ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/10"
            )}>
              {selectedIn ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : "2"}
            </div>
            <span className="text-sm font-medium">Jogador Entra</span>
          </div>
          
          <div className="w-12 h-px bg-white/10" />
          
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition",
            step === "confirm" ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "text-white/40"
          )}>
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              step === "confirm" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/10"
            )}>
              3
            </div>
            <span className="text-sm font-medium">Confirmar</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "select-out" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-sm text-white/60">Selecione o jogador que vai sair</div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {starters.map(player => (
                  <button
                    key={player.id}
                    onClick={() => handleSelectOut(player)}
                    disabled={player.redCard}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                      player.redCard
                        ? "opacity-40 cursor-not-allowed border-red-500/50 bg-red-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-[var(--brand)]/50"
                    )}
                  >
                    {/* Rosto, com o numero em cima. Esta lista mostrava so o
                        numero da camisa — procurar o atleta pelo numero e o
                        contrario do que o tecnico faz. */}
                    <div className="relative h-12 w-12 shrink-0">
                      <PlayerAvatar
                        name={player.name}
                        fileKey={team.file_key}
                        position={player.position}
                        teamColor={team.cor1}
                        size="md"
                        className="h-12 w-12 rounded-lg"
                      />
                      <span className="absolute -left-1 -top-1 min-w-[16px] rounded bg-[#080b0b] px-1 text-center text-[10px] font-black text-white/85 shadow">
                        {player.number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{player.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40">{player.position}</span>
                        <div className={cn(
                          "h-1.5 w-12 rounded-full bg-white/10 overflow-hidden"
                        )}>
                          <div 
                            className={cn("h-full rounded-full", getStaminaColor(player.stamina || 100))}
                            style={{ width: `${player.stamina || 100}%` }}
                          />
                        </div>
                      </div>
                      {player.yellowCards ? (
                        <div className="flex gap-0.5 mt-1">
                          {Array.from({ length: player.yellowCards }).map((_, i) => (
                            <div key={i} className="w-2 h-3 bg-yellow-400 rounded-sm" />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className={cn(
                      "h-8 w-8 rounded flex items-center justify-center text-xs font-black text-white bg-gradient-to-br",
                      getRatingColor(player.rating)
                    )}>
                      {player.rating}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "select-in" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-sm text-white/60">
                  <span className="text-[var(--brand)] font-semibold">{selectedOut?.name}</span> sai. Selecione quem entra.
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {bench.map(player => (
                  <button
                    key={player.id}
                    onClick={() => handleSelectIn(player)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[var(--brand)]/50 transition-all text-left"
                  >
                    {/* Rosto, com o numero em cima. Esta lista mostrava so o
                        numero da camisa — procurar o atleta pelo numero e o
                        contrario do que o tecnico faz. */}
                    <div className="relative h-12 w-12 shrink-0">
                      <PlayerAvatar
                        name={player.name}
                        fileKey={team.file_key}
                        position={player.position}
                        teamColor={team.cor1}
                        size="md"
                        className="h-12 w-12 rounded-lg"
                      />
                      <span className="absolute -left-1 -top-1 min-w-[16px] rounded bg-[#080b0b] px-1 text-center text-[10px] font-black text-white/85 shadow">
                        {player.number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{player.name}</div>
                      <span className="text-[10px] text-white/40">{player.position}</span>
                    </div>
                    <div className={cn(
                      "h-8 w-8 rounded flex items-center justify-center text-xs font-black text-white bg-gradient-to-br",
                      getRatingColor(player.rating)
                    )}>
                      {player.rating}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "confirm" && selectedOut && selectedIn && (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <div className="text-sm text-white/60">Confirme a substituicao</div>
              </div>
              
              <div className="flex items-center justify-center gap-8">
                {/* Player Out */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] text-red-400 uppercase tracking-wider mb-2 font-semibold">Sai</div>
                  <div className="relative h-20 w-20">
                    <PlayerAvatar
                      name={selectedOut.name}
                      fileKey={team.file_key}
                      position={selectedOut.position}
                      teamColor={team.cor1}
                      size="xl"
                      className="h-20 w-20 rounded-xl border-2 border-red-500/50"
                    />
                    <span className="absolute -left-1.5 -top-1.5 min-w-[22px] rounded-md bg-[#080b0b] px-1.5 py-0.5 text-center text-xs font-black text-white/90 shadow">
                      {selectedOut.number}
                    </span>
                  </div>
                  <div className="mt-3 text-center">
                    <div className="text-lg font-bold text-white">{selectedOut.name}</div>
                    <div className="text-xs text-white/50">{selectedOut.position}</div>
                    <div className={cn(
                      "mt-2 inline-flex px-2 py-0.5 rounded text-xs font-black text-white bg-gradient-to-r",
                      getRatingColor(selectedOut.rating)
                    )}>
                      {selectedOut.rating}
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center">
                  <ArrowLeftRight className="h-10 w-10 text-[var(--brand)]" />
                  <div className="mt-2 text-[10px] text-white/40">{currentMinute}&apos;</div>
                </div>

                {/* Player In */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] text-[var(--brand)] uppercase tracking-wider mb-2 font-semibold">Entra</div>
                  <div className="relative h-20 w-20">
                    <PlayerAvatar
                      name={selectedIn.name}
                      fileKey={team.file_key}
                      position={selectedIn.position}
                      teamColor={team.cor1}
                      size="xl"
                      className="h-20 w-20 rounded-xl border-2 border-[var(--brand)]/50"
                    />
                    <span className="absolute -left-1.5 -top-1.5 min-w-[22px] rounded-md bg-[#080b0b] px-1.5 py-0.5 text-center text-xs font-black text-white/90 shadow">
                      {selectedIn.number}
                    </span>
                  </div>
                  <div className="mt-3 text-center">
                    <div className="text-lg font-bold text-white">{selectedIn.name}</div>
                    <div className="text-xs text-white/50">{selectedIn.position}</div>
                    <div className={cn(
                      "mt-2 inline-flex px-2 py-0.5 rounded text-xs font-black text-white bg-gradient-to-r",
                      getRatingColor(selectedIn.rating)
                    )}>
                      {selectedIn.rating}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4 mt-8">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="px-8 border-white/10 bg-transparent text-white/70 hover:bg-white/5"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="px-8 bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)] font-bold"
                >
                  Confirmar Substituicao
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with controller buttons */}
        <ControllerToolbar
          visible={true}
          controller={controllerType}
          actions={[
            { button: "A", label: "Selecionar" },
            { button: "B", label: step === "select-out" ? "Fechar" : "Voltar" },
            { button: "Y", label: "Confirmar" },
          ]}
          className="border-t border-white/10"
        />
      </div>
    </div>
  )
}
