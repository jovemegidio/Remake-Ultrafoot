"use client"

// AJUSTES FINAIS — a última parada antes do apito.
//
// ⚠️ POR QUE ISTO EXISTE (pedido: "ao apertar D, algo como tática, escalação,
// informações do estádio — uma última chance do usuário configurar seu time
// antes do jogo começar"; e, junto, "ao entrar nessa tela de pré-jogo o jogador
// não pode retornar ao office/pre-office").
//
// As duas coisas andam juntas: se a pré-partida deixou de ter volta, ela precisa
// oferecer AQUI o que o técnico ia buscar no escritório. Sem isso, tirar o botão
// "Voltar" seria só tirar uma opção.
//
// UMA DECISÃO QUE IMPORTA: este painel NÃO reimplementa tática nem escalação. Ele
// mostra o que está valendo e leva às telas que já existem — duplicar a edição
// aqui criaria uma segunda fonte de verdade para formação e titulares, que é
// exatamente o defeito que `saveTacticalSetup` existe para evitar. O que dá para
// mudar sem sair daqui é só o que é de UMA tecla: mentalidade e capitão.

import { useMemo, useState } from "react"
import { X, Users, ClipboardList, Building2, ArrowRight, ShieldAlert, Repeat } from "lucide-react"
import { useGameEngine, type TeamMentality } from "@/lib/game-engine"
import { formatNumber, type Team } from "@/lib/teams-data"
import { CampoEBilheteria } from "@/components/match/campo-e-bilheteria"
import { cn } from "@/lib/utils"

/**
 * Mentalidades na ordem em que aparecem — da mais recuada à mais adiantada.
 * Os ids são os do motor (`TeamMentality`), não rótulos livres: inventar um id
 * aqui faria a escolha do técnico não chegar ao campo.
 */
const MENTALIDADES: { id: TeamMentality; rotulo: string; desc: string }[] = [
  { id: "muito_defensivo", rotulo: "Retranca", desc: "Todos atrás da linha da bola" },
  { id: "defensivo", rotulo: "Defensiva", desc: "Bloco baixo, sai no contra-ataque" },
  { id: "equilibrado", rotulo: "Equilibrada", desc: "Sem risco extra" },
  { id: "ofensivo", rotulo: "Ofensiva", desc: "Linha alta, mais gente na frente" },
  { id: "muito_ofensivo", rotulo: "All-in", desc: "Tudo no ataque, defesa exposta" },
]

interface Props {
  aberto: boolean
  onFechar: () => void
  /** Clube do usuário nesta partida. */
  meuTime: Team
  /** Adversário — só para o cabeçalho. */
  adversario: Team
  /** Estádio onde a partida acontece. */
  estadio?: { nome?: string; capacidade?: number; mandante: boolean }
}

