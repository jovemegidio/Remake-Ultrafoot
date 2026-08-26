"use client"

/**
 * LOJA E MARCA (1.0.377) — a casa de tudo que se compra e de tudo que paga.
 *
 * ─── POR QUE UMA TELA, E NÃO MAIS UM PAINEL ─────────────────────────────────
 *
 * Até a 1.0.376 as compras do atleta estavam espalhadas por três telas, sempre
 * como sobra de espaço em painéis que existiam para outra coisa: equipamento
 * dentro da EVOLUÇÃO (entre atributos e treino), bens e patrocínio dentro da
 * REPERCUSSÃO (entre posts da imprensa), e a aposta dentro do cartão da PRÓXIMA
 * PARTIDA. Cada um deles como uma fila de botõezinhos de 10 px.
 *
 * ⚠️ O PROBLEMA NÃO ERA "FALTA DE ENFEITE" — ERA FALTA DE COMPARAÇÃO. Escolher
 * entre a Chuteira Veloz e a Chuteira Precisão exige ver as duas lado a lado,
 * com o bônus e o preço, sabendo quanto se tem no bolso. Nas três telas antigas
 * o saldo estava sempre em OUTRO painel: o jogador clicava e descobria depois.
 * Juntar as compras num lugar só, com a barra de saldo em cima, é o que torna a
 * decisão possível — o desenho bonito vem junto, mas não é o motivo.
 *
 * ─── O QUE NÃO SAIU DO LUGAR ────────────────────────────────────────────────
 *
 * As telas antigas continuam funcionando e continuam mostrando o que já
 * mostravam; nada foi arrancado. Mover UI que funciona só para agrupar é o tipo
 * de refactor grande que este modo já pagou caro (ver o comentário no topo de
 * `vida/page.tsx`). O que a evolução e a repercussão ganharam foi um atalho
 * para cá, e a loja é onde a escolha fica confortável.
 */

import { useMemo, useState } from "react"
import {
  Banknote, BadgeDollarSign, Car, Dices, Footprints, Gem, HeartPulse,
  Home, Shield, ShoppingBag, Sparkles, Star, TrendingUp, Zap,
} from "lucide-react"

