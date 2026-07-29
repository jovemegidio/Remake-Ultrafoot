"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Sprout, Star, ArrowUp, AlertTriangle, RefreshCw, Send, ShoppingCart } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { SystemMediaPlayer } from "@/components/system-media-player"
import { Button } from "@/components/ui/button"
import { useUserTeam, useGameState, type SquadPlayer } from "@/lib/save-system"
import { flushPersistentStore } from "@/lib/persistent-store"
import { formatCurrency } from "@/lib/teams-data"
import { generateYouthMarketProspects, generateYouthProspects } from "@/lib/youth-academy"
import { advanceYouthMonth, loanYouth, runTryout } from "@/lib/youth-engine"
import {
  capacidadeDaBase, vagasNaBase, evoluirSemana, propostaPorJovem,
  valorDeMercadoJovem, cobrancaDaDiretoria, type JovemBase,
} from "@/lib/youth-academy-rules"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { useNotifications } from "@/components/notifications-system"
import { isTransferWindowOpen, useGameEngine } from "@/lib/game-engine"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useRequireClub } from "@/lib/use-require-team"

const PROMOTION_FEE = 200_000

/**
 * Forca a gravacao do save em disco AGORA.
 *
 * DINHEIRO INFINITO (relato reincidente): o caixa vive no MOTOR e a base vive no
 * SAVE — dois armazenamentos. `storeSet` atualiza o cache na hora, mas a escrita
 * no arquivo duravel e enfileirada de forma assincrona. Como navegar no jogo e um
 * RELOAD COMPLETO, quem vendia a base e trocava de tela em seguida recarregava
 * antes de a fila esvaziar: o save voltava com os jovens de novo, e o dinheiro
 * — gravado por outro caminho — permanecia. Vender, sair, voltar, repetir.
 *
 * Chamar isto depois de toda operacao que mexe em caixa fecha a janela.
 */
function gravarAgora(): void {
  void flushPersistentStore()
}

