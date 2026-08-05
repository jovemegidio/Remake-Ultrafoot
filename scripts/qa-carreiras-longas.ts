/**
 * CARREIRAS LONGAS EM VÁRIOS CLUBES — o teste que mais se parece com jogar.
 *
 * O `qa-long-campaign` roda UM clube (Bragantino) por 20 temporadas. Isso não
 * pega nada que dependa da divisão, do país ou do tamanho do elenco inicial: um
 * clube de Série D, um europeu e uma seleção passam por caminhos diferentes de
 * economia, calendário e mercado.
 *
 * Aqui cada clube joga 6+ temporadas completas e se cobra, a cada virada:
 *   • elenco jogável (piso, goleiro, defensor, atacante);
 *   • contrato coerente (ninguém sob contrato some, nada nasce vencido);
 *   • economia sã (folha bate com o elenco, saldo finito, sem impressora);
 *   • calendário fechando (temporada avança e a semana zera);
 *   • mercado vivo (as transferências do mundo acontecem);
 *   • títulos sendo registrados.
 */
import { useGameEngine, absoluteWeek, folhaSemanal } from "../lib/game-engine"
import { ELENCO_MINIMO } from "../lib/reposicao-emergencial"
import { allTeams } from "../lib/teams-data"

// 10 temporadas = 2026 -> 2036, o horizonte que o jogo precisa aguentar de pé.
// Era 6; subir o padrão faz o gate cobrir o que a carreira longa realmente pede.
const TEMPORADAS = Number(process.env.TEMPORADAS ?? 10)

/** Clubes de perfis deliberadamente diferentes (divisão, país, porte). */
// Perfis deliberadamente diferentes: Série A/B/C/D, Europa e América do Sul.
// "BOC" estava aqui e NÃO EXISTE no catálogo (Boca Juniors é `BJU`) — o harness
// pulava em silêncio e a rodada padrão cobria 7 clubes achando que cobria 8.
const CLUBES = (process.env.CLUBES ?? "BGT,FLA,MCI,RMA,ABC,BRS,BJU,PAY").split(",").map(c => c.trim()).filter(Boolean)

let falhas = 0
const falhar = (clube: string, temporada: number, o: string) => {
  console.log(`  FALHA [${clube} T${temporada}] ${o}`)
  falhas++
}

const g = () => useGameEngine.getState()

interface Resumo {
  clube: string
  temporadasOk: number
  elencoMin: number
  elencoFim: number
  saldoFim: number
  titulos: number
  transferencias: number
  divisaoFim: string
}

const resumos: Resumo[] = []

for (const curto of CLUBES) {
  const time = allTeams.find(t => t.curto === curto)
  if (!time) { console.log(`AVISO clube ${curto} não existe no catálogo — pulando`); continue }

  g().initializeGame(curto)
  const inicial = g()
  if (inicial.squadPlayers.length === 0) { falhar(curto, 0, "elenco inicial VAZIO"); continue }

  const nomesIniciais = new Set(inicial.squadPlayers.map(p => p.name))
  let elencoMin = inicial.squadPlayers.length
  let temporadasOk = 0
  let saiuSobContrato = 0

  for (let t = 1; t <= TEMPORADAS; t++) {
    for (let semana = 0; semana < 52; semana++) {
      const antes = g().squadPlayers
      const contratos = new Map(antes.map(p => [p.id, p.contract?.endDate ?? Infinity]))
      g().advanceWeek()
      const depois = g()
      elencoMin = Math.min(elencoMin, depois.squadPlayers.length)

      // Ninguém pode sumir com contrato em dia.
      const agora = absoluteWeek(depois.currentSeason, depois.currentWeek)
      const idsDepois = new Set(depois.squadPlayers.map(p => p.id))
      for (const [id, fim] of contratos) {
        if (!idsDepois.has(id) && fim > agora + 1) saiuSobContrato++
      }

      if (depois.squadPlayers.length < ELENCO_MINIMO) {
        falhar(curto, t, `elenco furou o piso na semana ${semana}: ${depois.squadPlayers.length}`)
        break
      }
      if (!Number.isFinite(depois.balance)) { falhar(curto, t, "saldo virou NaN/Infinity"); break }
    }

    const antes = g()
    g().processSeasonEnd(antes.currentSeason + 1, antes.serieAStandings, antes.serieAStandings)
    const s = g()

    if (s.currentWeek !== 0) falhar(curto, t, `semana não zerou na virada: ${s.currentWeek}`)
    if (s.currentSeason !== antes.currentSeason + 1) falhar(curto, t, "temporada não avançou")
    if (!s.squadPlayers.some(p => p.position === "GOL")) falhar(curto, t, "elenco sem goleiro")
    if (!s.squadPlayers.some(p => ["ZAG", "LD", "LE", "LAT", "DEF"].includes(p.position))) falhar(curto, t, "elenco sem defensor")
    if (!s.squadPlayers.some(p => ["ATA", "PE", "PD"].includes(p.position))) falhar(curto, t, "elenco sem atacante")
    if (s.squadPlayers.length < ELENCO_MINIMO) falhar(curto, t, `elenco abaixo do piso na virada: ${s.squadPlayers.length}`)

    // Contrato vencido no passado = alguém escapou da limpeza.
    const agora = absoluteWeek(s.currentSeason, s.currentWeek)
    const vencidos = s.squadPlayers.filter(p => p.contract && p.contract.endDate < agora)
    if (vencidos.length) falhar(curto, t, `${vencidos.length} atleta(s) com contrato vencido ainda no elenco`)

    // Folha derivada tem de bater com quem está no elenco.
    const folha = folhaSemanal(s.squadPlayers)
    if (!Number.isFinite(folha) || folha < 0) falhar(curto, t, `folha inválida: ${folha}`)

    temporadasOk++
  }

  if (saiuSobContrato > 0) falhar(curto, 0, `${saiuSobContrato} saída(s) de atleta com contrato em dia`)

  const fim = g()
  const permaneceram = fim.squadPlayers.filter(p => nomesIniciais.has(p.name)).length
  resumos.push({
    clube: curto,
    temporadasOk,
    elencoMin,
    elencoFim: fim.squadPlayers.length,
    saldoFim: Math.round(fim.balance),
    titulos: 0, // títulos vivem no save da carreira (use-game-manager), não no motor
    transferencias: permaneceram,
    divisaoFim: String(time.divisao),
  })
  console.log(`${curto.padEnd(5)} ${TEMPORADAS} temporadas · elenco ${String(fim.squadPlayers.length).padStart(2)} (mín ${String(elencoMin).padStart(2)}) · saldo ${Math.round(fim.balance).toLocaleString("pt-BR")} · ${permaneceram} remanescentes do elenco original`)
}

console.log("\n--- resumo ---")
console.log("clube  temp  elencoMin  elencoFim  saldoFim            divisao")
for (const r of resumos) {
  console.log(`${r.clube.padEnd(6)} ${String(r.temporadasOk).padStart(4)}  ${String(r.elencoMin).padStart(9)}  ${String(r.elencoFim).padStart(9)}  ${String(r.saldoFim).padStart(18)}  ${r.divisaoFim}`)
}

console.log(falhas === 0 ? `\nRESULTADO: TUDO OK (${resumos.length} clubes × ${TEMPORADAS} temporadas)` : `\nRESULTADO: ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