export function AjustesFinais({ aberto, onFechar, meuTime, adversario, estadio }: Props) {
  const formacao = useGameEngine(s => s.formation)
  const elenco = useGameEngine(s => s.squadPlayers)
  const taticas = useGameEngine(s => s.teamTactics)
  const setTeamTactics = useGameEngine(s => s.setTeamTactics)
  const setFormation = useGameEngine(s => s.setFormation)
  const setStarters = useGameEngine(s => s.setStarters)

  /** Prancheta ABERTA POR CIMA do pre-jogo — sem sair da partida. */
  const [pranchetaAberta, setPranchetaAberta] = useState(false)
  /** Atleta escolhido para a troca (clique nele, depois no substituto). */
  const [trocando, setTrocando] = useState<number | null>(null)

  const titulares = useMemo(() => elenco.filter(p => p.isStarter), [elenco])

  // O que o técnico precisa VER antes de decidir: quem está indisponível e quem
  // entra em campo abaixo do normal. É a informação que ele iria buscar no elenco.
  const problemas = useMemo(() => {
    const lesionados = titulares.filter(p => p.injury)
    const suspensos = titulares.filter(p => (p.suspendedMatches ?? 0) > 0)
    const cansados = titulares.filter(p => (p.energy ?? 100) < 60 && !p.injury)
    return { lesionados, suspensos, cansados }
  }, [titulares])

  if (!aberto) return null

  const mentalidadeAtual = String(taticas?.mentality ?? "equilibrado")

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d12]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">Ajustes finais</h2>
            <p className="truncate text-xs text-white/45">
              {meuTime.nome} x {adversario.nome} — última chance antes do apito
            </p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-2 hover:bg-white/10" aria-label="Fechar">
            <X className="h-5 w-5 text-white/60" />
          </button>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          {/* ── ESCALAÇÃO ─────────────────────────────────────────────────── */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Users className="h-4 w-4 text-[var(--brand)]" />
                Escalação
              </h3>
              {/* ⚠️ ESTE BOTAO LEVAVA PARA /elenco/gerenciamento — para FORA da
                  partida. Alem de perder o pre-jogo, dava ao tecnico uma volta
                  pelo elenco depois de ja ter visto o adversario escalado, que
                  e vantagem que a partida nao deveria oferecer. A prancheta
                  agora abre AQUI DENTRO, por cima do proprio pre-jogo. */}
              <button
                onClick={() => setPranchetaAberta(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75 hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
              >
                Abrir prancheta <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* PRANCHETA NO PROPRIO PRE-JOGO. Formacao + troca de titular, que e
                o que o tecnico realmente mexe no apito. A prancheta completa
                (setas de movimentacao, instrucao por atleta) continua no
                elenco, fora da partida — ali nao ha vantagem a extrair. */}
            {pranchetaAberta && (
              <div className="mb-4 rounded-lg border border-[var(--brand)]/25 bg-black/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand)]">Prancheta</p>
                  <button
                    onClick={() => { setPranchetaAberta(false); setTrocando(null) }}
                    className="text-[11px] text-white/50 hover:text-white"
                  >
                    fechar
                  </button>
                </div>

                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-white/40">Formação</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2"].map(f => (
                    <button
                      key={f}
                      onClick={() => setFormation(f)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-bold transition-colors",
                        formacao === f ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/10 text-white/70 hover:bg-white/15",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-white/40">
                  {trocando == null ? "Toque num titular para trocá-lo" : "Agora toque em quem entra"}
                </p>
                <div className="max-h-40 overflow-y-auto pr-1">
                  {[...titulares, ...elenco.filter(p => !p.isStarter)].map(p => {
                    const titular = p.isStarter
                    const selecionado = trocando === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (trocando == null) { if (titular) setTrocando(p.id); return }
                          if (p.id === trocando) { setTrocando(null); return }
                          if (titular) return // troca e sempre titular <-> reserva
                          const ids = elenco.filter(x => x.isStarter).map(x => x.id)
                          setStarters([...ids.filter(id => id !== trocando), p.id])
                          setTrocando(null)
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          selecionado ? "bg-[var(--brand)]/25 ring-1 ring-[var(--brand)]"
                            : titular ? "text-white hover:bg-white/10" : "text-white/55 hover:bg-white/10",
                        )}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          {selecionado && <Repeat className="h-3 w-3 shrink-0 text-[var(--brand)]" />}
                          <span className="w-9 shrink-0 text-[10px] font-bold text-white/40">{p.position}</span>
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="shrink-0 font-bold">{p.overall}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Campo, estádio e bilheteria — o contexto que faltava para decidir. */}
            <CampoEBilheteria
              formacao={formacao}
              titulares={titulares}
              mandante={estadio?.mandante === false ? adversario : meuTime}
              visitante={estadio?.mandante === false ? meuTime : adversario}
              souMandante={estadio?.mandante !== false}
              nomeEstadio={estadio?.nome}
            />

            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-black/30 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Formação</p>
                <p className="text-base font-black text-white">{formacao || "—"}</p>
              </div>
              <div className="rounded-lg bg-black/30 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Titulares</p>
                <p className={cn("text-base font-black tabular-nums",
                  titulares.length === 11 ? "text-white" : "text-amber-300")}>
                  {titulares.length}/11
                </p>
              </div>
              <div className="rounded-lg bg-black/30 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Elenco</p>
                <p className="text-base font-black tabular-nums text-white">{elenco.length}</p>
              </div>
            </div>

            {/* Avisos que mudam a decisão — não é enfeite. */}
            {(problemas.lesionados.length > 0 || problemas.suspensos.length > 0 || problemas.cansados.length > 0) && (
              <div className="mt-3 space-y-1.5">
                {problemas.lesionados.length > 0 && (
                  <p className="flex items-start gap-2 text-xs text-red-300">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span><b>{problemas.lesionados.length} lesionado(s)</b> escalado(s): {problemas.lesionados.slice(0, 3).map(p => p.name).join(", ")}</span>
                  </p>
                )}
                {problemas.suspensos.length > 0 && (
                  <p className="flex items-start gap-2 text-xs text-red-300">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span><b>{problemas.suspensos.length} suspenso(s)</b> escalado(s): {problemas.suspensos.slice(0, 3).map(p => p.name).join(", ")}</span>
                  </p>
                )}
                {problemas.cansados.length > 0 && (
                  <p className="flex items-start gap-2 text-xs text-amber-300/90">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span><b>{problemas.cansados.length}</b> titular(es) abaixo de 60% de energia</span>
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── TÁTICA ────────────────────────────────────────────────────── */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <ClipboardList className="h-4 w-4 text-[var(--brand)]" />
                Mentalidade
              </h3>
              <button
                onClick={() => setPranchetaAberta(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75 hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
              >
                Táticas completas <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {MENTALIDADES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setTeamTactics({ mentality: m.id })}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    mentalidadeAtual === m.id
                      ? "border-[var(--brand)]/60 bg-[var(--brand)]/10"
                      : "border-white/10 bg-black/30 hover:border-white/25",
                  )}
                >
                  <p className={cn("text-sm font-bold",
                    mentalidadeAtual === m.id ? "text-[var(--brand)]" : "text-white/80")}>
                    {m.rotulo}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-tight text-white/45">{m.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* ── ESTÁDIO ───────────────────────────────────────────────────── */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <Building2 className="h-4 w-4 text-[var(--brand)]" />
              Estádio
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-black/30 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Praça</p>
                <p className="truncate text-sm font-semibold text-white">{estadio?.nome || "—"}</p>
              </div>
              <div className="rounded-lg bg-black/30 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Capacidade</p>
                <p className="text-sm font-semibold tabular-nums text-white">
                  {estadio?.capacidade ? formatNumber(estadio.capacidade) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-black/30 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Mando</p>
                <p className={cn("text-sm font-semibold",
                  estadio?.mandante ? "text-[var(--brand)]" : "text-white/70")}>
                  {estadio?.mandante ? "Você joga em casa" : "Fora de casa"}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ⚠️ LESIONADO E SUSPENSO NAO ENTRAM EM CAMPO — E POR MOTIVOS DIFERENTES.
            Antes os dois eram apenas AVISOS: dava para clicar "Estou pronto" com
            um expulso escalado e comecar a partida com dez em campo na pratica.
            Agora o botao trava, e a mensagem diz QUAL e o impedimento de cada um:
            o lesionado nao tem condicao fisica (decisao do departamento medico),
            o suspenso esta cumprindo pena (decisao do tribunal). Sao naturezas
            distintas e o jogador precisa saber qual esta resolvendo. */}
        {(problemas.lesionados.length > 0 || problemas.suspensos.length > 0) && (
          <div className="border-t border-white/[0.07] bg-red-500/[0.07] px-6 py-3 space-y-1">
            {problemas.lesionados.length > 0 && (
              <p className="text-xs text-red-300">
                <b>Sem condições físicas:</b> {problemas.lesionados.map(p => p.name).join(", ")} —
                {" "}o departamento médico não libera. Troque antes de começar.
              </p>
            )}
            {problemas.suspensos.length > 0 && (
              <p className="text-xs text-red-300">
                <b>Cumprindo suspensão:</b> {problemas.suspensos.map(p => p.name).join(", ")} —
                {" "}impedido pelo regulamento, não pode ser relacionado.
              </p>
            )}
          </div>
        )}

        <div className="border-t border-white/[0.07] px-6 py-4">
          <button
            onClick={onFechar}
            disabled={problemas.lesionados.length > 0 || problemas.suspensos.length > 0}
            className="w-full rounded-lg bg-[var(--brand)] py-2.5 text-sm font-bold text-[var(--brand-ink)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {problemas.lesionados.length > 0 || problemas.suspensos.length > 0
              ? "Escalação irregular — troque os indisponíveis"
              : "Estou pronto"}
          </button>
        </div>
      </div>
    </div>
  )
}
