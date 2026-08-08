"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { GameHeader } from "@/components/game-header"
import { commitGameState, useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { useGameEngine } from "@/lib/game-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { buildCareerStats, rankInHistory } from "@/lib/hall-of-fame-engine"
import { listJobOffers, removeJobOffer, assumirClube, podeTrocarDeClube, type PendingJobOffer } from "@/lib/career-moves"
import { calcSeasonObjective, computeBoardConfidence } from "@/lib/board-engine"
import { ofertasParaDesempregado, coachStandingScore } from "@/lib/coach-market"
import { allTeams, type Team } from "@/lib/teams-data"
import { hardNavigate } from "@/lib/hard-navigation"
import { isFifaWindowMonth, windowLabel } from "@/lib/national-windows"
import { rotuloDaSemana, semanasLivresParaAmistoso } from "@/lib/amistosos-calendario"
import { avaliarConvite, chanceDoConvite, contaDoAmistoso } from "@/lib/amistosos-negociacao"
import { formatCurrency } from "@/lib/teams-data"
import { avisar as avisarNoJogo, confirmar as confirmarNoJogo } from "@/lib/dialogo-do-jogo"
import { getGameDate } from "@/lib/game-date"
import { PISO_ENTROSAMENTO } from "@/lib/treino-e-entrosamento"
import { TeamCrest } from "@/components/team-crest"
import { IniciarTemporadaCard } from "@/components/iniciar-temporada"
import { PainelDoTreinador, type MetaDaDiretoria } from "@/components/treinador/painel-do-treinador"
import { BlocoRecolhivel } from "@/components/bloco-recolhivel"
import { analisarComComissao } from "@/lib/comissao-tecnica"
import { ReuniaoDaComissao } from "@/components/treinador/reuniao-da-comissao"
import { cn } from "@/lib/utils"
import { Award, Briefcase, ClipboardList, Star, TrendingDown, TrendingUp, Trophy, UserCircle, Swords, Home, Plane, Dumbbell, Users, X } from "lucide-react"

// `proximosSabados` saiu daqui na 1.0.223: ele oferecia SEIS sábados seguidos,
// sem olhar o calendário — metade caía em cima de rodada de liga ou de jogo de
// copa. Agora as datas vêm de `semanasLivresParaAmistoso`, que só oferece semana
// em que o clube não tem compromisso, e o rótulo vem de `rotuloDaSemana`, que usa
// exatamente o mesmo relógio do calendário.
const MAX_AMISTOSOS = 3

/**
 * Área do Treinador — a carreira sob a ótica do técnico, não do clube.
 *
 * Reúne o que estava espalhado: reputação e XP (save), histórico de temporadas
 * (hall-of-fame-engine), últimos resultados (game-engine) e propostas de outros
 * clubes (career-moves, que só apareciam no escritório e sumiam da vista).
 */
export default function TreinadorPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  const { state, setState } = useGameState()
  const { currentSeason, currentMatch, seasonCalendar, advanceWeek } = useGameManager()
  const matchResults = useGameEngine(s => s.matchResults)
  const classificacao = useGameEngine(s => s.serieAStandings)
  const initializeGame = useGameEngine(s => s.initializeGame)
  const squadCohesion = useGameEngine(s => s.squadCohesion)

  // Aceitar a proposta AQUI (antes so dava para recusar; aceitar exigia ir ao
  // Escritorio). Mesma troca de emprego, pela funcao compartilhada.
  const [avisoTroca, setAvisoTroca] = useState<string | null>(null)
  const aceitarOferta = useCallback((oferta: PendingJobOffer) => {
    // Trava de meio de temporada: quem acabou de assumir precisa cumprir o ano.
    const permissao = podeTrocarDeClube(state.contratadoEm, state.season, Boolean(state.selectedTeamShort))
    if (!permissao.pode) {
      setAvisoTroca(permissao.motivo ?? "Não é possível trocar de clube agora.")
      return
    }
    assumirClube(oferta.clubShort, {
      initializeGame,
      setEngineTime: (week, season) => useGameEngine.setState({ currentWeek: week, currentSeason: season }),
      setSaveState: (patch) => setState(patch as Parameters<typeof setState>[0]),
      navigate: hardNavigate,
      week: state.week,
      season: state.season,
      // A dívida fica com o CLUBE — ver o comentário em assumirClube.
      clubeAtual: state.selectedTeamShort,
      dividaAtual: state.debt,
      dividasPorClube: state.debtByClub,
    })
  }, [initializeGame, setState, state.week, state.season, state.contratadoEm, state.selectedTeamShort, state.debt, state.debtByClub])

  const [ofertas, setOfertas] = useState<PendingJobOffer[]>([])
  const atualizarOfertas = useCallback(() => {
    setOfertas(listJobOffers(currentSeason, state.week ?? 0))
  }, [currentSeason, state.week])

  useEffect(() => {
    atualizarOfertas()
    const handler = () => atualizarOfertas()
    window.addEventListener("ultrafoot:job-offers:changed", handler)
    return () => window.removeEventListener("ultrafoot:job-offers:changed", handler)
  }, [atualizarOfertas])

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.button === "B") router.back()
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router])

  // Aviso INEQUIVOCO de demissao: o motor grava "ultrafoot-pending-fired" ao
  // demitir. Na simulacao rapida o toast passava batido e o jogador achava que
  // "virou" o time de fallback. Aqui a demissao vira um banner explicito, lido
  // uma unica vez (o flag e consumido em seguida).
  const [avisoDemissao, setAvisoDemissao] = useState<string | null>(null)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("ultrafoot-pending-fired")
      if (!raw) return
      window.localStorage.removeItem("ultrafoot-pending-fired")
      const info = JSON.parse(raw) as { clube?: string }
      setAvisoDemissao(info?.clube ? `A diretoria do ${info.clube} encerrou o seu ciclo. Você está livre no mercado — escolha um novo clube abaixo.` : "Você foi demitido. Escolha um novo clube abaixo.")
    } catch { /* flag opcional: falha aqui nao pode quebrar a tela */ }
  }, [])

  const carreira = useMemo(() => {
    const historico = state.seasonHistory ?? []
    // `passagens` diz COMO cada ciclo terminou. Sem passá-lo, o hall da fama
    // volta a chumbar "contract_ended" em toda passagem — e uma carreira cheia
    // de demissões apareceria como uma sequência de contratos cumpridos.
    return historico.length > 0 ? buildCareerStats(historico, state.passagens ?? []) : null
  }, [state.seasonHistory, state.passagens])
  const ranking = useMemo(() => (carreira ? rankInHistory(carreira) : null), [carreira])
  // Temporadas encerradas, da mais recente para a mais antiga. Inclui os títulos
  // de copa, que entram no seasonHistory como registro proprio (posicao 1).
  const historicoPorTemporada = useMemo(
    () => [...(state.seasonHistory ?? [])].sort((a, b) => b.season - a.season),
    [state.seasonHistory],
  )

  // ── ESTADO SEM CLUBE ──────────────────────────────────────────────────────
  // Ao pedir demissao ou ser demitido, o tecnico vem PARA CA (nao mais para uma
  // tela separada) e fica aqui ate assumir um clube. As propostas SEMPRE
  // aparecem, ancoradas na reputacao (ver lib/coach-market). "Aguardar novas
  // propostas" avanca uma rodada da carreira e traz outro lote.
  const desempregado = !state.selectedTeamShort

  // ── DADOS DO PAINEL DO TREINADOR ────────────────────────────────────────
  //
  // Tudo derivado do que ja existe: nada aqui grava no save nem cria campo novo.
  const gameEngine = useGameEngine()

  /** Elenco no formato que `mercado-realista` entende (posicao/overall/idade). */
  const elencoParaAvaliacao = useMemo(
    () => (gameEngine.squadPlayers ?? []).map(p => ({
      posicao: p.position,
      overall: p.overall,
      idade: p.age,
    })),
    [gameEngine.squadPlayers],
  )

  /**
   * O PARECER DA COMISSAO — analise offline, sem API e sem custo.
   *
   * Recebe o estado que o jogo ja tem e devolve recomendacoes assinadas por
   * cada profissional. Ver lib/comissao-tecnica; as regras tem teste proprio
   * em scripts/test-comissao-tecnica.ts (16 casos).
   */
  const pareceresDaComissao = useMemo(() => {
    const prox = seasonCalendar.nextUserMatch
    const euEmCasa = prox ? prox.homeTeam.curto === userTeam?.curto : false
    const adv = prox ? (euEmCasa ? prox.awayTeam : prox.homeTeam) : null
    const ordenados = [...elencoParaAvaliacao].sort((a, b) => b.overall - a.overall).slice(0, 11)
    const forcaDoTime = ordenados.length
      ? Math.round(ordenados.reduce((t, a) => t + a.overall, 0) / ordenados.length)
      : undefined
    return analisarComComissao({
      elenco: (gameEngine.squadPlayers ?? []).map(p => ({
        id: p.id, nome: p.name, posicao: p.position, overall: p.overall, idade: p.age,
        energia: p.energy ?? 100, forma: p.form ?? 70, titular: Boolean(p.isStarter),
        lesionado: Boolean(p.injury), jogosDeSuspensao: p.suspendedMatches ?? 0,
        fimDeContrato: p.contract?.endDate, potencial: p.potential,
      })),
      semanaAtual: state.week ?? 0,
      forcaDoTime,
      proximoAdversario: adv ? { nome: adv.nome, forca: adv.prestigio ?? 50, casa: euEmCasa } : undefined,
      caixa: gameEngine.balance,
      saldoSemanal: gameEngine.weeklyIncome - gameEngine.weeklyExpenses,
      formaRecente: matchResults
        .filter(r => r.homeTeam === userTeam?.curto || r.awayTeam === userTeam?.curto)
        .slice(-5).reverse()
        .map(r => {
          const casa = r.homeTeam === userTeam?.curto
          const pro = casa ? r.homeScore : r.awayScore
          const contra = casa ? r.awayScore : r.homeScore
          return pro > contra ? "V" as const : pro === contra ? "E" as const : "D" as const
        }),
    })
  }, [gameEngine.squadPlayers, gameEngine.balance, gameEngine.weeklyIncome, gameEngine.weeklyExpenses,
      elencoParaAvaliacao, seasonCalendar.nextUserMatch, userTeam, state.week, matchResults])

  /** Objetivo da temporada — a cobranca que a diretoria fixou para este clube. */
  const objetivoDaTemporada = useMemo(
    () => (userTeam ? calcSeasonObjective(userTeam as never) : null),
    [userTeam],
  )

  /** Confianca da diretoria — a MESMA conta do escritorio (board-engine). */
  const confiancaDaDiretoria = useMemo(() => {
    if (!userTeam || !objetivoDaTemporada) return 50
    const pos = classificacao.findIndex(c => c.teamShort === userTeam.curto) + 1
    return computeBoardConfidence({
      currentPosition: pos > 0 ? pos : Math.max(1, classificacao.length),
      objective: objetivoDaTemporada,
      // MAIS RECENTE PRIMEIRO — o board-engine pesa os ultimos jogos.
      recentForm: matchResults
        .filter(r => r.homeTeam === userTeam.curto || r.awayTeam === userTeam.curto)
        .slice(-5)
        .reverse()
        .map(r => {
          const casa = r.homeTeam === userTeam.curto
          const pro = casa ? r.homeScore : r.awayScore
          const contra = casa ? r.awayScore : r.homeScore
          return pro > contra ? "V" as const : pro === contra ? "E" as const : "D" as const
        }),
      seasonProgress: Math.max(0, Math.min(1, (state.week ?? 0) / 38)),
    })
  }, [userTeam, objetivoDaTemporada, classificacao, matchResults, state.week])

  /** Metas: a cobranca da temporada + o que a campanha ja entregou. */
  const metasDaDiretoria = useMemo<MetaDaDiretoria[]>(() => {
    if (!userTeam) return []
    const objetivo = objetivoDaTemporada
    const pos = classificacao.findIndex(c => c.teamShort === userTeam.curto) + 1
    const total = Math.max(1, classificacao.length)
    const alvo = objetivo?.targetPosition ?? Math.ceil(total / 2)
    const metas: MetaDaDiretoria[] = [{
      rotulo: objetivo?.description ?? `Terminar entre os ${alvo} primeiros`,
      detalhe: pos > 0 ? `Hoje em ${pos}o de ${total}` : "Campeonato ainda nao comecou",
      // Progresso: 1 quando esta na posicao alvo ou acima; cai conforme se afasta.
      progresso: pos > 0 ? Math.max(0, Math.min(1, (total - pos + 1) / (total - alvo + 1))) : 0,
      cumprida: pos > 0 && pos <= alvo,
    }]
    return metas
  }, [userTeam, classificacao, objetivoDaTemporada])
  const [rodadaMercado, setRodadaMercado] = useState(0)
  const standing = useMemo(() => {
    const rep = carreira?.reputation ?? 0
    return {
      reputation: rep,
      totalTitles: (state.coachTotalTitles ?? 0) + (state.coachLegacy?.totalTitles ?? 0),
      reputationLevel: state.coachLegacy?.reputationLevel ?? 0,
    }
  }, [carreira, state.coachTotalTitles, state.coachLegacy])
  const patamar = useMemo(() => {
    const s = coachStandingScore(standing)
    return s >= 80 ? "Elite" : s >= 60 ? "Consolidada" : s >= 35 ? "Em ascensão" : "Iniciante"
  }, [standing])
  const ofertasDesemprego = useMemo<PendingJobOffer[]>(() => {
    if (!desempregado) return []
    return ofertasParaDesempregado(allTeams, standing, (state.week ?? 0) + rodadaMercado).map(t => ({
      id: `free_${t.curto}_${rodadaMercado}`,
      clubShort: t.curto,
      clubName: t.nome,
      clubPrestige: t.prestigio,
      kind: "club" as const,
      reason: `${String(t.divisao).replaceAll("_", " ")} · abriu o cargo e quer conversar com você.`,
      season: state.season ?? 2026,
      week: state.week ?? 0,
    }))
  }, [desempregado, standing, state.week, state.season, rodadaMercado])

  const aguardarPropostas = useCallback(() => {
    // ⚠️ A DATA NO CABECALHO NAO MUDAVA (relato: "ao pedir demissao e selecionar a
    // opcao aguardar mais uma semana nao altera a data no calendario").
    //
    // Duas causas, as duas corrigidas aqui:
    //
    //  1. `setState` do useGameState so grava DENTRO do atualizador que ele passa
    //     ao React. Esta e uma acao isolada numa tela sem clube; o `queueMicrotask`
    //     que salva chegava tarde ou nao chegava, e o proximo `loadGameState` (que
    //     e de onde o GameHeader tira a data) lia a semana antiga. `commitGameState`
    //     grava direto no disco, lendo o valor mais novo — e a regra da casa para
    //     decisao que nao fica esperando um re-render.
    //  2. A semana tambem vive no MOTOR (`currentWeek`), que alimenta contratos,
    //     emprestimos e janela. Mexer so no save deixava os dois relogios em
    //     desacordo, e o desacordo aparecia na primeira tela que lesse o motor.
    //
    // A virada de ANO fica de fora de proposito: quem vira temporada e o
    // `advanceWeek` (campeao, acesso/rebaixamento, calendario novo). Aqui o
    // tecnico esta sem clube — nao ha temporada de clube para encerrar.
    const nova = commitGameState(atual => ({ week: (atual.week ?? 0) + 1 }))
    useGameEngine.setState({ currentWeek: nova.week, currentSeason: nova.season })
    setState({ week: nova.week } as Parameters<typeof setState>[0])
    setRodadaMercado(r => r + 1)
  }, [setState])

  // Últimos resultados do clube do usuário, do mais recente para o mais antigo.
  const ultimos = useMemo(() => {
    const curto = state.selectedTeamShort ?? userTeam.curto
    return [...matchResults]
      .filter(r => r.homeTeam === curto || r.awayTeam === curto)
      .slice(-10)
      .reverse()
      .map(r => {
        const emCasa = r.homeTeam === curto
        const meus = emCasa ? r.homeScore : r.awayScore
        const deles = emCasa ? r.awayScore : r.homeScore
        return {
          chave: `${r.season}-${r.week}-${r.homeTeam}-${r.awayTeam}`,
          adversario: emCasa ? r.awayTeam : r.homeTeam,
          placar: `${meus} x ${deles}`,
          local: emCasa ? "Casa" : "Fora",
          competicao: r.competition,
          resultado: meus > deles ? "V" : meus < deles ? "D" : "E",
        }
      })
  }, [matchResults, state.selectedTeamShort, userTeam.curto])

  const aproveitamentoRecente = useMemo(() => {
    if (ultimos.length === 0) return null
    const pontos = ultimos.reduce((s, r) => s + (r.resultado === "V" ? 3 : r.resultado === "E" ? 1 : 0), 0)
    return Math.round((pontos / (ultimos.length * 3)) * 100)
  }, [ultimos])

  // Dados do VÍNCULO atual, não estatísticas genéricas da carreira. O marco de
  // posse permite responder quando o treinador chegou e separar o trabalho
  // feito neste clube do que aconteceu nos empregos anteriores.
  const vinculoAtual = useMemo(() => {
    if (desempregado || !state.selectedTeamShort) return null
    const inicio = state.contratadoEm ?? { season: 2026, week: 0 }
    const depoisDaPosse = (season: number, week: number) =>
      season > inicio.season || (season === inicio.season && week >= inicio.week)
    const jogos = matchResults.filter(r =>
      depoisDaPosse(r.season, r.week) &&
      (r.homeTeam === state.selectedTeamShort || r.awayTeam === state.selectedTeamShort),
    )
    let vitorias = 0, empates = 0, derrotas = 0, golsPro = 0, golsContra = 0
    for (const r of jogos) {
      const casa = r.homeTeam === state.selectedTeamShort
      const pro = casa ? r.homeScore : r.awayScore
      const contra = casa ? r.awayScore : r.homeScore
      golsPro += pro; golsContra += contra
      if (pro > contra) vitorias++
      else if (pro === contra) empates++
      else derrotas++
    }
    const semanas = Math.max(0, (state.season - inicio.season) * 52 + state.week - inicio.week)
    const posicao = classificacao.findIndex(l => l.teamShort === state.selectedTeamShort)
    return {
      inicio,
      inicioLabel: `${rotuloDaSemana(inicio.season, inicio.week)} de ${inicio.season}`,
      semanas,
      jogos: jogos.length,
      vitorias, empates, derrotas, golsPro, golsContra,
      aproveitamento: jogos.length ? Math.round(((vitorias * 3 + empates) / (jogos.length * 3)) * 100) : 0,
      posicao: posicao >= 0 ? posicao + 1 : null,
    }
  }, [desempregado, state.selectedTeamShort, state.contratadoEm, state.season, state.week, matchResults, classificacao])

  // ── ENTROSAMENTO, AMISTOSOS E DATA FIFA ───────────────────────────────────
  // O entrosamento (squadCohesion, 0-100) vira ate +5 de forca em campo — a
  // mesma conta do ao-vivo (bonusEntrosamento). Desde a 1.0.223 ele nao e mais um
  // contador que sobe por botao: e a leitura de quantos MINUTOS o onze atual ja
  // jogou junto (lib/treino-e-entrosamento). Amistoso e treino na data FIFA
  // continuam ajudando — creditando minutos, como tudo o mais.
  const entrosamento = squadCohesion ?? PISO_ENTROSAMENTO
  const bonusEntrosamento = Math.round(Math.max(0, (entrosamento - 60)) / 8)

  // Data FIFA: quando o mes da proxima partida e janela FIFA, o clube esta parado
  // (ver aplicarPausasFifa). Se o tecnico nao foi convocado para uma selecao e nao
  // tem jogador na selecao, aproveita para treinar o entrosamento — uma vez por
  // janela. (O jogo nao tira jogador do seu clube na data FIFA, entao aqui sempre
  // ha elenco para treinar.)
  const mesAtual = currentMatch?.month ?? -1
  const emDataFifa = isFifaWindowMonth(mesAtual)
  const janelaFifaKey = `${currentSeason}-${mesAtual}`
  const jaTreinouDataFifa = state.dataFifaTreinada === janelaFifaKey
  const [avisoTreino, setAvisoTreino] = useState<string | null>(null)

  const treinarNaDataFifa = useCallback(() => {
    if (!emDataFifa || jaTreinouDataFifa) return
    // Semana INTEIRA de trabalho com o grupo, sem jogo no meio: vale mais que o
    // treino coletivo de uma semana normal, e menos que uma partida. Entra pela
    // mesma porta de todo o resto — minutos em campo juntos.
    const antes = useGameEngine.getState().squadCohesion ?? PISO_ENTROSAMENTO
    useGameEngine.getState().registrarMinutosJuntos(120)
    const depois = useGameEngine.getState().squadCohesion ?? antes
    setState({ dataFifaTreinada: janelaFifaKey } as Parameters<typeof setState>[0])
    setAvisoTreino(
      depois > antes
        ? `Semana de treino aproveitada: entrosamento ${antes} → ${depois}. O time joga mais junto na volta.`
        : "Semana de treino aproveitada. Este onze já se conhece de cor — o ganho agora vem de jogo, não de treino.",
    )
  }, [emDataFifa, jaTreinouDataFifa, setState, janelaFifaKey])

  // Amistosos marcados (max 3).
  //
  // A DATA deixou de ser um rótulo solto (1.0.223): agora é uma SEMANA de
  // verdade, escolhida entre as que o clube tem livres — sem compromisso
  // oficial e sem outro amistoso. É isso que permite o jogo-treino virar um
  // fixture no calendário sem colidir com a rodada. Semana de pausa FIFA entra
  // na lista de propósito: é quando os clubes jogam amistoso na vida real.
  // Em useMemo para a lista não trocar de identidade a cada render — ela é
  // dependência da busca de semanas livres e dos callbacks de agendar/jogar.
  const amistosos = useMemo(() => state.amistososAgendados ?? [], [state.amistososAgendados])
  const semanasLivres = useMemo(
    () => semanasLivresParaAmistoso(seasonCalendar.fixtures, state.week ?? 0, amistosos),
    [seasonCalendar.fixtures, state.week, amistosos],
  )
  const datasAmistoso = useMemo(
    () => semanasLivres.map(w => rotuloDaSemana(state.season ?? 2026, w)),
    [semanasLivres, state.season],
  )
  const [oppBusca, setOppBusca] = useState("")
  const [dataIdx, setDataIdx] = useState(0)
  const [emCasa, setEmCasa] = useState(true)
  const advOpcoes = useMemo<Team[]>(() => {
    const q = oppBusca.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    return allTeams
      .filter(t => t.curto !== userTeam.curto && !/ II$/.test(t.nome))
      .filter(t => !q || t.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q))
      .sort((a, b) => b.prestigio - a.prestigio)
      .slice(0, 30)
  }, [oppBusca, userTeam.curto])

  /**
   * ⚠️ AMISTOSO AGORA E NEGOCIADO, nao um item de lista.
   *
   * Antes bastava clicar: o Real Madrid vinha jogar contra um clube da Serie D,
   * de graca, na semana escolhida. Agora o clube convidado AVALIA (prestigio,
   * viagem, data) e pode RECUSAR, e o aceite custa CACHE DE PRESENCA — que sai
   * do caixa na hora, como qualquer contrato. Ver lib/amistosos-negociacao.
   */
  const agendarAmistoso = useCallback(async (opp: Team) => {
    if (amistosos.length >= MAX_AMISTOSOS) return
    const week = semanasLivres[dataIdx]
    if (week == null) return

    const convite = {
      clube: userTeam, adversario: opp, semana: week,
      temporada: state.season ?? 2026, emCasa,
      // A semana do amistoso cai numa janela FIFA? E quando eles acontecem de verdade.
      dataFifa: isFifaWindowMonth(getGameDate(state.season ?? 2026, week).getMonth()),
    }
    const resposta = avaliarConvite(convite)

    if (!resposta.aceita) {
      await avisarNoJogo({ titulo: "Convite recusado", mensagem: resposta.recado })
      return
    }

    const { cache, bilheteria, saldo } = resposta.conta
    const caixa = useGameEngine.getState().balance
    if (cache > caixa) {
      await avisarNoJogo({
        titulo: `${opp.nome} aceita, mas cobra ${formatCurrency(cache)}`,
        mensagem: `O caixa tem ${formatCurrency(caixa)}. Convide um adversario mais barato ou jogue fora de casa, onde o cache e menor.`,
      })
      return
    }

    const confirmado = await confirmarNoJogo({
      titulo: `Amistoso com ${opp.nome}`,
      mensagem: [
        `Cachê de presença: ${formatCurrency(cache)}`,
        emCasa
          ? `Bilheteria estimada: ${formatCurrency(bilheteria)}`
          : "Sem mando de campo: a bilheteria fica com o adversário.",
        `Resultado no caixa: ${saldo >= 0 ? "+" : ""}${formatCurrency(saldo)}`,
      ].join("\n"),
      confirmar: "Fechar o amistoso",
      cancelar: "Desistir",
    })
    if (!confirmado) return

    // O cache sai AGORA (e um contrato assinado). A bilheteria so entra quando o
    // jogo acontecer — creditar antes seria pagar por publico que nao foi.
    useGameEngine.getState().addClubExpense(cache)

    setState({
      amistososAgendados: [...amistosos, {
        oppShort: opp.curto, oppNome: opp.nome,
        dateLabel: datasAmistoso[dataIdx] ?? rotuloDaSemana(state.season ?? 2026, week),
        userIsHome: emCasa, week, cache, bilheteriaPrevista: bilheteria,
      }],
    } as Parameters<typeof setState>[0])
    setOppBusca("")
    setDataIdx(0)
  }, [amistosos, setState, datasAmistoso, semanasLivres, dataIdx, emCasa, state.season, userTeam])

  const removerAmistoso = useCallback((i: number) => {
    setState({ amistososAgendados: amistosos.filter((_, idx) => idx !== i) } as Parameters<typeof setState>[0])
  }, [amistosos, setState])

  // O `jogarAmistoso` foi removido junto com o botao "Jogar" (pedido): a Area do
  // Treinador AGENDA o amistoso; quem o disputa e o calendario, na semana dele.

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#050508] pb-20 md:pb-0">
      {/* Mesmo pano de fundo do escritório (pedido: visual profissional igual
          ao office/pre-office): crossfade das fotos + véu para leitura. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Image src="/images/office-bg-1.webp" alt="" fill priority unoptimized className="office-bg-a object-cover" />
        <Image src="/images/office-bg-2.webp" alt="" fill unoptimized className="office-bg-b object-cover" />
        <div className="absolute inset-0 bg-[#050508]/72" />
      </div>

      {/* ⚠️ ESTE WRAPPER PRECISA SER FLEX. Ele era um `div` solto entre o
          container `h-screen flex-col overflow-hidden` e o `main flex-1`: sem
          `flex/min-h-0/flex-1` aqui, o `flex-1` do main nao tinha contra o que
          crescer, o `overflow-y-auto` la de baixo ficava com altura automatica e
          o `overflow-hidden` do topo simplesmente CORTAVA o resto da pagina. A
          area do tecnico nao rolava — o conteudo abaixo da dobra era
          inalcancavel. */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <GameHeader team={userTeam} />

      <main className="flex min-h-0 flex-1 flex-col">
        {/* Hero do técnico — identidade em destaque, como o cabeçalho do office */}
        <div className="border-b border-white/[0.06] bg-black/35 px-4 py-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand)]/10">
                <UserCircle className="h-8 w-8 text-[var(--brand)]" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">
                  {state.managerName || "Técnico"}
                </h1>
                <p className="mt-0.5 text-xs text-white/55">
                  {desempregado
                    ? `Sem clube · Reputação ${patamar} · Temporada ${currentSeason}`
                    : `${userTeam.nome} · Temporada ${currentSeason}`}
                  {ranking && ` · ~${ranking.position}º entre os técnicos`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              {/* A reputação vem do hall-of-fame-engine (derivada de títulos,
                  aproveitamento e acessos). `coachReputation` no save pertence
                  ao YouthCareerState — carreira de base —, não a esta. */}
              <div>
                <p className="text-[10px] uppercase text-white/40">Reputação</p>
                <p className="text-sm font-semibold text-[#ffd700]">{carreira?.reputation ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/40">XP</p>
                <p className="text-sm font-semibold text-[var(--brand)]">{state.coachXP ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-game">
          {/* PAINEL DO TREINADOR — metas, dinheiro e carencias, nesta ordem.
              As tres perguntas que ele faz ao sentar na mesa moravam em telas
              diferentes (escritorio, financas e lugar nenhum). Ver
              components/treinador/painel-do-treinador. */}
          {!desempregado && (
            <PainelDoTreinador
              className="mb-5"
              metas={metasDaDiretoria}
              confianca={confiancaDaDiretoria}
              caixa={gameEngine.balance}
              receitaSemanal={gameEngine.weeklyIncome}
              despesaSemanal={gameEngine.weeklyExpenses}
              elenco={elencoParaAvaliacao}
            />
          )}

          {!desempregado && (
            <BlocoRecolhivel
              className="mb-5"
              aberto
              destaque
              icone={<ClipboardList className="h-4 w-4" />}
              titulo="Reunião da comissão técnica"
            >
              <ReuniaoDaComissao pareceres={pareceresDaComissao} />
            </BlocoRecolhivel>
          )}

          {/* FIM DE TEMPORADA (pedido: "implemente na area do treinador a mesma
              opcao de iniciar uma nova temporada tambem"). So com clube: quem
              esta desempregado nao tem temporada de clube para virar — para ele o
              relogio anda por "Aguardar novas propostas", logo abaixo. */}
          {!desempregado && !seasonCalendar.nextUserMatch && (
            <IniciarTemporadaCard
              advanceWeek={advanceWeek}
              season={currentSeason}
              destino="/pre-office"
              className="mb-4"
            />
          )}
          {avisoDemissao && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/[0.08] p-4">
              <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-300">Você foi demitido</p>
                <p className="mt-0.5 text-xs text-white/70">{avisoDemissao}</p>
              </div>
              <button onClick={() => setAvisoDemissao(null)} className="rounded-lg p-1 text-white/40 hover:text-white" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {vinculoAtual && (
            <section className="mb-4 rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <TeamCrest team={userTeam} size="lg" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Vínculo atual</p>
                    <h2 className="text-lg font-bold text-white">Treinador do {userTeam.nome}</h2>
                    <p className="text-xs text-white/55">No clube desde {vinculoAtual.inicioLabel} · semana {vinculoAtual.inicio.week + 1}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-white/45">
                  <p>{String(state.divisionOverride ?? userTeam.divisao).replaceAll("_", " ")}</p>
                  <p>Prestígio do clube: <span className="font-semibold text-white/75">{userTeam.prestigio}</span></p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  ["Tempo no cargo", vinculoAtual.semanas === 0 ? "Recém-chegado" : `${vinculoAtual.semanas} sem.`],
                  ["Partidas", String(vinculoAtual.jogos)],
                  ["Campanha", `${vinculoAtual.vitorias}V ${vinculoAtual.empates}E ${vinculoAtual.derrotas}D`],
                  ["Aproveitamento", `${vinculoAtual.aproveitamento}%`],
                  ["Gols", `${vinculoAtual.golsPro}–${vinculoAtual.golsContra}`],
                  ["Posição atual", vinculoAtual.posicao ? `${vinculoAtual.posicao}º` : "Pré-temporada"],
                  ["Temporada", String(state.season)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="rounded-lg bg-white/[0.04] px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-wide text-white/35">{rotulo}</p>
                    <p className="mt-1 text-sm font-bold text-white">{valor}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {(() => {
            // Sem clube: mostra as propostas por reputacao (sempre ha). Empregado:
            // mostra as propostas que chegaram enquanto trabalha.
            const lista = desempregado ? ofertasDesemprego : ofertas
            return (
          <section className={cn(
            "rounded-xl border p-5",
            desempregado ? "border-[var(--brand)]/40 bg-[var(--brand)]/[0.06]"
              : lista.length > 0 ? "border-[#ffd700]/30 bg-[#ffd700]/[0.05]" : "border-white/10 bg-black/40 backdrop-blur-md shadow-lg shadow-black/30",
          )}>
            <div className="mb-1 flex items-center gap-3"><h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Briefcase className="h-4 w-4 text-[#ffd700]" />
              {desempregado ? "Mercado de treinadores" : "Propostas de trabalho"}
              {lista.length > 0 && (
                <span className="rounded-full bg-[#ffd700] px-2 py-0.5 text-[10px] font-black text-black">
                  {lista.length}
                </span>
              )}
            </h2><span className="h-px flex-1 bg-gradient-to-r from-[#ffd700]/40 to-transparent" /></div>

            {desempregado && (
              <p className="mt-1 mb-2 text-xs text-white/55">
                Você está sem clube. Estas diretorias abriram o cargo para você — aceite uma para voltar ao trabalho, ou aguarde novas sondagens.
              </p>
            )}

            {avisoTroca && (
              <p className="mt-1 mb-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                {avisoTroca}
              </p>
            )}

            {lista.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">
                Nenhuma proposta no momento. Entregue resultado e outros clubes procuram você.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {lista.map(oferta => (
                  <div key={oferta.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-black/30 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        {oferta.clubName}
                        {oferta.kind === "national" && (
                          <span className="ml-2 rounded bg-[var(--brand)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[var(--brand)]">SELEÇÃO</span>
                        )}
                      </p>
                      <p className="text-[11px] leading-4 text-white/45">{oferta.reason}</p>
                    </div>
                    <span className="text-[11px] text-white/40">prestígio {oferta.clubPrestige}</span>
                    <button
                      onClick={() => aceitarOferta(oferta)}
                      className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-black text-[var(--brand-ink)] hover:brightness-110"
                    >
                      Aceitar
                    </button>
                    {!desempregado && (
                      <button
                        onClick={() => { removeJobOffer(oferta.id); atualizarOfertas() }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/40 hover:bg-white/5 hover:text-white/70"
                      >
                        Recusar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {desempregado && (
              <button
                onClick={aguardarPropostas}
                className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/5"
              >
                Aguardar novas propostas (avança 1 semana)
              </button>
            )}
          </section>
            )
          })()}

          {/* Amistosos & Entrosamento — só com clube */}
          {!desempregado && (
          <BlocoRecolhivel
            className="mt-4"
            icone={<Users className="h-4 w-4" />}
            titulo="Entrosamento & Amistosos"
          >

            {/* Barra de entrosamento */}
            <div className="mt-3 rounded-lg bg-black/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Entrosamento do elenco</span>
                <span className="font-semibold text-white">{entrosamento}/100{bonusEntrosamento > 0 && <span className="ml-1 text-[var(--brand)]">(+{bonusEntrosamento} em campo)</span>}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand)]/70 to-[var(--brand)]" style={{ width: `${entrosamento}%` }} />
              </div>
              <p className="mt-2 text-[11px] leading-4 text-white/40">
                É o total de <span className="text-white/70">minutos que este onze já jogou junto</span>, dupla a dupla —
                não um contador que sobe sozinho. Partida oficial, amistoso e treino coletivo alimentam a mesma conta;
                trocar meio time na janela derruba o número.
              </p>
            </div>

            {avisoTreino && (
              <p className="mt-3 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3 py-2 text-xs text-[var(--brand)]">{avisoTreino}</p>
            )}

            {/* Treino na Data FIFA */}
            {emDataFifa && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3">
                <Dumbbell className="h-5 w-5 shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">🌍 {windowLabel(mesAtual)} — sem convocados</p>
                  <p className="text-[11px] leading-4 text-white/50">O campeonato de clubes está parado. Sem jogadores na seleção, use a semana para treinar o entrosamento.</p>
                </div>
                <button
                  onClick={treinarNaDataFifa}
                  disabled={jaTreinouDataFifa}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-black transition-all",
                    jaTreinouDataFifa ? "cursor-not-allowed bg-white/10 text-white/40" : "bg-amber-300 text-black hover:brightness-110")}
                >
                  {jaTreinouDataFifa ? "Já treinado" : "Treinar a semana"}
                </button>
              </div>
            )}

            {/* Amistosos marcados */}
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                <Swords className="h-3.5 w-3.5" /> Amistosos marcados ({amistosos.length}/{MAX_AMISTOSOS})
              </div>
              {amistosos.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {amistosos.map((a, i) => (
                    <div key={`${a.oppShort}-${i}`} className="flex items-center gap-3 rounded-lg bg-black/30 p-2.5">
                      <span className="text-[10px] text-white/40">{a.userIsHome ? <Home className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{a.oppNome}</p>
                        <p className="text-[11px] text-white/40">
                          {a.dateLabel} · {a.userIsHome ? "em casa" : "fora"}
                          {/* A semana é o que faz o amistoso existir no calendário —
                              dizer isso aqui evita a pergunta "marquei, e agora?". */}
                          {a.week != null && !a.jogado && <span className="text-white/25"> · consta no calendário</span>}
                        </p>
                      </div>
                      {a.jogado ? (
                        <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-black text-white/70">
                          {a.golsPro ?? 0} × {a.golsContra ?? 0}
                        </span>
                      ) : (
                        /* SO MARCAR, NAO JOGAR (pedido). O botao "Jogar" era um
                           atalho da epoca em que o amistoso nao entrava no
                           calendario: ele antecipava a partida para fora da data
                           marcada. Agora o jogo-treino tem semana propria e e
                           disputado no dia dele, como qualquer compromisso —
                           deixar os dois caminhos so criava a duvida de qual
                           deles conta. */
                        <span className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/45">
                          na agenda
                        </span>
                      )}
                      <button onClick={() => removerAmistoso(i)} className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white/60"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Marcar novo amistoso */}
              {amistosos.length >= MAX_AMISTOSOS ? (
                <p className="text-[11px] text-white/40">Limite de {MAX_AMISTOSOS} amistosos atingido. Jogue ou remova um para marcar outro.</p>
              ) : datasAmistoso.length === 0 ? (
                <p className="text-[11px] text-white/40">
                  Nenhuma semana livre à frente: a agenda do clube está cheia. Um amistoso só entra em
                  semana sem compromisso — inclusive nas pausas de data FIFA.
                </p>
              ) : (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <button onClick={() => setEmCasa(true)} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold", emCasa ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-white/50")}><Home className="h-3.5 w-3.5" /> Casa</button>
                    <button onClick={() => setEmCasa(false)} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold", !emCasa ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-white/50")}><Plane className="h-3.5 w-3.5" /> Fora</button>
                    <select value={dataIdx} onChange={e => setDataIdx(Number(e.target.value))} className="rounded-lg border border-white/10 bg-[#101015] px-2 py-1.5 text-xs text-white">
                      {datasAmistoso.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <input value={oppBusca} onChange={e => setOppBusca(e.target.value)} placeholder="Buscar adversário..." className="mb-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none" />
                  <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2">
                    {advOpcoes.map(opp => {
                      // PRECO E CHANCE ANTES DO CLIQUE. A lista mostrava so o
                      // prestigio — e como quase todo clube grande tem 88, era
                      // uma coluna de "88" que nao dizia nada. O que o tecnico
                      // precisa saber e quanto custa e se vao aceitar.
                      const semanaAlvo = semanasLivres[dataIdx] ?? (state.week ?? 0)
                      const convite = {
                        clube: userTeam, adversario: opp, semana: semanaAlvo,
                        temporada: state.season ?? 2026, emCasa,
                      }
                      const { cache } = contaDoAmistoso(convite)
                      const chance = chanceDoConvite(convite)
                      const corDaChance =
                        chance === "provavel" ? "text-[var(--brand)]"
                        : chance === "incerto" ? "text-amber-300" : "text-red-400"
                      const rotuloDaChance =
                        chance === "provavel" ? "provável" : chance === "incerto" ? "incerto" : "difícil"
                      return (
                        <button key={opp.curto + opp.file_key} onClick={() => { void agendarAmistoso(opp) }} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2 text-left hover:border-primary/40 hover:bg-white/[0.06]">
                          <TeamCrest team={opp} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs text-white">{opp.nome}</div>
                            <div className={cn("text-[10px]", corDaChance)}>{rotuloDaChance}</div>
                          </div>
                          <span className="shrink-0 text-[10px] tabular-nums text-white/45" title="Cachê de presença">
                            {formatCurrency(cache)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </BlocoRecolhivel>
          )}

          {/* Últimos resultados */}
                    <BlocoRecolhivel
            className="mt-4"
            icone={<ClipboardList className="h-4 w-4" />}
            titulo="Últimos resultados"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              {aproveitamentoRecente !== null && (
                <span className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  aproveitamentoRecente >= 50 ? "text-[var(--brand)]" : "text-red-400",
                )}>
                  {aproveitamentoRecente >= 50 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {aproveitamentoRecente}% de aproveitamento
                </span>
              )}
            </div>

            {ultimos.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">Nenhuma partida disputada ainda.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {ultimos.map(jogo => (
                  <div key={jogo.chave} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
                    <span className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-black",
                      jogo.resultado === "V" ? "bg-[var(--brand)]/20 text-[var(--brand)]"
                        : jogo.resultado === "D" ? "bg-red-400/20 text-red-300"
                        : "bg-white/10 text-white/60",
                    )}>
                      {jogo.resultado}
                    </span>
                    <span className="w-16 shrink-0 font-mono text-sm text-white">{jogo.placar}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-white/70">{jogo.adversario}</span>
                    <span className="hidden shrink-0 text-[11px] text-white/35 sm:block">{jogo.competicao}</span>
                    <span className="shrink-0 text-[10px] text-white/30">{jogo.local}</span>
                  </div>
                ))}
              </div>
            )}
          </BlocoRecolhivel>

          {/* Carreira */}
                    <BlocoRecolhivel
            className="mt-4"
            icone={<Trophy className="h-4 w-4" />}
            titulo="Carreira"
          >

            {!carreira ? (
              <p className="mt-2 text-sm text-white/45">
                Sua trajetória começa a ser registrada ao encerrar a primeira temporada.
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[
                    ["Temporadas", String(carreira.totalSeasons), Star],
                    ["Partidas", String(carreira.totalMatches), ClipboardList],
                    ["Aproveitamento", `${carreira.winRate}%`, TrendingUp],
                    ["Títulos", String(carreira.trophies.length), Trophy],
                    ["Reputação", `${carreira.reputation}/100`, Award],
                  ].map(([rotulo, valor, Icone]) => {
                    const Ico = Icone as typeof Star
                    return (
                      <div key={rotulo as string} className="rounded-lg bg-black/30 p-3">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
                          <Ico className="h-3 w-3" />{rotulo as string}
                        </div>
                        <p className="mt-1 text-xl font-bold text-white">{valor as string}</p>
                      </div>
                    )
                  })}
                </div>

                {carreira.clubs.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Clubes treinados</p>
                    <div className="mt-2 space-y-1.5">
                      {carreira.clubs.map(clube => (
                        <div key={clube.clubCurto} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2">
                          <span className="text-sm text-white">{clube.clubNome}</span>
                          <span className="text-[11px] text-white/40">
                            {clube.fromSeason}–{clube.toSeason} · {clube.wins}/{clube.matches} vitórias · {clube.trophies} título(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TEMPORADA A TEMPORADA.
                    A Carreira só mostrava agregados (total de temporadas, títulos,
                    aproveitamento) e a lista de clubes — não dava para olhar para
                    trás e ver o que aconteceu em cada ano. O save já guardava tudo
                    em `seasonHistory` desde o primeiro fim de temporada; faltava
                    apenas exibir. Mais recente primeiro, que é como se consulta. */}
                {historicoPorTemporada.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Temporada a temporada
                    </p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-white/35">
                            <th className="px-2 py-2 text-left font-semibold">Temp.</th>
                            <th className="px-2 py-2 text-left font-semibold">Competição</th>
                            <th className="px-2 py-2 text-left font-semibold">Clube</th>
                            <th className="px-2 py-2 text-center font-semibold">Pos.</th>
                            <th className="px-2 py-2 text-center font-semibold">Pts</th>
                            <th className="px-2 py-2 text-center font-semibold">V-E-D</th>
                            <th className="px-2 py-2 text-center font-semibold">Gols</th>
                            <th className="px-2 py-2 text-left font-semibold">Desfecho</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historicoPorTemporada.map((t, i) => {
                            const campeao = t.position === 1
                            return (
                              <tr
                                key={`${t.season}-${t.competition}-${i}`}
                                className="border-t border-white/[0.06]"
                              >
                                <td className="px-2 py-2 font-semibold text-white/80">{t.season}</td>
                                <td className="px-2 py-2 text-white/70">{t.competition}</td>
                                <td className="px-2 py-2 text-white/50">{t.teamNome || t.teamCurto}</td>
                                <td className={cn(
                                  "px-2 py-2 text-center font-bold tabular-nums",
                                  campeao ? "text-[#ffd700]" : "text-white/80",
                                )}>
                                  {t.position > 0 ? `${t.position}º` : "—"}
                                </td>
                                <td className="px-2 py-2 text-center tabular-nums text-white/70">{t.points}</td>
                                <td className="px-2 py-2 text-center tabular-nums text-white/60">
                                  {t.won}-{t.drawn}-{t.lost}
                                </td>
                                <td className="px-2 py-2 text-center tabular-nums text-white/60">
                                  {t.goalsFor}:{t.goalsAgainst}
                                </td>
                                <td className="px-2 py-2">
                                  {campeao ? (
                                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#ffd700]">
                                      Campeão
                                    </span>
                                  ) : t.promoted ? (
                                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                                      Acesso
                                    </span>
                                  ) : t.relegated ? (
                                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
                                      Rebaixado
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-white/30">
                                      {t.champion ? `Campeão: ${t.champion}` : "—"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {ranking && (
                  <p className="mt-4 text-[11px] text-white/40">
                    Comparável a: {ranking.similarTo.join(", ")}
                  </p>
                )}
              </>
            )}
          </BlocoRecolhivel>

        </div>
      </main>
      </div>
    </div>
  )
}
