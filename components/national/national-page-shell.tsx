"use client"

// Moldura comum das telas da seleção (convocação, competições, amistosos).
//
// Todas precisam do mesmo trio: cabeçalho com o time atual, botão B do controle
// voltando ao escritório e uma GUARDA — quem não comanda seleção nenhuma não
// pode cair numa tela vazia, volta para /selecao (onde as propostas aparecem).

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, type LucideIcon } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { NationalCrest } from "@/components/national/national-crest"
import { useUserTeam } from "@/lib/save-system"
import { useNationalTeam } from "@/lib/use-national-team"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { hardNavigate } from "@/lib/hard-navigation"
import { CONFEDERATION_LABEL, type NationalTeam } from "@/lib/national-teams"

export function NationalPageShell({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
  children: (nationalTeam: NationalTeam) => ReactNode
}) {
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })

  const { team: userTeam, hydrated: teamHydrated } = useUserTeam()
  const { hydrated, hasNationalTeam, nationalTeam } = useNationalTeam()

  // Sem seleção no comando não há o que gerenciar aqui.
  useEffect(() => {
    if (hydrated && !hasNationalTeam) hardNavigate("/selecao")
  }, [hydrated, hasNationalTeam])

  if (!hydrated || !teamHydrated || !nationalTeam) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050508]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#00ffc8] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050508] pb-20 md:pb-0">
      <GameHeader team={userTeam} />

      <main className="scrollbar-premium flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white"
            aria-label="Voltar ao escritório"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <NationalCrest team={nationalTeam} size={44} />
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
              <Icon className="h-5 w-5 text-[#00ffc8]" /> {title}
            </h1>
            <p className="truncate text-sm text-white/50">
              {nationalTeam.name} · {CONFEDERATION_LABEL[nationalTeam.confederation]} — {subtitle}
            </p>
          </div>
        </div>

        {children(nationalTeam)}
      </main>
    </div>
  )
}
