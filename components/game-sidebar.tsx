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
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: Users, label: "Elenco", href: "/elenco" },
  { icon: BookOpen, label: "Calendário", href: "/calendario" },
  { icon: PlayCircle, label: "Partida", href: "/partida" },
  { icon: Trophy, label: "Competições", href: "/competicoes" },
  { icon: CircleDollarSign, label: "Finanças", href: "/financas" },
  { icon: Shirt, label: "Mercado", href: "/mercado" },
  { icon: Mail, label: "Mensagens", href: "/mensagens" },
  { icon: Award, label: "Histórico", href: "/historico" },
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
]

export function GameSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-16 flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
      {/* Logo */}
      <div className="mb-6 flex h-10 w-10 items-center justify-center">
        <div className="font-display-italic text-[10px] leading-none text-primary">
          ULTRA
          <br />
          SPORT
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map(({ icon: Icon, label, href }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-md transition-all",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_12px_oklch(0.82_0.15_200_/_0.8)]" />
              )}
              <Icon className="h-[18px] w-[18px]" />
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
