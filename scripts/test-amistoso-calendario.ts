// AMISTOSO NO CALENDARIO — as duas invariantes que nao podem quebrar:
//
//   1. o amistoso NUNCA cai numa semana com compromisso oficial;
//   2. o amistoso NUNCA entra na conta de fim de temporada.
//
// A segunda e a que importa de verdade: `isSeasonOver` fecha o ano quando o
// clube nao tem mais nada para jogar, e `seasonEndWeek` sai da maior semana do
// calendario. Um jogo-treino pendente em qualquer uma das duas contas ressuscita
// o bug historico do "a temporada nunca termina".
import {
  amistososVencidos, atribuirDiasDoMes, concluirAmistoso, construirFixturesDeAmistoso, diaDaPartida,
  ehAmistoso, fixturesQueContamNaTemporada, migrarAmistososSemSemana,
  semanasLivresParaAmistoso, type AmistosoAgendado, type FixtureBasico, type FixtureComDia,
} from "../lib/amistosos-calendario"
import { isSeasonOver, selectOverdueUserFixtures } from "../lib/fixture-catchup"
import type { Team } from "../lib/teams-data"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

const time = (curto: string): Team => ({
  nome: curto, curto, cor1: "#000", cor2: "#fff", prestigio: 70, saldo: 0,
  divisao: "serie_a", pais: "Brasil", cidade: "", estado: "", torcida: 1000,
  estadio_cap: 1000, file_key: curto.toLowerCase(), estadio_nome: "", patrocinador: "",
  escudo_url: "",
} as unknown as Team)

// Calendario de exemplo: jogos do usuario nas semanas 1..5 e 7; a 6 esta livre
// (uma pausa FIFA, que nao ocupa o clube).
const calendario: FixtureBasico[] = [
  ...[1, 2, 3, 4, 5, 7].map(week => ({ week, isUserMatch: true, competitionType: "league", played: week < 4 })),
  { week: 6, isUserMatch: false, competitionType: "fifa_break", played: true },
]

console.log("== Amistoso no calendario ==")

// 1) A semana livre e oferecida; as ocupadas, nao.
const livres = semanasLivresParaAmistoso(calendario, 3)
check(livres.includes(6), `semana 6 (pausa FIFA) deveria estar livre — vieram ${livres.join(",")}`)
check(!livres.some(w => [4, 5, 7].includes(w)), `semanas com jogo oficial nao podem ser oferecidas — vieram ${livres.join(",")}`)
check(!livres.some(w => w <= 3), "nao se marca amistoso no passado nem na semana corrente")

// 2) Uma semana ja tomada por outro amistoso tambem sai da lista.
const jaMarcado: AmistosoAgendado[] = [{ oppShort: "X", oppNome: "X", dateLabel: "d", userIsHome: true, week: 6 }]
check(!semanasLivresParaAmistoso(calendario, 3, jaMarcado).includes(6), "semana com amistoso marcado nao pode ser oferecida de novo")

// 3) FIM DE TEMPORADA — o coracao do teste.
//    Liga completa, tudo jogado, MENOS um amistoso pendente na semana 40.
const amistosoPendente = { week: 40, isUserMatch: true, competitionType: "friendly", played: false }
const oficiaisJogados = [1, 2, 3].map(week => ({ week, isUserMatch: true, competitionType: "league", played: true }))
const todos = [...oficiaisJogados, amistosoPendente]

check(
  isSeasonOver({
    leagueComplete: true,
    currentWeek: 4,
    // As duas contas passam pelo filtro, como no advanceWeek real.
    seasonEndWeek: Math.max(...fixturesQueContamNaTemporada(todos).map(f => f.week)),
    userFixtures: fixturesQueContamNaTemporada(todos),
  }),
  "com o amistoso FORA da conta, a temporada tem de fechar",
)
check(
  !isSeasonOver({
    leagueComplete: true, currentWeek: 4, seasonEndWeek: 40, userFixtures: todos,
  }),
  "controle: com o amistoso DENTRO da conta a temporada nao fecha — e por isso ele fica de fora",
)

