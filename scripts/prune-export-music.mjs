import { existsSync, readdirSync, rmSync } from "node:fs"
import path from "node:path"

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
