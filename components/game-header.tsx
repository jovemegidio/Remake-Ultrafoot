"use client"

import { LinkLeve as Link } from "@/components/link-leve"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Fragment, useState, useRef, useEffect, useMemo, useSyncExternalStore } from "react"
import { Save, FastForward, Play, Settings, Check, Loader2, ChevronDown, User, Users, Trophy, Calendar, TrendingUp, ChevronRight, Star, LogOut, Bell, Sprout, Flag, Swords, Gavel, Heart, Building2, Target, BarChart3, ArrowLeftRight, ShoppingBag, HeartHandshake } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { ManagerAvatar } from "@/components/manager-avatar"
import { allTeams, getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { competitionsByLeague } from "@/lib/international-competitions"
import { agrupar, buscar, ROTULO_DO_TIPO, type ItemBuscavel } from "@/lib/busca-global"
import { podeSalvarCarreira, useGameState } from "@/lib/save-system"
import { useManagingNational, useUserTeam } from "@/lib/time-da-carreira"
import { salvarTudo } from "@/lib/salvar-tudo"
import { DialogoDeSalvar } from "@/components/modals/salvar-carreira"
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
import { modalidadeDoSave } from "@/lib/modalidade-de-carreira"
import { rescindirContrato } from "@/lib/carreira-de-jogador"

/**
 * ⚠️ NÃO IMPORTE `lib/carreira-de-jogador` AQUI (corrigido 1.0.346).
 *
 * Na 1.0.338 este arquivo passou a importar `POSICOES_JOGAVEIS` e
 * `mediaDaTemporada` de lá — duas coisas triviais. Só que aquele módulo arrasta
 * junto o `match-engine`, o `career-engine`, o `players-data` e o
 * `partida-do-atleta`, e o `GameHeader` está em TODA TELA DO JOGO. O resultado
 * foi carregar o motor inteiro da carreira de atleta em telas que não têm nada
 * a ver com ele: lentidão geral, sem um único erro de JavaScript, e por isso
 * invisível para o type-check, o lint e os portões.
 *
 * Foi o jogador quem percebeu ("até a 337 estava ok"). As duas coisas que o
 * cabeçalho precisa cabem aqui em 10 linhas — e ficam aqui, sem custo nenhum
 * para as outras telas. Nenhuma funcionalidade da 338-345 se perde nisso.
 */
const NOME_DA_POSICAO: Record<string, string> = {
  GOL: "Goleiro", ZAG: "Zagueiro", LD: "Lateral-direito", LE: "Lateral-esquerdo",
  VOL: "Volante", MEI: "Meia", ATA: "Atacante",
}

/** A mesma conta de `mediaDaTemporada`, sem puxar o motor junto. */
function mediaDasNotas(jogos: number, somaDasNotas: number): number {
  return jogos > 0 ? Math.round((somaDasNotas / jogos) * 100) / 100 : 0
}
import { siglaExibivel } from "@/lib/club-identity"

const MONTHS_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

// Prefetch e cache da sessao. Cada rota so precisa ser aquecida uma vez, mesmo
// que o cabecalho remonte a cada navegacao.
const rotasPrincipaisAquecidas = new Set<string>()

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
  { prefix: "/central", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Central do Clube" } },
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
  { prefix: "/treinamento", meta: { parent: "Academia", parentHref: "/academia", title: "Treinamento" } },
  { prefix: "/gestao-avancada", meta: { parent: "Treinador", parentHref: "/treinador", title: "Gestao Avancada" } },
  { prefix: "/financas", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Financas" } },
  { prefix: "/estatisticas", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Estatisticas: Atletas" } },
  { prefix: "/competicoes", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Competicoes" } },
  { prefix: "/calendario", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Calendario" } },
  { prefix: "/historico", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Historico" } },
  { prefix: "/reunioes", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Reunioes" } },
  { prefix: "/imprensa", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Imprensa" } },
  { prefix: "/infraestrutura", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Infraestrutura" } },
  { prefix: "/analise-partida", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Analise da Partida" } },
  { prefix: "/performance", meta: { parent: "Academia", parentHref: "/academia", title: "Performance Center" } },
  { prefix: "/base/carreira", meta: { parent: "Base", parentHref: "/base/carreira", title: "Carreira na base" } },
  { prefix: "/base", meta: { parent: "Academia", parentHref: "/academia", title: "Juniores" } },
  { prefix: "/academia", meta: { parent: "Academia", parentHref: "/academia", title: "Visao Geral" } },
  { prefix: "/escritorio", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Visao Geral" } },
  { prefix: "/comissao", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Comissao Tecnica" } },
  { prefix: "/rankings", meta: { parent: "Escritorio", parentHref: "/escritorio", title: "Rankings" } },
  { prefix: "/selecao/calendario", meta: { parent: "Selecao", parentHref: "/selecao", title: "Calendario da selecao" } },
  // O ONLINE NAO E UMA TELA DO ESCRITORIO. Sem estas linhas a trilha dizia
  // "Inicio > Escritorio" enquanto a pessoa estava nos modos entre tecnicos.
  { prefix: "/online/amistoso", meta: { parent: "Online", parentHref: "/online", title: "Amistoso online" } },
  { prefix: "/online/rivals", meta: { parent: "Online", parentHref: "/online", title: "Manager Rivals" } },
  { prefix: "/online/rush", meta: { parent: "Online", parentHref: "/online", title: "Manager Rush" } },
  { prefix: "/online", meta: { parent: "Online", parentHref: "/online", title: "Modos entre tecnicos" } },
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
  const { team: careerTeam } = useUserTeam()
  const userTeam = team || careerTeam || getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const routeMeta = getRouteMeta(pathname)
  /**
   * ⚠️ NO ONLINE O CABEÇALHO NÃO É O DA CARREIRA (pedido, com print).
   *
   * Entrando nos modos entre técnicos a barra continuava mostrando "Temporada
   * 2026 · 01 JAN", o botão AVANÇAR, o salvar e o escudo do clube da carreira —
   * o relato foi "entro no modo online e ele puxa a carreira". E não é só
   * enfeite fora de lugar: `AVANÇAR` ali roda uma semana do mundo da carreira a
   * partir de uma tela que não é dela.
   *
   * Aqui ele fica com o que é do online: marca, trilha, menu e configurações.
   */
  const emModoOnline = pathname.startsWith("/online")
  // Dirigindo uma selecao o menu perde os itens de clube (mercado, financas,
  // juniores...) e recebe os da selecao. Ver buildNavMenuItems.
  const { isNational: emModoSelecao } = useManagingNational()
  // ⚠️ CARREIRA DE ATLETA NAO E CARREIRA DE TECNICO, e o cabecalho tratava as
  // duas como a mesma coisa: no modo jogador o menu abria Financas, Mercado,
  // Infraestrutura e "Pedir demissao" — telas de quem DIRIGE o clube. Quem e
  // atleta nao contrata ninguem nem pede demissao do clube; ele pede
  // transferencia. Ver NAV_MENU_PLAYER_ITEMS.
  const carreiraDeAtleta = state.carreiraDeJogador
  const modalidadeDaCarreira = modalidadeDoSave(state)
  const ehCarreiraDeAtleta = modalidadeDaCarreira === "jogador" && Boolean(carreiraDeAtleta)
  // ⚠️ Exige a carreira ATIVA, nao so a modalidade: quem sobe da base para o
  // profissional guarda `modalidade: "profissional"` e o `youthCareer` arquivado
  // com `active: false` (ver `acceptProfessionalOffer`). Olhar so a modalidade
  // ja bastaria hoje, mas o save antigo sem o campo e resolvido por
  // `youthCareer.active` — e e ele que decide de verdade quem esta na base.
  const ehCarreiraDeBase = modalidadeDaCarreira === "sub20" && Boolean(state.youthCareer?.active)
  const navMenuItems = useMemo(
    () => buildNavMenuItems(emModoSelecao, ehCarreiraDeAtleta, ehCarreiraDeBase),
    [emModoSelecao, ehCarreiraDeAtleta, ehCarreiraDeBase],
  )


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
    // ⚠️ NA CARREIRA DE ATLETA "PEDIR DEMISSAO" E OUTRA COISA (1.0.358).
    //
    // Este botao limpava `selectedTeamShort` e mandava a pessoa para a Area do
    // Treinador — a tela de quem DIRIGE clube. Um atleta de 18 anos que rescinde
    // nao vira tecnico desempregado: ele fica SEM CLUBE, e o que decide quem
    // liga e o desempenho dele no clube anterior. Ver `rescindirContrato` em
    // lib/carreira-de-jogador, e o escritorio do atleta, que vira a mesa do
    // agente enquanto o estado durar.
    if (ehCarreiraDeAtleta && carreiraDeAtleta) {
      setState({ carreiraDeJogador: rescindirContrato(carreiraDeAtleta) })
      hardNavigate("/carreira/jogador")
      return
    }
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
    const nav = navigator as Navigator & {
      deviceMemory?: number
      connection?: { saveData?: boolean }
    }
    if (
      (nav.hardwareConcurrency ?? 8) <= 4
      || (nav.deviceMemory ?? 8) <= 4
      || nav.connection?.saveData
    ) return

    const rotas = perfilDesempenho === "economy" ? []
      : perfilDesempenho === "balanced" ? ["/", "/elenco"]
      : ["/", "/elenco", "/mercado", "/calendario", "/competicoes"]
    const pendentes = rotas.filter(href => !rotasPrincipaisAquecidas.has(href))
    if (pendentes.length === 0) return

    let cancelado = false
    const aquecer = () => {
      if (cancelado) return
      for (const href of pendentes) {
        rotasPrincipaisAquecidas.add(href)
        router.prefetch(href)
      }
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
    // ⚠️ NO MODO ATLETA ESTE BLOCO CONTAVA A CARREIRA ERRADA. Ele le o
    // `seasonCalendar` do TECNICO, que numa carreira de jogador nao existe —
    // por isso o cartao mostrava 0 jogos, 0% de aproveitamento e o cargo
    // "Tecnico Principal" para um atacante de 18 anos. Os numeros do atleta
    // moram em `carreiraDeJogador.temporadaAtual`.
    if (ehCarreiraDeAtleta && carreiraDeAtleta) {
      const t = carreiraDeAtleta.temporadaAtual
      // `ultimasPartidas` ja traz o placar do ponto de vista do atleta
      // (golsPro/golsContra), entao a forma sai daqui e nao do calendario —
      // que nesta carreira tem outro formato.
      const formaDoAtleta = carreiraDeAtleta.ultimasPartidas.slice(-5).map(p =>
        p.golsPro > p.golsContra ? "V" : p.golsPro === p.golsContra ? "E" : "D",
      ) as ("V" | "E" | "D")[]
      const notaMedia = mediaDasNotas(t.jogos, t.somaDasNotas)
      const nomeDaPosicao =
        NOME_DA_POSICAO[carreiraDeAtleta.atleta.posicao] ?? carreiraDeAtleta.atleta.posicao
      return {
        coachData: {
          nome: carreiraDeAtleta.atleta.nome,
          cargo: `${nomeDaPosicao} · ${carreiraDeAtleta.clubeNome}`,
          partidasTotal: t.jogos,
          // No cartao do atleta as quatro caixas deixam de ser V/E/D (que sao do
          // clube) e passam a ser o que a carreira dele mede.
          vitorias: t.gols,
          empates: t.assistencias,
          derrotas: t.titularidades,
          aproveitamento: Math.round(notaMedia * 10),
          titulosTemporada: (carreiraDeAtleta.historico ?? []).reduce((n, h) => n + h.titulos.length, 0),
          sequencia: t.minutos > 0 ? `${t.minutos} min` : "-",
          rotulos: {
            vitorias: "Gols", empates: "Assist.", derrotas: "Titular",
            taxa: "Nota media", sequencia: "Minutos",
          },
        },
        form: formaDoAtleta,
      }
    }

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
        rotulos: undefined as undefined | Record<"vitorias" | "empates" | "derrotas" | "taxa" | "sequencia", string>,
      },
      form: resultados.slice(-5),
    }
  }, [seasonCalendar, userTeam.curto, userTeam.nome, state.managerName, state.seasonHistory, currentSeason,
    ehCarreiraDeAtleta, carreiraDeAtleta])

  // O jogo e organizado por temporada (comecando 01/01) e nao por "rodada" isolada —
  // mostra a data corrente do calendario em vez de um contador de rodadas.
  // Durante o avanco mostra a data da animacao (dia a dia); fora dele, a data real.
  /**
   * ⚠️ NA CARREIRA DE ATLETA O RELOGIO DO CABECALHO FICAVA PARADO EM 01 JAN.
   *
   * A data sai de `getGameDate(currentSeason, currentWeek)`, e `currentWeek` e a
   * semana do TECNICO — que numa carreira de jogador ninguem avanca: quem anda
   * e a `rodada` da propria carreira, movida por "Viver a partida" / "Simular
   * rodada". Resultado: o atleta chegava a rodada 12 com o cabecalho ainda
   * dizendo 01 JAN, e a "Temporada 2026" ao lado nem era lida da carreira dele.
   *
   * `rodada` e a ultima jogada, entao o presente e a proxima (+1) — do mesmo
   * jeito que a semana do tecnico aponta para o jogo que ainda vai acontecer.
   */
  const temporadaCorrente = ehCarreiraDeAtleta && carreiraDeAtleta
    ? carreiraDeAtleta.temporada
    : currentSeason
  const gameDate = advanceDate ?? (ehCarreiraDeAtleta && carreiraDeAtleta
    ? getGameDate(carreiraDeAtleta.temporada, carreiraDeAtleta.rodada + 1)
    : getGameDate(currentSeason, currentWeek))
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
  const temporadaLabel = anoDaData > temporadaCorrente
    ? `${temporadaCorrente}/${String(anoDaData).slice(-2)}`
    : String(temporadaCorrente)

  // ⚠️ O DISQUETE GRAVAVA EM SILENCIO (corrigido na 1.0.380). O jogador clicava,
  // via um "check" verde por dois segundos e nao ficava sabendo nem o QUE tinha
  // sido gravado nem SOB QUE NOME — e a tela de carregar mostra doze carreiras.
  // O campo `saveName` ja existia no save desde sempre; so nao havia por onde
  // escreve-lo fora da tela /salvar.
  const [pedindoNome, setPedindoNome] = useState(false)
  const [erroDoSave, setErroDoSave] = useState("")

  const abrirSalvar = () => {
    // Sem carreira iniciada no pre-office nao ha o que salvar (salvarTudo checa
    // de novo, lendo o disco — aqui e so para nao abrir o dialogo a toa).
    if (!podeSalvarCarreira(state)) return
    setErroDoSave("")
    setPedindoNome(true)
  }

  const handleSave = async (nome: string) => {
    setSaving(true)
    // TUDO: motor (elenco/contratos/emprestimos/caixa), save da carreira e as
    // demais chaves. E o merge e feito sobre o DISCO, nao sobre o `state` deste
    // componente — ver lib/salvar-tudo.ts.
    const resultado = await salvarTudo({ saveName: nome })
    setSaving(false)
    if (!resultado.ok) {
      setErroDoSave(resultado.motivo ?? t.header.saveGame)
      return
    }
    setPedindoNome(false)
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

    // ⚠️ NA CARREIRA DE ATLETA ESTE BOTAO MEXIA NO MUNDO ERRADO. Ele chama
    // `advanceGameWeek()`, o motor do TECNICO — que numa carreira de jogador
    // avanca a semana de uma carreira que nao existe, enquanto a rodada do
    // atleta (movida por `jogarProximaRodada`) fica onde estava.
    //
    // O certo aqui e a MESMA regra que o botao ja aplica para o tecnico logo
    // abaixo: havendo partida por disputar, ele LEVA ao jogo em vez de adiantar
    // o relogio. Quem decide entre viver e simular e o jogador, na tela dele —
    // avancar nao pode consumir a partida dele em silencio.
    if (ehCarreiraDeAtleta) {
      hardNavigate("/carreira/jogador")
      return
    }

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
          irPara: resultado?.newSeason ? null : resultado?.phaseTitle ? "/campeao" : "/partida",
        })
        return
      }
    }

    // TÍTULO DE FASE (Taça Guanabara) TEM CERIMÔNIA COMO QUALQUER OUTRO.
    // Ele não vem do apito de uma final — nasce aqui, na apuração da semana,
    // depois que os jogos dos rivais são simulados. A tela da partida, que é
    // quem descobre os títulos de copa, nem chega a existir neste caminho: sem
    // este desvio o técnico seria levado direto para a próxima partida com o
    // troféu registrado no histórico e nenhuma tela dizendo que ele o ganhou.
    if (resultado?.phaseTitle) {
      hardNavigate("/campeao")
      return
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
          className="flex h-14 shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-80"
        >
          {/* ⚠️ A MARCA ESTAVA PEQUENA DEMAIS (1.0.350, pedido do usuário): 36 px
              de altura num cabeçalho escuro, ao lado de textos de 14 px — ela
              sumia. Agora 52 px, sem o `px-1` que ainda comia largura. WebP no
              lugar do PNG: mesma arte, um terço do peso. */}
          <Image
            src="/brand/uf26-logo.webp"
            alt="UF26"
            width={180}
            height={66}
            className="h-13 w-auto object-contain"
            style={{ height: 52 }}
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

            {/* Pagina atual. Condensada e em caixa alta: e o rotulo que diz
                ONDE o jogador esta, e precisa vencer o nome da secao ao lado
                sem ocupar mais largura — varias rotas tem titulo longo, do
                tamanho de Gerenciamento do Time. */}
            <span className="uf-title shrink-0 whitespace-nowrap pb-[2px] text-xl">
              {routeMeta.title}
            </span>
          </nav>
        )}
      </div>

      {/* Direita: acoes + widget do clube */}
      <div className="flex items-center gap-3 shrink-0">
        {!emModoOnline && <FM26CommandCenter />}
        {/* Info temporada/calendario (data real, nao contador de rodada).
            O chip mostra "09 ABR" por falta de espaco; a data COMPLETA aparece ao
            passar o mouse (pedido) — junto com o dia da semana, que e o que diz
            se hoje e dia de jogo. */}
        <div className={cn(
          "group relative hidden items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1",
          !emModoOnline && "xl:flex",
        )}>
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

        {/* Salvar — some no online: não há carreira para gravar ali. */}
        {!emModoOnline && (
        <button
          onClick={abrirSalvar}
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
        )}

        {pedindoNome && (
          <DialogoDeSalvar
            dados={{
              nomeAtual: state.saveName || `${userTeam.nome} — ${t.header.temporada_curta} ${currentSeason}`,
              clube: userTeam.nome,
              clubeCurto: userTeam.curto,
              clubeFileKey: userTeam.file_key,
              tecnico: state.managerName || "Tecnico",
              temporada: currentSeason,
              data: gameDate,
              semana: currentWeek,
            }}
            salvando={saving}
            erro={erroDoSave}
            onSalvar={handleSave}
            onFechar={() => setPedindoNome(false)}
          />
        )}

        {/* A VEZ DA MESA (co-op local). Fica COLADO no "Avancar" de proposito: a
            rodada nao anda enquanto todos nao fecharem, e o lugar de descobrir
            isso e ao lado do botao que nao vai funcionar. Em carreira de um
            tecnico so, o componente nao desenha nada. */}
        {!emModoOnline && <TrocaDeVez />}

        {/* Avancar — ou JOGAR, quando a partida da semana ainda e sua para disputar.
            Trocar o rotulo resolve o mal-entendido na raiz: o jogador clicava
            "avancar" achando que ia ATE o dia do jogo, e o jogo passava. */}
        {/* MINIMALISTA (pedido). O `eafc-btn` era um retângulo de gradiente
            ciano→azul→roxo com um brilho que varria o botão no hover: numa barra
            que já é só ícones cinzas, ele gritava mais que o próprio conteúdo da
            tela e destoava do resto do cabeçalho. Agora é um botão de superfície
            discreta com contorno fino, e a cor da marca fica reservada para o
            estado que MERECE atenção: quando há partida sua para disputar, o
            botão vira "Jogar" e ganha o realce. A classe global segue intocada —
            outras telas ainda a usam. */}
        {!emModoOnline && (
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
            "group flex h-8 items-center gap-2 rounded-md border px-3.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
            partidaPendenteAgora
              ? "border-[var(--brand)]/40 bg-[var(--brand)]/10 text-[var(--brand)] hover:bg-[var(--brand)]/20"
              : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.07] hover:text-white",
            advancing && "cursor-wait opacity-50",
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
        )}

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

        {/* Widget do clube: escudo + forma + estrela (dropdown do tecnico).
            Some no ONLINE: ali nao ha clube da carreira para exibir. */}
        {!emModoOnline && (
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
              {/* ⚠️ NO MODO ATLETA O SELO MOSTRAVA A SIGLA DO CLUBE ("DCI").
                  Isso e identidade de TECNICO: quem dirige o clube e o clube.
                  O atleta e uma pessoa dentro dele — o selo passa a ser o nome
                  dele, que e o que ele reconhece como "eu" na tela. */}
              <span className="text-[12px] font-bold text-white">
                {ehCarreiraDeAtleta && carreiraDeAtleta
                  ? carreiraDeAtleta.atleta.nome
                  : siglaExibivel(userTeam.curto, userTeam.nome)}
              </span>
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
                    <div className="text-[9px] text-white/40 uppercase">{coachData.rotulos?.vitorias ?? "V"}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/20">
                    <div className="text-lg font-bold text-yellow-400">{coachData.empates}</div>
                    <div className="text-[9px] text-white/40 uppercase">{coachData.rotulos?.empates ?? "E"}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-lg font-bold text-red-400">{coachData.derrotas}</div>
                    <div className="text-[9px] text-white/40 uppercase">{coachData.rotulos?.derrotas ?? "D"}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[var(--brand)]" />
                    <span className="text-xs text-white/60">{coachData.rotulos?.taxa ?? t.header.winRate}</span>
                  </div>
                  <span className="text-sm font-bold text-[var(--brand)]">
                    {coachData.rotulos ? (coachData.aproveitamento / 10).toFixed(2) : `${coachData.aproveitamento}%`}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/40" />
                    <span className="text-xs text-white/60">{coachData.rotulos?.sequencia ?? t.header.streak}</span>
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
        )}
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
                placeholder={t.cabecalho.buscar_tela_clube_atleta_ou_competicao}
                aria-label={t.cabecalho.buscar_no_jogo}
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
            {/* ⚠️ NA CARREIRA DE ATLETA ele muda de NOME e de SIGNIFICADO, e some
                para quem ja esta sem clube — nao se rescinde duas vezes. Ver
                `handleResign`. */}
            {!emModoSelecao && !(ehCarreiraDeAtleta && carreiraDeAtleta?.semClube) && (
              <div className="border-t border-white/[0.06] p-3">
                <button
                  type="button"
                  onClick={() => { setShowNavMenu(false); setShowResignConfirm(true) }}
                  className="flex w-full items-center gap-3 border-l-2 border-l-red-400/60 bg-red-500/5 px-3 py-2.5 text-sm font-semibold text-red-300/90 transition-colors hover:bg-red-500/10 hover:text-red-200"
                >
                  <LogOut className="h-4 w-4" />
                  {ehCarreiraDeAtleta ? "Rescindir contrato" : "Pedir demissao"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmacao da demissao: irreversivel, exige confirmar (teclado Enter/Esc, controle A/B). */}
      {showResignConfirm && (
        <ResignConfirmDialog
          teamName={ehCarreiraDeAtleta && carreiraDeAtleta ? carreiraDeAtleta.clubeNome : userTeam.nome}
          ehAtleta={ehCarreiraDeAtleta}
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
function ResignConfirmDialog({ teamName, ehAtleta = false, onCancel, onConfirm }: { teamName: string; ehAtleta?: boolean; onCancel: () => void; onConfirm: () => void }) {
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center uf-veu" onClick={onCancel}>
      <div
        className="w-[400px] max-w-[90vw] rounded-2xl border border-white/10 bg-[#0c0c14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">
          {ehAtleta ? `Rescindir com o ${teamName}?` : `Pedir demissao do ${teamName}?`}
        </h2>
        <p className="mt-2 text-sm text-white/60">
          {ehAtleta
            ? "Voce fica SEM CLUBE. As propostas passam a chegar semana a semana, e o tamanho de quem liga depende do que voce fez neste clube. Cada semana parado derruba um pouco o seu cartaz. Esta acao nao pode ser desfeita."
            : "Voce encerra seu ciclo no clube e volta ao menu principal. O progresso e salvo automaticamente. Esta acao nao pode ser desfeita."}
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
            {ehAtleta ? "Confirmar rescisao" : "Confirmar demissao"} <span className="text-white/50">(Enter)</span>
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
  // ⚠️ ESTE MENU TINHA DEZESSEIS ENTRADAS EM QUATRO SECOES.
  //
  // O relatorio (PDF Ultra26, p.1) marcou a coluna inteira: "diminua um pouco
  // dessas paginas, junte em uma pagina so os itens que tem que juntar". A
  // forma da referencia (p.4) e curta: Inicio, Notificacoes, Elenco,
  // Transferencias, Academia, Escritorio, Personalizar.
  //
  // ⚠️ NENHUM DESTINO FOI APAGADO, e isso e deliberado. O historico deste
  // arquivo e uma lista de telas que existiam e nao tinham porta: a Comissao
  // Tecnica, os Desafios, o Performance Center. Encurtar o menu removendo linha
  // recriaria o mesmo defeito. Cada tela que saiu daqui mora agora num HUB —
  // /escritorio e /academia, criados para isto — e continua a um clique de
  // distancia, com descricao, em vez de a zero cliques sem nenhuma.
  //
  // O mapa de migalhas (MAPA_DE_SECOES, no topo do arquivo) e quem mantem o
  // caminho de volta correto para cada uma delas.
  { secao: "Clube", label: "Inicio", href: "/", icon: Trophy },
  { secao: "Clube", label: "Notificacoes", href: "/notificacoes", icon: Bell },

  { secao: "Time", label: "Elenco", href: "/elenco", icon: User, clubOnly: true },
  // TRANSFERENCIAS e a porta, /mercado e uma sala dentro dela (PDF p.9). O hub
  // /transferencias ja existia com os seis cards e o breadcrumb ja o declarava
  // como pai de /mercado; so o menu continuava entrando pela sala do meio.
  { secao: "Time", label: "Transferencias", href: "/transferencias", icon: ArrowLeftRight, clubOnly: true },
  // ACADEMIA absorve Treinamento, Juniores e Performance Center, mais as duas
  // telas novas de plano (treino e desenvolvimento) pedidas na p.16.
  { secao: "Time", label: "Academia", href: "/academia", icon: Sprout, clubOnly: true },

  // ESCRITORIO absorve Central do Clube, Financas, Infraestrutura, Comissao
  // Tecnica, Calendario, Competicoes, Gestao, Rankings, Historico, Imprensa,
  // Reunioes e Analise da Partida — as doze telas de quem DIRIGE o clube.
  { secao: "Voce", label: "Escritorio", href: "/escritorio", icon: Building2, clubOnly: true },
  // AREA DO TREINADOR fica FORA do hub do clube de proposito: ela e a carreira
  // de quem dirige (propostas, reputacao, historico pessoal) e continua valendo
  // para quem esta SEM CLUBE — por isso nao leva `clubOnly`. Enfia-la no
  // escritorio a tornaria inalcancavel exatamente para quem mais precisa dela.
  { secao: "Voce", label: "Area do Treinador", href: "/treinador", icon: User },
  { secao: "Voce", label: "Desafios", href: "/desafios", icon: Target, clubOnly: true },
  // CONFIGURACOES virou PERSONALIZAR (PDF p.14), seguindo a referencia.
  { secao: "Voce", label: "Personalizar", href: "/configuracoes", icon: Settings },
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

/**
 * O MENU DE QUEM E ATLETA.
 *
 * ⚠️ Ate a 1.0.337 nao existia: o modo jogador herdava o menu inteiro do
 * tecnico. A tela abria "Financas", "Infraestrutura", "Mercado", "Area do
 * Treinador" e "Pedir demissao" para um atleta de 18 anos que nao dirige coisa
 * nenhuma — e o "Escritorio" apontava para `/`, o escritorio do TECNICO.
 *
 * A carreira de atleta e UMA tela com abas (ver app/carreira/jogador), de
 * proposito: o modo e partida-a-partida e espalhar isso em seis rotas viraria
 * peregrinacao de menu entre uma rodada e outra. Entao este menu e curto e
 * honesto — leva ao que existe, e nada mais.
 */
const NAV_MENU_PLAYER_ITEMS: NavMenuItem[] = [
  { secao: "Carreira", label: "Meu escritorio", href: "/carreira/jogador", icon: User },
  { secao: "Carreira", label: "Calendario e tabela", href: "/carreira/jogador/calendario", icon: Calendar },
  { secao: "Carreira", label: "Evolucao e atributos", href: "/carreira/jogador/evolucao", icon: TrendingUp },
  // ⚠️ A LOJA E A VIDA FALTAVAM AQUI (1.0.377). As duas telas existem desde a
  // 1.0.374, com rota propria e lugar nas abas do `AtletaShell` — mas o menu do
  // cabecalho, que e por onde o jogador de teclado navega, nunca as listou.
  // Uma tela alcancavel so pela aba e uma tela que metade dos jogadores nao
  // descobre.
  { secao: "Carreira", label: "Loja e marca", href: "/carreira/jogador/loja", icon: ShoppingBag },
  { secao: "Carreira", label: "Vida fora de campo", href: "/carreira/jogador/vida", icon: HeartHandshake },
  { secao: "Carreira", label: "Trajetoria", href: "/carreira/jogador/trajetoria", icon: BarChart3 },
]

/**
 * O MENU DE QUEM DIRIGE O SUB-20.
 *
 * ⚠️ Ate a 1.0.351 nao existia. Quem escolhia a carreira de base recebia o menu
 * inteiro do tecnico profissional: Financas, Infraestrutura, Treinamento,
 * Calendario e Competicoes — todas do time PRINCIPAL, que ele nao dirige. A
 * carreira da base tem calendario, tabela e copa PROPRIOS (ver
 * `lib/youth-career-engine`), e era para eles que o menu deveria apontar.
 *
 * O que fica de fora e por que:
 *   • `/base` (Juniores) — e a academia de quem dirige o PROFISSIONAL, e
 *     escreve no MESMO `state.youthPlayers` que e o elenco desta carreira.
 *     Vender por la o atleta que voce escala aqui e o tipo de porta que so
 *     produz save quebrado.
 *   • Financas, Infraestrutura, Central, Elenco, Treinamento, Calendario,
 *     Competicoes, Performance — sao do clube profissional.
 *
 * O que FICA: Mercado e Leiloes ja trocam de fonte por modalidade desde a
 * 1.0.335 (`lib/mercado-da-modalidade`), a Central de Gestao pesa as areas por
 * modalidade (`pesoDasAreas`) e a Area do Treinador e a carreira de quem
 * dirige, nao do clube.
 */
const NAV_MENU_YOUTH_ITEMS: NavMenuItem[] = [
  { secao: "Base", label: "Carreira na base", href: "/base/carreira", icon: Sprout },
  { secao: "Base", label: "Mercado de jovens", href: "/mercado", icon: TrendingUp },
  { secao: "Voce", label: "Area do Treinador", href: "/treinador", icon: User },
  { secao: "Voce", label: "Gestao", href: "/gestao-avancada", icon: Target },
  { secao: "Voce", label: "Rankings", href: "/rankings", icon: BarChart3 },
]

function buildNavMenuItems(
  isNational: boolean,
  ehAtleta = false,
  ehCarreiraDeBase = false,
): NavMenuItem[] {
  // O atleta vem primeiro: uma carreira de jogador nunca e tambem uma selecao.
  if (ehAtleta) {
    const configuracoes = NAV_MENU_ITEMS.find(i => i.href === "/configuracoes")!
    return [...NAV_MENU_PLAYER_ITEMS, configuracoes]
  }
  if (ehCarreiraDeBase) {
    const configuracoes = NAV_MENU_ITEMS.find(i => i.href === "/configuracoes")!
    return [...NAV_MENU_YOUTH_ITEMS, configuracoes]
  }
  if (!isNational) return NAV_MENU_ITEMS
  const comuns = NAV_MENU_ITEMS.filter(i => !i.clubOnly)
  const ultimo = comuns.pop()! // Configuracoes fica no fim
  return [...comuns, ...NAV_MENU_NATIONAL_ITEMS, ultimo]
}
