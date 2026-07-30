"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { GameHeader } from "@/components/game-header"
import { useGameManager } from "@/lib/use-game-manager"
import { useGameEngine, AVAILABLE_STAFF, STAFF_ROLE_LABELS, type StaffRole } from "@/lib/game-engine"
import { formatCurrency } from "@/lib/teams-data"
import { useNotifications } from "@/components/notifications-system"
import { cn } from "@/lib/utils"
import { Briefcase, Check, ShieldAlert, TrendingUp, Users, X } from "lucide-react"

/**
 * Comissão técnica.
 *
 * O sistema já existia inteiro no game-engine (StaffMember com competência,
 * lealdade, efeito passivo e problemChance; AVAILABLE_STAFF com 14 profissionais
 * nomeados; hireStaff/fireStaff com folha e regra de um por cargo) — só nunca
 * teve tela. Nenhum arquivo chamava hireStaff.
 */
const ORDEM_CARGOS: StaffRole[] = [
  "diretor_futebol",
  "chefe_medico",
  "psicologo_chefe",
  "coordenador_base",
  "diretor_marketing",
  "chefe_seguranca",
]

export default function ComissaoPage() {
  const router = useRouter()
  const { userTeam } = useGameManager()
  const { addNotification } = useNotifications()
  const staffMembers = useGameEngine(s => s.staffMembers)
  const hireStaff = useGameEngine(s => s.hireStaff)
  const fireStaff = useGameEngine(s => s.fireStaff)
  const balance = useGameEngine(s => s.balance)
  const [vaga, setVaga] = useState<StaffRole | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.button === "B") router.back()
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router])

  const contratados = useMemo(() => new Map(staffMembers.map(m => [m.role, m])), [staffMembers])
  const folhaSemanal = useMemo(() => staffMembers.reduce((sum, m) => sum + m.salary, 0), [staffMembers])
  const competenciaMedia = staffMembers.length
    ? Math.round(staffMembers.reduce((sum, m) => sum + m.competence, 0) / staffMembers.length)
    : 0
  const risco = staffMembers.filter(m => m.problemChance >= 0.15).length

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050508] pb-20 md:pb-0">
      <GameHeader team={userTeam ?? undefined} />

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/[0.04] bg-[#0d0d0d] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-white">
                <Briefcase className="h-5 w-5 text-[var(--brand)]" />
                Comissão Técnica
              </h1>
              <p className="mt-0.5 text-xs text-white/50">
                Um profissional por cargo. Competência alta rende mais; lealdade baixa traz problema.
              </p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[10px] uppercase text-white/40">Folha semanal</p>
                <p className="text-sm font-semibold text-amber-400">{formatCurrency(folhaSemanal)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/40">Caixa</p>
                <p className="text-sm font-semibold text-[var(--brand)]">{formatCurrency(balance)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-game">
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/[0.04] bg-[#111] p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-white/50"><Users className="h-3.5 w-3.5" />Cargos ocupados</div>
              <div className="text-2xl font-bold text-white">{staffMembers.length}/{ORDEM_CARGOS.length}</div>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-[#111] p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-white/50"><TrendingUp className="h-3.5 w-3.5" />Competência média</div>
              <div className="text-2xl font-bold text-[var(--brand)]">{competenciaMedia || "—"}</div>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-[#111] p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-white/50"><ShieldAlert className="h-3.5 w-3.5" />Risco de problema</div>
              <div className={cn("text-2xl font-bold", risco > 0 ? "text-amber-400" : "text-white/40")}>{risco}</div>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-[#111] p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-white/50"><Users className="h-3.5 w-3.5" />Vagas abertas</div>
              <div className="text-2xl font-bold text-amber-400">{ORDEM_CARGOS.length - staffMembers.length}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ORDEM_CARGOS.map(cargo => {
              const membro = contratados.get(cargo)
              const candidatos = AVAILABLE_STAFF.filter(c => c.role === cargo)
              return (
                <div key={cargo} className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold text-white">{STAFF_ROLE_LABELS[cargo]}</h3>
                    {membro && (
                      <span className="shrink-0 rounded bg-[var(--brand)]/15 px-2 py-0.5 text-xs font-black text-[var(--brand)]">
                        {membro.competence}
                      </span>
                    )}
                  </div>

                  {membro ? (
                    <div className="mt-3 border-t border-white/[0.06] pt-3">
                      <p className="text-sm text-white">{membro.name}</p>
                      <p className="mt-1 text-[11px] leading-4 text-white/50">{membro.passiveEffect}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/40">
                        <span>Lealdade {membro.loyalty}</span>
                        <span>{formatCurrency(membro.salary)}/sem</span>
                        {membro.problemChance >= 0.15 && (
                          <span className="text-amber-300">risco de problema {Math.round(membro.problemChance * 100)}%</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          fireStaff(membro.id)
                          addNotification({ type: "system", title: "Profissional dispensado", message: `${membro.name} deixou a comissão técnica.`, priority: "low" })
                        }}
                        className="mt-3 w-full rounded-lg border border-red-400/30 py-2 text-xs font-bold text-red-300 hover:bg-red-400/10"
                      >
                        <X className="mr-1 inline h-3 w-3" />Dispensar
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setVaga(vaga === cargo ? null : cargo)}
                        className={cn(
                          "mt-3 w-full rounded-lg border py-2 text-xs font-bold transition-all",
                          vaga === cargo
                            ? "border-[var(--brand)]/60 bg-[var(--brand)]/10 text-[var(--brand)]"
                            : "border-white/15 text-white/70 hover:border-white/30 hover:text-white",
                        )}
                      >
                        {vaga === cargo ? "Fechar candidatos" : `Ver candidatos (${candidatos.length})`}
                      </button>

                      {vaga === cargo && (
                        <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                          {candidatos.map(candidato => {
                            const podePagar = balance >= candidato.salary * 4
                            return (
                              <div key={candidato.id} className="rounded-lg bg-black/30 p-2.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-white">{candidato.name}</p>
                                    <p className="text-[10px] text-white/40">
                                      competência {candidato.competence} · lealdade {candidato.loyalty} · {formatCurrency(candidato.salary)}/sem
                                    </p>
                                  </div>
                                  <button
                                    disabled={!podePagar}
                                    onClick={() => {
                                      hireStaff(candidato.id)
                                      setVaga(null)
                                      addNotification({ type: "system", title: "Contratação na comissão", message: `${candidato.name} assumiu como ${STAFF_ROLE_LABELS[cargo]}.`, priority: "medium" })
                                    }}
                                    className={cn(
                                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold",
                                      podePagar ? "bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00e0b4]" : "cursor-not-allowed bg-white/5 text-white/25",
                                    )}
                                  >
                                    <Check className="mr-1 inline h-3 w-3" />Contratar
                                  </button>
                                </div>
                                <p className="mt-1.5 text-[10px] leading-4 text-white/45">{candidato.passiveEffect}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
