"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useRef, useState } from "react"
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
  Menu,
  X,
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

function useNavItems(): NavItemDef[] {
  const t = useTranslation()
  const { state } = useGameState()
  const pendingOffers = state.pendingNationalOffers?.length ?? 0

  return [
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
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

export function GameSidebar() {
  const pathname = usePathname()
  const navItems = useNavItems()

  return (
    <>
    <aside className="fixed left-0 top-0 bottom-0 z-40 hidden w-[68px] flex-col items-center bg-[#0a0a0c] py-4 border-r border-white/[0.06] md:flex">
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
        {navItems.map(({ icon, label, href, badge }) => (
          <SidebarNavItem key={href} icon={icon} label={label} href={href} active={isActive(pathname, href)} badge={badge} />
        ))}
      </nav>
    </aside>

    {/* Barra de navegacao inferior (mobile) */}
    <MobileNav />
    </>
  )
}

// Itens principais exibidos na barra inferior no mobile.
const MOBILE_PRIMARY: string[] = ["/", "/elenco", "/calendario", "/mercado"]

function MobileNav() {
  const pathname = usePathname()
  const navItems = useNavItems()
  const [menuOpen, setMenuOpen] = useState(false)

  const primary = MOBILE_PRIMARY.map(href => navItems.find(i => i.href === href)!).filter(Boolean)
  const moreActive = !primary.some(i => isActive(pathname, i.href))

  return (
    <>
      {/* Overlay + menu completo */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-white/[0.08] bg-[#0a0a0c] pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 shadow-2xl animate-slide-up">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" />
            <div className="flex items-center justify-between px-5 py-2">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="grid grid-cols-4 gap-1 px-3 pb-2">
              {navItems.map(({ icon: Icon, label, href, badge }) => {
                const active = isActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-center transition-colors",
                      active ? "bg-[#00ffc8]/15 text-[#00ffc8]" : "text-white/60 hover:bg-white/5 active:bg-white/10",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-tight">{label}</span>
                    {badge && badge > 0 ? (
                      <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00ffc8] px-1 text-[9px] font-bold text-[#050508]">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Barra fixa inferior */}
      <nav
        aria-label="Navegacao principal"
        className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-stretch border-t border-white/[0.06] bg-[#0a0a0c]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.map(({ icon: Icon, label, href, badge }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                active ? "text-[#00ffc8]" : "text-white/45 active:text-white/80",
              )}
            >
              {active && <span className="absolute top-0 h-[2px] w-8 rounded-full bg-[#00ffc8]" />}
              <Icon className={cn("h-[22px] w-[22px] transition-transform", active && "scale-110 drop-shadow-[0_0_8px_rgba(0,255,200,0.5)]")} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
              {badge && badge > 0 ? (
                <span className="absolute right-[22%] top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00ffc8] px-1 text-[9px] font-bold text-[#050508]">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </Link>
          )
        })}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Mais opcoes"
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
            moreActive ? "text-[#00ffc8]" : "text-white/45 active:text-white/80",
          )}
        >
          {moreActive && <span className="absolute top-0 h-[2px] w-8 rounded-full bg-[#00ffc8]" />}
          <Menu className="h-[22px] w-[22px]" />
          <span className="text-[10px] font-medium leading-none">Mais</span>
        </button>
      </nav>
    </>
  )
}
