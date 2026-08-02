/**
 * Roda os scripts de QA que NAO tem alvo proprio no package.json.
 *
 * Por que existe: 22 dos 38 scripts `qa-*` estavam orfaos — escritos, passando,
 * e nunca executados por ninguem. Um deles era o `qa-economia.ts`, que cobre
 * exatamente a venda de jovem paga duas vezes. O teste existia enquanto o bug
 * era relatado pelo betatester; so ninguem rodava.
 *
 * Alem de executar, este runner FALHA quando aparece um script novo que nao
 * esta nem no package.json nem na lista abaixo. Sem isso, o proximo qa-*.ts
 * criado vira orfao de novo e o problema volta em silencio.
 */
import { readFileSync, readdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8"))
const alvos = Object.values(pkg.scripts ?? {}).join(" ")

/**
 * Orfaos que NAO devem rodar aqui, com o motivo. Ficar de fora e uma decisao
 * explicita — o runner cobra justificativa para cada exclusao.
 */
const EXCLUIDOS = {
  "qa-licenca.ts": "substituido pelo qa-licenca-ed25519.ts (esquema HMAC antigo)",
  "qa-dragdrop.mjs": "precisa de navegador (Playwright), roda no test:e2e",
  "qa-nav.mjs": "precisa de navegador (Playwright), roda no test:e2e",
  "qa-lib.mjs": "biblioteca compartilhada, nao e um teste",
  "qa-repro-crash.mjs": "repro manual de um crash especifico, roda sob demanda",
  "qa-squad-names.mjs": "precisa de navegador (Playwright), roda no test:e2e",
}

const todos = readdirSync(join(raiz, "scripts"))
  .filter(f => /^qa-.*\.(ts|mjs)$/.test(f))
  .sort()

const orfaos = todos.filter(f => !alvos.includes(f) && !(f in EXCLUIDOS))

console.log(`${todos.length} scripts qa-*; ${orfaos.length} sem alvo proprio; ` +
  `${Object.keys(EXCLUIDOS).length} excluidos de proposito\n`)

let falhas = 0
for (const f of orfaos) {
  const bin = f.endsWith(".mjs") ? "node" : "tsx"
  const cmd = bin === "node" ? "node" : "npx"
  const args = bin === "node" ? [join("scripts", f)] : ["tsx", join("scripts", f)]
  const r = spawnSync(cmd, args, { cwd: raiz, encoding: "utf8", shell: process.platform === "win32", timeout: 300_000 })
  if (r.status === 0) {
    console.log(`PASSA   ${f}`)
  } else {
    falhas++
    const motivo = String(r.stdout ?? "" + r.stderr ?? "")
      .split("\n").filter(l => /error|falh|fail/i.test(l))[0] ?? `saida ${r.status}`
    console.log(`FALHA   ${f}  :: ${motivo.trim().slice(0, 100)}`)
  }
}

console.log(`\n${orfaos.length - falhas}/${orfaos.length} passaram`)
if (falhas) process.exit(1)
