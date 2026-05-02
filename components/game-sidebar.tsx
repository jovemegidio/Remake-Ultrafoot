"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  Users,
  BookOpen,
  PlayCircle,
  Trophy,
  CircleDollarSign,
  Shirt,
  Mail,
  Award,
  Settings,
  Gamepad2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: Users, label: "Elenco", href: "/elenco" },
  { icon: BookOpen, label: "Calendario", href: "/calendario" },
  { icon: PlayCircle, label: "Partida", href: "/partida" },
  { icon: Trophy, label: "Competicoes", href: "/competicoes" },
  { icon: CircleDollarSign, label: "Financas", href: "/financas" },
  { icon: Shirt, label: "Mercado", href: "/mercado" },
  { icon: Mail, label: "Mensagens", href: "/mensagens" },
  { icon: Award, label: "Historico", href: "/historico" },
  { icon: Settings, label: "Configuracoes", href: "/configuracoes" },
]

export function GameSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-16 flex-col items-center border-r border-border/50 bg-sidebar py-4">
      {/* Background effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      {/* Logo */}
      <div className="relative mb-8 flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-glow-primary">
          <Gamepad2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="mt-2 font-display text-[7px] tracking-[0.3em] text-primary">
          ULTRA
        </div>
      </div>

      {/* Nav */}
      <nav className="relative flex flex-1 flex-col items-center gap-1.5">
        {navItems.map(({ icon: Icon, label, href }) => {
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
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              {/* Active indicator */}
              {active && (
                <>
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-glow-primary" />
                  <span className="absolute inset-0 rounded-lg bg-primary/10 animate-pulse" style={{ animationDuration: "2s" }} />
                </>
              )}
              <Icon className={cn("h-[18px] w-[18px] transition-transform", active && "scale-110")} />
              
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded bg-card border border-border text-[11px] font-display tracking-wider text-foreground opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom accent */}
      <div className="mt-auto pt-4">
        <div className="h-1 w-6 rounded-full bg-gradient-to-r from-primary via-accent to-primary opacity-50" />
      </div>
    </aside>
  )
}
