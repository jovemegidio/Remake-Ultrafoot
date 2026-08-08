"use client"

// A REUNIÃO DA COMISSÃO — a leitura do jogo pela voz de quem a daria.
//
// A informação toda já existia no jogo, espalhada por seis telas. O que faltava
// era alguém tê-la LIDO por você. Cada parecer vem assinado pelo profissional do
// assunto, porque é isso que muda a natureza do texto: "energia 42" é um número
// numa tabela; "o preparador diz que o Fulano não aguenta 90 minutos, e o
// Beltrano está inteiro" é uma recomendação.
//
// Sem API, sem rede, sem custo — ver lib/comissao-tecnica.

import { Stethoscope, Activity, Search, LineChart, Briefcase, ClipboardList, ChevronRight, CheckCircle2 } from "lucide-react"
import { MEMBROS, type MembroDaComissao, type Parecer, type Urgencia } from "@/lib/comissao-tecnica"
import { hardNavigate } from "@/lib/hard-navigation"
import { cn } from "@/lib/utils"

const ICONES: Record<MembroDaComissao, React.ReactNode> = {
  auxiliar:   <ClipboardList className="h-3.5 w-3.5" />,
  preparador: <Activity className="h-3.5 w-3.5" />,
  medico:     <Stethoscope className="h-3.5 w-3.5" />,
  olheiro:    <Search className="h-3.5 w-3.5" />,
  analista:   <LineChart className="h-3.5 w-3.5" />,
  diretor:    <Briefcase className="h-3.5 w-3.5" />,
}

const TOM: Record<Urgencia, { faixa: string; texto: string; rotulo: string }> = {
  critico:  { faixa: "bg-red-500",   texto: "text-red-300",   rotulo: "Resolver agora" },
  atencao:  { faixa: "bg-amber-400", texto: "text-amber-300", rotulo: "Atenção" },
  sugestao: { faixa: "bg-white/25",  texto: "text-white/50",  rotulo: "Sugestão" },
}

export function ReuniaoDaComissao({ pareceres, className }: { pareceres: Parecer[]; className?: string }) {
  if (pareceres.length === 0) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4", className)}>
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-bold text-white">A comissão não tem apontamentos</p>
          <p className="text-xs text-white/45">
            Elenco disponível, escalação regular, contas em ordem e nenhum contrato próximo do fim.
          </p>
        </div>
      </div>
    )
  }

  const criticos = pareceres.filter(p => p.urgencia === "critico").length

  return (
    <div className={cn("space-y-2", className)}>
      {criticos > 0 && (
        <p className="text-[11px] font-medium text-red-300/80">
          {criticos} ponto(s) que a comissão considera urgente antes da próxima partida.
        </p>
      )}
      {pareceres.map(p => {
        const membro = MEMBROS[p.membro]
        const tom = TOM[p.urgencia]
        return (
          <article
            key={p.id}
            className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] pl-3"
          >
            {/* Faixa de urgência: dá para varrer a coluna e achar o que pega fogo. */}
            <span className={cn("absolute left-0 top-0 h-full w-1", tom.faixa)} />
            <div className="p-3">
              <header className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-white/45">
                  {ICONES[p.membro]}
                  {membro.nome}
                </span>
                <span className={cn("text-[9px] font-bold uppercase tracking-wider", tom.texto)}>
                  {tom.rotulo}
                </span>
              </header>
              <h4 className="text-sm font-bold leading-tight text-white">{p.titulo}</h4>
              <p className="mt-0.5 text-xs leading-snug text-white/55">{p.detalhe}</p>
              {p.rota && (
                <button
                  onClick={() => hardNavigate(p.rota!)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand)] hover:underline"
                >
                  {p.rotuloAcao ?? "Resolver"} <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
