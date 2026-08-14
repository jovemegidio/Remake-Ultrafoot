// TODO INSTALADOR EMPACOTADO TEM O .sig DO UPDATER?
//
// O modo de falha é silencioso e caro: `tauri build` grava o `.exe` e SÓ ENTÃO
// reclama da chave ausente. Quem olha a pasta vê o instalador lá e conclui que
// deu certo. Publicado assim, o auto-updater recusa o pacote e o jogador fica
// presto na versão antiga sem entender por quê — foi o que aconteceu com os
// instaladores 1.0.292 e 1.0.293 na primeira tentativa.
//
//   node scripts/qa-instalador-assinado.mjs
//
// Roda sobre o que existir em src-tauri/target/release/bundle/nsis.

import { readdir, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const PASTA = "src-tauri/target/release/bundle/nsis"

if (!existsSync(PASTA)) {
  console.log(`nenhum bundle em ${PASTA} — nada a conferir`)
  process.exit(0)
}

const arquivos = (await readdir(PASTA)).filter(n => n.endsWith("-setup.exe"))
if (!arquivos.length) {
  console.log("nenhum instalador empacotado — nada a conferir")
  process.exit(0)
}

let semAssinatura = 0
for (const nome of arquivos) {
  const exe = path.join(PASTA, nome)
  const sig = `${exe}.sig`
  const tamanho = (await stat(exe)).size
  if (existsSync(sig)) {
    console.log(`  ok   ${nome} (${(tamanho / 1048576).toFixed(0)} MB) — assinado`)
  } else {
    semAssinatura++
    console.error(` FALHA ${nome} (${(tamanho / 1048576).toFixed(0)} MB) — SEM .sig`)
  }
}

if (semAssinatura) {
  console.error("")
  console.error(`${semAssinatura} instalador(es) sem assinatura do updater.`)
  console.error("Reempacote com: node scripts/empacotar-assinado.mjs")
  process.exit(1)
}
console.log(`\nOK: ${arquivos.length} instalador(es), todos com .sig`)
