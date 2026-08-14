import { readdir, stat } from "node:fs/promises"
import path from "node:path"

const LIMITE = 10 * 1024 ** 3
const raiz = path.resolve(process.argv[2] ?? "public")

async function medir(pasta) {
  let bytes = 0
  let arquivos = 0
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    const alvo = path.join(pasta, item.name)
    if (item.isDirectory()) {
      const filho = await medir(alvo)
      bytes += filho.bytes
      arquivos += filho.arquivos
    } else if (item.isFile()) {
      bytes += (await stat(alvo)).size
      arquivos++
    }
  }
  return { bytes, arquivos }
}

const total = await medir(raiz)
const gb = total.bytes / 1024 ** 3
console.log(`tamanho auditado: ${gb.toFixed(2)} GB em ${total.arquivos.toLocaleString("pt-BR")} arquivos (${raiz})`)
console.log(`limite: 10.00 GB | margem: ${((LIMITE - total.bytes) / 1024 ** 3).toFixed(2)} GB`)
if (total.bytes > LIMITE) {
  console.error("ERRO: o conteúdo ultrapassa o limite de instalação de 10 GB")
  process.exit(1)
}
