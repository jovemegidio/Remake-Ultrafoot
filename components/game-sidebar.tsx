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
<<<<<<< HEAD
  Sparkles,
=======
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getLogoUrl } from "@/lib/teams-data"

const navItems = [
<<<<<<< HEAD
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
=======
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
]

export function GameSidebar() {
  const pathname = usePathname()

  return (
<<<<<<< HEAD
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-16 flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
      {/* Logo Ultrafoot */}
      <Link 
        href="/"
        className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 p-1.5 transition-all hover:scale-105 hover:shadow-glow-primary"
=======
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-[72px] flex-col items-center bg-[#0d0d0d]/95 backdrop-blur-sm py-3">
      {/* Logo Ultrafoot - EA FC style */}
      <Link 
        href="/"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] ring-1 ring-white/10 transition-all hover:ring-white/25"
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
      >
        <Image
          src={getLogoUrl()}
          alt="Ultrafoot"
<<<<<<< HEAD
          width={40}
          height={40}
=======
          width={32}
          height={32}
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
          className="object-contain"
          unoptimized
        />
      </Link>

<<<<<<< HEAD
      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map(({ icon: Icon, label, href, color, badge }) => {
=======
      {/* Divider */}
      <div className="w-8 h-px bg-white/10 mb-3" />

      {/* Nav - EA FC minimal style */}
      <nav className="flex flex-1 flex-col items-center gap-0.5 w-full px-2">
        {navItems.map(({ icon: Icon, label, href, badge }) => {
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
<<<<<<< HEAD
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
=======
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
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                  {badge}
                </span>
              )}

<<<<<<< HEAD
              {/* Tooltip */}
              <span className="absolute left-full ml-3 hidden rounded-md bg-card px-2 py-1 text-xs font-medium text-foreground shadow-lg group-hover:block whitespace-nowrap border border-border">
=======
              {/* Tooltip - EA FC dark style */}
              <span className="absolute left-full ml-2 hidden rounded bg-[#1a1a1a] px-2.5 py-1.5 text-[11px] font-medium text-white shadow-xl group-hover:block whitespace-nowrap ring-1 ring-white/10 z-50">
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

<<<<<<< HEAD
      {/* Premium badge */}
      <div className="mt-auto mb-2">
        <button
          title="Ultrafoot Premium"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gold/60 transition-all hover:bg-gold/10 hover:text-gold"
        >
          <Sparkles className="h-[18px] w-[18px]" />
        </button>
=======
      {/* Bottom section - minimal */}
      <div className="w-8 h-px bg-white/10 mt-3 mb-3" />
      
      {/* User avatar placeholder */}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] ring-1 ring-white/10 text-white/60 text-xs font-medium">
        UF
>>>>>>> bfedf7d (Atualizar estrutura do projeto)
      </div>
    </aside>
  )
}
