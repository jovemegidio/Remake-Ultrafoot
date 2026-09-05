"use client"

// PRELEÇÃO — a conversa com o elenco antes, no intervalo e no fim.
//
// ⚠️ ESTA TELA NÃO CALCULA NADA. Todo o efeito sai de `lib/prelecao.ts`, e a
// prévia que ela mostra é o MESMO cálculo que vai valer — não uma estimativa
// parecida. É o padrão que a faixa "Efeito do plano" da tela de táticas já usa,
// e existe por um motivo: prévia com fórmula própria vira mentira na primeira
// vez que alguém mexe no motor e esquece da tela.
//
// ⚠️ O JOGADOR ESCOLHE ÀS CEGAS, DE PROPÓSITO. A reação de cada atleta só
// aparece DEPOIS de falar. Mostrar antes transformaria a preleção num menu de
// otimização: bastaria testar os cinco tons e escolher o melhor. O que o técnico
// vê antes é o contexto (placar, favoritismo, decisão) — que é o que um técnico
// de verdade tem na mão ao abrir a porta do vestiário.

import { useMemo, useState } from "react"
import { X, Megaphone, Flame, HandHeart, Gavel, EarOff, Check } from "lucide-react"
import {
  TONS, prelecao, resumoDaPrelecao,
  type AtletaNaPrelecao, type ContextoDaPrelecao, type ResultadoDaPrelecao, type TomDaPrelecao,
} from "@/lib/prelecao"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const ICONE: Record<TomDaPrelecao, typeof Flame> = {
  calma: HandHeart,
  confianca: Megaphone,
  cobranca: Gavel,
  furia: Flame,
  silencio: EarOff,
}

interface Props {
  aberto: boolean
  contexto: ContextoDaPrelecao
  elenco: readonly AtletaNaPrelecao[]
  /** Nome do adversário, só para o cabeçalho. */
  adversario: string
  /** Recebe o resultado JÁ calculado — quem chama decide o que fazer com ele. */
  onFalar: (resultado: ResultadoDaPrelecao) => void
  onFechar: () => void
}

export function PrelecaoModal({ aberto, contexto, elenco, adversario, onFalar, onFechar }: Props) {
  // ⚠️ TELA NOVA NASCE EXTRAÍDA. A catraca de tradução (`qa:traducao`) só desce,
  // e uma feature que chega com vinte frases chumbadas empurra o número para
  // cima e some do radar. Ver o cabeçalho de `scripts/qa-traducao.mjs`.
  const t = useTranslation()
  const [resultado, setResultado] = useState<ResultadoDaPrelecao | null>(null)

  const titulo = contexto.momento === "pre" ? t.prelecao.antes_de_entrar_em_campo
    : contexto.momento === "intervalo" ? t.prelecao.intervalo
    : t.prelecao.depois_do_apito_final

  const situacao = useMemo(() => {
    const saldo = contexto.golsFavor - contexto.golsContra
    if (contexto.momento === "pre") {
      return contexto.favoritismo >= 8 ? t.prelecao.somos_os_favoritos
        : contexto.favoritismo <= -8 ? t.prelecao.adversario_maior
        : t.prelecao.jogo_parelho_no_papel
    }
    const placar = `${contexto.golsFavor} a ${contexto.golsContra}`
    if (saldo > 0) return `${t.prelecao.ganhando_por} ${placar}.`
    if (saldo < 0) return `${t.prelecao.perdendo_por} ${placar}.`
    return `${t.prelecao.empatado_em} ${placar}.`
  }, [contexto, t])

  if (!aberto) return null

  const falar = (tom: TomDaPrelecao) => {
    const r = prelecao(tom, contexto, elenco)
    setResultado(r)
    onFalar(r)
  }

  const fechar = () => {
    setResultado(null)
    onFechar()
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center uf-veu p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d12]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">{titulo}</h2>
            <p className="truncate text-xs text-white/45">
              {t.prelecao.contra} {adversario} — {situacao}
              {contexto.decisivo ? t.prelecao.jogo_decisivo : ""}
            </p>
          </div>
          {/* Só dá para sair depois de falar (ou de escolher o silêncio): o
              vestiário não fica esperando o técnico decidir se entra. */}
          <button
            onClick={fechar}
            disabled={!resultado}
            className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-25"
            aria-label={t.prelecao.fechar}
          >
            <X className="h-5 w-5 text-white/60" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!resultado ? (
            <div className="grid gap-2">
              {TONS.map(tom => {
                const Icone = ICONE[tom.id]
                return (
                  <button
                    key={tom.id}
                    onClick={() => falar(tom.id)}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-[var(--brand)]/50 hover:bg-white/[0.06]"
                  >
                    <Icone className="h-5 w-5 shrink-0 text-[var(--brand)]" />
                    <div className="min-w-0">
                      <p className="font-bold text-white">{tom.nome}</p>
                      <p className="text-xs text-white/45">{tom.descricao}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm italic text-white/80">
                “{resultado.frase}”
              </p>
              <p className="text-sm font-semibold text-white/70">{resumoDaPrelecao(resultado)}</p>
              <div className="grid gap-1.5">
                {resultado.reacoes.map(r => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <b className="text-white">{r.nome}</b>
                      <span className="ml-2 text-xs text-white/40">{r.motivo}</span>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-bold tabular-nums",
                        r.humor === "acende" ? "text-emerald-400"
                          : r.humor === "encolhe" ? "text-orange-400" : "text-white/35",
                      )}
                    >
                      {r.delta > 0 ? "+" : ""}{r.delta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {resultado && (
          <div className="border-t border-white/[0.07] px-6 py-4">
            <button
              onClick={fechar}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 font-bold text-[var(--brand-ink)]"
            >
              <Check className="h-4 w-4" />
              {contexto.momento === "fim" ? t.prelecao.encerrar : t.prelecao.para_o_campo}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
