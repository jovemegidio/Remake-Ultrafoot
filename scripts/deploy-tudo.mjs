// DEPLOY UNIFICADO — jogo e launcher, VPS e GitHub, Windows, Linux e macOS.
//
//   node scripts/deploy-tudo.mjs                # mostra o que faria
//   node scripts/deploy-tudo.mjs --publicar     # publica de verdade
//   node scripts/deploy-tudo.mjs --publicar --so-launcher
//
// Antes cada peça era publicada à mão, em ordens diferentes, e sempre faltava
// alguma: o .exe subia e o manifesto não, ou a VPS ficava nova e o GitHub velho.
// Este script faz tudo na mesma ordem, sempre, e CONFERE o resultado.
//
// DUAS REGRAS QUE VÊM DE ERRO REAL, não de preferência:
//
//  1. O BINÁRIO SOBE ANTES DO MANIFESTO. O manifesto é o que manda o jogador
//     baixar. Publicado primeiro, ele aponta para um arquivo que ainda não
//     existe e todo mundo recebe erro de download.
//
//  2. CONFERÊNCIA PELO CORPO, NUNCA PELO STATUS. O nginx deste site responde
//     200 com o index.html do jogo para qualquer caminho que não exista. Testar
//     por "HTTP 200" já me fez anunciar duas vezes que algo estava no ar quando
//     o servidor devolvia a página do jogo.

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  readFileSync, writeFileSync, copyFileSync, existsSync, statSync,
  openSync, readSync, closeSync,
} from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const publicar = process.argv.includes("--publicar")
const soLauncher = process.argv.includes("--so-launcher")
const soJogo = process.argv.includes("--so-jogo")

const VPS = "root@179.198.103.30"
const SITE = "https://ultrafoot.179-198-103-30.sslip.io"
const REPO = "jovemegidio/Ultrafoot26"
const CHAVE = process.env.ULTRAFOOT_VPS_KEY
// As notas aparecem para o jogador na tela de atualizacao.
const NOTAS_DO_JOGO = process.env.RELEASE_NOTES
  ?? `Ultrafoot 26 v${JSON.parse(readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "package.json"), "utf-8")).version}`

const versao = (arquivo) => JSON.parse(readFileSync(path.join(RAIZ, arquivo), "utf-8")).version

const VERSAO_JOGO = versao("package.json")
const VERSAO_LAUNCHER = versao("Launcher/package.json")

// Os instaladores saem do disco LOCAL: o G: é unidade de rede e o build do
// Tauri não roda nele (ver a memória do projeto).
const DISCO = "C:/Ultrafoot"
const EXE_JOGO = `${DISCO}/src-tauri/target/release/bundle/nsis/Ultrafoot 26_${VERSAO_JOGO}_x64-setup.exe`
const EXE_LAUNCHER = `${DISCO}/Launcher/src-tauri/target/release/bundle/nsis/Ultrafoot Launcher_${VERSAO_LAUNCHER}_x64-setup.exe`

function passo(texto) {
  console.log(`\n\u2192 ${texto}`)
}

function rodar(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf-8", ...opts })
}

function corpoDe(url) {
  return rodar("curl", ["-sL", "--max-time", "40", `${url}${url.includes("?") ? "&" : "?"}cb=${Date.now()}`])
}

/** Lê `campo` de um JSON publicado. Devolve null quando não veio JSON. */
function campoPublicado(url, campo) {
  try {
    return JSON.parse(corpoDe(url))?.[campo] ?? null
  } catch {
    return null
  }
}

function enviarParaVps(destino, conteudo) {
  if (!CHAVE) throw new Error("defina ULTRAFOOT_VPS_KEY com o caminho da chave SSH")
  rodar("ssh", ["-i", CHAVE, "-o", "ConnectTimeout=20", VPS, `cat > ${destino}`],
    { input: conteudo, stdio: ["pipe", "inherit", "inherit"] })
}

/**
 * A VPS PUXA o binário do GitHub em vez de recebê-lo daqui.
 *
 * Enviar 550 MB pela banda de subida de casa leva dezenas de minutos; entre dois
 * servidores são segundos. E conferimos o SHA-256 dos dois lados, porque uma
 * cópia truncada só apareceria como jogo corrompido na máquina do jogador.
 */
