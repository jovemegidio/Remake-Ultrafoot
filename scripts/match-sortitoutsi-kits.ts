// Casa os nomes de arquivo do sortitoutsi com os file_keys do jogo, SEMPRE
// dentro da liga certa (a pasta ja diz a liga) — assim um homonimo de outra
// divisao nunca rouba o kit. Dry-run: so reporta. Com --write grava o mapa
// que o importador (import-sortitoutsi-kits.mjs) consome.
//
// sortitoutsi: <pasta-liga>/<...>/<time>_1|2|3.png  (1=titular,2=reserva,3=terceiro)

import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { allBrazilianTeams, allPoolTeams } from "../lib/teams-data"
import { allInternationalTeams } from "../lib/international-teams"

const SRC = process.argv[2] ?? "C:/Ultrafoot-kits-src"
const WRITE = process.argv.includes("--write")

// pasta do pack -> divisao do jogo.
//
// ⚠️ SO ENTRA PASTA COM DIVISAO CORRESPONDENTE NO JOGO. Varias pastas do acervo
// (Oberliga, Tercera RFEF, Serie D italiana, Championnat National, Liga 3 de
// Portugal...) sao de divisoes que o jogo simplesmente nao tem — sem clube para
// casar, o casamento por token acabaria dando a camisa ao homonimo de outra
// liga. Ficar de fora e o comportamento certo: a memoria do projeto registra
// dois casos de escudo/elenco que foram parar no clube errado por casamento
// frouxo (Botafogo RJ/SP/PB, Barcelona ESP/Guayaquil).
const LIGA_POR_PASTA: Record<string, string> = {
  // Sul-America (pack sortitoutsi)
  "Brazil_-_Serie_A": "serie_a",
  "Argentina_-_Primera_Division": "liga_argentina",
  "China_-_Super_League": "chinese_super",
  "Colombia_-_Liga_BetPlay_Dimayor": "primera_a_col",
  "Ecuador_-_Liga_Pro_A": "primera_a_ecu",
  "Japan_-_J1_League": "j_league",
  "Uruguay_-_Liga_AUF_Uruguaya": "primera_div_ury",
  // Europa — cada uma so onde o jogo tem a divisao (ver o aviso acima).
  "England_-_Premier_League": "premier_league",
  "France_-_Ligue_1": "ligue_1",
  "France_-_Ligue_2": "ligue_2",
  "Germany_-_Bundesliga": "bundesliga",
  "Germany_-_Bundesliga_2": "bundesliga_2",
  "Italy_-_Serie_A": "serie_a_ita",
  "Italy_-_Serie_B": "serie_b_ita",
  "Portugal_-_Primeira_Liga": "primeira_liga",
  "Spain_-_La_Liga": "la_liga",
  "Spain_-_Liga_Hypermotion": "la_liga_2",
}

const TOKENS_LIXO = new Set(["fc","sc","ec","cf","ca","cd","ac","afc","club","clube","de","do","da","rb","se","ce","ec","cr","cs","cd","cf","aa","ad"])
function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(/\s+/).filter(t => t && !TOKENS_LIXO.has(t)).join(" ")
}

// Apelidos manuais so onde a normalizacao nao basta (grafias do sortitoutsi).
const ALIAS: Record<string, string> = {
  "sao paolo": "sao paulo",
  "vasco gama": "vasco",
  "clube remo": "remo",
  "atletico paranaense": "athletico paranaense",
  "vitoria": "vitoria",
}
function chave(s: string): string {
  const n = norm(s)
  return ALIAS[n] ?? n
}

// Override direto base-sortitoutsi -> file_key do jogo, para times reais que so
// diferem na grafia (typo/romanizacao/nome longo). Confirmado contra o elenco
// real de cada liga. O que nao esta aqui e nao casa automatico e time que
// simplesmente NAO existe no jogo (o pack tem mais times que a liga).
const OVERRIDE: Record<string, string> = {
  // Uruguai (roster do pack difere do jogo; so os que existem no jogo)
  racing_montevideo: "racing_ury",
  liverpool_montevideo: "liverpool_ury",
  montevideo_wanderers: "wanderers_ury",
  ca_cerro: "cerro_ury",
  montevideo_city: "city_torque",
  // Colombia
  millonairos: "millonarios",
  independiente_med: "ind_medellin",
  bucamaranga: "bucaramanga",
  // Japao
  tokyofc: "fc_tokyo",
  // Argentina
  gimnasia_y_esgrima: "gimnasia_la_plata",
  estudiantes: "estudiantes_lp",
  estudiantes_cuarto: "estudiantes_rio_cuarto",
  // Inglaterra / Franca / Italia / Alemanha / Espanha — grafias do pack europeu.
  // Todos conferidos contra o file_key REAL da liga no jogo (nao adivinhados: a
  // memoria do projeto tem dois casos de arte no clube errado por casamento
  // frouxo, e a liga certa nao protege de trocar Inter por Milan).
  manunited: "manchester_united",
  parissaintgerman: "psg",
  internazionale_milano: "inter_milan",
  borussia_gladbach: "borussia_mgladbach",
  hsv: "hamburgo_ale",
  espanol: "espanyol",
}

