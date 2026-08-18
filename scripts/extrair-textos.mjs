// EXTRAI TEXTO CHUMBADO PARA CHAVES DE TRADUÇÃO.
//
// ⚠️ POR QUE ISTO É UMA FERRAMENTA E NÃO UM MUTIRÃO. São 4.341 frases em 189
// arquivos (medido por `qa-traducao.mjs`). Feito à mão, o trabalho é longo o
// bastante para nunca terminar e arriscado o bastante para quebrar telas no
// caminho. Feito por uma ferramenta que só mexe no que sabe mexer, vira
// mecânico — e o que ela não sabe fica visível, em vez de virar defeito.
//
// ⚠️ O QUE ELA SE RECUSA A FAZER, DE PROPÓSITO:
//
//   · não cria o `const t = useTranslation()`. Um arquivo com três componentes
//     tem três lugares possíveis e escolher errado quebra a tela em runtime,
//     não na compilação. Ela só processa arquivos que JÁ têm o gancho.
//   · não toca em template literal, expressão ou string dentro de lógica. Só
//     texto de JSX e um punhado de props que são texto de tela por definição.
//   · não traduz. Ela cria a chave com o texto EM PORTUGUÊS; os outros idiomas
//     caem no português até alguém traduzir (ver lib/i18n/index.ts).
//
// Uso:
//   node scripts/extrair-textos.mjs <arquivo> <namespace> [--aplicar]
//
//   node scripts/extrair-textos.mjs app/configuracoes/page.tsx configuracoes
//   node scripts/extrair-textos.mjs app/configuracoes/page.tsx configuracoes --aplicar

import { readFileSync, writeFileSync } from "node:fs"

const [arquivo, namespace] = process.argv.slice(2).filter(a => !a.startsWith("--"))
const aplicar = process.argv.includes("--aplicar")

if (!arquivo || !namespace) {
  console.error("uso: node scripts/extrair-textos.mjs <arquivo> <namespace> [--aplicar]")
  process.exit(1)
}

const PT = "lib/i18n/translations/pt-BR.ts"
let codigo = readFileSync(arquivo, "utf-8")

if (!/const t = useTranslation\(\)/.test(codigo)) {
  console.error(`${arquivo} nao tem \`const t = useTranslation()\`.`)
  console.error("Acrescente o gancho a mao no componente certo e rode de novo — esta ferramenta")
  console.error("nao escolhe componente por voce.")
  process.exit(1)
}

/**
 * ⚠️ TER O GANCHO NAO BASTA: ELE PRECISA ESTAR NO MESMO COMPONENTE.
 *
 * Cinco telas passaram na primeira rodada e falharam no type-check com
 * "Cannot find name 't'" — arquivos com VARIOS componentes, onde o gancho mora
 * num e o texto extraido estava noutro. O erro aparece na compilacao, entao
 * nada foi para o ar; mas revertar cinco arquivos e refazer custou a rodada.
 *
 * Contar componentes e uma aproximacao honesta: mais de um `function X(` que
 * devolve JSX significa que a ferramenta nao sabe onde `t` alcanca. Nesse caso
 * ela PARA e diz o que fazer, em vez de escrever e torcer.
 */
