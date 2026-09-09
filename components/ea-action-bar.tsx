"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, Users, Volume2, VolumeX } from "lucide-react"
import { getNowPlaying, togglePlayPause, type NowPlaying } from "@/lib/system-media"
import { useAmigosOnline } from "@/hooks/use-amigos-online"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { useEhAppCelular } from "@/lib/plataforma"
import type { GameAction } from "@/lib/input/actions"
import { useRetratoDoInput, useModoControle } from "@/hooks/use-input"
import { pilhaDeDicas } from "@/lib/input/hints"
import { GlifoDaAcao } from "@/components/input/glifo"

/**
 * Barra de acoes inferior estilo EA FC Manager.
 * - Lado esquerdo: dicas de acao com "key chips" (Selecionar, Voltar, etc.)
 * - Lado direito: marcas EA / FC HUB e contadores online.
 *
 * Telas definem suas acoes com o hook `useActionBar([...])`.
 * O bar e renderizado globalmente uma unica vez no layout raiz.
 */

export interface ActionHint {
  /** Texto do "key chip" (ex: "Esc", "Tab", "W", "Num", "Space"). Use "enter" para o glifo de enter. */
  keyLabel: string
  /** Rotulo da acao (ex: "Selecionar", "Voltar"). */
  label: string
  onClick?: () => void
  /**
   * Acao do jogo que esta tecla dispara. So serve para desenhar o GLIFO DO
   * CONTROLE no lugar da tecla quando ha um controle ligado. Opcional: sem ela,
   * `acaoDaTecla` deduz pelo proprio `keyLabel`, que ja e o caso das dezenas de
   * telas que so passam "Esc"/"Tab"/"enter".
   */
  acao?: GameAction
}

/**
 * TECLA -> ACAO, para a barra trocar de glifo sozinha.
 *
 * Pedido do PDF Ultra26 (p.14): "no eafc ele reconhece automaticamente quando
 * conecta o controle e ja muda os icones". A deteccao ja existia inteira
 * (`entrada: "auto"` e `glifo: "auto"` em lib/input/preferences.ts, e
 * `useFamiliaDeGlifo` seguindo o controle ligado) — o que faltava era ESTA
 * barra, que desenhava a tecla do teclado em qualquer situacao.
 *
 * O mapa cobre o vocabulario que as telas realmente usam. Tecla sem acao
 * conhecida continua desenhada como tecla, que e o comportamento honesto: e
 * melhor mostrar "Num" do que inventar um botao de controle que nao existe.
 */
const ACAO_DA_TECLA: Record<string, GameAction> = {
  enter: "UI_CONFIRM",
  esc: "UI_BACK",
  escape: "UI_BACK",
  tab: "TAB_NEXT",
  w: "QUICK_MENU",
  q: "SEARCH",
  e: "OPEN_DETAILS",
  f: "OPEN_ACTIONS",
  x: "PAGE_PREVIOUS",
  c: "PAGE_NEXT",
}

function acaoDaTecla(hint: ActionHint): GameAction | null {
  return hint.acao ?? ACAO_DA_TECLA[hint.keyLabel.trim().toLowerCase()] ?? null
}

/** A BarraDeDicas do Modo Controle esta desenhando alguma coisa agora? */
function useDicasDoModoControle(): boolean {
  const modoControle = useModoControle()
  const temDicas = useSyncExternalStore(
    cb => pilhaDeDicas.observar(cb),
    () => pilhaDeDicas.atual().length > 0,
    () => false,
  )
  return modoControle && temDicas
}

const DEFAULT_ACTIONS: ActionHint[] = [
  { keyLabel: "enter", label: "Selecionar" },
  { keyLabel: "Esc", label: "Voltar" },
]

// Telas onde o Esc global NAO deve navegar "pra tras":
// - pre-jogo/hub: voltar dali sairia do jogo em direcao a splash;
// - "/partida": durante a partida o Esc pausa/retoma (a propria tela trata);
// - editor/mercado/salvar: ja tem listener proprio de Esc (evita duplo "voltar").
// O hub "/" e tratado a parte (match exato).
const ESC_BACK_BLOCKED_PREFIXES = [
  "/splash",
  "/novo-jogo",
  "/pre-office",
  "/partida",
  "/editar",
  "/editor",
  "/mercado",
  "/salvar",
]