// 4) Amistoso nao e partida atrasada: o motor nao pode simula-lo.
const atrasadas = selectOverdueUserFixtures(
  [amistosoPendente, { week: 2, isUserMatch: true, competitionType: "cup", played: false }],
  41,
)
check(atrasadas.length === 1 && atrasadas[0].competitionType === "cup", "so a copa atrasada deve ser simulada, nunca o amistoso")

// 5) Construcao do fixture: mando, placar e dia sem colisao.
const marcados: AmistosoAgendado[] = [
  { oppShort: "RIV", oppNome: "Rival", dateLabel: "Sáb, 14 Mar", userIsHome: true, week: 6 },
  { oppShort: "RIV", oppNome: "Rival", dateLabel: "Sáb, 21 Mar", userIsHome: false, week: 8, jogado: true, golsPro: 3, golsContra: 1 },
]
const fixtures = construirFixturesDeAmistoso<Record<string, unknown>>(marcados, {
  userTeam: time("USR"),
  season: 2026,
  currentWeek: 3,
  resolveTeam: () => time("RIV"),
  diasOcupadosPorMes: new Map(),
  monta: d => ({ ...d, competitionType: "friendly" }),
})
check(fixtures.length === 2, `deveriam sair 2 fixtures, sairam ${fixtures.length}`)
check((fixtures[0].homeTeam as Team).curto === "USR", "com mando do usuario ele e o mandante")
check((fixtures[1].awayTeam as Team).curto === "USR", "sem mando do usuario ele e o visitante")
// Jogado fora de casa, 3x1 a favor => placar do fixture e 1 (casa) x 3 (fora).
check(fixtures[1].homeScore === 1 && fixtures[1].awayScore === 3, `placar do amistoso jogado fora saiu ${fixtures[1].homeScore}x${fixtures[1].awayScore}`)
check(ehAmistoso({ competitionType: "friendly" }) && !ehAmistoso({ competitionType: "league" }), "ehAmistoso identifica o tipo")

// 6) Dia ja ocupado por um jogo oficial faz o amistoso andar para o dia seguinte.
const mes = fixtures[0].month as number
const diaLivre = fixtures[0].dayOfMonth as number
const comColisao = construirFixturesDeAmistoso<Record<string, unknown>>([marcados[0]], {
  userTeam: time("USR"), season: 2026, currentWeek: 3,
  resolveTeam: () => time("RIV"),
  diasOcupadosPorMes: new Map([[mes, new Set([diaLivre])]]),
  monta: d => ({ ...d }),
})
check(comColisao[0].dayOfMonth !== diaLivre, "dia ja ocupado por jogo oficial nao pode receber o card do amistoso")

// 7) Amistoso que ficou para tras sem ser jogado nao volta ao calendario.
const vencido = construirFixturesDeAmistoso<Record<string, unknown>>(
  [{ oppShort: "RIV", oppNome: "Rival", dateLabel: "d", userIsHome: true, week: 2 }],
  { userTeam: time("USR"), season: 2026, currentWeek: 9, resolveTeam: () => time("RIV"), diasOcupadosPorMes: new Map(), monta: d => ({ ...d }) },
)
check(vencido.length === 0, "amistoso com data vencida nao entra no calendario")
check(
  amistososVencidos([{ oppShort: "RIV", oppNome: "Rival", dateLabel: "d", userIsHome: true, week: 2 }], 9).length === 1,
  "amistososVencidos precisa achar o que ficou para tras",
)

// 8) Concluir o amistoso guarda o placar e NAO o remove da agenda.
const concluidos = concluirAmistoso(marcados, 6, 2, 0)
check(concluidos !== null && concluidos.length === 2, "concluir nao remove o amistoso da lista")
check(concluidos?.[0].jogado === true && concluidos?.[0].golsPro === 2, "o placar precisa ficar guardado")
check(concluirAmistoso(marcados, 99, 1, 1) === null, "semana sem amistoso pendente devolve null")

