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
  let atual = path.join(dir, entrada)
  if (!existsSync(atual) || !statSync(atual).isDirectory()) return null
  // Rota aninhada guarda os segmentos restantes como subpastas.
  for (let profundidade = 0; profundidade < 8; profundidade++) {
    const alvo = path.join(atual, "__PAGE__.txt")
    if (existsSync(alvo)) return alvo
    const sub = readdirSync(atual).find(e => statSync(path.join(atual, e)).isDirectory())
    if (!sub) return null
    atual = path.join(atual, sub)
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

    // A forma antiga (arquivo plano) primeiro; a nova (diretorio) como reserva.
    const sourcePath = sourceName ? path.join(dir, sourceName) : paginaDentroDoDiretorio(dir)
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
if (rotasComIndex.length > 0 && aliasesCriados === 0) {
  throw new Error(
    `fix-next-export-rsc nao criou nenhum alias para ${rotasComIndex.length} rota(s). ` +
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
