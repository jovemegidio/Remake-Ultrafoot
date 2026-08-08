// Restaura no build os UNIFORMES (kits) que o usuario importou no editor e que sumiram
// (foram removidos quando o save foi de-inchado; o backup ficou em team-overrides-export.json).
//
// Le o export, COMPRIME cada camisa (sharp, 400px) e funde no seed data/seeds/team-overrides.json
// (campo kits.<variant>.imageUrl), PRESERVANDO os escudos (logoUrl) ja embutidos. Assim os
// uniformes voltam E passam a viajar no build para todos os jogadores, sem inchar.
//
// ⚠️ CONSERTO DE 07/08/2026 — ESTE SCRIPT LIA UM ARQUIVO CONGELADO.
//
// Relato: "o escudo e uniformes do Barcelona persistiram, mas os das ligas
// italianas e francesas nao". A causa era a FONTE, nao o clube:
//
//   bake-user-logos (escudos)   -> ultrafoot-clubs.json   = o save VIVO
//   bake-user-kits  (uniformes) -> team-overrides-export.json = export PARADO
//
// O export foi gravado uma vez, em 14/07/2026, com 37 clubes — e o Barcelona
// esta entre eles. Todo uniforme importado DEPOIS daquele dia nunca entrava no
// build e sumia na atualizacao seguinte. Medido: 84 uniformes no save vivo,
// so 71 no seed, 34 dos do usuario de fora (brest, nancy_lorraine,
// sochaux_montbeliard, southampton e 30 selecoes). Escudos: 380 -> 380, zero
// perdidos — a prova de que o problema era a fonte.
//
// ⚠️ E NAO BASTA TROCAR UMA FONTE PELA OUTRA: o Barcelona so existe no export
// antigo (nao esta no save vivo). Trocar cegamente APAGARIA os kits dele. Por
// isso aqui e UNIAO das duas camadas, com o save vivo vencendo em empate.
//
// Uso: node scripts/bake-user-kits.mjs ["<caminho export.json>"]

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import sharp from "sharp"

const APPDIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "com.ultrafoot.remake",
)
/** Export legado: fonte unica ate 07/08/2026; hoje serve so de piso historico. */
const EXPORT = process.argv[2] || path.join(APPDIR, "team-overrides-export.json")
/** Save VIVO do editor — os kits ficam nas chaves `ultrafoot:team-override:*`. */
const SAVE = path.join(APPDIR, "ultrafoot-clubs.json")
const SEED = path.resolve("data/seeds/team-overrides.json")

const PREFIXO_KIT = "ultrafoot:team-override:"

async function lerJson(p) {
  try { return JSON.parse(await readFile(p, "utf8")) } catch { return null }
}

/**
 * Junta o export legado com o save vivo. O vivo vence: se o mesmo clube existe
 * nos dois, vale o que o jogador tem agora na maquina dele.
 */
async function coletarOverrides() {
  const legado = (await lerJson(EXPORT)) ?? {}
  const save = (await lerJson(SAVE)) ?? {}

  // ⚠️ NO SAVE VIVO O VALOR E UMA STRING JSON, nao um objeto.
  //
  // O persistent-store guarda `storeSet(chave, JSON.stringify(x))`, entao
  // `save[chave]` volta como texto. Sem este parse, `ovr?.kits` e sempre
  // undefined e o laco de baixo PULA todas as edicoes vivas em silencio —
  // exatamente o tipo de falha muda que fez os uniformes sumirem. O export
  // legado, esse, ja vem desserializado.
  const vivo = {}
  for (const [chave, valor] of Object.entries(save)) {
    if (!chave.startsWith(PREFIXO_KIT)) continue
    let ovr = valor
    if (typeof ovr === "string") {
      try { ovr = JSON.parse(ovr) } catch { continue }
    }
    if (ovr && typeof ovr === "object") vivo[chave.slice(PREFIXO_KIT.length)] = ovr
  }

  const soNoLegado = Object.keys(legado).filter(k => !(k in vivo)).length
  console.log(
    `fontes: ${Object.keys(vivo).length} do save vivo + ${soNoLegado} so no export legado`
    + ` (${Object.keys(legado).length} no export)`,
  )
  return { ...legado, ...vivo }
}

const kb = (n) => (n / 1024).toFixed(0) + " KB"

async function compress(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return { url: dataUrl, before: 0, after: 0 }
  if (dataUrl.startsWith("data:image/svg")) return { url: dataUrl, before: 0, after: 0 }
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
  const buf = Buffer.from(b64, "base64")
  try {
    const out = await sharp(buf).resize(400, 400, { fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
    const final = out.length < buf.length ? out : buf
    return { url: `data:image/png;base64,${final.toString("base64")}`, before: buf.length, after: final.length }
  } catch {
    return { url: dataUrl, before: buf.length, after: buf.length }
  }
}

async function main() {
  const exp = await coletarOverrides()
  const seed = JSON.parse(await readFile(SEED, "utf8").catch(() => "{}"))

  let clubs = 0, kits = 0, before = 0, after = 0
  for (const [fileKey, ovr] of Object.entries(exp)) {
    if (!ovr?.kits) continue
    const outKits = { ...(seed[fileKey]?.kits ?? {}) }
    for (const [variant, kit] of Object.entries(ovr.kits)) {
      if (!kit) continue
      let imageUrl = kit.imageUrl
      if (imageUrl) {
        const r = await compress(imageUrl)
        imageUrl = r.url; before += r.before; after += r.after; kits++
      }
      outKits[variant] = { ...(seed[fileKey]?.kits?.[variant] ?? {}), ...kit, ...(imageUrl ? { imageUrl } : {}) }
    }
    seed[fileKey] = { ...(seed[fileKey] ?? {}), kits: outKits }
    clubs++
  }

  await writeFile(SEED, JSON.stringify(seed, null, 2), "utf8")
  console.log(`clubes com kit restaurados: ${clubs} | imagens: ${kits}`)
  console.log(`tamanho antes: ${kb(before)} -> depois: ${kb(after)} (${before ? Math.round((1 - after / before) * 100) : 0}% menor)`)
  console.log(`total de clubes no seed: ${Object.keys(seed).length}`)
}

main()
