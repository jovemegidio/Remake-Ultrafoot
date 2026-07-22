// Prova que o codigo emitido pelo script e aceito pelo jogo.
// As duas implementacoes sao separadas (Node x Web Crypto); um bit de diferenca
// entregaria codigos que o comprador nao consegue usar.
import { readFileSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { montarCodigo, validarCodigo, normalizarCodigo } from "../lib/license"

const segredo = readFileSync(path.join(os.homedir(), ".ultrafoot-keys", "ultrafoot-license.secret"), "utf8").trim()
let falhas = 0
const checar = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log("  FALHOU:", msg) } else console.log("  ok:", msg) }

const rodar = async () => {
  const codigo = await montarCodigo(1001, 1, segredo)
  console.log("codigo de teste:", codigo)
  checar(/^UF26-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(codigo), "formato UF26-XXXXX-XXXXX-XXXXX")

  const bom = await validarCodigo(codigo, [], segredo)
  checar(bom.valido, "codigo emitido e aceito")
  checar(bom.serie === 1001 && bom.lote === 1, `serie e lote voltam certos (${bom.serie}/${bom.lote})`)

  // Uma letra trocada tem de cair.
  const trocado = codigo.slice(0, -1) + (codigo.endsWith("Z") ? "Y" : "Z")
  checar(!(await validarCodigo(trocado, [], segredo)).valido, "codigo com um caractere trocado e recusado")

  checar(!(await validarCodigo("UF26-AAAAA-AAAAA-AAAAA", [], segredo)).valido, "codigo inventado e recusado")
  checar(!(await validarCodigo("ULTRA-FOOT-2026-AAAA", [], segredo)).valido, "o formato antigo (que aceitava qualquer coisa) nao passa mais")

  const revog = await validarCodigo(codigo, [1001], segredo)
  checar(!revog.valido && revog.motivo === "revogado", "codigo revogado e recusado, com motivo")

  // Digitacao real: minusculas, espacos e as letras confundiveis.
  const digitado = codigo.toLowerCase().replace(/-/g, " - ")
  checar((await validarCodigo(digitado, [], segredo)).valido, "aceita minusculas e espacos")
  checar(normalizarCodigo("uf26-oo1ij") === "UF26-001" + "1J", "O vira 0 e I/L viram 1, sem estragar o prefixo")

  const semSegredo = await validarCodigo(codigo, [], "")
  checar(!semSegredo.valido && semSegredo.motivo === "sem-segredo", "build sem segredo nao valida nada")

  // Series diferentes -> codigos diferentes.
  const outros = await Promise.all([1002, 1003, 2000, 16777215].map(s => montarCodigo(s, 1, segredo)))
  checar(new Set([codigo, ...outros]).size === 5, "series diferentes geram codigos diferentes")
  const extremo = await validarCodigo(outros[3], [], segredo)
  checar(extremo.valido && extremo.serie === 16777215, "serie no limite (16.777.215) funciona")

  console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`)
  process.exit(falhas === 0 ? 0 : 1)
}
void rodar()