const componentes = (codigo.match(/^(export )?(default )?function [A-Z]\w*/gm) ?? []).length
  + (codigo.match(/^const [A-Z]\w* = \(/gm) ?? []).length
const ganchos = (codigo.match(/const t = useTranslation\(\)/g) ?? []).length

if (componentes > ganchos && !process.argv.includes("--forcar")) {
  console.error(`${arquivo}: ${componentes} componente(s) e apenas ${ganchos} gancho(s) de traducao.`)
  console.error("A ferramenta nao sabe em qual deles `t` alcanca, e escrever no errado da")
  console.error('"Cannot find name \'t\'" no type-check. Acrescente o gancho nos componentes que')
  console.error("tem texto, ou rode com --forcar e confira o type-check em seguida.")
  process.exit(2)
}

/** Props cujo valor é, por definição, texto que o jogador lê. */
const PROPS_DE_TEXTO = ["title", "placeholder", "aria-label", "alt", "label", "actionLabel"]

/** Palavra com acento OU frase com espaço: o que separa texto de identificador. */
const EhTextoHumano = v =>
  /[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(v) || (/\s/.test(v.trim()) && /[a-záéíóúâêôãõç]{3}/i.test(v))

const chaves = new Map()   // chave -> texto
const usadas = new Set()

function chaveDe(texto) {
  let base = texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .split("_").slice(0, 6).join("_")
    .slice(0, 42)
  if (!base) base = "texto"
  if (/^[0-9]/.test(base)) base = `n_${base}`
  let chave = base
  for (let n = 2; usadas.has(chave); n++) chave = `${base}_${n}`
  usadas.add(chave)
  chaves.set(chave, texto)
  return chave
}

// ─── 1. Texto entre tags JSX ─────────────────────────────────────────────────
//
// `>Texto aqui<` — sem `{`, sem `<`, e com cara de frase. É o caso mais comum e
// o mais seguro: o que está ali é, literalmente, o que aparece na tela.
// ⚠️ SÓ ANTES DE UMA TAG DE FECHAMENTO (`>Texto</`), e isso é o que torna a
// ferramenta segura em .tsx.
//
// A primeira versão casava qualquer `>texto<`, e num arquivo TypeScript isso
// inclui GENÉRICOS — que usam os mesmos sinais:
//
//     const patch = (p: Record<string, unknown>) => setState(p as Parameters<typeof setState>[0])
//                                            ↑ o `>` daqui        ↑ e o `<` daqui
//
// O trecho entre os dois virou "texto de tela" e a linha foi destruída. Exigir
// `</` logo depois elimina a classe inteira do problema: generic nenhum é
// seguido de barra, e texto de interface quase sempre fecha a tag em seguida.
codigo = codigo.replace(/>([^<>{}\n]{4,})<\//g, (inteiro, texto) => {
  const limpo = texto.trim()
  if (!EhTextoHumano(limpo)) return inteiro
  if (/^[\d\s.,:%+\-/]+$/.test(limpo)) return inteiro
  // ⚠️ ESTA GUARDA NASCEU DE UM ESTRAGO REAL. Sem ela, a expressão
  //     {saving ? <Loader2 /> : saved ? <Check /> : <Save />}
  // era lida como "texto entre tags": o trecho " : saved ? " virou chave de
  // tradução e o ternário foi destruído. Deu erro de SINTAXE, felizmente, e não
  // um defeito silencioso em runtime.
  //
  // Operador de JS não aparece em texto de tela. Perder um "Tem certeza?" é
  // barato perto de reescrever lógica por engano: extrair de menos se conserta
  // na passada seguinte; corromper código, não.
  if (/[?:&|=]/.test(limpo)) return inteiro
  const chave = chaveDe(limpo)
  // Preserva o espaçamento original em volta — tirá-lo cola palavras vizinhas.
  const antes = texto.match(/^\s*/)[0]
  const depois = texto.match(/\s*$/)[0]
  return `>${antes}{t.${namespace}.${chave}}${depois}</`
})

// ─── 2. Props que são texto de tela ──────────────────────────────────────────
for (const prop of PROPS_DE_TEXTO) {
  const re = new RegExp(`(\\s${prop}=)"([^"\\\\]{4,})"`, "g")
  codigo = codigo.replace(re, (inteiro, atrib, texto) => {
    if (!EhTextoHumano(texto)) return inteiro
    return `${atrib}{t.${namespace}.${chaveDe(texto)}}`
  })
}

console.log(`${arquivo} -> ${chaves.size} frase(s) viraram chave em "${namespace}"`)
for (const [k, v] of [...chaves].slice(0, 8)) console.log(`   ${k}: ${JSON.stringify(v)}`)
if (chaves.size > 8) console.log(`   ... e mais ${chaves.size - 8}`)

if (!aplicar) {
  console.log("\nEnsaio. Nada foi escrito. Repita com --aplicar.")
  process.exit(0)
}

// ─── 3. Escreve as chaves no pt-BR ───────────────────────────────────────────
let pt = readFileSync(PT, "utf-8")
const bloco = [...chaves].map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`).join("\n")

if (new RegExp(`^  ${namespace}: \\{`, "m").test(pt)) {
  // Namespace já existe: acrescenta ao fim dele.
  pt = pt.replace(new RegExp(`(^  ${namespace}: \\{[\\s\\S]*?)(^  \\},)`, "m"), `$1${bloco}\n$2`)
} else {
  // ⚠️ ENTRA ANTES DO ÚLTIMO `}` do objeto, nao no fim do ARQUIVO: depois dele
  // vem o `export type Translations`, e escrever ali quebra o modulo inteiro.
  const fim = pt.lastIndexOf("\n}")
  pt = `${pt.slice(0, fim)}\n  ${namespace}: {\n${bloco}\n  },${pt.slice(fim)}`
}

writeFileSync(PT, pt)
writeFileSync(arquivo, codigo)
console.log(`\nAplicado. Rode o type-check: as chaves novas so existem no pt-BR, e os`)
console.log(`outros idiomas caem nele ate serem traduzidos.`)
