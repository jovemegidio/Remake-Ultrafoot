// EMPACOTA O INSTALADOR **COM** A ASSINATURA DO UPDATER.
//
// O que este script conserta
// ──────────────────────────
// `npx tauri build` (e `npm run tauri:build`) produzem o instalador e, se
// `TAURI_SIGNING_PRIVATE_KEY` não estiver no ambiente, terminam assim:
//
//     A public key has been found, but no private key.
//     Error A public key has been found, but no private key.
//
// O `.exe` FICA PRONTO. Só o `.sig` não existe — e sem ele o auto-updater
// rejeita o pacote. Constatado em 11/08/2026: os instaladores 1.0.292 e 1.0.293
// saíram sem `.sig`, e nada no repositório carregava a chave em build local.
// A esteira do GitHub injeta o segredo (`.github/workflows/release.yml`), mas a
// build de publicação é LOCAL — o CI não tem o save dos escudos
// ([[ultrafoot-pipeline-de-publicacao]]). Ou seja: o caminho que de fato publica
// era justamente o que não assinava.
//
// Uso:
//   node scripts/empacotar-assinado.mjs            # empacota e assina
//   node scripts/empacotar-assinado.mjs --no-bundle
//
// A chave mora em ~/.ultrafoot-keys/ultrafoot-updater.key (gerada sem senha).

import { spawnSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const CHAVE = path.join(os.homedir(), ".ultrafoot-keys", "ultrafoot-updater.key")

if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  if (!existsSync(CHAVE)) {
    // Falhar AQUI, e não no fim de uma hora de build. Sem a chave o pacote sai
    // inútil para o auto-updater, e o erro do Tauri aparece depois do NSIS —
    // quando já se gastou o tempo todo.
    console.error(`FALHA: chave do updater não encontrada em ${CHAVE}`)
    console.error("Sem ela o instalador sai sem .sig e o auto-updater recusa o pacote.")
    process.exit(1)
  }
  process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(CHAVE, "utf-8").trim()
  process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= ""
  console.log(`chave do updater carregada de ${CHAVE}`)
} else {
  console.log("usando TAURI_SIGNING_PRIVATE_KEY já presente no ambiente")
}

const extras = process.argv.slice(2)
const r = spawnSync("npx", ["tauri", "build", ...extras], {
  stdio: "inherit",
  shell: true,
  env: process.env,
})
process.exit(r.status ?? 1)
