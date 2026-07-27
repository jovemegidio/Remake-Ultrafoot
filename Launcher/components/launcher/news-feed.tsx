"use client"

import type { NewsWithGame } from "@/lib/data"
import { timeAgo } from "@/lib/format"
import { Pin } from "lucide-react"

export function NewsFeed({ news, title = "Novidades", compact = false }: { news: NewsWithGame[]; title?: string; compact?: boolean }) {
  if (news.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma novidade por aqui ainda.
      </div>
    )
  }

  const [featured, ...rest] = news

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>

      {featured && (
        <article className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
          <div className="flex flex-col gap-2 p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {featured.category}
              </span>
              {featured.isPinned && <Pin className="h-3.5 w-3.5 text-accent" fill="currentColor" />}
              <span className="text-xs text-muted-foreground">{timeAgo(featured.publishedAt)}</span>
            </div>
            <h3 className="text-pretty text-lg font-semibold leading-snug text-foreground">
              {featured.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{featured.body}</p>
            {featured.gameName && (
              <span className="mt-auto pt-2 text-xs text-muted-foreground">
                em <span className="text-foreground">{featured.gameName}</span>
              </span>
            )}
          </div>
        </article>
      )}

      <div className={compact ? "grid gap-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
        {rest.map((item) => (
          <article
            key={item.id}
            className={`flex flex-col rounded-xl border border-border bg-card transition-colors hover:border-primary/40 ${compact ? "gap-1.5 p-3" : "gap-2 p-4"}`}
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">
                {item.category}
              </span>
              <span className="text-xs text-muted-foreground">{timeAgo(item.publishedAt)}</span>
            </div>
            <h3 className={`text-pretty font-semibold leading-snug text-foreground ${compact ? "text-sm line-clamp-2" : ""}`}>{item.title}</h3>
            <p className={`leading-relaxed text-muted-foreground ${compact ? "text-xs line-clamp-1" : "text-sm line-clamp-3"}`}>
              {item.excerpt}
            </p>
            {item.gameName && !compact && (
              <span className="mt-auto pt-1 text-xs text-muted-foreground">
                em <span className="text-foreground">{item.gameName}</span>
              </span>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
