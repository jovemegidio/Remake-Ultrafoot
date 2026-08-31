import { spawnSync } from "node:child_process"
import {
  copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync,
  rmSync, statSync, writeFileSync,
} from "node:fs"
import path from "node:path"
import { resolve } from "node:path"

/**
 * BUILD PARA LOJA (Steam, Epic, GOG).
 *
 * Diferente da build normal em quatro pontos, e cada um deles é motivo de
 * reprovação na revisão da loja se ficar como está:
 *
 *  1. SEM AUTO-UPDATER. Quem distribui atualização na loja é a plataforma, pelos
 *     depots dela. Um jogo que baixa versão nova por fora quebra a verificação
 *     de integridade. Aqui o plugin sai do tauri.conf.json E a interface some,
 *     via NEXT_PUBLIC_ULTRAFOOT_LOJA (ver lib/loja.ts) — tirar só um dos dois
 *     deixaria metade do caminho ligada.
 *
 *  2. SEM O LAUNCHER DENTRO. `resources/launcher/*` fica de fora do pacote.
 *     Instalar outro aplicativo em silêncio é reprovação direta nas duas lojas,
 *     e na loja o launcher não teria função nenhuma: baixar, atualizar e
 *     reparar passam a ser dela.
 *
 *  3. SEM INSTALADOR. A loja sobe um DIRETÓRIO já instalado, não um .exe de
 *     setup. Por isso `--no-bundle`: o NSIS e o WiX não servem de nada aqui.
 *
 *  4. O tauri.conf.json é restaurado no `finally`, SEMPRE. Sem isso uma build
 *     de loja interrompida deixaria o repositório sem o updater e a próxima
 *     build normal sairia incapaz de se atualizar — falha silenciosa, do tipo
 *     que só aparece semanas depois no computador do jogador.
 *
 * ─── ⚠️ A PASTA NÃO É `target/release/` ──────────────────────────────────────
 *
 * Esta era a instrução deste script, e ela produzia um depot quebrado. Com
 * `--no-bundle` o Tauri NÃO copia `bundle.resources`: quem faz isso é o
 * empacotador, que acabamos de desligar. `target/release/` sai com o .exe, umas
 * DLLs, e mais nada — sem escudos, sem fotos, sem camisas, sem áudio. E junto
 * viriam `deps/`, `build/`, `.fingerprint/` e o incremental do cargo, que são
 * gigabytes de objeto de compilação sem serventia para o comprador.
 *
 * O jogo abriria. Só que sem imagem nenhuma — e é o tipo de defeito que só
 * aparece depois de a loja já ter publicado.
 *
 * Então a montagem é feita aqui, repetindo a semântica de `bundle.resources` e
 * lendo o PRÓPRIO tauri.conf.json em vez de uma lista copiada. Uma pasta de
 * recursos nova (uma competição, um lote de escudos) entra sozinha. Se aparecer
 * um padrão que este script não sabe expandir, ele PARA: recurso que falta vira
 * imagem em branco no jogo de quem pagou, e falha calada é o pior jeito de
 * descobrir isso.
 *
 * Uso:
 *   node scripts/build-loja.mjs                 # steam (padrão)
 *   node scripts/build-loja.mjs --loja epic
 *   node scripts/build-loja.mjs --so-montar     # remonta sem recompilar
 *
 * Saída: dist-loja/<loja>/ — é ESTA pasta que vai para o depot.
 */

const RAIZ = resolve(import.meta.dirname, "..")
const CONF = resolve(RAIZ, "src-tauri/tauri.conf.json")
const CONF_WINDOWS = resolve(RAIZ, "src-tauri/tauri.windows.conf.json")
const BACKUP = resolve(RAIZ, "src-tauri/tauri.conf.json.antes-da-loja")
const TAURI = resolve(RAIZ, "src-tauri")

const argv = process.argv.slice(2)
const valorDe = (nome, padrao) => {
  const i = argv.indexOf(nome)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : padrao
}
const LOJA = valorDe("--loja", "steam").toLowerCase()
const SO_MONTAR = argv.includes("--so-montar")
const SAIDA = resolve(RAIZ, "dist-loja", LOJA)

/** A única coisa que não pode viajar no pacote. */
const RECURSOS_EXCLUIDOS = ["resources/launcher/*"]

const humano = (b) =>
  b >= 2 ** 30 ? `${(b / 2 ** 30).toFixed(2)} GB` : `${(b / 2 ** 20).toFixed(1)} MB`

const passo = (t) => console.log(`\n── ${t}`)

function rodar(comando, argumentos, env) {
  const r = spawnSync(comando, argumentos, {
    stdio: "inherit",
    shell: true,
    cwd: RAIZ,
    env: { ...process.env, ...env },
  })
  if (r.status !== 0) throw new Error(`${comando} ${argumentos.join(" ")} falhou (${r.status})`)
}

