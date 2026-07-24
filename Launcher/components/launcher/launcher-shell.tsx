"use client"

import { useCallback, useEffect, useState } from "react"
import type { GameWithReleases, NewsWithGame } from "@/lib/data"
import { GameHero } from "./game-hero"
import { NewsFeed } from "./news-feed"
import { ChangelogView } from "./changelog-view"
import { SecurityPanel } from "./security-panel"
import { cn } from "@/lib/utils"
import {
  getInstalledGame,
  fetchLatest,
  installOrUpdate,
  launchGame,
  type ProgressPhase,
} from "@/lib/launcher-bridge"
import { Home, Newspaper, ScrollText, ShieldCheck, ShieldOff, Wifi, WifiOff } from "lucide-react"

export type GameStatus = "not-installed" | "downloading" | "update" | "playable"
export type LaunchMode = "online" | "offline"

export type InstallState = {
  version: string | null
  path: string | null
  downloading: boolean
  phase: ProgressPhase
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

  // Última versão publicada: parte do dado estático embutido e é confirmada em
  // runtime pelo latest.json — assim o launcher reconhece uma versão nova sem
  // precisar ser recompilado.
  const [latest, setLatest] = useState<{ version: string | null; url: string | null }>(() => ({
    version: game.latestRelease?.version ?? null,
    url: game.latestRelease?.downloadUrl ?? null,
  }))

  const [install, setInstall] = useState<InstallState>({
    version: null,
    path: null,
    downloading: false,
    phase: "downloading",
    progress: 0,
  })

  // Ao abrir: detecta a versão instalada (registro do Windows) e confirma a
  // última versão publicada (latest.json do GitHub).
  useEffect(() => {
    let alive = true
    void (async () => {
      const [installed, remote] = await Promise.all([getInstalledGame(), fetchLatest()])
      if (!alive) return
      setInstall((prev) => ({ ...prev, version: installed.version, path: installed.path }))
      if (remote) setLatest({ version: remote.version, url: remote.url })
    })()
    return () => {
      alive = false
    }
  }, [])

  const latestVersion = latest.version

  const status: GameStatus = install.downloading
    ? "downloading"
    : install.version === null
      ? "not-installed"
      : latestVersion && install.version !== latestVersion
        ? "update"
        : "playable"

  const startDownload = useCallback(() => {
    if (install.downloading) return
    if (status === "playable") {
      void launchGame(install.path) // abre o jogo instalado
      return
    }

    const url = latest.url ?? game.latestRelease?.downloadUrl
    if (!url) return

    setInstall((prev) => ({ ...prev, downloading: true, phase: "downloading", progress: 0 }))
    installOrUpdate(url, (p) => {
      setInstall((prev) => ({
        ...prev,
        downloading: p.phase !== "done",
        phase: p.phase,
        progress: p.percent,
      }))
    })
      .then(() => {
        setInstall((prev) => ({
          ...prev,
          version: latest.version ?? prev.version,
          downloading: false,
          phase: "done",
          progress: 100,
        }))
      })
      .catch((err) => {
        console.error("[launcher] falha ao instalar:", err)
        setInstall((prev) => ({ ...prev, downloading: false }))
      })
  }, [install.downloading, install.path, status, latest.url, latest.version, game.latestRelease?.downloadUrl])

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
