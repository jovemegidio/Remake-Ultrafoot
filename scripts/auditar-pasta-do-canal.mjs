// AUDITORIA DA PASTA DO CANAL: o que da origem já está publicado, e o que não.
//
//   node scripts/auditar-pasta-do-canal.mjs --pasta "<Canal de Atualização>" \
//     --manifesto elencos.json [--saida auditoria.json]
//
// A pergunta que ele responde é a que ninguém consegue responder olhando: a
// pasta tem ~11 mil arquivos em 48 subpastas, o canal tem 1.570 clubes, e nada
// no meio diz quais arquivos viraram imagem no jogo. Sem isto, "auditar" vira
// abrir pasta por pasta e chutar.
//
// ⚠️ ELE NÃO CASA CLUBE. Quem casa é o publicar-uniformes-pasta.mjs (com
// `--sem-imagem`, rápido) e o publicar-escudos-pasta.mjs — repetir a escada de
// casamento aqui criaria uma SEGUNDA regra, que diverge da primeira e faz a
// auditoria mentir. Este script orquestra aqueles e cruza a saída deles com o
// manifesto que está no ar.
//
// A tabela final separa três coisas que costumam ser confundidas:
//   * arquivo que casou e JÁ ESTÁ no canal;
//   * arquivo que casou e FALTA publicar (é o que vale rodar);
//   * arquivo que não casa com clube nenhum do jogo — que quase sempre é
//     divisão que o jogo não modela, não defeito de casamento.

import { execFileSync } from "node:child_process"
import { readFileSync, existsSync, mkdtempSync, readdirSync, statSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const arg = (n, padrao = "") => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : padrao
}
const RAIZ_PASTA = arg("--pasta")
const MANIFESTO = arg("--manifesto")
const SAIDA = arg("--saida")
if (!RAIZ_PASTA || !MANIFESTO) {
  console.error('uso: --pasta "<pasta>" --manifesto elencos.json [--saida auditoria.json]')
  process.exit(1)
}

const RAIZ = path.resolve(import.meta.dirname, "..")
const tmp = mkdtempSync(path.join(os.tmpdir(), "uf-auditoria-"))
const manifesto = JSON.parse(readFileSync(MANIFESTO, "utf-8"))
const comKit = new Set(Object.entries(manifesto.times || {}).filter(([, t]) => t?.kits && Object.keys(t.kits).length).map(([k]) => k))
const comEscudo = new Set(Object.entries(manifesto.times || {}).filter(([, t]) => t?.logoUrl).map(([k]) => k))

// Pasta -> como o publicador precisa ser chamado. `pais` recorta o universo do
// pool (sem isso "roma1.png" acha o Roma-GO). Pasta ausente daqui é pasta que
// não é de uniforme de liga.
//
// ⚠️ `recursivo` em TODAS: quase toda pasta de liga guarda o conteúdo numa
// subpasta de mesmo nome ("Italy_-_Serie_A/Italy - Serie A/*.png"). Sem ele o
// publicador diz "pasta sem imagem" e a liga inteira some da auditoria — foi
// como 29 das 37 pastas sumiram na primeira rodada.
const LIGAS = {
  "Argentina_-_Primera_Division": { pais: "ARG", recursivo: true },
  "Belgium_-_Jupiler_Pro_League": { pais: "BEL", recursivo: true },
  "Brazil_-_Serie_A": { pais: "BRA", recursivo: true },
  "China_-_Super_League": { pais: "CHN", recursivo: true },
  "Colombia_-_Liga_BetPlay_Dimayor": { pais: "COL", recursivo: true },
  "Divisões de Acesso - Camisas": { pais: "BRA", recursivo: true },
  "Ecuador_-_Liga_Pro_A": { pais: "EQU", recursivo: true },
  "England_-_Premier_League": { pais: "ING", recursivo: true },
  "Estonia_-_A_Le_Coq_Premium_Liiga": { pais: "EST", recursivo: true },
  "Finland_-_Veikkausliiga": { pais: "FIN", recursivo: true },
  "France_-_Championnat_National": { pais: "FRA", recursivo: true },
  "France_-_Ligue_1": { pais: "FRA", recursivo: true },
  "France_-_Ligue_2": { pais: "FRA", recursivo: true },
  "France_-_Lower_leagues": { pais: "FRA", recursivo: true },
  "Germany_-_3._Liga": { pais: "ALE", recursivo: true },
  "Germany_-_Bundesliga": { pais: "ALE", recursivo: true },
  "Germany_-_Bundesliga_2": { pais: "ALE", recursivo: true },
  "Germany_-_Oberliga": { pais: "ALE", recursivo: true },
  "Italy_-_Serie_A": { pais: "ITA", recursivo: true },
  "Italy_-_Serie_B": { pais: "ITA", recursivo: true },
  "Italy_-_Serie_C": { pais: "ITA", recursivo: true },
  "Italy_-_Serie_D": { pais: "ITA", recursivo: true },
  "Japan_-_J1_League": { pais: "JAP", recursivo: true },
  "Paraguay_-_Copa_de_Primera": { pais: "PAR", recursivo: true },
  "Peru_-_Liga1_Te_Apuesto": { pais: "PER", recursivo: true },
  "Portugal_-_Campeonato_de_Portugal": { pais: "POR", recursivo: true },
  "Portugal_-_Liga_3_Placard": { pais: "POR", recursivo: true },
  "Portugal_-_Liga_Portugal_2_Meu_Super": { pais: "POR", recursivo: true },
  "Portugal_-_Primeira_Liga": { pais: "POR", recursivo: true },
  "Saudi_Arabia_-_Roshn_Saudi_League": { pais: "ARA", recursivo: true },
  "Spain_-_La_Liga": { pais: "ESP", recursivo: true },
  "Spain_-_Liga_Hypermotion": { pais: "ESP", recursivo: true },
  "Spain_-_Regional_Preferente": { pais: "ESP", recursivo: true },
  "Spain_-_Tercera_RFEF": { pais: "ESP", recursivo: true },
  "Sweden_-_Allsvenskan": { pais: "SUE", recursivo: true },
  "Sweden_-_Superettan": { pais: "SUE", recursivo: true },
  "Uruguay_-_Liga_AUF_Uruguaya": { pais: "URU", recursivo: true },
}

