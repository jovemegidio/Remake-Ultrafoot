// CLUBES COM OS CAMPOS TROCADOS NO SEED (nao e mojibake).
//
// O que a auditoria de 30/07/2026 achou em data/seeds/imported-bf2026.json:
//
//   liverpool_ing      nome="Anfield"          tecnico="Alisson Becker"  estadio="Arne Slot"
//   leedsunited_ing    nome="Elland Road"      tecnico="Illan Meslier"   estadio="Marcelo Bielsa"
//   leicestercity_ing  nome="King Power..."    tecnico="Jakub Stolarczyk" estadio="Gary Rowett"
//
// Ou seja: para uma FAIXA de clubes (quase toda a letra L, mais a Q e alguns
// avulsos) a coleta pegou a coluna errada da tabela de origem e girou os campos:
//
//   nome    <- ESTADIO
//   tecnico <- um JOGADOR
//   estadio <- TECNICO
//
// Isso e diferente do mojibake (bytes trocados, ver scripts/corrigir-mojibake.mjs)
// e diferente da sigla do pool (o `curto` e o fileKey cortado em 8 — resolvido na
// exibicao por lib/club-identity.ts). Aqui o NOME esta errado, e nome de clube e
// CHAVE DE CASAMENTO neste projeto: escudo, uniforme, elenco do Transfermarkt e
// registro de transferencia todos casam por nome. Com "Anfield" no lugar de
// "Liverpool", o Liverpool curado nao achava o proprio elenco no pool.
//
// POR QUE UMA TABELA A MAO, e nao heuristica: `club-official-names.json` — a
// referencia que existia — tem ela mesma erros grosseiros (byKey.liverpool_ing =
// "Cranfield United"). Cada linha daqui foi conferida contra o fileKey, o pais e
// os nomes de tecnico/estadio do proprio registro.
//
// Uso:  node scripts/corrigir-clubes-corrompidos.mjs          (so relatorio)
//       node scripts/corrigir-clubes-corrompidos.mjs --apply  (grava, com backup)

import fs from "node:fs"
import path from "node:path"

const RAIZ = process.cwd()
const ARQUIVO = path.join(RAIZ, "data/seeds/imported-bf2026.json")
const APLICAR = process.argv.includes("--apply")

/**
 * fileKey -> nome correto do clube.
 *
 * Os quatro primeiros vieram do usuario com o NOME OFICIAL por extenso
 * (30/07/2026). Nome longo nao quebra o casamento com o catalogo curado porque
 * a ponte nao depende do nome: `teamAliasOverrides` (players-data) liga
 * liverpool->liverpool_ing e lille->lille_fra, o Lyon casa pelo proprio
 * file_key, e a identidade do mercado passou a resolver por fileKey em
 * lib/club-identity.ts. Renomear sem essas pontes deixaria o clube curado sem
 * elenco — foi o que motivou a checagem.
 */
const NOME_CORRETO = {
  // Inglaterra / Escocia
  liverpool_ing: "Liverpool Football Club",
  leedsunited_ing: "Leeds United",
  leicestercity_ing: "Leicester City",
  luton_ing: "Luton Town",
  leyton_ing: "Leyton Orient",
  queenspark_ing: "Queens Park Rangers",
  livingston_esc: "Livingston",
  // Espanha
  levante_esp: "Levante",
  laspalmas_esp: "Las Palmas",
  leganes_esp: "Leganés",
  // Franca
  lyon: "Olympique Lyonnais",
  lille_fra: "Lille Olympique Sporting Club",
  lens_fr: "Lens",
  lorient_fr: "Lorient",
  lehavre_fr: "Le Havre",
  lemans_fra: "Le Mans",
  lyonduchere_fra: "Lyon-Duchère",
  quevilly_fra: "Quevilly-Rouen",
  gfcajaccio_fr: "Gazélec Ajaccio",
  LePuyFootball43Auvergne_fra: "Le Puy Foot 43",
  LilleIl_fra: "Lille II",
  OlympiqueLyonnaisII_fra: "Olympique Lyonnais II",
  // Italia
  lazio_it: "Lazio",
  lecce_ita: "Lecce",
  livorno_it: "Livorno",
  lucchese_ita: "Lucchese",
  lumezzane_ita: "Lumezzane",
  latina_ita: "Latina",
  // Portugal
  leixoes_por: "Leixões",
  uniaoleiria_por: "União de Leiria",
  lusitania_por: "Lusitânia",
  lusitaniaacores_por: "Lusitânia dos Açores",
  // Resto da Europa
  lask_aut: "LASK",
  liefering_aut: "FC Liefering",
  lalouviere_bel: "La Louvière",
  levadiakos_gre: "Levadiakos",
  levskisofia_bul: "Levski Sofia",
  leningradets_rus: "Leningradets",
  terekgroznyi_rus: "Akhmat Grozny",
  lokomotiva_cro: "NK Lokomotiva Zagreb",
  bodoglimt_nor: "Bodø/Glimt",
  LupoMartini_ale: "Lupo-Martini Wolfsburg",
  fchelios_ucr: "Helios Kharkiv",
  gabala_azb: "Gabala",
  // America do Sul
  lanus_arg: "Lanús",
  losandes_arg: "Los Andes",
  quilmes_arg: "Quilmes",
  ldu_equ: "LDU Quito",
  leon_per: "León de Huánuco",
  deplaguaira_ven: "Deportivo La Guaira",
  Carabobo: "Carabobo",
  liverpool_uru: "Liverpool Montevideo",
  // Brasil
  londrina_pr: "Londrina",
  luziania_bra: "Luziânia",
  luverdensemt_bra: "Luverdense",
  quixada_ce: "Quixadá",
  linense_sp: "Linense",
  // Estados Unidos
  lafc433_eua: "Los Angeles FC",
  lagalaxy433_eua: "LA Galaxy",
  lasvegas433_eua: "Las Vegas Lights",
  louisville433_eua: "Louisville City",
  legion433_eua: "Birmingham Legion",
  // Asia / Turquia
  qingdao_chn: "Qingdao Hainiu",
  Menemenspor: "Menemenspor",
}

