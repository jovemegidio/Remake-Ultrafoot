#!/usr/bin/env node
/**
 * GERADOR DO MANIFESTO DE PATCH (atualização diferencial).
 *
 * ─── Por que existe ──────────────────────────────────────────────────────────
 * Toda atualização do jogo baixava o instalador inteiro. Uma correção de três
 * linhas custava o pacote completo, para cada jogador, toda vez. Com o manifesto,
 * o launcher compara o que já está no disco com a lista da versão nova e baixa só
 * o que mudou (ver `Launcher/src-tauri/src/patch.rs`).
 *
 * ─── O que ele produz ────────────────────────────────────────────────────────
 *   manifesto-<versao>.json   lista de arquivos: caminho, sha256 e tamanho
 *   blobs/<ab>/<sha256>.gz    o conteúdo de cada arquivo, endereçado por hash
 *
 * "Endereçado por conteúdo" é o que faz a economia acontecer duas vezes: arquivo
 * que não mudou entre versões tem o MESMO sha, então (1) não sobe de novo para o
 * servidor e (2) não desce de novo para quem já o tem. O armazém de blobs é
 * cumulativo — nunca se apaga blob de versão que ainda está no ar.
 *
 * ─── Uso ─────────────────────────────────────────────────────────────────────
 *   node scripts/gerar-manifesto.mjs \
 *     --pasta "C:\\Users\\SnyX\\AppData\\Local\\Ultrafoot 26" \
 *     --versao 1.0.241 \
 *     --saida .\\dist-patch
 *
 * Por padrao o gerador consulta o manifesto que esta no `latest.json` da VPS.
 * Um hash que ja aparece nele nao e recriado na pasta de saida: o blob ja esta
 * no servidor. Assim a pasta de upload contem somente conteudo novo, mesmo que
 * `--saida` esteja vazia. Use `--sem-manifesto-anterior` apenas para reconstruir
 * o armazem do zero.
 *
 * A PASTA TEM DE SER A DO JOGO INSTALADO — não a de build. O que o manifesto
 * descreve é o resultado final na máquina do jogador; qualquer diferença entre
 * as duas viraria "arquivo corrompido" na verificação de integridade de todo
 * mundo.
 *
 * Depois: subir `blobs/` e o manifesto para a VPS e apontar o latest.json:
 *   "platforms": { "windows-x86_64": { "url": "...", "manifesto": "https://.../downloads/manifesto-1.0.241.json" } }
 */

import { createHash } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import zlib from "node:zlib"
import { pipeline } from "node:stream/promises"

// Arquivos que NÃO entram no manifesto.
//
// `uninstall.exe` é escrito pelo NSIS na máquina de cada um e não é conteúdo da
// versão; os `.ultrafoot-*` são o estado do próprio launcher. Incluir qualquer
// um dos dois faria o launcher tentar "consertar" para sempre um arquivo que
// nunca vai bater com o manifesto.
const IGNORAR = [
  /^uninstall\.exe$/i,
  /^\.ultrafoot-/,
  /\.log$/i,
  /^\.ultrafoot-patch\//,
  // Cópias de trabalho locais não pertencem a uma versão. Na instalação de
  // desenvolvimento elas somavam quase 480 MB e seriam publicadas como blobs.
  /^ultrafoot\.exe\.(?:anterior|com-minhas-mudancas|bak|backup)$/i,
  /\.(?:bak|backup|old)$/i,
]

