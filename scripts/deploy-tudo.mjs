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
/** Valvula de escape dos gates de publicacao. Existe para emergencia, nao para rotina. */
const pularGates = process.argv.includes("--pular-gates")

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
  const dir = path.posix.dirname(destino)
  const base = path.posix.basename(destino)
  // ⚠️ NOME DE STAGING EXCLUSIVO DESTE ARQUIVO — nao voltar para `.novo`.
  //
  // Jogo e launcher gravavam no MESMO `.novo`, no mesmo diretorio. Em 02/08/2026
  // o launcher da VPS amanheceu com 94 MB (o instalador tem 17,5) e todo jogador
  // em versao anterior entrou em LOOP: baixava o arquivo quebrado, a instalacao
  // falhava em silencio, o launcher reabria na mesma versao e recomecava.
  const temp = `.novo-${base}`

  // KEEPALIVE OBRIGATORIO. Baixar 590 MB e depois calcular o sha256 deles leva
  // varios minutos SEM UM BYTE trafegando na sessao SSH — e em 31/07/2026 a
  // conexao foi derrubada exatamente no `sha256sum`, com "Connection reset by
  // peer", abortando o deploy DEPOIS de o GitHub ja estar publicado.
  const sshLongo = ["-o", "ConnectTimeout=20", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=40"]

  // ⚠️ CONFERIR E MOVER NA MESMA SESSAO SSH.
  //
  // Antes eram duas: uma calculava o hash, a outra movia. Entre as duas havia uma
  // janela em que outro processo podia trocar o arquivo de staging — e ai o que
  // ia para o destino nao era o que tinha sido conferido. Classico time-of-check
  // versus time-of-use, e a explicacao mais provavel do launcher de 94 MB.
  //
  // `--http1.1` porque o curl da VPS morreu com "HTTP/2 stream not closed
  // cleanly: PROTOCOL_ERROR" ao baixar do GitHub; as tentativas cobrem o 404
  // transitorio que o CDN devolve logo apos um upload.
  const script = [
    "set -e",
    `cd ${dir}`,
    `rm -f '${temp}'`,
    `curl --http1.1 -fsSL --retry 5 --retry-all-errors --retry-delay 8 -o '${temp}' "${url}"`,
    `recebido=$(sha256sum '${temp}' | cut -d' ' -f1)`,
    `if [ "$recebido" != "${hashLocal}" ]; then rm -f '${temp}'; echo "DIVERGENTE:$recebido" >&2; exit 1; fi`,
    `mv '${temp}' '${base}'`,
    `chmod 644 '${base}'`,
    // Confere DE NOVO, agora no arquivo que ficou publicado: e o unico hash que
    // interessa, porque e o que o jogador vai baixar.
    `sha256sum '${base}' | cut -d' ' -f1`,
  ].join("\n")

  const noAr = rodar("ssh", ["-i", CHAVE, ...sshLongo, VPS, script]).trim().split("\n").pop().trim()
  if (noAr !== hashLocal) {
    throw new Error(`o arquivo publicado na VPS nao confere (${noAr.slice(0, 12)} != ${hashLocal.slice(0, 12)})`)
  }
}

/**
 * Confere pela URL PUBLICA que o arquivo servido tem o tamanho esperado.
 *
 * O hash acima prova o que esta em disco; isto prova o que o nginx entrega —
 * sao coisas diferentes quando ha regra de location errada, cache ou proxy no
 * caminho. Barato: uma requisicao de cabecalho, sem baixar o arquivo.
 */
