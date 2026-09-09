import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const outDir = path.resolve("out")
const ignoredRouteParts = new Set(["_full", "_head", "_index", "_tree"])

// ⚠️ ESTE SCRIPT PASSOU A NAO FAZER NADA, EM SILENCIO (corrigido na 1.0.380).
//
// Ele procurava um ARQUIVO `__next.<rota>.txt` ao lado do `index.txt`. O Next
// mudou o formato e passou a emitir um DIRETORIO:
//
//   out/configuracoes/__next.configuracoes/__PAGE__.txt      (rota simples)
//   out/base/carreira/__next.base/carreira/__PAGE__.txt      (rota aninhada)
//
// enquanto o roteador do cliente continua pedindo o nome PLANO:
//
//   /configuracoes/__next.configuracoes.__PAGE__.txt
//
// Sem o alias, TODO prefetch de rota devolve 404 e o app empacotado nunca faz
// transicao pelo roteador: cada clique vira carga completa da pagina. Medido em
// 28/08/2026 no out/ da 1.0.378 — 77 rotas, 74 diretorios na forma nova e ZERO
// aliases criados — enquanto o script imprimia "aliases checked" e saia com 0.
// O qa-audit via o sintoma (29 de 40 telas com 404 em /configuracoes e /elenco,
// que todo menu pre-carrega) e ninguem ligava uma coisa a outra.
//
// Ver a guarda no fim do arquivo: agora ele REPROVA o build se nao criar alias
// nenhum tendo rota para servir.

let aliasesCriados = 0

/** Acha o `__PAGE__.txt` dentro do diretorio `__next.*` de uma rota. */
function paginaDentroDoDiretorio(dir) {
  const entrada = readdirSync(dir).find(e => e.startsWith("__next.") && !e.endsWith(".txt"))
  if (!entrada) return null
  const raiz = path.join(dir, entrada)
  if (!existsSync(raiz) || !statSync(raiz).isDirectory()) return null

  // Rota aninhada guarda os segmentos restantes como subpastas. Percorra a
  // arvore toda: no export POSIX podem existir diretorios auxiliares irmaos e
  // escolher apenas o primeiro ramo deixa o __PAGE__.txt real invisivel.
  const fila = [{ dir: raiz, profundidade: 0 }]
  while (fila.length > 0) {
    const atual = fila.shift()
    for (const item of readdirSync(atual.dir, { withFileTypes: true })) {
      const alvo = path.join(atual.dir, item.name)
      if (item.isFile() && item.name === "__PAGE__.txt") return alvo
      if (item.isDirectory() && atual.profundidade < 8) {
        fila.push({ dir: alvo, profundidade: atual.profundidade + 1 })
      }
    }
  }
  return null
}

function walk(dir) {
  const entries = readdirSync(dir)
  const relativeDir = path.relative(outDir, dir)

  if (relativeDir && existsSync(path.join(dir, "index.txt"))) {
    const routePart = relativeDir.split(path.sep).join(".")
    const sourceName = entries.find(entry => {
      if (!entry.startsWith("__next.") || !entry.endsWith(".txt")) return false
      if (entry.includes(".__PAGE__.txt")) return false
      const part = entry.slice("__next.".length, -".txt".length)
      return !ignoredRouteParts.has(part)
    })

    // A forma antiga (arquivo plano) primeiro; depois o __PAGE__ que o export
    // POSIX ja entrega; por fim, a forma em diretorio emitida no Windows.
    const pageAlias = path.join(dir, `__next.${routePart}.__PAGE__.txt`)
    const sourcePath = sourceName
      ? path.join(dir, sourceName)
      : existsSync(pageAlias)
        ? pageAlias
        : paginaDentroDoDiretorio(dir)
    if (sourcePath) {
      for (const aliasName of [`__next.${routePart}.txt`, `__next.${routePart}.__PAGE__.txt`]) {
        const aliasPath = path.join(dir, aliasName)
        if (!existsSync(aliasPath)) {
          copyFileSync(sourcePath, aliasPath)
          aliasesCriados++
        }
      }
    }
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const info = statSync(fullPath)

    if (info.isDirectory()) {
      walk(fullPath)
      continue
    }

    if (!entry.startsWith("__next.") || !entry.endsWith(".txt")) {
      continue
    }

    if (entry.includes(".__PAGE__.txt")) {
      continue
    }

    const routePart = entry.slice("__next.".length, -".txt".length)
    if (ignoredRouteParts.has(routePart)) {
      continue
    }

    const aliasName = `__next.${routePart}.__PAGE__.txt`
    const aliasPath = path.join(dir, aliasName)

    if (!existsSync(aliasPath)) {
      copyFileSync(fullPath, aliasPath)
    }
  }
}

