"use client"

// COMPETIÇÕES DA SELEÇÃO. Antes o escritório apontava para uma âncora dentro da
// /selecao; agora tem tela própria, com a competição em disputa, as que a
// confederação oferece e os títulos já conquistados.

import { Trophy, Crown, Flag } from "lucide-react"
import { NationalPageShell } from "@/components/national/national-page-shell"
import {
  NationalCompetitionPanel,
  NationalCompetitionList,
} from "@/components/national/national-competition-panel"
import { useNationalTeam } from "@/lib/use-national-team"
import { getCompetitionDef } from "@/lib/national-competitions"
import { FinalissimaCard } from "@/components/national/finalissima-card"
import { useGameState } from "@/lib/save-system"

function Conteudo() {
  const { career, availableCompetitions, currentCompetition, startCompetition } = useNationalTeam()
  const { state, setState } = useGameState()

  const concluidas = career.completedThisSeason
    .map(id => getCompetitionDef(id))
    .filter((def): def is NonNullable<typeof def> => !!def)

  return (
    <div className="space-y-5">
      {currentCompetition ? (
        <NationalCompetitionPanel />
      ) : (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Trophy className="h-5 w-5 text-[var(--brand)]" /> Competições disponíveis
          </h2>
          <NationalCompetitionList
            competitions={availableCompetitions}
            completedThisSeason={career.completedThisSeason}
            onStart={startCompetition}
          />
        </section>
      )}

      {/* FINALISSIMA: so aparece para o campeao continental vigente. O proprio
          componente decide se ha jogo — nao ha card vazio. */}
      <FinalissimaCard
        selecaoId={career.nationalTeamId}
        temporada={state.season ?? 2026}
        titulos={career.titles}
        disputa={state.finalissima}
        onSalvar={(d) => setState({ finalissima: d })}
      />

      {concluidas.length > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white/60">
            <Flag className="h-4 w-4 text-white/40" /> Encerradas nesta temporada
          </div>
          <div className="flex flex-wrap gap-1.5">
            {concluidas.map(def => (
              <span
                key={def.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[11px] text-white/60"
              >
                {def.shortName}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white/60">
          <Crown className="h-4 w-4 text-[#ffd700]" /> Títulos pela seleção ({career.titles.length})
        </div>
        {career.titles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {career.titles.map((titulo, i) => (
              <span
                key={`${titulo.competition}-${titulo.season}-${i}`}
                className="flex items-center gap-1 rounded-md border border-[var(--brand)]/20 bg-[var(--brand)]/10 px-2 py-1 text-[11px] text-[var(--brand)]"
              >
                <Crown className="h-3 w-3" /> {titulo.competition} {titulo.season}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/40">
            Nenhum título ainda. Conquiste um torneio para construir sua história.
          </p>
        )}
      </section>
    </div>
  )
}

export default function CompeticoesSelecaoPage() {
  return (
    <NationalPageShell
      title="Competições da seleção"
      subtitle="torneios, eliminatórias e títulos"
      icon={Trophy}
    >
      {() => <Conteudo />}
    </NationalPageShell>
  )
}
