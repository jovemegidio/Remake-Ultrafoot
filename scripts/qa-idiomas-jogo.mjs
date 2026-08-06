// QUANTO DO JOGO ESTA TRADUZIDO — e onde falta.
//
// "Cobertura parcial de i18n" nao e acionavel: ninguem sabe por onde comecar nem
// quando acabou. Este script transforma isso em NUMERO e em LISTA, por tela.
//
// O que ele conta como texto de interface: string entre aspas que parece frase
// em portugues (tem acento, ou e uma palavra comum do idioma) dentro de um
// arquivo de tela/componente. Nao e perfeito — nome de clube e chave tecnica
// escapam pelos dois lados —, mas e estavel: serve para comparar antes e depois.
//
// ⚠️ NAO E GATE DE REPROVACAO. Falharia hoje em 40 telas e viraria ruido que
// todo mundo aprende a ignorar; e assim que um gate morre. Ele imprime o placar
// e sai 0. Quem quiser travar regressao usa `--maximo <n>`.
//
//   node scripts/qa-idiomas-jogo.mjs
//   node scripts/qa-idiomas-jogo.mjs --detalhe app/calendario
//   node scripts/qa-idiomas-jogo.mjs --maximo 900

import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

const RAIZ = process.cwd()
const args = process.argv.slice(2)
const detalhe = args.includes("--detalhe") ? args[args.indexOf("--detalhe") + 1] : null
const maximo = args.includes("--maximo") ? Number(args[args.indexOf("--maximo") + 1]) : null

const PALAVRAS_PT = /\b(de|do|da|para|com|sem|por|em|no|na|os|as|um|uma|voce|seu|sua|nao|sim|jogo|jogos|time|clube|elenco|atleta|jogador|partida|rodada|temporada|contrato|salario|semana|mes|ano|valor|preco|caixa|saldo|renda|custo|obra|tecnico|treinador|diretoria|torcida|estadio|mercado|proposta|oferta|titulo|vitoria|derrota|empate)\b/i
const ACENTO = /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/

/**
 * Pula o que nao e texto de interface.
 *
 * ⚠️ A primeira versao contava 1.233 e o numero era INFLADO: entravam
 * fragmento de JSX partido em duas linhas (`>Tela cheia</div> <div className=`),
 * pedaco de codigo (`as ViewType, title:`) e classe utilitaria. Um medidor que
 * exagera e tao ruim quanto um que mente para menos — quem le decide errado onde
 * investir. As regras abaixo exigem que a string PARECA FRASE.
 */
const IGNORAR = [
  /[<>{}]/,                            // fragmento de JSX ou template
  /\w+\s*[:=]\s*$/,                     // pedaco de codigo cortado
  /as [A-Z]\w+/,                      // cast de TypeScript
  /^[a-z]+([A-Z]\w*)+$/,                // camelCase (identificador)
  /^[a-z0-9_-]+$/i,                    // chave tecnica, id, slug
  /^#[0-9a-f]{3,8}$/i,                 // cor
  /^@?\/[\w/.-]*$/,                    // rota, caminho ou import "@/lib/..."
  /^[\d\s.,:%+-]*$/,                   // so numero/pontuacao
  /^(https?|data):/i,                  // url
  /^[A-Z_]+$/,                         // CONSTANTE
  /^\s*$/,
]

const arquivos = []
const anda = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "ui") anda(p); continue }
    if (/\.tsx$/.test(e.name)) arquivos.push(p)
  }
}
anda(join(RAIZ, "app"))
anda(join(RAIZ, "components"))

const porArquivo = []
let totalTextos = 0
let totalTraduzidos = 0

for (const f of arquivos) {
  const src = readFileSync(f, "utf8")
  const usaI18n = /useTranslation/.test(src)
  const achados = new Set()
  for (const m of src.matchAll(/"([^"\\\n]{3,90})"|'([^'\\\n]{3,90})'/g)) {
    const s = (m[1] ?? m[2]).trim()
    if (IGNORAR.some(re => re.test(s))) continue
    if (!ACENTO.test(s) && !PALAVRAS_PT.test(s)) continue
    // Classe de CSS costuma casar em "de"/"da" dentro de nomes utilitarios.
    if (/^[\w\s:/[\]().,%#-]+$/.test(s) && /\b(flex|grid|rounded|text|bg|border|px|py|mt|mb|gap|absolute|relative)\b/.test(s)) continue
    achados.add(s)
  }
  const chamadas = (src.match(/\bt\.[a-zA-Z]+\.[a-zA-Z]+/g) ?? []).length
  totalTextos += achados.size
  totalTraduzidos += chamadas
  if (achados.size > 0) porArquivo.push({ arquivo: relative(RAIZ, f), pendentes: achados.size, usaI18n, chamadas, exemplos: [...achados].slice(0, 6), todos: [...achados] })
}

porArquivo.sort((a, b) => b.pendentes - a.pendentes)

if (detalhe) {
  const alvo = porArquivo.filter(a => a.arquivo.replace(/\\/g, "/").includes(detalhe))
  for (const a of alvo) {
    console.log(`\n${a.arquivo} — ${a.pendentes} pendentes (i18n: ${a.usaI18n ? "sim" : "NAO"}, ${a.chamadas} chamadas)`)
    for (const e of a.todos) console.log(`   ${e}`)
  }
  process.exit(0)
}

const telasComI18n = porArquivo.filter(a => a.usaI18n).length
console.log(`arquivos de interface : ${arquivos.length}`)
console.log(`com useTranslation    : ${arquivos.filter(f => /useTranslation/.test(readFileSync(f, "utf8"))).length}`)
console.log(`chamadas de traducao  : ${totalTraduzidos}`)
console.log(`textos ainda fixos    : ${totalTextos}  (em ${porArquivo.length} arquivos, ${telasComI18n} deles ja com i18n parcial)`)
console.log("\nONDE MAIS FALTA:")
for (const a of porArquivo.slice(0, 20)) {
  console.log(`  ${String(a.pendentes).padStart(4)}  ${a.usaI18n ? "parcial" : "  —    "}  ${a.arquivo}`)
}
console.log("\n(--detalhe <caminho> lista as frases de uma tela)")

if (maximo != null && totalTextos > maximo) {
  console.error(`\nREPROVADO: ${totalTextos} textos fixos, teto de ${maximo}`)
  process.exit(1)
}
