"use client"

// MANAGER DRAFT — a porta de entrada.
//
// ⚠️ O DRAFT NÃO É NOVO, E ESTA TELA NÃO O REESCREVE. Ele existe inteiro em
// `components/hub-draft.tsx`, dentro da sala de internet do FC Hub. O que
// faltava — e o que mantinha o modo em "em obras" desde a 1.0.336 — era o
// CAMINHO: o jogador clicava em "Manager Draft" no menu online, caía no Hub, e
// lá precisava (1) achar o bloco de campeonato por internet, (2) criar ou entrar
// numa sala e (3) descobrir que existe um botão "Abrir draft x draft nesta
// sala", visível só para o host. Três passos que a tela não explicava.
//
// Aqui os três viram um: criar (ou entrar com o código) e cair no Hub com o
// draft JÁ ABERTO — a bandeira `ultrafoot:abrir-draft`, que o FC Hub lê ao
// montar. Nenhuma lógica de sala foi duplicada: `createInternetRoom` e
// `joinInternetRoom` são as MESMAS funções que o Hub usa.
//
// ⚠️ E NÃO ENCOSTA NO SAVE: a sala é um mundo à parte, como todo o online.

import { useState } from "react"
import { Loader2, ShieldCheck, Users } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { createInternetRoom, joinInternetRoom } from "@/lib/internet-multiplayer"

/** O Hub lê as duas ao montar: abre o painel e liga o draft. */
function irParaOHubComODraftAberto(): void {
  try {
    sessionStorage.setItem("ultrafoot:abrir-fc-hub", "1")
    sessionStorage.setItem("ultrafoot:abrir-draft", "1")
  } catch { /* sem sessionStorage o Hub abre pelo Tab, e o draft por um clique */ }
  hardNavigate("/")
}

export default function ManagerDraftPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/online") })
  const t = useTranslation()
  const { state } = useGameState()
  const { team: meuTime } = useUserTeam()

  const [codigo, setCodigo] = useState("")
  const [ocupado, setOcupado] = useState<"criar" | "entrar" | null>(null)
  const [erro, setErro] = useState("")

  const nome = state.managerName?.trim() || t.draft.tecnico
  const clube = meuTime?.curto ?? state.selectedTeamShort ?? ""

  const criar = async () => {
    setOcupado("criar"); setErro("")
    try {
      await createInternetRoom({
        managerName: nome,
        teamShort: clube,
        maxPlayers: 8,
        mode: "tournament",
        leagueSettings: {
          leagueId: "draft",
          leagueName: t.draft.nome_da_sala,
          matchSpeed: "normal",
          roundDeadlineHours: 72,
          allowSpectators: false,
        },
      })
      irParaOHubComODraftAberto()
    } catch (e) {
      setErro(e instanceof Error ? e.message : t.draft.nao_deu_certo)
      setOcupado(null)
    }
  }

  const entrar = async () => {
    setOcupado("entrar"); setErro("")
    try {
      await joinInternetRoom({ code: codigo.trim().toUpperCase(), managerName: nome, teamShort: clube })
      irParaOHubComODraftAberto()
    } catch (e) {
      setErro(e instanceof Error ? e.message : t.draft.nao_deu_certo)
      setOcupado(null)
    }
  }

  if (!state.multiplayerEnabled) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="mx-auto max-w-xl px-5 pt-28 text-center">
          <h1 className="text-2xl font-black">{t.draft.online_desligado}</h1>
          <Button className="mt-5" onClick={() => hardNavigate("/configuracoes")}>
            {t.draft.abrir_configuracoes}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <div className="mx-auto max-w-[900px] px-5 pb-16 pt-20">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">{t.draft.online}</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black">
            <Users className="text-[var(--brand)]" />{t.draft.titulo}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/50">{t.draft.explicacao}</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/[.06] p-5">
            <h2 className="text-lg font-black">{t.draft.abrir_uma_sala}</h2>
            <p className="mt-1 text-sm text-white/55">{t.draft.abrir_explicacao}</p>
            <Button
              onClick={criar}
              disabled={ocupado !== null}
              className="mt-4 w-full bg-[var(--brand)] py-5 font-black text-[var(--brand-ink)] hover:bg-[#00d9b0]"
            >
              {ocupado === "criar"
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.draft.abrindo}</>
                : t.draft.abrir_e_convidar}
            </Button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <h2 className="text-lg font-black">{t.draft.entrar_com_codigo}</h2>
            <p className="mt-1 text-sm text-white/55">{t.draft.entrar_explicacao}</p>
            <Input
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={8}
              placeholder={t.draft.exemplo_codigo}
              className="mt-4 bg-black/40 text-center font-mono tracking-[.3em]"
            />
            <Button
              onClick={entrar}
              disabled={ocupado !== null || codigo.trim().length < 6}
              variant="outline"
              className="mt-3 w-full py-5 font-black"
            >
              {ocupado === "entrar"
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.draft.entrando}</>
                : t.draft.entrar}
            </Button>
          </section>
        </div>

        {erro && (
          <p className="mt-4 rounded-xl border border-red-400/25 bg-red-400/[.06] p-3 text-sm text-red-200">{erro}</p>
        )}

        <section className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white/45">
            <ShieldCheck className="h-4 w-4 text-[var(--brand)]" />{t.draft.como_funciona}
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-white/55">
            <li>{t.draft.passo_1}</li>
            <li>{t.draft.passo_2}</li>
            <li>{t.draft.passo_3}</li>
          </ol>
          <p className="mt-4 text-[11px] text-white/30">{t.draft.nao_toca_na_carreira}</p>
        </section>
      </div>
    </main>
  )
}
