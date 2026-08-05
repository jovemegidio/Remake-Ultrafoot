"use client"

// "INICIAR A PRÓXIMA TEMPORADA" — o botão que faltava fora do pré-escritório.
//
// ⚠️ POR QUE ISTO EXISTE (pedido: "implemente no office a opção, ao terminar a
// temporada, de iniciar a temporada, porque se o usuário voltar ao dashboard ele
// fica num loop infinito"; e depois "implemente na área do treinador a mesma
// opção").
//
// Acabada a última partida do clube, `seasonCalendar.nextUserMatch` fica null e
// quem vira o ano é o `advanceWeek` — ele apura campeão, acesso/rebaixamento,
// prêmios, contratos vencidos e monta o calendário novo. A ação existia em UM
// lugar só: a tarefa "Iniciar a proxima temporada" do /pre-office.
//
// No escritório (/) e na Área do Treinador o único botão de tempo é "Avançar",
// no cabeçalho — e ele termina em `if (!resultado?.newSeason) hardNavigate("/partida")`.
// Sem partida marcada, a tela de partida não tem o que mostrar e devolve o
// técnico para o escritório, onde ele clica de novo: é o laço que o jogador
// descreveu. Aqui a virada do ano é uma ação explícita, no lugar onde ele está.
//
// A tela NÃO decide nada sobre a temporada: quem faz tudo continua sendo o
// `advanceWeek`. Duplicar a apuração aqui seria a receita para o campeão de uma
// tela discordar do da outra.

import { useState } from "react"
import { Trophy, Loader2 } from "lucide-react"
import { hardNavigate } from "@/lib/hard-navigation"
import { cn } from "@/lib/utils"

interface Props {
  /** Roda o avanço real (useGameManager().advanceWeek). */
  advanceWeek: () => Promise<{ newSeason?: boolean } | void>
  /** Para onde ir depois de virar o ano. */
  destino?: string
  /** Temporada que está sendo encerrada — só para o texto. */
  season?: number
  className?: string
}

export function IniciarTemporadaCard({ advanceWeek, destino = "/pre-office", season, className }: Props) {
  const [rodando, setRodando] = useState(false)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-4",
        className,
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
        <Trophy className="h-5 w-5 text-amber-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">
          Temporada {season ?? ""} encerrada — o clube não tem mais jogos
        </p>
        <p className="text-sm text-white/55">
          Vire o ano para apurar campeão, acesso e rebaixamento, receber a premiação e
          montar o calendário da próxima temporada.
        </p>
      </div>
      <button
        type="button"
        disabled={rodando}
        onClick={async () => {
          if (rodando) return
          setRodando(true)
          try {
            await advanceWeek()
            hardNavigate(destino)
          } finally {
            setRodando(false)
          }
        }}
        className="flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-black transition-all hover:brightness-110 disabled:opacity-60"
      >
        {rodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
        {rodando ? "Virando o ano..." : "Iniciar nova temporada"}
      </button>
    </div>
  )
}
