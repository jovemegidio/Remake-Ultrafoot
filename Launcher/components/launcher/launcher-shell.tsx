"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GameWithReleases, NewsWithGame } from "@/lib/data"
import { GameHero } from "./game-hero"
import { NewsFeed } from "./news-feed"
import { ChangelogView } from "./changelog-view"
import { SecurityPanel } from "./security-panel"
import { cn } from "@/lib/utils"
import { Home, Newspaper, ScrollText, ShieldCheck, ShieldOff, Wifi, WifiOff } from "lucide-react"

export type GameStatus = "not-installed" | "downloading" | "update" | "playable"
export type LaunchMode = "online" | "offline"

export type InstallState = {
  version: string | null
  downloading: boolean
  progress: number
}

type Tab = "home" | "news" | "changelog" | "security"

export function LauncherShell({
  game,
  news,
}: {
  game: GameWithReleases
  news: NewsWithGame[]
}) {
  const [tab, setTab] = useState<Tab>("home")
  const [mode, setMode] = useState<LaunchMode>("online")
  // Estado inicial simulado nesta sessão: instalado numa versão antiga -> "Atualizar".
  const [install, setInstall] = useState<InstallState>(() => {
    const old = game.releases.find((r) => !r.isLatest)
    return { version: old?.version ?? null, downloading: false, progress: 0 }
  })
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const latestVersion = game.latestRelease?.version ?? null
  const downloadUrl = game.latestRelease?.downloadUrl ?? null

  const status: GameStatus = install.downloading
    ? "downloading"
    : install.version === null
      ? "not-installed"
      : latestVersion && install.version !== latestVersion
        ? "update"
        : "playable"

  const startDownload = useCallback(() => {
    if (install.downloading) return
    if (status === "playable") return // "Jogar" — sem launch real no portal web

    // Abre o setup.exe real publicado no GitHub (mesmo release do auto-updater).
    // A barra animada abaixo é apenas o feedback visual do portal web.
    if (downloadUrl) window.open(downloadUrl, "_blank", "noopener,noreferrer")

    setInstall((prev) => ({ ...prev, downloading: true, progress: 0 }))

    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => {
      setInstall((prev) => {
        if (!prev.downloading) return prev
        const next = Math.min(100, prev.progress + Math.random() * 12 + 4)
        if (next >= 100) {
          if (timer.current) clearInterval(timer.current)
          timer.current = null
          return { version: latestVersion ?? prev.version, downloading: false, progress: 100 }
        }
        return { ...prev, progress: next }
      })
    }, 350)
  }, [install.downloading, status, latestVersion, downloadUrl])

  const online = mode === "online"

  const tabs: { key: Tab; label: string; icon: typeof Home }[] = [
    { key: "home", label: "Início", icon: Home },
    { key: "news", label: "Novidades", icon: Newspaper },
    { key: "changelog", label: "Changelog", icon: ScrollText },
    { key: "security", label: "Segurança", icon: ShieldCheck },
  ]

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-background/80 px-4 pt-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/games/ultrafoot-logo.png"
              alt="Ultrafoot UF26"
              className="h-20 w-auto object-contain"
            />
            <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
              Launcher
            </span>
          </div>

          <div className="flex items-center gap-3">
            {online ? (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <ShieldCheck className="h-4 w-4 text-primary" /> Anti-cheat ativo
              </span>
            ) : (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <ShieldOff className="h-4 w-4 text-accent" /> Edição liberada
              </span>
            )}

            {/* Seletor de modo Online / Offline */}
            <div className="flex items-center rounded-full border border-border bg-secondary/60 p-0.5">
              <button
                onClick={() => setMode("online")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  online
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wifi className="h-3.5 w-3.5" /> Online
              </button>
              <button
                onClick={() => setMode("offline")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  !online
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <WifiOff className="h-3.5 w-3.5" /> Offline
              </button>
            </div>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((item) => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors md:px-4",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 p-4 md:p-6">
          {tab === "home" && (
            <>
              <GameHero
                game={game}
                status={status}
                install={install}
                mode={mode}
                onDownload={startDownload}
              />
              <NewsFeed news={news.slice(0, 4)} title="Últimas novidades" />
            </>
          )}

          {tab === "news" && <NewsFeed news={news} title={`Novidades de ${game.name}`} />}

          {tab === "changelog" && <ChangelogView game={game} />}

          {tab === "security" && <SecurityPanel mode={mode} />}
        </div>
      </div>
    </div>
  )
}
