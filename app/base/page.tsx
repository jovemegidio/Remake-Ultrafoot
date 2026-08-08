"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Sprout, Star, ArrowUp, AlertTriangle, RefreshCw, Send, ShoppingCart } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { SystemMediaPlayer } from "@/components/system-media-player"
import { Button } from "@/components/ui/button"
import { useGameState, commitGameState, type GameState, type SquadPlayer } from "@/lib/save-system"
import { useGameManager } from "@/lib/use-game-manager"
import { useUserTeam } from "@/lib/time-da-carreira"
import { flushPersistentStore } from "@/lib/persistent-store"
import { formatCurrency } from "@/lib/teams-data"
import { generateYouthMarketProspects, generateYouthProspects } from "@/lib/youth-academy"
import { advanceYouthMonth, loanYouth, runTryout } from "@/lib/youth-engine"
import {
  capacidadeDaBase, vagasNaBase, evoluirSemana, propostaPorJovem,
  valorDeMercadoJovem, cobrancaDaDiretoria, type JovemBase, type EvolucaoSemanal,
} from "@/lib/youth-academy-rules"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { useNotifications } from "@/components/notifications-system"
import { avisar as avisarNoJogo, confirmar as confirmarNoJogo, pedirTexto as pedirTextoNoJogo } from "@/lib/dialogo-do-jogo"
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

/**
 * Aplica uma mudança na base GRAVANDO ANTES e só então avisando o React.
 *
 * ⚠️ POR QUE `setState` + `gravarAgora()` NÃO BASTAVA (relato reincidente:
 * "vendi 10 juniores, saí da tela, voltei e os 10 estavam lá; e o dinheiro não
 * entrou").
 *
 * `setState` só escreve no save DENTRO do atualizador que entrega ao React, e
 * esse atualizador roda depois que o manipulador do clique termina. O
 * `gravarAgora()` chamado logo abaixo descarregava uma fila que ainda estava
 * VAZIA. Navegar no jogo é reload completo: a gravação de verdade era perdida e
 * o save voltava com os garotos.
 *
 * O dinheiro não voltava junto porque o caixa vive no MOTOR, que persiste por
 * outro caminho — e aí os dois sintomas se encadeavam: o jovem ressuscitava com
 * o MESMO id (a geração é determinística), e vender de novo não pagava nada,
 * porque `receberPorJovem` já tinha registrado o recibo `jovem:<id>`.
 *
 * `commitGameState` escreve direto no save, fora do ciclo do React. O `setState`
 * continua para a tela reagir na hora.
 */
function aplicarNaBase(
  setState: (p: Partial<GameState>) => void,
  patch: (prev: GameState) => Partial<GameState>,
): void {
  // Repassa ao React EXATAMENTE o que mudou. Uma lista fixa de campos deixaria
  // de fora `squadPlayers` e `transfers`, que a promoção também mexe.
  let delta: Partial<GameState> = {}
  commitGameState((prev) => { delta = patch(prev); return delta })
  setState(delta)
  gravarAgora()
}

/**
 * Acrescenta ids ao registro de quem JA SAIU da base, sem duplicar.
 *
 * Por que existe: `generateYouthProspects` e DETERMINISTICO (semente =
 * `hash("CLUBE:TEMPORADA:base")`), entao devolve sempre os mesmos garotos com os
 * mesmos ids. Sem este registro, qualquer nova semeadura ressuscitava quem o
 * tecnico acabou de vender ou dispensar — era o relato "vendi e eles voltaram".
 *
 * Vale para vender, dispensar e promover. NAO vale para emprestimo: ali o jovem
 * volta de proposito.
 *
 * Fica fora do componente porque nao depende de nada dele — evita tambem
 * depender da ordem em que os hooks sao declarados.
 */
function registrarSaida(anteriores: string[] | undefined, ids: string[]): string[] {
  const antes = anteriores ?? []
  const novos = ids.filter(id => !antes.includes(id))
  return novos.length > 0 ? [...antes, ...novos] : antes
}

