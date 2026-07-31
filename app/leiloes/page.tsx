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

import { useEffect, useMemo, useRef, useState } from "react"
import { Gavel, ArrowRight, Trophy, XCircle } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { LeiloesPanel, contarLeiloesAbertos } from "@/components/leiloes-panel"
import { useUserTeam, useGameState } from "@/lib/save-system"
import { useRequireClub } from "@/lib/use-require-team"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { hardNavigate } from "@/lib/hard-navigation"
import { generateDetailedMarketTargets } from "@/lib/transfer-engine"
import { useGameEngine } from "@/lib/game-engine"
import { chaveLeilao, resolverLancesPendentes, type DesfechoDeLeilao } from "@/lib/leilao"
import { formatCurrency } from "@/lib/teams-data"

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

  // ── DESFECHO DOS LEILÕES QUE FECHARAM ───────────────────────────────────
  //
  // Corrigir a semana de encerramento (lib/leilao) faz o resultado aparecer para
  // quem está na tela naquela semana. Mas o jogador pode avançar sem passar por
  // aqui, e o pedido dele é que o atleta ganho venha "na hora ou na abertura da
  // janela". Então o desfecho é recalculado a partir do LANCE SALVO, sempre que
  // esta tela abre — e o que ele ganhou fica gravado em `leilaoVencido`, que o
  // Mercado consome mesmo dias depois.
  const [desfechos, setDesfechos] = useState<DesfechoDeLeilao[]>([])
  const jaResolveu = useRef(false)
  useEffect(() => {
    if (jaResolveu.current) return
    const salvos = state.lancesEmLeilao ?? []
    if (salvos.length === 0) return
    jaResolveu.current = true

    const porChave = new Map(
      pool.filter(a => a.team?.nome).map(a => [chaveLeilao(a.name, a.team.nome), a]),
    )
    const { desfechos: saiu, restantes } = resolverLancesPendentes(
      salvos, semana, season,
      (chave) => {
        const a = porChave.get(chave)
        return a ? {
          name: a.name, overall: a.overall, age: a.age, potential: a.potential,
          teamCurto: a.team.curto ?? "", teamNome: a.team.nome,
        } : undefined
      },
      candidatos,
      { curto: userTeam?.curto ?? "", nome: userTeam?.nome ?? "Seu clube", prestigio: userTeam?.prestigio ?? 60 },
    )
    if (saiu.length === 0 && restantes.length === salvos.length) return

    const vitoria = saiu.find(d => d.venceu)
    setDesfechos(saiu)
    setState({
      lancesEmLeilao: restantes,
      // Só a primeira vitória entra na fila do Mercado — `leilaoVencido` é um
      // slot só. As demais (raro: dois leilões fechando na mesma semana) ficam
      // visíveis aqui e o jogador fecha uma de cada vez.
      ...(vitoria ? { leilaoVencido: { jogador: vitoria.jogadorNome, valor: vitoria.valorVencedor, season } } : {}),
    })
  }, [state.lancesEmLeilao, pool, candidatos, semana, season, userTeam, setState])

  // SEM LEILÃO A TELA NÃO EXISTE: a partida manda todo mundo para cá porque
  // descobrir isso no fim do jogo exigiria gerar o catálogo inteiro do mercado
  // ali. Quando não há disputa, seguimos sozinhos para o pré-escritório — que era
  // o destino original do pós-partida.
  //
  // ⚠️ Nunca sair enquanto houver desfecho para mostrar: era assim que a vitória
  // no leilão sumia sem o jogador ver nada.
  const [saindo, setSaindo] = useState(false)
  useEffect(() => {
    if (quantos === 0 && desfechos.length === 0 && (state.lancesEmLeilao?.length ?? 0) === 0 && !saindo) {
      setSaindo(true)
      hardNavigate("/pre-office")
    }
  }, [quantos, desfechos.length, state.lancesEmLeilao, saindo])

  if (quantos === 0 && desfechos.length === 0 && (state.lancesEmLeilao?.length ?? 0) === 0) {
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

        {/* DESFECHOS — o que aconteceu com os leilões em que você deu lance.
            Vencer abre a negociação no Mercado (a compra passa pelo caminho
            normal, com teto de dívida, teto de folha e baixa no clube dono). */}
        {desfechos.length > 0 && (
          <div className="mb-6 space-y-3">
            {desfechos.map(d => (
              <div
                key={d.chave}
                className={
                  d.venceu
                    ? "rounded-xl border border-[var(--brand)]/35 bg-[var(--brand)]/10 p-4"
                    : "rounded-xl border border-white/10 bg-white/[0.03] p-4"
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {d.venceu
                      ? <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
                      : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-white/35" />}
                    <div>
                      <p className={d.venceu ? "font-semibold text-[var(--brand)]" : "font-semibold text-white/80"}>
                        {d.venceu
                          ? `Você arrematou ${d.jogadorNome} por ${formatCurrency(d.valorVencedor)}`
                          : `${d.jogadorNome} foi para outro clube`}
                      </p>
                      <p className="mt-0.5 text-sm text-white/50">{d.motivo}</p>
                      {!d.venceu && d.valorVencedor > 0 && d.meuLance >= d.valorVencedor && (
                        <p className="mt-1 text-xs text-amber-300/80">
                          Seu lance de {formatCurrency(d.meuLance)} era o maior — o atleta preferiu o
                          projeto do outro clube. No leilão, dinheiro não decide sozinho.
                        </p>
                      )}
                    </div>
                  </div>
                  {d.venceu && (
                    <button
                      type="button"
                      onClick={() => hardNavigate("/mercado")}
                      className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110"
                    >
                      Fechar contrato
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

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