function argumento(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`)
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1]
  }
  return process.argv.includes(`--${nome}`) ? true : padrao
}

async function* varrer(raiz, prefixo = "") {
  const itens = await fs.readdir(path.join(raiz, prefixo), { withFileTypes: true })
  for (const item of itens) {
    const relativo = prefixo ? `${prefixo}/${item.name}` : item.name
    if (item.isDirectory()) {
      yield* varrer(raiz, relativo)
    } else if (item.isFile()) {
      yield relativo
    }
    // Link simbólico é ignorado de propósito: o launcher grava arquivo comum, e
    // um link no manifesto viraria um arquivo real na máquina do jogador.
  }
}

function sha256(caminho) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256")
    createReadStream(caminho)
      .on("error", reject)
      .on("data", (b) => h.update(b))
      .on("end", () => resolve(h.digest("hex")))
  })
}

function humano(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

async function hashesJaPublicados(urlLatest) {
  if (argumento("sem-manifesto-anterior", false)) return new Set()
  try {
    const latest = await fetch(urlLatest, { signal: AbortSignal.timeout(10_000) })
    if (!latest.ok) throw new Error(`latest.json respondeu ${latest.status}`)
    const plataforma = (await latest.json())?.platforms?.["windows-x86_64"]
    if (!plataforma?.manifesto) return new Set()
    const resposta = await fetch(plataforma.manifesto, { signal: AbortSignal.timeout(20_000) })
    if (!resposta.ok) throw new Error(`manifesto anterior respondeu ${resposta.status}`)
    const anterior = await resposta.json()
    const hashes = new Set((anterior.arquivos ?? []).map((a) => a.sha256).filter(Boolean))
    console.log(`→ manifesto anterior: ${anterior.versao ?? "?"} (${hashes.size} conteúdos já publicados)`)
    return hashes
  } catch (erro) {
    console.warn(`⚠ manifesto anterior indisponível; os blobs serão conferidos apenas na pasta local (${erro.message})`)
    return new Set()
  }
}

async function main() {
  const pasta = argumento("pasta")
  const versao = argumento("versao")
  const saida = argumento("saida", "./dist-patch")
  const comprimir = !argumento("sem-compressao", false)
  const baseDosBlobs = argumento(
    "blobs",
    "https://ultrafoot.zyntraerp.com.br/downloads/blobs/",
  )
  const latest = argumento(
    "latest",
    "https://ultrafoot.zyntraerp.com.br/downloads/latest.json",
  )

  if (!pasta || !versao) {
    console.error(
      "uso: node scripts/gerar-manifesto.mjs --pasta <pasta do jogo instalado> --versao <x.y.z> [--saida ./dist-patch] [--sem-compressao]",
    )
    process.exit(1)
  }

  const raiz = path.resolve(pasta)
  try {
    const st = await fs.stat(raiz)
    if (!st.isDirectory()) throw new Error("não é pasta")
  } catch {
    console.error(`✖ pasta não encontrada: ${raiz}`)
    process.exit(1)
  }

  const pastaDeBlobs = path.join(path.resolve(saida), "blobs")
  await fs.mkdir(pastaDeBlobs, { recursive: true })

  const arquivos = []
  let bytesDaVersao = 0
  let blobsNovos = 0
  let bytesNovos = 0
  let reaproveitados = 0
  let jaNaVps = 0

  const hashesRemotos = await hashesJaPublicados(latest)

  console.log(`→ varrendo ${raiz}`)
  for await (const relativo of varrer(raiz)) {
    if (IGNORAR.some((re) => re.test(relativo))) continue

    const absoluto = path.join(raiz, relativo)
    const { size } = await fs.stat(absoluto)
    const hash = await sha256(absoluto)

    arquivos.push({ caminho: relativo.replace(/\\/g, "/"), sha256: hash, tamanho: size })
    bytesDaVersao += size

    const destino = path.join(
      pastaDeBlobs,
      hash.slice(0, 2),
      comprimir ? `${hash}.gz` : hash,
    )
    // Se o manifesto atualmente publicado ja referencia este conteudo, o blob
    // necessariamente chegou antes dele (a publicacao envia blobs primeiro).
    // Nao o recriar e o que impede fotos, escudos e kits inalterados de serem
    // preparados e enviados de novo a cada release.
    if (hashesRemotos.has(hash)) {
      jaNaVps++
      continue
    }
    // BLOB QUE JÁ EXISTE NÃO É REESCRITO. É o coração da economia: entre duas
    // versões, a esmagadora maioria dos arquivos é idêntica, e o mesmo conteúdo
    // sempre gera o mesmo nome.
    try {
      await fs.access(destino)
      reaproveitados++
      continue
    } catch {
      /* não existe: escreve abaixo */
    }

    await fs.mkdir(path.dirname(destino), { recursive: true })
    if (comprimir) {
      await pipeline(createReadStream(absoluto), zlib.createGzip({ level: 9 }), createWriteStream(destino))
    } else {
      await fs.copyFile(absoluto, destino)
    }
    blobsNovos++
    bytesNovos += (await fs.stat(destino)).size
  }

  if (arquivos.length === 0) {
    console.error("✖ nenhum arquivo encontrado — pasta errada?")
    process.exit(1)
  }

  arquivos.sort((a, b) => a.caminho.localeCompare(b.caminho))

  const manifesto = {
    versao,
    gerado: Math.floor(Date.now() / 1000),
    compressao: comprimir ? "gz" : "nenhuma",
    blobs: baseDosBlobs.endsWith("/") ? baseDosBlobs : `${baseDosBlobs}/`,
    total: bytesDaVersao,
    arquivos,
  }

  const arquivoDoManifesto = path.join(path.resolve(saida), `manifesto-${versao}.json`)
  await fs.writeFile(arquivoDoManifesto, JSON.stringify(manifesto), "utf8")

  console.log("")
  console.log(`✔ manifesto:      ${arquivoDoManifesto}`)
  console.log(`  arquivos:       ${arquivos.length} (${humano(bytesDaVersao)})`)
  console.log(`  blobs novos:    ${blobsNovos} (${humano(bytesNovos)} a subir)`)
  console.log(`  já na saída:     ${reaproveitados}`)
  console.log(`  já na VPS:       ${jaNaVps}`)
  console.log("")
  console.log("Próximos passos:")
  console.log(`  1) subir os blobs:      rsync -av ${path.join(saida, "blobs")}/ vps:/var/www/ultrafoot/downloads/blobs/`)
  console.log(`  2) subir o manifesto:   scp ${arquivoDoManifesto} vps:/var/www/ultrafoot/downloads/`)
  console.log(`  3) apontar no latest.json:`)
  console.log(`     "platforms": { "windows-x86_64": { "url": "…", "manifesto": "${manifesto.blobs.replace(/blobs\/$/, "")}manifesto-${versao}.json" } }`)
  console.log("")
  console.log("⚠ Nunca apague blobs de versões ainda no ar: o manifesto delas aponta para eles.")
}

main().catch((e) => {
  console.error("✖ falhou:", e)
  process.exit(1)
})
