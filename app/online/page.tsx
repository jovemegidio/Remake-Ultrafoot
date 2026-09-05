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
import { useTranslation } from "@/lib/i18n"

export default function OnlinePage() {
  const t = useTranslation()
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
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="mx-auto max-w-xl px-5 pt-28 text-center">
          <Globe className="mx-auto h-10 w-10 text-white/25" />
          <h1 className="uf-heading mt-4 text-2xl font-black">{t.online.o_modo_online_esta_desligado}</h1>
          <p className="mt-2 text-sm text-white/55">
            Ligue em <b className="text-white/80">{t.online.configuracoes_configuracoes_online}</b> para
            liberar o FC Hub, os amistosos e o resto dos modos entre técnicos.
          </p>
          <Button className="mt-5" onClick={() => hardNavigate("/configuracoes")}>{t.online.abrir_configuracoes}</Button>
        </div>
      </main>
    )
  }

  return (
    /* ⚠️ O FUNDO NEUTRO SAIU (pedido do usuário, com print).
     *
     * A tela era um `bg-[#06090d]` chapado com dois títulos por cima — parede
     * preta com dez cartões. Agora ela ganha o gramado que o usuário mandou
     * (Mercado.png convertido para WebP: 1,6 MB → 47 KB), FIXO e coberto por um
     * véu escuro: sem o véu, texto branco sobre grama clara não se lê.
     *
     * E os TÍTULOS saíram junto ("remova os títulos e deixe somente os ícones e
     * textos"). O cabeçalho "ULTRAFOOT ONLINE / Modos entre técnicos" repetia o
     * que o próprio menu já disse para chegar aqui; o que informa é o cartão —
     * ícone, nome do modo, estado e resumo. */
    <main className="relative h-screen overflow-y-auto text-white">
      {/* ⚠️ `z-0`, NUNCA `-z-10`: o `html` tem fundo próprio, então o fundo do
          `body` pinta como caixa normal (z=0) e cobre tudo o que estiver em z
          negativo — foi assim que o fundo do escritório do atleta ficou invisível
          por seis versões. Ver components/carreira-jogador/atleta-shell. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/pre-jogo/online-mercado.webp)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#06090d]/92 via-[#06090d]/70 to-[#06090d]/94"
      />
      {/* z-30, não z-10: o menu da tecla W vive dentro do cabeçalho e precisa
          abrir por cima dos cartões. Ver o mesmo cuidado no atleta-shell. */}
      <div className="relative z-30"><GameHeader /></div>
      <div className="relative z-10 mx-auto max-w-[1100px] px-5 pb-14 pt-10">
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
                    ? "border-white/10 bg-black/55 backdrop-blur-sm hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/[.10]"
                    : "cursor-not-allowed border-white/[.06] bg-black/45 opacity-70 backdrop-blur-sm",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* A arte de cada modo (1.0.350). Dez cartões só de texto
                        viravam parede; o ícone é o que deixa a grade legível de
                        relance. `opacity` menor no que ainda não existe — o
                        estado do modo também se lê pela arte. */}
                    <img
                      src={modo.icone}
                      alt=""
                      aria-hidden
                      className={cn(
                        "h-9 w-9 shrink-0 object-contain",
                        modo.estado === "planejado" && "opacity-40 grayscale",
                      )}
                    />
                    <h2 className="font-black">{modo.nome}</h2>
                  </div>
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
          Os modos marcados como <b className="text-white/50">{t.online.em_breve}</b> ainda não existem — estão
          listados para você saber o que vem, e na ordem em que vêm. Nenhum deles finge funcionar.
        </p>
      </div>
    </main>
  )
}
