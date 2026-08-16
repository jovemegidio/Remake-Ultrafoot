// QA da 1.0.322 — futebol feminino, base por país e carreira de jogador.
//
// Prova que as três modalidades novas rodam na MESMA máquina do profissional:
// liga com clubes certos, competições declaradas, pirâmide, calendário, tabela e
// copa. Os erros que ele pega não aparecem no tsc: liga com número ÍMPAR de
// clubes (a temporada nunca fecha), `curto` repetido (a tabela desenha o escudo
// de outro clube), continental misturando gênero e temporada que não termina.
import { LIGAS_FEMININAS, TAMANHO_DAS_LIGAS_FEMININAS, ehDivisaoFeminina } from "@/lib/futebol-feminino"
import { getAllTimesFemininos, getTeamsByDivision, completarLigaComPool, tamanhoDaLiga, getTeamByFileKey, allTeams, allPoolTeams } from "@/lib/teams-data"
import { getCountryCompetitions, getConfederation, getContinentalDivisions, getContinentalSpot } from "@/lib/country-competitions"
import { competitionsByLeague } from "@/lib/international-competitions"
import { COMPETITION_REGULATIONS_2026 } from "@/lib/competition-regulations-2026"
import { relegationCount, divisionBelow, divisionLabel } from "@/lib/league-pyramid"
import { periodo2026 } from "@/lib/competition-dates-2026"
import { formatosDeBase, createYouthCareer, jogarRodadaDaBase, finishYouthSeason, proximaPartidaDaBase } from "@/lib/youth-career-engine"
import { getPlayersForTeam } from "@/lib/players-data"
import { criarAtletaDaCarreira, criarCarreiraDeJogador, jogarProximaRodada, encerrarTemporada, mediaDaTemporada } from "@/lib/carreira-de-jogador"
import { DEFAULT_STATE, type GameState } from "@/lib/save-system"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

// ── 1. LIGAS FEMININAS ──────────────────────────────────────────────────────
const femininos = getAllTimesFemininos()
console.log(`ligas femininas: ${LIGAS_FEMININAS.length} | clubes: ${femininos.length}`)

for (const liga of LIGAS_FEMININAS) {
  if (liga.clubes.length % 2 !== 0) erro(`${liga.id} tem ${liga.clubes.length} clubes (impar)`)
  if (TAMANHO_DAS_LIGAS_FEMININAS[liga.id] !== liga.clubes.length) erro(`${liga.id}: tamanho declarado difere dos clubes`)
  if (tamanhoDaLiga(liga.id) !== liga.clubes.length) erro(`${liga.id}: tamanhoDaLiga nao conhece a liga`)
  const montada = completarLigaComPool(liga.id)
  if (montada.length !== liga.clubes.length) erro(`${liga.id}: completarLigaComPool devolveu ${montada.length}`)
  if (montada.some(t => !String(t.file_key).endsWith("__fem"))) erro(`${liga.id}: clube masculino dentro da liga feminina`)
  if (getTeamsByDivision(liga.id).length !== liga.clubes.length) erro(`${liga.id}: getTeamsByDivision divergente`)
  if (!ehDivisaoFeminina(liga.id)) erro(`${liga.id}: ehDivisaoFeminina falso`)

  // Competicoes, regulamento e calendario — o que o profissional tem.
  const comp = getCountryCompetitions(liga.id)
  if (comp.country === "Internacional") erro(`${liga.id} caiu no FALLBACK de competicoes`)
  if (comp.domesticCup !== liga.copaNacional) erro(`${liga.id}: copa nacional divergente`)
  if (getConfederation(liga.id) === "UNAFFILIATED") erro(`${liga.id} sem confederacao`)
  if (!periodo2026(liga.id)) erro(`${liga.id} sem janela de calendario`)
  const catalogo = competitionsByLeague[liga.id] ?? []
  if (!catalogo.some(c => c.type === "league")) erro(`${liga.id} sem competicao de liga no catalogo`)
  if (!catalogo.some(c => c.type === "cup")) erro(`${liga.id} sem copa no catalogo`)
  if (!COMPETITION_REGULATIONS_2026[liga.id]) erro(`${liga.id} sem regulamento derivado`)
  if (divisionLabel(liga.id) === liga.id) erro(`${liga.id} sem rotulo na piramide`)
  // Continental so entre clubes da MESMA modalidade.
  const continentais = getContinentalDivisions(liga.id)
  if (continentais.some(div => !ehDivisaoFeminina(div))) erro(`${liga.id}: continental sorteia divisao masculina`)
  if (liga.nivel === 1 && liga.continental && !getContinentalSpot(liga.id, 1).qualified) erro(`${liga.id}: campea sem vaga continental`)
}

