import { isTauri } from "@/lib/game-asset"

export interface InGameUpdateOffer {
  version: string
  notes: string
  install: (onProgress: (percent: number) => void) => Promise<void>
}

/**
 * Verifica se há uma nova versão publicada (via tauri-plugin-updater),
 * pergunta ao usuário e, se confirmado, baixa + instala + reinicia o jogo.
 *
 * Endpoint e chave pública são configurados em src-tauri/tauri.conf.json
 * (`plugins.updater`). Os artefatos são assinados no build com a chave privada.
 *
 * No navegador (fora do Tauri) é no-op.
 */
export type UpdateCheckResult = "current" | "available" | "unavailable"

export async function checkForUpdates(opts: { silent?: boolean } = {}): Promise<UpdateCheckResult> {
  if (typeof window === "undefined" || !isTauri()) return "unavailable"

  try {
    const { check } = await import("@tauri-apps/plugin-updater")
    const update = await check()

    if (!update) {
      if (!opts.silent) {
        const { message } = await import("@tauri-apps/plugin-dialog")
        await message("Você já está na versão mais recente do Ultrafoot 26.", {
          title: "Tudo atualizado",
          kind: "info",
        })
      }
      return "current"
    }

    const offer: InGameUpdateOffer = {
      version: update.version,
      notes: update.body ?? "Correções, melhorias de estabilidade e dados atualizados.",
      install: async (onProgress) => {
        let downloaded = 0
        let contentLength = 0
        await update.downloadAndInstall((event) => {
          if (event.event === "Started") contentLength = event.data.contentLength ?? 0
          if (event.event === "Progress") {
            downloaded += event.data.chunkLength
            onProgress(contentLength > 0 ? Math.min(99, Math.round(downloaded / contentLength * 100)) : 1)
          }
          if (event.event === "Finished") onProgress(100)
        })
        const { relaunch } = await import("@tauri-apps/plugin-process")
        await relaunch()
      },
    }

    // A confirmação pertence à UI do jogo. Isso elimina o MessageBox do Windows que
    // parecia uma ferramenta externa e quebrava a imersão.
    window.dispatchEvent(new CustomEvent<InGameUpdateOffer>("ultrafoot:update-available", { detail: offer }))
    return "available"
  } catch (err) {
    // Falha de rede / endpoint indisponível não deve quebrar o jogo.
    if (!opts.silent) {
      try {
        const { message } = await import("@tauri-apps/plugin-dialog")
        await message("Não foi possível verificar atualizações no momento. Tente novamente mais tarde.", {
          title: "Atualização",
          kind: "warning",
        })
      } catch {
        /* ignore */
      }
    }
    console.error("[updater] falha ao verificar/instalar atualização:", err)
    return "unavailable"
  }
}
