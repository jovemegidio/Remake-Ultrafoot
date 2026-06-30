// PHASE 6 — Editor completo (clubes, jogadores, ligas, kits, etc)
// Status: skeleton. Conteúdo licenciado fica em packs externos (lib/pack-engine.ts).

"use client"

import { Pencil, Users, Shield, Shirt, Building2, Briefcase, FileCog, Layers } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { useUserTeam } from "@/lib/save-system"

const SECTIONS = [
  { icon: Shield, title: "Clubes", desc: "Edição genérica · packs licenciados externos" },
  { icon: Users, title: "Jogadores", desc: "Atributos, contrato, personalidade" },
  { icon: Layers, title: "Ligas", desc: "Formato, número de times, regras" },
  { icon: Shield, title: "Copas", desc: "Mata-mata, fases, premiação" },
  { icon: Shield, title: "Escudos", desc: "Upload e gerenciamento" },
  { icon: Shirt, title: "Uniformes", desc: "Camisa 1/2/3, mangas, calção" },
  { icon: Briefcase, title: "Técnicos", desc: "Atributos, identidade tática" },
  { icon: Building2, title: "Estádios", desc: "Capacidade, cidade, gramado" },
  { icon: Briefcase, title: "Patrocinadores", desc: "Catálogo editável" },
  { icon: FileCog, title: "Regras", desc: "Promoção, rebaixamento, prêmios" },
]

export default function EditorPage() {
  const { team } = useUserTeam()

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={team} />
      <main className="p-6 space-y-6">
        <header className="flex items-center gap-3">
          <Pencil className="h-7 w-7 text-blue-400" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">EDITOR</h1>
            <p className="text-white/50 mt-1">Base genérica · Licenciado vem via packs <code className="font-mono">.ultrafoot</code></p>
          </div>
        </header>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-200/80 text-sm">
          Skeleton (Fase 6 + Fase 7). API de pack em <code className="font-mono">lib/pack-engine.ts</code>.
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SECTIONS.map(s => (
            <div key={s.title} className="rounded-xl bg-[#141414] border border-white/5 p-4">
              <s.icon className="h-5 w-5 text-blue-400" />
              <div className="mt-3 text-sm font-semibold text-white">{s.title}</div>
              <div className="mt-1 text-xs text-white/40">{s.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
