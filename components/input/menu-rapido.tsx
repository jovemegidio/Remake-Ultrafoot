"use client"

// MENU RAPIDO — o atalho que faz o controle deixar de ser lento.
//
// ── O problema ─────────────────────────────────────────────────────────────
// No mouse, ir do elenco para as financas e um clique na barra lateral. No
// controle, sem isto, seria: sair da tela, atravessar a barra item por item com
// o D-pad, confirmar. Tres vezes mais apertos para a mesma coisa, e e isso que
// faz interface de PC "no controle" parecer emprestada.
//
// ── Por que SEGURAR o ombro e nao apertar ──────────────────────────────────
// LB/RB ja trocam de aba em toda tela do jogo, e sao os botoes mais usados. Um
// TOQUE neles nao pode abrir menu nenhum. Segurar (300 ms) e um gesto que nao
// existe em lugar nenhum do jogo, entao nao rouba nada — e continua sendo o
// botao que a pessoa ja tem o dedo em cima.
//
// Enquanto aberto ele empilha o proprio contexto e o proprio escopo de foco: o
// D-pad para de alcancar a tela de tras e, ao fechar, o foco volta exatamente
// para o item onde estava.

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  BarChart3, Building2, CalendarDays, Dumbbell, Flag, Heart, LayoutGrid, Search,
  Settings, ShoppingCart, Swords, Trophy, Users, Wallet,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"
import { PRIORIDADE } from "@/lib/input/bus"
import { gerenteDeFoco } from "@/lib/focus/manager"
import {
  useAcaoDeInput, useContextoDeInput, useDicasDeControle, useEscopoDeFoco, useFocavel, useModoControle,
} from "@/hooks/use-input"

/**
 * Os mesmos destinos da barra lateral, na mesma ordem.
 *
 * Duplicado de propósito em vez de importado de `game-sidebar`: aquela lista
 * depende do idioma carregado e de contadores de notificação, e arrastar isso
 * para cá acoplaria o menu rápido ao estado da carreira. O menu precisa abrir
 * instantaneamente, inclusive antes de o save hidratar.
 */
const DESTINOS = [
  { icone: LayoutGrid, rotulo: "Escritório", href: "/" },
  { icone: Users, rotulo: "Elenco", href: "/elenco" },
  { icone: Swords, rotulo: "Táticas", href: "/taticas" },
  { icone: Dumbbell, rotulo: "Treinamento", href: "/treinamento" },
  { icone: CalendarDays, rotulo: "Calendário", href: "/calendario" },
  { icone: ShoppingCart, rotulo: "Mercado", href: "/mercado" },
  { icone: Trophy, rotulo: "Competições", href: "/competicoes" },
  { icone: Search, rotulo: "Olheiros", href: "/olheiros" },
  { icone: Wallet, rotulo: "Finanças", href: "/financas" },
  { icone: Building2, rotulo: "Infraestrutura", href: "/infraestrutura" },
  { icone: BarChart3, rotulo: "Estatísticas", href: "/estatisticas" },
  { icone: Heart, rotulo: "Central", href: "/central" },
  { icone: Flag, rotulo: "Seleção", href: "/selecao" },
  { icone: Settings, rotulo: "Configurações", href: "/configuracoes" },
] as const

/** Quanto tempo segurar o ombro. Abaixo de ~250 ms um toque rápido dispara. */
const SEGURAR_MS = 300

export function MenuRapido() {
  const modoControle = useModoControle()
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()

  // ── Abertura por ombro segurado ───────────────────────────────────────────
  // Ouve o evento legado `gamepad:button` (que o gerente emite) em vez de uma
  // ação: "segurar" não é uma ação — é um gesto temporal, e o barramento de
  // ações entrega apertos, não durações.
  const seguraDesde = useRef<number | null>(null)
  useEffect(() => {
    if (!modoControle || aberto) {
      seguraDesde.current = null
      return
    }
    let timer: number | null = null
    const aoBotao = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail ?? {}
      if (button !== "LB" && button !== "RB") return
      if (timer != null) return
      seguraDesde.current = performance.now()
      timer = window.setTimeout(() => {
        timer = null
        // Confere se o ombro AINDA está segurado: o evento é de borda de
        // subida, então sem esta janela um toque rápido abriria o menu 300 ms
        // depois de o dedo já ter saído — o menu "aparecendo sozinho".
        const gp = navigator.getGamepads?.() ?? []
        const aindaSegurado = [...gp].some(
          g => g?.connected && (g.buttons[4]?.pressed || g.buttons[5]?.pressed),
        )
        if (aindaSegurado) setAberto(true)
      }, SEGURAR_MS)
    }
    window.addEventListener("gamepad:button", aoBotao)
    return () => {
      window.removeEventListener("gamepad:button", aoBotao)
      if (timer != null) window.clearTimeout(timer)
    }
  }, [modoControle, aberto])

  // Trocar de rota fecha: o menu já cumpriu a função e deixá-lo aberto por cima
  // da tela nova é o tipo de estado esquecido que vira relato de "travou".
  useEffect(() => {
    setAberto(false)
  }, [pathname])

  const fechar = useCallback(() => setAberto(false), [])

  if (!modoControle || !aberto) return null
  return <PainelDoMenuRapido aoFechar={fechar} atual={pathname} />
}

