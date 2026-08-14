import { spawnSync } from "node:child_process"
import { copyFileSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * BUILD PARA LOJA (Steam, Epic, GOG).
 *
 * Diferente da build normal em três pontos, e cada um deles é motivo de
 * reprovação na revisão da loja se ficar como está:
 *
 *  1. SEM AUTO-UPDATER. Quem distribui atualização na loja é a plataforma, pelos
 *     depots dela. Um jogo que baixa versão nova por fora quebra a verificação
 *     de integridade. Aqui o plugin sai do tauri.conf.json E a interface some,
 *     via NEXT_PUBLIC_ULTRAFOOT_LOJA=1 (ver lib/updater.ts) — tirar só um dos
 *     dois deixaria metade do caminho ligada.
 *
 *  2. SEM INSTALADOR. A loja sobe um DIRETÓRIO já instalado, não um .exe de
 *     setup. Por isso `--no-bundle`: o NSIS e o WiX não servem de nada aqui.
 *
 *  3. O tauri.conf.json é restaurado no `finally`, SEMPRE. Sem isso uma build
 *     de loja interrompida deixaria o repositório sem o updater e a próxima
 *     build normal sairia incapaz de se atualizar — falha silenciosa, do tipo
 *     que só aparece semanas depois no computador do jogador.
 *
 * Uso:  node scripts/build-loja.mjs
 * Saída: src-tauri/target/release/ (o .exe e os resources para subir no depot)
 */

const CONF = resolve("src-tauri/tauri.conf.json")
const BACKUP = resolve("src-tauri/tauri.conf.json.antes-da-loja")

function rodar(comando, argumentos, env) {
  const r = spawnSync(comando, argumentos, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  })
  if (r.status !== 0) throw new Error(`${comando} ${argumentos.join(" ")} falhou (${r.status})`)
}

const original = readFileSync(CONF, "utf8")
copyFileSync(CONF, BACKUP)

try {
  const conf = JSON.parse(original)

  if (conf.plugins?.updater) {
    delete conf.plugins.updater
    console.log("[loja] plugin updater removido do tauri.conf.json")
  } else {
    console.log("[loja] tauri.conf.json já não declarava o updater")
  }

  // A loja identifica o produto pelo appid dela; manter um identifier separado
  // evita que a build de loja e a build própria disputem o mesmo registro de
  // aplicativo (e o mesmo diretório de dados) na mesma máquina.
  conf.identifier = `${conf.identifier}.loja`

  writeFileSync(CONF, `${JSON.stringify(conf, null, 2)}\n`)

  rodar("npx", ["tauri", "build", "--no-bundle"], {
    NEXT_PUBLIC_ULTRAFOOT_LOJA: "1",
  })

  console.log("\n[loja] pronto. Suba o conteúdo de src-tauri/target/release/ como depot.")
  console.log("[loja] confira antes: o jogo abre sem o Launcher e sem rede, e não oferece atualização.")
} finally {
  writeFileSync(CONF, original)
  rmSync(BACKUP, { force: true })
  console.log("[loja] tauri.conf.json restaurado")
}
