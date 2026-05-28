import overrides from "@/data/seeds/player_photo_overrides.json"
import { gameAssetUrl } from "@/lib/game-asset"

const raw = overrides as Record<string, string>
// strip documentation keys (prefixed with _)
const photoMap = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_")))

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
  const rawUrl =
    (playerId && photoMap[playerId]) ? photoMap[playerId] : photoMap[normalizePlayerKey(name)]
  if (!rawUrl) return undefined
  return gameAssetUrl(rawUrl)
}