"use client"

/**
 * O RANKING DE ACADEMIAS NA TELA (1.0.377).
 *
 * ⚠️ ELE RESPONDE A PERGUNTA QUE A CARREIRA DE BASE NÃO RESPONDIA: "onde eu
 * estou entre as outras?". A tela mostrava campanha, tabela, copa e elenco —
 * tudo sobre a temporada corrente, nada sobre a década. Formar três jogadores
 * para a seleção e formar nenhum davam a mesma tela no fim do ano.
 *
 * Duas metades, e as duas existem por motivos diferentes:
 *
 *   O RANKING       diz onde a academia está hoje, e o cálculo é aberto na
 *                   própria linha (formados, títulos) para o jogador saber o
 *                   que mexer.
 *   OS TORNEIOS     dizem o que vem depois. Aparecem TODOS, inclusive os que
 *                   ainda não foram alcançados, com quantas posições faltam —
 *                   um objetivo escondido não é um objetivo.
 *
 * Tudo derivado (`lib/ranking-de-academias`): nenhum campo novo no save, e uma
 * carreira de base em andamento abre a versão nova já classificada.
 */

import { useMemo } from "react"
import { Globe2, Medal, TrendingUp } from "lucide-react"

import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { TeamCrest } from "@/components/team-crest"
import type { Team } from "@/lib/teams-data"
import {
  faixaDaAcademia, minhaPosicao, rankingDeAcademias, vagaNoTorneioInternacional,
  type MinhaAcademia,
} from "@/lib/ranking-de-academias"

export function RankingDeAcademias({
  clubesDaDivisao,
  minha,
}: {
  clubesDaDivisao: readonly Team[]
  minha: MinhaAcademia
}) {
  const t = useTranslation().baseSub20

  const dados = useMemo(() => {
    const ranking = rankingDeAcademias(clubesDaDivisao, minha)
    const eu = minhaPosicao(ranking)
    return { ranking, eu, vagas: vagaNoTorneioInternacional(eu?.posicao ?? 0) }
  }, [clubesDaDivisao, minha])

  const { ranking, eu, vagas } = dados
  if (!eu) return null

  const faixa = faixaDaAcademia(eu.nota)

  // ⚠️ A LISTA NÃO MOSTRA TODA A DIVISÃO. Vinte linhas empurrariam os torneios
  // para fora da tela e ninguém lê a 14ª academia. Mostra o pódio e a vizinhança
  // da sua posição — que é onde a disputa realmente acontece.
  const visiveis = new Set<number>([1, 2, 3, eu.posicao - 1, eu.posicao, eu.posicao + 1])
  const linhas = ranking.filter(r => visiveis.has(r.posicao))

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="uf-heading flex items-center gap-2 text-xl font-black">
          <Medal className="text-[var(--brand)]" />{t.ranking_de_academias}
        </h2>
        <div className="text-right">
          <p className={cn("text-sm font-black",
            faixa.tom === "elite" ? "text-amber-300"
              : faixa.tom === "forte" ? "text-emerald-300"
                : faixa.tom === "media" ? "text-white/70" : "text-white/40")}>
            {faixa.texto}
          </p>
          <p className="text-[11px] text-white/40">{eu.posicao}º · {t.nota} {eu.nota}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {linhas.map(r => (
          <div
            key={r.fileKey}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2",
              r.minha ? "border border-[var(--brand)]/45 bg-[var(--brand)]/[.08]" : "bg-black/25",
            )}
          >
            <span className={cn("w-6 shrink-0 text-right text-[13px] font-black tabular-nums",
              r.posicao <= 3 ? "text-amber-300" : "text-white/35")}>{r.posicao}</span>
            <TeamCrest fileKey={r.fileKey} size="sm" />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[13px] font-bold", r.minha ? "text-white" : "text-white/75")}>{r.clubeNome}</p>
              <p className="text-[10px] text-white/35">
                {r.formados} {t.formados} · {r.titulosDeBase} {t.titulos_de_base}
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-black tabular-nums text-white/80">{r.nota}</span>
          </div>
        ))}
      </div>

      {/* ── O CALENDÁRIO INTERNACIONAL ─────────────────────────────────────── */}
      <div className="mt-5 border-t border-white/[.07] pt-4">
        <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-white/60">
          <Globe2 className="h-3.5 w-3.5 text-cyan-300" /> {t.calendario_internacional}
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {vagas.map(({ torneio, classificada, faltamPosicoes }) => (
            <div
              key={torneio.nome}
              className={cn(
                "rounded-xl border p-3",
                classificada ? "border-cyan-300/45 bg-cyan-300/[.07]" : "border-white/8 bg-black/25",
              )}
            >
              <p className={cn("text-[12px] font-black leading-tight", classificada ? "text-cyan-100" : "text-white/45")}>
                {torneio.nome}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-white/40">{torneio.descricao}</p>
              <p className={cn("mt-2 flex items-center gap-1 text-[11px] font-bold",
                classificada ? "text-emerald-300" : "text-white/40")}>
                {classificada ? (
                  <>{t.classificada} · {torneio.participantes} {t.academias}</>
                ) : (
                  <><TrendingUp className="h-3 w-3" /> {t.faltam} {faltamPosicoes} {faltamPosicoes === 1 ? t.posicao : t.posicoes}</>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
