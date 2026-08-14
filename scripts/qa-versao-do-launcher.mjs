// OS QUATRO ARQUIVOS DE VERSÃO DO LAUNCHER APONTAM PARA A MESMA VERSÃO?
//
// Por que este gate existe
// ────────────────────────
// O bump do launcher mexe em QUATRO arquivos, e o desalinhamento entre eles não
// dá erro em lugar nenhum — ele vira um defeito permanente na máquina do
// jogador:
//
//   • `Cargo.toml` desalinhado (aconteceu na 1.0.29): `check_launcher_update`
//     compara com `env!("CARGO_PKG_VERSION")`, então o binário publicado se
//     identifica como a versão ANTIGA enquanto o manifesto anuncia a nova. Todo
//     jogador atualiza, reabre na "mesma" versão e recomeça — para sempre.
//   • `launcher.json` esquecido (aconteceu na 1.0.24): o deploy aborta no meio,
//     DEPOIS de já ter enviado o binário.
//
// ⚠️ O `deploy-tudo.mjs` compara `launcher.json` com `package.json` e ignora o
// `Cargo.toml` — justamente o único que decide se o launcher se atualiza. E as
// guardas dele só rodam com `--publicar`, então um ensaio não pega nada disso.
//
//   node scripts/qa-versao-do-launcher.mjs

import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(".")

const ARQUIVOS = [
  { caminho: "Launcher/package.json", ler: (t) => JSON.parse(t).version },
  { caminho: "Launcher/src-tauri/tauri.conf.json", ler: (t) => JSON.parse(t).version },
  {
    caminho: "Launcher/src-tauri/Cargo.toml",
    // Só a PRIMEIRA `version` do arquivo — a do pacote. As das dependências
    // vêm depois e pegariam a do tauri em vez da do launcher.
    ler: (t) => /^\s*version\s*=\s*"([^"]+)"/m.exec(t)?.[1],
    nota: "é este que o binário usa para decidir se precisa se atualizar",
  },
  { caminho: "services/cloud-save-server/launcher.json", ler: (t) => JSON.parse(t).version },
]

const lidos = []
let ausentes = 0
for (const a of ARQUIVOS) {
  const alvo = path.join(RAIZ, a.caminho)
  if (!existsSync(alvo)) {
    console.error(` FALHA ${a.caminho} — arquivo não encontrado`)
    ausentes++
    continue
  }
  const versao = a.ler(readFileSync(alvo, "utf-8"))
  lidos.push({ ...a, versao })
  console.log(`  ${String(versao).padEnd(10)} ${a.caminho}${a.nota ? `   (${a.nota})` : ""}`)
}

const distintas = [...new Set(lidos.map((l) => l.versao))]
console.log("")

if (ausentes) {
  console.error(`${ausentes} arquivo(s) de versão do launcher não existe(m).`)
  process.exit(1)
}
if (distintas.length > 1) {
  console.error(`FALHA: os arquivos apontam para versões DIFERENTES: ${distintas.join(", ")}`)
  console.error("Publicar assim faz o launcher se anunciar numa versão e se identificar noutra —")
  console.error("o jogador atualiza, reabre na mesma versão e recomeça, indefinidamente.")
  process.exit(1)
}

console.log(`OK: os ${lidos.length} arquivos de versão do launcher dizem ${distintas[0]}.`)
