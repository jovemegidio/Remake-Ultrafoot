"use client"

import { cn } from "@/lib/utils"
import type { GameWithReleases } from "@/lib/data"
import { formatDate, formatSize } from "@/lib/format"
import { Plus, Wrench, RefreshCw, Minus } from "lucide-react"

const typeConfig: Record<
  string,
  { label: string; icon: typeof Plus; className: string }
> = {
  added: { label: "Adicionado", icon: Plus, className: "text-primary" },
  fixed: { label: "Corrigido", icon: Wrench, className: "text-chart-4" },
  changed: { label: "Alterado", icon: RefreshCw, className: "text-accent" },
  removed: { label: "Removido", icon: Minus, className: "text-destructive" },
}

export function ChangelogView({ game }: { game: GameWithReleases }) {
  if (game.releases.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma versão registrada.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-semibold tracking-tight">Histórico de versões</h2>
      <ol className="flex flex-col gap-4">
        {game.releases.map((release) => (
          <li
            key={release.id}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
              <span className="font-mono text-lg font-semibold text-foreground">v{release.version}</span>
              {release.isLatest && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  Mais recente
                </span>
              )}
              {release.channel === "beta" && (
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
                  Beta
                </span>
              )}
              {release.isRequired && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                  Obrigatória
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDate(release.releasedAt)} · {formatSize(release.sizeMb)}
              </span>
            </div>

            {release.title && (
              <p className="pt-3 text-sm font-medium text-foreground">{release.title}</p>
            )}

            <ul className="mt-3 flex flex-col gap-2">
              {release.changelog.map((entry) => {
                const conf = typeConfig[entry.type] ?? typeConfig.added
                const Icon = conf.icon
                return (
                  <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide",
                        conf.className,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="leading-relaxed text-muted-foreground">{entry.description}</span>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}
