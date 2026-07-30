"use client"

// A CARA DO BENEFICIO — o que aparece no lugar de um recurso de registrado.
//
// Regra do jogo (ver lib/beneficios.ts): nada de "compre para continuar" no meio
// da carreira. Este painel só aparece em RECURSO EXTRA, explica o que ele faz,
// diz o que mais vem junto e leva ao campo do código. Enquanto o registro ainda
// não foi lido do disco, não mostra nada — acusar quem registrou de não ter
// registrado é pior do que esperar meio segundo.

import { Key, Lock, Check } from "lucide-react"
import { hardNavigate } from "@/lib/hard-navigation"
import { BENEFICIOS, ROTA_DE_REGISTRO, beneficio, useJogoRegistrado, type BeneficioId } from "@/lib/beneficios"
import { cn } from "@/lib/utils"

/** Selo discreto de "jogo registrado" (perfil, configurações). */
export function SeloRegistrado({ className }: { className?: string }) {
  const { registrado, hidratado } = useJogoRegistrado()
  if (!hidratado || !registrado) return null
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-[var(--brand)]/25 bg-[var(--brand)]/10 px-2 py-0.5",
        "text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]",
        className,
      )}
      title="Jogo registrado — benefícios liberados"
    >
      <Check className="h-3 w-3" /> Registrado
    </span>
  )
}

/** O painel que substitui o recurso. */
export function AvisoDeRegistro({ id, className }: { id: BeneficioId; className?: string }) {
  const b = beneficio(id)
  const outros = BENEFICIOS.filter(x => x.id !== id)
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-[var(--brand)]/20 bg-[#0c0c10]/85 p-8 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)]/12 ring-1 ring-[var(--brand)]/25">
        <Lock className="h-6 w-6 text-[var(--brand)]" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-white">{b.titulo}</h2>
      <p className="mt-2 max-w-md text-sm text-white/55">{b.descricao}</p>
      <p className="mt-1 text-xs text-white/35">Faz parte dos extras de quem registrou o jogo.</p>

      <button
        type="button"
        onClick={() => hardNavigate(ROTA_DE_REGISTRO)}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-black text-[var(--brand-ink)] transition-all hover:brightness-110"
      >
        <Key className="h-4 w-4" /> Registrar o jogo
      </button>

      <div className="mt-6 w-full max-w-md border-t border-white/[0.06] pt-4 text-left">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">Vem junto</p>
        <ul className="space-y-1.5">
          {outros.map(o => (
            <li key={o.id} className="flex items-start gap-2 text-xs text-white/50">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]/70" />
              <span><span className="text-white/75">{o.titulo}</span> — {o.descricao}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-white/30">
          A carreira, as competições e todos os modos de jogo continuam liberados sem registro.
        </p>
      </div>
    </div>
  )
}

/**
 * Envelopa um recurso extra: mostra o conteúdo para quem registrou e o convite
 * para quem não registrou. Enquanto o disco não respondeu, não mostra nenhum
 * dos dois.
 */
export function RecursoDeRegistrado({
  id,
  children,
  className,
}: {
  id: BeneficioId
  children: React.ReactNode
  className?: string
}) {
  const { registrado, hidratado } = useJogoRegistrado()
  if (!hidratado) return null
  if (registrado) return <>{children}</>
  return <AvisoDeRegistro id={id} className={className} />
}
