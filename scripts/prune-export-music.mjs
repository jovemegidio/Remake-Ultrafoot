import { existsSync, readdirSync, rmSync, rmdirSync } from "node:fs"
import path from "node:path"

// Remove audio files from out/music (too large to embed in binary)
const musicDir = path.resolve("out/music")
const audioExtensions = new Set([".mp3", ".webm", ".ogg"])
let removed = 0

if (existsSync(musicDir)) {
  for (const entry of readdirSync(musicDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!audioExtensions.has(ext)) continue
    rmSync(path.join(musicDir, entry.name))
    removed++
  }
}
console.log(`Export music audio files pruned: ${removed}`)

// Remove large binary asset directories that Tauri cannot embed at compile time.
// The app has proper fallbacks for missing images (TeamCrest shows colored abbreviation,
// PlayerAvatar shows silhouette/initials).
const HEAVY_DIRS = [
  "out/jogadores",    // ~20k player photos
  "out/camisas",      // ~2.6k kit images (international)
  "out/camisas2",     // ~1.5k kit images
  "out/camisas3",     // ~519 kit images
  "out/escudos",      // ~3.1k shield images
  "out/escudos-mini", // ~2.6k mini shields
  "out/escudos-selecoes", // ~224 national team shields
  "out/selecoes",     // selecoes assets
  "out/trofeus",      // trophy images
]

let dirsPruned = 0
for (const dir of HEAVY_DIRS) {
  const full = path.resolve(dir)
  if (existsSync(full)) {
    rmSync(full, { recursive: true, force: true })
    dirsPruned++
  }
}
console.log(`Heavy image directories pruned: ${dirsPruned}`)
