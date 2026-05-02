"use client"

import Link from "next/link"
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

type NavColor = "primary" | "accent" | "gold" | "muted"

const navGroups: { label: string; items: { icon: any; label: string; href: string; color: NavColor; badge?: number }[] }[] = [
  {
    label: "CLUBE",
    items: [
      { icon: LayoutGrid, label: "Dashboard", href: "/", color: "primary" },
      { icon: Users, label: "Elenco", href: "/elenco", color: "primary" },
      { icon: CalendarDays, label: "Calendario", href: "/calendario", color: "primary" },
    ],
  },
  {
    label: "JOGO",
    items: [
      { icon: PlayCircle, label: "Partida", href: "/partida", color: "accent" },
      { icon: Trophy, label: "Competicoes", href: "/competicoes", color: "gold" },
    ],
  },
  {
    label: "GESTAO",
    items: [
      { icon: Wallet, label: "Financas", href: "/financas", color: "primary" },
      { icon: Shirt, label: "Mercado", href: "/mercado", color: "primary" },
      { icon: Mail, label: "Mensagens", href: "/mensagens", color: "primary", badge: 3 },
      { icon: History, label: "Historico", href: "/historico", color: "primary" },
    ],
  },
]

const settingsItem = { icon: Settings, label: "Configuracoes", href: "/configuracoes", color: "muted" as const }

export function GameSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-16 flex-col items-center border-r border-sidebar-border bg-sidebar">
      {/* Logo Ultrafoot - sem moldura */}
      <Link
        href="/"
        className="mt-3 mb-4 flex h-11 w-11 items-center justify-center transition-all duration-200 hover:scale-110"
        aria-label="Ultrafoot - Inicio"
      >
        <img
          src={getLogoUrl() || "/placeholder.svg"}
          alt="Ultrafoot"
          width={44}
          height={44}
          className="h-full w-full object-contain drop-shadow-[0_0_8px_oklch(0.78_0.18_195_/_0.4)]"
        />
      </Link>

      {/* Top diagonal accent */}
      <div className="h-px w-8 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Nav grouped */}
      <nav className="flex flex-1 flex-col items-center gap-3 mt-4 w-full px-2">
        {navGroups.map((group, groupIdx) => (
          <div key={group.label} className="flex flex-col items-center gap-1 w-full">
            {groupIdx > 0 && (
              <div className="h-px w-6 bg-sidebar-border my-1" />
            )}
            {group.items.map(({ icon: Icon, label, href, color, badge }) => (
              <NavItem
                key={href}
                Icon={Icon}
                label={label}
                href={href}
                color={color}
                badge={badge}
                active={href === "/" ? pathname === "/" : pathname.startsWith(href)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom block */}
      <div className="flex flex-col items-center gap-1 w-full px-2 pb-3">
        <div className="h-px w-6 bg-sidebar-border my-1" />
        <NavItem
          Icon={settingsItem.icon}
          label={settingsItem.label}
          href={settingsItem.href}
          color={settingsItem.color}
          active={pathname.startsWith(settingsItem.href)}
        />
        <button
          title="Ultrafoot Premium"
          aria-label="Ultrafoot Premium"
          className="group relative flex h-10 w-10 items-center justify-center rounded-md text-gold/60 transition-all hover:bg-gold/10 hover:text-gold mt-1"
        >
          <Sparkles className="h-[18px] w-[18px]" />
          <span className="absolute left-full ml-3 hidden rounded-md bg-card px-2 py-1 text-xs font-medium text-foreground shadow-lg group-hover:block whitespace-nowrap border border-border z-50">
            Premium
          </span>
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  Icon,
  label,
  href,
  color,
  active,
  badge,
}: {
  Icon: any
  label: string
  href: string
  color: NavColor
  active: boolean
  badge?: number
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-md transition-all duration-200",
        active
          ? color === "accent"
            ? "bg-accent/15 text-accent"
            : color === "gold"
              ? "bg-gold/15 text-gold"
              : color === "muted"
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "bg-primary/15 text-primary"
          : "text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {/* Active EAFC-style diagonal indicator */}
      {active && (
        <span
          className={cn(
            "absolute -left-2 top-1/2 h-7 w-[3px] -translate-y-1/2",
            color === "accent"
              ? "bg-accent shadow-[0_0_10px_oklch(0.85_0.22_140_/_0.9)]"
              : color === "gold"
                ? "bg-gold shadow-[0_0_10px_oklch(0.80_0.18_85_/_0.9)]"
                : color === "muted"
                  ? "bg-sidebar-foreground"
                  : "bg-primary shadow-[0_0_10px_oklch(0.78_0.18_195_/_0.9)]",
          )}
          style={{ clipPath: "polygon(0 0, 100% 10%, 100% 90%, 0 100%)" }}
        />
      )}

      <Icon className="h-[18px] w-[18px]" />

      {/* Badge */}
      {badge && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground shadow-glow-accent/40">
          {badge}
        </span>
      )}

      {/* Tooltip */}
      <span className="absolute left-full ml-3 hidden rounded-md bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-lg group-hover:block whitespace-nowrap border border-border z-50">
        {label}
      </span>
    </Link>
  )
}