/**
 * Estadio de quem eu tenho certeza. Onde nao entra aqui, o script tenta o
 * proprio nome antigo (que era o estadio no registro girado).
 */
const ESTADIO_CORRETO = {
  liverpool_ing: "Anfield",
  leedsunited_ing: "Elland Road",
  leicestercity_ing: "King Power Stadium",
  luton_ing: "Kenilworth Road",
  queenspark_ing: "Loftus Road",
  lyon: "Groupama Stadium",
  lille_fra: "Stade Pierre-Mauroy",
  lens_fr: "Bollaert-Delelis",
  lorient_fr: "Stade du Moustoir",
  lehavre_fr: "Stade Océane",
  lazio_it: "Olimpico",
  laspalmas_esp: "Gran Canaria",
  levante_esp: "Ciutat de València",
  leganes_esp: "Butarque",
  lafc433_eua: "BMO Stadium",
  lanus_arg: "La Fortaleza",
  ldu_equ: "Rodrigo Paz Delgado",
  livingston_esc: "Almondvale",
  levskisofia_bul: "Georgi Asparuhov",
  bodoglimt_nor: "Aspmyra",
  lokomotiva_cro: "Kranjčevićeva",
}

const PALAVRA_DE_ESTADIO = /(estadi|stadi|stade|arena|park|field|campo|monumental|olimpic|olympi)/i

/**
 * Clubes em que o `nome` corrompido era o TECNICO, e nao o estadio (o giro dos
 * campos nao foi igual para todo mundo). Sem esta lista, "Danny Cruz" — que e o
 * treinador do Louisville City — iria para o campo `estadio`.
 */
const NOME_ANTIGO_ERA_O_TECNICO = new Set([
  "queenspark_ing",   // Mark Warburton
  "lanus_arg",        // Frank Kudelka
  "louisville433_eua", // Danny Cruz
])

/**
 * Clubes em que o `nome` corrompido nao era estadio NEM tecnico (veio um jogador
 * ou um pedaco solto): so o nome e corrigido, o resto do registro fica como esta
 * — escrever um palpite no lugar seria trocar um dado errado por outro.
 */
const NOME_ANTIGO_INDEFINIDO = new Set([
  "qingdao_chn",      // Andres Iniesta (jogador)
])

const normalizar = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

const bruto = fs.readFileSync(ARQUIVO, "utf8")
const dados = JSON.parse(bruto)
const times = dados.teams
if (!Array.isArray(times)) {
  console.error("Formato inesperado: esperava { teams: [...] }")
  process.exit(1)
}

// Indice de nomes ja usados, para nao criar DOIS clubes com o mesmo nome — o que
// fundiria elenco e escudo de dois times diferentes (a mesma trava que o
// corrigir-mojibake.mjs usa antes de mexer em chave).
const nomesEmUso = new Map()
for (const t of times) {
  const k = normalizar(t.nome)
  nomesEmUso.set(k, (nomesEmUso.get(k) ?? 0) + 1)
}

