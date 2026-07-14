"use client"

// Ponte para o player de midia do SISTEMA (Spotify, YouTube Music, Deezer, VLC...).
//
// O jogo nao embute mais trilha propria: ele vira um CONTROLE REMOTO do que o jogador
// ja esta ouvindo. No Windows isso sai do SMTC (System Media Transport Controls), lido
// pelo Rust — sem login, sem API key e sem Spotify Premium.
//
// Fora do Tauri (navegador) nao existe essa API: available fica false e a UI some.

export interface NowPlaying {
  available: boolean
  title: string
  artist: string
  album: string
  /** Ex.: "Spotify.exe" — so para rotular a fonte na UI. */
  source: string
  isPlaying: boolean
}

const EMPTY: NowPlaying = {
  available: false,
  title: "",
  artist: "",
  album: "",
  source: "",
  isPlaying: false,
}

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

async function call<T>(cmd: string, fallback: T): Promise<T> {
  if (!inTauri()) return fallback
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return (await invoke(cmd)) as T
  } catch {
    return fallback
  }
}

/** O Rust manda snake_case; a UI usa camelCase. */
interface RawNowPlaying {
  available: boolean
  title: string
  artist: string
  album: string
  source: string
  is_playing: boolean
}

export async function getNowPlaying(): Promise<NowPlaying> {
  const raw = await call<RawNowPlaying | null>("media_now_playing", null)
  if (!raw || !raw.available) return EMPTY
  return {
    available: true,
    title: raw.title,
    artist: raw.artist,
    album: raw.album,
    source: raw.source,
    isPlaying: raw.is_playing,
  }
}

export const togglePlayPause = () => call<boolean>("media_play_pause", false)
export const skipNext = () => call<boolean>("media_next", false)
export const skipPrevious = () => call<boolean>("media_previous", false)

/** Nome amigavel da fonte a partir do AppUserModelId do Windows. */
export function sourceLabel(source: string): string {
  const s = source.toLowerCase()
  if (s.includes("spotify")) return "Spotify"
  if (s.includes("chrome") || s.includes("msedge") || s.includes("firefox")) return "Navegador"
  if (s.includes("vlc")) return "VLC"
  if (s.includes("music") || s.includes("zune")) return "Groove"
  if (s.includes("deezer")) return "Deezer"
  if (s.includes("tidal")) return "TIDAL"
  return "Player do sistema"
}
