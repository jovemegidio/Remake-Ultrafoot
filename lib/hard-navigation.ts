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
 * Perform a full-page navigation (no client-side routing).
 * @param href   Destination href.
 * @param replace When true, replaces the current history entry instead of pushing.
 */
export function hardNavigate(href: string, replace = false): void {
  if (typeof window === "undefined") return

  const target = normalizeAppHref(href)

  if (replace) {
    window.location.replace(target)
  } else {
    window.location.assign(target)
  }
}
