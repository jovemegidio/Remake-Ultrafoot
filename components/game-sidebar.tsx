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
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getLogoUrl } from "@/lib/teams-data"

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/", color: "primary" },
  { icon: Users, label: "Elenco", href: "/elenco", color: "primary" },
  { icon: CalendarDays, label: "Calendario", href: "/calendario", color: "primary" },
  { icon: PlayCircle, label: "Partida", href: "/partida", color: "accent" },
  { icon: Trophy, label: "Competicoes", href: "/competicoes", color: "gold" },
  { icon: Wallet, label: "Financas", href: "/financas", color: "primary" },
  { icon: Shirt, label: "Mercado", href: "/mercado", color: "primary" },
  { icon: Mail, label: "Mensagens", href: "/mensagens", color: "primary", badge: 3 },
  { icon: History, label: "Historico", href: "/historico", color: "primary" },
  { icon: Settings, label: "Configuracoes", href: "/configuracoes", color: "muted" },
]

export function GameSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-16 flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
      {/* Logo Ultrafoot */}
      <Link 
        href="/"
        className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 p-1.5 transition-all hover:scale-105 hover:shadow-glow-primary"
      >
        <Image
          src={getLogoUrl()}
          alt="Ultrafoot"
          width={40}
          height={40}
          className="object-contain"
          unoptimized
        />
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map(({ icon: Icon, label, href, color, badge }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                active
                  ? color === "accent" 
                    ? "bg-accent/15 text-accent shadow-glow-accent/20"
                    : color === "gold"
                    ? "bg-gold/15 text-gold"
                    : "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              {/* Active indicator */}
              {active && (
                <span 
                  className={cn(
                    "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full",
                    color === "accent" ? "bg-accent shadow-[0_0_12px_oklch(0.85_0.22_140_/_0.8)]" :
                    color === "gold" ? "bg-gold shadow-[0_0_12px_oklch(0.80_0.18_85_/_0.8)]" :
                    "bg-primary shadow-[0_0_12px_oklch(0.78_0.18_195_/_0.8)]"
                  )} 
                />
              )}
              
              <Icon className="h-[18px] w-[18px]" />

              {/* Badge */}
              {badge && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                  {badge}
                </span>
              )}

              {/* Tooltip */}
              <span className="absolute left-full ml-3 hidden rounded-md bg-card px-2 py-1 text-xs font-medium text-foreground shadow-lg group-hover:block whitespace-nowrap border border-border">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Premium badge */}
      <div className="mt-auto mb-2">
        <button
          title="Ultrafoot Premium"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gold/60 transition-all hover:bg-gold/10 hover:text-gold"
        >
          <Sparkles className="h-[18px] w-[18px]" />
        </button>
      </div>
    </aside>
  )
}