const todos = [...allBrazilianTeams, ...allPoolTeams, ...allInternationalTeams]

function timesDaLiga(divisao: string) {
  const seen = new Set<string>()
  return todos.filter(t => String(t.divisao) === divisao).filter(t => {
    const k = String(t.file_key ?? t.curto ?? "")
    if (!k || seen.has(k)) return false
    seen.add(k); return true
  })
}

function basesSortitoutsi(pastaLiga: string): { base: string; dir: string }[] {
  const raiz = join(SRC, pastaLiga)
  const out = new Map<string, string>()
  // Pasta que nao veio no acervo nao e erro: o mapa lista as ligas que o jogo
  // suporta, e nem todo pack traz todas. Antes um diretorio faltando derrubava a
  // importacao INTEIRA com ENOENT — inclusive as ligas que ja tinham casado.
  if (!existsSync(raiz)) return []
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome)
      if (statSync(p).isDirectory()) { if (nome !== "Alt") varrer(p); continue }
      // DOIS FORMATOS DE NOME no acervo, e ignorar o segundo custou uma liga
      // inteira: os packs sul-americanos usam `time_1.png` e os espanhois usam
      // `time1.png` (sem underscore). Com so a primeira forma, La Liga casava
      // 0 de 63 arquivos — e o relatorio dizia "0/0", como se a pasta estivesse
      // vazia, em vez de "nao entendi estes nomes".
      const m = /^(.+)_([123])\.png$/i.exec(nome) ?? /^(.+?)([123])\.png$/i.exec(nome)
      if (m) out.set(m[1], dir)
    }
  }
  varrer(raiz)
  return [...out].map(([base, dir]) => ({ base, dir }))
}

const mapa: Record<string, { dir: string; base: string; nome: string; divisao: string }> = {}
let totalMatch = 0, totalMiss = 0

for (const [pasta, divisao] of Object.entries(LIGA_POR_PASTA)) {
  let times: ReturnType<typeof timesDaLiga>
  try { times = timesDaLiga(divisao) } catch { times = [] }
  const porChave = new Map<string, typeof times[number]>()
  for (const t of times) {
    porChave.set(chave(t.nome), t)
    if (t.file_key) porChave.set(chave(String(t.file_key)), t)
  }

  const usados = new Set<string>()
  const tokens = (s: string) => new Set(chave(s).split(" ").filter(t => t.length >= 4))
  // Token distintivo unico: casa "racing_avellaneda" -> "Racing Club" quando so UM
  // time da liga compartilha o token, e esse time ainda nao foi usado. Seguro
  // porque roda dentro da liga (20 times), nunca no mundo todo.
  const porTokenUnico = (base: string): typeof times[number] | undefined => {
    const tb = tokens(base)
    if (!tb.size) return undefined
    const candidatos = times.filter(t => {
      if (usados.has(String(t.file_key ?? t.curto))) return false
      const tt = new Set([...tokens(t.nome), ...tokens(String(t.file_key ?? ""))])
      for (const tok of tb) if (tt.has(tok)) return true
      return false
    })
    return candidatos.length === 1 ? candidatos[0] : undefined
  }

  const bases = basesSortitoutsi(pasta)
  const misses: string[] = []
  let hits = 0
  const porFileKey = new Map(times.map(t => [String(t.file_key ?? t.curto), t]))
  for (const { base, dir } of bases) {
    const alvo = (OVERRIDE[base] ? porFileKey.get(OVERRIDE[base]) : undefined)
      ?? porChave.get(chave(base)) ?? porTokenUnico(base)
    if (alvo) {
      const fk = String(alvo.file_key ?? alvo.curto)
      if (usados.has(fk)) { misses.push(base + " (dup)"); continue }
      usados.add(fk)
      mapa[fk] = { dir, base, nome: alvo.nome, divisao }
      hits++
    } else {
      misses.push(base)
    }
  }
  totalMatch += hits; totalMiss += misses.length
  console.log(`\n${pasta} (${divisao}): ${hits}/${bases.length} casados, ${times.length} times na liga`)
  if (misses.length) console.log(`  SEM MATCH: ${misses.join(", ")}`)
}

console.log(`\n=== TOTAL: ${totalMatch} casados, ${totalMiss} sem match ===`)
if (WRITE) {
  writeFileSync(join(process.cwd(), "data/seeds/sortitoutsi-kit-map.json"), JSON.stringify(mapa, null, 2))
  console.log(`mapa gravado: data/seeds/sortitoutsi-kit-map.json (${Object.keys(mapa).length} clubes)`)
}
