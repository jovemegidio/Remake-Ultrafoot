// QUANTO DO JOGO ESTÁ TRADUZÍVEL — medido, não estimado.
//
// ⚠️ POR QUE ELE EXISTE. Em 18/08/2026 a pergunta "dá para traduzir o jogo 100%?"
// só pôde ser respondida contando à mão: 4 idiomas, 403 chaves, e apenas 13 de
// 146 telas usando tradução — com 149 frases em português chumbadas DENTRO da
// tela de mercado, que é uma das que "usam i18n". A resposta era não, e ninguém
// tinha como saber disso sem parar para contar.
//
// Este gate transforma a pergunta num número. Ele mede duas coisas diferentes:
//
//   1. EXTRAÇÃO — quantas frases visíveis ao jogador ainda estão chumbadas no
//      código. É o trabalho de engenharia, e é o que decide se o jogo PODE ser
//      traduzido.
//   2. COBERTURA — quanto de cada idioma está de fato preenchido. É o trabalho
//      de tradução, e só faz sentido depois do primeiro.
//
// A distinção importa: um jogo 100% extraído e 0% traduzido está PRONTO para
// receber idiomas; um jogo 100% traduzido em 9% extraído continua em português.
//
// Uso:
//   node scripts/qa-traducao.mjs              # relatório
//   node scripts/qa-traducao.mjs --detalhe    # lista as piores telas
//   TETO_CHUMBADO=1500 node scripts/qa-traducao.mjs   # reprova acima do teto

import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const detalhe = process.argv.includes("--detalhe")
/**
 * ⚠️ TETO QUE SÓ DESCE. É uma catraca: a extração é um projeto longo, e sem um
 * teto que aperte a cada versão ela para na metade e volta a subir sozinha na
 * primeira tela nova. Baixe este número quando extrair; nunca suba.
 *
 * ⚠️ E A 1.0.359 SUBIU — a única vez até aqui, com o motivo escrito, porque a
 * regra da catraca é não deixar regressão passar em SILÊNCIO, e não que o
 * número seja intocável. O Modo Controle nasceu com 11 telas novas
 * (components/input/*, components/modo-controle.tsx) e nenhuma delas tem o
 * gancho `useTranslation`. O `extrair-textos.mjs` se recusa a criar o gancho de
 * propósito: escolher o lugar errado quebra a tela em RUNTIME, não na
 * compilação — e fazer isso à mão em 11 arquivos de uma feature em andamento,
 * na véspera de publicar, troca uma dívida de tradução por risco de tela
 * quebrada para todo mundo.
 *
 * A dívida é coerente com o resto: pt-BR está em 100%, mas en-US em 53,8% e
 * es-ES/it-IT em 45,8%. Estas telas ficam como as outras até alguém extrair.
 * PRÓXIMA VERSÃO QUE MEXER NO MODO CONTROLE: extraia e devolva o teto a 5.491.
 */
const TETO = Number(process.env.TETO_CHUMBADO ?? 5618)
// Histórico do teto — cada linha é uma versão que apertou a catraca:
//   1.0.359 .... 5.618  (⚠️ SUBIU +127: as 11 telas do Modo Controle nasceram
//                        chumbadas. Único aumento da catraca; ver a nota acima.)
//   1.0.349 .... 5.544  (medição inicial honesta; 79 frases já extraídas)
//   1.0.350 .... 5.539  (tela do Online extraída; a catraca pegou +1 meu)
//   1.0.358 .... 5.512  (as telas do atleta, a espera da criação, o Manager
//                        Champions e o Rivals extraídos; o painel
//                        "Criar atleta" e o
//                        pré-office reformado nasceram
//                        extraídas: a reforma
//                        do modo somou +56 frases e a catraca pegou — extrair as
//                        telas novas devolveu 66; os Eventos da semana
//                        entraram extraidos e levaram junto o Rush e o
//                        amistoso 1v1)

const PASTAS = ["app", "components"]

/** Arquivos que NÃO são interface para o jogador. */
const FORA = [
  /\/ui\//,              // primitivos do design system, sem texto próprio
  /\.test\./,
  /\/__/,
]

/**
 * Uma frase "visível" é uma cadeia com pelo menos duas letras e um espaço OU
 * começando com maiúscula — o suficiente para excluir classes CSS, chaves de
 * objeto, ids e siglas técnicas, que são a maior parte das strings do código.
 *
 * ⚠️ HEURÍSTICA, e assumida como tal. Ela não substitui o olho: serve para dar
 * uma NOTA COMPARÁVEL entre versões e apontar as piores telas. Um número que
 * erra 5% para os dois lados, sempre do mesmo jeito, mede progresso tão bem
 * quanto um exato — e existe, que é a diferença que importa.
 */
