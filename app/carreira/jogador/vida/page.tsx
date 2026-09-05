"use client"

/**
 * VIDA FORA DE CAMPO (1.0.374) — a tela das camadas que a 1.0.373 não tinha.
 *
 * ⚠️ ELA NÃO DUPLICA A VISÃO GERAL, e essa fronteira é deliberada. Parceira,
 * bens, patrocínio e aposta já vivem em `/carreira/jogador` e funcionam; movê-los
 * para cá seria transportar UI que já está certa só para agrupar, com todo o
 * risco de um refactor grande e nenhum ganho para quem joga.
 *
 * Aqui está o que NÃO existia: as cinco relações com efeito, os quatro
 * companheiros com nome, o cassino, o haras, os convites da semana e o legado.
 */

import { useMemo } from "react"
import { AlertTriangle, Dices, Trophy, Users, HeartHandshake, CalendarHeart, Medal, Scale } from "lucide-react"
import { AtletaShell } from "@/components/carreira-jogador/atleta-shell"
import { useGameState } from "@/lib/save-system"
import { useTranslation } from "@/lib/i18n"
import { hardNavigate } from "@/lib/hard-navigation"
import { useControleDoAtleta } from "@/hooks/use-controle-do-atleta"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import {
  comparecerAoEvento, comprarCavalo, conquistasDaCarreira, decidirDilema, dilemaDaVez,
  economiaDoAtleta, eventosDoMomento, jogarNoCassinoDoAtleta, pontuacaoAtual, relacoesDoAtleta,
  venderCavalo, folhaDaCarreira,
  type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"
import { rotuloDaCategoria } from "@/lib/dilemas-do-atleta"
import {
  efeitoDaPessoa, efeitoDoPapel, lerCompanheiros, lerRelacoes, rotuloDaPessoa,
  rotuloDoNivel, rotuloDoPapel, rotuloDaTorcida, climaDoVestiario, PESSOAS,
} from "@/lib/relacoes-do-atleta"
import { CAVALOS_DO_ATLETA, MESAS_DE_CASSINO } from "@/lib/vida-noturna-do-atleta"
import { CONQUISTAS, montarRanking, posicaoNoRanking } from "@/lib/legado-do-atleta"

/** Barra 0–100 com a cor do tom. Nível cru não diz nada ao jogador. */
function Medidor({ valor, tom }: { valor: number; tom: "bom" | "neutro" | "ruim" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={cn("h-full rounded-full transition-all",
          tom === "bom" ? "bg-emerald-400" : tom === "neutro" ? "bg-amber-300" : "bg-rose-400")}
        style={{ width: `${Math.max(2, valor)}%` }}
      />
    </div>
  )
}

export default function VidaDoAtletaPage() {
  useControleDoAtleta({ rota: "/carreira/jogador/vida" })
  const { state, setState } = useGameState()
  const t = useTranslation().carreiraDeJogador
  const carreira = state.carreiraDeJogador

  const aplicar = (novo: EstadoCarreiraDeJogador) => setState({ carreiraDeJogador: novo })

  const dados = useMemo(() => {
    if (!carreira) return null
    const relacoes = lerRelacoes(relacoesDoAtleta(carreira))
    const time = lerCompanheiros(carreira.companheiros, carreira.clubeCurto, String(carreira.atleta.posicao))
    return {
      relacoes,
      time,
      economia: economiaDoAtleta(carreira),
      eventos: eventosDoMomento(carreira),
      pontuacao: pontuacaoAtual(carreira),
      conquistas: conquistasDaCarreira(carreira),
      folha: folhaDaCarreira(carreira),
      cavalo: CAVALOS_DO_ATLETA.find(c => c.id === carreira.cavalo) ?? null,
      dilema: dilemaDaVez(carreira),
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

  const { relacoes, time, economia, eventos, pontuacao, conquistas, folha, cavalo, dilema } = dados
  const desfecho = carreira.ultimoDesfechoDeDilema
  const ranking = montarRanking(
    carreira.aposentado ? [{
      nome: folha.nome, posicao: folha.posicao, pontos: carreira.pontuacaoFinal ?? pontuacao.total,
      jogos: folha.jogos, gols: folha.gols, titulos: folha.titulos, minha: true,
    }] : [],
  )

  return (
    <AtletaShell carreira={carreira} ativa="vida">
      {/* ⚠️ A ROLAGEM MORA AQUI DENTRO, não no `main`. O shell é `h-screen` +
          `overflow-hidden` (ver `atleta-shell.tsx`); uma tela que espera rolar o
          corpo simplesmente não rola dentro dele — foi assim que a cerimônia
          ficou sem rolagem numa versão anterior, e a causa era a cadeia de flex,
          não a falta de altura. */}
      <div className="grid h-full min-h-0 gap-4 overflow-y-auto pr-1 lg:grid-cols-2">

        {/* ── O DILEMA DA SEMANA (1.0.377) ───────────────────────────────
             ⚠️ ELE ABRE A TELA, E OCUPA AS DUAS COLUNAS. Um dilema espremido
             numa coluna, abaixo de quatro medidores, é lido como mais um
             painel de status — e o jogador clica a primeira opção sem ler o
             parágrafo que faz a decisão ser uma decisão. Aqui ele é a primeira
             coisa da tela e só some depois de decidido. */}
        {dilema ? (
          <section className="rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-400/[.10] via-black/40 to-black/50 p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Scale className="h-4 w-4 text-amber-300" />
              <span className="text-[10px] font-black uppercase tracking-[.2em] text-amber-200/70">{t.dilema_titulo}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/55">
                {rotuloDaCategoria(dilema.categoria)}
              </span>
            </div>
            <h2 className="uf-heading mt-2 text-xl font-black leading-tight text-white">{dilema.titulo}</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-white/65">{dilema.contexto}</p>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {dilema.escolhas.map(escolha => (
                <button
                  key={escolha.id}
                  onClick={() => aplicar(decidirDilema(carreira, escolha.id))}
                  className="group flex flex-col rounded-xl border border-white/12 bg-black/45 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-amber-300/[.07]"
                >
                  <span className="text-[13px] font-bold leading-snug text-white/90">{escolha.texto}</span>
                  <span className="mt-1.5 text-[11px] leading-snug text-white/45">{escolha.previa}</span>
                  {escolha.risco ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-rose-300/80">
                      <AlertTriangle className="h-3 w-3" /> {t.dilema_pode_dar_errado} · {Math.round(escolha.risco * 100)}%
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : desfecho ? (
          <section className={cn(
            "rounded-2xl border p-4 lg:col-span-2",
            desfecho.deuErrado ? "border-rose-400/30 bg-rose-500/[.07]" : "border-emerald-400/25 bg-emerald-500/[.06]",
          )}>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/45">{t.dilema_desfecho}</p>
            <p className="mt-1 text-sm font-black text-white/90">{desfecho.titulo}</p>
            <p className={cn("mt-1 text-[13px] leading-relaxed", desfecho.deuErrado ? "text-rose-100/75" : "text-emerald-100/75")}>
              {desfecho.texto}
            </p>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-white/35">
              {desfecho.deuErrado ? t.dilema_deu_errado : t.dilema_correu_bem}
            </p>
          </section>
        ) : (
          <p className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-[12px] text-white/35 lg:col-span-2">
            {t.dilema_nenhum}
          </p>
        )}

        {/* ── AS CINCO RELAÇÕES ─────────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
            <HeartHandshake className="h-4 w-4 text-[var(--brand)]" /> {t.relacoes}
          </h2>
          <div className="grid gap-3">
            {PESSOAS.map(p => {
              const nivel = relacoes[p]
              const rotulo = rotuloDoNivel(nivel)
              return (
                <div key={p}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-white/85">{rotuloDaPessoa(p)}</span>
                    <span className={cn("text-[11px]",
                      rotulo.tom === "bom" ? "text-emerald-300" : rotulo.tom === "neutro" ? "text-amber-200" : "text-rose-300")}>
                      {rotulo.texto}
                    </span>
                  </div>
                  <div className="mt-1"><Medidor valor={nivel} tom={rotulo.tom} /></div>
                  <p className="mt-1 text-[10px] text-white/40">{efeitoDaPessoa(p)}</p>
                </div>
              )
            })}

            {/* ⚠️ A TORCIDA APARECE AQUI E NÃO É UMA `Pessoa` (1.0.377). A fonte
                dela é `carreira.torcida`, o campo que já existia — ver a seção
                A TORCIDA em `lib/relacoes-do-atleta`. Ela é desenhada junto
                porque, para quem joga, arquibancada É uma relação; o que não
                pode existir é um segundo campo guardando o mesmo número. */}
            {(() => {
              const nivel = carreira.torcida ?? 50
              const rotulo = rotuloDaTorcida(nivel)
              return (
                <div className="border-t border-white/[.06] pt-3">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-white/85">{t.relacao_torcida}</span>
                    <span className={cn("text-[11px]",
                      rotulo.tom === "bom" ? "text-emerald-300" : rotulo.tom === "neutro" ? "text-amber-200" : "text-rose-300")}>
                      {rotulo.texto}
                    </span>
                  </div>
                  <div className="mt-1"><Medidor valor={nivel} tom={rotulo.tom} /></div>
                  <p className="mt-1 text-[10px] text-white/40">{t.efeito_torcida}</p>
                </div>
              )
            })()}
          </div>
        </section>

        {/* ── OS COMPANHEIROS ───────────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <h2 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
            <Users className="h-4 w-4 text-[var(--brand)]" /> {t.vestiario}
          </h2>
          <p className="mb-3 text-[10px] text-white/40">{t.clima_do_grupo}: {climaDoVestiario(time)}/100</p>
          <div className="grid gap-3">
            {time.map(c => {
              const rotulo = rotuloDoNivel(c.nivel)
              return (
                <div key={c.id}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-white/85">
                      {c.nome} <span className="text-white/40">· {c.posicao}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-white/45">{rotuloDoPapel(c.papel)}</span>
                  </div>
                  <div className="mt-1"><Medidor valor={c.nivel} tom={rotulo.tom} /></div>
                  <p className="mt-1 text-[10px] text-white/40">{efeitoDoPapel(c.papel)}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── OS CONVITES DA SEMANA ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
            <CalendarHeart className="h-4 w-4 text-[var(--brand)]" /> {t.convites_da_semana}
          </h2>
          {eventos.length === 0 && <p className="text-[11px] text-white/45">{t.nenhum_convite_nesta_semana}</p>}
          <div className="grid gap-2">
            {eventos.map(e => {
              const podeIr = economia.energia >= e.energia && (e.custo <= 0 || economia.dinheiro >= e.custo)
              return (
                <div key={e.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-white/90">{e.nome}</span>
                    <span className={cn("shrink-0 text-[10px] font-semibold", e.custo < 0 ? "text-emerald-300" : "text-white/50")}>
                      {e.custo < 0 ? `+${formatCurrency(-e.custo)}` : e.custo > 0 ? formatCurrency(e.custo) : t.gratis}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/45">{e.descricao}</p>
                  <p className="mt-1 text-[10px] text-white/35">−{e.energia} energia</p>
                  <button
                    disabled={!podeIr}
                    onClick={() => aplicar(comparecerAoEvento(carreira, e.id))}
                    className={cn("mt-2 w-full rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition",
                      podeIr
                        ? "border-[var(--brand)]/40 bg-[var(--brand)]/[.08] text-white hover:border-[var(--brand)]"
                        : "border-white/10 text-white/25")}
                  >
                    {t.comparecer}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── O CASSINO ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[.03] p-4">
          <h2 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-200/80">
            <Dices className="h-4 w-4" /> {t.cassino}
          </h2>
          {/* ⚠️ O AVISO É PARTE DO SISTEMA, não decoração. A casa ganha em todas
              as mesas, e esconder isso do jogador seria construir a tentação sem
              a informação que torna a escolha uma escolha. */}
          <p className="mb-3 text-[10px] text-amber-100/45">
            {t.toda_mesa_paga_menos} {carreira.noitesNoCassino
              ? `${carreira.noitesNoCassino} ${t.noites_saldo} ${formatCurrency(carreira.saldoNoCassino ?? 0)}.`
              : t.voce_nunca_entrou}
          </p>
          <div className="grid gap-2">
            {MESAS_DE_CASSINO.map(m => {
              const aposta = m.minimo
              const podeJogar = economia.dinheiro >= aposta
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white/90">{m.nome}</p>
                    <p className="text-[10px] text-white/40">
                      {formatCurrency(aposta)} · {t.paga} {m.pagamento.toFixed(2)}× · {Math.round(m.chance * 100)}%
                    </p>
                  </div>
                  <button
                    disabled={!podeJogar}
                    onClick={() => aplicar(jogarNoCassinoDoAtleta(carreira, m.id, aposta))}
                    className={cn("shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold",
                      podeJogar ? "border-amber-300/40 text-amber-100 hover:border-amber-300" : "border-white/10 text-white/25")}
                  >
                    {t.apostar}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── O HARAS ───────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
            <Trophy className="h-4 w-4 text-[var(--brand)]" /> {t.haras}
          </h2>
          {cavalo ? (
            <div className="rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/[.05] p-3">
              <p className="text-xs font-bold text-white/90">{cavalo.nome}</p>
              <p className="mt-0.5 text-[10px] text-white/45">
                {formatCurrency(cavalo.manutencaoSemanal)}{t.por_semana} · {Math.round(cavalo.chanceDeVitoria * 100)}% {t.vence_das_corridas}
                · {t.premio} {formatCurrency(cavalo.premio)}
              </p>
              <button
                onClick={() => aplicar(venderCavalo(carreira))}
                className="mt-2 w-full rounded-lg border border-white/15 px-3 py-1.5 text-[11px] hover:border-rose-300/50"
              >
                {t.vender_por} {formatCurrency(Math.round(cavalo.preco * 0.7))}
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              {CAVALOS_DO_ATLETA.map(c => {
                const podeComprar = economia.dinheiro >= c.preco
                return (
                  <div key={c.id} className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-white/90">{c.nome}</span>
                      <span className="shrink-0 text-[10px] text-white/50">{formatCurrency(c.preco)}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      {formatCurrency(c.manutencaoSemanal)}{t.por_semana} · {Math.round(c.chanceDeVitoria * 100)}% · {t.premio} {formatCurrency(c.premio)}
                    </p>
                    <button
                      disabled={!podeComprar}
                      onClick={() => aplicar(comprarCavalo(carreira, c.id))}
                      className={cn("mt-2 w-full rounded-lg border px-3 py-1.5 text-[11px] font-semibold",
                        podeComprar ? "border-white/15 hover:border-[var(--brand)]/50" : "border-white/10 text-white/25")}
                    >
                      {t.comprar}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── O LEGADO ──────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
            <Medal className="h-4 w-4 text-[var(--brand)]" /> {t.legado}
          </h2>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-black text-[var(--brand)]">
              {carreira.pontuacaoFinal ?? pontuacao.total}
            </span>
            <span className="text-xs text-white/50">{t.de_1000}</span>
            <span className="text-xs font-semibold text-white/80">
              {carreira.patamarFinal ?? pontuacao.patamar}
            </span>
            {!carreira.aposentado && <span className="text-[10px] text-white/35">{t.em_andamento}</span>}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pontuacao.eixos.map(e => (
              <div key={e.id} className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="font-semibold text-white/85">{e.nome}</span>
                  <span className="text-white/45">{e.pontos}/{e.teto}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(e.pontos / e.teto) * 100}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-white/35">{e.explicacao}</p>
              </div>
            ))}
          </div>

          {pontuacao.desconto < 0 && (
            <p className="mt-2 text-[11px] text-rose-300/80">
              {t.desconto_por_vida_noturna}: {pontuacao.desconto} {t.pontos}.
            </p>
          )}

          {/* ── CONQUISTAS ── */}
          <h3 className="mt-4 text-[11px] font-bold uppercase tracking-wide text-white/55">
            {t.conquistas} · {conquistas.length}/{CONQUISTAS.length}
          </h3>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {CONQUISTAS.map(c => {
              const feita = conquistas.some(x => x.id === c.id)
              return (
                <div
                  key={c.id}
                  className={cn("rounded-lg border p-2",
                    feita ? "border-[var(--brand)]/35 bg-[var(--brand)]/[.06]" : "border-white/10 bg-black/20 opacity-55")}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("text-[11px] font-bold", feita ? "text-white/90" : "text-white/50")}>{c.nome}</span>
                    {c.bonus > 0 && <span className="shrink-0 text-[10px] text-white/40">+{c.bonus}</span>}
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/35">{c.descricao}</p>
                </div>
              )
            })}
          </div>

          {/* ── RANKING ── */}
          <h3 className="mt-4 text-[11px] font-bold uppercase tracking-wide text-white/55">
            {t.ranking} · {t.voce_esta_em} {posicaoNoRanking(carreira.pontuacaoFinal ?? pontuacao.total, [])}º
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[11px]">
              <thead className="text-white/40">
                <tr>
                  <th className="py-1 pr-2 font-medium">#</th>
                  <th className="py-1 pr-2 font-medium">{t.coluna_atleta}</th>
                  <th className="py-1 pr-2 font-medium">{t.coluna_pontos}</th>
                  <th className="py-1 pr-2 font-medium">{t.coluna_jogos}</th>
                  <th className="py-1 pr-2 font-medium">{t.coluna_gols}</th>
                  <th className="py-1 font-medium">{t.coluna_titulos}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((e, i) => (
                  <tr key={`${e.nome}-${i}`} className={cn("border-t border-white/[.06]", e.minha && "bg-[var(--brand)]/[.08]")}>
                    <td className="py-1 pr-2 text-white/40">{i + 1}</td>
                    <td className={cn("py-1 pr-2", e.minha ? "font-bold text-[var(--brand)]" : "text-white/75")}>
                      {e.nome} <span className="text-white/35">{e.posicao}</span>
                    </td>
                    <td className="py-1 pr-2 font-semibold text-white/85">{e.pontos}</td>
                    <td className="py-1 pr-2 text-white/55">{e.jogos}</td>
                    <td className="py-1 pr-2 text-white/55">{e.gols}</td>
                    <td className="py-1 text-white/55">{e.titulos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AtletaShell>
  )
}
