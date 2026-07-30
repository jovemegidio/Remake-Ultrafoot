"use client"

// LEILÕES DEPOIS DA PARTIDA.
//
// Antes isto era uma aba dentro do Mercado, e o técnico só descobria a disputa se
// fosse procurar. Um leilão tem PRAZO (a janela dura três semanas): se ele não
// aparece sozinho, o jogador perde o alvo sem nunca ter sido avisado.
//
// Agora a tela entra no caminho natural: acabou a partida, se há alguém em
// disputa ela aparece; se não há, o jogo segue direto para o escritório (ver o
// fim de app/partida/ao-vivo). Sair daqui leva ao pré-escritório, que é para
// onde a partida ia antes.

import { useEffect, useMemo, useState } from "react"
import { Gavel, ArrowRight } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { LeiloesPanel, contarLeiloesAbertos } from "@/components/leiloes-panel"
import { useUserTeam, useGameState } from "@/lib/save-system"
import { useRequireClub } from "@/lib/use-require-team"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { hardNavigate } from "@/lib/hard-navigation"
import { generateDetailedMarketTargets } from "@/lib/transfer-engine"
import { useGameEngine } from "@/lib/game-engine"

export default function LeiloesPage() {
  useRequireClub()
  // B / Esc seguem para o escritório: esta tela é passagem, não destino.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/pre-office") })

  const { team: userTeam } = useUserTeam()
  const { state, setState } = useGameState()
  const semana = useGameEngine(st => st.currentWeek)
  const season = useGameEngine(st => st.currentSeason)
  const saldo = useGameEngine(st => st.balance)

  // Mesmo catálogo da aba Buscar do Mercado — os atletas em disputa saem dele.
  const pool = useMemo(
    () => generateDetailedMarketTargets(userTeam?.curto ?? "", undefined, season, userTeam?.nome),
    [userTeam?.curto, userTeam?.nome, season],
  )

  // Concorrentes: os clubes do próprio catálogo, com caixa estimado pelo
  // prestígio na escala do jogo (CLUB_TEMPLATES: prestígio 90 ≈ 80 mi).
  const candidatos = useMemo(() => {
    const porClube = new Map<string, { curto: string; nome: string; prestigio: number; caixa: number; forcaElenco: number }>()
    const meuCurto = (userTeam?.curto ?? "").toUpperCase()
    for (const alvo of pool) {
      const curto = alvo.team?.curto ?? ""
      if (!curto || curto.toUpperCase() === meuCurto || porClube.has(curto)) continue
      const prestigio = alvo.team?.prestigio ?? 60
      porClube.set(curto, {
        curto,
        nome: alvo.team.nome,
        prestigio,
        caixa: Math.max(1_000_000, Math.round(Math.pow(Math.max(50, prestigio) - 50, 2) * 50_000)),
        forcaElenco: Math.round(48 + prestigio * 0.38),
      })
    }
    return Array.from(porClube.values()).sort((a, b) => b.prestigio - a.prestigio).slice(0, 40)
  }, [pool, userTeam?.curto])

  // Há disputa nesta semana? O painel aplica as MESMAS regras (inclusive a de
  // descartar leilão sem nenhum interessado), então contamos por ele para as duas
  // telas não discordarem sobre o que é um leilão válido.
  const quantos = useMemo(
    () => contarLeiloesAbertos(pool, candidatos, semana),
    [pool, candidatos, semana],
  )

  // SEM LEILÃO A TELA NÃO EXISTE: a partida manda todo mundo para cá porque
  // descobrir isso no fim do jogo exigiria gerar o catálogo inteiro do mercado
  // ali. Quando não há disputa, seguimos sozinhos para o pré-escritório — que era
  // o destino original do pós-partida.
  const [saindo, setSaindo] = useState(false)
  useEffect(() => {
    if (quantos === 0 && !saindo) {
      setSaindo(true)
      hardNavigate("/pre-office")
    }
  }, [quantos, saindo])

  if (quantos === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508]">
        <p className="text-sm text-white/40">Nenhum leilão em andamento — indo para o escritório...</p>
      </div>
    )
  }

  return (
    // ROLAGEM: `html`/`body` tem `overflow: hidden` no globals.css (o jogo e uma
    // janela fixa, nao uma pagina web). Com `min-h-screen` a lista de leiloes era
    // simplesmente CORTADA no pe da tela — nao havia como ver o quarto leilao.
    // O padrao do jogo e h-screen + container interno rolavel.
    <div className="flex h-screen flex-col overflow-hidden bg-[#050508]">
      <GameHeader team={userTeam} />
      <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto p-4 scrollbar-thin md:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)]/15 ring-1 ring-[var(--brand)]/30">
              <Gavel className="h-5 w-5 text-[var(--brand)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight text-white">Leilões</h1>
              <p className="text-sm text-white/50">
                Atletas em disputa por mais de um clube. Cobrir agora ou perder o alvo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => hardNavigate("/pre-office")}
            className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-2.5 font-semibold text-[var(--brand-ink)] hover:brightness-110"
          >
            Ir para o escritório <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <LeiloesPanel
          pool={pool}
          semana={semana}
          season={season}
          saldo={saldo}
          candidatos={candidatos}
          lancesSalvos={state.lancesEmLeilao ?? []}
          clubeDoUsuario={{
            curto: userTeam?.curto ?? "",
            nome: userTeam?.nome ?? "Seu clube",
            prestigio: userTeam?.prestigio ?? 60,
          }}
          onLance={(lance) => {
            // Um lance por atleta: cobrir SUBSTITUI o anterior, senão o save
            // acumularia vários lances do mesmo clube no mesmo leilão.
            const outros = (state.lancesEmLeilao ?? []).filter(
              l => !(l.chave === lance.chave && l.season === lance.season),
            )
            setState({ lancesEmLeilao: [...outros, lance].slice(-40) })
          }}
          onNegociar={(nomeDoAtleta, valor) => {
            // Vencer NÃO conclui a transferência aqui: a compra passa pela
            // negociação normal do Mercado, que já trata teto de dívida, teto de
            // folha e a baixa no clube de origem. Duplicar isso seria bug garantido.
            setState({
              leilaoVencido: { jogador: nomeDoAtleta, valor, season },
            })
            hardNavigate("/mercado")
          }}
        />
      </main>
    </div>
  )
}
