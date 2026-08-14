"use client"

// A MESA — quem já fechou, de quem é a vez, e o que falta para a rodada andar.
//
// ⚠️ ESTE PAINEL NÃO AGE MAIS, ele INFORMA. A ação ("fechar e passar a vez") era
// um botão aqui dentro, e isso estava errado por dois motivos:
//
//  1. Ficava escondido. O jogador clicava "Avançar", ouvia que a rodada não
//     podia andar, e a única saída morava dentro de um menu que nada indicava.
//  2. Duplicava o sentido de "Avançar". Numa mesa, "eu acabei" e "avançar" são a
//     mesma intenção — separá-los obrigava a aprender uma regra do jogo em vez
//     de uma regra do futebol.
//
// Hoje o próprio "Avançar" fecha as decisões e entrega o computador (ver
// `game-header.tsx`), e aqui fica só o estado da mesa. O que sobrou de ação é o
// caminho de volta — reabrir as decisões antes de a rodada rodar —, que não tem
// outro lugar natural.
//
// Some por completo em carreira de um técnico só.

import { useMemo, useState } from "react"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { useGameManager } from "@/lib/use-game-manager"
import {
  ehMultitecnico, faltamFechar, iniciarRodada, tecnicosDoSave,
} from "@/lib/tecnicos-do-save"

export function TrocaDeVez({ className }: { className?: string }) {
  const { state } = useGameState()
  const { reabrirMinhasDecisoes } = useGameManager()
  const [aberto, setAberto] = useState(false)

  const tecnicos = useMemo(
    () => tecnicosDoSave(state.tecnicos, state.managerName, state.selectedTeamShort),
    [state.tecnicos, state.managerName, state.selectedTeamShort],
  )
  const rodada = state.rodadaCompartilhada ?? iniciarRodada(state.week)
  const euId = state.tecnicoAtivoId ?? tecnicos[0]?.id
  const eu = tecnicos.find(t => t.id === euId) ?? null
  const humanos = tecnicos.filter(t => t.tipo === "humano")
  const faltam = useMemo(() => faltamFechar(rodada, tecnicos), [rodada, tecnicos])
  const jaFechei = Boolean(euId && rodada.prontos.includes(euId))

  if (!ehMultitecnico(tecnicos)) return null

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setAberto(v => !v)}
        title={`Mesa de ${humanos.length} técnicos — ${rodada.prontos.length} já fecharam`}
        className={cn(
          "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors",
          jaFechei
            ? "border-[var(--brand)]/40 bg-[var(--brand)]/10 text-[var(--brand)]"
            : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:text-white",
        )}
      >
        <Users className="h-3.5 w-3.5" />
        <span className="hidden md:inline">{eu?.nome ?? "Técnico"}</span>
        <span className="tabular-nums text-white/45">{rodada.prontos.length}/{humanos.length}</span>
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-white/10 bg-[#0b0d12] p-3 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/40">
            Rodada {rodada.numero} · {jaFechei ? "você já fechou" : "a vez é sua"}
          </p>

          <ul className="mt-2 space-y-1">
            {humanos.map(tec => {
              const fechou = rodada.prontos.includes(tec.id)
              return (
                <li
                  key={tec.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                    tec.id === euId ? "bg-[var(--brand)]/10 text-white" : "text-white/60",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", fechou ? "bg-[var(--brand)]" : "bg-white/25")} />
                  <span className="truncate">{tec.nome}</span>
                  {tec.id === euId && <span className="shrink-0 text-[9px] uppercase text-[var(--brand)]">você</span>}
                  <span className="ml-auto shrink-0 truncate text-[10px] text-white/35">
                    {tec.clubeNome ?? tec.clubeCurto ?? "—"}
                  </span>
                </li>
              )
            })}
          </ul>

          {/* ⚠️ NOME E CLUBE, e nada mais. Elenco, caixa e mercado de cada um
              vivem no bolso dele (lib/chaveamento-de-tecnico.ts) — um painel de
              mesa que mostrasse situação de time devolveria pela janela o que o
              modo inteiro existe para separar. */}

          <p className="mt-3 text-[11px] leading-snug text-white/55">
            {jaFechei
              ? faltam.length > 0
                ? `Falta fechar: ${faltam.map(t => t.nome).join(", ")}.`
                : "Todos fecharam — a rodada roda no próximo avanço."
              : "Ao tocar em Avançar, suas decisões fecham e o computador passa para o próximo."}
          </p>

          {jaFechei && (
            <button
              onClick={() => { reabrirMinhasDecisoes(); setAberto(false) }}
              className="mt-2 w-full rounded-lg border border-white/12 px-3 py-2 text-[11px] font-semibold text-white/70 hover:text-white"
            >
              Voltar a mexer no meu time
            </button>
          )}
        </div>
      )}
    </div>
  )
}