function PainelDoMenuRapido({ aoFechar, atual }: { aoFechar: () => void; atual: string }) {
  // Contexto e escopo próprios: enquanto estiver aberto, nada atrás recebe
  // D-pad e o foco não escapa para a tela de baixo.
  useContextoDeInput("QUICK_MENU")
  useEscopoDeFoco("menu-rapido")
  useDicasDeControle([
    { acao: "UI_CONFIRM", rotulo: "Ir" },
    { acao: "UI_BACK", rotulo: "Fechar" },
  ])

  useAcaoDeInput(
    ["UI_UP", "UI_DOWN", "UI_LEFT", "UI_RIGHT", "UI_CONFIRM", "UI_BACK"],
    evento => {
      switch (evento.action) {
        case "UI_BACK":
          aoFechar()
          return true
        case "UI_CONFIRM":
          gerenteDeFoco.activate()
          return true
        default:
          gerenteDeFoco.mover(
            evento.action === "UI_UP" ? "up"
              : evento.action === "UI_DOWN" ? "down"
                : evento.action === "UI_LEFT" ? "left" : "right",
            // Sem animação durante repetição: com o D-pad segurado, animar cada
            // passo faz a grade arrastar atrás do foco e parece travamento.
            !evento.repetida,
          )
          return true
      }
    },
    { prioridade: PRIORIDADE.MENU_RAPIDO, contexto: "QUICK_MENU" },
  )

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center uf-veu animate-in fade-in duration-150"
      // A ponte de modais (gamepad-modal-bridge) trata qualquer sobreposição
      // fixa como modal genérico. Aqui ela atrapalharia: este menu já cuida do
      // próprio input, e as duas juntas moveriam o foco duas casas por aperto.
      data-gamepad-modal="off"
    >
      <div className="w-[min(92vw,860px)] rounded-2xl border border-white/10 bg-[#0a0e1a]/95 p-[calc(1.5rem*var(--uf-spacing-scale,1))] shadow-2xl">
        <h2 className="mb-4 text-[calc(0.8rem*var(--uf-font-scale,1))] font-semibold uppercase tracking-[0.2em] text-white/50">
          Menu rápido
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {DESTINOS.map((d, i) => (
            <ItemDoMenuRapido key={d.href} {...d} indice={i} ativo={d.href === atual} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ItemDoMenuRapido({
  icone: Icone,
  rotulo,
  href,
  indice,
  ativo,
}: {
  icone: React.ComponentType<{ className?: string }>
  rotulo: string
  href: string
  indice: number
  ativo: boolean
}) {
  const { ref, emFoco } = useFocavel(`menu-rapido-${href}`, {
    aoAtivar: () => hardNavigate(href),
    // A tela em que já estamos recebe o foco inicial: assim o menu abre "onde
    // você está" e não no primeiro item, que seria um salto sem motivo.
    prioridadeInicial: ativo ? 10 : indice === 0 ? 1 : 0,
  })

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => hardNavigate(href)}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 text-left transition-colors",
        "min-h-[calc(3rem*var(--uf-target-scale,1))]",
        "text-[calc(0.9rem*var(--uf-font-scale,1))]",
        emFoco || ativo
          ? "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-white"
          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20",
      )}
    >
      <Icone className="h-5 w-5 shrink-0 opacity-80" />
      <span className="truncate font-medium">{rotulo}</span>
    </button>
  )
}