function conferirNoAr(url, bytesEsperados) {
  const saida = rodar("curl", ["-sI", "--max-time", "60", url])
  const linha = saida.split("\n").find(l => /^content-length:/i.test(l.trim()))
  const servido = Number((linha ?? "").split(":")[1] ?? 0)
  if (servido !== bytesEsperados) {
    throw new Error(`o servidor entrega ${servido} bytes em ${url}, esperado ${bytesEsperados}`)
  }
  console.log(`  ok — ${path.posix.basename(url)} servido com ${servido} bytes`)
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

// ─── GATES ANTES DE PUBLICAR ────────────────────────────────────────────────
//
// Nenhum destes rodava no caminho de publicacao. O `lint` existia no
// package.json e nunca era chamado; o `qa:features` chamava `rg` e morria com
// ENOENT antes da primeira verificacao — falha que ninguem lia como reprovacao.
// Resultado pratico: build subia com gate "passando" sem ter olhado nada.
//
// Reprovar aqui custa um commit. Reprovar depois deixa o binario no ar.
// ⚠️ NUNCA `npx` AQUI — os gates rodam por `execFileSync`, e no Windows isso
// significa ENOENT ANTES de qualquer verificacao acontecer.
//
// `npx` nao e um .exe: e `npx.cmd`/`npx.ps1`. O `execFileSync` (sem `shell: true`,
// que nao da para ligar porque os outros comandos daqui levam caminhos com
// espaco) nao faz resolucao por PATHEXT e falha na hora. Resultado medido em
// 05/08/2026: TODA publicacao morria em "GATE REPROVADO: type-check" no MESMO
// SEGUNDO em que comecava — um tsc de verdade leva ~90s. O gate criado para
// impedir build ruim de subir nunca chegou a olhar uma linha de codigo, e a
// unica saida era `--pular-gates`, ou seja, publicar sem verificacao nenhuma.
//
// Chamando `node` (que E um .exe) com o caminho do modulo local, o gate roda.
const GATES = [
  { nome: "type-check", cmd: "node", args: ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"] },
  { nome: "lint", cmd: "node", args: ["node_modules/eslint/bin/eslint.js", "app", "components", "lib", "hooks"] },
  { nome: "lacunas de funcionalidade", cmd: "node", args: ["scripts/audit-feature-gaps.mjs"] },
  { nome: "regulamentos das competicoes", cmd: "node", args: ["node_modules/tsx/dist/cli.mjs", "scripts/qa-competition-regulations.ts"] },
  { nome: "regras do jogo", cmd: "node", args: ["node_modules/tsx/dist/cli.mjs", "scripts/test-contrato-base-de-tempo.ts"] },
  { nome: "piso de elenco", cmd: "node", args: ["node_modules/tsx/dist/cli.mjs", "scripts/test-piso-de-elenco.ts"] },
  // Perder o save numa atualizacao e o pior defeito possivel: nao ha suporte que
  // devolva a carreira. Ver lib/save-system.ts (as tres camadas).
  { nome: "save protegido na atualizacao", cmd: "node", args: ["node_modules/tsx/dist/cli.mjs", "scripts/test-save-protegido.ts"] },
  // Escudo/uniforme que nao resolve no app instalado passou TRES versoes no ar
  // (1.0.266 a 1.0.268) sem ninguem perceber no build. Ver o cabecalho do teste.
  { nome: "escudo e uniforme no app instalado", cmd: "node", args: ["node_modules/tsx/dist/cli.mjs", "scripts/test-escudo-no-app-instalado.ts"] },
  // A rotina da semana modula CARGA DE TREINO e RECUPERACAO de todo o elenco.
  // Um erro aqui nao aparece na tela: aparece semanas depois, no elenco moido ou
  // no elenco que nunca evolui. A trava que mais importa e "vespera de jogo nunca
  // e treino" — sem ela a interface entrega o time cansado em campo.
  { nome: "rotina da semana", cmd: "node", args: ["node_modules/tsx/dist/cli.mjs", "scripts/test-rotina-da-semana.ts"] },
]
// ⚠️ OS GATES RODAM NO DISCO DE BUILD, NAO NO REPOSITORIO.
//
// Com `cwd: RAIZ` (o G:) eles REPROVAVAM SEMPRE, e por um motivo que nao tinha
// nada a ver com o codigo: o G: e unidade de rede e nao tem `node_modules`,
// entao `npx tsc` cai num pacote-isca do npm que imprime "This is not the tsc
// command you are looking for" e sai != 0. Toda publicacao morria em
// "GATE REPROVADO: type-check", e a unica saida era `--pular-gates` — ou seja,
// o gate criado para impedir build ruim de subir estava impedindo QUALQUER build
// de subir, e empurrando todo mundo para o caminho sem verificacao nenhuma.
//
// `C:/Ultrafoot` e onde o `npm install` existe e onde o instalador foi
// compilado: e o unico lugar em que verificar significa alguma coisa.
// Ver a memoria do projeto sobre type-check falso no G:.
if (!pularGates) {
  for (const gate of GATES) {
    passo(`gate: ${gate.nome}`)
    try {
      rodar(gate.cmd, gate.args, { cwd: DISCO, stdio: "inherit" })
    } catch {
      console.error(`\nGATE REPROVADO: ${gate.nome}. Nada foi publicado.`)
      console.error("Se precisar publicar assim mesmo, rode com --pular-gates e assuma o risco.")
      process.exit(1)
    }
  }
} else {
  console.log("\n⚠️  GATES PULADOS por --pular-gates. Voce esta publicando sem verificacao.")
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

  conferirNoAr(`${SITE}/downloads/Ultrafoot-Launcher-Setup.exe`, statSync(EXE_LAUNCHER).size)

  passo("launcher: manifesto (depois do binario)")
  const arqManifesto = path.join(RAIZ, "services/cloud-save-server/launcher.json")
  const manifestoLido = JSON.parse(readFileSync(arqManifesto, "utf-8"))
  if (manifestoLido.version !== VERSAO_LAUNCHER) {
    throw new Error(`launcher.json diz ${manifestoLido.version}, mas o build e ${VERSAO_LAUNCHER}`)
  }
  // ⚠️ SHA256 E TAMANHO SAO O QUE PERMITE O LAUNCHER RECUSAR UM ARQUIVO RUIM.
  //
  // Sem eles o launcher baixava o que viesse e EXECUTAVA como instalador. Em
  // 02/08/2026 o que veio tinha 94 MB de lixo: a instalacao falhava calada, o
  // launcher reabria na versao velha e tentava outra vez, para sempre. O jogo ja
  // publicava `sha256` no latest.json; o launcher nao tinha equivalente.
  manifestoLido.sha256 = hash.toUpperCase()
  manifestoLido.size = statSync(EXE_LAUNCHER).size
  const manifesto = JSON.stringify(manifestoLido, null, 2)
  writeFileSync(arqManifesto, manifesto)
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

  // ─── Atualizacao diferencial ───
  //
  // O campo `manifesto` e o que LIGA o delta: com ele o launcher baixa so os
  // arquivos que mudaram; sem ele, o instalador inteiro, como sempre.
  //
  // Ele so entra se o manifesto REALMENTE estiver publicado nesta versao.
  // Anunciar um manifesto que nao existe faria todo launcher perder tempo com um
  // 404 antes de cair no instalador — e este objeto e montado do zero a cada
  // publicacao, entao um campo escrito na mao no latest.json se perderia aqui na
  // proxima versao. Gerar com `node scripts/gerar-manifesto.mjs`.
  //
  // So na VPS de proposito: os blobs moram nela. Com a VPS fora do ar o
  // launcher cai no latest.json do GitHub, e ali o delta NAO pode ser anunciado
  // — nao haveria de onde baixar os arquivos.
  const urlDoManifesto = `${SITE}/downloads/manifesto-${VERSAO_JOGO}.json`
  let manifestoDeArquivos = null
  try {
    if (JSON.parse(corpoDe(urlDoManifesto))?.versao === VERSAO_JOGO) {
      manifestoDeArquivos = urlDoManifesto
    }
  } catch {
    /* sem manifesto publicado: segue no instalador completo */
  }
  console.log(manifestoDeArquivos
    ? `  delta ligado — manifesto-${VERSAO_JOGO}.json publicado`
    : `  delta desligado — sem manifesto-${VERSAO_JOGO}.json (instalador completo)`)

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
        ...(manifestoDeArquivos ? { manifesto: manifestoDeArquivos } : {}),
      },
    },
  }
  const corpoManifesto = JSON.stringify(manifestoVps, null, 2)
  enviarParaVps("/var/www/ultrafoot/downloads/latest.json", corpoManifesto)
  writeFileSync(path.join(RAIZ, "services/cloud-save-server/latest.json"), corpoManifesto)

  const vps = campoPublicado(`${SITE}/downloads/latest.json`, "version")
  if (vps !== VERSAO_JOGO) throw new Error(`jogo nao confere na VPS: ${vps}, esperado ${VERSAO_JOGO}`)
  conferirNoAr(`${SITE}/downloads/${nomeRemoto}`, statSync(EXE_JOGO).size)
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

