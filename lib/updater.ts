import { isTauri } from "@/lib/game-asset"
import { buscarJson } from "@/lib/buscar-json"

export interface InGameUpdateOffer {
  version: string
  notes: string
}

/**
 * BUILD DE LOJA (Steam, Epic, GOG).
 *
 * Ligada por `NEXT_PUBLIC_ULTRAFOOT_LOJA=1` no build — ver scripts/build-loja.mjs.
 *
 * Numa loja quem distribui atualização é a própria plataforma, pelos depots
 * dela. Um jogo que busca versão nova por fora quebra a verificação de
 * integridade da loja e é motivo de reprovação na revisão. Com a flag ligada
 * nada aqui vai à rede: as duas funções abaixo devolvem "sem atualização" na
 * primeira linha, então nem o aviso do boot nem a tela de Atualizações
 * consultam nada.
 */
export const BUILD_DE_LOJA = process.env.NEXT_PUBLIC_ULTRAFOOT_LOJA === "1"

/**
 * O jogo NÃO se atualiza mais sozinho — quem baixa e instala novas versões é o
 * Ultrafoot Launcher. Aqui só CONFERIMOS a versão publicada, por dois motivos:
 *
 *  1. travar o multiplayer/online quando o cliente está desatualizado
 *     (todos precisam da mesma build para jogar juntos);
 *  2. avisar o jogador, com um diálogo do próprio jogo, que há versão nova e que
 *     ela é instalada pelo launcher.
 *
 * A verificação lê o latest.json publicado. No navegador (fora do Tauri) é no-op.
 */
export type UpdateCheckResult = "current" | "available" | "unavailable"

// Dupla primária/reserva, igual à do manifesto de elencos — e nesta ordem de
// propósito.
//
// "releases/latest" do GitHub aponta para a release mais recente do
// REPOSITÓRIO, não para a última build do jogo. Toda vez que sai uma release do
// launcher ou dos pacotes de Linux/macOS, ela assume esse lugar — e como essas
// releases não carregam latest.json, a URL passa a responder 404 e a
// verificação morre em silêncio. Foi o que aconteceu: hoje "latest" é
// launcher-desktop-1.0.19 e o latest.json do jogo está em build-1.0.201.
//
// A VPS serve sempre o manifesto do JOGO, então é ela que vem primeiro.
const LATEST_JSON_VPS = "https://ultrafoot.179-198-103-30.sslip.io/downloads/latest.json"
const LATEST_JSON_GITHUB =
  "https://github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json"

interface LatestJson {
  version?: string
  notes?: string
}

async function lerLatest(): Promise<LatestJson | null> {
  const dado =
    (await buscarJson<LatestJson>(LATEST_JSON_VPS, 8000)) ??
    (await buscarJson<LatestJson>(LATEST_JSON_GITHUB, 12000))
  // Sem `version` não é manifesto: é página de erro que virou JSON.
  return dado?.version ? dado : null
}

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

export interface VersaoPublicada {
  /** Versão instalada nesta máquina. */
  atual: string
  /** Versão publicada no latest.json. */
  publicada: string
  notas: string
  /** true = a publicada é mais nova que a instalada. */
  nova: boolean
}

/**
 * Consulta a versão publicada e DEVOLVE o resultado, sem diálogo nativo e sem
 * disparar evento.
 *
 * É o que a tela de Atualizações usa: lá o resultado vira uma linha na
 * interface do próprio jogo. checkForUpdates continua sendo o caminho do boot,
 * onde a resposta é um aviso e não uma tela.
 */
export async function consultarVersaoPublicada(): Promise<VersaoPublicada | null> {
  if (BUILD_DE_LOJA) return null
  if (typeof window === "undefined" || !isTauri()) return null
  try {
    const { getVersion } = await import("@tauri-apps/api/app")
    const atual = await getVersion()

    const data = await lerLatest()
    if (!data?.version) return null
    const publicada = String(data.version)

    return {
      atual,
      publicada,
      notas: data.notes ?? "Correções, melhorias de estabilidade e dados atualizados.",
      nova: isNewer(publicada, atual),
    }
  } catch (err) {
    console.error("[updater] falha ao consultar versão publicada:", err)
    return null
  }
}

export async function checkForUpdates(opts: { silent?: boolean } = {}): Promise<UpdateCheckResult> {
  if (BUILD_DE_LOJA) return "unavailable"
  if (typeof window === "undefined" || !isTauri()) return "unavailable"

  try {
    // Mesma consulta da tela de Atualizações — uma fonte só para as duas.
    const versao = await consultarVersaoPublicada()
    if (!versao) {
      if (!opts.silent) {
        const { message } = await import("@tauri-apps/plugin-dialog")
        await message("Não foi possível verificar atualizações no momento. Tente novamente mais tarde.", {
          title: "Atualização",
          kind: "warning",
        })
      }
      return "unavailable"
    }

    if (versao.nova) {
      // A UI do jogo (NativeAppProvider) mostra o diálogo orientando a atualizar
      // pelo launcher. Isso substitui o antigo download/instalação in-game.
      window.dispatchEvent(
        new CustomEvent<InGameUpdateOffer>("ultrafoot:update-available", {
          detail: { version: versao.publicada, notes: versao.notas },
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
