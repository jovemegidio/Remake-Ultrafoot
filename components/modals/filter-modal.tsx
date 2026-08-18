"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"

interface FilterOptions {
  positions: string[]
  minOverall: number
  maxOverall: number
  minAge: number
  maxAge: number
  minValue: number
  maxValue: number
}

interface FilterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: FilterOptions
  onApply: (filters: FilterOptions) => void
  type?: "player" | "transfer"
}

const positions = [
  { id: "GOL", label: "GOL", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { id: "ZAG", label: "ZAG", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "LD", label: "LD", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "LE", label: "LE", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "VOL", label: "VOL", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { id: "MEI", label: "MEI", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { id: "PD", label: "PD", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { id: "PE", label: "PE", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { id: "ATA", label: "ATA", color: "bg-red-500/20 text-red-400 border-red-500/30" },
]

export function FilterModal({
  open,
  onOpenChange,
  filters,
  onApply,
  type = "player",
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters)

  const togglePosition = (pos: string) => {
    setLocalFilters(prev => ({
      ...prev,
      positions: prev.positions.includes(pos)
        ? prev.positions.filter(p => p !== pos)
        : [...prev.positions, pos]
    }))
  }

  const handleApply = () => {
    onApply(localFilters)
    onOpenChange(false)
  }

  const handleReset = () => {
    const defaultFilters: FilterOptions = {
      positions: [],
      minOverall: 0,
      maxOverall: 99,
      minAge: 16,
      maxAge: 45,
      minValue: 0,
      maxValue: 100000000,
    }
    setLocalFilters(defaultFilters)
  }

  // Ver components/modals/contract-modal: a moeda vem da preferencia do jogador.
  const formatValue = (value: number) => formatCurrency(value)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0c0c10] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Filtros</DialogTitle>
          <DialogDescription className="text-white/50">
            {type === "player" 
              ? "Filtre os jogadores do elenco"
              : "Filtre os jogadores disponiveis"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Positions */}
          <div className="space-y-3">
            <Label className="text-white/70">Posicoes</Label>
            <div className="flex flex-wrap gap-2">
              {positions.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => togglePosition(pos.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold border transition-all",
                    localFilters.positions.includes(pos.id)
                      ? pos.color
                      : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                  )}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overall Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-white/70">Overall</Label>
              <span className="text-sm text-white">
                {localFilters.minOverall} - {localFilters.maxOverall}
              </span>
            </div>
            <div className="px-2">
              <Slider
                value={[localFilters.minOverall, localFilters.maxOverall]}
                onValueChange={([min, max]) => setLocalFilters(prev => ({
                  ...prev,
                  minOverall: min,
                  maxOverall: max
                }))}
                min={0}
                max={99}
                step={1}
                className="py-4"
              />
            </div>
          </div>

          {/* Age Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-white/70">Idade</Label>
              <span className="text-sm text-white">
                {localFilters.minAge} - {localFilters.maxAge} anos
              </span>
            </div>
            <div className="px-2">
              <Slider
                value={[localFilters.minAge, localFilters.maxAge]}
                onValueChange={([min, max]) => setLocalFilters(prev => ({
                  ...prev,
                  minAge: min,
                  maxAge: max
                }))}
                min={16}
                max={45}
                step={1}
                className="py-4"
              />
            </div>
          </div>

          {/* Value Range */}
          {type === "transfer" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white/70">Valor de Mercado</Label>
                <span className="text-sm text-white">
                  {formatValue(localFilters.minValue)} - {formatValue(localFilters.maxValue)}
                </span>
              </div>
              <div className="px-2">
                <Slider
                  value={[localFilters.minValue, localFilters.maxValue]}
                  onValueChange={([min, max]) => setLocalFilters(prev => ({
                    ...prev,
                    minValue: min,
                    maxValue: max
                  }))}
                  min={0}
                  max={100000000}
                  step={1000000}
                  className="py-4"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleReset} 
            className="flex-1 border-white/10 text-white/70"
          >
            Limpar
          </Button>
          <Button 
            onClick={handleApply} 
            className="flex-1 bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
          >
            Aplicar Filtros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
