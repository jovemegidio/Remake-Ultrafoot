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
    await invoke("download_and_install", { url })
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

/** Abre o jogo instalado. */
export async function launchGame(path: string | null): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("launch_game", { path })
}

// ─── Fallback de navegador (dev) ─────────────────────────────────────────────
async function simulate(onProgress: (p: ProgressPayload) => void): Promise<void> {
  const total = 438 * 1024 * 1024
  for (let pct = 0; pct <= 100; pct += 7) {
    onProgress({ phase: "downloading", percent: Math.min(100, pct), downloaded: Math.round((total * pct) / 100), total })
    await new Promise((r) => setTimeout(r, 180))
  }
  onProgress({ phase: "installing", percent: 100, downloaded: total, total })
  await new Promise((r) => setTimeout(r, 1200))
  onProgress({ phase: "done", percent: 100, downloaded: total, total })
}