// ─── 1. Compilar com o updater fora do caminho ───────────────────────────────

const original = readFileSync(CONF, "utf8")

if (!SO_MONTAR) {
  copyFileSync(CONF, BACKUP)
  try {
    const conf = JSON.parse(original)

    if (conf.plugins?.updater) {
      delete conf.plugins.updater
      console.log("[loja] plugin updater removido do tauri.conf.json")
    } else {
      console.log("[loja] tauri.conf.json já não declarava o updater")
    }

    // A loja identifica o produto pelo appid dela; manter um identifier separado
    // evita que a build de loja e a build própria disputem o mesmo registro de
    // aplicativo (e o mesmo diretório de dados) na mesma máquina.
    //
    // ⚠️ CONSEQUÊNCIA A CONHECER: o identifier decide `app_data_dir()`, que é
    // onde mora o save. Quem jogou na build própria e depois comprou na loja
    // NÃO encontra as carreiras antigas — elas ficam em
    // %APPDATA%/com.ultrafoot.remake, e a build de loja lê de
    // %APPDATA%/com.ultrafoot.remake.loja. É o preço de as duas coexistirem sem
    // se atropelar; se um dia a escolha for a outra, é esta linha que muda.
    conf.identifier = `${conf.identifier}.loja`

    writeFileSync(CONF, `${JSON.stringify(conf, null, 2)}\n`)

    passo(`compilando o jogo para "${LOJA}"`)
    console.log("   (o beforeBuildCommand roda o next build; leva alguns minutos)")
    // As DUAS variáveis: o Rust lê `ULTRAFOOT_LOJA` por `option_env!`, o front
    // lê `NEXT_PUBLIC_ULTRAFOOT_LOJA` (o Next substitui o valor no bundle).
    rodar("npx", ["tauri", "build", "--no-bundle"], {
      ULTRAFOOT_LOJA: LOJA,
      NEXT_PUBLIC_ULTRAFOOT_LOJA: LOJA,
    })
  } finally {
    writeFileSync(CONF, original)
    rmSync(BACKUP, { force: true })
    console.log("[loja] tauri.conf.json restaurado")
  }
} else {
  passo("pulando a compilação (--so-montar)")
}

// ─── 2. Montar a pasta que vai para o depot ──────────────────────────────────

/** Lê o tauri.conf.json + o override da plataforma, como o próprio Tauri faz. */
function configDoTauri() {
  const base = JSON.parse(readFileSync(CONF, "utf8"))
  if (process.platform === "win32" && existsSync(CONF_WINDOWS)) {
    const w = JSON.parse(readFileSync(CONF_WINDOWS, "utf8"))
    base.bundle = base.bundle ?? {}
    // `resources` é um mapa: o Tauri funde, não substitui.
    base.bundle.resources = { ...(base.bundle.resources ?? {}), ...(w.bundle?.resources ?? {}) }
  }
  return base
}

/**
 * Expande um padrão de `bundle.resources` em pares [origem, destinoRelativo].
 *
 * Entende o que o projeto usa: caminho literal, `dir/*` e `dir/**` + `/*`.
 * Qualquer outra coisa é ERRO de propósito — ver a nota do cabeçalho.
 */
function expandir(padrao, destino) {
  const temGlob = (s) => /[*?[]/.test(s)

  if (!temGlob(padrao)) {
    const origem = resolve(TAURI, padrao)
    if (!existsSync(origem)) {
      throw new Error(`recurso declarado no tauri.conf.json não existe: ${padrao}`)
    }
    return [[origem, destino.endsWith("/") ? path.join(destino, path.basename(padrao)) : destino]]
  }

  const partes = padrao.split("/")
  const corte = partes.findIndex(temGlob)
  const baseRel = partes.slice(0, corte).join("/")
  const resto = partes.slice(corte).join("/")
  const base = resolve(TAURI, baseRel)

  if (resto !== "*" && resto !== "**/*") {
    throw new Error(
      `padrão de recurso não suportado por este script: "${padrao}".\n` +
      "  Ensine-o aqui antes de publicar — recurso que falta vira imagem em " +
      "branco no jogo de quem comprou, e ninguém percebe no build.",
    )
  }
  if (!existsSync(base)) throw new Error(`pasta de recurso não existe: ${baseRel}`)
  if (!destino.endsWith("/")) {
    throw new Error(`destino de glob precisa terminar em "/": ${padrao} -> ${destino}`)
  }

  const pares = []
  const recursivo = resto === "**/*"
  const andar = (dir, relativo) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const cheio = path.join(dir, item.name)
      const rel = relativo ? `${relativo}/${item.name}` : item.name
      if (item.isDirectory()) {
        if (recursivo) andar(cheio, rel)
        continue
      }
      pares.push([cheio, path.join(destino, rel)])
    }
  }
  andar(base, "")
  return pares
}

passo(`montando ${path.relative(RAIZ, SAIDA)}`)

