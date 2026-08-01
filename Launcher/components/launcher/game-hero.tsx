"use client"

import type { GameWithReleases } from "@/lib/data"
import type { GameStatus, InstallState, LaunchMode } from "./launcher-shell"
import { DownloadControl } from "./download-control"
import { formatSize } from "@/lib/format"
import { useLiveLatest } from "@/lib/use-live-latest"
import { HardDrive, Tag, Building2, Wifi, WifiOff } from "lucide-react"

export function GameHero({
  game,
  status,
  install,
  mode,
  logado,
  erroAoAbrir,
  onDownload,
  onRepair,
}: {
  game: GameWithReleases
  status: GameStatus
  install: InstallState
  mode: LaunchMode
  logado: boolean
  /** Por que o jogo nao abriu no ultimo clique em Jogar. Null = sem falha. */
  erroAoAbrir?: string | null
  onDownload: () => void
  onRepair: () => void
}) {
  const latest = game.latestRelease
  const online = mode === "online"
  // Versao/tamanho REAIS do GitHub em runtime (nunca desatualiza). Cai no estatico
  // se o fetch falhar (offline). No modo offline nem consulta: era o unico fetch
  // que continuava saindo com o launcher em offline.
  const live = useLiveLatest(online)
  const displayVersion = live?.version ?? latest?.version
  const displaySizeMb = live?.sizeMb || game.sizeMb
  const downloadSizeMb = live?.sizeMb || latest?.sizeMb || game.sizeMb
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07100f] shadow-[0_28px_90px_rgba(0,0,0,.35)]">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* A arte tem o tecnico a DIREITA e o gramado a esquerda. O veu era pensado
            para a arte antiga (clara, assunto ao centro) e nesta apagava o campo
            inteiro — por isso ele agora e leve e so na faixa do texto. */}
        <img src="/games/ultrafoot-hero.png" alt="" className="h-full w-full object-cover object-[62%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05090b] via-[#05090b]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#05090b] via-[#05090b]/45 to-transparent" />
      </div>

      <div className="relative flex min-h-[520px] flex-col justify-end gap-4 p-6 md:p-10">
        <div className="absolute left-7 top-7 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/70 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(72,238,214,.9)]" />
          Temporada 2026
        </div>
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
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.26em] text-primary/85">Sua carreira. Suas decisões.</p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-6xl">
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
            <HardDrive className="h-4 w-4" /> {formatSize(displaySizeMb)}
          </span>
          {displayVersion && (
            <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs text-foreground">
              v{displayVersion}
            </span>
          )}
        </div>

        <div className="mt-2">
          <DownloadControl
            status={status}
            install={install}
            mode={mode}
            logado={logado}
            downloadSizeMb={downloadSizeMb}
            onDownload={onDownload}
            onRepair={onRepair}
          />
          {erroAoAbrir && (
            <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              Não consegui abrir o jogo: {erroAoAbrir}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