// Piramide feminina onde ha duas divisoes
for (const pais of ["BRA", "ENG"]) {
  const primeira = LIGAS_FEMININAS.find(l => l.codigoPais === pais && l.nivel === 1)!
  const segunda = LIGAS_FEMININAS.find(l => l.codigoPais === pais && l.nivel === 2)!
  if (divisionBelow(primeira.id) !== segunda.id) erro(`${primeira.id}: piramide nao desce para ${segunda.id}`)
  if (relegationCount(primeira.id) < 1) erro(`${primeira.id}: sem rebaixamento`)
}

// `curto` unico no jogo inteiro + elenco feminino gerado
const masculinos = new Set([...allTeams.map(t => t.curto), ...allPoolTeams.map(t => t.curto)])
const vistos = new Set<string>()
for (const t of femininos) {
  if (masculinos.has(t.curto)) erro(`curto ${t.curto} (${t.nome}) colide com clube masculino`)
  if (vistos.has(t.curto)) erro(`curto ${t.curto} repetido entre clubes femininos`)
  vistos.add(t.curto)
  if (getTeamByFileKey(t.file_key)?.nome !== t.nome) erro(`getTeamByFileKey nao devolve ${t.nome}`)
}
const corinthians = femininos.find(t => t.nome.startsWith("Corinthians"))!
const elenco = getPlayersForTeam(corinthians)
if (elenco.length < 18) erro(`elenco feminino curto: ${elenco.length}`)
const MASCULINOS_CONHECIDOS = ["Lucas", "Pedro", "Gabriel", "Matheus", "Rafael", "Bruno"]
const intrusos = elenco.filter(p => MASCULINOS_CONHECIDOS.includes(p.nome.split(" ")[0]))
if (intrusos.length > 0) erro(`elenco feminino com nome masculino: ${intrusos.map(p => p.nome).join(", ")}`)

// ── 2. BASE (SUB-20) ────────────────────────────────────────────────────────
for (const [pais, minimo] of [["Brasil", 3], ["Inglaterra", 3], ["Japao", 2], ["Cazaquistao", 2]] as const) {
  const formatos = formatosDeBase(pais)
  if (formatos.length < minimo) erro(`base de ${pais}: ${formatos.length} competicoes`)
  if (pais !== "Brasil" && formatos.some(f => f.name.includes("Paulo"))) erro(`base de ${pais} disputando a Copinha`)
}

const palmeiras = allTeams.find(t => t.nome === "Palmeiras")!
const { career, players } = createYouthCareer(palmeiras, 2026)
if (!career.calendario?.length) erro("base sem calendario")
if (!career.tabela?.length) erro("base sem tabela")
if (!career.copa) erro("base sem copa")
if ((career.tabela?.length ?? 0) % 2 !== 0) erro("base com numero impar de academias")
let estadoBase: GameState = { ...DEFAULT_STATE, youthCareer: career, youthPlayers: players, selectedTeamShort: palmeiras.curto }
let rodadas = 0
while (!estadoBase.youthCareer?.seasonFinished && rodadas < 80) { estadoBase = jogarRodadaDaBase(estadoBase); rodadas++ }
const base = estadoBase.youthCareer!
if (!base.seasonFinished) erro("temporada da base nao termina")
const jogosDoUsuario = (base.calendario ?? []).filter(f => f.isUserMatch)
if (jogosDoUsuario.some(f => !f.played)) erro("base: sobraram partidas do usuario sem jogar")
if (base.matches !== jogosDoUsuario.length) erro(`base: ${base.matches} partidas contadas para ${jogosDoUsuario.length} do calendario`)
const somaJogos = (base.tabela ?? []).reduce((n, l) => n + l.played, 0)
if (somaJogos !== (base.calendario ?? []).length * 2) erro("base: tabela nao bate com o calendario")
const depois = finishYouthSeason(estadoBase)
if (depois.youthCareer?.currentSeason !== 2027) erro("base nao virou a temporada")
if (!depois.youthCareer?.calendario?.length) erro("base sem calendario na temporada nova")
if (proximaPartidaDaBase(depois.youthCareer)?.round !== 1) erro("base: temporada nova nao comeca na rodada 1")

