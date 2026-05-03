"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  Users,
  CalendarDays,
  PlayCircle,
  Trophy,
  Wallet,
  Shirt,
  Mail,
  History,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getLogoUrl } from "@/lib/teams-data"

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: Users, label: "Elenco", href: "/elenco" },
  { icon: CalendarDays, label: "Calendario", href: "/calendario" },
  { icon: PlayCircle, label: "Partida", href: "/partida" },
  { icon: Trophy, label: "Competicoes", href: "/competicoes" },
  { icon: Wallet, label: "Financas", href: "/financas" },
  { icon: Shirt, label: "Mercado", href: "/mercado" },
  { icon: Mail, label: "Mensagens", href: "/mensagens", badge: 3 },
  { icon: History, label: "Historico", href: "/historico" },
  { icon: Settings, label: "Configuracoes", href: "/configuracoes" },
]

export function GameSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-[72px] flex-col items-center bg-[#0d0d0d]/95 backdrop-blur-sm py-3">
      {/* Logo Ultrafoot - EA FC style */}
      <Link 
        href="/"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] ring-1 ring-white/10 transition-all hover:ring-white/25"
      >
        <Image
          src={getLogoUrl()}
          alt="Ultrafoot"
          width={32}
          height={32}
          className="object-contain"
          unoptimized
        />
      </Link>

      {/* Divider */}
      <div className="w-8 h-px bg-white/10 mb-3" />

      {/* Nav - EA FC minimal style */}
      <nav className="flex flex-1 flex-col items-center gap-0.5 w-full px-2">
        {navItems.map(({ icon: Icon, label, href, badge }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                "group relative flex h-11 w-full items-center justify-center rounded-md transition-all duration-150",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:bg-white/5 hover:text-white/70",
              )}
            >
              {/* Active indicator bar - EA FC style */}
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-white rounded-r-full" />
              )}
              
              <Icon className={cn(
                "h-5 w-5 transition-transform duration-150",
                active && "scale-105"
              )} />

              {/* Badge - minimal style */}
              {badge && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1db954] px-1 text-[9px] font-semibold text-black">
                  {badge}
                </span>
              )}

              {/* Tooltip - EA FC dark style */}
              <span className="absolute left-full ml-2 hidden rounded bg-[#1a1a1a] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-xl group-hover:block whitespace-nowrap ring-1 ring-white/10 z-50">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom section - minimal */}
      <div className="w-8 h-px bg-white/10 mt-3 mb-3" />
      
      {/* User avatar placeholder */}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] ring-1 ring-white/10 text-white/60 text-xs font-medium">
        UF
      </div>
    </aside>
  )
}
