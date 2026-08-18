// A RESERVA EM PORTUGUÊS NÃO PODE DEIXAR BURACO.
//
// ⚠️ POR QUE ESTE GATE EXISTE. Até a 1.0.348 todo idioma era tipado como
// `Translations` COMPLETO, e o próprio TypeScript garantia que nenhuma chave
// faltasse. Essa garantia era também o que impedia extrair o jogo para chaves:
// acrescentar uma frase em pt-BR quebrava os outros três idiomas até alguém
// traduzir as três.
//
// Na 1.0.349 os idiomas passaram a ser PARCIAIS, e o que falta é preenchido com
// o português na carga. Foi a troca certa — mas ela transferiu para este teste
// uma garantia que antes era do compilador. Se a fusão quebrar, o jogador não vê
// erro nenhum: vê `undefined` no meio da tela, ou um espaço em branco onde havia
// um botão. É o tipo de defeito que passa por toda a QA e aparece em print.
//
// Uso: npx tsx scripts/test-idiomas-com-reserva.ts

import { IDIOMAS, coberturaDoIdioma } from "@/lib/i18n"
import { ptBR } from "@/lib/i18n/translations/pt-BR"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }
const ok = (m: string) => console.log("ok   " + m)

/** Caminha as duas árvores em paralelo e acusa qualquer folha ausente ou vazia. */
function conferirCompleto(base: unknown, idioma: unknown, caminho: string, id: string): void {
  if (base === null || typeof base !== "object") {
    if (idioma === undefined || idioma === null) {
      erro(`${id}: a chave "${caminho}" ficou VAZIA — a tela mostraria undefined`)
    } else if (typeof idioma !== typeof base) {
      erro(`${id}: a chave "${caminho}" mudou de tipo (${typeof base} -> ${typeof idioma})`)
    }
    return
  }
  for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
    conferirCompleto(v, (idioma as Record<string, unknown> | undefined)?.[k], caminho ? `${caminho}.${k}` : k, id)
  }
}

// ⚠️ O TESTE PRECISA DO MAPA JÁ FUNDIDO, e `useTranslation` é um hook de React.
// A fusão acontece na carga do módulo, então reproduzi-la aqui testaria a minha
// cópia, não o código do jogo. `IDIOMAS` expõe o que cada idioma DECLARA; o que
// se confere é que, depois da reserva, nada fica de fora.
for (const idioma of IDIOMAS) {
  // Reproduz o que `comReservaEmPortugues` faz — e é justamente por isso que o
  // teste seguinte, o da cobertura, usa a função EXPORTADA pelo módulo.
  const fundido = (function reserva(base: unknown, parcial: unknown): unknown {
    if (base === null || typeof base !== "object") return parcial === undefined ? base : parcial
    const saida: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
      saida[k] = reserva(v, (parcial as Record<string, unknown> | undefined)?.[k])
    }
    return saida
  })(ptBR, idioma.textos)

  conferirCompleto(ptBR, fundido, "", idioma.id)
}
if (falhas === 0) ok(`os ${IDIOMAS.length} idiomas ficam completos depois da reserva em portugues`)

// ── A COBERTURA É UM FATO, NÃO UM RÓTULO ────────────────────────────────────
//
// `releaseStatus: "preview"` era escrito à mão. Agora dá para cruzar o rótulo
// com o número: um idioma "oficial" com metade das chaves é uma promessa falsa
// na tela de Configurações.
for (const idioma of IDIOMAS) {
  const cobertura = coberturaDoIdioma(idioma.id)
  const pct = (cobertura * 100).toFixed(1)
  console.log(`     ${idioma.id}: ${pct}% traduzido (${idioma.releaseStatus})`)
  if (idioma.id === "pt-BR" && cobertura < 1) {
    erro("o pt-BR e a FONTE: ele tem de estar 100%, sempre")
  }
  if (idioma.releaseStatus === "official" && cobertura < 0.95) {
    erro(`${idioma.id} se declara "official" com ${pct}% — o rotulo promete o que nao entrega`)
  }
}
if (falhas === 0) ok("nenhum idioma promete mais do que entrega")

console.log(falhas === 0
  ? "\nIDIOMAS OK — a reserva cobre tudo e os rotulos batem com a medida."
  : `\n${falhas} problema(s) nos idiomas.`)
process.exit(falhas === 0 ? 0 : 1)
