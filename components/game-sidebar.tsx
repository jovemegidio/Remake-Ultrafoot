"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useRef } from "react"
import {
  LayoutGrid,
  Users,
  CalendarDays,
  Trophy,
  Wallet,
  ShoppingCart,
  Settings,
  BarChart3,
  Dumbbell,
  Heart,
  Search,
  Building2,
  Flag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useGamepadFocusable } from "@/components/gamepad-provider"
import { useTranslation } from "@/lib/i18n"
import { hardNavigate } from "@/lib/hard-navigation"
import { useGameState } from "@/lib/save-system"

type NavItemDef = { icon: React.ComponentType<{ className?: string }>; label: string; href: string; badge?: number }

function SidebarNavItem({ icon: Icon, label, href, active, badge }: NavItemDef & { active: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const focusable = useGamepadFocusable(`sidebar-${href}`, ref as React.RefObject<HTMLElement | null>, () => hardNavigate(href))

  return (
    <Link
      ref={ref}
      href={href}
      title={label}
      aria-label={label}
      tabIndex={focusable.tabIndex}
      data-gamepad-focused={focusable["data-gamepad-focused"]}
      className={cn(
        "group relative flex h-10 w-full items-center justify-center rounded-lg transition-all duration-200",
        active
          ? "bg-[#00ffc8]/15 text-[#00ffc8]"
          : "text-white/40 hover:bg-white/5 hover:text-white/70",
        focusable.isFocused && !active && "bg-[#00ffc8]/10 text-[#00ffc8] ring-1 ring-[#00ffc8]/30",
      )}
    >
      {/* Active indicator - left bar */}
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#00ffc8]" />
      )}
      {focusable.isFocused && !active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#00ffc8]" />
      )}

      <Icon className={cn(
        "h-[18px] w-[18px] transition-all duration-200",
        active && "drop-shadow-[0_0_8px_rgba(0,255,200,0.5)]",
        (active || focusable.isFocused) && "scale-110"
      )} />

      {/* Badge de notificacao */}
      {badge && badge > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00ffc8] px-1 text-[9px] font-bold text-[#050508] shadow-[0_0_8px_rgba(0,255,200,0.6)]">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}

      {/* Tooltip */}
      <span className="absolute left-full ml-3 hidden rounded-lg bg-[#050508] px-3 py-2 text-[11px] font-medium text-white shadow-xl group-hover:block whitespace-nowrap ring-1 ring-white/10 z-50 backdrop-blur-sm">
        {label}
        <span className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-[#0a0a0a]" />
      </span>
    </Link>
  )
}

export function GameSidebar() {
  // O layout estilo EA FC Manager nao usa sidebar de icones:
  // a navegacao acontece no top-nav (GameHeader). Mantido como no-op
  // para nao quebrar as ~27 telas que ainda importam este componente.
  return null
}

function GameSidebarLegacy() {
  const pathname = usePathname()
  const t = useTranslation()
  const { state } = useGameState()
  const pendingOffers = state.pendingNationalOffers?.length ?? 0

  const navItems: NavItemDef[] = [
    { icon: LayoutGrid, label: t.sidebar.dashboard, href: "/" },
    { icon: Users, label: t.sidebar.squad, href: "/elenco" },
    { icon: Dumbbell, label: t.sidebar.training, href: "/treinamento" },
    { icon: CalendarDays, label: t.sidebar.calendar, href: "/calendario" },
    { icon: Trophy, label: t.sidebar.competitions, href: "/competicoes" },
    { icon: Flag, label: t.sidebar.nationalTeam, href: "/selecao", badge: pendingOffers },
    { icon: Search, label: t.sidebar.scouts, href: "/olheiros" },
    { icon: Building2, label: t.sidebar.infrastructure, href: "/infraestrutura" },
    { icon: BarChart3, label: t.sidebar.statistics, href: "/estatisticas" },
    { icon: Heart, label: t.sidebar.clubCenter, href: "/central" },
    { icon: Wallet, label: t.sidebar.finances, href: "/financas" },
    { icon: ShoppingCart, label: t.sidebar.market, href: "/mercado" },
    { icon: Settings, label: t.sidebar.settings, href: "/configuracoes" },
  ]

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-[68px] flex-col items-center bg-[#0a0a0c] py-4 border-r border-white/[0.06]">
      {/* Logo */}
      <Link
        href="/"
        className="mb-4 flex h-11 w-14 items-center justify-center transition-all hover:opacity-80 group"
      >
        <Image
          src="/logo.png"
          alt="UF26"
          width={52}
          height={22}
          className="object-contain transition-transform group-hover:scale-105"
          style={{ width: 'auto', height: 'auto' }}
          priority
          unoptimized
        />
      </Link>

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 mb-3" />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1 w-full px-2 overflow-visible scrollbar-none">
        {navItems.map(({ icon, label, href, badge }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <SidebarNavItem key={href} icon={icon} label={label} href={href} active={active} badge={badge} />
          )
        })}
      </nav>
    </aside>
  )
}
