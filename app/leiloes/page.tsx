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

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Gavel, ArrowRight, Trophy, XCircle, Coins } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { LeiloesPanel, contarLeiloesAbertos } from "@/components/leiloes-panel"
import { LeilaoVendaPanel } from "@/components/leilao-venda-panel"
import { useGameState, commitGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { useRequireClub } from "@/lib/use-require-team"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { hardNavigate } from "@/lib/hard-navigation"
import { vitrineDaModalidade } from "@/lib/mercado-da-modalidade"
import { modalidadeDoSave } from "@/lib/modalidade-de-carreira"
import { useGameEngine, isTransferWindowOpen } from "@/lib/game-engine"
import { chaveLeilao, resolverLancesPendentes, type DesfechoDeLeilao } from "@/lib/leilao"
import { resolverLeiloesDeVenda, type DesfechoDaVenda, type LeilaoDeVenda } from "@/lib/leilao-de-venda"
import { ELENCO_MINIMO } from "@/lib/reposicao-emergencial"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { markDeparted } from "@/lib/departed-players"

export default function LeiloesPage() {
  useRequireClub()
  // B / Esc seguem para o escritório: esta tela é passagem, não destino.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/pre-office") })

  const { team: userTeam } = useUserTeam()
  const { state, setState } = useGameState()
  const semana = useGameEngine(st => st.currentWeek)
  const season = useGameEngine(st => st.currentSeason)
  const saldo = useGameEngine(st => st.balance)
  // Mesmo piso que o painel usa — a contagem da tela e a lista TEM de concordar.
  const meuElencoLeilao = useGameEngine(st => st.squadPlayers)
  const pisoDoMeuElenco = useMemo(() => {
    if (!meuElencoLeilao.length) return 78
    const onze = [...meuElencoLeilao].sort((a, b) => b.overall - a.overall).slice(0, 11)
    return Math.round(onze.reduce((soma, p) => soma + p.overall, 0) / onze.length) - 6
  }, [meuElencoLeilao])

  // Mesmo catálogo da aba Buscar do Mercado — os atletas em disputa saem dele.
  // E "mesmo catálogo" inclui a MODALIDADE: um leilão de atleta masculino numa
  // carreira feminina seria a mesma incoerência do mercado, num lugar onde ela
  // custa dinheiro.
  const modalidade = modalidadeDoSave(state)
  const pool = useMemo(
    () => vitrineDaModalidade({
      modalidade,
      clubeCurto: userTeam?.curto ?? "",
      clubeNome: userTeam?.nome,
      temporada: season,
    }),
    [modalidade, userTeam?.curto, userTeam?.nome, season],
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
    () => contarLeiloesAbertos(pool, candidatos, semana, pisoDoMeuElenco),
    [pool, candidatos, semana, pisoDoMeuElenco],
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
    // QUEM PERDEU O LEILÃO PERDEU O ATLETA. Antes o vencedor da IA levava o
    // jogador e ele continuava no catálogo do mercado como se nada tivesse
    // acontecido — dava para simplesmente comprá-lo na aba Buscar logo depois,
    // o que esvaziava a disputa inteira.
    for (const d of saiu) {
      if (d.venceu || d.valorVencedor <= 0) continue
      const alvo = porChave.get(d.chave)
      if (alvo?.team?.nome) markDeparted(alvo.team.nome, alvo.name)
    }
    setDesfechos(saiu)
    setState({
      lancesEmLeilao: restantes,
      // Só a primeira vitória entra na fila do Mercado — `leilaoVencido` é um
      // slot só. As demais (raro: dois leilões fechando na mesma semana) ficam
      // visíveis aqui e o jogador fecha uma de cada vez.
      ...(vitoria ? { leilaoVencido: { jogador: vitoria.jogadorNome, valor: vitoria.valorVencedor, season } } : {}),
    })
  }, [state.lancesEmLeilao, pool, candidatos, semana, season, userTeam, setState])

  // ── LEILÃO DE VENDA: os SEUS atletas em disputa ─────────────────────────
  //
  // Contrapartida do bloco acima. O anúncio fecha sozinho na semana marcada,
  // mesmo que o técnico não abra esta tela: quem vence leva, o dinheiro entra na
  // hora e o atleta sai quando a janela abrir (lib/leilao-de-venda +
  // `registrarSaidaAcertada` no motor).
  const elencoDoMotor = useGameEngine(st => st.squadPlayers)
  const registrarSaidaAcertada = useGameEngine(st => st.registrarSaidaAcertada)
  const [vendas, setVendas] = useState<DesfechoDaVenda[]>([])
  const jaResolveuVendas = useRef(false)
  useEffect(() => {
    if (jaResolveuVendas.current) return
    const anuncios = state.leiloesDeVenda ?? []
    if (anuncios.length === 0) return
    jaResolveuVendas.current = true

    const { desfechos: fechados, abertos } = resolverLeiloesDeVenda(
      anuncios, semana, season, candidatos,
      { curto: userTeam?.curto ?? "", nome: userTeam?.nome ?? "Seu clube" },
    )
    if (fechados.length === 0) return

    const janelaAberta = isTransferWindowOpen(state.week ?? 0)
    for (const venda of fechados) {
      if (!venda.vencedor) continue
      registrarSaidaAcertada(
        venda.leilao.playerId, venda.valor, venda.vencedor.clubeNome, janelaAberta, "leilao",
      )
    }
    setVendas(fechados)
    // ⚠️ `commitGameState`, NAO `setState`. Sair desta tela (o botao "Ir para o
    // escritorio" navega na mesma tacada) desmonta o componente antes de o React
    // processar a fila, e o `setState` do useGameState so grava DENTRO desse
    // atualizador — o anuncio ja resolvido voltaria na proxima visita.
    //
    // O caixa em si nao corre risco de ser creditado duas vezes: o motor recusa a
    // segunda chamada (o atleta ja saiu, ou ja esta na fila de saida). Mas o
    // desfecho apareceria de novo, e o anuncio ficaria preso para sempre.
    commitGameState({ leiloesDeVenda: abertos })
    setState({ leiloesDeVenda: abertos })
  }, [state.leiloesDeVenda, state.week, candidatos, semana, season, userTeam, setState, registrarSaidaAcertada])

  const anunciar = useCallback((anuncio: LeilaoDeVenda) => {
    const atualizado = commitGameState(atual => ({
      leiloesDeVenda: [...(atual.leiloesDeVenda ?? []), anuncio],
    }))
    setState({ leiloesDeVenda: atualizado.leiloesDeVenda })
  }, [setState])
  const cancelarAnuncio = useCallback((id: string) => {
    const atualizado = commitGameState(atual => ({
      leiloesDeVenda: (atual.leiloesDeVenda ?? []).filter(a => a.id !== id),
    }))
    setState({ leiloesDeVenda: atualizado.leiloesDeVenda })
  }, [setState])

  // ABERTURA DELIBERADA vs PASSAGEM DO PÓS-PARTIDA. A partida manda todo mundo
  // para cá e a tela sai sozinha quando não há disputa nenhuma — comportamento
  // certo para uma passagem, e fatal para quem veio ANUNCIAR um atleta (seria
  // expulso antes de conseguir). `?ver=vender` marca a visita intencional.
  const [aba, setAba] = useState<"comprar" | "vender">("comprar")
  const [visitaDeliberada, setVisitaDeliberada] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (new URLSearchParams(window.location.search).get("ver") !== "vender") return
    setAba("vender")
    setVisitaDeliberada(true)
  }, [])

  // SEM LEILÃO A TELA NÃO EXISTE: a partida manda todo mundo para cá porque
  // descobrir isso no fim do jogo exigiria gerar o catálogo inteiro do mercado
  // ali. Quando não há disputa, seguimos sozinhos para o pré-escritório — que era
  // o destino original do pós-partida.
  //
  // ⚠️ Nunca sair enquanto houver desfecho para mostrar: era assim que a vitória
  // no leilão sumia sem o jogador ver nada.
  //
  // ⚠️ O LEILÃO DE VENDA TAMBÉM SEGURA A TELA. Sair com um anúncio seu aberto (ou
  // com uma venda recém-fechada por mostrar) esconderia o dinheiro que acabou de
  // entrar e o atleta que está de saída.
  const [saindo, setSaindo] = useState(false)
  const nadaAResolver =
    !visitaDeliberada &&
    quantos === 0 && desfechos.length === 0 && (state.lancesEmLeilao?.length ?? 0) === 0 &&
    vendas.length === 0 && (state.leiloesDeVenda?.length ?? 0) === 0
  useEffect(() => {
    if (nadaAResolver && !saindo) {
      setSaindo(true)
      hardNavigate("/pre-office")
    }
  }, [nadaAResolver, saindo])

  if (nadaAResolver) {
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
                {aba === "vender"
                  ? "Anuncie um atleta seu e deixe o mercado disputar o preço."
                  : "Atletas em disputa por mais de um clube. Cobrir agora ou perder o alvo."}
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

        {/* ABAS: comprar (disputa por atleta de outro clube) x vender (os SEUS
            atletas anunciados). Ver lib/leilao-de-venda.ts. */}
        <div className="mb-5 flex gap-2">
          {([["comprar", "Comprar", Gavel], ["vender", "Vender", Coins]] as const).map(([id, rotulo, Icone]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                aba === id
                  ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                  : "border border-white/10 text-white/55 hover:border-white/25 hover:text-white",
              )}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
              {id === "vender" && (state.leiloesDeVenda?.length ?? 0) > 0 && (
                <span className="rounded bg-black/25 px-1.5 text-[10px] tabular-nums">{state.leiloesDeVenda?.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* DESFECHO DOS SEUS ANÚNCIOS. Aparece nas duas abas: o dinheiro já entrou
            no caixa e esconder isso atrás de uma aba seria a mesma falha do
            "vencedor do leilão que sumia sem o jogador ver nada". */}
        {vendas.length > 0 && (
          <div className="mb-6 space-y-3">
            {vendas.map(v => (
              <div
                key={v.leilao.id}
                className={v.vencedor
                  ? "rounded-xl border border-[var(--brand)]/35 bg-[var(--brand)]/10 p-4"
                  : "rounded-xl border border-white/10 bg-white/[0.03] p-4"}
              >
                <div className="flex items-start gap-3">
                  {v.vencedor
                    ? <Coins className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
                    : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-white/35" />}
                  <div>
                    <p className={v.vencedor ? "font-semibold text-[var(--brand)]" : "font-semibold text-white/80"}>
                      {v.vencedor
                        ? `${v.leilao.playerName} foi arrematado por ${formatCurrency(v.valor)}`
                        : `Ninguém levou ${v.leilao.playerName}`}
                    </p>
                    <p className="mt-0.5 text-sm text-white/50">{v.motivo}</p>
                    {v.vencedor && (
                      <p className="mt-1 text-xs text-white/45">
                        {isTransferWindowOpen(state.week ?? 0)
                          ? "O valor entrou no caixa e o atleta já deixou o elenco."
                          : "O valor entrou no caixa. Ele continua jogando por você até a janela de transferências abrir."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {aba === "vender" ? (
          <LeilaoVendaPanel
            elenco={elencoDoMotor.map(p => ({
              id: p.id, name: p.name, position: p.position, age: p.age,
              overall: p.overall, marketValue: p.marketValue, isLoanedIn: p.isLoanedIn,
            }))}
            anuncios={state.leiloesDeVenda ?? []}
            candidatos={candidatos}
            semana={semana}
            season={season}
            clubeDoUsuario={{ curto: userTeam?.curto ?? "", nome: userTeam?.nome ?? "Seu clube" }}
            elencoMinimo={ELENCO_MINIMO}
            onAnunciar={anunciar}
            onCancelar={cancelarAnuncio}
          />
        ) : (
        <>
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
        </>
        )}
      </main>
    </div>
  )
}
