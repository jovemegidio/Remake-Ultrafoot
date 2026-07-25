/**
 * Ponte entre a UI (Next.js) e o backend nativo (Tauri/Rust) do launcher.
 *
 * Quando roda dentro do app Tauri, chama os comandos Rust reais (baixar, instalar
 * silencioso, detectar versão instalada, abrir o jogo). Quando roda no navegador
 * (dev / `pnpm dev`), cai em fallbacks simulados para a UI continuar navegável.
 */

export type InstalledGame = {
  installed: boolean
  version: string | null
  path: string | null
}

export type LatestInfo = {
  version: string
  notes: string
  url: string
}

export type ProgressPhase = "downloading" | "installing" | "done"

export type ProgressPayload = {
  phase: ProgressPhase
  percent: number
  downloaded: number
  total: number
  /** bytes por segundo (0 quando não aplicável) */
  speed: number
  /** segundos restantes estimados (0 quando desconhecido) */
  eta: number
}

/** true quando o código roda dentro do runtime do Tauri (app desktop). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/** Versão instalada do jogo (lida do registro do Windows). */
export async function getInstalledGame(): Promise<InstalledGame> {
  if (!isTauri()) return { installed: false, version: null, path: null }
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<InstalledGame>("get_installed_game")
}

/** Última versão publicada (lê o latest.json do GitHub). Null se offline. */
export async function fetchLatest(): Promise<LatestInfo | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<LatestInfo>("fetch_latest")
  } catch {
    return null
  }
}

/**
 * Baixa o setup.exe e instala/atualiza em silêncio (/S). Reporta progresso real
 * pelo callback. Só funciona dentro do Tauri; no navegador simula para a demo.
 */
export async function installOrUpdate(
  url: string,
  version: string,
  onProgress: (p: ProgressPayload) => void,
): Promise<void> {
  if (!isTauri()) {
    // Simulação para o modo navegador (dev): download depois instalação.
    await simulate(onProgress)
    return
  }
  const { invoke } = await import("@tauri-apps/api/core")
  const { listen } = await import("@tauri-apps/api/event")
  const unlisten = await listen<ProgressPayload>("launcher://progress", (e) => onProgress(e.payload))
  try {
    await invoke("download_and_install", { url, version })
  } finally {
    unlisten()
  }
}

/** Há uma versão mais nova do PRÓPRIO launcher? Null se já está atualizado. */
export async function checkLauncherUpdate(): Promise<LatestInfo | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<LatestInfo | null>("check_launcher_update")
  } catch {
    return null
  }
}

/**
 * Baixa e instala uma nova versão do PRÓPRIO launcher e reabre. O launcher fecha
 * no fim (o instalador troca o .exe em uso e reabre o app).
 */
export async function selfUpdate(
  url: string,
  onProgress: (p: ProgressPayload) => void,
): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  const { listen } = await import("@tauri-apps/api/event")
  const unlisten = await listen<ProgressPayload>("launcher://progress", (e) => onProgress(e.payload))
  try {
    await invoke("self_update", { url })
  } finally {
    unlisten()
  }
}

// ─── Config remota / comunidade ──────────────────────────────────────────────

export type LauncherConfig = {
  announcement?: { text: string; level?: "info" | "warning" }
  news?: Array<{ title: string; category?: string; body?: string; date?: string; pinned?: boolean }>
  changelog?: Array<{
    version: string
    date?: string
    title?: string
    latest?: boolean
    changes?: Array<{ type?: "added" | "fixed" | "changed" | "removed"; text: string }>
  }>
  social?: { discord?: string; youtube?: string; tiktok?: string; instagram?: string }
  serverStatusUrl?: string
}

export type ServerStatus = { online: boolean; game_version: string | null }

/** Configuração remota (notícias/banner/redes/status). Null se offline. */
export async function fetchLauncherConfig(): Promise<LauncherConfig | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<LauncherConfig>("fetch_launcher_config")
  } catch {
    return null
  }
}

/** Status do servidor multiplayer (ping em {url}/health). */
export async function checkServerStatus(url: string): Promise<ServerStatus | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<ServerStatus>("check_server_status", { url })
  } catch {
    return null
  }
}

/** Abre um link no navegador padrão do sistema. */
export async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer")
    return
  }
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener")
    await openUrl(url)
  } catch {
    /* ignore */
  }
}

// ─── Configurações ───────────────────────────────────────────────────────────

/** O launcher está configurado para iniciar com o Windows? */
export async function getAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { isEnabled } = await import("@tauri-apps/plugin-autostart")
    return await isEnabled()
  } catch {
    return false
  }
}

/** Liga/desliga iniciar o launcher com o Windows. */
export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  const { enable, disable } = await import("@tauri-apps/plugin-autostart")
  if (enabled) await enable()
  else await disable()
}

/**
 * Ao fechar a janela, chama `shouldMinimize()`. Se true, esconde para a bandeja em
 * vez de sair. Retorna uma função para remover o handler.
 */
export async function setupCloseToTray(shouldMinimize: () => boolean): Promise<() => void> {
  if (!isTauri()) return () => {}
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  const win = getCurrentWindow()
  const unlisten = await win.onCloseRequested(async (event) => {
    if (shouldMinimize()) {
      event.preventDefault()
      await win.hide()
    }
  })
  return unlisten
}

/** Abre o jogo instalado. */
export async function launchGame(path: string | null): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("launch_game", { path })
}

// ─── Fallback de navegador (dev) ─────────────────────────────────────────────
async function simulate(onProgress: (p: ProgressPayload) => void): Promise<void> {
  const total = 438 * 1024 * 1024
  const speed = 12 * 1024 * 1024
  for (let pct = 0; pct <= 100; pct += 7) {
    const downloaded = Math.round((total * pct) / 100)
    onProgress({
      phase: "downloading",
      percent: Math.min(100, pct),
      downloaded,
      total,
      speed,
      eta: Math.max(0, Math.round((total - downloaded) / speed)),
    })
    await new Promise((r) => setTimeout(r, 180))
  }
  onProgress({ phase: "installing", percent: 100, downloaded: total, total, speed: 0, eta: 0 })
  await new Promise((r) => setTimeout(r, 1200))
  onProgress({ phase: "done", percent: 100, downloaded: total, total, speed: 0, eta: 0 })
}
