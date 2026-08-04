"use client"

// VITRINE DO CLUBE — a tela de escolha de time, na linguagem da arte de
// referência (Nova pasta/Fundo 2.png): TV de tubo à esquerda com o escudo na
// tela, faixas "ULTRAFOOT" correndo em cima e embaixo, painéis escuros com
// filete vermelho e tipografia condensada em caixa alta.
//
// RECONSTRUÍDA EM CSS, e não com a imagem por baixo e os dados posicionados por
// cima. A arte tem proporção fixa (1672x941): usada como plano de fundo, fica
// certa no monitor de quem desenhou e torta em metade dos monitores. Aqui a
// imagem entra só como TEXTURA (grão de papel gasto), e o layout é grid/flex —
// fiel ao espírito, não ao pixel.
//
// Os dados NÃO são novos: a tela de novo jogo já os calculava (valor do clube,
// verba, admiração da torcida, base, fundação e títulos reais via club-facts,
// expectativa da diretoria). O que muda é a apresentação.

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Award, Trophy, Globe } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import type { Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

export interface PerfilDoClube {
  foundation: number | null
  ligas: number | null
  copas: number | null
  continental: number | null
  clubValue: number
  transferBudget: number
  fanAdmiration: number
  youthFacilities: number
  board: string
}

interface Props {
  team: Team
  perfil: PerfilDoClube
  /** 0 a 5, com meias estrelas. */
  estrelas: number
  /** Posição do clube na lista, para o "1/22" do canto. */
  indice?: number
  total?: number
  /** O carrossel de uniforme continua vivendo na página; entra aqui como slot. */
  uniforme?: React.ReactNode
}

/** Dinheiro em escala curta: "R$ 3,41 bi" lê melhor que 3.410.000.000. */
function dinheiroCurto(valor: number): string {
  if (valor >= 1_000_000_000) return `R$ ${(valor / 1_000_000_000).toFixed(2).replace(".", ",")} bi`
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1).replace(".", ",")} mi`
  if (valor >= 1_000) return `R$ ${Math.round(valor / 1_000)} mil`
  return `R$ ${valor}`
}

/**
 * Número que sobe até o valor.
 *
 * O efeito não é enfeite: ele faz o olho PARAR no dado. Numa tela onde o técnico
 * compara clubes trocando de um para o outro, o valor mudando em silêncio passa
 * despercebido — subindo, ele se anuncia.
 */
function NumeroQueSobe({ valor, format }: { valor: number; format: (n: number) => string }) {
  const [atual, setAtual] = useState(valor)
  useEffect(() => {
    const inicio = performance.now()
    const de = atual
    const dur = 520
    let raf = 0
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / dur)
      // easeOutCubic: rápido no começo, assenta no fim.
      setAtual(de + (valor - de) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
    // `atual` fora das deps de propósito: incluí-lo reiniciaria a animação a
    // cada quadro, e o número nunca chegaria ao destino.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])
  return <>{format(Math.round(atual))}</>
}

/** Barra 0-100 com rótulo, no vermelho da arte. */
function Medidor({ titulo, valor }: { titulo: string; valor: number }) {
  const rotulo = valor >= 80 ? "MUITO ALTA" : valor >= 62 ? "ALTA" : valor >= 44 ? "MÉDIA" : valor >= 26 ? "BAIXA" : "MUITO BAIXA"
  return (
    <Painel>
      <Rotulo>{titulo}</Rotulo>
      <div className="mt-1 text-2xl font-black uppercase tracking-tight text-white">{rotulo}</div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0.4, opacity: 0.3 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
            className={cn(
              "h-2 flex-1 origin-bottom rounded-[2px]",
              i < Math.round(valor / 10) ? "bg-[#e11d48]" : "bg-white/[0.07]",
            )}
          />
        ))}
      </div>
    </Painel>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#e11d48]">{children}</div>
  )
}

/** Painel escuro com filete vermelho — a unidade visual da arte. */
function Painel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-[#e11d48]/35 bg-black/55 px-4 py-3 backdrop-blur-[2px]",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Faixa "ULTRAFOOT" correndo, como no topo e no rodapé da arte. */
function FaixaMarquee({ invertido = false }: { invertido?: boolean }) {
  const itens = Array.from({ length: 12 }, (_, i) => i)
  return (
    <div className="relative h-7 overflow-hidden border-y border-white/[0.06] bg-black/60">
      <motion.div
        className="absolute inset-y-0 flex items-center gap-6 whitespace-nowrap"
        animate={{ x: invertido ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: 38, ease: "linear", repeat: Infinity }}
      >
        {/* Duas cópias para o laço não mostrar buraco ao voltar ao começo. */}
        {[0, 1].map(copia => (
          <div key={copia} className="flex items-center gap-6">
            {itens.map(i => (
              <span key={i} className="flex items-center gap-6">
                <span className="text-[11px] font-black italic uppercase tracking-[0.2em] text-white/25">
                  Ultrafoot
                </span>
                <span className="text-[#e11d48]/50">|</span>
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export function VitrineDoClube({ team, perfil, estrelas, indice, total, uniforme }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#08070a]">
      {/* Textura da arte original, bem apagada: dá o grão de papel gasto sem
          impor proporção nenhuma ao layout. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.18]"
        style={{ backgroundImage: "url(/images/escolha-time-bg.webp)" }}
      />
      {/* Brilho na cor do clube: é o que faz a tela MUDAR de personalidade a
          cada time, que era o pedido — destacar o time, não a moldura. */}
      <motion.div
        key={`glow-${team.curto}`}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 0.6 }}
        className="pointer-events-none absolute -left-24 top-1/2 h-[38rem] w-[38rem] -translate-y-1/2 rounded-full blur-[110px]"
        style={{ backgroundColor: team.cor1 }}
      />

      <FaixaMarquee />

      <div className="relative grid gap-5 p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ── TV DE TUBO com o escudo ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="relative rounded-[22px] border border-white/15 bg-gradient-to-b from-[#2a2a2e] to-[#131316] p-3 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.95)]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] border-2 border-black/60 bg-black">
              {/* Chuvisco na cor do clube */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-70"
                style={{
                  background: `radial-gradient(circle at 50% 45%, ${team.cor1}55, #08070a 72%)`,
                }}
              />
              {/* Linhas de varredura da TV */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage: "repeating-linear-gradient(to bottom, rgba(255,255,255,.16) 0 1px, transparent 1px 3px)",
                }}
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={team.curto}
                  initial={{ opacity: 0, scale: 0.82, filter: "blur(6px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.08, filter: "blur(6px)" }}
                  transition={{ duration: 0.32, ease: "easeOut" }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <TeamCrest team={team} size="4xl" className="h-[62%] w-[62%] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]" />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-2 text-center text-[9px] font-bold uppercase tracking-[0.3em] text-white/25">
              Majestic
            </div>
          </div>

          {uniforme}
        </div>

        {/* ── IDENTIDADE E NÚMEROS ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <Painel className="border-[#e11d48]/45">
            <div className="flex items-center justify-between">
              <Rotulo>{team.pais ?? "Brasil"}</Rotulo>
              {indice != null && total != null && (
                <span className="text-[10px] font-bold tabular-nums text-white/35">
                  {indice + 1}/{total}
                </span>
              )}
            </div>
            <AnimatePresence mode="wait">
              <motion.h2
                key={team.curto}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                transition={{ duration: 0.25 }}
                className="mt-0.5 truncate text-4xl font-black uppercase leading-none tracking-tight text-white sm:text-5xl"
              >
                {team.nome}
              </motion.h2>
            </AnimatePresence>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-3.5 w-3.5 rotate-45 rounded-[2px]",
                    estrelas - i >= 1 ? "bg-[#e11d48]"
                      : estrelas - i >= 0.5 ? "bg-gradient-to-br from-[#e11d48] from-50% to-white/10 to-50%"
                        : "bg-white/10",
                  )}
                />
              ))}
            </div>

            {/* Os três troféus da arte, agora com número de verdade. */}
            <div className="mt-3 grid grid-cols-3 divide-x divide-[#e11d48]/20 border-t border-[#e11d48]/25 pt-3">
              {[
                { icone: Award, valor: perfil.ligas, rotulo: "Ligas" },
                { icone: Trophy, valor: perfil.copas, rotulo: "Copas" },
                { icone: Globe, valor: perfil.continental, rotulo: "Continental" },
              ].map(({ icone: Icone, valor, rotulo }) => (
                <div key={rotulo} className="flex flex-col items-center gap-1 px-1">
                  <Icone className="h-5 w-5 text-white/70" />
                  <span className="text-xl font-black tabular-nums leading-none text-white">
                    {valor ?? "—"}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">{rotulo}</span>
                </div>
              ))}
            </div>
          </Painel>

          <div className="grid gap-3 sm:grid-cols-2">
            <Painel>
              <Rotulo>Fundação</Rotulo>
              <div className="mt-1 text-3xl font-black tabular-nums text-white">
                {perfil.foundation ?? "—"}
              </div>
            </Painel>
            <Painel>
              <Rotulo>Estádio</Rotulo>
              <div className="mt-1 truncate text-lg font-black uppercase leading-tight text-white">
                {team.estadio_nome ?? "—"}
              </div>
              <div className="text-[11px] tabular-nums text-white/40">
                {(team.estadio_cap ?? 0).toLocaleString("pt-BR")} lugares
              </div>
            </Painel>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Medidor titulo="Admiração da torcida" valor={perfil.fanAdmiration} />
            <Medidor titulo="Instalações da base" valor={perfil.youthFacilities} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Painel>
              <Rotulo>Valor do clube</Rotulo>
              <div className="mt-1 text-2xl font-black tabular-nums text-white">
                <NumeroQueSobe valor={perfil.clubValue} format={dinheiroCurto} />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/30">Avaliação de mercado</div>
            </Painel>
            <Painel>
              <Rotulo>Verba de transferência</Rotulo>
              <div className="mt-1 text-2xl font-black tabular-nums text-[var(--brand)]">
                <NumeroQueSobe valor={perfil.transferBudget} format={dinheiroCurto} />
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/30">Orçamento disponível</div>
            </Painel>
          </div>

          {/* Faixa da expectativa: é o que define a dificuldade da carreira, e
              por isso fecha o bloco — última coisa lida antes de confirmar. */}
          <div className="relative overflow-hidden rounded-lg border border-[#e11d48]/50 bg-gradient-to-r from-[#e11d48]/15 via-black/50 to-[#e11d48]/15 px-4 py-3 text-center">
            <Rotulo>Expectativa da diretoria</Rotulo>
            <AnimatePresence mode="wait">
              <motion.div
                key={perfil.board}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mt-1 text-lg font-black uppercase tracking-tight text-white sm:text-xl"
              >
                {perfil.board}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <FaixaMarquee invertido />
    </div>
  )
}
