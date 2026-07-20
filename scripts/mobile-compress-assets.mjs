/**
 * Compressao de assets para o alvo mobile.
 *
 * Converte PNG/JPG -> WebP e WAV -> Opus, medindo o ganho real antes de aplicar.
 *
 * IMPORTANTE: converter TROCA a extensao, o que quebra qualquer referencia crua
 * a "/pasta/arquivo.png" no codigo. Por isso o modo padrao e DRY-RUN: ele mede o
 * ganho e lista as referencias que precisariam ser ajustadas, sem tocar em nada.
 *
 *   node scripts/mobile-compress-assets.mjs images          # so mede
 *   node scripts/mobile-compress-assets.mjs images --apply  # converte
 *
 * Com --apply os originais vao para .assets-backup/<pasta>/ antes da conversao.
 * Requer ffmpeg no PATH.
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs"
import path from "node:path"

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg"])
const AUDIO_EXT = new Set([".wav"])

// Pastas que JA estao otimizadas — converter nao compensa e so gera churn.
// Medido em 2026-07-20: jogadores rende 3,4% (JPG a 14 KB), kits-imported ja e WebP.
const SKIP = new Set(["jogadores", "kits-imported"])

const WEBP_QUALITY = 82
const WEBP_EFFORT = 6
const OPUS_BITRATE = "96k"

const folder = process.argv[2]
const apply = process.argv.includes("--apply")

if (!folder) {
  console.error("uso: node scripts/mobile-compress-assets.mjs <pasta-em-public> [--apply]")
  process.exit(1)
}
if (SKIP.has(folder)) {
  console.log(`"${folder}" ja esta otimizada — nada a fazer.`)
  process.exit(0)
}

const srcDir = path.resolve("public", folder)
if (!existsSync(srcDir)) {
  console.error(`pasta nao encontrada: ${srcDir}`)
  process.exit(1)
}

function ffmpegOk() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

if (!ffmpegOk()) {
  console.error("ffmpeg nao encontrado no PATH.")
  process.exit(1)
}

/** Lista recursiva de arquivos convertiveis. */
function collect(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collect(full))
      continue
    }
    const ext = path.extname(entry.name).toLowerCase()
    if (IMAGE_EXT.has(ext) || AUDIO_EXT.has(ext)) out.push(full)
  }
  return out
}

function convert(input, output) {
  const isAudio = AUDIO_EXT.has(path.extname(input).toLowerCase())
  const args = isAudio
    ? ["-y", "-loglevel", "error", "-i", input, "-c:a", "libopus", "-b:a", OPUS_BITRATE, output]
    : [
        "-y", "-loglevel", "error", "-i", input,
        "-c:v", "libwebp", "-quality", String(WEBP_QUALITY),
        "-compression_level", String(WEBP_EFFORT), output,
      ]
  execFileSync("ffmpeg", args, { stdio: "ignore" })
}

function targetPath(file) {
  const ext = AUDIO_EXT.has(path.extname(file).toLowerCase()) ? ".opus" : ".webp"
  return path.join(path.dirname(file), path.basename(file, path.extname(file)) + ext)
}

const files = collect(srcDir)
if (files.length === 0) {
  console.log(`nenhum arquivo convertivel em public/${folder}`)
  process.exit(0)
}

const backupDir = path.resolve(".assets-backup", folder)
if (apply) mkdirSync(backupDir, { recursive: true })

let before = 0
let after = 0
let done = 0
const failed = []

// Sem --apply, mede numa amostra: converter milhares de arquivos so para estimar
// levaria minutos sem necessidade.
const sample = apply ? files : files.slice(0, Math.min(15, files.length))
const tmpDir = path.resolve(".assets-backup", ".probe")
if (!apply) mkdirSync(tmpDir, { recursive: true })

for (const file of sample) {
  const originalSize = statSync(file).size
  const out = apply ? targetPath(file) : path.join(tmpDir, path.basename(targetPath(file)))
  try {
    convert(file, out)
    before += originalSize
    after += statSync(out).size
    done++
    if (apply) {
      // Original preservado antes de sair de public/ — a conversao e com perdas.
      renameSync(file, path.join(backupDir, path.basename(file)))
    }
  } catch (err) {
    failed.push({ file: path.relative(srcDir, file), reason: err.message.split("\n")[0] })
  }
}

const ratio = before > 0 ? after / before : 1
const totalBytes = files.reduce((sum, f) => sum + statSync(f).size, 0)

console.log(`\npasta        : public/${folder}`)
console.log(`arquivos     : ${files.length}`)
console.log(`modo         : ${apply ? "APLICADO" : "DRY-RUN (amostra de " + sample.length + ")"}`)
console.log(`convertidos  : ${done}`)
if (failed.length) console.log(`falhas       : ${failed.length}`)
console.log(`reducao      : ${((1 - ratio) * 100).toFixed(1)}%`)

if (apply) {
  console.log(`antes        : ${(before / 1048576).toFixed(1)} MB`)
  console.log(`depois       : ${(after / 1048576).toFixed(1)} MB`)
  console.log(`originais em : ${path.relative(process.cwd(), backupDir)}`)
  console.log(`\nAJUSTE AS REFERENCIAS: as extensoes mudaram. Verifique`)
  console.log(`lib/game-asset.ts, lib/escudos-map.ts, lib/player-photos.ts`)
  console.log(`e os .json de manifesto dentro de public/${folder}.`)
} else {
  console.log(`atual        : ${(totalBytes / 1048576).toFixed(1)} MB`)
  console.log(`projecao     : ${((totalBytes * ratio) / 1048576).toFixed(1)} MB`)
  console.log(`economia     : ${((totalBytes * (1 - ratio)) / 1048576).toFixed(1)} MB`)
  console.log(`\nrode com --apply para converter.`)
}

if (failed.length) {
  console.log("\nfalhas:")
  for (const f of failed.slice(0, 10)) console.log(`  ${f.file}: ${f.reason}`)
}
