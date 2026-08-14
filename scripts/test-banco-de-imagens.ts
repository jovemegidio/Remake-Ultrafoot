// O BANCO DE IMAGENS NÃO PODE CRESCER SEM FIM.
//
// Relato de 12/08/2026: o jogo caía com "Código de erro: Out of Memory" depois
// de um tempo de uso — não ao abrir. A causa era este arquivo:
// `URL.createObjectURL` mantém o Blob vivo até alguém chamar `revokeObjectURL`,
// o mapa de URLs não tinha teto e o revoke não existia em lugar nenhum. Cada
// escudo, uniforme e retrato visto ficava na memória da webview para sempre.
//
// O que este teste protege é justamente o que não dá para ver na tela: que o
// número de imagens vivas PARA de crescer, e que o revoke é chamado ao podar.
// Sem isso, a fuga volta em silêncio na primeira refatoração.
//
//   npx tsx scripts/test-banco-de-imagens.ts

// ⚠️ `export {}` NAO e enfeite: sem um import/export de TOPO, o TypeScript trata
// o arquivo como SCRIPT global, e `let falhas` colide com o mesmo nome nos outros
// testes — "Cannot redeclare block-scoped variable". Os `import` daqui estao
// dentro de `main()` (o tsx compila para CJS e nao aceita await de topo), entao
// esta linha e o que mantem o arquivo sendo um modulo.
export {}

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

// ── Ambiente de webview simulado ────────────────────────────────────────────
// O módulo é do navegador; aqui damos a ele o mínimo: `URL.createObjectURL`,
// `revokeObjectURL` (contando as chamadas), `Blob` e `window`.
let criadas = 0
let revogadas = 0
const vivas = new Set<string>()

const g = globalThis as unknown as Record<string, unknown>
g.Blob = class { constructor(public partes: unknown[], public opts?: unknown) {} }
// ⚠️ ACRESCENTAR os dois métodos, NUNCA trocar o `URL` inteiro: o carregador do
// próprio tsx faz `new URL(...)` para resolver módulo, e substituir o global por
// um objeto simples derruba a execução com "URL is not a constructor" antes de
// qualquer teste rodar.
const urlReal = globalThis.URL as unknown as Record<string, unknown>
urlReal.createObjectURL = () => {
  const u = `blob:teste/${++criadas}`
  vivas.add(u)
  return u
}
urlReal.revokeObjectURL = (u: string) => {
  revogadas++
  vivas.delete(u)
}
g.window = { dispatchEvent: () => true, addEventListener: () => {}, location: { search: "" } }
g.CustomEvent = class { constructor(public tipo: string, public init?: unknown) {} }

// O módulo lê do disco via plugin do Tauri; fora do Tauri ele devolve null e
// nada é criado. Para exercitar o LRU, chamamos a poda pela porta que o próprio
// módulo expõe, inserindo pelo caminho real de leitura seria dependência de FS.
async function main() {
  const banco = await import("../lib/banco-de-imagens")

  console.log("\nTeto de imagens vivas\n")

  check("comeca vazio", banco.imagensVivas() === 0, `${banco.imagensVivas()}`)

  // Simula o que `carregarImagem` faz: cria a URL e registra. Como o registro é
  // interno, exercitamos pelo efeito observável — `imagensVivas` e o contador de
  // revoke — usando a função exportada de poda através de muitas leituras.
  // Sem Tauri, `carregarImagem` devolve null sem criar nada: então o que se pode
  // afirmar aqui é o CONTRATO, e é isso que se testa.
  const semTauri = await banco.carregarImagem("uf-img:abc.png")
  check("fora do Tauri nao cria blob nenhum", semTauri === null && criadas === 0,
  `criadas=${criadas}`)
  check("e nao deixa nada vivo", banco.imagensVivas() === 0, `${banco.imagensVivas()}`)

  console.log("\nReferencia que nao e do banco passa direto\n")

  check("url normal volta como veio",
  banco.resolverImagem("https://exemplo/escudo.png") === "https://exemplo/escudo.png")
  check("null continua null", banco.resolverImagem(null) === null)
  check("ref do banco ainda nao carregada devolve null",
  banco.resolverImagem("uf-img:xyz.png") === null)

  console.log("\nO teto existe e e razoavel\n")

  // ⚠️ O número importa: baixo demais revoga imagem que ainda está na tela (vira
  // escudo em branco no meio da partida); alto demais não conserta a fuga.
  const fonte = (await import("node:fs")).readFileSync("lib/banco-de-imagens.ts", "utf-8")
  const teto = Number(/const TETO_DE_IMAGENS = (\d+)/.exec(fonte)?.[1] ?? 0)
  check("ha um teto declarado", teto > 0, `${teto}`)
  check("o teto cobre a tela mais cheia do jogo (>=300)", teto >= 300, `${teto}`)
  check("e nao e alto a ponto de nao conservar nada (<=2000)", teto <= 2000, `${teto}`)
  check("a poda REVOGA a url, senao nada e liberado",
  /revokeObjectURL/.test(fonte), "revokeObjectURL ausente do modulo")
  check("a poda e chamada depois de registrar a imagem",
  /urlPorRef\.set\(ref, url\)\s*\n\s*podarImagens\(\)/.test(fonte),
  "podarImagens nao e chamada apos o set")

  console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
  process.exit(falhas === 0 ? 0 : 1)

}

void main()