export default function BasePage() {
  useRequireClub()
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })

  const { team } = useUserTeam()
  const { state, setState } = useGameState()
  const { addNotification } = useNotifications()
  const youth = state.youthPlayers ?? []
  const balance = state.balance && state.balance > 0 ? state.balance : team.saldo
  // Capacidade da base escala com a academia (ate 100 no nivel 5). O nivel vive
  // no game-engine (infraestrutura), nao no save da carreira.
  const nivelAcademia = useGameEngine(st => st.clubInfrastructure?.youthAcademyLevel) ?? 1
  // Elenco e caixa vivem no MOTOR, nao no save. Escrever em state.squadPlayers /
  // state.balance (como era) nao aparecia em lugar nenhum: o Elenco le de
  // players-data, o Gerenciamento le do motor e o caixa do cabecalho tambem.
  // Era por isso que promover nao trazia o garoto e vender nao pingava dinheiro.
  const promoverNoMotor = useGameEngine(st => st.promoverDaBase)
  const receberPorJovem = useGameEngine(st => st.receberPorJovem)
  const caixaDoMotor = useGameEngine(st => st.balance)
  const gastarDoCaixa = useGameEngine(st => st.spendClubFunds)
  const semanaAtual = useGameEngine(st => st.currentWeek)
  const capacidade = capacidadeDaBase(nivelAcademia)
  const vagas = vagasNaBase(youth.length, nivelAcademia)
  // BUSCA COM FILTROS, no modelo da central de transferencias.
  //
  // Antes o mercado era uma vitrine fixa de 8 promessas: nao dava para procurar
  // um lateral canhoto de 16 anos com potencial 85. Agora o ciclo gera um pool
  // grande e a tela filtra em cima dele — quem quer so olhar continua vendo tudo
  // com os filtros no padrao.
  const [fPos, setFPos] = useState("todas")
  const [fIdadeMax, setFIdadeMax] = useState(21)
  const [fOverallMin, setFOverallMin] = useState(0)
  const [fPotencialMin, setFPotencialMin] = useState(0)
  const [fPrecoMax, setFPrecoMax] = useState(0)
  const [fBusca, setFBusca] = useState("")

  const youthMarketPool = useMemo(() => {
    const purchased = new Set(state.youthMarketPurchasedIds ?? [])
    return generateYouthMarketProspects(state.season, state.week ?? 0, 60)
      .filter(player => !purchased.has(player.id))
  }, [state.season, state.week, state.youthMarketPurchasedIds])

  const youthMarket = useMemo(() => {
    const termo = fBusca.trim().toLowerCase()
    return youthMarketPool.filter(p => {
      if (fPos !== "todas" && p.position !== fPos) return false
      if ((p.age ?? 0) > fIdadeMax) return false
      if ((p.overall ?? 0) < fOverallMin) return false
      if ((p.potential ?? 0) < fPotencialMin) return false
      if (fPrecoMax > 0 && (p.value ?? 0) > fPrecoMax) return false
      if (termo && !p.name.toLowerCase().includes(termo) && !(p.fromTeam ?? "").toLowerCase().includes(termo)) return false
      return true
    })
  }, [youthMarketPool, fPos, fIdadeMax, fOverallMin, fPotencialMin, fPrecoMax, fBusca])

  // SEMEIA a base quando vazia.
  //
  // BUG que isto corrige ("os juniores nao funcionam"): a pagina le state.youthPlayers,
  // mas ninguem populava esse campo — o motor jogava os jovens gerados direto no elenco
  // profissional. A base ficava SEMPRE VAZIA. Aqui geramos os prospectos de forma
  // deterministica (clube + temporada) na primeira visita de cada temporada; promover e
  // dispensar seguem persistindo por cima.
  useEffect(() => {
    if (!team?.curto) return
    // Semeia na primeira visita da temporada. Usar `youthSeededSeason !== season` (e nao
    // "youthPlayers === undefined") cobre os dois casos: a primeira vez de todas, E o
    // inicio de uma temporada nova — quando youthPlayers pode ter ficado [] da anterior.
    if (state.youthSeededSeason !== state.season) {
      const atuais = state.youthPlayers ?? []
      // Preserva comprados, legados e atletas em desenvolvimento. A nova geração
      // só completa o núcleo mínimo da academia; nunca apaga a turma anterior.
      const quantidadeNova = Math.max(0, Math.min(6, capacidade - atuais.length))
      const novaGeracao = generateYouthProspects(
        team.curto,
        state.season,
        team.prestigio ?? 60,
        quantidadeNova,
      )
      setState({
        youthPlayers: [...atuais, ...novaGeracao],
        youthSeededSeason: state.season,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.curto, state.season])

  // ENVELHECIMENTO + PROMOÇÃO AUTOMÁTICA AOS 18 (pedido do usuário).
  //
  // A cada virada de temporada, a base envelhece um ano e QUEM COMPLETA 18 sobe
  // automaticamente ao profissional — não mais em bloco após 3 temporadas. O
  // `youthAgedSeason` garante que a idade só avança uma vez por temporada, mesmo
  // reabrindo a tela. Roda depois da semeadura, então a turma nova (14-17) do ano
  // não é promovida no mesmo tick.
  useEffect(() => {
    if (state.youthSeededSeason !== state.season) return // espera semear
    if (state.youthAgedSeason === state.season || youth.length === 0) return
    // Quem acabou de chegar nesta temporada (nova geração ou compra) não
    // envelhece no mesmo instante da matrícula.
    const envelhecida = youth.map(p =>
      p.seasonSigned === state.season ? p : { ...p, age: (p.age ?? 16) + 1 },
    )
    const sobem = envelhecida.filter(p => (p.age ?? 0) >= 18)
    const ficam = envelhecida.filter(p => (p.age ?? 0) < 18)
    const promovidos = sobem.map((p, i) => ({
      ...p,
      id: `pro_auto_${state.season}_${i}_${p.id}`,
      fromTeam: "Categoria de Base",
      seasonSigned: state.season,
    }))
    setState({
      youthPlayers: ficam,
      squadPlayers: promovidos.length ? [...(state.squadPlayers ?? []), ...promovidos] : state.squadPlayers,
      youthAgedSeason: state.season,
    })
    if (promovidos.length) {
      addNotification({
        type: "system", priority: "medium",
        title: `${promovidos.length} da base subiu ao profissional`,
        message: `${promovidos.map(p => p.name).join(", ")} completou 18 anos e foi promovido automaticamente.`,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.season, state.youthSeededSeason, state.youthAgedSeason, youth.length])

  // COBRANÇA DA DIRETORIA pelo uso da base, em momentos definidos da temporada
  // (pedido). Dispara uma vez por janela, marcada em youthBoardCheckWeek.
  useEffect(() => {
    const semana = state.week ?? 0
    const cob = cobrancaDaDiretoria({
      semana,
      nivelAcademia,
      promovidosNaTemporada: (state.squadPlayers ?? [])
        .filter(p => p.fromTeam === "Categoria de Base" && p.seasonSigned === state.season).length,
    })
    if (!cob || state.youthBoardCheckWeek === semana) return
    setState({ youthBoardCheckWeek: semana })
    addNotification({
      type: "system", priority: cob.cumprida ? "medium" : "high",
      title: cob.titulo, message: cob.mensagem,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.week, state.season, nivelAcademia])

  // Efetiva as vendas de jovens ACERTADAS fora da janela, assim que a janela
  // abre: o jovem sai da base e o valor entra no caixa (pedido).
  useEffect(() => {
    if (!isTransferWindowOpen(semanaAtual)) return
    const aVender = youth.filter(p => p.vendaPendente)
    if (aVender.length === 0) return
    // Um recibo POR JOVEM, e nao um credito unico: se a lista mudar entre duas
    // execucoes, cada venda continua sendo paga exatamente uma vez.
    for (const p of aVender) receberPorJovem(p.vendaPendente!.valor, `jovem:${p.id}`)
    // Funcional: ler a lista mais nova evita que uma leitura velha ressuscite
    // jovens ja vendidos.
    setState(s => ({ youthPlayers: (s.youthPlayers ?? []).filter(p => !p.vendaPendente) }))
    gravarAgora()
    for (const p of aVender) {
      addNotification({ type: "transfer", priority: "medium", title: `${p.name} vendido`,
        message: `${p.vendaPendente!.clube} concretizou a compra de ${p.name} por ${formatCurrency(p.vendaPendente!.valor)} na abertura da janela.` })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaAtual])

  // ⚠️ NAO reponha a vaga automaticamente.
  //
  // Aqui existia `replacementFor(player)`, que gerava um atleta NOVO de graca
  // toda vez que um jovem saia por promocao ou emprestimo. Isso era uma torneira
  // infinita: o jogador promovia/emprestava, a base se reabastecia sozinha, ele
  // vendia a turma nova, e repetia — dinheiro sem limite, com prospectos
  // aparecendo "sem ter feito peneira ou sem ter contratado" (relato).
  //
  // A base so ganha gente por tres caminhos legitimos, e todos ja existem:
  //   • a geracao anual da academia (o efeito de semeadura desta pagina);
  //   • a compra no mercado de juniores / peneira (buyYouth);
  //   • a captacao dos olheiros.
  // Sair da base agora ABRE VAGA, que e o comportamento correto.

  const promote = (player: SquadPlayer) => {
    if (caixaDoMotor < PROMOTION_FEE) {
      if (typeof window !== "undefined") window.alert("Saldo insuficiente para promover (R$ 200.000).")
      return
    }
    if (typeof window !== "undefined" && !window.confirm(`Promover ${player.name} ao elenco profissional por R$ 200.000?`)) {
      return
    }
    const subiu = promoverNoMotor({
      name: player.name, position: player.position, age: player.age,
      overall: player.overall, potential: player.potential,
      pace: player.pace, shooting: player.shooting, passing: player.passing,
      dribbling: player.dribbling, defending: player.defending, physical: player.physical,
    }, PROMOTION_FEE)
    if (!subiu) {
      if (typeof window !== "undefined") window.alert("Nao foi possivel promover: saldo insuficiente.")
      return
    }
    const promoted: SquadPlayer = {
      ...player,
      id: `pro_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromTeam: "Categoria de Base",
      seasonSigned: state.season,
    }
    setState({
      // Mantido no save tambem: e daqui que sai a cobranca da diretoria por uso
      // da base e o historico de promovidos.
      squadPlayers: [...(state.squadPlayers ?? []), promoted],
      youthPlayers: youth.filter(p => p.id !== player.id),
      transfers: [...(state.transfers ?? []), {
        id: `youth_promo_${Date.now()}`,
        playerName: player.name,
        fromTeam: "Categoria de Base",
        toTeam: team.curto,
        value: PROMOTION_FEE,
        type: "buy",
        week: state.currentRound ?? 0,
        season: state.season,
      }],
    })
  }

  const releaseYouth = (player: SquadPlayer) => {
    if (typeof window !== "undefined" && !window.confirm(`Dispensar ${player.name} da categoria de base? A vaga fica aberta até a próxima peneira ou temporada.`)) return
    // Dispensar NAO gera substituto na hora. Antes gerava, e dava para ficar
    // apertando dispensar ate sair um bom (relato do jogador) — cada clique era
    // um novo sorteio. Agora a vaga apenas abre; para preencher, use a peneira
    // (paga) ou espere a proxima temporada semear a base.
    setState(s => ({ youthPlayers: (s.youthPlayers ?? []).filter(p => p.id !== player.id) }))
  }

  // Carimbo absoluto (semanas desde o marco) da semana atual e da última peneira.
  const stampAtual = state.season * 52 + (state.week ?? 0)
  const TRYOUT_COOLDOWN = 8 // ~2 meses
  const semanasDesdePeneira = stampAtual - (state.youthTryoutStamp ?? -999)
  const peneiraDisponivel = semanasDesdePeneira >= TRYOUT_COOLDOWN

  const holdTryout = () => {
    // COOLDOWN: a peneira acontece a cada ~2 meses (8 semanas). Sem isto, rodar
    // peneira (barata) e vender os prospectos em loop imprimia dinheiro infinito.
    if (!peneiraDisponivel) {
      const faltam = TRYOUT_COOLDOWN - semanasDesdePeneira
      return window.alert(`A próxima peneira só daqui a ${faltam} semana${faltam === 1 ? "" : "s"} (uma a cada ~2 meses).`)
    }
    const fee = 100_000
    if (caixaDoMotor < fee) return window.alert("Saldo insuficiente para realizar a peneira.")
    if (!gastarDoCaixa(fee)) return window.alert("Saldo insuficiente para realizar a peneira.")
    const intake = runTryout(state, "sub17")
    setState({ youthPlayers: [...youth, ...intake.players], youthTryoutStamp: stampAtual })
  }

  const developMonth = () => {
    const result = advanceYouthMonth(state)
    setState({ youthPlayers: result.state.youthPlayers, updatedAt: result.state.updatedAt })
    window.alert(`${result.report.highlights.length} jovem(ns) evoluíram neste mês.`)
  }

  /** Uma semana de trabalho na base — o acompanhamento semanal pedido. */
  const acompanharSemana = () => {
    const r = evoluirSemana(youth as unknown as JovemBase[], nivelAcademia)
    setState({ youthPlayers: r.jovens as unknown as SquadPlayer[] })
    if (r.destaques.length === 0) {
      addNotification({ type: "system", priority: "low", title: "Semana na base",
        message: "Semana sem evolução relevante entre os garotos." })
      return
    }
    addNotification({
      type: "system", priority: "medium",
      title: `${r.destaques.length} garoto(s) evoluíram nesta semana`,
      message: r.destaques.slice(0, 6).map(d => `${d.nome} +${d.ganho}`).join(", ")
        + (r.prontosParaSubir.length ? ` — pronto(s) para o profissional: ${r.prontosParaSubir.join(", ")}.` : ""),
    })
  }

  /** Vende um garoto: proposta pelo valor de promessa. So se concretiza com a
   *  janela de transferencias ABERTA (pedido). Fora da janela, a venda e
   *  ACERTADA e o jovem sai da base quando a janela abrir. */
  const venderJovem = (player: SquadPlayer) => {
    const j = player as unknown as JovemBase
    const justo = valorDeMercadoJovem(j)
    // DIFICULDADE DE VENDA (pedido): nem todo garoto atrai comprador. O interesse
    // do mercado sobe com a promessa do atleta — um prospecto fraco raramente é
    // sondado, uma joia quase sempre. Antes toda venda tinha comprador garantido.
    const interesse = Math.max(0.12, Math.min(0.92, (justo - 200_000) / 3_000_000))
    if (Math.random() > interesse) {
      return window.alert(`Nenhum clube demonstrou interesse por ${player.name} no momento. Desenvolva-o mais e tente de novo adiante.`)
    }
    const clubes = ["Benfica", "Ajax", "Porto", "Shakhtar", "Red Bull Salzburg", "Palmeiras", "Flamengo"]
    const p = propostaPorJovem(j, clubes[Math.floor(Math.random() * clubes.length)])
    const janelaAberta = isTransferWindowOpen(semanaAtual)
    const aviso = janelaAberta
      ? ""
      : "\n\nA janela está FECHADA: a venda fica acertada e o jovem sai da base assim que a janela abrir."
    const texto = `${p.clube} oferece ${formatCurrency(p.valor)} por ${player.name}.\n` +
      `Valor estimado: ${formatCurrency(justo)}${p.abaixoDoValor ? "\n\nA proposta está ABAIXO do valor do atleta." : ""}${aviso}\n\nAceitar a venda?`
    if (typeof window !== "undefined" && !window.confirm(texto)) return

    if (janelaAberta) {
      receberPorJovem(p.valor, `jovem:${player.id}`)
      // Funcional: le a base MAIS NOVA (vender varios seguidos nao "ressuscita" os anteriores).
      setState(s => ({ youthPlayers: (s.youthPlayers ?? []).filter(x => x.id !== player.id) }))
      gravarAgora()
      addNotification({ type: "transfer", priority: "medium", title: `${player.name} vendido`,
        message: `${p.clube} contratou ${player.name} da base por ${formatCurrency(p.valor)}.` })
    } else {
      // Marca a saida pendente: o jovem continua na base ate a janela abrir.
      setState(s => ({
        youthPlayers: (s.youthPlayers ?? []).map(x => x.id === player.id
          ? ({ ...x, vendaPendente: { clube: p.clube, valor: p.valor } } as SquadPlayer)
          : x),
      }))
      addNotification({ type: "transfer", priority: "medium", title: `Venda acertada: ${player.name}`,
        message: `${p.clube} pagará ${formatCurrency(p.valor)} por ${player.name} quando a janela abrir.` })
    }
  }

  const sendOnLoan = (player: SquadPlayer) => {
    const club = window.prompt("Clube de destino do empréstimo:")?.trim()
    if (!club) return
    const result = loanYouth(state, player.id, club)
    setState({ youthPlayers: result.youthPlayers ?? [], updatedAt: result.updatedAt })
  }

  const buyYouth = (player: SquadPlayer) => {
    if (vagas <= 0) return window.alert("A categoria de base está lotada. Promova, venda ou dispense um jovem antes de contratar.")
    if (caixaDoMotor < player.value) return window.alert("Saldo insuficiente para comprar este junior.")
    const texto =
      `${player.fromTeam} pede ${formatCurrency(player.value)} por ${player.name}, ` +
      `${player.age} anos (${player.position}).\n\nO atleta irá diretamente para sua categoria de base. Confirmar?`
    if (!window.confirm(texto)) return
    if (!gastarDoCaixa(player.value)) return window.alert("Saldo insuficiente para concluir a compra.")
    const contratado: SquadPlayer = {
      ...player,
      id: `youth_bought_${Date.now()}_${player.id}`,
      fromTeam: player.fromTeam,
      seasonSigned: state.season,
    }
    setState(current => ({
      youthPlayers: [...(current.youthPlayers ?? []), contratado],
      youthMarketPurchasedIds: [...(current.youthMarketPurchasedIds ?? []), player.id],
      transfers: [...(current.transfers ?? []), {
        id: `youth_buy_${Date.now()}`,
        playerName: player.name,
        fromTeam: player.fromTeam ?? "Clube formador",
        toTeam: team.curto,
        value: player.value,
        type: "buy",
        week: state.currentRound ?? 0,
        season: state.season,
      }],
    }))
    // Compra tambem sai do caixa: aqui a corrida e ao contrario — o dinheiro ja
    // saiu no motor e o junior poderia nao persistir, prejudicando o jogador.
    gravarAgora()
    addNotification({
      type: "transfer",
      priority: "medium",
      title: `${player.name} contratado para a base`,
      message: `${team.nome} comprou o junior de ${player.fromTeam} por ${formatCurrency(player.value)}.`,
    })
  }

  return (
    // Mesmo tratamento visual do pre-office (pedido): fundo do escritorio,
    // brilho radial e escurecimento, no lugar do preto chapado.
    // `html` e `body` sao overflow:hidden no globals.css — o documento NAO rola.
    // Cada tela precisa do proprio container de scroll; esta nao tinha, e tudo
    // que passasse da primeira dobra ficava inalcancavel (relato: "falta scroll").
    // pb-28 livra a ultima linha de cards da barra fixa de acoes (h-11).
    <div className="relative h-screen overflow-hidden pl-[72px]">
      <div className="fixed inset-0 bg-[#050508]" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <Image src="/images/office-bg-1.png" alt="" fill priority unoptimized className="office-bg-a object-cover" />
        <Image src="/images/office-bg-2.png" alt="" fill unoptimized className="office-bg-b object-cover" />
      </div>
      <div className="pointer-events-none fixed inset-0" style={{
        background: "radial-gradient(ellipse 90% 70% at 50% 20%, rgba(34,197,94,0.14) 0%, transparent 60%)",
      }} />
      <div className="pointer-events-none fixed inset-0 bg-black/60" />

      <div className="relative z-10 flex h-full flex-col">
      <GameSidebar />
      <GameHeader team={team} />
      <main className="flex-1 overflow-y-auto p-6 pb-28 space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <Sprout className="h-7 w-7 text-[#1db954]" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">CATEGORIA DE BASE</h1>
            {/* Ocupação x capacidade: a base tem teto (ate 100 na academia nivel 5). */}
            <p className="text-white/50 mt-1">
              <span className={cn("font-semibold", vagas === 0 ? "text-amber-400" : "text-white/70")}>
                {youth.length}/{capacidade}
              </span>{" "}
              garotos • {vagas} vaga{vagas !== 1 ? "s" : ""} • Promoção: R$ {(PROMOTION_FEE / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={acompanharSemana} className="border-white/15 text-white">
              <RefreshCw className="mr-2 h-4 w-4" /> Acompanhar semana
            </Button>
            <Button variant="outline" onClick={developMonth} className="border-white/15 text-white">
              <RefreshCw className="mr-2 h-4 w-4" /> Evoluir um mês
            </Button>
            <Button
              onClick={holdTryout}
              disabled={vagas === 0 || !peneiraDisponivel}
              title={
                !peneiraDisponivel ? `Próxima peneira em ${TRYOUT_COOLDOWN - semanasDesdePeneira} semana(s)`
                : vagas === 0 ? "Base lotada — dispense ou promova alguém" : undefined
              }
              className="bg-[#1db954] text-black hover:bg-[#1ed760] disabled:opacity-40"
            >
              <Sprout className="mr-2 h-4 w-4" />
              {!peneiraDisponivel ? `Peneira em ${TRYOUT_COOLDOWN - semanasDesdePeneira} sem.` : "Peneira Sub-17 · R$ 100 mil"}
            </Button>
          </div>
        </header>

        {youth.length === 0 ? (
          <div className="rounded-xl bg-[#141414] border border-white/5 p-12 text-center">
            <Sprout className="h-12 w-12 mx-auto text-white/20 mb-3" />
            <h3 className="font-semibold text-white">Nenhum prospecto disponível</h3>
            <p className="text-sm text-white/50 mt-2">Avance a próxima temporada para a coordenação revelar uma nova geração.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {youth.map(p => {
              const isGem = p.potential >= 85
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all",
                    isGem ? "border-yellow-500/40 bg-yellow-500/5" : "border-white/5 bg-[#141414]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white truncate">{p.name}</h3>
                        {isGem && <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-medium">{p.position}</span>
                        <span>{p.age} anos</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular-nums text-white">{p.overall}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">overall</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">Potencial</div>
                      <div className={cn("text-lg font-bold tabular-nums", isGem ? "text-yellow-400" : "text-[#1db954]")}>
                        {p.potential}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">Crescimento</div>
                      <div className="text-lg font-bold tabular-nums text-white">+{p.potential - p.overall}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                    <Stat label="VEL" v={p.pace ?? 0} />
                    <Stat label="FIN" v={p.shooting ?? 0} />
                    <Stat label="PAS" v={p.passing ?? 0} />
                    <Stat label="DRI" v={p.dribbling ?? 0} />
                    <Stat label="DEF" v={p.defending ?? 0} />
                    <Stat label="FÍS" v={p.physical ?? 0} />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => promote(p)}
                      disabled={balance < PROMOTION_FEE}
                      className="flex-1 bg-[#1db954] text-black hover:bg-[#1ed760] disabled:opacity-40 text-xs font-bold tracking-wider"
                    >
                      <ArrowUp className="mr-1 h-3.5 w-3.5" />
                      PROMOVER
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendOnLoan(p)}
                      title="Emprestar"
                      className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10 text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    {/* Negociar o garoto: proposta pelo valor de PROMESSA. */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => venderJovem(p)}
                      title={`Vender — vale ~${formatCurrency(valorDeMercadoJovem(p as unknown as JovemBase))}`}
                      className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10 text-xs"
                    >
                      Vender
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => releaseYouth(p)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs"
                    >
                      Dispensar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                <ShoppingCart className="h-5 w-5 text-sky-400" />
                Mercado de juniores
              </h2>
              <p className="mt-1 text-xs text-white/45">
                Promessas de outros clubes disponíveis para compra direta pela categoria de base. As ofertas mudam a cada quatro semanas.
              </p>
            </div>
            <span className="text-xs text-white/40">
              {youthMarket.length} de {youthMarketPool.length} {youthMarketPool.length === 1 ? "promessa" : "promessas"}
            </span>
          </div>

          {/* Filtros de busca */}
          <div className="mb-4 grid gap-2 rounded-xl border border-white/5 bg-[#111] p-3 sm:grid-cols-2 xl:grid-cols-6">
            <input
              value={fBusca} onChange={e => setFBusca(e.target.value)}
              placeholder="Nome ou clube" aria-label="Buscar por nome ou clube"
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-sky-400/50"
            />
            <select value={fPos} onChange={e => setFPos(e.target.value)} aria-label="Posicao"
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-sky-400/50">
              <option value="todas">Todas as posições</option>
              {["GOL","ZAG","LD","LE","VOL","MEI","PD","PE","ATA"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/60">
              Idade ate
              <input type="number" min={14} max={21} value={fIdadeMax}
                onChange={e => setFIdadeMax(Number(e.target.value) || 21)}
                className="w-full bg-transparent text-white outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/60">
              Overall min
              <input type="number" min={0} max={99} value={fOverallMin}
                onChange={e => setFOverallMin(Number(e.target.value) || 0)}
                className="w-full bg-transparent text-white outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/60">
              Potencial min
              <input type="number" min={0} max={99} value={fPotencialMin}
                onChange={e => setFPotencialMin(Number(e.target.value) || 0)}
                className="w-full bg-transparent text-white outline-none" />
            </label>
            <button
              onClick={() => { setFPos("todas"); setFIdadeMax(21); setFOverallMin(0); setFPotencialMin(0); setFPrecoMax(0); setFBusca("") }}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
            >
              Limpar filtros
            </button>
          </div>

          {youthMarket.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#141414] p-6 text-center text-sm text-white/45">
              {youthMarketPool.length === 0
                ? "Todas as ofertas deste ciclo já foram negociadas. Novos juniores aparecerão no próximo ciclo mensal."
                : "Nenhuma promessa atende aos filtros. Ajuste os critérios ou limpe os filtros."}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {youthMarket.map(player => (
                <div key={player.id} className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">{player.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-sky-200/60">{player.fromTeam}</p>
                    </div>
                    <span className="rounded bg-white/10 px-2 py-1 text-xs font-bold text-white">{player.position}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-black/20 p-2">
                      <div className="text-[9px] uppercase text-white/35">Idade</div>
                      <div className="font-bold text-white">{player.age}</div>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2">
                      <div className="text-[9px] uppercase text-white/35">Overall</div>
                      <div className="font-bold text-white">{player.overall}</div>
                    </div>
                    <div className="rounded-lg bg-black/20 p-2">
                      <div className="text-[9px] uppercase text-white/35">Potencial</div>
                      <div className={cn("font-bold", player.potential >= 85 ? "text-yellow-400" : "text-[#1db954]")}>{player.potential}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => buyYouth(player)}
                    disabled={vagas <= 0 || caixaDoMotor < player.value}
                    className="mt-3 w-full bg-sky-400 font-bold text-black hover:bg-sky-300 disabled:opacity-40"
                  >
                    <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                    Comprar · {formatCurrency(player.value)}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-200/80">
            Saldo atual: <strong className="text-white">{formatCurrency(balance)}</strong>. Promover um jovem custa R$ 200.000 e o move para o elenco profissional. Joias (potencial ≥85) são raras e indicam grande crescimento futuro.
          </div>
        </div>
      </main>
      <SystemMediaPlayer />
      </div>
    </div>
  )
}

function Stat({ label, v }: { label: string; v: number }) {
  const color = v >= 80 ? "text-[#1db954]" : v >= 70 ? "text-yellow-400" : v >= 60 ? "text-white/80" : "text-white/50"
  return (
    <div className="rounded bg-white/5 px-1.5 py-1.5">
      <div className="text-[9px] text-white/40 tracking-wider">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", color)}>{v}</div>
    </div>
  )
}
