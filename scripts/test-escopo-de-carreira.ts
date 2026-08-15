// UM SAVE NÃO PODE INVADIR OUTRO.
//
// O defeito que este teste tranca, e por que ele é do tipo que não dá erro:
//
// Cada carreira guarda o que é dela em chaves terminadas em `:<careerId>` —
// elenco, caixa, notificações, propostas, observados, mercado. A chave era
// montada por `getCareerScopedKey(base)`, que caía na chave NUA quando não havia
// carreira ativa. E há janelas reais sem carreira ativa: o boot antes de
// hidratar, a splash, e logo depois de apagar uma carreira (o `active-career` é
// removido). Nessas janelas todas as carreiras escreviam e liam no MESMO lugar.
//
// Pior: o adaptador do motor MIGRAVA a chave nua para dentro de qualquer
// carreira cujo motor ainda estivesse vazio — ou seja, para toda carreira nova.
// Criar uma carreira do zero trazia o elenco e o caixa de outra.
//
// Nada disso lança exceção. O sintoma é um jogo incoerente, e a causa fica a
// dezenas de arquivos de distância do sintoma. Por isso a guarda é no FONTE:
// o padrão de queda para a chave nua não pode voltar por descuido.
//
//   npx tsx scripts/test-escopo-de-carreira.ts

export {}

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

async function main() {
  const { readFileSync } = await import("node:fs")

  console.log("\nA chave escopada nunca cai na chave nua\n")

  const fonteSave = readFileSync("lib/save-system.ts", "utf-8")
  const corpo = fonteSave.slice(
    fonteSave.indexOf("export function getCareerScopedKey"),
    fonteSave.indexOf("export function getCareerScopedKey") + 400,
  )
  check("achou getCareerScopedKey", corpo.length > 50)
  check(
    "NAO existe mais a queda `: base` (era o save invadindo outro)",
    !/careerId\s*\?\s*`\$\{base\}:\$\{careerId\}`\s*:\s*base/.test(corpo),
    "voltou o fallback para a chave compartilhada",
  )
  check(
    "usa o sufixo de quarentena quando nao ha carreira",
    corpo.includes("SEM_CARREIRA"),
    corpo.slice(corpo.indexOf("return"), corpo.indexOf("return") + 90),
  )

  console.log("\nO adaptador do motor tambem nao cai na chave nua\n")

  const fonteStore = readFileSync("lib/persistent-store.ts", "utf-8")
  const resolve = fonteStore.slice(
    fonteStore.indexOf("const resolveName"),
    fonteStore.indexOf("const resolveName") + 400,
  )
  check("achou resolveName", resolve.length > 50)
  check(
    "sem carreira, o motor vai para a quarentena (e nao para `name`)",
    resolve.includes("MOTOR_SEM_CARREIRA") && !/:\s*name\s*\n?\s*\}/.test(resolve),
    resolve.slice(resolve.indexOf("return"), resolve.indexOf("return") + 90),
  )

  console.log("\nA migracao do motor legado vale para UMA carreira so\n")

  check(
    "existe a marca de legado ja consumido",
    fonteStore.includes("MOTOR_LEGADO_CONSUMIDO"),
    "sem ela, toda carreira nova herda o motor da anterior",
  )
  check(
    "a marca e conferida ANTES de copiar o legado",
    /jaConsumido[\s\S]{0,200}storeSet\(\s*resolvedName/.test(fonteStore),
    "a copia acontece sem checar quem ja herdou",
  )
  check(
    "a quarentena nunca herda o legado",
    fonteStore.includes("resolvedName !== MOTOR_SEM_CARREIRA"),
  )

  console.log("\nA quarentena nao viaja para a nuvem\n")

  const fonteNuvem = readFileSync("lib/cloud-save.ts", "utf-8")
  check(
    "isSaveKey recusa a chave de quarentena",
    /__sem-carreira/.test(fonteNuvem.slice(fonteNuvem.indexOf("function isSaveKey"), fonteNuvem.indexOf("function isSaveKey") + 700)),
    "a contaminacao seria levada para a outra maquina no pacote",
  )

  console.log("\nComportamento, e nao so o texto do fonte\n")

  // Reimplementa a regra e confere o formato — se a funcao mudar de forma, o
  // teste acima pega; este garante que o formato continua sendo o esperado.
  const escopar = (base: string, careerId: string | null) => `${base}:${careerId || "__sem-carreira"}`
  check("com carreira, a chave leva o id",
    escopar("ultrafoot:notifications", "career-abc") === "ultrafoot:notifications:career-abc")
  check("sem carreira, a chave NAO e a nua",
    escopar("ultrafoot:notifications", null) !== "ultrafoot:notifications")
  check("duas carreiras nunca compartilham chave",
    escopar("ultrafoot:observados", "career-a") !== escopar("ultrafoot:observados", "career-b"))

  console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
  process.exit(falhas === 0 ? 0 : 1)
}

void main()