function isEscBackBlocked(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true
  return ESC_BACK_BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

function safeBackTarget(pathname: string): string {
  if (pathname.startsWith("/elenco/")) return "/elenco/"
  if (pathname.startsWith("/transferencias/") || pathname.startsWith("/mercado/")) return "/transferencias/"
  if (pathname.startsWith("/configuracoes/") || pathname.startsWith("/salvar/")) return "/configuracoes/"
  if (pathname.startsWith("/base/")) return "/base/"
  return "/"
}

interface ActionBarContextValue {
  actions: ActionHint[]
  setActions: (actions: ActionHint[] | null) => void
}

const ActionBarContext = createContext<ActionBarContextValue | null>(null)

export function EaActionBarProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [actions, setActionsState] = useState<ActionHint[] | null>(null)
  const setActions = useCallback((next: ActionHint[] | null) => setActionsState(next), [])
  const effectiveActions = actions ?? DEFAULT_ACTIONS
  const actionsRef = useRef(effectiveActions)
  actionsRef.current = effectiveActions

  // Os "key chips" (Esc Voltar, enter Selecionar) sao mostrados em quase toda tela,
  // mas antes desta correcao so reagiam a clique do mouse — nenhum keydown real
  // disparava a acao correspondente. Aqui o teclado passa a chamar exatamente o
  // onClick que a tela atual registrou via useActionBar; sem onClick customizado,
  // Esc cai no fallback universal de "voltar" (mesmo significado do hint em toda tela).
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isTypingTarget(e.target)) return
      if (e.key === "Escape") {
        // Nao retransmite via gamepad:button aqui: varias telas ja tem seu proprio
        // listener de "B" que chama router.back() (ou fecha um modal) — repassar o
        // evento faria essa logica disparar de novo, navegando duas vezes pra tras.
        const action = actionsRef.current.find((a) => a.keyLabel.toLowerCase() === "esc")
        if (action?.onClick) {
          action.onClick()
          return
        }
        // Fallback "Voltar" LIMITADO. Antes era um router.back() cego: como toda
        // navegacao e um reload completo (historico real), segurar Esc andava o
        // historico ate a splash — saindo do jogo mesmo dentro de uma partida ou
        // do escritorio. Agora o Esc global e no-op no hub (/), nas telas de
        // pre-jogo/partida e nas telas que ja tratam Esc por conta propria (evita
        // tambem o duplo "voltar"). Nas demais telas de feature, volta um nivel —
        // e, como o hub e no-op, nunca cruza de volta para a splash.
        if (isEscBackBlocked(window.location.pathname)) return
        // Nunca usa o historico do WebView: ele pode conter a splash ou a carreira
        // carregada anteriormente. O destino e derivado da secao atual e permanece
        // dentro do mesmo save ativo.
        router.push(safeBackTarget(window.location.pathname))
      } else if (e.key === "Enter") {
        const action = actionsRef.current.find((a) => a.keyLabel.toLowerCase() === "enter")
        // Tambem dispara o canal gamepad:button (A) para telas como /partida e /pre-office,
        // que ja escutam esse evento pra confirmar a acao principal via controle.
        window.dispatchEvent(new CustomEvent("gamepad:button", { detail: { button: "A" } }))
        action?.onClick?.()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return (
    <ActionBarContext.Provider value={{ actions: effectiveActions, setActions }}>
      {children}
    </ActionBarContext.Provider>
  )
}

