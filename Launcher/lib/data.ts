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

export async function getGamesWithReleases(): Promise<GameWithReleases[]> {
  const allGames = await getGames()
  const allReleases = [...RELEASES].sort(byNewest)
  const allChangelog = [...CHANGELOG].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  return allGames.map((game) => {
    const gameReleases = allReleases
      .filter((r) => r.gameId === game.id)
      .map((r) => ({
        ...r,
        changelog: allChangelog.filter((c) => c.releaseId === r.id),
      }))
    const latestRelease = gameReleases.find((r) => r.isLatest) ?? gameReleases[0] ?? null
    return { ...game, latestRelease, releases: gameReleases }
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
