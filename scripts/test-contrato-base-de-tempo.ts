/**
 * Contrato e emprestimo tem de usar SEMANA ABSOLUTA.
 *
 * `currentWeek` conta 0..51 e zera a cada temporada; o vencimento e conferido
 * contra `absoluteWeek(season, week)`. Quatro gravadores usavam a base relativa
 * e o atleta nascia com o fim no passado: promover da base em 2029 entregava um
 * garoto que ia embora de graca no advanceWeek seguinte.
 *
 * Este teste avanca a carreira ate uma temporada distante da epoca e cobra que
 * o vinculo sobreviva — e a unica forma de flagrar a regressao, porque na
 * temporada 1 as duas contas dao o MESMO numero.
 */
import { useGameEngine, absoluteWeek } from "../lib/game-engine"

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

const g = () => useGameEngine.getState()
g().initializeGame("BGT")

// Tres viradas de temporada: a base relativa e a absoluta ja divergem em 156 semanas.
for (let t = 0; t < 3; t++) {
  for (let semana = 0; semana < 52; semana++) g().advanceWeek()
  const antes = g()
  g().processSeasonEnd(antes.currentSeason + 1, antes.serieAStandings, antes.serieAStandings)
}

const estado = g()
const agora = absoluteWeek(estado.currentSeason, estado.currentWeek)
ok("a semana da temporada zerou (a base relativa e mesmo enganosa)", estado.currentWeek < 52 && agora >= 156,
  `currentWeek=${estado.currentWeek}, absoluteWeek=${agora}`)

// ---- promover da base ----------------------------------------------------
const elencoAntes = g().squadPlayers.length
const promovido = g().promoverDaBase(
  { name: "QA Base Absoluta", position: "MEI", age: 18, overall: 62, potential: 80 }, 0,
)
ok("promover da base devolve sucesso", promovido)

const garoto = g().squadPlayers.find(p => p.name === "QA Base Absoluta")
ok("o garoto entrou no elenco", !!garoto, `elenco ${elencoAntes} -> ${g().squadPlayers.length}`)
ok("o contrato dele NAO nasce vencido", !!garoto?.contract && garoto.contract.endDate > agora,
  `endDate=${garoto?.contract?.endDate}, agora=${agora}`)
ok("o contrato vale as tres temporadas combinadas", !!garoto?.contract && garoto.contract.endDate >= agora + 52 * 3 - 1,
  `faltam ${(garoto?.contract?.endDate ?? 0) - agora} semanas`)

// Uma temporada inteira depois ele continua no clube.
for (let semana = 0; semana < 52; semana++) g().advanceWeek()
ok("continua no elenco uma temporada depois", g().squadPlayers.some(p => p.name === "QA Base Absoluta"))

// ---- emprestimo ----------------------------------------------------------
const modelo = g().squadPlayers[0]
const chegou = g().loanPlayer(
  { ...modelo, id: 887001, name: "QA Emprestimo Absoluto" }, 26, modelo.contract?.salary ?? 10000, 0, true,
)
const emprestado = g().squadPlayers.find(p => p.name === "QA Emprestimo Absoluto")
if (!emprestado) {
  console.log(`AVISO emprestimo nao entrou nesta rodada (retorno "${String(chegou)}") — pulando`)
} else {
  const agoraEmp = absoluteWeek(g().currentSeason, g().currentWeek)
  ok("o emprestimo NAO nasce vencido", (emprestado.loanEndWeek ?? 0) > agoraEmp,
    `loanEndWeek=${emprestado.loanEndWeek}, agora=${agoraEmp}`)
  ok("o contrato do emprestado acompanha o vinculo",
    (emprestado.contract?.endDate ?? 0) === (emprestado.loanEndWeek ?? -1),
    `endDate=${emprestado.contract?.endDate}, loanEndWeek=${emprestado.loanEndWeek}`)
}

console.log(falhas === 0 ? "\nRESULTADO: TUDO OK" : `\nRESULTADO: ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