/** Define as acoes da barra inferior para a tela atual. Limpa ao desmontar. */
export function useActionBar(actions: ActionHint[]) {
  const ctx = useContext(ActionBarContext)
  // serializa para dependencia estavel
  const key = JSON.stringify(actions.map((a) => [a.keyLabel, a.label]))
  useEffect(() => {
    if (!ctx) return
    ctx.setActions(actions)
    return () => ctx.setActions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/**
 * A DICA, desenhada como o jogador tem na mao.
 *
 * Com controle ligado desenha o glifo do botao (e o glifo ja segue a familia
 * Xbox/PlayStation do controle conectado); sem controle, a tecla. A troca e
 * automatica porque `useRetratoDoInput` reassina a cada conexao/desconexao.
 */
function DicaDaAcao({ hint }: { hint: ActionHint }) {
  const { primario } = useRetratoDoInput()
  const acao = acaoDaTecla(hint)
  if (primario && acao) return <GlifoDaAcao acao={acao} contexto="GLOBAL" tamanho="sm" />
  return <KeyCap label={hint.keyLabel} />
}

function KeyCap({ label }: { label: string }) {
  const isEnter = label.toLowerCase() === "enter"
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1.5",
        "border border-white/20 bg-white/[0.06] font-mono text-[10px] font-semibold text-white/80",
        "shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]",
      )}
    >
      {isEnter ? "\u23CE" : label}
    </kbd>
  )
}

/**
 * A marca do jogo no canto da barra.
 *
 * ⚠️ ELA DIZIA "EA", e isso era um problema de verdade, nao de estilo: um selo
 * redondo com as letras EA no rodape de TODAS as telas e a marca de outra
 * empresa aposta no nosso produto. A referencia da EA vale como direcao de
 * arte — fundo escuro, HUD fino, trilha de atalhos — e nao como identidade.
 * Aqui vai a nossa: UF.
 */
function MarcaDoJogo() {
  return (
    <span
      aria-label="Ultrafoot"
      className="flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[7px] font-bold tracking-tighter text-white/55"
    >
      UF
    </span>
  )
}

/**
 * O PLAYER DE MUSICA no rodape.
 *
 * ⚠️ Ele nao toca nada: pilota a sessao de midia do SISTEMA (Spotify e afins),
 * o mesmo caminho que components/system-media-player.tsx ja usa. O jogo deixou
 * de embarcar trilha propria (eram 1,6 GB no instalador, de musica de
 * terceiros), entao "o player" aqui significa o controle do que o jogador ja
 * tem tocando.
 *
 * Sem nada tocando ele NAO aparece — um botao de pausa que nao pausa coisa
 * nenhuma e pior do que nenhum botao.
 */
function ControleDeMusica() {
  const [np, setNp] = useState<NowPlaying | null>(null)

  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setInterval> | undefined
    const consultar = async () => {
      const atual = await getNowPlaying()
      if (vivo) setNp(atual)
    }
    void consultar()
    const iniciar = () => { if (!timer) timer = setInterval(() => void consultar(), 4000) }
    const parar = () => { if (timer) clearInterval(timer); timer = undefined }
    const aoTrocar = () => (document.hidden ? parar() : (void consultar(), iniciar()))
    iniciar()
    document.addEventListener("visibilitychange", aoTrocar)
    return () => { vivo = false; parar(); document.removeEventListener("visibilitychange", aoTrocar) }
  }, [])

  if (!np?.available) return null

  const tocando = np.isPlaying
  return (
    <button
      onClick={() => { void togglePlayPause().then(async () => setNp(await getNowPlaying())) }}
      title={[np.title, np.artist].filter(Boolean).join(" — ") || "Player de musica"}
      className="flex items-center gap-1.5 transition-colors hover:text-white"
    >
      {tocando ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      <span className="max-w-[120px] truncate text-[11px] font-semibold text-white/55">
        {np.title || "—"}
      </span>
    </button>
  )
}

/**
 * AMIGOS ONLINE. Sai de `listarAmigos()` (ver hooks/use-amigos-online.ts).
 *
 * Some quando nao ha dado — sem conta, sem rede, VPS fora. Ausencia nao e zero.
 */
function AmigosOnline() {
  const presenca = useAmigosOnline()
  if (!presenca) return null
  return (
    <div
      className="flex items-center gap-1"
      title={`${presenca.online} de ${presenca.total} amigo(s) online`}
    >
      <Users className={cn("h-3.5 w-3.5", presenca.online > 0 && "text-[var(--uf-green)]")} />
      <span className="text-[11px] font-semibold text-white/55">{presenca.online}</span>
    </div>
  )
}

