// NOVIDADES E CHANGELOG DO LAUNCHER — confere e publica o launcher-config.json.
//
//   node scripts/publicar-launcher-config.mjs              # so confere e mostra
//   node scripts/publicar-launcher-config.mjs --publicar   # sobe para o release
//   EXIGIR_VERSAO=1.0.201 node scripts/publicar-launcher-config.mjs
//
// POR QUE ISTO EXISTE: o launcher le as abas "Novidades" e "Changelog" deste
// arquivo, que ficava SO no release do GitHub e era editado a mao. O deploy
// publicava binario e manifesto e nunca tocava nele — em 29/07/26 o jogo estava
// na 1.0.201 e o launcher ainda anunciava a 1.0.175 como ultima versao, 26
// versoes atras. Agora a fonte mora no repositorio, o deploy publica junto e
// EXIGIR_VERSAO reprova o deploy que esqueceu de escrever a novidade.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const ARQUIVO = path.join(RAIZ, "services/cloud-save-server/launcher-config.json")
const REPO = "jovemegidio/Ultrafoot26"
const TAG = "launcher"
const URL_PUBLICADA = `https://github.com/${REPO}/releases/download/${TAG}/launcher-config.json`

const publicar = process.argv.includes("--publicar")
const exigirVersao = process.env.EXIGIR_VERSAO?.trim()

const rodar = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf-8", ...opts })

// ─── Conferencia ─────────────────────────────────────────────────────────────

const config = JSON.parse(readFileSync(ARQUIVO, "utf-8"))

const changelog = config.changelog ?? []
const noticias = config.news ?? []
if (changelog.length === 0) throw new Error("launcher-config.json sem changelog")
if (noticias.length === 0) throw new Error("launcher-config.json sem novidades")

// O launcher marca UMA versao como a atual. Duas (ou nenhuma) fazem a aba
// Changelog mentir sobre o que o jogador tem instalado.
const marcadas = changelog.filter((r) => r.latest)
if (marcadas.length !== 1) {
  throw new Error(`o changelog precisa de exatamente um "latest": true (achei ${marcadas.length})`)
}
let versaoDoChangelog = marcadas[0].version
if (versaoDoChangelog !== changelog[0].version) {
  throw new Error(`o "latest" (${versaoDoChangelog}) nao e a primeira entrada (${changelog[0].version})`)
}

const noticiaMaisNova = noticias
  .map((n) => n.date)
  .filter(Boolean)
  .sort()
  .at(-1)

console.log("LAUNCHER-CONFIG")
console.log(`  changelog   ${changelog.length} versoes, a mais nova ${versaoDoChangelog}`)
console.log(`  novidades   ${noticias.length} itens, a mais nova de ${noticiaMaisNova ?? "sem data"}`)
console.log(`  anuncio     ${config.announcement?.text ?? "(nenhum)"}`)

/**
 * ⚠️ O DEPLOY NAO ABORTA MAIS POR FALTA DE CHANGELOG (1.0.346).
 *
 * Antes, publicar o jogo exigia PARAR e escrever a entrada da versao nova aqui
 * a mao — e o deploy morria no meio se voce esquecesse. Aconteceu duas vezes em
 * 17/08/2026, na 1.0.343 e na 1.0.344. O launcher virou um passo manual de toda
 * publicacao do jogo, que e exatamente o que ninguem quer manter.
 *
 * Agora a entrada e ESCRITA SOZINHA quando falta. O titulo sai do commit da
 * versao — neste projeto ele ja e escrito em portugues legivel
 * ("1.0.344: o catalogo de rostos sai do peso de toda tela") — e vira a nota
 * que o jogador le no launcher.
 *
 * ⚠️ QUEM ESCREVEU A MAO CONTINUA MANDANDO: havendo entrada para a versao, nada
 * e gerado nem sobrescrito. O automatico e rede de seguranca, nao dono do texto.
 */
function tituloDoCommitDaVersao(versao) {
  try {
    const linha = rodar("git", ["log", "-1", "--format=%s", `--grep=^${versao}:`], { cwd: RAIZ }).trim()
    if (!linha) return null
    const semPrefixo = linha.slice(linha.indexOf(":") + 1).trim()
    return semPrefixo || null
  } catch {
    return null
  }
}

if (exigirVersao && versaoDoChangelog !== exigirVersao) {
  if (changelog.some((r) => r.version === exigirVersao)) {
    throw new Error(
      `existe entrada da ${exigirVersao}, mas o "latest": true esta na ${versaoDoChangelog}.\n`
      + `  Mova o "latest" para a ${exigirVersao} — a ordem do changelog e editorial, nao mexo nela sozinho.`,
    )
  }

  const titulo = tituloDoCommitDaVersao(exigirVersao)
  const entrada = {
    version: exigirVersao,
    data: new Date().toISOString().slice(0, 10),
    latest: true,
    titulo: titulo ?? `Versao ${exigirVersao}`,
    itens: [
      titulo
        ? `${titulo[0].toUpperCase()}${titulo.slice(1)}.`
        : `Correcoes e melhorias da versao ${exigirVersao}.`,
    ],
  }
  for (const r of changelog) delete r.latest
  changelog.unshift(entrada)
  config.changelog = changelog
  writeFileSync(ARQUIVO, JSON.stringify(config, null, 2), "utf-8")
  versaoDoChangelog = exigirVersao
  console.log(`  gerada      entrada da ${exigirVersao}: "${entrada.titulo}"`)
  console.log(`              (escreva a sua em launcher-config.json antes do deploy para substituir)`)
}

if (!publicar) {
  console.log("\nNada foi enviado. Rode com --publicar para valer.")
  process.exit(0)
}

// ─── Publicacao ──────────────────────────────────────────────────────────────

console.log("\n→ subindo para o release do GitHub")
rodar("gh", ["release", "upload", TAG, ARQUIVO, "--repo", REPO, "--clobber"], { stdio: "inherit" })

// CONFERENCIA PELO CORPO, nunca pelo status: o CDN devolve 200 com a versao
// antiga por um instante, e "200" ja me fez anunciar publicacao que nao foi.
const corpo = rodar("curl", ["-sL", "--max-time", "40", `${URL_PUBLICADA}?cb=${Date.now()}`])
const noAr = JSON.parse(corpo)
const versaoNoAr = (noAr.changelog ?? []).find((r) => r.latest)?.version
if (versaoNoAr !== versaoDoChangelog) {
  throw new Error(`o que esta no ar diz ${versaoNoAr}, esperado ${versaoDoChangelog}`)
}
console.log(`  ok — launcher anuncia a ${versaoDoChangelog} e ${(noAr.news ?? []).length} novidades`)
