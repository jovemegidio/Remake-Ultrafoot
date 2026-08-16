/**
 * O QUE REALMENTE FOI EMPACOTADO — o gate do BUILD, não da árvore.
 *
 * `qa-nao-regride.mjs` audita o código-fonte. Só que o jogador não instala
 * código-fonte: instala o export estático dentro do .exe. Já aconteceu de a
 * árvore estar certa e o build sair de outra pasta — foi assim que a 1.0.332
 * chegou ao jogador sem a Divisão de Acesso.
 *
 * Este script procura, DENTRO do `out/` que virou instalador, marcas que só
 * existem se a funcionalidade tiver sido compilada junto.
 *
 * ⚠️ As marcas são escolhidas para SOBREVIVER à minificação: texto que aparece
 * na tela ou id de dado. Nome de função e de constante são renomeados pelo
 * empacotador e dariam falso negativo. Acento também não serve: o minificador
 * escapa parte deles (á), então as marcas aqui são ASCII ou fragmentos que
 * param antes do acento.
 *
 *   node scripts/qa-build-entregue.mjs [caminho-da-arvore]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const RAIZ = process.argv[2] || process.cwd()
const OUT = path.join(RAIZ, "out")

if (!existsSync(OUT)) {
  console.log(`sem export em ${OUT} — rode o build antes.`)
  process.exit(1)
}

/** [versão, funcionalidade, marca que sobrevive à minificação] */
const MARCAS = [
  ["1.0.318", "Divisão de Acesso", "divisao_acesso_br"],
  ["1.0.322", "Futebol feminino", "__fem"],
  ["1.0.322", "Sub-20", "Sub-20"],
  ["1.0.326", "Carreira de jogador (empresário)", "Trocar de empres"],
  ["1.0.327", "Modos online", "Manager Rivals"],
  ["1.0.333", "VAR", "pendingVar"],
]

/** Varre todo arquivo de texto do export uma vez só — são milhares de chunks. */
function textos(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome)
    const st = statSync(p)
    if (st.isDirectory()) { textos(p, acc); continue }
    if (!/\.(js|txt|html|json)$/.test(nome)) continue
    if (st.size > 40 * 1024 * 1024) continue
    acc.push(p)
  }
  return acc
}

const arquivos = textos(OUT)
const achados = new Map(MARCAS.map(([, , marca]) => [marca, 0]))
for (const p of arquivos) {
  let src
  try { src = readFileSync(p, "utf8") } catch { continue }
  for (const marca of achados.keys()) if (src.includes(marca)) achados.set(marca, achados.get(marca) + 1)
}

let versao = "?"
try { versao = JSON.parse(readFileSync(path.join(RAIZ, "package.json"), "utf8")).version } catch { /* sem package */ }

console.log(`export: ${OUT}`)
console.log(`versão declarada: ${versao}`)
console.log(`arquivos varridos: ${arquivos.length}\n`)

let falhas = 0
for (const [v, nome, marca] of MARCAS) {
  const n = achados.get(marca)
  console.log(`${n ? "OK   " : "FALTA"} [${v}] ${nome} — "${marca}" em ${n} arquivo(s)`)
  if (!n) falhas++
}

console.log(falhas === 0
  ? "\nBUILD COMPLETA — tudo que foi entregue está dentro do pacote."
  : `\n${falhas} funcionalidade(s) NÃO estão no pacote. Este instalador não pode ser publicado.`)
process.exit(falhas === 0 ? 0 : 1)
