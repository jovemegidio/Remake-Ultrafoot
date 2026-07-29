"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatSize } from "@/lib/format"
import type { GameStatus, InstallState, LaunchMode } from "./launcher-shell"
import { Download, Play, RefreshCw, Loader2, Wifi, WifiOff, Wrench, LogIn } from "lucide-react"

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return ""
  const mb = bytesPerSec / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
}

function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0) return ""
  if (seconds < 60) return `${seconds}s restantes`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}min ${s.toString().padStart(2, "0")}s restantes`
}

export function DownloadControl({
  status,
  install,
  mode,
  logado,
  downloadSizeMb,
  onDownload,
  onRepair,
  size = "lg",
}: {
  status: GameStatus
  install: InstallState
  mode: LaunchMode
  /** Sem conta o download fica travado — ver `startDownload` em launcher-shell. */
  logado: boolean
  downloadSizeMb: number | null | undefined
  onDownload: () => void
  onRepair: () => void
  size?: "lg" | "sm"
}) {
  const online = mode === "online"
  if (status === "downloading") {
    const pct = Math.round(install.progress)
    const installing = install.phase === "installing"
    const label = installing ? "Instalando" : install.version ? "Atualizando" : "Baixando"
    const speed = formatSpeed(install.speed)
    const eta = formatEta(install.eta)
    return (
      <div className={cn("w-full", size === "lg" ? "max-w-md" : "max-w-none")}>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {label}… {installing ? "" : `${pct}%`}
          </span>
          {!installing && (
            <span className="text-muted-foreground">
              {formatSize(Math.round(((downloadSizeMb || 0) * pct) / 100))} / {formatSize(downloadSizeMb)}
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-all duration-200",
              installing && "animate-pulse",
            )}
            style={{ width: installing ? "100%" : `${pct}%` }}
          />
        </div>
        {!installing && (speed || eta) && (
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{speed}</span>
            <span>{eta}</span>
          </div>
        )}
      </div>
    )
  }

  if (status === "playable") {
    return (
      <div className="flex flex-wrap items-center gap-3">
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
        <button
          onClick={onRepair}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          title={
            logado
              ? "Reinstala a versão atual por cima, corrigindo arquivos danificados."
              : "Reparar baixa o jogo de novo — entre na sua conta para usar."
          }
        >
          <Wrench className="h-3.5 w-3.5" />
          Reparar
        </button>
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
          {logado ? <RefreshCw className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {logado ? "Atualizar" : "Entrar para atualizar"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {logado ? (
            <>Download da atualização: {formatSize(downloadSizeMb)}</>
          ) : (
            <>Baixar exige conta — o jogo instalado continua abrindo normalmente.</>
          )}
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
        {logado ? <Download className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
        {logado ? "Instalar" : "Entrar para instalar"}
      </Button>
      <span className="text-xs text-muted-foreground">
        {logado ? (
          <>Tamanho: {formatSize(downloadSizeMb)}</>
        ) : (
          <>Crie sua conta ou entre para baixar o jogo · {formatSize(downloadSizeMb)}</>
        )}
      </span>
    </div>
  )
}
