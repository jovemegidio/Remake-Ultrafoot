"use client"

// O CONVITE PARA CONECTAR.
//
// Aparece uma vez, antes da primeira conexao de atualizacao. Enquanto ele nao
// for respondido, o jogo nao fala com servidor nenhum para buscar atualizacao.
// Recusar nao quebra nada: o jogo abre com o que veio no build, e o convite
// pode ser refeito em Personalizar > Atualizacoes.

import { useEffect } from "react"
import { Download, Globe, ShieldCheck, Users } from "lucide-react"
import { setConsentimento } from "@/lib/atualizacoes-preferencias"

export function DialogoConsentimentoAtualizacoes({
  onDecidir,
}: {
  /** Chamado depois de gravar a resposta. */
  onDecidir?: (aceitou: boolean) => void
}) {
  const responder = (aceitou: boolean) => {
    setConsentimento(aceitou ? "aceito" : "recusado")
    onDecidir?.(aceitou)
  }

  // Mesma gramatica do resto do jogo: Enter/A aceita, Esc/B recusa. A fase de
  // captura impede que a tela atras reaja a mesma tecla.
  useEffect(() => {
    const noTeclado = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        e.stopImmediatePropagation()
        responder(true)
      } else if (e.key === "Escape") {
        e.preventDefault()
        e.stopImmediatePropagation()
        responder(false)
      }
    }
    const noControle = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      if (button === "A") responder(true)
      else if (button === "B") responder(false)
    }
    document.addEventListener("keydown", noTeclado, true)
    window.addEventListener("gamepad:button", noControle)
    return () => {
      document.removeEventListener("keydown", noTeclado, true)
      window.removeEventListener("gamepad:button", noControle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDecidir])

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-[#020308]/85 p-5 backdrop-blur-xl">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--brand)]/25 bg-[#0b1014] shadow-[0_24px_90px_rgba(0,255,200,.16)]">
        <div className="border-b border-white/10 bg-gradient-to-r from-[var(--brand)]/15 to-cyan-500/5 px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-[var(--brand)]">Atualizações</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-white">
            <Globe className="h-6 w-6 text-[var(--brand)]" />
            Conectar ao servidor?
          </h2>
          <p className="mt-1 text-sm text-white/55">
            O Ultrafoot pode buscar atualizações oficiais enquanto você joga.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="space-y-3">
            <Linha
              icone={<Users className="h-4 w-4 text-[var(--brand)]" />}
              titulo="Elencos e times"
              texto="Transferências, atletas corrigidos, escudos e uniformes chegam sem reinstalar o jogo."
            />
            <Linha
              icone={<Download className="h-4 w-4 text-[var(--brand)]" />}
              titulo="Novas versões"
              texto="Avisamos quando sair uma versão nova. Quem instala é o Ultrafoot Launcher."
            />
            <Linha
              icone={<ShieldCheck className="h-4 w-4 text-[var(--brand)]" />}
              titulo="Só descida de dados"
              texto="Nada do seu save, do seu perfil ou das suas edições é enviado. As suas edições continuam vencendo as nossas."
            />
          </div>

          <p className="mt-5 text-xs leading-5 text-white/40">
            Recusar não tira nada do jogo: ele abre normalmente com os dados que já vieram
            instalados. Você pode mudar isso quando quiser em Personalizar › Atualizações.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={() => responder(false)}
              className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/15"
            >
              Agora não <span className="text-white/35">(Esc)</span>
            </button>
            <button
              onClick={() => responder(true)}
              className="rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-black text-[var(--brand-ink)] transition-colors hover:bg-[#4dffda]"
            >
              Conectar e atualizar <span className="text-black/50">(Enter)</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Linha({ icone, titulo, texto }: { icone: React.ReactNode; titulo: string; texto: string }) {
  return (
    <div className="flex gap-3 rounded-lg bg-white/[0.03] p-3">
      <div className="mt-0.5 shrink-0">{icone}</div>
      <div>
        <div className="text-sm font-medium text-white">{titulo}</div>
        <div className="text-xs leading-5 text-white/45">{texto}</div>
      </div>
    </div>
  )
}
