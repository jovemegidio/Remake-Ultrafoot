"use client"

import { useEffect, useRef } from "react"
import { useGameEngine } from "@/lib/game-engine"
import { podeSalvarCarreira, useGameState } from "@/lib/save-system"
import { salvarTudo } from "@/lib/salvar-tudo"
import { useNotifications } from "@/components/notifications-system"
import { getSavedCloudCode, uploadSave } from "@/lib/cloud-save"
import { contaLogada } from "@/lib/conta-ultrafoot"

/** Salva os dois estados da carreira após a quantidade configurada de partidas. */
export function GameAutosave() {
  const matchResults = useGameEngine(state => state.matchResults)
  const { state, hydrated } = useGameState()
  const { addNotification } = useNotifications()
  // Via REF, e fora das dependencias: a identidade de addNotification muda a
  // cada notificacao criada. Como dependencia, o proprio aviso de "jogo salvo"
  // reagendava o efeito que o criou — realimentacao que leva ao React #185
  // ("Maximum update depth exceeded") e derruba o app inteiro.
  const notificar = useRef(addNotification)
  notificar.current = addNotification
  const ready = useRef(false)
  const saving = useRef(false)
  const teamShort = state.selectedTeamShort
  const matchCount = teamShort
    ? matchResults.filter(result => result.homeTeam === teamShort || result.awayTeam === teamShort).length
    : 0

  useEffect(() => {
    if (!hydrated) return
    // Mesma regra do salvamento manual: nada e gravado antes de a carreira
    // comecar no pre-office.
    if (!podeSalvarCarreira(state)) return
    // A primeira leitura apenas estabelece o ponto de partida da sessão. Isso impede
    // um aviso de autosave ao abrir uma carreira antiga, antes de jogar outra partida.
    if (!ready.current) {
      ready.current = true
      return
    }

    const interval = state.autoSaveInterval ?? 1
    if (interval === 0 || matchCount <= (state.lastAutoSaveMatchCount ?? 0)) return
    if (matchCount % interval !== 0) return

    if (saving.current) return
    saving.current = true
    void (async () => {
      try {
        // O autosave gravava `{ ...state }` — o retrato do React deste
        // componente — e assim desfazia qualquer movimentação escrita direto no
        // disco desde a montagem (rescisão, empréstimo, venda). Ver
        // lib/salvar-tudo.ts: o merge agora é feito sobre o save do disco.
        await salvarTudo({ lastAutoSaveMatchCount: matchCount })
        // BACKUP NA CONTA, SEM O JOGADOR PEDIR.
        //
        // Isto era `if (cloudCode) await uploadSave(cloudCode)`: só fazia backup
        // de quem JÁ tinha um código — e nada no jogo cria o primeiro sozinho.
        // Só a tela de salvar manual gera um, então quem nunca foi lá nunca teve
        // backup nenhum, mesmo com conta ativa. A lista de saves da conta ficava
        // vazia e a promessa de "formatei o PC e recuperei minha carreira" não
        // se cumpria.
        //
        // `uploadSave()` sem código gera um, sobe e o cataloga na conta
        // (cloud-save.ts). Só fazemos isso para quem ESTÁ LOGADO: criar save na
        // nuvem para quem não tem conta seria guardar dado de quem não pediu.
        const cloudCode = getSavedCloudCode()
        if (cloudCode) {
          await uploadSave(cloudCode)
        } else if (await contaLogada()) {
          await uploadSave()
        }
        notificar.current({
          type: "system",
          title: "Jogo salvo automaticamente",
          message: `Progresso salvo após ${matchCount} partida${matchCount === 1 ? "" : "s"}.`,
          priority: "low",
        })
      } finally {
        saving.current = false
      }
    })()
  }, [hydrated, matchCount, state])

  return null
}
