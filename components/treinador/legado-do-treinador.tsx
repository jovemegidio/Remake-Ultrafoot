"use client"

/**
 * O LEGADO NA TELA (1.0.377) — linha do tempo, insígnias, patamar e conduta.
 *
 * ⚠️ COMPONENTE À PARTE, E NÃO MAIS UMA SEÇÃO EM `app/treinador/page.tsx`. Essa
 * tela já tem 1.100 linhas e cinco assuntos; empurrar o legado para dentro dela
 * a deixaria maior sem deixá-la melhor. Aqui o bloco tem escopo próprio, hook
 * de tradução próprio (a tela hospedeira não tem) e pode ser montado em
 * qualquer outro lugar — o histórico, por exemplo — sem arrastar nada junto.
 *
 * Tudo que ele mostra é DERIVADO do histórico que o save já guarda
 * (`lib/legado-do-treinador`). Nenhum campo novo, nenhuma migração, e um
 * técnico com dez temporadas gravadas abre a versão nova com a carreira inteira
 * contada.
 */

import { useMemo } from "react"
import {
  Award, Flag, Gavel, Medal, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Trophy,
} from "lucide-react"

import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { SeasonRecord } from "@/lib/career-types"
import type { ManagerCareerStats } from "@/lib/hall-of-fame-engine"
import {
  ROTULO_DO_INCIDENTE, condutaDoTreinador, insigniasDoTreinador, linhaDoTempoDoTreinador,
  posicaoNaHistoria, rotuloDaConduta,
  type IncidenteDoTreinador, type TipoDeMomento,
} from "@/lib/legado-do-treinador"

const ICONE_DO_MOMENTO: Record<TipoDeMomento, typeof Trophy> = {
  estreia: Flag,
  titulo: Trophy,
  acesso: TrendingUp,
  rebaixamento: TrendingDown,
  chegada: Flag,
  demissao: Gavel,
  saida: Flag,
  campanha: Medal,
  travessia: ShieldCheck,
  marco: Sparkles,
}

const COR_DO_MOMENTO: Record<TipoDeMomento, string> = {
  estreia: "text-cyan-300 border-cyan-300/40",
  titulo: "text-amber-300 border-amber-300/50",
  acesso: "text-emerald-300 border-emerald-300/45",
  rebaixamento: "text-rose-300 border-rose-400/45",
  chegada: "text-white/60 border-white/20",
  demissao: "text-rose-300 border-rose-400/45",
  saida: "text-white/60 border-white/20",
  campanha: "text-sky-300 border-sky-300/40",
  travessia: "text-violet-300 border-violet-300/40",
  marco: "text-white/70 border-white/20",
}

