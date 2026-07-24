"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import {
  Home,
  Users,
  Search,
  CalendarDays,
  LayoutGrid,
  X,
  Shield,
  Swords,
  ClipboardList,
  ArrowLeftRight,
  Binoculars,
  FileText,
  FileSignature,
  Dumbbell,
  Sprout,
  Wallet,
  BarChart3,
  Trophy,
  History,
  Handshake,
  Newspaper,
  Building2,
  Radio,
  Star,
  Flag,
  Target,
  Settings,
  Save,
  PenSquare,
  Bell,
  MessageSquare,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { hardNavigate } from "@/lib/hard-navigation"

// Rotas onde a navegacao mobile NAO deve aparecer (fluxos de tela cheia / fora do jogo).
const HIDDEN_PREFIXES = [
  "/splash",
  "/novo-jogo",
  "/pre-office",
  "/campeao",
  "/editar",
  "/partida/ao-vivo",
  "/partida/escalacao",
]

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  // Prefixos extras que tambem marcam este item como ativo.
  match?: string[]
}

const PRIMARY: NavItem[] = [
  { label: "Inicio", href: "/", icon: Home, match: ["/central", "/central-da-temporada"] },
  { label: "Elenco", href: "/elenco", icon: Users, match: ["/taticas", "/vestiario", "/adversarios"] },
  { label: "Mercado", href: "/mercado", icon: Search, match: ["/transferencias", "/olheiros", "/relatorios", "/contratos"] },
  { label: "Calendario", href: "/calendario", icon: CalendarDays, match: ["/partida"] },
]

interface MoreSection {
  title: string
  items: NavItem[]
}

const MORE_SECTIONS: MoreSection[] = [
  {
    title: "Elenco & Taticas",
    items: [
      { label: "Visao Geral", href: "/elenco", icon: Users },
      { label: "Escalacoes", href: "/elenco/escalacoes", icon: ClipboardList },
      { label: "Taticas", href: "/elenco/taticas", icon: Swords },
      { label: "Gerenciamento", href: "/elenco/gerenciamento", icon: Shield },
      { label: "Vestiario", href: "/vestiario", icon: Users },
      { label: "Adversarios", href: "/adversarios", icon: Target },
    ],
  },
  {
    title: "Transferencias",
    items: [
      { label: "Visao Geral", href: "/transferencias", icon: ArrowLeftRight },
      { label: "Buscar Atletas", href: "/mercado", icon: Search },
      { label: "Olheiros", href: "/olheiros", icon: Binoculars },
      { label: "Relatorios", href: "/relatorios", icon: FileText },
      { label: "Contratos", href: "/contratos", icon: FileSignature },
    ],
  },
  {
    title: "Academia",
    items: [
      { label: "Treinamento", href: "/treinamento", icon: Dumbbell },
      { label: "Base", href: "/base", icon: Sprout },
    ],
  },
  {
    title: "Escritorio",
    items: [
      { label: "Financas", href: "/financas", icon: Wallet },
      { label: "Estatisticas", href: "/estatisticas", icon: BarChart3 },
      { label: "Competicoes", href: "/competicoes", icon: Trophy },
      { label: "Calendario", href: "/calendario", icon: CalendarDays },
      { label: "Historico", href: "/historico", icon: History },
      { label: "Reunioes", href: "/reunioes", icon: Handshake },
      { label: "Imprensa", href: "/imprensa", icon: Newspaper },
      { label: "Infraestrutura", href: "/infraestrutura", icon: Building2 },
    ],
  },
  {
    title: "Central & Clube",
    items: [
      { label: "Central", href: "/central", icon: Radio },
      { label: "Temporada", href: "/central-da-temporada", icon: Star },
      { label: "Desafios", href: "/desafios", icon: Flag },
      { label: "Clube", href: "/clube", icon: Shield },
      { label: "Selecao", href: "/selecao", icon: Flag },
      { label: "Partida", href: "/partida", icon: Swords },
    ],
  },
  {
    title: "Comunicacao & Sistema",
    items: [
      { label: "Notificacoes", href: "/notificacoes", icon: Bell },
      { label: "Mensagens", href: "/mensagens", icon: MessageSquare },
      { label: "Configuracoes", href: "/configuracoes", icon: Settings },
      { label: "Salvar", href: "/salvar", icon: Save },
      { label: "Editor", href: "/editor", icon: PenSquare },
    ],
  },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") {
    if (pathname === "/") return true
  } else if (pathname === item.href || pathname.startsWith(item.href + "/")) {
    return true
  }
  return (item.match ?? []).some((m) => pathname === m || pathname.startsWith(m + "/"))
}

export function MobileBottomNav() {
  const pathname = usePathname() || "/"
  const [moreOpen, setMoreOpen] = useState(false)

  // Fecha o menu ao trocar de rota.
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  // Trava o scroll do body enquanto o menu esta aberto e permite fechar com Esc.
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [moreOpen])

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return null
  }

  const go = (href: string) => {
    setMoreOpen(false)
    hardNavigate(href)
  }

  const moreActive = !PRIMARY.some((item) => isActive(pathname, item))

  return (
    <>
      {/* Menu "Mais" — folha inferior com todas as secoes agrupadas */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[70] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegacao"
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0a0a0f] pb-[env(safe-area-inset-bottom)] shadow-2xl animate-slide-up">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0a0f]/95 px-4 py-3 backdrop-blur-xl">
              <span className="text-sm font-bold uppercase tracking-wider text-white">Menu</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-4 py-4">
              {MORE_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map((item) => {
                      const active = isActive(pathname, item)
                      const Icon = item.icon
                      return (
                        <button
                          key={item.href + item.label}
                          type="button"
                          onClick={() => go(item.href)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                            active
                              ? "border-[#00ffc8]/40 bg-[#00ffc8]/10 text-[#00ffc8]"
                              : "border-white/[0.06] bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior fixa (somente mobile) */}
      <nav
        aria-label="Navegacao principal"
        className="fixed inset-x-0 bottom-0 z-[60] flex md:hidden border-t border-white/[0.08] bg-[#070708]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      >
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item)
          const Icon = item.icon
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => go(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
                active ? "text-[#00ffc8]" : "text-white/50 hover:text-white/80",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
            moreActive ? "text-[#00ffc8]" : "text-white/50 hover:text-white/80",
          )}
        >
          <LayoutGrid className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Mais</span>
        </button>
      </nav>
    </>
  )
}