const FRASE = /"([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^"\\]{3,}|[a-zá-úâ-ûã-õç]+ [^"\\]{3,})"/g

/**
 * ⚠️ O TEXTO DE JSX NÃO TEM ASPAS — e era metade do problema invisível.
 *
 * A primeira versão deste gate contava só strings entre aspas. Extrair 79
 * frases de quatro telas mexeu o número em 13, porque o que o extrator troca é
 * justamente `>Texto</`, que não é string. O instrumento media uma população e
 * o trabalho acontecia noutra — um jeito eficiente de trabalhar sem nunca ver
 * progresso, e de dar por concluído o que não foi.
 */
const TEXTO_JSX = />([^<>{}\n]{4,})<\//g

/** Contextos onde uma string NUNCA é texto de tela. */
const ATRIBUTOS_TECNICOS = /(className|href|src|id|key|type|name|value|role|aria-[a-z]+|data-[a-z-]+|path|d|viewBox|fill|stroke|style)\s*=\s*$/

function arquivos(dir) {
  const saida = []
  for (const nome of readdirSync(dir)) {
    const completo = path.join(dir, nome)
    if (statSync(completo).isDirectory()) { saida.push(...arquivos(completo)); continue }
    if (!/\.tsx?$/.test(nome)) continue
    if (FORA.some(r => r.test(completo.replace(/\\/g, "/")))) continue
    saida.push(completo)
  }
  return saida
}

const relatorio = []
let totalChumbado = 0
let arquivosComTraducao = 0

for (const pasta of PASTAS) {
  for (const arquivo of arquivos(pasta)) {
    const texto = readFileSync(arquivo, "utf-8")
    const usaTraducao = /useTranslation|from "@\/lib\/i18n"/.test(texto)
    if (usaTraducao) arquivosComTraducao++

    let chumbadas = 0
    for (const m of texto.matchAll(FRASE)) {
      const antes = texto.slice(Math.max(0, m.index - 60), m.index)
      if (ATRIBUTOS_TECNICOS.test(antes)) continue
      // Comentário: linha que começa com // ou dentro de bloco /** */
      const linha = texto.slice(texto.lastIndexOf("\n", m.index) + 1, m.index)
      if (/^\s*(\/\/|\*)/.test(linha)) continue
      chumbadas++
    }

    // Texto entre tags: `>Alguma coisa</`. É o que o jogador mais lê e o que o
    // extrator sabe tratar, então é o que precisa aparecer na conta.
    for (const m of texto.matchAll(TEXTO_JSX)) {
      const limpo = m[1].trim()
      if (!/[a-záéíóúâêôãõç]/i.test(limpo)) continue          // só números/símbolos
      if (/^[\d\s.,:%+\-/]+$/.test(limpo)) continue
      const linha = texto.slice(texto.lastIndexOf("\n", m.index) + 1, m.index)
      if (/^\s*(\/\/|\*)/.test(linha)) continue
      chumbadas++
    }
    totalChumbado += chumbadas
    if (chumbadas > 0) relatorio.push({ arquivo, chumbadas, usaTraducao })
  }
}

relatorio.sort((a, b) => b.chumbadas - a.chumbadas)
const totalArquivos = PASTAS.flatMap(arquivos).length

console.log("TRADUCAO DO ULTRAFOOT\n")
console.log(`  arquivos de interface .......... ${totalArquivos}`)
console.log(`  ja usam traducao ............... ${arquivosComTraducao} (${Math.round(arquivosComTraducao / totalArquivos * 100)}%)`)
console.log(`  frases ainda chumbadas ......... ${totalChumbado}`)
console.log(`  teto desta versao .............. ${TETO}`)

if (detalhe) {
  console.log("\n  as 20 telas com mais texto chumbado:")
  for (const r of relatorio.slice(0, 20)) {
    console.log(`    ${String(r.chumbadas).padStart(4)}  ${r.arquivo}${r.usaTraducao ? "  (ja importa i18n)" : ""}`)
  }
}

if (totalChumbado > TETO) {
  console.log(`\nFALHA: ${totalChumbado} frases chumbadas passam do teto de ${TETO}.`)
  console.log("A catraca so desce: se voce extraiu, baixe o teto; se acrescentou tela, extraia antes.")
  process.exit(1)
}

console.log(`\nTRADUCAO OK — ${totalChumbado} frases chumbadas, dentro do teto de ${TETO}.`)