import { AtletaShell, PainelDoAtleta } from "@/components/carreira-jogador/atleta-shell"
import { BarraDaVitrine, CartaoDaVitrine, PrateleiraDaVitrine } from "@/components/carreira-jogador/vitrine"
import { useGameState } from "@/lib/save-system"
import { useTranslation } from "@/lib/i18n"
import { hardNavigate } from "@/lib/hard-navigation"
import { useControleDoAtleta } from "@/hooks/use-controle-do-atleta"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import {
  BENS_DO_ATLETA, EQUIPAMENTOS_DO_ATLETA, NOME_DO_ATRIBUTO,
  assinarPatrocinioDaProposta, comprarBemDoAtleta, comprarEquipamento, economiaDoAtleta,
  equiparItem, fazerAparicaoDeMarca, fazerAposta, negociarPatrocinio, propostasDePatrocinio,
  recusarPropostaDePatrocinio,
  type CategoriaDeEquipamento, type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"
import {
  ENERGIA_POR_APARICAO, avaliarContrato, rotuloDaCategoriaDeMarca, rotuloDaClausula,
  rotuloDoNivelDaMarca, type PedidoNaNegociacao,
} from "@/lib/patrocinio-pessoal"

type Aba = "equipamento" | "estilo" | "marca" | "apostas"

/** O ícone de cada prateleira. Categoria decide a silhueta — ver `vitrine.tsx`. */
const ICONE_DO_EQUIPAMENTO: Record<CategoriaDeEquipamento, typeof Footprints> = {
  chuteira: Footprints,
  acessorio: Shield,
  recuperacao: HeartPulse,
}

const ICONE_DO_BEM = { imovel: Home, carro: Car, luxo: Gem } as const

export default function LojaDoAtletaPage() {
  useControleDoAtleta({ rota: "/carreira/jogador/loja" })
  const { state, setState } = useGameState()
  const t = useTranslation().carreiraDeJogador
  const carreira = state.carreiraDeJogador
  const [aba, setAba] = useState<Aba>("equipamento")
  const [fatia, setFatia] = useState(10)

  const aplicar = (novo: EstadoCarreiraDeJogador) => setState({ carreiraDeJogador: novo })

  const dados = useMemo(() => {
    if (!carreira) return null
    return {
      economia: economiaDoAtleta(carreira),
      propostas: propostasDePatrocinio(carreira).filter(p => p.estado === "aberta"),
      contratos: carreira.patrociniosAtivos ?? [],
      encerrados: carreira.patrociniosEncerrados ?? [],
      patrimonio: carreira.patrimonio ?? { itens: [], estilo: 0, totalManutencao: 0 },
      proxima: carreira.calendario.find(f => !f.played && f.isUserMatch) ?? null,
    }
  }, [carreira])

  if (!carreira || !dados) {
    return (
      <main className="grid h-screen place-items-center bg-[#06090d] text-white/70">
        <div className="text-center">
          <p className="text-sm">{t.nenhuma_carreira_aberta}</p>
          <button onClick={() => hardNavigate("/")} className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-xs">
            {t.voltar_ao_inicio}
          </button>
        </div>
      </main>
    )
  }

  const { economia, propostas, contratos, encerrados, patrimonio, proxima } = dados

  const ABAS: { id: Aba; rotulo: string; icone: typeof ShoppingBag }[] = [
    { id: "equipamento", rotulo: t.aba_equipamento, icone: ShoppingBag },
    { id: "estilo", rotulo: t.aba_estilo, icone: Gem },
    { id: "marca", rotulo: t.aba_marca, icone: BadgeDollarSign },
    { id: "apostas", rotulo: t.aba_apostas, icone: Dices },
  ]

  /** O texto do bônus de um equipamento, montado do próprio dado. */
  const efeitosDoEquipamento = (bonus: Record<string, number | undefined>, bonusEnergia?: number) => {
    const lista = Object.entries(bonus)
      .filter(([, v]) => typeof v === "number" && v !== 0)
      .map(([k, v]) => `+${v} ${NOME_DO_ATRIBUTO[k as keyof typeof NOME_DO_ATRIBUTO]}`)
    if (bonusEnergia) lista.push(`+${bonusEnergia} ${t.energia}`)
    return lista
  }

  const limiteDaAposta = Math.floor(economia.dinheiro * 0.25)
  const valorDaAposta = Math.max(100, Math.floor((economia.dinheiro * fatia) / 100))

  return (
    <AtletaShell carreira={carreira} ativa="loja">
      <div className="flex h-full min-h-0 flex-col gap-3">

        <BarraDaVitrine
          itens={[
            { rotulo: t.dinheiro, valor: formatCurrency(economia.dinheiro), icone: <Banknote className="h-4 w-4" />, tom: "brand" },
            { rotulo: t.energia, valor: `${Math.round(economia.energia)}/${economia.energiaMaxima}`, icone: <Zap className="h-4 w-4" /> },
            { rotulo: t.estilo, valor: String(patrimonio.estilo), icone: <Sparkles className="h-4 w-4" /> },
            { rotulo: t.reputacao, valor: String(carreira.reputacao ?? 30), icone: <Star className="h-4 w-4" /> },
          ]}
        />

        <nav className="flex shrink-0 flex-wrap gap-2">
          {ABAS.map(({ id, rotulo, icone: Icone }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              aria-current={aba === id ? "true" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors",
                aba === id
                  ? "border-[var(--brand)]/50 bg-[var(--brand)]/10 text-white"
                  : "border-white/10 bg-black/30 text-white/50 hover:text-white",
              )}
            >
              <Icone className={cn("h-3.5 w-3.5", aba === id ? "text-[var(--brand)]" : "text-white/35")} />
              {rotulo}
            </button>
          ))}
        </nav>

        <PainelDoAtleta titulo={ABAS.find(a => a.id === aba)!.rotulo} className="min-h-0 flex-1">

          {/* ── EQUIPAMENTO ─────────────────────────────────────────────── */}
          {aba === "equipamento" && (
            <>
              {(["chuteira", "acessorio", "recuperacao"] as CategoriaDeEquipamento[]).map(cat => {
                const Icone = ICONE_DO_EQUIPAMENTO[cat]
                const daCategoria = EQUIPAMENTOS_DO_ATLETA.filter(e => e.categoria === cat)
                const emUso = economia.equipamentosEmUso[cat]
                return (
                  <PrateleiraDaVitrine
                    key={cat}
                    titulo={cat === "chuteira" ? t.prateleira_chuteiras : cat === "acessorio" ? t.prateleira_acessorios : t.prateleira_recuperacao}
                    subtitulo={emUso ? `${t.em_uso}: ${EQUIPAMENTOS_DO_ATLETA.find(e => e.id === emUso)?.nome ?? ""}` : t.nada_equipado}
                  >
                    {daCategoria.map(item => {
                      const comprado = economia.equipamentosComprados.includes(item.id)
                      return (
                        <CartaoDaVitrine
                          key={item.id}
                          id={item.id}
                          nome={item.nome}
                          descricao={item.descricao}
                          categoria={cat === "chuteira" ? t.prateleira_chuteiras : cat === "acessorio" ? t.prateleira_acessorios : t.prateleira_recuperacao}
                          preco={item.preco}
                          icone={<Icone className="h-7 w-7" />}
                          efeitos={efeitosDoEquipamento(item.bonus as Record<string, number | undefined>, item.bonusEnergia)}
                          comprado={comprado}
                          equipado={emUso === item.id}
                          acessivel={economia.dinheiro >= item.preco}
                          aoAgir={() => aplicar(comprado ? equiparItem(carreira, item.id) : comprarEquipamento(carreira, item.id))}
                        />
                      )
                    })}
                  </PrateleiraDaVitrine>
                )
              })}
            </>
          )}

          {/* ── ESTILO DE VIDA ──────────────────────────────────────────── */}
          {aba === "estilo" && (
            <>
              {/* ⚠️ A LINHA ABAIXO É O QUE JUSTIFICA A PRATELEIRA INTEIRA. Até a
                  1.0.376 `estilo` era um contador que nada lia; agora ele entra
                  no apelo comercial (`lib/patrocinio-pessoal`), e o jogador
                  precisa ler isso NA HORA de gastar 650 mil numa lancha. */}
              <p className="mb-3 rounded-xl border border-amber-300/15 bg-amber-300/[.05] px-3 py-2 text-[11px] leading-snug text-amber-100/70">
                {t.estilo_explicacao}
              </p>
              <PrateleiraDaVitrine
                titulo={t.bens_de_status}
                subtitulo={`${patrimonio.itens.length} · ${t.manutencao}: ${formatCurrency(patrimonio.totalManutencao)}`}
              >
                {BENS_DO_ATLETA.map(bem => {
                  const Icone = ICONE_DO_BEM[bem.categoria]
                  const tem = patrimonio.itens.includes(bem.id)
                  return (
                    <CartaoDaVitrine
                      key={bem.id}
                      id={bem.id}
                      nome={bem.nome}
                      descricao={`+${bem.estilo} ${t.estilo} · ${formatCurrency(bem.manutencaoSemanal)}${t.por_semana}`}
                      categoria={bem.categoria === "imovel" ? t.categoria_imovel : bem.categoria === "carro" ? t.categoria_carro : t.categoria_luxo}
                      preco={bem.preco}
                      icone={<Icone className="h-7 w-7" />}
                      efeitos={[`+${bem.estilo} ${t.estilo}`]}
                      comprado={tem}
                      acessivel={economia.dinheiro >= bem.preco}
                      aoAgir={tem ? undefined : () => aplicar(comprarBemDoAtleta(carreira, bem.id))}
                    />
                  )
                })}
              </PrateleiraDaVitrine>
            </>
          )}

          {/* ── MARCA ───────────────────────────────────────────────────── */}
          {aba === "marca" && (
            <div className="space-y-5">

              <section>
                <h3 className="mb-2 text-[12px] font-black uppercase tracking-wider text-white/80">{t.propostas_na_mesa}</h3>
                {propostas.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-[12px] leading-relaxed text-white/45">
                    {t.sem_propostas_de_marca}
                  </p>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {propostas.map(p => (
                      <article key={p.id} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.04] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-white/90">{p.marca}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-100/55">
                              {rotuloDaCategoriaDeMarca(p.categoria)} · {rotuloDoNivelDaMarca(p.nivel)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black tabular-nums text-[var(--brand)]">{formatCurrency(p.valorSemanal)}</p>
                            <p className="text-[10px] text-white/40">{t.por_semana}</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          {[
                            { r: t.luvas, v: formatCurrency(p.luvas) },
                            { r: t.duracao, v: `${p.semanas} ${t.semanas}` },
                            { r: t.bonus_por_gol, v: formatCurrency(p.bonusPorGol) },
                          ].map(x => (
                            <div key={x.r} className="rounded-lg bg-black/35 px-2 py-1.5">
                              <p className="text-[9px] font-black uppercase tracking-wide text-white/35">{x.r}</p>
                              <p className="text-[11px] font-bold tabular-nums text-white/85">{x.v}</p>
                            </div>
                          ))}
                        </div>

                        <ul className="mt-3 space-y-1">
                          {p.clausulas.map(cl => (
                            <li key={cl.tipo} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-white/60">{rotuloDaClausula(cl.tipo)} · {t.meta} {cl.alvo}</span>
                              <span className="text-emerald-200/70">+{formatCurrency(cl.bonus)} / −{formatCurrency(cl.multa)}</span>
                            </li>
                          ))}
                          {p.custoDeTorcida > 0 && (
                            <li className="text-[11px] font-bold text-rose-300/80">−{p.custoDeTorcida} {t.apoio_da_torcida}</li>
                          )}
                        </ul>

                        {p.recado && <p className="mt-2 text-[11px] italic text-amber-200/70">{p.recado}</p>}

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {([
                            ["valor", t.pedir_mais_valor],
                            ["luvas", t.pedir_luvas],
                            ["prazo", t.encurtar_contrato],
                            ["tirar_clausula", t.tirar_exigencia],
                          ] as [PedidoNaNegociacao, string][]).map(([pedido, rotulo]) => (
                            <button
                              key={pedido}
                              onClick={() => aplicar(negociarPatrocinio(carreira, p.id, pedido))}
                              className="rounded-lg border border-white/12 px-2 py-1 text-[10px] font-bold text-white/60 hover:border-cyan-200/40 hover:text-white"
                            >
                              {rotulo}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[10px] text-white/30">{t.negociacao_rodada} {p.rodadaDeNegociacao}/3</p>

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => aplicar(assinarPatrocinioDaProposta(carreira, p.id))}
                            className="flex-1 rounded-lg bg-[var(--brand)]/85 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-black hover:bg-[var(--brand)]"
                          >
                            {t.assinar}
                          </button>
                          <button
                            onClick={() => aplicar(recusarPropostaDePatrocinio(carreira, p.id))}
                            className="rounded-lg border border-white/12 px-3 py-2 text-[11px] font-bold text-white/50 hover:text-white"
                          >
                            {t.recusar}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-[12px] font-black uppercase tracking-wider text-white/80">{t.carteira_de_marcas}</h3>
                {contratos.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-[12px] text-white/45">{t.sem_contratos_ativos}</p>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {contratos.map(c => {
                      const previa = avaliarContrato(c)
                      const faltaAparicao = c.aparicoesFeitas < c.aparicoesExigidas
                      return (
                        <article key={c.id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-white/90">{c.marca}</p>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">{rotuloDaCategoriaDeMarca(c.categoria)}</p>
                            </div>
                            <p className="text-[11px] tabular-nums text-white/55">{c.semanasRestantes}/{c.semanasTotais} {t.semanas}</p>
                          </div>

                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-[var(--brand)]/70"
                              style={{ width: `${Math.max(3, 100 - (c.semanasRestantes / Math.max(1, c.semanasTotais)) * 100)}%` }}
                            />
                          </div>

                          <ul className="mt-3 space-y-1.5">
                            {c.clausulas.map(cl => {
                              const ok = cl.cumprido >= cl.alvo
                              return (
                                <li key={cl.tipo}>
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-white/60">{rotuloDaClausula(cl.tipo)}</span>
                                    <span className={ok ? "text-emerald-300" : "text-amber-200/75"}>{cl.cumprido}/{cl.alvo}</span>
                                  </div>
                                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className={cn("h-full rounded-full", ok ? "bg-emerald-400" : "bg-amber-300/70")}
                                      style={{ width: `${Math.min(100, (cl.cumprido / Math.max(1, cl.alvo)) * 100)}%` }}
                                    />
                                  </div>
                                </li>
                              )
                            })}
                          </ul>

                          <p className={cn("mt-2 text-[11px] font-bold", previa.saldo >= 0 ? "text-emerald-300/80" : "text-rose-300/80")}>
                            {t.se_encerrasse_hoje} {previa.saldo >= 0 ? "+" : "−"}{formatCurrency(Math.abs(previa.saldo))}
                          </p>

                          {c.aparicoesExigidas > 0 && (
                            <button
                              disabled={!faltaAparicao || economia.energia < ENERGIA_POR_APARICAO}
                              onClick={() => aplicar(fazerAparicaoDeMarca(carreira, c.id))}
                              className="mt-3 w-full rounded-lg border border-cyan-200/25 px-3 py-2 text-[11px] font-bold text-cyan-100/80 disabled:opacity-30"
                            >
                              {faltaAparicao
                                ? `${t.cumprir_aparicao} · −${ENERGIA_POR_APARICAO} ${t.energia}`
                                : t.aparicoes_em_dia}
                            </button>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>

              {encerrados.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[12px] font-black uppercase tracking-wider text-white/80">{t.historico_comercial}</h3>
                  <div className="space-y-1.5">
                    {encerrados.slice(-6).reverse().map((h, i) => (
                      <div key={`${h.marca}${h.temporada}${i}`} className="rounded-lg bg-black/30 px-3 py-2 text-[11px]">
                        <span className={cn("font-bold", h.cumpriu ? "text-emerald-300" : "text-rose-300")}>{h.marca}</span>
                        <span className="text-white/35"> · {h.temporada} · </span>
                        <span className="text-white/55">{h.resumo}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ── APOSTAS ─────────────────────────────────────────────────── */}
          {aba === "apostas" && (
            <div className="mx-auto max-w-2xl">
              {/* ⚠️ O AVISO NÃO É DECORAÇÃO REGULATÓRIA — É A REGRA DO SISTEMA.
                  Todo palpite paga menos que a probabilidade real dele, e o
                  jogador precisa saber disso antes de tratar a aposta como
                  fonte de renda. É o mesmo texto honesto que o cassino usa. */}
              <p className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/[.05] px-3 py-2 text-[11px] leading-snug text-amber-100/70">
                {t.toda_mesa_paga_menos}
              </p>

              {!proxima ? (
                <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-[12px] text-white/45">{t.sem_partida_para_apostar}</p>
              ) : carreira.apostaAtiva ? (
                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[.05] p-5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-100/60">{t.aposta_da_rodada}</p>
                  <p className="mt-1 text-2xl font-black capitalize text-white">{carreira.apostaAtiva.palpite}</p>
                  <p className="mt-1 text-sm text-white/60">
                    {formatCurrency(carreira.apostaAtiva.valor)} · x{carreira.apostaAtiva.multiplicador} · {carreira.apostaAtiva.adversario}
                  </p>
                  <p className="mt-3 text-[12px] font-bold text-emerald-300">
                    {t.retorno_possivel} {formatCurrency(Math.round(carreira.apostaAtiva.valor * carreira.apostaAtiva.multiplicador))}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/35">{t.proxima_partida}</p>
                    <p className="text-sm font-black text-white/90">
                      {proxima.homeCurto === carreira.clubeCurto ? proxima.awayNome : proxima.homeNome}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {proxima.homeCurto === carreira.clubeCurto ? t.em_casa : t.fora} · {t.proxima} {proxima.round}
                    </p>
                  </div>

                  {/* O painel de odds: três colunas grandes, cotação em destaque
                      e o retorno já calculado. É a diferença entre apostar e
                      apertar um botão que diz "empate". */}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["vitoria", 1.8, t.palpite_vitoria],
                      ["empate", 3.1, t.palpite_empate],
                      ["derrota", 2.5, t.palpite_derrota],
                    ] as const).map(([palpite, odd, rotulo]) => (
                      <button
                        key={palpite}
                        disabled={valorDaAposta > limiteDaAposta || valorDaAposta < 100}
                        onClick={() => aplicar(fazerAposta(carreira, palpite, valorDaAposta))}
                        className="group rounded-2xl border border-white/12 bg-black/40 p-4 text-center transition-all hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-amber-300/[.06] disabled:opacity-30"
                      >
                        <p className="text-[10px] font-black uppercase tracking-wider text-white/45">{rotulo}</p>
                        <p className="mt-1 text-3xl font-black tabular-nums text-amber-200">{odd.toFixed(2)}</p>
                        <p className="mt-1 text-[10px] text-white/40">{t.retorno_possivel}</p>
                        <p className="text-[12px] font-bold tabular-nums text-emerald-300/85">
                          {formatCurrency(Math.round(valorDaAposta * odd))}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/40">{t.valor_da_aposta}</p>
                      <p className="text-lg font-black tabular-nums text-white">{formatCurrency(valorDaAposta)}</p>
                    </div>
                    <input
                      aria-label={t.valor_da_aposta}
                      type="range"
                      min={1}
                      max={25}
                      value={fatia}
                      onChange={e => setFatia(Number(e.target.value))}
                      className="mt-2 w-full accent-amber-300"
                    />
                    <p className="mt-1 text-[10px] text-white/35">
                      {fatia}% · {t.limite_da_banca} {formatCurrency(limiteDaAposta)}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </PainelDoAtleta>

        <p className="flex shrink-0 items-center justify-center gap-1.5 text-[10px] text-white/25">
          <TrendingUp className="h-3 w-3" /> {t.loja_rodape}
        </p>
      </div>
    </AtletaShell>
  )
}