/**
 * O id gerado pela academia e `youth_<CURTO>_<TEMPORADA>_<i>` — o clube esta
 * DENTRO do id. Isto reconhece um garoto que foi gerado para OUTRO clube.
 *
 * Serve para limpar o estrago que a semeadura pre-hidratada deixou nos saves: ela
 * rodava com o time FALLBACK (Botafogo) e enfiava `youth_BOT_2026_x` na base de
 * quem dirige qualquer outro clube.
 *
 * Nao confunde com quem entrou por outra porta: comprado no mercado de juniores e
 * `youth_market_...` / `youth_bought_...`, e legado e `legacy_...` — nenhum casa
 * com o formato abaixo, que exige o curto em MAIUSCULAS.
 *
 * DOIS FORMATOS DE PROPOSITO. O id da academia ganhou um selo de peneira no
 * meio — `youth_BOT_2026_ms9x6v4o_1` — porque `youth_<CURTO>_<TEMPORADA>_<i>`
 * repetia os MESMOS 6 ids a cada geracao e a segunda venda era recusada em
 * silencio (ver o comentario do id em lib/youth-academy.ts). Os saves antigos
 * seguem cheios do formato sem selo, entao os dois precisam ser reconhecidos:
 * so o novo deixaria de limpar o estrago nos saves ja existentes, e so o velho
 * deixaria de limpa-lo nos novos.
 */
function ehDeOutroClube(id: string, curto: string): boolean {
  const m = /^youth_([A-Z]{2,4})_\d{4}_(?:[a-z0-9]+_)?\d+$/.exec(id)
  return m != null && m[1] !== curto
}

