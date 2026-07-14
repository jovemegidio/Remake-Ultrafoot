// Recomprime a trilha do jogo para o instalador parar de pesar 1,7 GB.
//
// A pasta public/music tinha ~1,6 GB (89 mp3 + 259 webm) em bitrate alto — desnecessario
// para musica de fundo. Reencodamos tudo para MP3 128 kbps mono-compativel (estereo,
// 44.1 kHz), que e transparente o suficiente aqui e corta ~70-80% do tamanho.
//
// SEGURANCA: nunca sobrescreve as cegas.
//   1) encoda para um arquivo temporario;
//   2) VALIDA com ffprobe (tem stream de audio? duracao bate com a original?);
//   3) so substitui se ficou MENOR e a duracao confere (tolerancia 1s);
//   4) se algo falhar, mantem o original intacto.
//
// Uso:
//   node scripts/compress-music.mjs --dry     (so relatorio, nao altera nada)
//   node scripts/compress-music.mjs           (comprime de verdade)

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { readdir, stat, rename, unlink, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const exec = promisify(execFile)
const MUSIC_DIR = path.resolve("public/music")
// Opus 64k: para musica de FUNDO e transparente o bastante e rende ~4x menos bytes que
// o MP3 128k. Container .webm porque o player (Chromium/WebView2) ja toca webm/opus —
// metade da trilha ja era .webm. O -vn abaixo ainda descarta o VIDEO que os webm
// baixados do YouTube carregam junto (parte grande do peso).
const BITRATE = "64k"
const OUT_EXT = ".webm"
const DRY = process.argv.includes("--dry")

const AUDIO_EXT = new Set([".mp3", ".webm", ".m4a", ".ogg", ".wav", ".opus"])
const mb = (b) => (b / 1048576).toFixed(1)

/** Duracao em segundos (ou null se ffprobe nao conseguir ler). */
async function duration(file) {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ])
    const d = parseFloat(stdout.trim())
    return Number.isFinite(d) ? d : null
  } catch {
    return null
  }
}

/** Tem pelo menos um stream de audio? */
async function hasAudio(file) {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries", "stream=codec_type",
      "-of", "csv=p=0",
      file,
    ])
    return stdout.includes("audio")
  } catch {
    return false
  }
}