export function LegadoDoTreinador({
  historico,
  carreira,
  passagens = [],
  incidentes = [],
  temporadaAtual,
}: {
  historico: SeasonRecord[]
  carreira: ManagerCareerStats | null
  passagens?: { teamCurto: string; endReason: "fired" | "resigned"; season: number }[]
  incidentes?: IncidenteDoTreinador[]
  temporadaAtual: number
}) {
  const t = useTranslation().treinadorLegado

  const dados = useMemo(() => {
    if (!carreira) return null
    const insignias = insigniasDoTreinador(carreira, historico)
    return {
      momentos: linhaDoTempoDoTreinador(historico, passagens),
      insignias,
      patamar: posicaoNaHistoria(carreira, insignias),
      conduta: condutaDoTreinador(incidentes, temporadaAtual),
    }
  }, [carreira, historico, passagens, incidentes, temporadaAtual])

  if (!dados || !carreira) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-xs text-white/40">{t.sem_historico}</p>
      </section>
    )
  }

  const { momentos, insignias, patamar, conduta } = dados
  const leituraDaConduta = rotuloDaConduta(conduta)
  const conquistadas = insignias.filter(i => i.conquistada)

  return (
    <section className="space-y-4">

      {/* ── O PATAMAR ────────────────────────────────────────────────────────
           ⚠️ O QUE ELE ACRESCENTA A `rankInHistory` É "QUANTO FALTA". A posição
           no ranking saltava de 150 para 50 sem nada no meio; entre um salto e
           outro o jogador não tinha objetivo nenhum, e carreira longa sem
           objetivo intermediário é carreira que se abandona na sexta temporada. */}
      <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/[.10] via-black/40 to-black/50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-amber-200/70">{t.patamar}</p>
            <h3 className="mt-0.5 text-2xl font-black leading-tight text-white">{patamar.rotulo}</h3>
          </div>
          <p className="text-right text-[11px] text-white/45">
            {patamar.pontos} {t.pontos_de_legado}
            {conquistadas.length > 0 && <> · {conquistadas.length}/{insignias.length} {t.insignias}</>}
          </p>
        </div>
        {patamar.proximo && (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/45">
              <div className="h-full rounded-full bg-amber-300/75" style={{ width: `${Math.max(2, patamar.progressoParaOProximo * 100)}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-white/40">
              {t.proximo_patamar}: {patamar.proximo} · {Math.round(patamar.progressoParaOProximo * 100)}%
            </p>
          </>
        )}
      </div>

      {/* ── CONDUTA ─────────────────────────────────────────────────────────
           Ela mexe na paciência da diretoria (`computeBoardConfidence`), e a
           frase abaixo diz isso — um medidor sem efeito declarado é o defeito
           que este projeto já cometeu vezes demais. */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-white/45">
            <Gavel className="h-3.5 w-3.5" /> {t.conduta}
          </p>
          <span className={cn("text-[12px] font-bold",
            leituraDaConduta.tom === "bom" ? "text-emerald-300"
              : leituraDaConduta.tom === "neutro" ? "text-amber-200" : "text-rose-300")}>
            {leituraDaConduta.texto} · {conduta}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full",
              leituraDaConduta.tom === "bom" ? "bg-emerald-400"
                : leituraDaConduta.tom === "neutro" ? "bg-amber-300" : "bg-rose-400")}
            style={{ width: `${Math.max(2, conduta)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-white/35">{t.conduta_efeito}</p>
        {incidentes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {incidentes.slice(-4).reverse().map(i => (
              <li key={i.id} className="text-[11px] text-white/50">
                <span className="text-white/30">{i.temporada}</span> · {ROTULO_DO_INCIDENTE[i.tipo]}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── INSÍGNIAS ───────────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white/70">
          <Award className="h-3.5 w-3.5 text-[var(--brand)]" /> {t.insignias}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {insignias.map(i => (
            <div
              key={i.id}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                i.conquistada ? "border-[var(--brand)]/45 bg-[var(--brand)]/[.07]" : "border-white/8 bg-black/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-[12px] font-black", i.conquistada ? "text-white" : "text-white/45")}>{i.nome}</p>
                {i.conquistada && <Medal className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />}
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-white/40">{i.descricao}</p>
              {/* ⚠️ CADEADO NÃO, PROGRESSO SIM. Uma insígnia trancada sem barra
                  não diz se falta um título ou trezentos jogos — e o jogador
                  não pode perseguir o que não sabe medir. */}
              {!i.conquistada && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-white/35" style={{ width: `${Math.max(2, i.progresso * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── LINHA DO TEMPO ──────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white/70">
          <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" /> {t.linha_do_tempo}
        </p>
        {momentos.length === 0 ? (
          <p className="rounded-xl border border-white/8 bg-black/30 p-3 text-[11px] text-white/35">{t.sem_momentos}</p>
        ) : (
          <ol className="relative space-y-2 border-l border-white/10 pl-4">
            {momentos.map(m => {
              const Icone = ICONE_DO_MOMENTO[m.tipo]
              return (
                <li key={m.id} className="relative">
                  {/* O nó da linha. Momentos de peso 3 ganham anel — é como a
                      carreira mostra os seus picos sem precisar de legenda. */}
                  <span
                    className={cn(
                      "absolute -left-[22px] top-1 grid h-4 w-4 place-items-center rounded-full border bg-[#06090d]",
                      COR_DO_MOMENTO[m.tipo],
                      m.peso === 3 && "ring-2 ring-offset-1 ring-offset-[#06090d] ring-current",
                    )}
                  >
                    <Icone className="h-2.5 w-2.5" />
                  </span>
                  <div className={cn("rounded-xl border bg-black/30 px-3 py-2", m.peso === 3 ? "border-white/15" : "border-white/[.06]")}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn("text-[12px] font-bold", m.peso === 3 ? "text-white" : "text-white/75")}>{m.titulo}</p>
                      <span className="shrink-0 text-[10px] tabular-nums text-white/35">{m.temporada}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/45">{m.detalhe}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