const contar = (dir) => {
  let n = 0
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) n += contar(path.join(dir, item.name))
    else if (/\.(png|jpe?g|webp)$/i.test(item.name)) n++
  }
  return n
}

const linhas = []
for (const [nome, cfg] of Object.entries(LIGAS)) {
  const dir = path.join(RAIZ_PASTA, nome)
  if (!existsSync(dir)) { console.error(`(pasta ausente: ${nome})`); continue }
  const arquivos = contar(dir)
  const saidaJson = path.join(tmp, `${nome.replace(/[^a-z0-9]/gi, "_")}.json`)
  const argv = ["scripts/publicar-uniformes-pasta.mjs", "--pasta", dir, "--pais", cfg.pais,
    "--mapa", "data/seeds/uniformes-mapa-slugs.json", "--sem-imagem", "--resumo", "--exportar", saidaJson]
  if (cfg.recursivo) argv.push("--recursivo")
  let texto = ""
  try {
    texto = execFileSync(process.execPath, argv, { cwd: RAIZ, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    console.error(`! ${nome}: ${e.message.split("\n")[0]}`)
    continue
  }
  const pacote = existsSync(saidaJson) ? JSON.parse(readFileSync(saidaJson, "utf-8")) : { clubes: [] }
  const chaves = pacote.clubes.map(c => c.file_key)
  const faltando = chaves.filter(k => !comKit.has(k))
  const semClube = (texto.match(/^ {2}\S.*\(slug /gm) || []).length
  const ambiguos = (texto.match(/^ {2}\? /gm) || []).length
  const semVariante = (texto.split("SEM VARIANTE RECONHECIVEL:")[1] || "").split("\n").filter(l => l.startsWith("  ")).length
  linhas.push({ pasta: nome, pais: cfg.pais, arquivos, chaves: chaves.length, jaNoCanal: chaves.length - faltando.length, faltando, semClube, ambiguos, semVariante })
  console.error(`. ${nome}`)
}

const larg = Math.max(...linhas.map(l => l.pasta.length))
console.log(`\n${"PASTA".padEnd(larg)}  arq  chaves  no canal  FALTAM  sem clube  ambig  sem variante`)
for (const l of linhas.sort((a, b) => b.faltando.length - a.faltando.length || a.pasta.localeCompare(b.pasta))) {
  console.log(
    `${l.pasta.padEnd(larg)}  ${String(l.arquivos).padStart(4)}  ${String(l.chaves).padStart(6)}  ${String(l.jaNoCanal).padStart(8)}  ${String(l.faltando.length).padStart(6)}  ${String(l.semClube).padStart(9)}  ${String(l.ambiguos).padStart(5)}  ${String(l.semVariante).padStart(12)}`,
  )
}
const soma = (c) => linhas.reduce((n, l) => n + (typeof l[c] === "number" ? l[c] : l[c].length), 0)
console.log(`${"TOTAL".padEnd(larg)}  ${String(soma("arquivos")).padStart(4)}  ${String(soma("chaves")).padStart(6)}  ${String(soma("jaNoCanal")).padStart(8)}  ${String(soma("faltando")).padStart(6)}  ${String(soma("semClube")).padStart(9)}  ${String(soma("ambiguos")).padStart(5)}  ${String(soma("semVariante")).padStart(12)}`)

console.log(`\nCanal hoje: ${comKit.size} clubes com uniforme, ${comEscudo.size} com escudo (manifesto v${manifesto.versao}).`)
for (const l of linhas) if (l.faltando.length) console.log(`  FALTAM em ${l.pasta}: ${l.faltando.slice(0, 12).join(", ")}${l.faltando.length > 12 ? ` … +${l.faltando.length - 12}` : ""}`)

if (SAIDA) {
  const { writeFileSync } = await import("node:fs")
  writeFileSync(SAIDA, JSON.stringify({ manifesto: manifesto.versao, linhas }, null, 1))
  console.log(`\nDetalhe em ${SAIDA}`)
}
