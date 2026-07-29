"use client"

// FINALÍSSIMA na tela de competições da seleção.
//
// Só aparece quando o técnico é o campeão continental vigente: é o único jeito de
// ele ter direito ao jogo. O adversário é o campeão do OUTRO continente, derivado
// em lib/finalissima — o jogo não guarda quem ganhou a Eurocopa quando o usuário
// não a disputou, e sem esse dado a partida não poderia existir.

import { useState } from "react"
import { Swords, Trophy, MapPin } from "lucide-react"
import {
  criarFinalissima, jogarFinalissima, sedeDaFinalissima, campeaoContinental,
  forcaDaSelecao, resumoFinalissima, podeAcontecer, type DisputaFinalissima,
} from "@/lib/finalissima"
import { getNationalTeamById, getAllNationalTeams } from "@/lib/national-teams"

interface Props {
  /** Seleção que o técnico comanda. */
  selecaoId: string | null
  temporada: number
  /** Títulos da carreira na seleção, para saber se ele é o campeão vigente. */
  titulos: { competition: string; season: number }[]
  disputa: DisputaFinalissima | null | undefined
  onSalvar: (d: DisputaFinalissima) => void
}

function idPorNome(nome: string): string | undefined {
  return getAllNationalTeams().find(t => t.name === nome)?.id
}

export function FinalissimaCard({ selecaoId, temporada, titulos, disputa, onSalvar }: Props) {
  const [erro, setErro] = useState<string | null>(null)
  const minha = getNationalTeamById(selecaoId)
  if (!minha) return null

  // Campeão continental na temporada ANTERIOR — a Finalíssima é disputada no ano
  // seguinte às duas competições, como na vida real.
  const tituloContinental = titulos.find(t =>
    t.season === temporada - 1
    && (/copa am[eé]rica/i.test(t.competition) || /eurocopa|euro/i.test(t.competition)),
  )
  if (!tituloContinental && !disputa) return null

  const souSulamericano = minha.confederation === "CONMEBOL"
  const outraConf = souSulamericano ? "UEFA" : "CONMEBOL"
  const adversario = campeaoContinental(outraConf, temporada - 1)

  if (!podeAcontecer(minha.name, adversario ?? undefined)) return null

  const jogo = disputa ?? criarFinalissima(
    temporada,
    souSulamericano ? minha.name : adversario!,
    souSulamericano ? adversario! : minha.name,
  )

  function jogar() {
    const idSul = idPorNome(jogo.campeaoSulamericano)
    const idEuro = idPorNome(jogo.campeaoEuropeu)
    if (!idSul || !idEuro) {
      setErro("Uma das seleções não foi encontrada no banco — a partida não pode ser disputada.")
      return
    }
    setErro(null)
    onSalvar(jogarFinalissima(jogo, forcaDaSelecao(idSul), forcaDaSelecao(idEuro)))
  }

  return (
    <section className="rounded-xl border border-[#ffd700]/25 bg-gradient-to-br from-[#ffd700]/[0.07] to-transparent p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#ffd700]">
        <Swords className="h-4 w-4" /> Finalíssima {jogo.temporada}
      </div>

      <p className="mb-1 text-lg font-bold text-white">
        {jogo.campeaoSulamericano} <span className="text-white/30">x</span> {jogo.campeaoEuropeu}
      </p>
      <p className="mb-4 flex items-center gap-1.5 text-xs text-white/45">
        <MapPin className="h-3.5 w-3.5" /> {sedeDaFinalissima(jogo.temporada)} · campo neutro
        {" · "}campeão da Copa América x campeão da Eurocopa
      </p>

      {erro && <p className="mb-3 text-sm text-red-300">{erro}</p>}

      {jogo.jogada ? (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="flex items-center gap-2 text-sm text-white/85">
            <Trophy className="h-4 w-4 text-[#ffd700]" />
            {resumoFinalissima(jogo)}
          </p>
          {jogo.campeao === minha.name && (
            <p className="mt-1 text-xs text-[var(--brand)]">
              Título da Finalíssima para a {minha.name}.
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={jogar}
          className="rounded-lg bg-[#ffd700] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
        >
          Disputar a Finalíssima
        </button>
      )}
    </section>
  )
}