// ─── Canal de atualizacao: RECARIMBO ─────────────────────────────────────────
//
// ⚠️ SEM ISTO, TODA BUILD APAGA O CANAL PARA QUEM ATUALIZA. O cliente so aceita
// pacote com `publicado_em` MAIOR que o selo da build (`NEXT_PUBLIC_SELO_DO_BUILD`,
// que e a hora da compilacao). O raciocinio esta em lib/atualizacao-elencos.ts e
// e correto — pacote anterior ao build nao sabe nada que o build ja nao saiba —
// mas ele vale para ELENCO, e nao para escudo, uniforme e rosto, que a build nao
// carrega. Resultado pratico: o jogador atualiza o jogo e perde de uma vez os
// escudos, os uniformes e as fotos que ja tinha baixado.
//
// O conserto e republicar o MESMO conteudo depois da build, so para o carimbo de
// data passar a ser posterior. Ja foi feito a mao ("Recarimbo para a 1.0.258",
// "Recarimbo para a 1.0.261") e esquecido outras tantas; e um passo de deploy,
// nao um lembrete.
//
// Nada e reenviado: `publicar` monta o manifesto a partir do banco que ja esta
// na VPS. So a versao e o `publicado_em` mudam.
if (!soLauncher) {
  passo("Canal de atualizacao: recarimbando o manifesto (pos-build)")
  if (!publicar) {
    console.log("  (ensaio) republicaria o manifesto para o selo desta build.")
  } else if (!CHAVE) {
    console.log("  ⚠️ ULTRAFOOT_VPS_KEY nao definida — RECARIMBE A MAO ou o canal some para quem atualizar.")
  } else {
    const py = [
      "import sys; sys.path.insert(0, '/opt/ultrafoot/atualizacoes')",
      "import os",
      "os.environ.setdefault('ULTRAFOOT_ATU_DB', '/var/lib/ultrafoot/atualizacoes/atualizacoes.db')",
      "os.environ.setdefault('ULTRAFOOT_ATU_PUB', '/var/www/ultrafoot/atualizacoes')",
      "import server",
      "con = server.conectar()",
      `print(server.publicar(con, None, 'Recarimbo para a ${VERSAO_JOGO}'))`,
      "con.commit()",
    ].join("\n")
    try {
      const saida = rodar("ssh", ["-i", CHAVE, "-o", "ConnectTimeout=20", VPS,
        `sudo -u ultrafoot python3 - <<'PY'\n${py}\nPY`]).trim()
      console.log(`  ${saida.split("\n").pop()}`)
    } catch (e) {
      console.log(`  ⚠️ recarimbo FALHOU (${e.message.split("\n")[0]}) — refaca a mao, senao quem atualizar perde escudo, uniforme e foto.`)
    }
  }
}

console.log("\nDEPLOY CONCLUIDO.")
