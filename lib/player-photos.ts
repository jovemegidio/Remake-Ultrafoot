import manifest from "@/data/seeds/faces-manifest.json"
import { gameAssetUrl } from "@/lib/game-asset"
import { storeGet, storeSet } from "@/lib/persistent-store"

// O manifesto contém apenas arquivos fisicamente empacotados. O mapa editorial é
// maior e inclui fotos planejadas; consultá-lo gerava milhares de 404 e prejudicava
// máquinas com pouca memória/disco lento.
const photoMap = (manifest as { entries: Record<string, string> }).entries

// Normalizes a player name into a lookup key: "Gabriel Barbosa" → "gabriel-barbosa"
export function normalizePlayerKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

// Returns the photo URL for a player, or undefined if none is registered.
export function getPlayerPhotoUrl(name: string, playerId?: string): string | undefined {
  const custom = typeof window !== "undefined" ? storeGet(`ultrafoot:player-photo:${normalizePlayerKey(name)}`) : null
  if (custom) return custom
  const rawUrl =
    (playerId && photoMap[playerId]) ? photoMap[playerId] : photoMap[normalizePlayerKey(name)]
  if (!rawUrl) return undefined
  return gameAssetUrl(rawUrl)
}

export function setPlayerPhotoOverride(name: string, dataUrl: string): void {
  if (!name || !dataUrl.startsWith("data:image/")) return
  storeSet(`ultrafoot:player-photo:${normalizePlayerKey(name)}`, dataUrl)
}
