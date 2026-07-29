"use client"

// Tutorial de primeira vez: aparece uma unica vez quando o jogador entra no escritorio
// com um time selecionado. Explica em poucos passos o essencial do jogo. Guarda o flag em
// localStorage (persiste no WebView do Tauri). Pode ser reaberto por quem quiser (prop open
// forcado) — hoje so dispara sozinho na primeira vez.

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, ShoppingBag, Swords, Trophy, Sparkles, X, Gamepad2, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

const SEEN_KEY = "ultrafoot:onboarding-seen"

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true
  try { return localStorage.getItem(SEEN_KEY) === "1" } catch { return true }
}
export function markOnboardingSeen(): void {
  try { localStorage.setItem(SEEN_KEY, "1") } catch { /* ignore */ }
}
/** Permite reabrir o tutorial (ex.: a partir das Configuracoes). */
export function resetOnboarding(): void {
  try { localStorage.removeItem(SEEN_KEY) } catch { /* ignore */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ultrafoot:onboarding:open"))
}

interface Slide { icon: React.ReactNode; title: string; body: string }

function buildSlides(teamName: string): Slide[] {
  return [
    { icon: <Sparkles className="h-8 w-8" />, title: `Bem-vindo ao ${teamName}`, body: "Você é o novo técnico. Sua missão: cumprir as metas da diretoria, evitar o rebaixamento e brigar por títulos. Este guia rápido mostra por onde começar." },
    { icon: <Gamepad2 className="h-8 w-8" />, title: "Controles", body: "Jogue no teclado ou no controle. Teclado: W abre o menu de seções, Enter confirma / entra na partida, Esc volta, Tab mostra as estatísticas, e os atalhos aparecem no rodapé de cada tela. Controle: A confirma, B volta, LB/RB trocam de aba e Start abre o menu. Funciona em todas as telas." },
    { icon: <Users className="h-8 w-8" />, title: "Elenco e Táticas", body: "Em Elenco você monta a escalação, define a formação, atribuições e treina os jogadores. Salve escalações prontas para reusar nos jogos." },
    { icon: <ShoppingBag className="h-8 w-8" />, title: "Mercado e Olheiros", body: "No Mercado você compra, vende e empresta jogadores, negociando salário, luvas e bônus. Contrate olheiros para descobrir talentos pelo mundo." },
    { icon: <Swords className="h-8 w-8" />, title: "Dia de jogo", body: "Na partida ao vivo você acompanha o placar, faz substituições e muda a mentalidade (Defensivo/Equilibrado/Ofensivo) EM TEMPO REAL — vale já no lance seguinte. Ajuste a velocidade em 1x, 3x ou 5x." },
    { icon: <CalendarDays className="h-8 w-8" />, title: "Calendário realista", body: "O ano vai de janeiro a dezembro: estaduais no começo, a liga do meio ao fim (terminando em dezembro), com Copa do Brasil e continental no meio. Em ano de Copa do Mundo o campeonato PARA na janela do Mundial — você avança pela pausa até o clube voltar." },
    { icon: <Trophy className="h-8 w-8" />, title: "A temporada", body: "Em Competições você acompanha a classificação, os artilheiros e as assistências de cada torneio. Ganhe títulos para construir sua reputação: bons resultados atraem propostas de outros clubes e, com o tempo, de seleções. Fique de olho nas finanças e na moral. Bom jogo!" },
  ]
}

export function OnboardingOverlay({ teamName }: { teamName?: string }) {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const slides = buildSlides(teamName || "seu clube")

  useEffect(() => {
    if (!hasSeenOnboarding()) setOpen(true)
    const reopen = () => { setI(0); setOpen(true) }
    window.addEventListener("ultrafoot:onboarding:open", reopen)
    return () => window.removeEventListener("ultrafoot:onboarding:open", reopen)
  }, [])

  const close = () => { markOnboardingSeen(); setOpen(false) }
  const next = () => { if (i < slides.length - 1) setI(i + 1); else close() }

  if (!open) return null
  const slide = slides[i]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.94, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 24 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#12232a] to-[#0a1518] p-7 text-center"
        >
          <button onClick={close} aria-label="Fechar" className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80">
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)]/15 text-[var(--brand)] ring-1 ring-[var(--brand)]/30">
            {slide.icon}
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">{slide.title}</h2>
          <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-white/60">{slide.body}</p>

          <div className="mb-5 flex items-center justify-center gap-1.5">
            {slides.map((_, idx) => (
              <span key={idx} className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-5 bg-[var(--brand)]" : "w-1.5 bg-white/20")} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button onClick={close} className="text-xs font-medium text-white/40 transition-colors hover:text-white/70">Pular</button>
            <div className="flex items-center gap-2">
              {i > 0 && (
                <button onClick={() => setI(i - 1)} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10">Voltar</button>
              )}
              <button onClick={next} className="rounded-lg bg-[var(--brand)] px-5 py-2 text-sm font-bold text-[#05231b] transition-colors hover:bg-[#00e6b5]">
                {i < slides.length - 1 ? "Próximo" : "Começar"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
