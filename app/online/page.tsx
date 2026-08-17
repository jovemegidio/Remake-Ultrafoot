"use client"

// O MENU ONLINE.
//
// Só existe quando o jogo está em MODO ONLINE (`multiplayerEnabled`, ligado em
// Configurações → Configurações online). Quem joga offline nunca vê esta porta,
// que é exatamente o pedido: o online não polui o caminho de quem não usa.
//
// A tela é honesta sobre o que existe. Cada modo mostra o próprio estado —
// disponível, em obras ou em breve — e os que ainda não existem não são
// clicáveis. Um menu que oferece dez modos e entrega dois ensina o jogador a
// não confiar na tela.

import { Globe, Lock } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameState } from "@/lib/save-system"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { cn } from "@/lib/utils"
import { MODOS_ONLINE, ROTULO_DO_ESTADO, temDestino, type ModoOnline } from "@/lib/modos-online"

export default function OnlinePage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })
  const { state } = useGameState()

  // O Hub é montado pelo layout em toda tela (components/fc-hub-loader), esta
  // inclusive — então abrir o modo é disparar o mesmo evento do atalho Tab, sem
  // navegar para lugar nenhum.
  const abrirModo = (modo: ModoOnline) => {
    if (modo.acao === "abrir-hub") { window.dispatchEvent(new Event("ultrafoot:fc-hub")); return }
    if (modo.href) hardNavigate(modo.href)
  }

  if (!state.multiplayerEnabled) {
    return (
      <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="mx-auto max-w-xl px-5 pt-28 text-center">
          <Globe className="mx-auto h-10 w-10 text-white/25" />
          <h1 className="mt-4 text-2xl font-black">O modo online está desligado</h1>
          <p className="mt-2 text-sm text-white/55">
            Ligue em <b className="text-white/80">Configurações → Configurações online</b> para
            liberar o FC Hub, os amistosos e o resto dos modos entre técnicos.
          </p>
          <Button className="mt-5" onClick={() => hardNavigate("/configuracoes")}>Abrir configurações</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <div className="mx-auto max-w-[1100px] px-5 pb-14 pt-20">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">Ultrafoot online</p>
          <h1 className="mt-1 text-3xl font-black">Modos entre técnicos</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Aqui ninguém controla jogador: você escala, monta a tática, mexe na pressão e faz as
            substituições. O motor joga — vence quem gerencia melhor.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODOS_ONLINE.map(modo => {
            const jogavel = modo.estado !== "planejado" && temDestino(modo)
            return (
              <button
                key={modo.id}
                disabled={!jogavel}
                onClick={() => abrirModo(modo)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  jogavel
                    ? "border-white/10 bg-white/[.04] hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/[.06]"
                    : "cursor-not-allowed border-white/[.06] bg-black/25 opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-black">{modo.nome}</h2>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                      modo.estado === "pronto" ? "bg-[var(--brand)]/20 text-[var(--brand)]"
                        : modo.estado === "em obras" ? "bg-amber-400/15 text-amber-300"
                          : "bg-white/[.06] text-white/40",
                    )}
                  >
                    {ROTULO_DO_ESTADO[modo.estado]}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">{modo.resumo}</p>
                {!jogavel && (
                  <p className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/30">
                    <Lock className="h-3 w-3" /> fase {modo.fase} do plano
                  </p>
                )}
              </button>
            )
          })}
        </div>

        <p className="mt-6 max-w-3xl text-[11px] leading-relaxed text-white/35">
          Os modos marcados como <b className="text-white/50">em breve</b> ainda não existem — estão
          listados para você saber o que vem, e na ordem em que vêm. Nenhum deles finge funcionar.
        </p>
      </div>
    </main>
  )
}
