"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatSize } from "@/lib/format"
import type { GameStatus, InstallState, LaunchMode } from "./launcher-shell"
import { Download, Play, RefreshCw, Loader2, Wifi, WifiOff } from "lucide-react"

export function DownloadControl({
  status,
  install,
  mode,
  downloadSizeMb,
  onDownload,
  size = "lg",
}: {
  status: GameStatus
  install: InstallState
  mode: LaunchMode
  downloadSizeMb: number | null | undefined
  onDownload: () => void
  size?: "lg" | "sm"
}) {
  const online = mode === "online"
  if (status === "downloading") {
    const pct = Math.round(install.progress)
    return (
      <div className={cn("w-full", size === "lg" ? "max-w-md" : "max-w-none")}>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {install.version ? "Atualizando" : "Baixando"}… {pct}%
          </span>
          <span className="text-muted-foreground">
            {formatSize(Math.round(((downloadSizeMb || 0) * pct) / 100))} / {formatSize(downloadSizeMb)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  if (status === "playable") {
    return (
      <div className="flex items-center gap-3">
        <Button
          size={size === "lg" ? "lg" : "default"}
          onClick={onDownload}
          className={cn(
            "gap-2 font-semibold",
            !online && "bg-accent text-accent-foreground hover:bg-accent/90",
          )}
        >
          <Play className="h-4 w-4" fill="currentColor" />
          {online ? "Jogar Online" : "Jogar Offline"}
        </Button>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {online ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-primary" /> Anti-cheat ativo
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-accent" /> Edição liberada
            </>
          )}
        </span>
      </div>
    )
  }

  if (status === "update") {
    return (
      <div className="flex flex-col gap-1">
        <Button
          size={size === "lg" ? "lg" : "default"}
          onClick={onDownload}
          className="gap-2 bg-accent font-semibold text-accent-foreground hover:bg-accent/90"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
        <span className="text-xs text-muted-foreground">
          Download da atualização: {formatSize(downloadSizeMb)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size={size === "lg" ? "lg" : "default"}
        onClick={onDownload}
        className="gap-2 font-semibold"
      >
        <Download className="h-4 w-4" />
        Instalar
      </Button>
      <span className="text-xs text-muted-foreground">Tamanho: {formatSize(downloadSizeMb)}</span>
    </div>
  )
}