// 9) Migracao de save antigo (sem semana) realoca para uma semana livre.
const migrados = migrarAmistososSemSemana(
  [{ oppShort: "RIV", oppNome: "Rival", dateLabel: "Sáb, 14 Mar", userIsHome: true }],
  calendario, 3,
)
check(migrados !== null && migrados[0].week === 6, `save antigo deveria cair na semana 6, caiu em ${migrados?.[0].week}`)
check(migrarAmistososSemSemana(marcados, calendario, 3) === null, "sem nada a migrar, devolve null (nao grava save a toa)")

// 10) O dia do card: o amistoso manda no seu, o oficial usa a tabela por rodada.
check(diaDaPartida({ round: 1, dayOfMonth: 27 }) === 27, "dayOfMonth manda quando existe")
check(diaDaPartida({ round: 1 }) === 1 && diaDaPartida({ round: 1, midweek: true }) === 3, "jogo oficial mantem a tabela por rodada")

// 11) DIAS DO MES — a regressao que fazia a FINAL da Copa do Brasil aparecer
// antes de rodadas anteriores a ela, e um jogo sumir da tela quando dois caiam
// no mesmo dia. Cenario real: agosto com liga (semanas 32/33/34) e copa em meio
// de semana (semanas 33/34). Antes: d10=sem33, d14=sem34, d22=sem32.
{
  const agosto: FixtureComDia[] = [
    { month: 7, week: 32, isUserMatch: true, competitionType: "league" },
    { month: 7, week: 33, isUserMatch: true, competitionType: "league" },
    { month: 7, week: 33, isUserMatch: true, competitionType: "cup", midweek: true },
    { month: 7, week: 34, isUserMatch: true, competitionType: "league" },
    { month: 7, week: 34, isUserMatch: true, competitionType: "cup", midweek: true },
    // Jogo de outro clube e pausa FIFA nao recebem dia — nao sao desenhados.
    { month: 7, week: 33, isUserMatch: false, competitionType: "league" },
  ]
  const comDia = atribuirDiasDoMes(agosto, 2026)
  const doUsuario = comDia.filter(f => f.isUserMatch)
  const dias = doUsuario.map(f => f.dayOfMonth!)
  check(dias.every(d => d >= 1 && d <= 31), `dia fora de agosto: ${dias.join(",")}`)
  check(new Set(dias).size === dias.length, `dois jogos no mesmo dia: ${dias.join(",")}`)
  const ordenados = [...doUsuario].sort((a, b) => a.dayOfMonth! - b.dayOfMonth!)
  check(
    ordenados.every((f, i) => i === 0 || f.week >= ordenados[i - 1].week),
    `mes fora de ordem cronologica: ${ordenados.map(f => `d${f.dayOfMonth}=sem${f.week}`).join(" ")}`,
  )
  check(
    ordenados[2].midweek === true && ordenados[2].week === 33,
    "o jogo de meio de semana deve vir logo depois da rodada com que divide a semana",
  )
  check(comDia[5].dayOfMonth === undefined, "jogo que nao e do usuario nao recebe dia")

  // Fevereiro: o dia nunca pode passar do fim do mes, nem com muitos jogos.
  const fevereiro: FixtureComDia[] = Array.from({ length: 9 }, (_, i) => ({
    month: 1, week: i + 1, isUserMatch: true, competitionType: "league",
  }))
  const fev = atribuirDiasDoMes(fevereiro, 2026).map(f => f.dayOfMonth!)
  check(fev.every(d => d >= 1 && d <= 28), `fevereiro estourou: ${fev.join(",")}`)
  check(new Set(fev).size === fev.length, `fevereiro repetiu dia: ${fev.join(",")}`)

  // Amistoso ja traz o dia calculado da data real — nao pode ser reescrito.
  const comAmistoso = atribuirDiasDoMes<FixtureComDia>(
    [{ month: 2, week: 5, isUserMatch: true, competitionType: "friendly", dayOfMonth: 14 }],
    2026,
  )
  check(comAmistoso[0].dayOfMonth === 14, "amistoso mantem o dia proprio")
}

console.log(falhas === 0 ? "\nOK — amistoso e um fixture jogavel e nao segura a temporada" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
