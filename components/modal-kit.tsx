"use client"

// AS PEÇAS COMUNS DOS MODAIS — grupo de campos, abas internas e trilha de passos.
//
// ⚠️ POR QUE ISTO EXISTE (pedido: "organize os modais editar jogador, editar
// time, negociar compra/empréstimo, renovação").
//
// Os quatro cresceram por acréscimo: cada funcionalidade nova entrou como mais um
// bloco no fim do mesmo scroll. O de editar jogador chegou a 230 linhas de rolagem
// contínua — nome, posição, idade, características e seis atributos empilhados sem
// nenhuma separação, com o botão Salvar lá embaixo, fora da vista. Não era falta de
// campo: era falta de ORDEM.
//
// Aqui ficam só as peças de arrumação, sem estado e sem regra de jogo. Elas não
// mudam o que os modais fazem — mudam onde as coisas ficam. Isso importa porque
// mexer na lógica de negociação para "organizar" seria a maneira mais fácil de
// quebrar quatro telas de uma vez.

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

// ── GRUPO DE CAMPOS ─────────────────────────────────────────────────────────

interface GrupoProps {
  titulo: string
  /** Linha curta abaixo do título — o que este grupo decide. */
  nota?: string
  children: ReactNode
  className?: string
}

/**
 * Um bloco de campos com título. Substitui a grade única e plana em que doze
 * campos de naturezas diferentes (nome, estádio, técnico, cor) dividiam o mesmo
 * espaço visual e ninguém achava nada.
 */
export function GrupoDeCampos({ titulo, nota, children, className }: GrupoProps) {
  return (
    <section className={cn("rounded-xl border border-white/[0.07] bg-white/[0.02] p-4", className)}>
      <div className="mb-3">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{titulo}</h4>
        {nota && <p className="mt-0.5 text-[10px] leading-4 text-white/30">{nota}</p>}
      </div>
      {children}
    </section>
  )
}

// ── ABAS INTERNAS ───────────────────────────────────────────────────────────

export interface AbaDoModal {
  id: string
  rotulo: string
  /** Aviso discreto no canto da aba (ex.: "2 de 3" de características). */
  selo?: string
}

interface AbasProps {
  abas: AbaDoModal[]
  ativa: string
  onTrocar: (id: string) => void
  className?: string
}

/**
 * Abas dentro do modal.
 *
 * ⚠️ O conteúdo de cada aba deve ficar MONTADO e apenas escondido quando o modal
 * edita um rascunho — desmontar zera o que estava em campos não controlados e faz
 * o usuário perder o que digitou ao trocar de aba. Nos modais deste projeto o
 * rascunho é estado do pai (`pDraft`, `editDraft`), então trocar de aba é seguro;
 * ainda assim, quem for adicionar aba nova precisa saber disso.
 */
export function AbasDoModal({ abas, ativa, onTrocar, className }: AbasProps) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/25 p-1", className)}>
      {abas.map(aba => (
        <button
          key={aba.id}
          type="button"
          onClick={() => onTrocar(aba.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
            ativa === aba.id
              ? "bg-[var(--brand)] text-[var(--brand-ink)]"
              : "text-white/50 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          {aba.rotulo}
          {aba.selo && (
            <span className={cn(
              "rounded px-1 text-[9px] tabular-nums",
              ativa === aba.id ? "bg-black/20" : "bg-white/10 text-white/40",
            )}>
              {aba.selo}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── TRILHA DE PASSOS ────────────────────────────────────────────────────────

interface TrilhaProps {
  /** Na ordem em que acontecem. */
  passos: { id: string; rotulo: string }[]
  atual: string
  className?: string
}

/**
 * Onde a negociação está.
 *
 * Negociar e renovar já eram feitos por etapas (proposta → mesa → resposta), mas
 * a tela não dizia isso: cada passo trocava o conteúdo inteiro do modal e o
 * usuário não sabia se ainda ia poder ajustar algo ou se já tinha fechado negócio.
 * Um passo desconhecido (por exemplo, o resultado) não pinta nada e a trilha some —
 * é melhor não mostrar trilha do que mostrar uma trilha errada.
 */
export function TrilhaDePassos({ passos, atual, className }: TrilhaProps) {
  const indice = passos.findIndex(p => p.id === atual)
  if (indice < 0) return null
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {passos.map((p, i) => (
        <div key={p.id} className="flex flex-1 items-center gap-1.5">
          <div className="flex-1">
            <div className={cn(
              "h-1 rounded-full transition-colors",
              i < indice ? "bg-[var(--brand)]/45" : i === indice ? "bg-[var(--brand)]" : "bg-white/10",
            )} />
            <span className={cn(
              "mt-1 block text-[9px] font-semibold uppercase tracking-wider",
              i === indice ? "text-[var(--brand)]" : i < indice ? "text-white/35" : "text-white/20",
            )}>
              {p.rotulo}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
