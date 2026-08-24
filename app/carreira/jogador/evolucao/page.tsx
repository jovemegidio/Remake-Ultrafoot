"use client"

// EVOLUÇÃO E ATRIBUTOS — a terceira tela do modo.
//
// Era a aba "Evolução" do escritório e virou tela própria, porque é para cá que
// o item "Evolucao e atributos" do menu aponta (ver o comentário do shell).
//
// ⚠️ NÃO HÁ BOTÃO "+1 ATRIBUTO" aqui, e a ausência é a regra: desde a 1.0.325 o
// atleta cresce pelo que FAZ em campo. O que ele escolhe é o FOCO e a
// INTENSIDADE do treino — os dois inclinam a curva, nenhum dos dois a decide.

import { Battery, Dumbbell, ShoppingBag, Users } from "lucide-react"

import { AtletaShell, PainelDoAtleta } from "@/components/carreira-jogador/atleta-shell"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameState } from "@/lib/save-system"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import {
  arquetipo, atributosEfetivosDoAtleta, comprarEquipamento, confiancaMerecida, definirIntensidadeDeTreino,
  economiaDoAtleta, equiparItem, hierarquiaDaPosicao, leituraDaPersonalidade, potencialVisivel,
  treinarAtributoIndividual, EQUIPAMENTOS_DO_ATLETA, NOME_DO_ATRIBUTO,
  type AtributosDoAtleta, type EstadoCarreiraDeJogador, type IntensidadeDeTreino,
} from "@/lib/carreira-de-jogador"

// ⚠️ O NOME DE CADA ATRIBUTO VEM DO MOTOR. Esta tela mantinha a própria lista, e
// duas listas para os mesmos seis atributos discordam na primeira renomeação —
// o motor já usa `NOME_DO_ATRIBUTO` nos recados do preparador.
const ATRIBUTOS = (Object.keys(NOME_DO_ATRIBUTO) as (keyof AtributosDoAtleta)[])
  .map(chave => ({ chave, nome: NOME_DO_ATRIBUTO[chave] }))

export default function EvolucaoDoAtletaPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/carreira/jogador") })
  const { state, setState } = useGameState()
  const t = useTranslation()
  const carreira = state.carreiraDeJogador

  if (!carreira) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="p-10 text-center">
          <p className="text-white/70">Nenhuma carreira de jogador ativa neste save.</p>
          <Button className="mt-4" onClick={() => hardNavigate("/novo-jogo")}>Criar carreira</Button>
        </div>
      </main>
    )
  }

  const aplicar = (novo: EstadoCarreiraDeJogador) => setState({ carreiraDeJogador: novo })
  const { atleta } = carreira
  const arq = arquetipo(atleta.arquetipo)
  const especializacao = arq.especializacoes.find(e => e.id === atleta.especializacao)
  const hierarquia = hierarquiaDaPosicao(carreira)
  const merecida = confiancaMerecida(carreira)
  const jogosNaCarreira = carreira.historico.reduce((n, h) => n + h.jogos, 0) + carreira.temporadaAtual.jogos
  const faixa = potencialVisivel(atleta, jogosNaCarreira)
  const economia = economiaDoAtleta(carreira)
  const efetivos = atributosEfetivosDoAtleta(carreira)

  return (
    <AtletaShell carreira={carreira} ativa="evolucao">
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-3">

        <PainelDoAtleta
          titulo={t.carreiraDeJogador.atributos}
          acessorio={
            <span className="rounded-full border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3 py-1 text-[11px] font-bold text-[var(--brand)]">
              {arq.nome}{especializacao ? ` · ${especializacao.nome}` : ""}
            </span>
          }
        >
          <p className="text-[11px] leading-relaxed text-white/40">
            {arq.descricao} Você evolui pelo que faz em campo — dribles puxam drible, desarmes puxam
            defesa, minutos puxam físico. A comissão projeta seu teto entre{" "}
            <b className="text-white/70">{faixa.min} e {faixa.max}</b>, e essa leitura vai apertando
            conforme você joga.
          </p>

          <div className="mt-4 space-y-3">
            {ATRIBUTOS.map(({ chave, nome }) => {
              const doArquetipo = arq.principais.includes(chave)
              const bonus = efetivos[chave] - atleta.atributos[chave]
              return (
                <div key={chave} className="flex items-center gap-3">
                  <span className={cn("w-24 text-sm", doArquetipo ? "font-bold text-white/80" : "text-white/55")}>{nome}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${atleta.atributos[chave]}%` }} />
                  </div>
                  <b className="w-12 text-right">{atleta.atributos[chave]}{bonus > 0 && <span className="text-[10px] text-cyan-300">+{bonus}</span>}</b>
                  <button
                    onClick={() => aplicar(treinarAtributoIndividual(carreira, chave))}
                    disabled={economia.energia < 12 || atleta.atributos[chave] >= atleta.potencial}
                    className="rounded-lg border border-[var(--brand)]/25 px-2 py-1 text-[10px] font-bold text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    +1 · 12⚡
                  </button>
                </div>
              )
            })}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11px] text-amber-200/70"><Battery className="h-3.5 w-3.5" />Energia {economia.energia}/{economia.energiaMaxima}. Treino individual evolui o atributo escolhido na hora.</p>
          {carreira.ultimaEvolucao.length > 0 && (
            <p className="mt-3 text-[11px] text-emerald-300/70">
              Ganho da última temporada — puxado pelo que você fez em campo.
            </p>
          )}
        </PainelDoAtleta>

        <PainelDoAtleta titulo={t.carreiraDeJogador.treino_da_semana}>
          <label className="block text-[11px] text-white/55">
            Foco do treino
            <select
              value={carreira.focoDeTreino}
              onChange={e => aplicar({ ...carreira, focoDeTreino: e.target.value as typeof carreira.focoDeTreino })}
              className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
            >
              <option value="equilibrado">Equilibrado</option>
              {ATRIBUTOS.map(a => <option key={a.chave} value={a.chave}>{a.nome}</option>)}
            </select>
          </label>

          <label className="mt-4 block text-[11px] text-white/55">
            Intensidade da semana
            <select
              value={carreira.intensidadeDeTreino ?? "normal"}
              onChange={e => aplicar(definirIntensidadeDeTreino(carreira, e.target.value as IntensidadeDeTreino))}
              className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white"
            >
              <option value="leve">Leve — preserva a forma, evolui devagar</option>
              <option value="normal">Normal — equilíbrio</option>
              <option value="puxada">Puxada — evolui mais, chega cansado</option>
            </select>
          </label>

          {carreira.treinoDaSemana && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">Última semana de treino</p>
              <p className="mt-1 text-sm text-white/80">{carreira.treinoDaSemana.texto}</p>
              <p className="mt-1 text-[11px] text-white/45">
                Forma {carreira.treinoDaSemana.deltaForma >= 0 ? "+" : ""}{carreira.treinoDaSemana.deltaForma}
                {" · "}forma atual {Math.round(carreira.forma)}
              </p>
            </div>
          )}

          <div className="mt-4 border-t border-white/10 pt-3">
            <h3 className="flex items-center gap-2 text-sm font-black"><Users className="h-4 w-4 text-[var(--brand)]" />Disputa pela posição</h3>
            <p className="mt-1 text-[11px] text-white/45">
              Você é o <b className="text-white/80">{hierarquia.posto}º</b> de {hierarquia.concorrentes} em {atleta.posicao} neste elenco.
              {hierarquia.posto > 1 && ` À sua frente: ${hierarquia.nomeDoMelhorRival} (${hierarquia.melhorRival}).`}
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">Confiança do treinador</span>
                <b>{Math.round(carreira.notaDoTreinador)}</b>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${carreira.notaDoTreinador}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/40">
                <span>Merecido pelo seu lugar na fila</span>
                <b className="text-white/60">{Math.round(merecida)}</b>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">Como a comissão te vê</p>
            <ul className="mt-2 space-y-1">
              {leituraDaPersonalidade(atleta.personalidade).map(frase => (
                <li key={frase} className="text-[12px] text-white/65">· {frase}</li>
              ))}
            </ul>
          </div>
        </PainelDoAtleta>

        <PainelDoAtleta titulo="Equipamento e recados" icone={<ShoppingBag className="h-5 w-5 text-cyan-300" />}>
          <div className="space-y-2 border-b border-white/10 pb-4">
            {EQUIPAMENTOS_DO_ATLETA.map(item => {
              const comprado = economia.equipamentosComprados.includes(item.id)
              const equipado = economia.equipamentosEmUso[item.categoria] === item.id
              return (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-bold">{item.nome}</p><p className="text-[10px] text-cyan-200/60">{item.descricao}</p></div>
                    <button
                      disabled={equipado || (!comprado && economia.dinheiro < item.preco)}
                      onClick={() => aplicar(comprado ? equiparItem(carreira, item.id) : comprarEquipamento(carreira, item.id))}
                      className="rounded-lg border border-white/12 px-2 py-1 text-[10px] font-bold disabled:opacity-35"
                    >
                      {equipado ? "Em uso" : comprado ? "Equipar" : formatCurrency(item.preco)}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <h3 className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/45"><Dumbbell className="h-4 w-4" />{t.carreiraDeJogador.recados}</h3>
          {carreira.recados.length === 0 && (
            <p className="py-8 text-center text-sm text-white/35">Nenhum recado ainda.</p>
          )}
          <div className="space-y-2">
            {carreira.recados.map(r => (
              <div key={r.id} className="rounded-xl bg-black/30 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand)]">{r.de}</p>
                <p className="mt-1 text-sm text-white/75">{r.texto}</p>
                <p className="mt-1 text-[10px] text-white/30">Temporada {r.temporada} · rodada {r.rodada}</p>
              </div>
            ))}
          </div>
        </PainelDoAtleta>
      </div>
    </AtletaShell>
  )
}
