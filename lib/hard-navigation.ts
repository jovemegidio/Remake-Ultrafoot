// Helpers for full-page (hard) navigation in the exported/static build.
// The app is built with `output: 'export'` and `trailingSlash: true`, so we
// normalize hrefs to keep trailing slashes consistent and avoid SPA routing.

/**
 * Normalize an in-app href so it matches the exported static routing.
 * - Leaves external URLs, hash links and special protocols untouched.
 * - Ensures the pathname ends with a trailing slash (preserving query/hash).
 */
export function normalizeAppHref(href: string): string {
  if (!href) return "/"

  // Leave anchors, queries-only, external and special protocol links alone.
  if (
    href.startsWith("#") ||
    href.startsWith("?") ||
    /^[a-z]+:\/\//i.test(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("game-asset:")
  ) {
    return href
  }

  // Split off query string and hash so we only touch the pathname.
  let path = href
  let suffix = ""

  const hashIndex = path.indexOf("#")
  if (hashIndex !== -1) {
    suffix = path.slice(hashIndex) + suffix
    path = path.slice(0, hashIndex)
  }

  const queryIndex = path.indexOf("?")
  if (queryIndex !== -1) {
    suffix = path.slice(queryIndex) + suffix
    path = path.slice(0, queryIndex)
  }

  // Don't add a trailing slash to file-like paths (e.g. /something.html).
  const lastSegment = path.split("/").pop() ?? ""
  const looksLikeFile = lastSegment.includes(".")

  if (path.length > 0 && !path.endsWith("/") && !looksLikeFile) {
    path = `${path}/`
  }

  if (path.length === 0) {
    path = "/"
  }

  return `${path}${suffix}`
}

/**
 * O export estático grava diretórios com barra final, mas o App Router do Next 16
 * precisa receber a rota sem essa barra. Entregar `/elenco/` ao `router.push` deixa
 * o WebView na página atual; `/elenco` carrega `elenco/index.txt` corretamente.
 */
export function toClientRoute(href: string): string {
  const normalized = normalizeAppHref(href)
  if (!normalized.startsWith("/")) return normalized

  const suffixIndex = normalized.search(/[?#]/)
  const pathname = suffixIndex >= 0 ? normalized.slice(0, suffixIndex) : normalized
  const suffix = suffixIndex >= 0 ? normalized.slice(suffixIndex) : ""
  const clientPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "")
  return `${clientPath}${suffix}`
}

/**
 * Navega para outra tela do jogo.
 *
 * ⚠️ O NOME MENTE, E ESTE DOCBLOCK JA MENTIU JUNTO. Dizia "full-page navigation
 * (no client-side routing)" — o oposto do que o corpo faz desde que a rota
 * interna passou a ser despachada como `ultrafoot:navigate` para o
 * `native-app-provider`, que chama `router.push`. Rota interna é **client-side**;
 * só URL externa/protocolo especial cai no `location.assign` lá embaixo.
 *
 * Isso importa para decisão de performance: como não há reload, o peso de JS de
 * uma tela é pago UMA VEZ (ao entrar no jogo) e não a cada troca de tela. Em
 * 07/08/2026 eu li este docblock, conclui que cada navegação recarregava 15 MB e
 * quase refatorei a camada de dados inteira por causa disso.
 *
 * @param href   Destination href.
 * @param replace When true, replaces the current history entry instead of pushing.
 */
export function hardNavigate(href: string, replace = false, opcoes?: { recarregar?: boolean }): void {
  if (typeof window === "undefined") return
  // ⚠️ QUANDO QUEM CHAMA JÁ SABE QUE O SPA NÃO VAI PEGAR (1.0.358).
  //
  // Medido: logo depois de criar uma carreira, o `router.push` não troca de
  // página no export estático — a tela só anda pelo carregamento completo que o
  // socorro do provider dispara. Tentar mesmo assim custa a espera do socorro e
  // um download de rota abandonado no meio. Quem sabe disso pede o caminho
  // direto e economiza os dois.
  if (opcoes?.recarregar) {
    const alvo = normalizeAppHref(href)
    if (replace) window.location.replace(alvo)
    else window.location.assign(alvo)
    return
  }

  const target = normalizeAppHref(href)
  // No aplicativo instalado, uma rota interna NAO e um arquivo do Windows.
  // Recarregar `/elenco/` via location.assign fazia o WebView procurar um caminho
  // fisico e exibir ERR_FILE_NOT_FOUND. O provider global encaminha este evento ao
  // roteador do Next, preservando tambem a instancia da carreira ativa.
  const bridge = window as Window & {
    __ULTRAFOOT_NAVIGATION_READY__?: boolean
    __ULTRAFOOT_PENDING_NAVIGATION__?: { href: string; replace: boolean }
  }
  if (target.startsWith("/")) {
    const detail = { href: toClientRoute(target), replace }
    if (bridge.__ULTRAFOOT_NAVIGATION_READY__) {
      window.dispatchEvent(new CustomEvent("ultrafoot:navigate", { detail }))
    } else {
      // Nunca transforme uma rota do Next em caminho físico do Windows. Se o provider
      // ainda estiver hidratando, ele consome esta navegação assim que ficar pronto.
      bridge.__ULTRAFOOT_PENDING_NAVIGATION__ = detail
    }
    return
  }
  // WebView, export estatico e servidor de QA nao concordam sempre sobre URLs
  // relativas. Resolver contra a pagina atual evita "Failed to construct URL" sem
  // alterar protocolos especiais usados pelo Tauri.
  let destination = target
  try {
    destination = new URL(target, window.location.href).href
  } catch {
    // Mantem o alvo normalizado como fallback para protocolos do aplicativo.
  }

  if (replace) {
    window.location.replace(destination)
  } else {
    window.location.assign(destination)
  }
}