function espelharNaVps(nomeNoGithub, destino, hashLocal) {
  if (!CHAVE) throw new Error("defina ULTRAFOOT_VPS_KEY com o caminho da chave SSH")
  const url = `https://github.com/${REPO}/releases/download/${nomeNoGithub.tag}/${nomeNoGithub.arquivo}`
  // KEEPALIVE OBRIGATORIO. Baixar 590 MB e depois calcular o sha256 deles leva
  // varios minutos SEM UM BYTE trafegando na sessao SSH — e em 31/07/2026 a
  // conexao foi derrubada exatamente no `sha256sum`, com "Connection reset by
  // peer", abortando o deploy DEPOIS de o GitHub ja estar publicado (o arquivo
  // ja tinha baixado inteiro; so faltava conferir e mover). Os pacotes de
  // keepalive mantem a sessao viva durante o silencio.
  const sshLongo = ["-o", "ConnectTimeout=20", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=40"]
  // `.novo` de uma tentativa anterior interrompida seria confundido com o
  // download novo — o curl com -o sobrescreve, mas ser explicito evita surpresa.
  const remoto = rodar("ssh", ["-i", CHAVE, ...sshLongo, VPS,
    `cd $(dirname ${destino}) && rm -f .novo && curl -fsSL -o .novo "${url}" && sha256sum .novo | cut -d" " -f1`]).trim()
  if (remoto !== hashLocal) {
    rodar("ssh", ["-i", CHAVE, VPS, `rm -f $(dirname ${destino})/.novo`])
    throw new Error(`o arquivo que chegou na VPS nao confere (${remoto.slice(0, 12)} != ${hashLocal.slice(0, 12)})`)
  }
  rodar("ssh", ["-i", CHAVE, VPS, `cd $(dirname ${destino}) && mv .novo ${path.posix.basename(destino)} && chmod 644 ${path.posix.basename(destino)}`])
}

/**
 * SHA-256 do arquivo, calculado pelo PROPRIO Node.
 *
 * Antes isto chamava `sha256sum`, que existe no Git Bash e NAO no PowerShell: o
 * deploy morria com `spawnSync sha256sum ENOENT` antes de subir qualquer coisa,
 * dependendo de qual terminal a pessoa abriu. Le em pedacos de 8 MB porque o
 * instalador do jogo passa de 500 MB e carregar tudo na memoria de uma vez seria
 * desperdicio.
 */
function sha(arquivo) {
  const h = createHash("sha256")
  const fd = openSync(arquivo, "r")
  try {
    const buf = Buffer.alloc(8 * 1024 * 1024)
    for (;;) {
      const lidos = readSync(fd, buf, 0, buf.length, null)
      if (lidos === 0) break
      h.update(buf.subarray(0, lidos))
    }
  } finally {
    closeSync(fd)
  }
  return h.digest("hex")
}

// ─── Plano ───────────────────────────────────────────────────────────────────

console.log("DEPLOY UNIFICADO DO ULTRAFOOT")
console.log(`  jogo      ${VERSAO_JOGO}      ${existsSync(EXE_JOGO) ? "instalador pronto" : "SEM INSTALADOR"}`)
console.log(`  launcher  ${VERSAO_LAUNCHER}  ${existsSync(EXE_LAUNCHER) ? "instalador pronto" : "SEM INSTALADOR"}`)
console.log(`  no ar     jogo ${campoPublicado(`${SITE}/downloads/latest.json`, "version") ?? "?"}`
  + ` · launcher ${campoPublicado(`${SITE}/downloads/launcher.json`, "version") ?? "?"}`)

if (!publicar) {
  console.log("\nNada foi enviado. Rode com --publicar para valer.")
  process.exit(0)
}

// ANTES DE SUBIR QUALQUER COISA: as abas Novidades e Changelog do launcher saem
// do launcher-config.json, que ninguem lembrava de atualizar — o jogo chegou na
// 1.0.201 com o launcher anunciando a 1.0.175. Reprovar aqui custa um commit;
// reprovar depois deixaria o binario no ar e a novidade velha.
if (!soLauncher) {
  passo("conferindo as novidades do launcher")
  rodar("node", ["scripts/publicar-launcher-config.mjs"], {
    cwd: RAIZ,
    stdio: "inherit",
    env: { ...process.env, EXIGIR_VERSAO: VERSAO_JOGO },
  })
}

// ─── Launcher ────────────────────────────────────────────────────────────────

if (!soJogo) {
  if (!existsSync(EXE_LAUNCHER)) throw new Error(`instalador do launcher nao encontrado: ${EXE_LAUNCHER}`)
  const hash = sha(EXE_LAUNCHER)

  passo(`launcher ${VERSAO_LAUNCHER}: binario para o GitHub`)
  const copia = path.join(RAIZ, "Launcher", "Ultrafoot-Launcher-Setup.exe")
  // `cp` e do Git Bash; no PowerShell nao existe. Copia pelo Node e nao depende
  // de qual terminal a pessoa abriu — mesmo motivo do `sha` acima.
  copyFileSync(EXE_LAUNCHER, copia)
  rodar("gh", ["release", "upload", "launcher", copia, "--repo", REPO, "--clobber"], { stdio: "inherit" })

  passo("launcher: espelhando na VPS")
  espelharNaVps({ tag: "launcher", arquivo: "Ultrafoot-Launcher-Setup.exe" },
    "/var/www/ultrafoot/downloads/Ultrafoot-Launcher-Setup.exe", hash)

  passo("launcher: manifesto (depois do binario)")
  const manifesto = readFileSync(path.join(RAIZ, "services/cloud-save-server/launcher.json"), "utf-8")
  if (JSON.parse(manifesto).version !== VERSAO_LAUNCHER) {
    throw new Error(`launcher.json diz ${JSON.parse(manifesto).version}, mas o build e ${VERSAO_LAUNCHER}`)
  }
  const arqManifesto = path.join(RAIZ, "services/cloud-save-server/launcher.json")
  rodar("gh", ["release", "upload", "launcher", arqManifesto, "--repo", REPO, "--clobber"], { stdio: "inherit" })
  enviarParaVps("/var/www/ultrafoot/downloads/launcher.json", manifesto)

  const vps = campoPublicado(`${SITE}/downloads/launcher.json`, "version")
  const gh = campoPublicado(`https://github.com/${REPO}/releases/download/launcher/launcher.json`, "version")
  if (vps !== VERSAO_LAUNCHER || gh !== VERSAO_LAUNCHER) {
    throw new Error(`launcher nao confere: VPS ${vps}, GitHub ${gh}, esperado ${VERSAO_LAUNCHER}`)
  }
  console.log(`  ok — launcher ${VERSAO_LAUNCHER} nos dois canais`)
}

// ─── Jogo ────────────────────────────────────────────────────────────────────

if (!soLauncher) {
  if (!existsSync(EXE_JOGO)) throw new Error(`instalador do jogo nao encontrado: ${EXE_JOGO}`)
  const sigPath = `${EXE_JOGO}.sig`
  if (!existsSync(sigPath)) throw new Error(`assinatura do instalador nao encontrada: ${sigPath}`)

  const hash = sha(EXE_JOGO)
  const tamanhoMb = Math.round(statSync(EXE_JOGO).size / (1024 * 1024))
  const nomeRemoto = `Ultrafoot.26_${VERSAO_JOGO}_x64-setup.exe`
  const tag = `build-${VERSAO_JOGO}`

  // O GitHub e a assinatura ficam com o publish-release.mjs, que ja faz isso ha
  // varias versoes. Reescrever aqui so criaria uma segunda verdade sobre como o
  // latest.json e montado.
  passo(`jogo ${VERSAO_JOGO}: GitHub (instalador, assinatura e latest.json)`)
  rodar("node", ["scripts/publish-release.mjs", "--publish"], {
    cwd: RAIZ,
    stdio: "inherit",
    env: {
      ...process.env,
      ULTRAFOOT_BUILD_DIR: path.dirname(EXE_JOGO),
      RELEASE_NOTES: NOTAS_DO_JOGO,
    },
  })

  passo("jogo: espelhando o instalador na VPS")
  espelharNaVps({ tag, arquivo: nomeRemoto }, `/var/www/ultrafoot/downloads/${nomeRemoto}`, hash)

  passo("jogo: manifesto da VPS (depois do binario)")
  // A VPS precisa do MESMO manifesto apontando para ela mesma — e do sha256 e do
  // tamanho, que o launcher usa para mostrar o progresso do download.
  const manifestoVps = {
    version: VERSAO_JOGO,
    notes: NOTAS_DO_JOGO,
    sizeMb: tamanhoMb,
    sha256: hash.toUpperCase(),
    platforms: {
      "windows-x86_64": {
        signature: readFileSync(sigPath, "utf-8").trim(),
        url: `${SITE}/downloads/${nomeRemoto}`,
      },
    },
  }
  const corpoManifesto = JSON.stringify(manifestoVps, null, 2)
  enviarParaVps("/var/www/ultrafoot/downloads/latest.json", corpoManifesto)
  writeFileSync(path.join(RAIZ, "services/cloud-save-server/latest.json"), corpoManifesto)

  const vps = campoPublicado(`${SITE}/downloads/latest.json`, "version")
  if (vps !== VERSAO_JOGO) throw new Error(`jogo nao confere na VPS: ${vps}, esperado ${VERSAO_JOGO}`)
  console.log(`  ok — jogo ${VERSAO_JOGO} publicado (${tamanhoMb} MB)`)
}

// ─── Novidades do launcher ───────────────────────────────────────────────────
//
// Sempre, nas duas modalidades: e o unico canal em que o jogador LE o que mudou.

passo("launcher: novidades e changelog")
rodar("node", ["scripts/publicar-launcher-config.mjs", "--publicar"], { cwd: RAIZ, stdio: "inherit" })

// ─── Linux e macOS ───────────────────────────────────────────────────────────
//
// Estes saem da CI, que compila a partir do que está COMMITADO. Um build local
// verde não diz nada sobre eles: já publiquei Windows com um arquivo que nunca
// foi commitado, e só o Linux quebrou.

passo("Linux e macOS: disparando a CI")
const ramo = rodar("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim()

/**
 * O disparo da CI so vale se o que ela vai compilar JA ESTA COMMITADO.
 *
 * Em 29/07/26 a 1.0.21 do launcher subiu para o Windows e a CI foi disparada no
 * mesmo comando — mas o commit ainda nao existia, e Linux/macOS receberam pacotes
 * com o codigo da 1.0.20. O aviso de "alteracoes nao commitadas" existia e nao
 * impediu nada. Agora a gente NAO dispara e diz o que fazer.
 *
 * A checagem e por CAMINHO, e nao pela arvore toda: neste repositorio quase
 * sempre ha trabalho do jogo em andamento, e olhar o `git status` inteiro faria
 * o launcher deixar de publicar por causa de arquivo que a CI dele nem le.
 */
function dispararSeCommitado(workflow, caminhos, oQue) {
  const sujo = rodar("git", ["status", "--porcelain", "--untracked-files=no", "--", ...caminhos]).trim()
  if (sujo) {
    console.log(`  NAO disparei ${oQue}: ha alteracao nao commitada no que a CI compila.`)
    for (const linha of sujo.split("\n").slice(0, 10)) console.log(`    ${linha}`)
    console.log(`  Commite e rode:  gh workflow run ${workflow} --ref ${ramo}`)
    return false
  }
  rodar("gh", ["workflow", "run", workflow, "--ref", ramo], { stdio: "inherit" })
  console.log(`  ${oQue} disparado — acompanhe com: gh run list --limit 4`)
  return true
}

if (!soLauncher) {
  dispararSeCommitado("desktop-platforms.yml",
    ["app", "components", "lib", "data", "hooks", "public", "src-tauri", "package.json"],
    "jogo (Linux/macOS)")
}
if (!soJogo) {
  dispararSeCommitado("launcher-platforms.yml", ["Launcher"], "launcher (Linux/macOS)")
}

console.log("\nDEPLOY CONCLUIDO.")
