import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const ignoredRouteParts = new Set(["_full", "_head", "_index", "_tree"])

function walk(dir) {
  const entries = readdirSync(dir)
  const relativeDir = path.relative(outDir, dir)

  if (relativeDir && existsSync(path.join(dir, "index.txt"))) {
    const routePart = relativeDir.split(path.sep).join(".")
    const sourceName = entries.find(entry => {
      if (!entry.startsWith("__next.") || !entry.endsWith(".txt")) return false
      if (entry.includes(".__PAGE__.txt")) return false
      const part = entry.slice("__next.".length, -".txt".length)
      return !ignoredRouteParts.has(part)
    })

    if (sourceName) {
      const sourcePath = path.join(dir, sourceName)
      for (const aliasName of [`__next.${routePart}.txt`, `__next.${routePart}.__PAGE__.txt`]) {
        const aliasPath = path.join(dir, aliasName)
        if (!existsSync(aliasPath)) {
          copyFileSync(sourcePath, aliasPath)
        }
      }
    }
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const info = statSync(fullPath)

    if (info.isDirectory()) {
      walk(fullPath)
      continue
    }

    if (!entry.startsWith("__next.") || !entry.endsWith(".txt")) {
      continue
    }

    if (entry.includes(".__PAGE__.txt")) {
      continue
    }

    const routePart = entry.slice("__next.".length, -".txt".length)
    if (ignoredRouteParts.has(routePart)) {
      continue
    }

    const aliasName = `__next.${routePart}.__PAGE__.txt`
    const aliasPath = path.join(dir, aliasName)

    if (!existsSync(aliasPath)) {
      copyFileSync(fullPath, aliasPath)
    }
  }
}

if (!existsSync(outDir)) {
  const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM) || process.env.TAURI_BUILD === "1"
  if (isTauriBuild) {
    throw new Error("out directory not found. Run the Tauri static export first.")
  }
  console.log("Next export RSC aliases skipped (non-Tauri build).")
  process.exit(0)
}

walk(outDir)
console.log("Next export RSC aliases checked.")

// Guarda de boot: a janela do Tauri abre em `splash/` (tauri.conf.json -> app.windows.url).
// Se o export nao gerar `out/splash/index.html` (ou o `out/index.html` raiz), o WebView
// mostra "Arquivo nao encontrado / ERR_FILE_NOT_FOUND" ja na abertura — foi o bug da 1.0.85.
// Falhar o build AQUI impede que um bundle sem a tela inicial chegue aos jogadores.
const requiredBootFiles = ["index.html", path.join("splash", "index.html")]
const missingBootFiles = requiredBootFiles.filter(rel => !existsSync(path.join(outDir, rel)))
if (missingBootFiles.length > 0) {
  throw new Error(
    `Export incompleto: faltam arquivos de boot no out/ (${missingBootFiles.join(", ")}). ` +
    `A janela abre em 'splash/'; sem eles o jogo abre com ERR_FILE_NOT_FOUND. Build abortado.`,
  )
}
console.log("Boot files OK (index.html + splash/index.html).")