// ── 3. CARREIRA DE JOGADOR ──────────────────────────────────────────────────
const atleta = criarAtletaDaCarreira({ nome: "Teste da Silva", posicao: "ATA", idade: 18, nacionalidade: "Brasil", pePreferido: "direito", alturaCm: 180, pesoKg: 74, numero: 9 })
if (atleta.overall < 40 || atleta.overall > 80) erro(`overall inicial fora da faixa: ${atleta.overall}`)
if (atleta.potencial <= atleta.overall) erro("potencial nao e maior que o overall")
let jogador = criarCarreiraDeJogador(palmeiras, atleta, "Brasileirao Serie A", 2026)
if (!jogador.calendario.some(f => f.isUserMatch)) erro("carreira de jogador sem partidas do clube")
let n = 0
while (!jogador.temporadaEncerrada && n < 100) { jogador = jogarProximaRodada(jogador); n++ }
if (!jogador.temporadaEncerrada) erro("temporada do jogador nao termina")
if (jogador.temporadaAtual.jogos === 0) erro("atleta nao entrou em campo em nenhuma rodada")
if (mediaDaTemporada(jogador) < 3 || mediaDaTemporada(jogador) > 10) erro("media fora da escala")
const golsDoTime = jogador.calendario
  .filter(f => f.isUserMatch)
  .reduce((t, f) => t + (f.homeCurto === jogador.clubeCurto ? (f.homeGoals ?? 0) : (f.awayGoals ?? 0)), 0)
if (jogador.temporadaAtual.gols > golsDoTime) erro(`atleta marcou ${jogador.temporadaAtual.gols} num time que fez ${golsDoTime}`)
const somaTabela = jogador.tabela.reduce((t, l) => t + l.played, 0)
if (somaTabela !== jogador.calendario.length * 2) erro("jogador: tabela nao bate com o calendario")
const proxima = encerrarTemporada(jogador)
if (proxima.temporada !== 2027) erro("carreira de jogador nao virou a temporada")
if (proxima.historico.length !== 1) erro("temporada nao foi para o historico")
if (proxima.atleta.idade !== atleta.idade + 1) erro("atleta nao envelheceu")
if (proxima.calendario.some(f => f.played)) erro("temporada nova do jogador ja nasce jogada")

// Carreira feminina de jogadora: o mesmo motor, clube feminino.
const clubeFeminino = femininos.find(t => t.divisao === "brasileirao_fem_a1")!
let jogadora = criarCarreiraDeJogador(
  clubeFeminino,
  criarAtletaDaCarreira({ nome: "Teste Feminina", posicao: "MEI", idade: 17, nacionalidade: "Brasil", pePreferido: "esquerdo", alturaCm: 168, pesoKg: 60, numero: 10 }),
  "Brasileirao Feminino A1", 2026,
)
jogadora = jogarProximaRodada(jogadora)
if (!jogadora.calendario.some(f => f.played)) erro("carreira feminina de jogadora nao simula rodada")
if (jogadora.tabela.some(l => !femininos.some(t => t.curto === l.curto))) erro("tabela feminina com clube de fora da modalidade")

console.log(falhas === 0 ? "TUDO OK" : `${falhas} falha(s)`)
process.exit(falhas === 0 ? 0 : 1)