// Telas que controlam seus proprios rodapes fixos (nenhuma usa useActionBar) e
// por isso nao devem receber a barra global, que ficaria sobreposta e bloquearia
// cliques nos botoes dessas telas (ex: "Iniciar Partida" em /partida).
const HIDDEN_PATHS = ["/splash", "/novo-jogo", "/pre-office", "/partida", "/editar", "/editor", "/elenco/gerenciamento", "/calendario"]

export function EaActionBar() {
  const ctx = useContext(ActionBarContext)
  const pathname = usePathname()
  const { state } = useGameState()
  // Antes do `return null` de propósito: hook não pode ficar depois de saída
  // condicional, senão a ordem muda entre renderizações e o React quebra.
  const celular = useEhAppCelular()
  // ⚠️ DUAS BARRAS EMPILHADAS. Esta e a BarraDeDicas do Modo Controle
  // (components/input/barra-de-dicas.tsx) ocupam as MESMAS 44px do rodape. Em
  // Modo Controle as duas eram desenhadas: a de cima, opaca (z-50, bg-black/80),
  // tapava esta (z-30) — que continuava ali embaixo, invisivel e comendo os
  // cliques dos seus proprios botoes. Quando a outra tem o que dizer, esta sai.
  const dicasDoModoControle = useDicasDoModoControle()
  const actions = ctx?.actions ?? DEFAULT_ACTIONS

  // A barra pertence ao escritorio da carreira. Na splash, editor e fluxos antes
  // da escolha do clube ela nao deve aparecer, conforme a referencia do dossie.
  if (!state.selectedTeamShort || HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null
  if (dicasDoModoControle) return null

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 hidden md:flex h-11 items-center justify-between px-5",
        // Barra transparente estilo EA FC: so um gradiente sutil pra legibilidade, sem
        // faixa solida no rodape (pedido do relatorio: "deve ser transparente").
        "bg-gradient-to-t from-black/35 via-black/10 to-transparent border-t border-white/[0.03]",
      )}
    >
      {/* Acoes contextuais */}
      <div className="flex items-center gap-5">
        {actions.map((action, i) => {
          const content = (
            <>
              <DicaDaAcao hint={action} />
              <span className="text-[11px] font-medium tracking-wide text-white/55">{action.label}</span>
            </>
          )
          return action.onClick ? (
            <button
              key={i}
              onClick={action.onClick}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              {content}
            </button>
          ) : (
            <div key={i} className="flex items-center gap-2">
              {content}
            </div>
          )
        })}
      </div>

      {/* Marcas + contadores online */}
      <div className="flex items-center gap-3 text-white/40">
        <MarcaDoJogo />
        <BarChart3 className="h-3.5 w-3.5" />
        <div className="mx-1 h-4 w-px bg-white/10" />
        <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-white/20 text-[8px] font-bold text-white/55">
          f
        </span>
        {/* O FC Hub não existe no app de celular (ver components/fc-hub-loader):
            sem ele montado, este botão só disparava um evento que ninguém ouve. */}
        {!celular && (
          <>
            <button onClick={() => window.dispatchEvent(new Event("ultrafoot:fc-hub"))} className="flex items-center gap-2 hover:text-white"><span className="text-[11px] font-semibold tracking-wide text-white/55">FC HUB</span><KeyCap label="Tab" /></button>
            <div className="mx-1 h-4 w-px bg-white/10" />
          </>
        )}
        {/* ⚠️ ESTES DOIS CONTADORES ERAM `1` E `0` ESCRITOS A MAO, com o mesmo
            icone de pessoas nos dois. O relatorio marcou esta area (PDF Ultra26,
            p.18): o primeiro e o PLAYER DE MUSICA, o segundo sao os amigos
            online. Os dois agora saem de dado real — e somem quando nao ha dado,
            em vez de mostrar um numero inventado. */}
        <ControleDeMusica />
        <AmigosOnline />
      </div>
    </div>
  )
}
