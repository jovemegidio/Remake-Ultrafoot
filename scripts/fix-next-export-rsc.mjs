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
  throw new Error("out directory not found. Run next build first.")
}

walk(outDir)
console.log("Next export RSC aliases checked.")