const conf = configDoTauri()
const exeCompilado = resolve(TAURI, "target/release/ultrafoot.exe")
if (!existsSync(exeCompilado)) {
  throw new Error(`não achei o executável compilado: ${exeCompilado}`)
}
// Um .exe pequeno demais é build quebrado que "passou": o front vai EMBUTIDO no
// binário, então ele nunca é pequeno.
const tamanhoExe = statSync(exeCompilado).size
if (tamanhoExe < 50 * 2 ** 20) {
  throw new Error(`o executável tem só ${humano(tamanhoExe)} — o front não foi embutido`)
}

rmSync(SAIDA, { recursive: true, force: true })
mkdirSync(SAIDA, { recursive: true })

// O nome que o jogador e a loja veem é o `productName`, não o nome do crate.
const nomeDoExe = `${conf.productName}.exe`
copyFileSync(exeCompilado, path.join(SAIDA, nomeDoExe))
console.log(`   ${nomeDoExe.padEnd(44)} ${humano(tamanhoExe)}`)

let arquivos = 1
let bytes = tamanhoExe

for (const [padrao, destino] of Object.entries(conf.bundle.resources ?? {})) {
  if (RECURSOS_EXCLUIDOS.includes(padrao)) {
    console.log(`   ${"(fora do pacote de loja)".padEnd(44)} ${padrao}`)
    continue
  }
  const pares = expandir(padrao, destino)
  let grupo = 0
  for (const [origem, relativo] of pares) {
    const alvo = path.join(SAIDA, relativo)
    mkdirSync(path.dirname(alvo), { recursive: true })
    cpSync(origem, alvo)
    const t = statSync(origem).size
    grupo += t
    bytes += t
    arquivos++
  }
  const rotulo = destino.replace(/\/$/, "") || path.basename(destino)
  console.log(`   ${rotulo.padEnd(44)} ${String(pares.length).padStart(6)} arq  ${humano(grupo)}`)
}

// ─── 3. Conferir antes de dizer que deu certo ────────────────────────────────

passo("conferindo a pasta")

const problemas = []
if (existsSync(path.join(SAIDA, "launcher"))) {
  problemas.push("a pasta 'launcher' foi parar no pacote — as lojas reprovam por isso")
}
// Amostra do conteúdo pesado: se um destes estiver vazio, o jogo abre com
// escudos e fotos em branco, e o defeito só aparece na mão do comprador.
for (const obrigatorio of ["escudos", "jogadores", "camisas", "trofeus"]) {
  const dir = path.join(SAIDA, obrigatorio)
  if (!existsSync(dir) || readdirSync(dir).length === 0) {
    problemas.push(`'${obrigatorio}' está vazia ou não foi copiada`)
  }
}
if (!existsSync(path.join(SAIDA, "discord_partner_sdk.dll"))) {
  problemas.push("discord_partner_sdk.dll não foi copiada — o jogo não abre sem ela")
}

if (!existsSync(path.join(SAIDA, "prerequisites", "MicrosoftEdgeWebview2Setup.exe"))) {
  console.log(
    "   AVISO: sem MicrosoftEdgeWebview2Setup.exe em resources/prerequisites/.\n" +
    "   Não há instalador NSIS aqui, então ninguém instala o WebView2 na máquina\n" +
    "   do comprador — e sem ele o jogo abre em janela branca. Ver 'WebView2' em\n" +
    "   LOJA.md antes de subir.",
  )
}

if (problemas.length > 0) {
  console.error("\nA PASTA NÃO ESTÁ PRONTA:")
  for (const p of problemas) console.error(`  • ${p}`)
  process.exit(1)
}

console.log(`   ${arquivos.toLocaleString("pt-BR")} arquivos · ${humano(bytes)}`)
console.log(`\npronto: ${SAIDA}`)
console.log("\nConfira à mão antes de subir (LOJA.md tem a lista inteira):")
console.log("  • o jogo abre sem o Launcher e sem rede;")
console.log("  • não aparece 'Registrar' no menu, e o selo diz Registrado;")
console.log("  • não aparece aviso de atualização;")
console.log("  • escudos, fotos e camisas aparecem nas telas.")

// ⚠️ O DISCO DE BUILD FICOU COM O BINARIO DE LOJA.
//
// `out/` e `target/release/ultrafoot.exe` agora carregam o front e o executavel
// COM a marca da loja. O instalador NSIS da venda direta que estiver em
// `target/release/bundle/` e mais velho e nao foi tocado — mas a proxima build
// normal precisa ser feita do zero, senao um artefato de loja pode acabar
// publicado no canal proprio: la o jogo diria "registrado" para todo mundo e
// nunca ofereceria atualizacao.
console.log(
  "\n⚠️  out/ e target/release/ agora contêm a build de LOJA.\n" +
  "   Rode uma build normal antes de publicar no canal próprio.",
)
