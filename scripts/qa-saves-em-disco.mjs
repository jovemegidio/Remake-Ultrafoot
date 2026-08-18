// O QUE O JOGO DEIXA NO DISCO DO JOGADOR — e o que dele é lixo.
//
// ⚠️ POR QUE ELE EXISTE. Em 17/08/2026 o jogo parou de abrir em TODAS as versões
// porque `ultrafoot-clubs.json` chegou a 546 MB. Aquilo foi corrigido — o
// universo saiu para arquivo próprio e só o da carreira ativa fica. Mas a
// correção não limpa o passado: o arquivo inchado continuou no disco, renomeado,
// ocupando meio giga que ninguém mais lê.
//
// E há uma segunda família de lixo: EXPORTS. `team-overrides-export.json` e
// `logos-export.json` são gerados por ferramentas de edição, servem uma vez e
// ficam para sempre — medido aqui, 118 MB.
//
// ⚠️ ESTE SCRIPT NÃO APAGA NADA POR PADRÃO, e a razão não é cautela genérica: o
// jogador pode ter guardado um `.bak` de propósito. Ele MEDE e diz o que é
// seguro remover; `--limpar` executa, e nunca toca no que o jogo lê.
//
// Uso:
//   node scripts/qa-saves-em-disco.mjs
//   node scripts/qa-saves-em-disco.mjs --limpar
//   TETO_ORFAOS_MB=200 node scripts/qa-saves-em-disco.mjs   # reprova acima do teto

import { readdirSync, statSync, unlinkSync, readFileSync } from "node:fs"
import path from "node:path"

const limpar = process.argv.includes("--limpar")
/** Acima disto, lixo em disco deixa de ser detalhe e vira problema do jogador. */
const TETO_MB = Number(process.env.TETO_ORFAOS_MB ?? 150)

const PASTA = path.join(process.env.APPDATA ?? "", "com.ultrafoot.remake")

/** Os arquivos que o JOGO lê. Nenhum deles pode ser tocado, nunca. */
const DO_JOGO = new Set([
  "ultrafoot-clubs.json",     // o save e tudo que o jogador construiu
  "ultrafoot-universo.json",  // o universo da carreira ativa
])

/**
 * Lixo reconhecível, por padrão de nome. Só entra aqui o que é gerado pelo
 * próprio jogo/ferramentas e não é lido de volta por ninguém.
 */
const EH_ORFAO = (nome) =>
  /\.bak(\.json)?$/i.test(nome)
  || /INCHADO/i.test(nome)
  || /-export\.json$/i.test(nome)
  || /\.old(\.json)?$/i.test(nome)
  // ⚠️ `bloated-backup` ESCAPOU DA PRIMEIRA VERSAO. Ele nao termina em `.bak` nem
  // em `-export.json`, entao a peneira o classificou como "nao classificado" e
  // 118 MB ficaram no disco depois de uma limpeza que reportou sucesso. Sufixo
  // livre e o que sempre escapa: por isso a regra agora olha a PALAVRA, e nao a
  // extensao.
  || /bloated|inflado|backup-\d/i.test(nome)

let falhas = 0
const erro = (m) => { console.log("FALHA: " + m); falhas++ }

if (!process.env.APPDATA) {
  console.log("(sem APPDATA — nada a auditar nesta maquina)")
  process.exit(0)
}

let arquivos
try {
  arquivos = readdirSync(PASTA)
} catch {
  console.log(`(${PASTA} nao existe — o jogo ainda nao rodou aqui)`)
  process.exit(0)
}

const mb = (n) => (n / 1048576).toFixed(2)
const doJogo = []
const orfaos = []
const outros = []

for (const nome of arquivos) {
  let tamanho
  try { tamanho = statSync(path.join(PASTA, nome)).size } catch { continue }
  const alvo = { nome, tamanho }
  if (DO_JOGO.has(nome)) doJogo.push(alvo)
  else if (EH_ORFAO(nome)) orfaos.push(alvo)
  else outros.push(alvo)
}

