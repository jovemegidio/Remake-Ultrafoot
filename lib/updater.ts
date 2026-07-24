import { isTauri } from "@/lib/game-asset"

export interface InGameUpdateOffer {
  version: string
  notes: string
}

/**
 * O jogo NÃO se atualiza mais sozinho — quem baixa e instala novas versões é o
 * Ultrafoot Launcher. Aqui só CONFERIMOS a versão publicada, por dois motivos:
 *
 *  1. travar o multiplayer/online quando o cliente está desatualizado
 *     (todos precisam da mesma build para jogar juntos);
 *  2. avisar o jogador, com um diálogo do próprio jogo, que há versão nova e que
 *     ela é instalada pelo launcher.
 *
 * A verificação lê o mesmo latest.json publicado no GitHub. No navegador (fora do
 * Tauri) é no-op.
 */
export type UpdateCheckResult = "current" | "available" | "unavailable"

const LATEST_JSON_URL =
  "https://github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json"

/** Compara "1.0.146" > "1.0.145" numericamente, segmento a segmento. */
function isNewer(latest: string, current: string): boolean {
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0)
  const b = current.split(".").map((n) => parseInt(n, 10) || 0)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

export async function checkForUpdates(opts: { silent?: boolean } = {}): Promise<UpdateCheckResult> {
  if (typeof window === "undefined" || !isTauri()) return "unavailable"

  try {
    const { getVersion } = await import("@tauri-apps/api/app")
    const current = await getVersion()

    // http nativo: o webview aplicaria CORS; o plugin faz a requisição no lado nativo.
    const { fetch } = await import("@tauri-apps/plugin-http")
    const res = await fetch(LATEST_JSON_URL, { method: "GET" })
    if (!res.ok) return "unavailable"

    const data = (await res.json()) as { version?: string; notes?: string }
    const latest = String(data.version ?? "")
    if (!latest) return "unavailable"

    if (isNewer(latest, current)) {
      // A UI do jogo (NativeAppProvider) mostra o diálogo orientando a atualizar
      // pelo launcher. Isso substitui o antigo download/instalação in-game.
      window.dispatchEvent(
        new CustomEvent<InGameUpdateOffer>("ultrafoot:update-available", {
          detail: {
            version: latest,
            notes: data.notes ?? "Correções, melhorias de estabilidade e dados atualizados.",
          },
        }),
      )
      return "available"
    }

    if (!opts.silent) {
      const { message } = await import("@tauri-apps/plugin-dialog")
      await message("Você já está na versão mais recente do Ultrafoot 26.", {
        title: "Tudo atualizado",
        kind: "info",
      })
    }
    return "current"
  } catch (err) {
    // Falha de rede não deve quebrar o jogo.
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
    console.error("[updater] falha ao verificar atualização:", err)
    return "unavailable"
  }
}