const mudancas = []
const colisoes = []
const naoAchados = []

for (const [fileKey, nomeNovo] of Object.entries(NOME_CORRETO)) {
  const t = times.find((x) => x.fileKey === fileKey)
  if (!t) { naoAchados.push(fileKey); continue }
  const nomeAntigo = t.nome
  if (normalizar(nomeAntigo) === normalizar(nomeNovo)) continue

  // Colisao: ja existe OUTRO clube com esse nome.
  if ((nomesEmUso.get(normalizar(nomeNovo)) ?? 0) > 0) {
    colisoes.push({ fileKey, nomeAntigo, nomeNovo })
    continue
  }

  // Reconstrucao do giro de campos. So mexe em `estadio`/`tecnico` quando da
  // para saber de onde o dado veio; na duvida, deixa como esta.
  //
  //   estadio: o corrigido a mao; senao o nome antigo, mas SO se ele parecer
  //            nome de estadio (senao seria uma pessoa no campo do estadio).
  //   tecnico: o estadio antigo quando ele e nome de PESSOA — e para la que o
  //            treinador foi empurrado; ou o proprio nome antigo, nos clubes em
  //            que era o tecnico que estava no lugar do nome.
  const estadioAntigo = String(t.estadio ?? "").trim()
  const estadioAntigoEhPessoa =
    Boolean(estadioAntigo) && !PALAVRA_DE_ESTADIO.test(estadioAntigo) && estadioAntigo.split(/\s+/).length <= 3
  const indefinido = NOME_ANTIGO_INDEFINIDO.has(fileKey)
  const eraTecnico = NOME_ANTIGO_ERA_O_TECNICO.has(fileKey)

  let estadioNovo = t.estadio
  let tecnicoNovo = t.tecnico
  if (!indefinido) {
    estadioNovo =
      ESTADIO_CORRETO[fileKey] ??
      (!eraTecnico && (PALAVRA_DE_ESTADIO.test(nomeAntigo) || estadioAntigoEhPessoa) ? nomeAntigo : t.estadio)
    tecnicoNovo = eraTecnico
      ? nomeAntigo
      : estadioAntigoEhPessoa ? estadioAntigo : t.tecnico
  }

  mudancas.push({
    fileKey,
    nome: [nomeAntigo, nomeNovo],
    estadio: [t.estadio, estadioNovo],
    tecnico: [t.tecnico, tecnicoNovo],
  })

  if (APLICAR) {
    nomesEmUso.set(normalizar(nomeAntigo), (nomesEmUso.get(normalizar(nomeAntigo)) ?? 1) - 1)
    nomesEmUso.set(normalizar(nomeNovo), 1)
    t.nome = nomeNovo
    t.estadio = estadioNovo
    t.tecnico = tecnicoNovo
  }
}

console.log(`Clubes na tabela: ${Object.keys(NOME_CORRETO).length}`)
console.log(`A corrigir: ${mudancas.length}`)
for (const m of mudancas) {
  console.log(`  ${m.fileKey}`)
  console.log(`     nome    "${m.nome[0]}" -> "${m.nome[1]}"`)
  if (m.estadio[0] !== m.estadio[1]) console.log(`     estadio "${m.estadio[0]}" -> "${m.estadio[1]}"`)
  if (m.tecnico[0] !== m.tecnico[1]) console.log(`     tecnico "${m.tecnico[0]}" -> "${m.tecnico[1]}"`)
}
if (colisoes.length) {
  console.log(`\nPULADOS por colisao de nome (${colisoes.length}) — conferir a mao:`)
  for (const c of colisoes) console.log(`  ${c.fileKey}: "${c.nomeAntigo}" -> "${c.nomeNovo}" (nome ja existe)`)
}
if (naoAchados.length) console.log(`\nfileKey inexistente no seed (${naoAchados.length}): ${naoAchados.join(", ")}`)

if (!APLICAR) {
  console.log("\n(relatorio apenas — rode com --apply para gravar)")
  process.exit(0)
}

const backup = `${ARQUIVO}.bak-clubes-corrompidos`
if (!fs.existsSync(backup)) fs.writeFileSync(backup, bruto)
// SEM indentacao: o seed e gravado minificado (uma linha, como veio do import).
// Reformatar transforma um diff de 1 linha em 668 mil e infla o arquivo em 4 MB.
fs.writeFileSync(ARQUIVO, JSON.stringify(dados))
console.log(`\nGravado. Backup em ${path.basename(backup)}`)