console.log(`ESTADO EM DISCO — ${PASTA}\n`)
console.log("  do jogo (nunca apagados):")
for (const a of doJogo.sort((x, y) => y.tamanho - x.tamanho)) {
  console.log(`    ${mb(a.tamanho).padStart(8)} MB  ${a.nome}`)
}

// ─── O save por dentro: completo, mas leve? ─────────────────────────────────
//
// "Completo" e "leve" não são opostos — o que engorda um save é cópia, não
// conteúdo. Por isso a conta separa carreira VIVA de backup e de retrato.
const principal = path.join(PASTA, "ultrafoot-clubs.json")
try {
  const dados = JSON.parse(readFileSync(principal, "utf-8"))
  const grupo = {}
  for (const [chave, valor] of Object.entries(dados)) {
    const tipo = chave.endsWith(":backup") ? "backup"
      : chave.endsWith(":pre-atualizacao") ? "retrato pre-update"
        : chave.startsWith("ultrafoot:save:") ? "carreira viva"
          : chave.startsWith("ultrafoot:universo:") ? "universo (fora de lugar)"
            : chave.startsWith("ultrafoot:atualizacao") ? "cache do canal" : "config e edicoes"
    grupo[tipo] = grupo[tipo] ?? { n: 0, bytes: 0 }
    grupo[tipo].n++
    grupo[tipo].bytes += JSON.stringify(valor).length
  }
  console.log("\n  dentro do save:")
  for (const [tipo, { n, bytes }] of Object.entries(grupo).sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`    ${mb(bytes).padStart(8)} MB  ${String(n).padStart(4)} chaves  ${tipo}`)
  }
  const vivas = grupo["carreira viva"]
  if (vivas) {
    const media = vivas.bytes / vivas.n / 1024
    console.log(`\n    ${vivas.n} carreiras, media de ${media.toFixed(0)} KB cada`)
    // ⚠️ UMA CARREIRA NAO PODE PESAR MEGABYTES. Passou disto, alguem voltou a
    // guardar no save algo que deveria viver fora dele — foi assim que as fotos
    // em base64 e o universo 286 entraram, cada um na sua epoca.
    if (media > 900) {
      erro(`carreira media de ${media.toFixed(0)} KB — algo grande voltou para dentro do save`)
    }
  }
  if (grupo["universo (fora de lugar)"]) {
    erro("ha universo dentro do save principal — a mudanca de casa nao rodou")
  }
} catch {
  console.log("\n  (save principal ilegivel como JSON — so o tamanho foi conferido)")
}

// ─── Órfãos ──────────────────────────────────────────────────────────────────
const totalOrfaos = orfaos.reduce((s, a) => s + a.tamanho, 0)
console.log(`\n  orfaos (seguros de apagar): ${mb(totalOrfaos)} MB em ${orfaos.length} arquivo(s)`)
for (const a of orfaos.sort((x, y) => y.tamanho - x.tamanho)) {
  console.log(`    ${mb(a.tamanho).padStart(8)} MB  ${a.nome}`)
}
if (outros.length) {
  console.log(`\n  nao classificados (mantidos): ${outros.map(a => a.nome).join(", ")}`)
}

if (totalOrfaos / 1048576 > TETO_MB) {
  erro(`${mb(totalOrfaos)} MB de lixo em disco (teto ${TETO_MB} MB)`)
}

if (limpar && orfaos.length) {
  let apagados = 0
  for (const a of orfaos) {
    try { unlinkSync(path.join(PASTA, a.nome)); apagados++ } catch { /* em uso */ }
  }
  console.log(`\n${apagados} arquivo(s) apagado(s), ${mb(totalOrfaos)} MB devolvidos ao disco.`)
  process.exit(0)
}

console.log(falhas === 0
  ? "\nDISCO OK — o save esta leve e nao ha lixo passando do teto."
  : `\n${falhas} problema(s). Rode com --limpar para remover os orfaos.`)
process.exit(falhas === 0 ? 0 : 1)
