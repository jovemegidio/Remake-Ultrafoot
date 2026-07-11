import { isTauri } from "@/lib/game-asset"

/**
 * Verifica se há uma nova versão publicada (via tauri-plugin-updater),
 * pergunta ao usuário e, se confirmado, baixa + instala + reinicia o jogo.
 *
 * Endpoint e chave pública são configurados em src-tauri/tauri.conf.json
 * (`plugins.updater`). Os artefatos são assinados no build com a chave privada.
 *
 * No navegador (fora do Tauri) é no-op.
 */
export async function checkForUpdates(opts: { silent?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined" || !isTauri()) return

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
      return
    }

    const { ask, message } = await import("@tauri-apps/plugin-dialog")
    const notes = update.body ? `\n\nNovidades:\n${update.body}` : ""
    const wantsUpdate = await ask(
      `Uma nova versão do Ultrafoot 26 está disponível: v${update.version}.${notes}\n\nDeseja baixar e instalar agora?`,
      {
        title: "Atualização disponível",
        kind: "info",
        okLabel: "Atualizar agora",
        cancelLabel: "Mais tarde",
      },
    )

    if (!wantsUpdate) return

    // Baixa e instala. O instalador NSIS roda em modo "passive" (config),
    // mostrando uma barra de progresso mínima.
    let downloaded = 0
    let contentLength = 0
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength ?? 0
          break
        case "Progress":
          downloaded += event.data.chunkLength
          break
        case "Finished":
          break
      }
    })
    void downloaded
    void contentLength

    await message("Atualização instalada com sucesso. O jogo será reiniciado agora.", {
      title: "Pronto!",
      kind: "info",
    })

    const { relaunch } = await import("@tauri-apps/plugin-process")
    await relaunch()
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
  }
}
