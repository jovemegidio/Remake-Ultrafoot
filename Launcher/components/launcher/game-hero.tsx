"use client"

import type { GameWithReleases } from "@/lib/data"
import type { GameStatus, InstallState, LaunchMode } from "./launcher-shell"
import { DownloadControl } from "./download-control"
import { formatSize } from "@/lib/format"
import { HardDrive, Tag, Building2, Wifi, WifiOff } from "lucide-react"

export function GameHero({
  game,
  status,
  install,
  mode,
  onDownload,
}: {
  game: GameWithReleases
  status: GameStatus
  install: InstallState
  mode: LaunchMode
  onDownload: () => void
}) {
  const latest = game.latestRelease
  const online = mode === "online"
  return (
    <section className="relative overflow-hidden rounded-xl border border-border">
      {/* Fundo sem imagem (por enquanto): gradiente com as cores do tema. */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/40 to-background" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/30" />
      </div>

      <div className="relative flex min-h-[380px] flex-col justify-end gap-4 p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {latest?.channel === "beta" && (
            <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
              Beta
            </span>
          )}
          {status === "playable" && (
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
              Instalado
            </span>
          )}
          <span
            className={
              online
                ? "flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary"
                : "flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent"
            }
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "Modo Online" : "Modo Offline"}
          </span>
        </div>

        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">
            {game.name}
          </h1>
          <p className="mt-2 text-pretty text-base text-muted-foreground md:text-lg">
            {game.tagline}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> {game.developer}
          </span>
          <span className="flex items-center gap-1.5">
            <Tag className="h-4 w-4" /> {game.genre}
          </span>
          <span className="flex items-center gap-1.5">
            <HardDrive className="h-4 w-4" /> {formatSize(game.sizeMb)}
          </span>
          {latest && (
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs text-foreground">
              v{latest.version}
            </span>
          )}
        </div>

        <div className="mt-2">
          <DownloadControl
            status={status}
            install={install}
            mode={mode}
            downloadSizeMb={latest?.sizeMb ?? game.sizeMb}
            onDownload={onDownload}
          />
        </div>
      </div>
    </section>
  )
}
