"use client"

import { LinkLeve as Link } from "@/components/link-leve"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Fragment, useState, useRef, useEffect, useMemo, useSyncExternalStore } from "react"
import { Save, FastForward, Play, Settings, Check, Loader2, ChevronDown, User, Users, Trophy, Calendar, TrendingUp, ChevronRight, Star, LogOut, Bell, Sprout, Flag, Swords, Gavel, Heart, Building2, Target, BarChart3, ArrowLeftRight } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { ManagerAvatar } from "@/components/manager-avatar"
import { allTeams, getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { competitionsByLeague } from "@/lib/international-competitions"
import { agrupar, buscar, ROTULO_DO_TIPO, type ItemBuscavel } from "@/lib/busca-global"
import { podeSalvarCarreira, useGameState } from "@/lib/save-system"
import { useManagingNational } from "@/lib/time-da-carreira"
import { salvarTudo } from "@/lib/salvar-tudo"
import { useGameManager } from "@/lib/use-game-manager"
import { useGameEngine } from "@/lib/game-engine"
import { clearJobOffers } from "@/lib/career-moves"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { getGameDate } from "@/lib/game-date"
import { useTranslation } from "@/lib/i18n"
import { performanceStore } from "@/components/performance-profile"
import { FM26CommandCenter } from "@/components/fm26-command-center"
import { TrocaDeVez } from "@/components/troca-de-vez"
import { PassagemDeVez } from "@/components/passagem-de-vez"
import {
  ehMultitecnico, faltamFechar, iniciarRodada, tecnicosDoSave, type TecnicoDoSave,
} from "@/lib/tecnicos-do-save"

const MONTHS_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

interface GameHeaderProps {
  team?: Team
  showNav?: boolean
  className?: string
}

// Trilha de navegacao (estilo EA FC Manager): [w] SecaoPai > PaginaAtual
// Mapeia o inicio da rota para { secao pai, href do pai, titulo da pagina }
interface RouteMeta {
  parent: string
  parentHref: string
  title: string
}
const ROUTE_META: { prefix: string; meta: RouteMeta }[] = [
  { prefix: "/central", meta: { parent: "Inicio", parentHref: "/", title: "Central" } },
  { prefix: "/notificacoes", meta: { parent: "Caixa de entrada", parentHref: "/mensagens", title: "Notificacoes" } },
  { prefix: "/mensagens", meta: { parent: "Caixa de entrada", parentHref: "/mensagens", title: "Mensagens" } },
  { prefix: "/elenco/gerenciamento", meta: { parent: "Elenco", parentHref: "/elenco", title: "Gerenciamento" } },
  { prefix: "/elenco/taticas", meta: { parent: "Elenco", parentHref: "/elenco", title: "Taticas" } },
  { prefix: "/elenco/escalacoes", meta: { parent: "Elenco", parentHref: "/elenco", title: "Escalacoes" } },
  { prefix: "/elenco", meta: { parent: "Elenco", parentHref: "/elenco", title: "Visao Geral" } },
  { prefix: "/taticas", meta: { parent: "Elenco", parentHref: "/elenco", title: "Taticas" } },
  { prefix: "/vestiario", meta: { parent: "Elenco", parentHref: "/elenco", title: "Vestiario" } },
  { prefix: "/adversarios", meta: { parent: "Elenco", parentHref: "/elenco", title: "Adversarios" } },
  { prefix: "/transferencias", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Visao Geral" } },
  { prefix: "/transferroom", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "TransferRoom" } },
  { prefix: "/mercado", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Buscar Atletas" } },
  { prefix: "/olheiros", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Olheiros" } },
  { prefix: "/relatorios", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Relatorios" } },
  { prefix: "/contratos", meta: { parent: "Transferencias", parentHref: "/transferencias", title: "Contratos" } },
  { prefix: "/treinamento", meta: { parent: "Academia", parentHref: "/treinamento", title: "Treinamento" } },
  { prefix: "/gestao-avancada", meta: { parent: "Treinador", parentHref: "/treinador", title: "Gestao Avancada" } },
  { prefix: "/financas", meta: { parent: "Escritorio", parentHref: "/financas", title: "Financas" } },
  { prefix: "/estatisticas", meta: { parent: "Escritorio", parentHref: "/financas", title: "Estatisticas: Atletas" } },
  { prefix: "/competicoes", meta: { parent: "Escritorio", parentHref: "/financas", title: "Competicoes" } },
  { prefix: "/calendario", meta: { parent: "Escritorio", parentHref: "/financas", title: "Calendario" } },
  { prefix: "/historico", meta: { parent: "Escritorio", parentHref: "/financas", title: "Historico" } },
  { prefix: "/reunioes", meta: { parent: "Escritorio", parentHref: "/financas", title: "Reunioes" } },
  { prefix: "/imprensa", meta: { parent: "Escritorio", parentHref: "/financas", title: "Imprensa" } },
  { prefix: "/infraestrutura", meta: { parent: "Escritorio", parentHref: "/financas", title: "Infraestrutura" } },
  { prefix: "/analise-partida", meta: { parent: "Escritorio", parentHref: "/financas", title: "Analise da Partida" } },
  { prefix: "/performance", meta: { parent: "Escritorio", parentHref: "/financas", title: "Performance Center" } },
  { prefix: "/selecao/calendario", meta: { parent: "Selecao", parentHref: "/selecao", title: "Calendario da selecao" } },
  { prefix: "/configuracoes", meta: { parent: "Personalizar", parentHref: "/configuracoes", title: "Configuracoes" } },
  { prefix: "/salvar", meta: { parent: "Personalizar", parentHref: "/configuracoes", title: "Salvar" } },
]
function getRouteMeta(pathname: string): RouteMeta {
  const found = ROUTE_META.find((r) => pathname.startsWith(r.prefix))
  return found?.meta || { parent: "Inicio", parentHref: "/", title: "Escritorio" }
}

// Pequeno "key chip" de teclado
function KeyCap({ label, className }: { label: string; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] px-1",
        "border border-white/20 bg-white/[0.06] font-mono text-[9px] font-semibold text-white/70",
        className,
      )}
    >
      {label}
    </kbd>
  )
}

// Barra de "forma" (ultimos resultados) estilo EA FC
function FormBars({ results }: { results: ("V" | "E" | "D")[] }) {
  const color = (r: string) =>
    r === "V" ? "bg-[var(--brand)]" : r === "E" ? "bg-white/35" : "bg-red-500/70"
  return (
    <div className="hidden md:flex items-center gap-[3px]">
      {results.map((r, i) => (
        <span key={i} className={cn("h-3.5 w-[3px] rounded-full", color(r))} />
      ))}
    </div>
  )
}

export function GameHeader({ team, showNav = true, className }: GameHeaderProps) {
  const t = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { state, setState } = useGameState()
  const {
    advanceWeek: advanceGameWeek, currentWeek, currentSeason, seasonCalendar,
    fecharDecisoesEPassarAVez, trocarTecnicoAtivo,
  } = useGameManager()
  const userTeam = team || getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const routeMeta = getRouteMeta(pathname)
  // Dirigindo uma selecao o menu perde os itens de clube (mercado, financas,
  // juniores...) e recebe os da selecao. Ver buildNavMenuItems.
  const { isNational: emModoSelecao } = useManagingNational()
  const navMenuItems = useMemo(() => buildNavMenuItems(emModoSelecao), [emModoSelecao])


  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  // Data "correndo" durante o avanco (animacao dia a dia)
  const [advanceDate, setAdvanceDate] = useState<Date | null>(null)
  const [showCoachDropdown, setShowCoachDropdown] = useState(false)
  const [showNavMenu, setShowNavMenu] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)

  // ── CO-OP LOCAL: a mesa e a vez ──────────────────────────────────────────
  //
  // Tudo isto e inerte numa carreira de um tecnico so: `tecnicosDoSave` devolve
  // uma lista de um, `ehMultitecnico` da falso e nada aparece na tela.
  const tecnicosDaMesa = useMemo(
    () => tecnicosDoSave(state.tecnicos, state.managerName, state.selectedTeamShort),
    [state.tecnicos, state.managerName, state.selectedTeamShort],
  )
  const euNaMesa = useMemo(() => {
    const meuId = state.tecnicoAtivoId ?? tecnicosDaMesa[0]?.id
    return tecnicosDaMesa.find(t => t.id === meuId) ?? null
  }, [tecnicosDaMesa, state.tecnicoAtivoId])
  const euJaFechei = Boolean(
    euNaMesa && (state.rodadaCompartilhada?.prontos ?? []).includes(euNaMesa.id),
  )
  const faltamNaMesa = useMemo(
    () => faltamFechar(state.rodadaCompartilhada ?? iniciarRodada(state.week), tecnicosDaMesa),
    [state.rodadaCompartilhada, state.week, tecnicosDaMesa],
  )
  /**
   * O "Avancar" vira "Passar a vez"?
   *
   * So quando falta MAIS ALGUEM alem de mim. Se eu sou o ultimo, clicar avanca a
   * rodada de verdade — e prometer "passar a vez" ali seria mentira.
   */
  const passarAVezEmVezDeAvancar = ehMultitecnico(tecnicosDaMesa)
    && !euJaFechei
    && faltamNaMesa.some(t => t.id !== euNaMesa?.id)
  const [passagem, setPassagem] = useState<{
    para: TecnicoDoSave
    de: TecnicoDoSave | null
    novaRodada: boolean
    /** Rota a abrir DEPOIS da confirmacao, quando houver. */
    irPara?: string | null
  } | null>(null)

  // ── BUSCA GLOBAL, dentro deste mesmo menu ────────────────────────────────
  //
  // Nao existe tela de busca, e e de proposito: o menu da tecla W JA e o lugar
  // onde se procura para onde ir. Com o campo vazio ele continua identico ao que
  // sempre foi; digitando, a lista troca as telas por resultados de quatro tipos.
  // Uma rota `/busca` obrigaria a NAVEGAR ATE A BUSCA para poder navegar.
  const [termoBusca, setTermoBusca] = useState("")
  // Assina a REFERENCIA do elenco, nao cada atleta: o cabecalho e desenhado em
  // toda tela e nao pode redesenhar a cada ponto de moral que muda.
  const squadParaBusca = useGameEngine(s => s.squadPlayers)

  // ⚠️ O catalogo so e montado com o menu ABERTO e com termo digitado. Este
  // componente e desenhado em TODA tela: montar 1.350 clubes a cada render seria
  // repetir a causa da lentidao que a 1.0.292 corrigiu.
  const catalogoBusca = useMemo<ItemBuscavel[]>(() => {
    if (!showNavMenu || termoBusca.trim().length < 2) return []
    const itens: ItemBuscavel[] = navMenuItems.map(item => ({
      tipo: "tela" as const, titulo: item.label, detalhe: item.secao, href: item.href,
    }))
    for (const time of allTeams) {
      itens.push({
        tipo: "clube", titulo: time.nome, detalhe: (time as { pais?: string }).pais || time.divisao,
        href: `/adversarios?clube=${encodeURIComponent(time.curto)}`,
        sinonimos: [time.curto, time.file_key],
      })
    }
    // Atletas: o elenco do usuario. O pool de 66 mil vive num pedaco carregado
    // sob demanda e puxa-lo aqui devolveria o peso ao cabecalho.
    for (const atleta of squadParaBusca) {
      itens.push({
        tipo: "atleta", titulo: atleta.name, detalhe: atleta.position,
        href: `/elenco/gerenciamento?atleta=${atleta.id}`,
      })
    }
    for (const [divisao, competicoes] of Object.entries(competitionsByLeague)) {
      for (const c of competicoes) {
        itens.push({ tipo: "competicao", titulo: c.name, detalhe: divisao, href: "/competicoes" })
      }
    }
    return itens
  }, [showNavMenu, termoBusca, navMenuItems, squadParaBusca])

  const resultadosBusca = useMemo(
    () => buscar(catalogoBusca, termoBusca),
    [catalogoBusca, termoBusca],
  )
  const buscando = termoBusca.trim().length >= 2

  /**
   * Pedir demissão: sai do CLUBE e volta ao menu.
   *
   * ⚠️ ESTE BOTÃO VIVE NO CABEÇALHO, logo aparece em TODA tela — inclusive nas
   * do modo seleção. Ele demitia do clube sem olhar o contexto: quem estava
   * comandando a seleção e clicava aqui achando que largava a SELEÇÃO perdia o
   * emprego no clube. Era o relato "pedi demissão da seleção e ele pediu
   * demissão do time junto".
   *
   * No modo seleção o botão não aparece mais (ver `podePedirDemissao` abaixo):
   * largar a seleção tem tela própria, em /selecao, onde a ação está descrita
   * pelo nome certo e o contrato é encerrado junto.
   */
  const handleResign = () => {
    if (emModoSelecao) return
    clearJobOffers()
    setState({ selectedTeamShort: null })
    // Sem clube leva a Area do Treinador, onde as propostas por reputacao
    // aparecem e o tecnico assume um novo clube.
    hardNavigate("/treinador")
  }
  // Item destacado no menu de navegacao — so existe para o CONTROLE (no mouse o hover
  // ja resolve). Sem isto, o menu que criei nao era utilizavel no gamepad.
  const [navMenuIndex, setNavMenuIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  /**
   * AQUECIMENTO DE ROTAS — e por que ele depende do computador.
   *
   * No export estático a página só é baixada na primeira visita, então aquecer
   * as mais usadas tira o engasgo da primeira navegação. Isso é bom numa máquina
   * folgada e é ruim numa apertada: medindo com browser de verdade (13/08/2026),
   * as telas pintavam em ~200 ms e continuavam trabalhando por até 6 s — o
   * aquecimento baixa e COMPILA o JavaScript de outras cinco páginas enquanto a
   * pessoa ainda está lendo esta. Compilar JS é trabalho de CPU na mesma thread
   * que desenha a tela.
   *
   * Por isso agora ele segue o perfil de desempenho, que é a resposta que o
   * próprio jogo já tem para "que computador é este":
   *   - econômico  → não aquece nada (a primeira navegação custa um pouco mais,
   *                  e todas as outras deixam de disputar CPU);
   *   - equilibrado→ aquece as duas rotas mais visitadas;
   *   - qualidade  → aquece as cinco, como antes.
   *
   * ⚠️ O `requestIdleCallback` é o ponto: sem ele o aquecimento acontece no meio
   * do trabalho de renderização, que é justamente o que se quer evitar.
   */
  const perfilDesempenho = useSyncExternalStore(
    performanceStore.subscribe,
    performanceStore.getSnapshot,
    performanceStore.getServerSnapshot,
  )
  useEffect(() => {
    const rotas = perfilDesempenho === "economy" ? []
      : perfilDesempenho === "balanced" ? ["/", "/elenco"]
      : ["/", "/elenco", "/mercado", "/calendario", "/competicoes"]
    if (rotas.length === 0) return

    let cancelado = false
    const aquecer = () => {
      if (cancelado) return
      for (const href of rotas) router.prefetch(href)
    }
    // `requestIdleCallback` não existe em toda webview; o timeout é a saída.
    const temOcioso = typeof window.requestIdleCallback === "function"
    const id = temOcioso
      ? window.requestIdleCallback(aquecer, { timeout: 3000 })
      : window.setTimeout(aquecer, 700)
    return () => {
      cancelado = true
      if (temOcioso) window.cancelIdleCallback?.(id as number)
      else window.clearTimeout(id as number)
    }
  }, [router, perfilDesempenho])

  // Atalho "W": abre o MENU de navegacao (o keycap [W] sempre existiu, mas a tecla nao
  // fazia nada). Antes W ia direto para a secao pai; o usuario pediu um menu com as
  // opcoes de todas as paginas.
  useEffect(() => {
    if (!showNav) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowNavMenu(false); return }
      if (e.key.toLowerCase() !== "w" || e.ctrlKey || e.altKey || e.metaKey) return
      const el = document.activeElement as HTMLElement | null
      if (
        el && (
          el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ||
          el.isContentEditable || el.getAttribute("role") === "slider"
        )
      ) return
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      e.preventDefault()
      setShowNavMenu((v) => !v)
    }
    // CONTROLE abre o menu: Y ou START (Options no PS) — o mesmo mapeamento que a
    // tela de Configuracoes ja documentava ("Y = Menu · START = Menu/Pausar"),
    // mas nenhum botao chegava a ABRIR o menu, so a tecla W. Sem input de texto
    // no controle, nao precisa da guarda de campo focado.
    const onPad = (e: Event) => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      const { button } = (e as CustomEvent<{ button: string }>).detail || {}
      if (button === "Y" || button === "START") setShowNavMenu((v) => !v)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("gamepad:button", onPad)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("gamepad:button", onPad)
    }
  }, [showNav])

  // CONTROLE no menu de navegacao: D-pad move, A confirma, B/Y fecha.
  // (O menu foi criado depois do sistema de gamepad, entao nao respondia ao controle.)
  useEffect(() => {
    if (!showNavMenu) return
    const onPad = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      // Buscando, o cursor do controle anda pelos RESULTADOS. Sem isto, `A`
      // abriria a tela do indice N da lista de telas enquanto a tela mostra
      // resultados — ou seja, levaria para outro lugar do que o destacado.
      const lista: { href: string }[] = buscando ? resultadosBusca : navMenuItems
      const last = lista.length - 1
      // O menu e uma grade de 3 colunas (sm:grid-cols-3).
      const COLS = 3
      switch (button) {
        case "DPAD_LEFT":
          setNavMenuIndex((i) => (i <= 0 ? last : i - 1)); break
        case "DPAD_RIGHT":
          setNavMenuIndex((i) => (i >= last ? 0 : i + 1)); break
        case "DPAD_UP":
          setNavMenuIndex((i) => Math.max(0, i - COLS)); break
        case "DPAD_DOWN":
          setNavMenuIndex((i) => Math.min(last, i + COLS)); break
        case "A": {
          const item = lista[navMenuIndex]
          if (item) { setShowNavMenu(false); setTermoBusca(""); hardNavigate(item.href) }
          break
        }
        case "B":
        case "Y":
          setShowNavMenu(false); break
      }
    }
    window.addEventListener("gamepad:button", onPad)
    return () => window.removeEventListener("gamepad:button", onPad)
  }, [showNavMenu, navMenuIndex, navMenuItems, buscando, resultadosBusca])

  // O termo nao sobrevive ao fechamento: reabrir o menu tem de mostrar o menu,
  // nao a ultima busca de meia hora atras.
  useEffect(() => {
    if (!showNavMenu) setTermoBusca("")
  }, [showNavMenu])

  // Ao abrir o menu, comeca no item da secao atual (nao sempre no primeiro).
  useEffect(() => {
    if (!showNavMenu) return
    const current = navMenuItems.findIndex(
      (item) => item.href !== "/" && pathname.startsWith(item.href),
    )
    setNavMenuIndex(current >= 0 ? current : 0)
  }, [showNavMenu, pathname, navMenuItems])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCoachDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Estatisticas REAIS da temporada, derivadas das partidas ja jogadas do usuario
  // no calendario (antes eram valores fixos: 24 jogos / 16V / 5E / 3D / +5V).
  const { coachData, form } = useMemo(() => {
    const userCurto = userTeam.curto
    const jogadas = (seasonCalendar?.fixtures ?? []).filter(
      f => f.isUserMatch && f.played && f.homeScore !== undefined && f.awayScore !== undefined,
    )

    const resultados: ("V" | "E" | "D")[] = jogadas.map(f => {
      const isHome = f.homeTeam.curto === userCurto
      const pro = (isHome ? f.homeScore : f.awayScore) as number
      const contra = (isHome ? f.awayScore : f.homeScore) as number
      return pro > contra ? "V" : pro === contra ? "E" : "D"
    })

    const vitorias = resultados.filter(r => r === "V").length
    const empates = resultados.filter(r => r === "E").length
    const derrotas = resultados.filter(r => r === "D").length
    const partidasTotal = resultados.length
    const aproveitamento =
      partidasTotal > 0 ? Math.round(((vitorias * 3 + empates) / (partidasTotal * 3)) * 100) : 0

    // Sequencia atual: quantos resultados iguais seguidos a partir do ultimo jogo.
    let sequencia = "-"
    if (resultados.length > 0) {
      const invertido = [...resultados].reverse()
      const tipo = invertido[0]
      let n = 0
      for (const r of invertido) {
        if (r !== tipo) break
        n++
      }
      sequencia = tipo === "V" ? `+${n}V` : tipo === "D" ? `-${n}D` : `${n}E`
    }

    const titulosTemporada = (state.seasonHistory ?? []).filter(
      s => s.season === currentSeason && s.champion === userTeam.nome,
    ).length

    return {
      coachData: {
        nome: state.managerName || "Voce",
        cargo: "Tecnico Principal",
        partidasTotal,
        vitorias,
        empates,
        derrotas,
        aproveitamento,
        titulosTemporada,
        sequencia,
      },
      form: resultados.slice(-5),
    }
  }, [seasonCalendar, userTeam.curto, userTeam.nome, state.managerName, state.seasonHistory, currentSeason])

  // O jogo e organizado por temporada (comecando 01/01) e nao por "rodada" isolada —
  // mostra a data corrente do calendario em vez de um contador de rodadas.
  // Durante o avanco mostra a data da animacao (dia a dia); fora dele, a data real.
  const gameDate = advanceDate ?? getGameDate(currentSeason, currentWeek)
  const gameDateLabel = `${gameDate.getDate().toString().padStart(2, "0")} ${MONTHS_SHORT[gameDate.getMonth()]}`

  /**
   * TEMPORADA QUE ATRAVESSA O ANO — "2026/27".
   *
   * ⚠️ A temporada ocupa MAIS SEMANAS DO QUE UM ANO TEM. `getGameDate` faz
   * `01/01 do ano + (semana-1)*7`, entao a partir da semana 54 a data passa para
   * o ano seguinte: semana 57 = 28/jan/2027, semana 58 = 04/fev/2027 (conferido
   * na aritmetica). O rotulo continuava cravado em "Temporada 2026", e a tela
   * mostrava "Temporada 2026 | 04 FEV" — incoerente, e foi o que fez parecer que
   * uma temporada NOVA tinha comecado em fevereiro.
   *
   * Aqui o rotulo passa a dizer a verdade: enquanto a data estiver dentro do ano
   * da temporada mostra "2026"; quando atravessa, mostra "2026/27". Isto e
   * apresentacao — nao muda o calendario nem o motor.
   */
  const anoDaData = gameDate.getFullYear()
  const temporadaLabel = anoDaData > currentSeason
    ? `${currentSeason}/${String(anoDaData).slice(-2)}`
    : String(currentSeason)

  const handleSave = async () => {
    // Sem carreira iniciada no pre-office nao ha o que salvar (salvarTudo checa
    // de novo, lendo o disco — aqui e so para nao acender o "salvando").
    if (!podeSalvarCarreira(state)) return
    setSaving(true)
    // TUDO: motor (elenco/contratos/emprestimos/caixa), save da carreira e as
    // demais chaves. E o merge e feito sobre o DISCO, nao sobre o `state` deste
    // componente — ver lib/salvar-tudo.ts.
    const resultado = await salvarTudo()
    setSaving(false)
    if (!resultado.ok) return
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // VOCE tem partida para disputar nesta semana?
  //
  // Isto existe porque "avancar" passava POR CIMA do proprio jogo do usuario.
  // O motor avanca para `currentWeek + 1` e trata como ATRASADA toda partida sua
  // nao disputada com `week < newWeek` (lib/fixture-catchup.ts) — o que inclui a
  // da semana corrente. Um clique aqui em vez de "jogar" e o motor simulava a
  // sua partida, com placar, lesao e estatisticas, e o jogador so descobria pelo
  // calendario ("veio outra partida com outro time"). A regra do motor esta certa
  // para o que ficou mesmo para tras; quem nao podia avancar era este botao.
  const partidaPendenteAgora =
    seasonCalendar.nextUserMatch != null && seasonCalendar.nextUserMatch.week <= currentWeek

  // Avanca com animacao DIA A DIA (imersao) em vez de pular a semana de uma vez.
  // O engine continua avancando por semana: a data corre os 7 dias e so entao a
  // rodada e simulada.
  const handleAdvance = async () => {
    if (advancing) return

    // Com jogo pendente o botao LEVA A PARTIDA em vez de avancar o relogio.
    if (partidaPendenteAgora) {
      hardNavigate("/partida")
      return
    }

    // ── CO-OP: FECHAR E PASSAR A VEZ E O PROPRIO "AVANCAR" ──────────────────
    //
    // ⚠️ ANTES ISTO EXIGIA ACHAR UM MENU. O jogador clicava "Avancar", recebia
    // "fulano ainda nao fechou as decisoes" e ficava sem saida visivel — a acao
    // que destravava a rodada morava dentro de um dropdown que nada indicava.
    // Um modo em que o botao principal so sabe dizer "nao" nao esta pronto.
    //
    // Agora "Avancar" significa a mesma coisa que sempre significou: EU ACABEI.
    // Numa mesa de um tecnico so, avanca a semana. Numa mesa de varios, fecha as
    // minhas decisoes e entrega o computador para o proximo; quando o ultimo
    // fecha, a rodada roda sozinha na sequencia, sem ninguem clicar de novo.
    if (ehMultitecnico(tecnicosDaMesa) && !euJaFechei) {
      const r = fecharDecisoesEPassarAVez()
      if (!r.todosFecharam && r.proximo) {
        setPassagem({ para: r.proximo, de: euNaMesa, novaRodada: false })
        return
      }
      // Todos fecharam: segue direto para o avanco, sem passo intermediario.
    }

    setAdvancing(true)

    // A data corre os 7 dias antes de a rodada ser simulada. Eram 95ms por dia =
    // 665ms de espera PURA em cada avanco de semana — a acao mais repetida do
    // jogo. Em 32ms a data ainda corre visivelmente (dois quadros por dia) e o
    // avanco responde na hora.
    const start = getGameDate(currentSeason, currentWeek)
    for (let d = 1; d <= 7; d++) {
      setAdvanceDate(new Date(start.getTime() + d * 86_400_000))
      await new Promise(resolve => setTimeout(resolve, 32))
    }

    // O retorno do avanco e a fonte fresca: o `seasonCalendar` deste closure (e o
    // ref por tras dele) ainda e o de ANTES, porque so se recalculam no proximo
    // render. Decidir a navegacao por ele mandava o jogador para /partida ate
    // quando a temporada tinha acabado de fechar.
    const resultado = await advanceGameWeek()
    setAdvanceDate(null)
    setAdvancing(false)

    // A rodada rodou: a vez volta para o primeiro da mesa e a tela de troca
    // aparece de novo. Sem isto o computador ficaria na mao de quem fechou por
    // ultimo, que passaria a jogar a rodada seguinte inteira sozinho — e os
    // outros perderiam a vez sem nada dizer por que.
    if (ehMultitecnico(tecnicosDaMesa)) {
      const primeiro = tecnicosDaMesa[0]
      if (primeiro && primeiro.id !== (state.tecnicoAtivoId ?? tecnicosDaMesa[0]?.id)) {
        trocarTecnicoAtivo(primeiro.id)
      }
      if (primeiro) {
        // A navegacao espera a confirmacao: navegar agora desenharia a tela do
        // proximo tecnico ATRAS da tela de troca, que e o que ela impede.
        setPassagem({
          para: primeiro, de: null, novaRodada: true,
          irPara: resultado?.newSeason ? null : "/partida",
        })
        return
      }
    }

    if (!resultado?.newSeason) {
      hardNavigate("/partida")
    }
  }

  return (
    <header
      className={cn(
        // Transparente como o rodape (pedido): so um leve gradiente do topo para
        // a legibilidade, sem a barra solida #070708 que "cortava" o fundo.
        // TRANSPARENTE como o rodape (pedido): so um gradiente sutil para
        // legibilidade do texto, sem faixa solida nem blur — o cenario do
        // escritorio aparece atras. Mesma formula do ea-action-bar, invertida.
        "sticky top-0 z-30 flex h-16 items-center justify-between pl-3 pr-5",
        "bg-gradient-to-b from-black/35 via-black/10 to-transparent border-b border-white/[0.03]",
        className,
      )}
    >
      {/* Esquerda: emblema circular "mc" + trilha [w] SecaoPai > PaginaAtual */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Logo UF26 */}
        <Link
          href="/"
          aria-label={t.header.home}
          onClick={(e) => { e.preventDefault(); hardNavigate("/") }}
          className="flex h-11 shrink-0 items-center justify-center rounded-lg px-1 transition-opacity hover:opacity-80"
        >
          <Image
            src="/brand/uf26-logo.png"
            alt="UF26"
            width={120}
            height={44}
            className="h-9 w-auto object-contain"
            priority
          />
        </Link>

        {/* Trilha de navegacao */}
        {showNav && (
          <nav className="flex items-end gap-4 min-w-0 overflow-x-auto scrollbar-none">
            {/* [W] abre o MENU de navegacao (paginas do jogo). */}
            <button
              type="button"
              onClick={() => setShowNavMenu((v) => !v)}
              className="group relative flex shrink-0 flex-col items-center gap-1"
            >
              <KeyCap label="W" className="opacity-70" />
              <span className="whitespace-nowrap text-[15px] font-semibold tracking-wide text-white/40 transition-colors group-hover:text-white/70">
                {routeMeta.parent}
              </span>
            </button>

            {/* Pagina atual (bold/branco) */}
            <span className="shrink-0 whitespace-nowrap pb-[2px] text-[17px] font-extrabold tracking-tight text-white">
              {routeMeta.title}
            </span>
          </nav>
        )}
      </div>

      {/* Direita: acoes + widget do clube */}
      <div className="flex items-center gap-3 shrink-0">
        <FM26CommandCenter />
        {/* Info temporada/calendario (data real, nao contador de rodada).
            O chip mostra "09 ABR" por falta de espaco; a data COMPLETA aparece ao
            passar o mouse (pedido) — junto com o dia da semana, que e o que diz
            se hoje e dia de jogo. */}
        <div className="group relative hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <Calendar className="h-3.5 w-3.5 text-[var(--brand)]" />
          <span className="text-[10px] text-white/45 font-medium">Temporada {temporadaLabel}</span>
          <span className="text-white/15">|</span>
          <span className="text-[11px] text-white font-semibold">{gameDateLabel}</span>

          <div className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 hidden min-w-[190px] rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 shadow-xl group-hover:block">
            <p className="text-[11px] font-bold text-white tabular-nums">
              {`${String(gameDate.getDate()).padStart(2, "0")}/${String(gameDate.getMonth() + 1).padStart(2, "0")}/${gameDate.getFullYear()}`}
            </p>
            <p className="mt-0.5 text-[10px] capitalize text-white/50">
              {gameDate.toLocaleDateString("pt-BR", { weekday: "long" })} · semana {currentWeek}
            </p>
          </div>
        </div>

        {/* Salvar */}
        <button
          onClick={handleSave}
          disabled={saving}
          aria-label={t.header.saveGame}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md transition-all",
            saved ? "text-[var(--brand)] bg-[var(--brand)]/10" : "text-white/45 hover:text-white/80 hover:bg-white/5",
            saving && "opacity-50 cursor-wait",
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        </button>

        {/* A VEZ DA MESA (co-op local). Fica COLADO no "Avancar" de proposito: a
            rodada nao anda enquanto todos nao fecharem, e o lugar de descobrir
            isso e ao lado do botao que nao vai funcionar. Em carreira de um
            tecnico so, o componente nao desenha nada. */}
        <TrocaDeVez />

        {/* Avancar — ou JOGAR, quando a partida da semana ainda e sua para disputar.
            Trocar o rotulo resolve o mal-entendido na raiz: o jogador clicava
            "avancar" achando que ia ATE o dia do jogo, e o jogo passava. */}
        <button
          onClick={handleAdvance}
          disabled={advancing}
          title={
            partidaPendenteAgora
              ? "Voce tem partida nesta semana — ir para o jogo"
              : passarAVezEmVezDeAvancar
                ? `Fechar suas decisoes e passar o computador (${faltamNaMesa.length} ainda nao fecharam)`
                : "Avancar uma semana"
          }
          className={cn(
            "eafc-btn flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-wider uppercase",
            advancing && "opacity-50 cursor-wait",
          )}
        >
          {advancing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : partidaPendenteAgora
              ? <Play className="h-4 w-4 fill-current" />
              : passarAVezEmVezDeAvancar
                ? <Users className="h-4 w-4" />
                : <FastForward className="h-4 w-4" />}
          {/* Numa mesa o botao nao avanca o mundo: ele encerra a MINHA vez. O
              rotulo tem de dizer isso, senao a pessoa clica esperando ver a
              rodada correr e recebe a tela de troca sem entender por que. */}
          <span className="hidden sm:inline">
            {partidaPendenteAgora ? "Jogar" : passarAVezEmVezDeAvancar ? "Passar a vez" : "Avancar"}
          </span>
        </button>

        {/* O sino abria um drawer que sumia a cada navegação e passava
            despercebido — mensagens da diretoria e propostas ficavam sem
            resposta. A Central de Notificações agora é uma TELA do menu [W], e
            o escritório redireciona para ela enquanto houver algo não lido. */}

        <Link
          href="/configuracoes"
          aria-label={t.header.settings}
          onClick={(e) => { e.preventDefault(); hardNavigate("/configuracoes") }}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <Settings className="h-4 w-4" />
        </Link>

        {/* Widget do clube: escudo + forma + estrela (dropdown do tecnico) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowCoachDropdown(!showCoachDropdown)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border border-white/[0.06] py-1 pl-2 pr-2.5 transition-all",
              showCoachDropdown ? "bg-white/10" : "hover:bg-white/5",
            )}
          >
            <TeamCrest team={userTeam} size="sm" />
            <div className="hidden md:flex flex-col items-start leading-none gap-1">
              <span className="text-[12px] font-bold text-white">{userTeam.curto}</span>
              <FormBars results={form} />
            </div>
            <Star className="hidden lg:block h-3.5 w-3.5 text-[#ffd700] fill-[#ffd700]" />
            <ChevronDown className={cn("h-3 w-3 text-white/40 transition-transform", showCoachDropdown && "rotate-180")} />
          </button>

          {/* Dropdown do tecnico */}
          {showCoachDropdown && (
            <div className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#0a0a0c]/98 shadow-2xl overflow-hidden z-50 animate-fade-in backdrop-blur-xl">
              <div className="p-5 border-b border-white/[0.04] bg-gradient-to-r from-[var(--brand)]/10 via-transparent to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand-2)]/10 ring-2 ring-[var(--brand)]/20">
                    <ManagerAvatar
                      src={state.managerAvatar}
                      className="w-14 h-14"
                      iconClassName="h-7 w-7 text-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{coachData.nome}</div>
                    <div className="text-[10px] text-[var(--brand)]/70 uppercase tracking-wider font-medium">{coachData.cargo}</div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-[#ffd700]" />
                  Estatisticas da Temporada
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                    <div className="text-lg font-bold text-white">{coachData.partidasTotal}</div>
                    <div className="text-[9px] text-white/40 uppercase">{t.header.matches}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[var(--brand)]/10 border border-[var(--brand)]/20">
                    <div className="text-lg font-bold text-[var(--brand)]">{coachData.vitorias}</div>
                    <div className="text-[9px] text-white/40 uppercase">V</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/20">
                    <div className="text-lg font-bold text-yellow-400">{coachData.empates}</div>
                    <div className="text-[9px] text-white/40 uppercase">E</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-lg font-bold text-red-400">{coachData.derrotas}</div>
                    <div className="text-[9px] text-white/40 uppercase">D</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[var(--brand)]" />
                    <span className="text-xs text-white/60">{t.header.winRate}</span>
                  </div>
                  <span className="text-sm font-bold text-[var(--brand)]">{coachData.aproveitamento}%</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/40" />
                    <span className="text-xs text-white/60">{t.header.streak}</span>
                  </div>
                  <span className="text-sm font-bold text-[var(--brand)]">{coachData.sequencia}</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-white/60">{t.header.titlesInSeason}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{coachData.titulosTemporada}</span>
                </div>
              </div>

              <div className="p-4 border-t border-white/[0.04] bg-white/[0.01] space-y-1">
                <Link
                  href="/configuracoes"
                  onClick={(e) => { e.preventDefault(); setShowCoachDropdown(false); hardNavigate("/configuracoes") }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-[var(--brand)] hover:text-[#00ffdc] transition-colors rounded-lg hover:bg-[var(--brand)]/10"
                >
                  Ver perfil completo
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>

                {/* Sair para a selecao de saves. Antes, do escritorio, o jogador ficava
                    "preso" — nao havia como trocar de save de proposito. O progresso ja e
                    salvo automaticamente (persistent-store), entao sair e seguro. */}
                <button
                  type="button"
                  onClick={() => { setShowCoachDropdown(false); hardNavigate("/splash?menu=1") }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair para o Menu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu de navegacao (tecla W ou clique na secao pai). */}
      {showNavMenu && (
        <div
          className="fixed inset-0 z-[70] bg-black/25"
          onClick={() => setShowNavMenu(false)}
        >
          <div
          // Vidro fosco (pedido): 90% transparente — fundo com so 10% de opacidade
          // — e um desfoque LEVE do cenario atras. O jogo aparece por tras do menu,
          // mas o borrao sutil segura a legibilidade dos itens.
          // OBS: no modo economico o CSS remove backdrop-blur (poupa GPU fraca);
          // sobra o preto a 10%, que continua funcionando. Ver performance-profile.
          className="absolute left-5 top-16 flex max-h-[calc(100vh-4rem)] w-[min(292px,88vw)] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black/10 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* CAMPO DE BUSCA. Fica no topo do menu que ja existia; vazio, nada
                muda. `autoFocus` porque quem abre com a tecla W ja esta com a
                mao no teclado — mas o menu segue utilizavel so com o controle,
                que continua andando pela lista por indice. */}
            <div className="border-b border-white/[0.06] px-3 pb-2 pt-3">
              <input
                type="search"
                value={termoBusca}
                autoFocus
                onChange={(e) => { setTermoBusca(e.target.value); setNavMenuIndex(0) }}
                placeholder="Buscar tela, clube, atleta ou competição"
                aria-label="Buscar no jogo"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--brand)]/60 focus:outline-none"
              />
              {buscando && (
                <p className="px-1 pt-1.5 text-[10px] uppercase tracking-wider text-white/30">
                  {resultadosBusca.length === 0
                    ? "nada encontrado"
                    : `${resultadosBusca.length} resultado${resultadosBusca.length > 1 ? "s" : ""}`}
                </p>
              )}
            </div>

            {buscando ? (
              <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
                {agrupar(resultadosBusca).map((grupo) => (
                  <Fragment key={grupo.tipo}>
                    <p className="px-3 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                      {ROTULO_DO_TIPO[grupo.tipo]}
                    </p>
                    {grupo.itens.map((r) => {
                      const i = resultadosBusca.indexOf(r)
                      const focused = i === navMenuIndex
                      return (
                        <button
                          key={`${r.tipo}-${r.href}-${r.titulo}`}
                          onClick={() => { setShowNavMenu(false); setTermoBusca(""); hardNavigate(r.href) }}
                          onMouseEnter={() => setNavMenuIndex(i)}
                          className={cn(
                            "relative flex w-full items-center justify-between gap-3 border-l-2 px-3 py-2.5 text-left transition-all",
                            focused
                              ? "border-l-[var(--brand)] bg-gradient-to-r from-[var(--brand)]/16 to-transparent"
                              : "border-l-transparent hover:border-l-white/25 hover:bg-white/[0.035]",
                          )}
                        >
                          <span className={cn("truncate text-sm font-semibold", focused ? "text-white" : "text-white/60")}>
                            {r.titulo}
                          </span>
                          {r.detalhe && (
                            <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/30">{r.detalhe}</span>
                          )}
                        </button>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            ) : (
            <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
              {navMenuItems.map((item, i) => {
                const Icon = item.icon
                // Cabecalho aparece no PRIMEIRO item de cada secao. Ele e irmao
                // do botao (Fragment), nunca um item da lista: o cursor do
                // controle anda por indice e pararia num titulo inerte.
                const abreSecao = i === 0 || navMenuItems[i - 1].secao !== item.secao
                // Compara só o CAMINHO: item com `?aba=` no href nunca acenderia
                // se a comparação fosse pela URL inteira.
                const caminho = item.href.split("?")[0]
                const active = pathname.startsWith(caminho) && caminho !== "/"
                // Item sob o cursor do CONTROLE (no mouse, o hover ja indica).
                const focused = i === navMenuIndex
                return (
                  <Fragment key={item.href}>
                  {abreSecao && (
                    <p className="px-3 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                      {item.secao}
                    </p>
                  )}
                  <button
                    onClick={() => { setShowNavMenu(false); hardNavigate(item.href) }}
                    onMouseEnter={() => setNavMenuIndex(i)}
                    className={cn(
                      "relative flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-all",
                      focused
                        ? "border-l-[var(--brand)] bg-gradient-to-r from-[var(--brand)]/16 to-transparent"
                        : active
                          ? "border-l-[var(--brand)]/60 bg-white/[0.05]"
                          : "border-l-transparent hover:border-l-white/25 hover:bg-white/[0.035]",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", focused || active ? "text-[var(--brand)]" : "text-white/50")} />
                    <span className={cn("text-sm font-semibold", focused || active ? "text-white" : "text-white/55")}>{item.label}</span>
                  </button>
                  </Fragment>
                )
              })}
            </div>
            )}

            {/* Pedir demissao — acao destrutiva, separada da grade de navegacao.
                SOME no modo selecao: ali este botao demitia do CLUBE, e quem
                clicava achando que largava a selecao perdia o emprego no time.
                Largar a selecao tem tela propria, em /selecao. */}
            {!emModoSelecao && (
              <div className="border-t border-white/[0.06] p-3">
                <button
                  type="button"
                  onClick={() => { setShowNavMenu(false); setShowResignConfirm(true) }}
                  className="flex w-full items-center gap-3 border-l-2 border-l-red-400/60 bg-red-500/5 px-3 py-2.5 text-sm font-semibold text-red-300/90 transition-colors hover:bg-red-500/10 hover:text-red-200"
                >
                  <LogOut className="h-4 w-4" />
                  Pedir demissao
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmacao da demissao: irreversivel, exige confirmar (teclado Enter/Esc, controle A/B). */}
      {showResignConfirm && (
        <ResignConfirmDialog
          teamName={userTeam.nome}
          onCancel={() => setShowResignConfirm(false)}
          onConfirm={handleResign}
        />
      )}

      {/* A TROCA DE MAOS. Fica no cabecalho porque o cabecalho esta em toda tela
          — a vez pode virar de qualquer lugar do jogo, nao so do escritorio. */}
      {passagem && (
        <PassagemDeVez
          para={passagem.para}
          de={passagem.de}
          rodada={state.rodadaCompartilhada?.numero ?? currentWeek}
          fecharam={(state.rodadaCompartilhada?.prontos ?? []).length}
          total={tecnicosDaMesa.filter(t => t.tipo === "humano").length}
          novaRodada={passagem.novaRodada}
          onConfirmar={() => {
            const destino = passagem.irPara
            setPassagem(null)
            if (destino) hardNavigate(destino)
          }}
        />
      )}
    </header>
  )
}

// Aviso de demissao. Esc/B cancela, Enter/A confirma (teclado + controle).
function ResignConfirmDialog({ teamName, onCancel, onConfirm }: { teamName: string; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onCancel() }
      else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); onConfirm() }
    }
    const onPad = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      if (button === "A") onConfirm()
      else if (button === "B") onCancel()
    }
    document.addEventListener("keydown", onKey, true)
    window.addEventListener("gamepad:button", onPad)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      window.removeEventListener("gamepad:button", onPad)
    }
  }, [onCancel, onConfirm])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-[400px] max-w-[90vw] rounded-2xl border border-white/10 bg-[#0c0c14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Pedir demissao do {teamName}?</h2>
        <p className="mt-2 text-sm text-white/60">
          Voce encerra seu ciclo no clube e volta ao menu principal. O progresso e salvo
          automaticamente. Esta acao nao pode ser desfeita.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
          >
            Cancelar <span className="text-white/30">(Esc)</span>
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
          >
            Confirmar demissao <span className="text-white/50">(Enter)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// Paginas do menu de navegacao rapida (tecla W).
//
// `clubOnly` marca o que SO existe dirigindo um clube. Comandando uma selecao
// (managingNationalTeamId setado) nao ha mercado, caixa nem categoria de base
// para gerir — esses itens levavam a telas que ou redirecionam ou mostram os
// dados do clube que ficou por baixo. Em vez de esconder na mao em cada tela,
// o menu deixa de oferece-los e ganha os itens da SELECAO.
/**
 * `secao` agrupa VISUALMENTE sem quebrar a navegacao.
 *
 * O menu tinha 15 itens de clube numa lista corrida, e o jogador lia todos toda
 * vez para achar um. Os cabecalhos NAO entram no array: ele continua plano
 * porque o controle e o teclado andam por INDICE (`navMenuIndex`) — meter
 * separador aqui faria a seta parar em cima de um titulo que nao abre nada.
 * O cabecalho e desenhado quando a secao muda de um item para o outro.
 */
type NavMenuItem = {
  label: string; href: string; icon: typeof Save; clubOnly?: boolean; secao: string
}

const NAV_MENU_ITEMS: NavMenuItem[] = [
  { secao: "Clube", label: "Escritorio", href: "/", icon: Trophy },
  { secao: "Clube", label: "Central do Clube", href: "/central", icon: Heart, clubOnly: true },
  { secao: "Clube", label: "Financas", href: "/financas", icon: TrendingUp, clubOnly: true },
  // INFRAESTRUTURA ganhou entrada PROPRIA (pedido antigo): existia so dentro de
  // Configuracoes, e quem quer mexer em bilheteria ou obra do estadio nao
  // procura isso em "configuracoes do jogo".
  { secao: "Clube", label: "Infraestrutura", href: "/infraestrutura", icon: Building2, clubOnly: true },

  { secao: "Elenco", label: "Elenco", href: "/elenco", icon: User, clubOnly: true },
  { secao: "Elenco", label: "Treinamento", href: "/treinamento", icon: User, clubOnly: true },
  { secao: "Elenco", label: "Juniores", href: "/base", icon: Sprout, clubOnly: true },
  // MERCADO absorve o TransferRoom: os dois sao a mesma tarefa (negociar
  // atleta), e o TransferRoom ja e alcancado de dentro do Mercado. Duas linhas
  // no menu para a mesma decisao so faziam o tecnico escolher por qual porta
  // entrar antes de escolher o que fazer.
  { secao: "Elenco", label: "Mercado", href: "/mercado", icon: TrendingUp, clubOnly: true },
  // Performance Center e a unica porta para as "Fases do jogo", o planejamento
  // plurianual e o Data Hub. Tirar do menu deixaria as quatro abas sem entrada
  // nenhuma — nenhuma outra tela linka para ca.
  { secao: "Elenco", label: "Performance Center", href: "/performance", icon: Heart, clubOnly: true },
  // ⚠️ TATICAS E LEILOES SAIRAM DO MENU (pedido).
  //
  // Taticas: a prancheta pertence ao PRE-JOGO. Alcancavel pelo menu a qualquer
  // momento, ela virava atalho para abrir o elenco no meio de outra tela — e
  // no pre-jogo levava o tecnico para FORA da partida, o que dava margem a
  // mexer no time depois de ver coisa que nao deveria. Agora ela abre dentro do
  // proprio pre-jogo (ver components/match/ajustes-finais).
  // Leiloes: a tela continua existindo e e alcancada pelo pos-partida e pelo
  // Mercado; o que sai e a entrada do menu.
  { secao: "Competicao", label: "Calendario", href: "/calendario", icon: Calendar, clubOnly: true },
  // Competicoes e Classificacao apontavam para a MESMA rota — eram duas
  // entradas para a mesma tela. Viraram uma so.
  { secao: "Competicao", label: "Competicoes e Classificacao", href: "/competicoes", icon: Trophy, clubOnly: true },

  { secao: "Voce", label: "Area do Treinador", href: "/treinador", icon: User },
  // DESAFIOS. A tela existia desde a fase 3 e NENHUM menu linkava para ela: o
  // modo inteiro era inalcancavel dentro do jogo. Fica em "Voce" porque o
  // desafio e do TECNICO — ele atravessa clube e temporada.
  { secao: "Voce", label: "Desafios", href: "/desafios", icon: Trophy, clubOnly: true },
  // ⚠️ GESTAO E RANKINGS SAO DUAS COISAS, e voltaram a ser duas entradas.
  //
  // Elas foram fundidas num item so ("Gestao e rankings") porque os rankings
  // eram uma ABA da Central de Gestao e ninguem os achava. Mas um rotulo que
  // precisa explicar onde a coisa esta e sintoma de ela estar no lugar errado:
  // gestao e o que o tecnico DECIDE (bolas paradas, metas, comissao,
  // disciplina); ranking e o que ele CONSULTA. Juntas, ver uma tabela custava
  // atravessar onze abas de decisao.
  { secao: "Voce", label: "Gestao", href: "/gestao-avancada", icon: Target },
  { secao: "Voce", label: "Rankings", href: "/rankings", icon: BarChart3 },
  // CAIXA DE ENTRADA sai do menu porque ela ja tem porta PROPRIA e melhor: o
  // sino do cabecalho, que ainda mostra quantas mensagens ha por ler. Ninguem
  // abre o menu para ver recado quando o contador esta piscando ao lado.
  // (As telas /mensagens e /notificacoes continuam existindo e ligadas entre si.)
  { secao: "Voce", label: "Configuracoes", href: "/configuracoes", icon: Settings },
]

// Itens que substituem os de clube no modo selecao (entram antes de Configuracoes).
const NAV_MENU_NATIONAL_ITEMS: NavMenuItem[] = [
  // O calendario vem PRIMEIRO de proposito: dirigindo uma selecao, "quando e o
  // meu proximo jogo" e a pergunta que se faz antes de qualquer outra — e era a
  // unica que o modo nao respondia.
  { secao: "Selecao", label: "Calendario da selecao", href: "/selecao/calendario", icon: Calendar },
  { secao: "Selecao", label: "Convocacao", href: "/selecao/convocacao", icon: User },
  { secao: "Selecao", label: "Competicoes da selecao", href: "/selecao/competicoes", icon: Trophy },
  { secao: "Selecao", label: "Amistosos de preparacao", href: "/selecao/amistosos", icon: Swords },
  { secao: "Selecao", label: "Contrato e gestao", href: "/selecao", icon: Flag },
]

function buildNavMenuItems(isNational: boolean): NavMenuItem[] {
  if (!isNational) return NAV_MENU_ITEMS
  const comuns = NAV_MENU_ITEMS.filter(i => !i.clubOnly)
  const ultimo = comuns.pop()! // Configuracoes fica no fim
  return [...comuns, ...NAV_MENU_NATIONAL_ITEMS, ultimo]
}
