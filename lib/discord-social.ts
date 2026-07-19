export type DiscordSocialUser = {
  id: string
  username: string
  displayName: string
  avatarUrl: string
}

export type DiscordSocialFriend = DiscordSocialUser & {
  status: "online" | "idle" | "dnd" | "streaming" | "invisible" | "offline"
  playingUltrafoot: boolean
}

export type DiscordSocialSnapshot = {
  available: boolean
  phase: string
  error: string
  detectedName: string
  authenticated: boolean
  user: DiscordSocialUser | null
  friends: DiscordSocialFriend[]
}

export type DiscordPresencePayload = {
  details: string
  state: string
  startTimestamp: number
  largeText?: string
  smallImage?: string
  smallText?: string
}

const browserFallback: DiscordSocialSnapshot = {
  available: false,
  phase: "browser",
  error: "O FC Hub social funciona no aplicativo instalado.",
  detectedName: "",
  authenticated: false,
  user: null,
  friends: [],
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error(browserFallback.error)
  }
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core")
  return tauriInvoke<T>(command, args)
}

export async function getDiscordSocialSnapshot(): Promise<DiscordSocialSnapshot> {
  try {
    return await invoke<DiscordSocialSnapshot>("discord_social_snapshot")
  } catch {
    return browserFallback
  }
}

export async function loginDiscordSocial(): Promise<void> {
  await invoke("discord_social_login")
}

export async function disconnectDiscordSocial(): Promise<void> {
  await invoke("discord_social_disconnect")
}

/**
 * Atualiza o Rich Presence do aplicativo instalado. No navegador e quando o
 * Discord está fechado a chamada é silenciosa: a navegação do jogo jamais pode
 * depender do cliente social.
 */
export async function updateDiscordPresence(payload: DiscordPresencePayload): Promise<void> {
  try {
    await invoke("discord_update", payload)
  } catch {
    // O Discord é opcional e pode ser aberto depois do jogo.
  }
}

export async function clearDiscordPresence(): Promise<void> {
  try {
    await invoke("discord_clear")
  } catch {
    // no-op fora do aplicativo instalado
  }
}
