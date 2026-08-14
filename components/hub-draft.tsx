"use client"

// DRAFT ONLINE NA SALA DO FC HUB — o painel de escolhas.
//
// Ele nasce do pedido "draft seria bom para o online como um modo online draft x
// draft", que substituiu o Draft dos Modos locais (um campo de texto onde se
// DIGITAVA o nome do atleta — sem catálogo, sem elenco no fim e sem partida).
//
// Toda a regra mora em lib/draft-online.ts, que é pura e testada. Aqui só há
// tela e transporte. Duas coisas valem o comentário:
//
//   • O CATÁLOGO NÃO VEM DO RELAY: é derivado do código da sala, então os dois
//     lados montam a mesma lista sem trafegar nada.
//   • A ESCOLHA VIAJA COMO `career_command`, que o relay já replica com um
//     `sequence` crescente. A ordem dele é a árbitra: dois cliques no mesmo
//     atleta no mesmo segundo resolvem sozinhos, sem o servidor saber o que é
//     um draft.

import { useMemo, useState } from "react"
import { Check, Hourglass, ListOrdered, Shield, Sparkles } from "lucide-react"
import type { InternetRoom, InternetRoomSocket } from "@/lib/internet-multiplayer"
import {
  catalogoDoDraft, estadoDoDraft, forcaDoElenco, podeEscolher,
  ESCOLHAS_PADRAO, type AtletaDoDraft, type EscolhaDoDraft,
} from "@/lib/draft-online"
import { cn } from "@/lib/utils"

const CORES_DE_SETOR: Record<AtletaDoDraft["setor"], string> = {
  GOL: "text-amber-300",
  DEF: "text-sky-300",
  MEI: "text-emerald-300",
  ATA: "text-rose-300",
}

