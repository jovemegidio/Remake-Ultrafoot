"use client"

// Espelho dos saves numa PASTA VISÍVEL do Windows (Documentos\Ultrafoot 26 Saves),
// a pedido do usuário: além do armazenamento durável interno (tauri-plugin-store,
// que sobrevive a reinstalações mas fica escondido no AppData), cada carreira é
// gravada como um .json legível/portável que o jogador pode achar e fazer backup.
//
// Best-effort e SÓ no app (Tauri): na web vira no-op. Falhas são engolidas — o
// espelho é um extra, nunca pode quebrar o save real.

const FOLDER = "Ultrafoot 26 Saves"

function isTauri(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined"
}

function safeFileName(name: string): string {
  const limpo = (name || "carreira").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60)
  return limpo || "carreira"
}

/** Grava/atualiza o arquivo da carreira na pasta de saves do Windows. */
export async function mirrorSaveToFolder(name: string, careerId: string, json: string): Promise<void> {
  if (!isTauri() || !careerId) return
  try {
    const fs = await import("@tauri-apps/plugin-fs")
    const base = { baseDir: fs.BaseDirectory.Document }
    if (!(await fs.exists(FOLDER, base))) await fs.mkdir(FOLDER, { ...base, recursive: true })
    // Sufixo com o fim do careerId evita colisão entre carreiras de mesmo nome.
    const file = `${FOLDER}/${safeFileName(name)} (${careerId.slice(-6)}).json`
    await fs.writeTextFile(file, json, base)
  } catch (e) {
    console.warn("[save-folder] espelho falhou (ignorado):", e)
  }
}

/** Apaga o arquivo espelho de uma carreira na pasta (por sufixo do careerId,
 *  robusto a renomeações). Best-effort. */
export async function deleteSaveFromFolder(_name: string, careerId: string): Promise<void> {
  if (!isTauri() || !careerId) return
  try {
    const fs = await import("@tauri-apps/plugin-fs")
    const base = { baseDir: fs.BaseDirectory.Document }
    if (!(await fs.exists(FOLDER, base))) return
    const suf = `(${careerId.slice(-6)}).json`
    for (const entry of await fs.readDir(FOLDER, base)) {
      if (entry.isFile && entry.name.endsWith(suf)) {
        await fs.remove(`${FOLDER}/${entry.name}`, base)
      }
    }
  } catch (e) {
    console.warn("[save-folder] apagar espelho falhou:", e)
  }
}

/** Sufixos de careerId (últimos 6) presentes na pasta de saves. `null` quando a
 *  pasta não existe/está indisponível (para não reconciliar às cegas). */
export async function listMirroredCareerSuffixes(): Promise<Set<string> | null> {
  if (!isTauri()) return null
  try {
    const fs = await import("@tauri-apps/plugin-fs")
    const base = { baseDir: fs.BaseDirectory.Document }
    if (!(await fs.exists(FOLDER, base))) return null
    const out = new Set<string>()
    for (const entry of await fs.readDir(FOLDER, base)) {
      const m = entry.isFile ? entry.name.match(/\(([0-9a-z]{6})\)\.json$/i) : null
      if (m) out.add(m[1])
    }
    return out
  } catch (e) {
    console.warn("[save-folder] listar espelhos falhou:", e)
    return null
  }
}

/** Abre a pasta de saves no Explorer do Windows. */
export async function openSavesFolder(): Promise<void> {
  if (!isTauri()) return
  try {
    const { documentDir, join } = await import("@tauri-apps/api/path")
    const fs = await import("@tauri-apps/plugin-fs")
    if (!(await fs.exists(FOLDER, { baseDir: fs.BaseDirectory.Document }))) {
      await fs.mkdir(FOLDER, { baseDir: fs.BaseDirectory.Document, recursive: true })
    }
    const full = await join(await documentDir(), FOLDER)
    // Não há binding JS do plugin-opener instalado; a crate Rust está registrada,
    // então chamamos o comando dela direto via invoke (capability opener:default).
    const { invoke } = await import("@tauri-apps/api/core")
    await invoke("plugin:opener|open_path", { path: full })
  } catch (e) {
    console.warn("[save-folder] abrir pasta falhou:", e)
  }
}
