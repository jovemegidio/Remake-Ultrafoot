"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { useEhAppCelular } from "@/lib/plataforma"

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
  const actions = ctx?.actions ?? DEFAULT_ACTIONS

  // A barra pertence ao escritorio da carreira. Na splash, editor e fluxos antes
  // da escolha do clube ela nao deve aparecer, conforme a referencia do dossie.
  if (!state.selectedTeamShort || HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null

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
              <KeyCap label={action.keyLabel} />
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
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold text-white/55">1</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold text-white/55">0</span>
        </div>
      </div>
    </div>
  )
}
