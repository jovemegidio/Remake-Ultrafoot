"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useGamepadFocusable } from "@/components/gamepad-provider"

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: Users, label: "Elenco", href: "/elenco" },
  { icon: Dumbbell, label: "Treinamento", href: "/treinamento" },
  { icon: CalendarDays, label: "Calendario", href: "/calendario" },
  { icon: Trophy, label: "Competicoes", href: "/competicoes" },
  { icon: Search, label: "Olheiros", href: "/olheiros" },
  { icon: Building2, label: "Infraestrutura", href: "/infraestrutura" },
  { icon: BarChart3, label: "Estatisticas", href: "/estatisticas" },
  { icon: Heart, label: "Central do Clube", href: "/central" },
  { icon: Wallet, label: "Financas", href: "/financas" },
  { icon: ShoppingCart, label: "Mercado", href: "/mercado" },
  { icon: Settings, label: "Configuracoes", href: "/configuracoes" },
]

type NavItemDef = { icon: React.ComponentType<{ className?: string }>; label: string; href: string }

function SidebarNavItem({ icon: Icon, label, href, active }: NavItemDef & { active: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const router = useRouter()
  const focusable = useGamepadFocusable(`sidebar-${href}`, ref as React.RefObject<HTMLElement | null>, () => router.push(href))

  return (
    <Link
      ref={ref}
      href={href}
      title={label}
      aria-label={label}
      tabIndex={focusable.tabIndex}
      data-gamepad-focused={focusable["data-gamepad-focused"]}
      className={cn(
        "group relative flex h-9 w-full items-center justify-center rounded-md transition-all duration-150",
        active
          ? "bg-white/10 text-white"
          : "text-white/40 hover:bg-white/5 hover:text-white/70",
        focusable.isFocused && !active && "bg-[#1db954]/10 text-[#1db954]",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-white rounded-r-full" />
      )}
      {focusable.isFocused && !active && (
        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-[#1db954] rounded-r-full" />
      )}

      <Icon className={cn(
        "h-4 w-4 transition-transform duration-150",
        (active || focusable.isFocused) && "scale-105"
      )} />

      <span className="absolute left-full ml-2 hidden rounded bg-[#1a1a1a] px-2.5 py-1.5 text-[10px] font-medium text-white shadow-xl group-hover:block whitespace-nowrap ring-1 ring-white/10 z-50">
        {label}
      </span>
    </Link>
  )
}

export function GameSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-16 flex-col items-center bg-[#0d0d0d]/95 backdrop-blur-sm py-3">
      <Link
        href="/"
        className="mb-3 flex h-10 w-12 items-center justify-center transition-all hover:opacity-80"
      >
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo%20-%20UF26-PgrXUhQ0ZaH6AlitOWzutXO1SK42me.png"
          alt="UF26"
          width={48}
          height={20}
          className="object-contain"
          style={{ width: 'auto', height: 'auto' }}
          priority
          unoptimized
        />
      </Link>

      <div className="w-7 h-px bg-white/10 mb-2" />

      <nav className="flex flex-1 flex-col items-center gap-0.5 w-full px-1.5">
        {navItems.map(({ icon, label, href }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <SidebarNavItem key={href} icon={icon} label={label} href={href} active={active} />
          )
        })}
      </nav>
    </aside>
  )
}