if (!existsSync(outDir)) {
  const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM) || process.env.TAURI_BUILD === "1"
  if (isTauriBuild) {
    throw new Error("out directory not found. Run the Tauri static export first.")
  }
  console.log("Next export RSC aliases skipped (non-Tauri build).")
  process.exit(0)
}

const rotasComIndex = []
;(function contar(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) contar(p)
  }
  if (path.relative(outDir, dir) && existsSync(path.join(dir, "index.txt"))) rotasComIndex.push(dir)
})(outDir)

walk(outDir)
console.log(`Next export RSC aliases: ${aliasesCriados} criados para ${rotasComIndex.length} rota(s).`)

// ⚠️ A GUARDA QUE FALTAVA. Sem ela este script ficou versoes "passando" sem
// criar um alias sequer, porque o formato do Next mudou por baixo dele.
//
// Nao use `aliasesCriados === 0` como prova de falha: em Linux o Next 16.3 ja
// pode emitir os dois nomes finais. Nesse caso nao ha nada para copiar e zero
// significa que o export ja veio correto. Confira o resultado, nao a quantidade
// de trabalho que foi necessaria para chegar nele.
const rotasSemAliases = rotasComIndex.filter(dir => {
  const routePart = path.relative(outDir, dir).split(path.sep).join(".")
  return [
    `__next.${routePart}.txt`,
    `__next.${routePart}.__PAGE__.txt`,
  ].some(aliasName => !existsSync(path.join(dir, aliasName)))
})

if (rotasSemAliases.length > 0) {
  const exemplos = rotasSemAliases
    .slice(0, 3)
    .map(dir => path.relative(outDir, dir).split(path.sep).join("/"))
    .join(", ")
  const primeira = rotasSemAliases[0]
  const arvore = []
  ;(function listar(dir, profundidade = 0) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const alvo = path.join(dir, item.name)
      arvore.push(`${"  ".repeat(profundidade)}${item.isDirectory() ? "[d]" : "[f]"} ${item.name}`)
      if (item.isDirectory() && profundidade < 3) listar(alvo, profundidade + 1)
    }
  })(primeira)
  throw new Error(
    `fix-next-export-rsc deixou ${rotasSemAliases.length} de ${rotasComIndex.length} rota(s) sem aliases ` +
      `(ex.: ${exemplos}). Arvore de ${path.relative(outDir, primeira)}:\n${arvore.join("\n")}\n` +
      "O formato do export mudou de novo: veja se o payload virou " +
      "'__next.<rota>/__PAGE__.txt' ou outra forma. Sem alias, todo prefetch do " +
      "roteador da 404 no app empacotado. Build abortado.",
  )
}

// Guarda de boot: a janela do Tauri abre em `splash/` (tauri.conf.json -> app.windows.url).
// Se o export nao gerar `out/splash/index.html` (ou o `out/index.html` raiz), o WebView
// mostra "Arquivo nao encontrado / ERR_FILE_NOT_FOUND" ja na abertura — foi o bug da 1.0.85.
// Falhar o build AQUI impede que um bundle sem a tela inicial chegue aos jogadores.
const requiredBootFiles = ["index.html", path.join("splash", "index.html")]
const missingBootFiles = requiredBootFiles.filter(rel => !existsSync(path.join(outDir, rel)))
if (missingBootFiles.length > 0) {
  throw new Error(
    `Export incompleto: faltam arquivos de boot no out/ (${missingBootFiles.join(", ")}). ` +
    `A janela abre em 'splash/'; sem eles o jogo abre com ERR_FILE_NOT_FOUND. Build abortado.`,
  )
}
console.log("Boot files OK (index.html + splash/index.html).")
