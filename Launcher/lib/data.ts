import type { Game, Release, ChangelogEntry, News } from "@/lib/db/schema"
import { GAMES, RELEASES, CHANGELOG, NEWS } from "@/lib/ultrafoot-data"

export type ReleaseWithChangelog = Release & { changelog: ChangelogEntry[] }
export type GameWithReleases = Game & {
  latestRelease: Release | null
  releases: ReleaseWithChangelog[]
}
export type NewsWithGame = News & { gameName: string | null }

const byNewest = <T extends { publishedAt?: Date; releasedAt?: Date }>(a: T, b: T) => {
  const da = (a.publishedAt ?? a.releasedAt) as Date
  const db = (b.publishedAt ?? b.releasedAt) as Date
  return db.getTime() - da.getTime()
}

export async function getGames(): Promise<Game[]> {
  return [...GAMES].sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function getFeaturedGame(): Promise<GameWithReleases | null> {
  const all = await getGamesWithReleases()
  return all.find((g) => g.isFeatured) ?? all[0] ?? null
}

export async function getNewsForGame(gameId: number): Promise<NewsWithGame[]> {
  const all = await getNews()
  return all.filter((n) => n.gameId === gameId || n.gameId === null)
}

/**
 * Versão REAL mais recente, direto do release do GitHub (mesma fonte do
 * auto-updater). Assim o launcher nunca mostra uma versão desatualizada por
 * causa da lista estática. Se a API falhar (offline), devolve null e caímos no
 * estático. Cacheado 5 min pelo Next.
 */
export async function fetchLiveLatest(): Promise<{ version: string; sizeMb: number; downloadUrl: string } | null> {
  try {
    const res = await fetch("https://api.github.com/repos/jovemegidio/Ultrafoot26/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const j = (await res.json()) as { tag_name?: string; assets?: { name: string; size: number; browser_download_url: string }[] }
    const version = String(j.tag_name ?? "").replace(/^build-/, "").trim()
    if (!/^\d+\.\d+\.\d+$/.test(version)) return null
    const asset = (j.assets ?? []).find((a) => /_x64-setup\.exe$/i.test(a.name))
    return {
      version,
      sizeMb: asset ? Math.round(asset.size / (1024 * 1024)) : 0,
      downloadUrl: asset?.browser_download_url ?? "",
    }
  } catch {
    return null
  }
}

export async function getGamesWithReleases(): Promise<GameWithReleases[]> {
  const allGames = await getGames()
  const allReleases = [...RELEASES].sort(byNewest)
  const allChangelog = [...CHANGELOG].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const live = await fetchLiveLatest()

  return allGames.map((game) => {
    const gameReleases = allReleases
      .filter((r) => r.gameId === game.id)
      .map((r) => ({
        ...r,
        changelog: allChangelog.filter((c) => c.releaseId === r.id),
      }))
    let latestRelease = gameReleases.find((r) => r.isLatest) ?? gameReleases[0] ?? null
    let sizeMb = game.sizeMb

    // Sobrepõe com o release REAL do GitHub (versão/tamanho/URL sempre atuais).
    if (live && game.isFeatured && latestRelease) {
      const mudou = latestRelease.version !== live.version
      latestRelease = {
        ...latestRelease,
        version: live.version,
        sizeMb: live.sizeMb || latestRelease.sizeMb,
        downloadUrl: live.downloadUrl || latestRelease.downloadUrl,
        title: mudou ? `Ultrafoot 26 v${live.version}` : latestRelease.title,
      }
      if (live.sizeMb) sizeMb = live.sizeMb
    }

    return { ...game, sizeMb, latestRelease, releases: gameReleases }
  })
}

export async function getNews(): Promise<NewsWithGame[]> {
  const gameName = (id: number | null) => GAMES.find((g) => g.id === id)?.name ?? null
  return [...NEWS]
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return byNewest(a, b)
    })
    .map((n) => ({ ...n, gameName: gameName(n.gameId) }))
}
