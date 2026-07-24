import { getFeaturedGame, getNewsForGame } from "@/lib/data"
import { LauncherShell } from "@/components/launcher/launcher-shell"

export default async function Page() {
  const game = await getFeaturedGame()

  if (!game) {
    return (
      <main className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Nenhum jogo configurado.
      </main>
    )
  }

  const news = await getNewsForGame(game.id)
  return <LauncherShell game={game} news={news} />
}