export function HubDraft({
  room,
  participantId,
  socket,
  elencoDoMundo,
  escolhasPorTecnico = ESCOLHAS_PADRAO,
}: {
  room: InternetRoom
  participantId: string
  socket: InternetRoomSocket | null
  /** Catálogo bruto do jogo. A sala recorta o dela a partir daqui. */
  elencoDoMundo: readonly AtletaDoDraft[]
  escolhasPorTecnico?: number
}) {
  const [enviando, setEnviando] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<"todos" | AtletaDoDraft["setor"]>("todos")

  // Só quem joga entra na fila do draft — espectador assiste.
  const participantes = useMemo(
    () => room.participants.filter(p => !p.spectator).map(p => p.id),
    [room.participants],
  )

  const catalogo = useMemo(
    () => catalogoDoDraft(room.code, elencoDoMundo, Math.max(40, participantes.length * escolhasPorTecnico * 2)),
    [room.code, elencoDoMundo, participantes.length, escolhasPorTecnico],
  )

  // As escolhas são reconstruídas do log de comandos que o relay devolve no
  // snapshot. Nada de estado local: recarregar a página não perde o draft.
  const escolhas: EscolhaDoDraft[] = useMemo(() => (room.commands ?? [])
    .filter(c => c.commandType === "draft_pick")
    .map(c => ({
      sequence: c.sequence,
      participantId: c.participantId,
      atletaId: String((c.payload as { atletaId?: unknown })?.atletaId ?? ""),
    }))
    .filter(c => c.atletaId), [room.commands])

  const estado = useMemo(
    () => estadoDoDraft(catalogo, escolhas, {
      participantes,
      escolhasPorTecnico,
      tamanhoDoCatalogo: catalogo.length,
    }),
    [catalogo, escolhas, participantes, escolhasPorTecnico],
  )

  const minhaVez = podeEscolher(estado, participantId)
  const nomeDe = (id: string) => room.participants.find(p => p.id === id)?.managerName ?? "Técnico"
  const clubeDe = (id: string) => room.participants.find(p => p.id === id)?.teamShort ?? "?"

  const escolher = (atleta: AtletaDoDraft) => {
    if (!socket || !minhaVez) return
    setEnviando(atleta.id)
    socket.send("career_command", { commandType: "draft_pick", payload: { atletaId: atleta.id } })
    // O `enviando` cai sozinho quando o snapshot volta com a escolha registrada.
    window.setTimeout(() => setEnviando(atual => (atual === atleta.id ? null : atual)), 4_000)
  }

  const listados = filtro === "todos" ? estado.disponiveis : estado.disponiveis.filter(a => a.setor === filtro)

  if (participantes.length < 2) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
        O draft precisa de pelo menos dois técnicos na sala.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-white">
            <Sparkles className="h-4 w-4 text-[var(--brand)]" /> Draft x Draft
          </h3>
          <p className="text-xs text-white/50">
            Escolha alternada em serpentina · {estado.escolhasFeitas} de {estado.totalDeEscolhas} escolhas
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold",
          estado.encerrado ? "bg-emerald-400/15 text-emerald-300"
            : minhaVez ? "bg-[var(--brand)]/20 text-[var(--brand)]"
            : "bg-white/10 text-white/60",
        )}>
          {estado.encerrado
            ? <><Check className="h-4 w-4" /> Draft encerrado</>
            : minhaVez
              ? <><ListOrdered className="h-4 w-4" /> Sua vez de escolher</>
              : <><Hourglass className="h-4 w-4" /> Vez de {nomeDe(estado.daVez ?? "")}</>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["todos", "GOL", "DEF", "MEI", "ATA"] as const).map(op => (
              <button
                key={op}
                type="button"
                onClick={() => setFiltro(op)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold transition-colors",
                  filtro === op ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/10 text-white/60 hover:text-white",
                )}
              >
                {op === "todos" ? "Todos" : op}
              </button>
            ))}
          </div>

          {estado.encerrado ? (
            <p className="px-1 py-6 text-center text-sm text-white/50">
              Todos os elencos estão montados. O campeonato da sala pode começar.
            </p>
          ) : (
            <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
              {listados.map(atleta => (
                <li key={atleta.id}>
                  <button
                    type="button"
                    disabled={!minhaVez || enviando !== null}
                    onClick={() => escolher(atleta)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      minhaVez ? "hover:bg-white/10" : "opacity-60",
                      enviando === atleta.id && "bg-[var(--brand)]/20",
                    )}
                  >
                    <span className={cn("w-9 shrink-0 text-xs font-black", CORES_DE_SETOR[atleta.setor])}>
                      {atleta.posicao}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-white">{atleta.nome}</span>
                    <span className="shrink-0 text-xs text-white/40">{atleta.idade} anos</span>
                    <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-white">
                      {atleta.overall}
                    </span>
                  </button>
                </li>
              ))}
              {listados.length === 0 && (
                <li className="px-1 py-6 text-center text-sm text-white/40">Ninguém livre neste setor.</li>
              )}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          {participantes.map(id => {
            const elenco = estado.elencos[id] ?? []
            return (
              <div
                key={id}
                className={cn(
                  "rounded-xl border p-3",
                  estado.daVez === id ? "border-[var(--brand)]/50 bg-[var(--brand)]/10" : "border-white/10 bg-white/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 truncate text-sm font-bold text-white">
                    <Shield className="h-3.5 w-3.5 text-white/40" />
                    {nomeDe(id)} <span className="text-white/40">({clubeDe(id)})</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--brand)]">
                    {elenco.length}/{escolhasPorTecnico} · {forcaDoElenco(elenco)}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {elenco.map(atleta => (
                    <li key={atleta.id} className="flex items-center gap-2 text-xs text-white/70">
                      <span className={cn("w-8 shrink-0 font-bold", CORES_DE_SETOR[atleta.setor])}>{atleta.posicao}</span>
                      <span className="min-w-0 flex-1 truncate">{atleta.nome}</span>
                      <span className="tabular-nums text-white/50">{atleta.overall}</span>
                    </li>
                  ))}
                  {elenco.length === 0 && <li className="text-xs text-white/30">Nenhuma escolha ainda.</li>}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
