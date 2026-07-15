// Resgata um save inchado por imagens base64 dos escudos/uniformes importados.
//
// O editor de clubes guardava cada imagem importada como data:URL base64 DENTRO do save
// (persistent-store). Com dezenas de imagens, o save chegou a 124 MB — e o jogo parseia
// esse JSON a cada carregamento de pagina, travando o WebView2 ("This page couldn't
// load").
//
// Este script:
//   1) faz backup do save;
//   2) SEPARA as chaves de team-override (as pesadas) do resto (o progresso do jogo);
//   3) reescreve o save SO com o progresso -> o jogo volta a carregar;
//   4) exporta os overrides para team-overrides-export.json (formato do
//      merge-team-overrides.mjs) -> as imagens sao preservadas e podem ser EMBUTIDAS no
//      build, o que tambem faz elas aparecerem para os outros jogadores.
//
// Uso: node scripts/rescue-bloated-save.mjs "<caminho-do-ultrafoot-clubs.json>"

import { readFile, writeFile, copyFile } from "node:fs/promises"
import path from "node:path"

const SAVE = process.argv[2]
if (!SAVE) {
  console.error('Uso: node scripts/rescue-bloated-save.mjs "<caminho ultrafoot-clubs.json>"')
  process.exit(1)
}

const mb = (b) => (b / 1048576).toFixed(1)

async function main() {
  const raw = await readFile(SAVE, "utf8")
  console.log(`save atual: ${mb(Buffer.byteLength(raw))} MB`)

  const store = JSON.parse(raw)
  const backup = `${SAVE}.bloated-backup`
  await copyFile(SAVE, backup)
  console.log(`backup completo: ${backup}`)

  // Chaves de override (pesadas) vs resto (progresso do jogo).
  const OVERRIDE_PREFIX = "ultrafoot:team-override:"
  const overrides = {}
  const kept = {}
  for (const [key, value] of Object.entries(store)) {
    if (key.startsWith(OVERRIDE_PREFIX)) {
      const fileKey = key.slice(OVERRIDE_PREFIX.length)
      // O valor e uma string JSON (o store guarda strings); reparse para o export.
      try { overrides[fileKey] = typeof value === "string" ? JSON.parse(value) : value }
      catch { overrides[fileKey] = value }
    } else {
      kept[key] = value
    }
  }

  const overrideCount = Object.keys(overrides).length
  console.log(`\ntime-overrides encontrados: ${overrideCount}`)

  // 1) Save enxuto (so o progresso) — e o que faz o jogo voltar.
  const slim = JSON.stringify(kept)
  await writeFile(SAVE, slim, "utf8")
  console.log(`save reescrito: ${mb(Buffer.byteLength(slim))} MB (era ${mb(Buffer.byteLength(raw))} MB)`)

  // 2) Export das edicoes para embutir no build (merge-team-overrides.mjs).
  const exportPath = path.join(path.dirname(SAVE), "team-overrides-export.json")
  const exportJson = JSON.stringify(overrides, null, 0)
  await writeFile(exportPath, exportJson, "utf8")
  console.log(`edicoes exportadas: ${exportPath} (${mb(Buffer.byteLength(exportJson))} MB)`)

  console.log(`\nOK — o jogo deve voltar a carregar (save enxuto).`)
  console.log(`As imagens estao preservadas no export; para embuti-las no build e faze-las`)
  console.log(`aparecer para todos: node scripts/merge-team-overrides.mjs "${exportPath}"`)
}

main().catch((e) => { console.error("ERRO:", e.message); process.exit(1) })
