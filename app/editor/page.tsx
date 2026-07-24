// PHASE 6 — Editor completo (clubes, jogadores, ligas, kits, etc)
// Conteúdo licenciado fica em packs externos (lib/pack-engine.ts).

"use client"

import {
  Pencil,
  Users,
  Shield,
  Shirt,
  Building2,
  Briefcase,
  FileCog,
  Layers,
  Trophy,
  Sparkles,
  ChevronRight,
  Search,
  Package,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { useUserTeam } from "@/lib/save-system"

type Accent = "cyan" | "blue" | "green"

type EditorItem = {
  icon: typeof Shield
  title: string
  desc: string
  accent: Accent
}

type EditorGroup = {
  label: string
  caption: string
  items: EditorItem[]
}

const GROUPS: EditorGroup[] = [
  {
    label: "Competições",
    caption: "Formato e estrutura do futebol",
    items: [
      { icon: Layers, title: "Ligas", desc: "Formato, número de times, regras", accent: "cyan" },
      { icon: Trophy, title: "Copas", desc: "Mata-mata, fases, premiação", accent: "cyan" },
      { icon: FileCog, title: "Regras", desc: "Promoção, rebaixamento, prêmios", accent: "cyan" },
    ],
  },
  {
    label: "Clubes & Elenco",
    caption: "Times, jogadores e comissão",
    items: [
      { icon: Shield, title: "Clubes", desc: "Edição genérica · packs licenciados", accent: "blue" },
      { icon: Users, title: "Jogadores", desc: "Atributos, contrato, personalidade", accent: "blue" },
      { icon: Briefcase, title: "Técnicos", desc: "Atributos, identidade tática", accent: "blue" },
      { icon: Building2, title: "Estádios", desc: "Capacidade, cidade, gramado", accent: "blue" },
    ],
  },
  {
    label: "Identidade visual",
    caption: "Marca, uniformes e parceiros",
    items: [
      { icon: Shield, title: "Escudos", desc: "Upload e gerenciamento", accent: "green" },
      { icon: Shirt, title: "Uniformes", desc: "Camisa 1/2/3, mangas, calção", accent: "green" },
      { icon: Briefcase, title: "Patrocinadores", desc: "Catálogo editável", accent: "green" },
    ],
  },
]

const ACCENT: Record<Accent, { tile: string; icon: string; glow: string; ring: string }> = {
  cyan: {
    tile: "bg-[#00ffc8]/10 border-[#00ffc8]/20",
    icon: "text-[#00ffc8]",
    glow: "group-hover:shadow-[0_0_28px_-6px_rgba(0,255,200,0.45)]",
    ring: "group-hover:border-[#00ffc8]/40",
  },
  blue: {
    tile: "bg-[#0088ff]/10 border-[#0088ff]/20",
    icon: "text-[#3aa5ff]",
    glow: "group-hover:shadow-[0_0_28px_-6px_rgba(0,136,255,0.45)]",
    ring: "group-hover:border-[#0088ff]/40",
  },
  green: {
    tile: "bg-[#1db954]/10 border-[#1db954]/20",
    icon: "text-[#2fd968]",
    glow: "group-hover:shadow-[0_0_28px_-6px_rgba(29,185,84,0.4)]",
    ring: "group-hover:border-[#1db954]/40",
  },
}

const totalModules = GROUPS.reduce((n, g) => n + g.items.length, 0)

export default function EditorPage() {
  const { team } = useUserTeam()

  return (
    <div className="min-h-screen pl-0 md:pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={team} />

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-6 md:py-8 space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f1c1a] via-[#0c1414] to-[#0a0a0a] p-6 md:p-8">
          {/* accent glow */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(0,255,200,0.35), transparent 70%)" }}
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#00ffc8]">
                <Sparkles className="h-3.5 w-3.5" />
                Central de edição
              </div>
              <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-white">
                Editor
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">
                Personalize ligas, clubes, elenco e identidade visual. O conteúdo
                licenciado é carregado via packs{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white/80">
                  .ultrafoot
                </code>
                .
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                <div className="text-2xl font-black tabular-nums text-white">{totalModules}</div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/45">
                  Módulos
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-2xl font-black text-white">
                  <Package className="h-5 w-5 text-[#00ffc8]" />
                </div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/45">
                  Packs
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="text"
              placeholder="Buscar módulo do editor..."
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-[#00ffc8]/40"
            />
          </div>
        </section>

        {/* Groups */}
        {GROUPS.map((group) => (
          <section key={group.label} className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white">{group.label}</h2>
                <p className="text-xs text-white/45">{group.caption}</p>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((item) => {
                const a = ACCENT[item.accent]
                return (
                  <button
                    key={item.title}
                    className={`group relative flex items-start gap-4 rounded-xl border border-white/[0.06] bg-[#121212] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#161616] ${a.ring} ${a.glow}`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${a.tile}`}
                    >
                      <item.icon className={`h-5 w-5 ${a.icon}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{item.title}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/60" />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-white/45">{item.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        {/* Footer note */}
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <Pencil className="h-4 w-4 shrink-0 text-[#00ffc8]" />
          <p className="text-xs leading-relaxed text-white/45">
            Edições são salvas no seu save atual. Times e jogadores reais chegam
            por packs da comunidade — sem conteúdo licenciado embutido.
          </p>
        </div>
      </main>
    </div>
  )
}