export default function BasePage() {
  useRequireClub()
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })

  const { team } = useUserTeam()
  // `hydrated` NAO e detalhe: ver o bloco EFEITO QUE ESCREVE SO DEPOIS DE HIDRATAR,
  // logo acima da semeadura. Sem ele a tela reescrevia a base no primeiro render.
  const { state, setState, hydrated } = useGameState()
  // O calendario tambem anda quando se trabalha na base — ver `developMonth`.
  const { advanceWeek, temPartidaPendenteNaSemana } = useGameManager()
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
  // SEMANA DA TEMPORADA para a janela de transferencias. O contador do motor
  // (currentWeek) e absoluto e nunca zera; a temporada zera todo ano e acaba
  // na ultima rodada do calendario, quase nunca na 52a semana. Usar o contador
  // absoluto fazia a janela abrir e fechar em datas que nao existem no
  // calendario que o jogador ve.
  const semanaDaTemporada = state.week ?? 0
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

  // REPARO DOS SAVES JA CONTAMINADOS.
  //
  // Enquanto a semeadura rodava pre-hidratada, ela gravava na base os prospectos do
  // clube FALLBACK (Botafogo). Corrigir o efeito impede novos estragos, mas nao
  // desfaz o que ja esta no save: sem isto o tecnico ficaria para sempre com seis
  // garotos que nunca foram do clube dele — e continuaria vendo "os mesmos de
  // sempre". Aqui eles saem e a semeadura correta e liberada (youthSeededSeason
  // volta a ficar vago), gerando a leva de verdade do clube.
  //
  // Idempotente: sem intrusos, nao escreve nada. Quem dirige o Botafogo nunca cai
  // aqui, porque os ids batem com o clube.
  useEffect(() => {
    if (!hydrated || !state.selectedTeamShort || !team?.curto) return
    if (!(state.youthPlayers ?? []).some(p => ehDeOutroClube(p.id, team.curto))) return
    aplicarNaBase(setState, s => ({
      youthPlayers: (s.youthPlayers ?? []).filter(p => !ehDeOutroClube(p.id, team.curto)),
      youthSeededSeason: undefined,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, team?.curto, state.selectedTeamShort, state.youthPlayers])

  // SEMEIA a base quando vazia.
  //
  // BUG que isto corrige ("os juniores nao funcionam"): a pagina le state.youthPlayers,
  // mas ninguem populava esse campo — o motor jogava os jovens gerados direto no elenco
  // profissional. A base ficava SEMPRE VAZIA. Aqui geramos os prospectos de forma
  // deterministica (clube + temporada) na primeira visita de cada temporada; promover e
  // dispensar seguem persistindo por cima.
  //
  // ⚠️⚠️ EFEITO QUE ESCREVE SO DEPOIS DE HIDRATAR — foi ESTE efeito que devolvia os
  // juniores vendidos, e nao a gravacao da venda (que a 1.0.239 ja consertou).
  //
  // `useGameState` comeca em DEFAULT_STATE e so le o save DENTRO do proprio efeito.
  // Todos os efeitos deste componente rodam no MESMO commit, com o fechamento do
  // primeiro render — ou seja, com o save AINDA VAZIO. No primeiro render:
  //
  //   • `state.youthDeparted` e []  ⇒ o filtro de quem ja saiu nao filtra NADA;
  //   • `state.youthPlayers` e []   ⇒ `atuais` some, e a base inteira e substituida;
  //   • `useUserTeam` tambem esta pre-hidratado ⇒ `team` e o FALLBACK (Botafogo);
  //   • `youthSeededSeason` (undefined) !== `season` (2026) ⇒ semeia.
  //
  // E `hardNavigate` HOJE NAO RECARREGA A PAGINA (despacha `ultrafoot:navigate` para o
  // router do Next — ver lib/hard-navigation.ts), entao o cache do store ja esta quente
  // e essa gravacao cai por cima do save REAL. Como a geracao e deterministica, voltar
  // a tela regenerava SEMPRE os mesmos seis garotos, com os mesmos ids: os vendidos
  // "voltavam", e a venda seguinte nao pagava nada porque `receberPorJovem` ja tinha o
  // recibo `jovem:<id>` daquele mesmo id.
  //
  // Duas travas, porque uma so nao basta:
  //   1. `hydrated` — nao escreve antes de o save chegar do disco;
  //   2. patch FUNCIONAL — o que for gravado e calculado sobre o save mais novo, nunca
  //      sobre o fechamento do render. Se algum dia o efeito voltar a rodar cedo, ele
  //      le `youthDeparted` de verdade e nao ressuscita ninguem.
  //
  // `team?.curto` nao serve de guarda: useUserTeam NUNCA devolve nulo (cai no fallback
  // Botafogo). Quem diz que ha clube de verdade e `selectedTeamShort`.
  useEffect(() => {
    if (!hydrated) return
    if (!state.selectedTeamShort || !team?.curto) return
    // Semeia na primeira visita da temporada. Usar `youthSeededSeason !== season` (e nao
    // "youthPlayers === undefined") cobre os dois casos: a primeira vez de todas, E o
    // inicio de uma temporada nova — quando youthPlayers pode ter ficado [] da anterior.
    if (state.youthSeededSeason === state.season) return
    aplicarNaBase(setState, s => {
      // Relido do save: se outra tela ja semeou, nao ha nada a fazer.
      if (s.youthSeededSeason === s.season) return {}
      const atuais = s.youthPlayers ?? []
      // Preserva comprados, legados e atletas em desenvolvimento. A nova geração
      // só completa o núcleo mínimo da academia; nunca apaga a turma anterior.
      const quantidadeNova = Math.max(0, Math.min(6, capacidade - atuais.length))
      const novaGeracao = generateYouthProspects(
        team.curto,
        s.season,
        team.prestigio ?? 60,
        quantidadeNova,
        team.pais,
      )
      // QUEM SAIU NAO VOLTA. `generateYouthProspects` e deterministico
      // (semente = clube + temporada), entao ele devolve SEMPRE os mesmos
      // garotos, com os mesmos ids — inclusive os que o tecnico acabou de
      // vender ou dispensar. Era exatamente esse o relato: vender e, ao
      // reabrir a tela, ver os mesmos de volta.
      //
      // Tambem filtra quem ja esta na base para o caso de a semeadura rodar
      // duas vezes (recarregar a tela no meio de uma gravacao pendente).
      const jaSairam = new Set(s.youthDeparted ?? [])
      const jaEstao = new Set(atuais.map(p => p.id))
      const admitidos = novaGeracao.filter(p => !jaSairam.has(p.id) && !jaEstao.has(p.id))
      return {
        youthPlayers: [...atuais, ...admitidos],
        youthSeededSeason: s.season,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, team?.curto, state.selectedTeamShort, state.season, state.youthSeededSeason])

  // ENVELHECIMENTO + PROMOÇÃO AUTOMÁTICA AOS 18 (pedido do usuário).
  //
  // A cada virada de temporada, a base envelhece um ano e QUEM COMPLETA 18 sobe
  // automaticamente ao profissional — não mais em bloco após 3 temporadas. O
  // `youthAgedSeason` garante que a idade só avança uma vez por temporada, mesmo
  // reabrindo a tela. Roda depois da semeadura, então a turma nova (14-17) do ano
  // não é promovida no mesmo tick.
  //
  // Mesma trava da semeadura: so depois de `hydrated`, e calculando sobre o save
  // relido. Este efeito move gente da base para o ELENCO — rodar com o fechamento
  // vazio do primeiro render zeraria os dois lados de uma vez.
  useEffect(() => {
    if (!hydrated) return
    if (state.youthSeededSeason !== state.season) return // espera semear
    if (state.youthAgedSeason === state.season || youth.length === 0) return
    let promovidos: SquadPlayer[] = []
    aplicarNaBase(setState, s => {
      if (s.youthAgedSeason === s.season) return {}
      // Quem acabou de chegar nesta temporada (nova geração ou compra) não
      // envelhece no mesmo instante da matrícula.
      const envelhecida = (s.youthPlayers ?? []).map(p =>
        p.seasonSigned === s.season ? p : { ...p, age: (p.age ?? 16) + 1 },
      )
      const sobem = envelhecida.filter(p => (p.age ?? 0) >= 18)
      const ficam = envelhecida.filter(p => (p.age ?? 0) < 18)
      promovidos = sobem.map((p, i) => ({
        ...p,
        id: `pro_auto_${s.season}_${i}_${p.id}`,
        fromTeam: "Categoria de Base",
        seasonSigned: s.season,
      }))
      return {
        youthPlayers: ficam,
        squadPlayers: promovidos.length ? [...(s.squadPlayers ?? []), ...promovidos] : s.squadPlayers,
        youthAgedSeason: s.season,
        // Quem subiu aos 18 tambem sai da base para sempre. Sem isto a semeadura
        // da temporada seguinte devolveria o mesmo garoto, que passaria a existir
        // no profissional E na base ao mesmo tempo.
        youthDeparted: registrarSaida(s.youthDeparted, sobem.map(p => p.id)),
      }
    })
    if (promovidos.length) {
      addNotification({
        type: "system", priority: "medium",
        title: `${promovidos.length} da base subiu ao profissional`,
        message: `${promovidos.map(p => p.name).join(", ")} completou 18 anos e foi promovido automaticamente.`,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.season, state.youthSeededSeason, state.youthAgedSeason, youth.length])

  // COBRANÇA DA DIRETORIA pelo uso da base, em momentos definidos da temporada
  // (pedido). Dispara uma vez por janela, marcada em youthBoardCheckWeek.
  useEffect(() => {
    // Pre-hidratacao a semana e 0 e o elenco e vazio: a cobranca sairia com dados
    // falsos e ainda gravaria `youthBoardCheckWeek` por cima do save.
    if (!hydrated) return
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
  }, [hydrated, state.week, state.season, nivelAcademia])

  // Efetiva as vendas de jovens ACERTADAS fora da janela, assim que a janela
  // abre: o jovem sai da base e o valor entra no caixa (pedido).
  useEffect(() => {
    if (!hydrated) return
    if (!isTransferWindowOpen(semanaDaTemporada)) return
    const aVender = youth.filter(p => p.vendaPendente)
    if (aVender.length === 0) return
    // Grava a SAIDA primeiro (ver aplicarNaBase): o `setState` sozinho so
    // persistia depois que o React processasse a fila, e uma navegacao no meio
    // devolvia os jovens ja vendidos.
    aplicarNaBase(setState, s => {
      const saindo = (s.youthPlayers ?? []).filter(p => p.vendaPendente)
      return {
        youthPlayers: (s.youthPlayers ?? []).filter(p => !p.vendaPendente),
        youthDeparted: registrarSaida(s.youthDeparted, saindo.map(p => p.id)),
      }
    })
    // Um recibo POR JOVEM, e nao um credito unico: se a lista mudar entre duas
    // execucoes, cada venda continua sendo paga exatamente uma vez.
    for (const p of aVender) receberPorJovem(p.vendaPendente!.valor, `jovem:${p.id}`)
    for (const p of aVender) {
      addNotification({ type: "transfer", priority: "medium", title: `${p.name} vendido`,
        message: `${p.vendaPendente!.clube} concretizou a compra de ${p.name} por ${formatCurrency(p.vendaPendente!.valor)} na abertura da janela.` })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, semanaAtual])

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

  const promote = async (player: SquadPlayer) => {
    if (caixaDoMotor < PROMOTION_FEE) {
      await avisarNoJogo({
        titulo: "Saldo insuficiente",
        mensagem: "Promover um jovem ao elenco profissional custa R$ 200.000.",
        tom: "alerta",
      })
      return
    }
    const confirmado = await confirmarNoJogo({
      titulo: `Promover ${player.name} ao elenco profissional?`,
      mensagem: "O clube paga R$ 200.000 e o atleta passa a ocupar vaga no elenco principal.",
      confirmar: "Promover",
    })
    if (!confirmado) return
    // A DIVISAO vai junto: o salario do primeiro contrato sai dela (um garoto de
    // Serie D nao pode entrar ganhando salario de Serie A). `divisionOverride` e
    // a divisao de HOJE, ja com acesso/rebaixamento; o cadastro do clube so vale
    // enquanto ninguem subiu nem desceu. No modo selecao `team.divisao` e a
    // sentinela "selecao", que nao tem fator salarial: deixa o motor resolver.
    const divisaoParaSalario = state.divisionOverride
      ?? (team.divisao === "selecao" ? undefined : team.divisao)
    const subiu = promoverNoMotor({
      name: player.name, position: player.position, age: player.age,
      overall: player.overall, potential: player.potential,
      pace: player.pace, shooting: player.shooting, passing: player.passing,
      dribbling: player.dribbling, defending: player.defending, physical: player.physical,
    }, PROMOTION_FEE, divisaoParaSalario)
    if (!subiu) {
      await avisarNoJogo({
        titulo: "Não foi possível promover",
        mensagem: "O saldo do clube não cobre a taxa de promoção.",
        tom: "alerta",
      })
      return
    }
    const promoted: SquadPlayer = {
      ...player,
      id: `pro_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromTeam: "Categoria de Base",
      seasonSigned: state.season,
    }
    // Promover tambem grava ANTES (ver aplicarNaBase): este caminho nem chamava
    // gravarAgora, entao promover e trocar de tela em seguida podia devolver o
    // garoto a base — e ele ja estava no elenco profissional, existindo duas vezes.
    aplicarNaBase(setState, s => ({
      // Mantido no save tambem: e daqui que sai a cobranca da diretoria por uso
      // da base e o historico de promovidos.
      squadPlayers: [...(s.squadPlayers ?? []), promoted],
      youthPlayers: (s.youthPlayers ?? []).filter(p => p.id !== player.id),
      // Promovido tambem NAO volta: senao ele existiria duas vezes, no elenco
      // profissional e na base, na proxima semeadura.
      youthDeparted: registrarSaida(s.youthDeparted, [player.id]),
      transfers: [...(s.transfers ?? []), {
        id: `youth_promo_${Date.now()}`,
        playerName: player.name,
        fromTeam: "Categoria de Base",
        toTeam: team.curto,
        value: PROMOTION_FEE,
        type: "buy",
        week: state.currentRound ?? 0,
        season: state.season,
      }],
    }))
  }

  const releaseYouth = async (player: SquadPlayer) => {
    const confirmado = await confirmarNoJogo({
      titulo: `Dispensar ${player.name} da categoria de base?`,
      mensagem: "A vaga fica aberta até a próxima peneira ou temporada.",
      tom: "perigo",
      confirmar: "Dispensar",
    })
    if (!confirmado) return
    // Dispensar NAO gera substituto na hora. Antes gerava, e dava para ficar
    // apertando dispensar ate sair um bom (relato do jogador) — cada clique era
    // um novo sorteio. Agora a vaga apenas abre; para preencher, use a peneira
    // (paga) ou espere a proxima temporada semear a base.
    // Mesma corrida da venda: `setState` + `gravarAgora()` descarregava fila
    // vazia e o garoto voltava ao recarregar. Ver aplicarNaBase.
    aplicarNaBase(setState, s => ({
      youthPlayers: (s.youthPlayers ?? []).filter(p => p.id !== player.id),
      youthDeparted: registrarSaida(s.youthDeparted, [player.id]),
    }))
  }

  // Carimbo absoluto (semanas desde o marco) da semana atual e da última peneira.
  const stampAtual = state.season * 52 + (state.week ?? 0)
  const TRYOUT_COOLDOWN = 8 // ~2 meses
  const semanasDesdePeneira = stampAtual - (state.youthTryoutStamp ?? -999)
  const peneiraDisponivel = semanasDesdePeneira >= TRYOUT_COOLDOWN

  const holdTryout = async () => {
    // COOLDOWN: a peneira acontece a cada ~2 meses (8 semanas). Sem isto, rodar
    // peneira (barata) e vender os prospectos em loop imprimia dinheiro infinito.
    if (!peneiraDisponivel) {
      const faltam = TRYOUT_COOLDOWN - semanasDesdePeneira
      return void avisarNoJogo({
        titulo: "A peneira ainda não pode ser realizada",
        mensagem: `A próxima só daqui a ${faltam} semana${faltam === 1 ? "" : "s"} — o clube faz uma a cada ~2 meses.`,
        tom: "alerta",
      })
    }
    // CAPACIDADE: a peneira era a unica porta de entrada que nao olhava as vagas
    // (comprar no mercado de juniores ja olhava). Dava para estourar o teto da
    // academia e manter uma fila de garotos maior do que o clube comporta.
    if (vagas <= 0) {
      return void avisarNoJogo({
        titulo: "A categoria de base está lotada",
        mensagem: "Promova, venda ou dispense alguém antes da próxima peneira.",
        tom: "alerta",
      })
    }
    const fee = 100_000
    const semCaixa = () => void avisarNoJogo({
      titulo: "Saldo insuficiente",
      mensagem: "A peneira custa R$ 100.000 e o caixa não cobre esse valor.",
      tom: "alerta",
    })
    if (caixaDoMotor < fee) return semCaixa()
    if (!gastarDoCaixa(fee)) return semCaixa()
    const intake = runTryout(state, "sub17")
    // So entra quem cabe. O resto da peneira "nao vingou" — melhor do que
    // estourar o teto que a propria tela anuncia.
    const aproveitados = intake.players.slice(0, vagas)
    // Acrescenta sobre a lista RELIDA do save, nao sobre `youth` do fechamento:
    // um `[...youth, ...novos]` com fechamento velho apagaria quem entrou depois.
    aplicarNaBase(setState, s => ({
      youthPlayers: [...(s.youthPlayers ?? []), ...aproveitados],
      youthTryoutStamp: stampAtual,
    }))
    if (aproveitados.length < intake.players.length) {
      void avisarNoJogo({
        titulo: "Peneira encerrada",
        mensagem: `A base tinha ${vagas} vaga(s): ${aproveitados.length} garoto(s) foram aproveitados de ${intake.players.length} avaliados.`,
      })
    }
  }

  const developMonth = async () => {
    // Evolucao tambem grava sobre o save relido: estas duas acoes SUBSTITUEM a
    // lista inteira, entao um fechamento velho apagaria contratacoes recentes.
    let evoluidos = 0
    aplicarNaBase(setState, s => {
      const result = advanceYouthMonth(s)
      evoluidos = result.report.highlights.length
      return { youthPlayers: result.state.youthPlayers, updatedAt: result.state.updatedAt }
    })

    // ⚠️ O MES TAMBEM PASSA NO CALENDARIO (pedido: "evoluir um mes deve avancar
    // no calendario"). Antes so os garotos evoluiam e a data do topo ficava
    // parada — um mes de trabalho sem um dia passar.
    //
    // MAS NAO AVANCA A TAPA: `advanceWeek` resolve sozinho a partida da semana
    // que ficou para tras, entao empurrar 4 semanas cegamente faria o jogador
    // PERDER ate 4 jogos sem nunca ver a tela deles. Aqui a regra e parar assim
    // que houver jogo seu na semana — o mes anda ate a beira do proximo
    // compromisso e devolve a decisao para quem joga.
    let semanas = 0
    for (let i = 0; i < 4; i++) {
      if (temPartidaPendenteNaSemana()) break
      await advanceWeek()
      semanas++
    }
    // A base grava direto no disco (`aplicarNaBase`); o avanco de semana entra
    // pelo caminho do React. Descarrega os dois antes de qualquer navegacao.
    try { await flushPersistentStore() } catch { /* o save em memoria ja esta correto */ }

    void avisarNoJogo({
      titulo: "Mês de trabalho na base",
      mensagem: `${evoluidos} jovem(ns) evoluíram neste mês.`
        + (semanas === 4 ? " O calendário avançou 4 semanas."
          : semanas > 0 ? ` O calendário avançou ${semanas} semana(s) e parou: você tem jogo a disputar.`
          : " O calendário não andou: você tem jogo a disputar nesta semana."),
      tom: "sucesso",
    })
  }

  /** Uma semana de trabalho na base — o acompanhamento semanal pedido. */
  const acompanharSemana = () => {
    let r: EvolucaoSemanal = { jovens: [], destaques: [], prontosParaSubir: [] }
    aplicarNaBase(setState, s => {
      r = evoluirSemana((s.youthPlayers ?? []) as unknown as JovemBase[], nivelAcademia)
      return { youthPlayers: r.jovens as unknown as SquadPlayer[] }
    })
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
  const venderJovem = async (player: SquadPlayer) => {
    const j = player as unknown as JovemBase
    const justo = valorDeMercadoJovem(j)
    // DIFICULDADE DE VENDA (pedido): nem todo garoto atrai comprador. O interesse
    // do mercado sobe com a promessa do atleta — um prospecto fraco raramente é
    // sondado, uma joia quase sempre. Antes toda venda tinha comprador garantido.
    const interesse = Math.max(0.12, Math.min(0.92, (justo - 200_000) / 3_000_000))
    if (Math.random() > interesse) {
      return void avisarNoJogo({
        titulo: `Nenhum clube demonstrou interesse por ${player.name}`,
        mensagem: "Desenvolva-o mais e tente de novo adiante.",
      })
    }
    const clubes = ["Benfica", "Ajax", "Porto", "Shakhtar", "Red Bull Salzburg", "Palmeiras", "Flamengo"]
    const p = propostaPorJovem(j, clubes[Math.floor(Math.random() * clubes.length)])
    const janelaAberta = isTransferWindowOpen(semanaDaTemporada)
    const aviso = janelaAberta
      ? ""
      : "\n\nA janela está FECHADA: a venda fica acertada e o jovem sai da base assim que a janela abrir."
    const confirmado = await confirmarNoJogo({
      titulo: `${p.clube} oferece ${formatCurrency(p.valor)} por ${player.name}`,
      mensagem: `Valor estimado: ${formatCurrency(justo)}` +
        (p.abaixoDoValor ? "\n\nA proposta está ABAIXO do valor do atleta." : "") + aviso,
      tom: p.abaixoDoValor ? "perigo" : "alerta",
      confirmar: "Aceitar venda",
    })
    if (!confirmado) return

    if (janelaAberta) {
      // ORDEM IMPORTA: grava a SAÍDA primeiro, paga depois. Se o pagamento
      // entrasse antes e a gravação se perdesse, o técnico ficaria com o
      // dinheiro E com o garoto — que é o dinheiro infinito que esta tela já
      // teve. Ao contrário, o pior caso é uma venda sem pagamento, visível e
      // corrigível, em vez de um exploit silencioso.
      aplicarNaBase(setState, s => ({
        youthPlayers: (s.youthPlayers ?? []).filter(x => x.id !== player.id),
        youthDeparted: registrarSaida(s.youthDeparted, [player.id]),
      }))
      receberPorJovem(p.valor, `jovem:${player.id}`)
      addNotification({ type: "transfer", priority: "medium", title: `${player.name} vendido`,
        message: `${p.clube} contratou ${player.name} da base por ${formatCurrency(p.valor)}.` })
    } else {
      // Marca a saida pendente: o jovem continua na base ate a janela abrir.
      // Grava por `aplicarNaBase` como os demais: a janela fica FECHADA em 30 das
      // 52 semanas, entao este e o caminho MAIS COMUM da venda — e era o unico que
      // ainda dependia so do `setState`. Sair da tela apagava o acerto, e o garoto
      // reaparecia inteiro, sem venda e sem dinheiro.
      aplicarNaBase(setState, s => ({
        youthPlayers: (s.youthPlayers ?? []).map(x => x.id === player.id
          ? ({ ...x, vendaPendente: { clube: p.clube, valor: p.valor } } as SquadPlayer)
          : x),
      }))
      addNotification({ type: "transfer", priority: "medium", title: `Venda acertada: ${player.name}`,
        message: `${p.clube} pagará ${formatCurrency(p.valor)} por ${player.name} quando a janela abrir.` })
    }
  }

  const sendOnLoan = async (player: SquadPlayer) => {
    const club = (await pedirTextoNoJogo({
      titulo: `Emprestar ${player.name}`,
      mensagem: "Para qual clube o jovem vai jogar nesta temporada?",
      placeholder: "Clube de destino",
    }))?.trim()
    if (!club) return
    // NAO entra em `youthDeparted`: no emprestimo o jovem volta de proposito.
    // Mas grava como os outros — sair da tela desfazia o emprestimo e o garoto
    // reaparecia na base, mais um caso de "eles voltam".
    aplicarNaBase(setState, s => {
      const result = loanYouth(s, player.id, club)
      return { youthPlayers: result.youthPlayers ?? [], updatedAt: result.updatedAt }
    })
  }

  const buyYouth = async (player: SquadPlayer) => {
    if (vagas <= 0) {
      return void avisarNoJogo({
        titulo: "A categoria de base está lotada",
        mensagem: "Promova, venda ou dispense um jovem antes de contratar.",
        tom: "alerta",
      })
    }
    const semCaixa = () => void avisarNoJogo({
      titulo: "Saldo insuficiente",
      mensagem: `O clube não tem ${formatCurrency(player.value)} em caixa para contratar ${player.name}.`,
      tom: "alerta",
    })
    if (caixaDoMotor < player.value) return semCaixa()
    const confirmado = await confirmarNoJogo({
      titulo: `${player.fromTeam} pede ${formatCurrency(player.value)} por ${player.name}`,
      mensagem: `${player.age} anos (${player.position}). O atleta irá diretamente para a sua categoria de base.`,
      confirmar: "Contratar",
    })
    if (!confirmado) return
    if (!gastarDoCaixa(player.value)) return semCaixa()
    const contratado: SquadPlayer = {
      ...player,
      id: `youth_bought_${Date.now()}_${player.id}`,
      fromTeam: player.fromTeam,
      seasonSigned: state.season,
    }
    aplicarNaBase(setState, current => ({
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
      {/* Fundo PROPRIO da categoria de base (arte pedida pelo usuario), no lugar
          do fundo do escritorio. Uma imagem so, sem crossfade: e uma tela de
          consulta, nao precisa de animacao de fundo rodando a toda hora. */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <Image src="/images/juniores-bg.webp" alt="" fill priority unoptimized className="object-cover" />
      </div>
      {/* Escurecimento so o suficiente para o texto ler — a vinheta pesada saiu. */}
      <div className="pointer-events-none fixed inset-0 bg-[#050508]/62" />

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