async function main() {
  let files
  try {
    files = (await readdir(MUSIC_DIR)).filter((f) => AUDIO_EXT.has(path.extname(f).toLowerCase()))
  } catch {
    console.error(`ERRO: nao achei ${MUSIC_DIR}`)
    process.exit(1)
  }

  console.log(`${files.length} faixas em public/music`)
  if (DRY) console.log("MODO DRY-RUN — nada sera alterado\n")

  let totalBefore = 0
  let totalAfter = 0
  let converted = 0
  let skipped = 0
  let failed = 0
  const problems = []

  for (const [i, name] of files.entries()) {
    const src = path.join(MUSIC_DIR, name)
    const before = (await stat(src)).size
    totalBefore += before

    // Alvo: sempre .webm/opus (unifica o formato e e o que menos pesa).
    const base = name.replace(/\.[^.]+$/, "")
    const target = path.join(MUSIC_DIR, `${base}${OUT_EXT}`)
    const tmp = path.join(MUSIC_DIR, `.tmp_${base}${OUT_EXT}`)

    const srcDur = await duration(src)
    if (srcDur == null) {
      problems.push(`${name}: ffprobe nao leu a original (pulada, intacta)`)
      failed++
      totalAfter += before
      continue
    }

    if (DRY) {
      // Estimativa: Opus 64kbps -> ~8 KB/s (so audio; o video e descartado)
      const est = srcDur * 8 * 1024
      totalAfter += Math.min(before, est)
      continue
    }

    try {
      await exec("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error",
        "-i", src,
        "-vn",                      // descarta capa/VIDEO (os webm do YouTube trazem video)
        "-c:a", "libopus",
        "-b:a", BITRATE,
        "-ac", "2",
        "-application", "audio",    // perfil p/ musica (nao voz)
        tmp,
      ], { maxBuffer: 1024 * 1024 * 16 })
    } catch (e) {
      problems.push(`${name}: ffmpeg falhou (mantida original)`)
      failed++
      totalAfter += before
      await unlink(tmp).catch(() => {})
      continue
    }

    // ── VALIDACAO: so troca se o resultado presta ────────────────────────────
    const okAudio = await hasAudio(tmp)
    const outDur = await duration(tmp)
    const after = (await stat(tmp)).size

    const durOk = outDur != null && Math.abs(outDur - srcDur) <= 1.0
    const smaller = after < before

    if (!okAudio || !durOk) {
      problems.push(
        `${name}: saida invalida (audio=${okAudio}, dur ${srcDur?.toFixed(1)}s -> ${outDur?.toFixed(1)}s) — original mantida`,
      )
      failed++
      totalAfter += before
      await unlink(tmp).catch(() => {})
      continue
    }

    if (!smaller) {
      // Ja estava leve: nao vale a pena trocar.
      skipped++
      totalAfter += before
      await unlink(tmp).catch(() => {})
      continue
    }

    // Substitui: remove a original (se a extensao mudou) e promove o temporario.
    if (path.resolve(src) !== path.resolve(target)) {
      await unlink(src).catch(() => {})
    }
    await rename(tmp, target)
    converted++
    totalAfter += after

    if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${files.length}`)
  }

  console.log("\n─────────────────────────────────────────")
  console.log(`Antes:      ${mb(totalBefore)} MB`)
  console.log(`Depois:     ${mb(totalAfter)} MB`)
  const saved = totalBefore - totalAfter
  console.log(`Economia:   ${mb(saved)} MB (${((saved / totalBefore) * 100).toFixed(1)}%)`)
  console.log(`Convertidas: ${converted} | ja leves: ${skipped} | falhas: ${failed}`)

  // ── tracks.json: os src apontam para .webm; apos converter, tem que virar .mp3 ──
  // Sem isso a trilha "some" (404) — o arquivo existe, mas com outra extensao.
  if (!DRY) {
    const tracksPath = path.join(MUSIC_DIR, "tracks.json")
    try {
      const tracks = JSON.parse(await readFile(tracksPath, "utf8"))
      let fixed = 0
      for (const t of tracks) {
        if (typeof t.src !== "string") continue
        const fileName = decodeURIComponent(t.src.replace(/^\/music\//, ""))
        const onDisk = path.join(MUSIC_DIR, fileName)
        if (existsSync(onDisk)) continue // ainda existe: nada a fazer

        // Foi convertida: mesmo nome-base, agora com a extensao de saida.
        const newName = fileName.replace(/\.[^.]+$/, OUT_EXT)
        if (existsSync(path.join(MUSIC_DIR, newName))) {
          t.src = `/music/${encodeURIComponent(newName)}`
          fixed++
        } else {
          problems.push(`tracks.json: "${fileName}" sumiu e nao achei o ${OUT_EXT}`)
        }
      }
      await writeFile(tracksPath, JSON.stringify(tracks, null, 4), "utf8")
      console.log(`\ntracks.json: ${fixed} src atualizados para .mp3`)
    } catch (e) {
      console.error(`\nERRO ao atualizar tracks.json: ${e.message}`)
      process.exitCode = 1
    }
  }

  if (problems.length) {
    console.log(`\nPROBLEMAS (${problems.length}):`)
    for (const p of problems.slice(0, 20)) console.log(`  - ${p}`)
    if (problems.length > 20) console.log(`  ... e mais ${problems.length - 20}`)
  }

  // Falha o processo se muita coisa quebrou (nao queremos build com trilha furada).
  if (failed > files.length * 0.1) {
    console.error("\nABORTADO: mais de 10% das faixas falharam.")
    process.exitCode = 1
  }
}

main()
