"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  Users,
  CalendarDays,
  Trophy,
  Wallet,
  ShoppingCart,
  Mail,
  History,
  Settings,
  BarChart3,
  Dumbbell,
  FileText,
  Crosshair,
  Heart,
  Mic,
  ClipboardList,
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"


const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: Users, label: "Elenco", href: "/elenco" },
  { icon: Crosshair, label: "Taticas", href: "/taticas" },
  { icon: Dumbbell, label: "Treinamento", href: "/treinamento" },
  { icon: FileText, label: "Contratos", href: "/contratos" },
  { icon: CalendarDays, label: "Calendario", href: "/calendario" },
  { icon: Trophy, label: "Competicoes", href: "/competicoes" },
  { icon: Target, label: "Adversarios", href: "/adversarios" },
  { icon: BarChart3, label: "Estatisticas", href: "/estatisticas" },
  { icon: ClipboardList, label: "Relatorios", href: "/relatorios" },
  { icon: Heart, label: "Vestiario", href: "/vestiario" },
  { icon: Mic, label: "Imprensa", href: "/imprensa" },
  { icon: Wallet, label: "Financas", href: "/financas" },
  { icon: ShoppingCart, label: "Mercado", href: "/mercado" },
  { icon: Mail, label: "Mensagens", href: "/mensagens", badge: 3 },
  { icon: History, label: "Historico", href: "/historico" },
  { icon: Settings, label: "Configuracoes", href: "/configuracoes" },
]

export function GameSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-[72px] flex-col items-center bg-[#0d0d0d]/95 backdrop-blur-sm py-3">
      {/* Logo UF26 - Sem circulo, estilo limpo */}
      <Link 
        href="/"
        className="mb-4 flex h-12 w-14 items-center justify-center transition-all hover:opacity-80"
      >
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo%20-%20UF26-PgrXUhQ0ZaH6AlitOWzutXO1SK42me.png"
          alt="UF26"
          width={56}
          height={24}
          className="object-contain"
          style={{ width: 'auto', height: 'auto' }}
          priority
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

    </aside>
  )
}
