"use client"

/**
 * A VITRINE — o que transforma a loja do atleta em loja (1.0.377).
 *
 * ─── O DEFEITO QUE ELA CORRIGE ──────────────────────────────────────────────
 *
 * Chuteira, acessório, recuperação, bens de status e patrocínio existiam e
 * funcionavam desde a 1.0.373/374 — como `<button>` de 10 px com o nome e o
 * preço em texto corrido, três por linha, dentro de painéis já cheios. O
 * relato do usuário foi exato: "são funcionais, mas ainda parecem
 * formulários/cards simples".
 *
 * ⚠️ E A CORREÇÃO NÃO É "PÔR IMAGEM". Não há arte de chuteira no projeto e não
 * vai haver — inventar 12 PNGs para uma loja seria peso de instalação (o
 * install-size já é um gate) por um item que muda de catálogo a cada versão. O
 * que a vitrine faz é DESENHAR o item, em CSS, a partir do que ele é:
 *
 *   • a CATEGORIA escolhe a silhueta e o ícone;
 *   • o PREÇO escolhe a faixa (bronze → lendário) e, com ela, o metal da moldura;
 *   • o `id` semeia o matiz, então cada item tem cor própria e ESTÁVEL — a
 *     mesma chuteira é sempre a mesma cor, em qualquer save e em qualquer
 *     máquina, porque a cor sai de um hash do id e não de um sorteio.
 *
 * ─── POR QUE FAIXA, E NÃO SÓ PREÇO ──────────────────────────────────────────
 *
 * ⚠️ UMA LOJA SEM HIERARQUIA VISUAL É UMA LISTA DE PREÇOS. O jogador precisa
 * bater o olho e saber o que está fora do alcance dele hoje, o que é o próximo
 * passo e o que já é dele. Por isso a moldura muda de metal, o item que ele já
 * tem ganha selo, e o que ele não pode pagar fica dessaturado em vez de sumir —
 * esconder o inalcançável tira do jogador a única coisa que faz ele querer
 * juntar dinheiro.
 *
 * ─── O QUE NÃO ESTÁ AQUI ────────────────────────────────────────────────────
 *
 * Nada de regra de jogo. Este arquivo não decide preço, bônus, exclusividade
 * nem se o jogador pode comprar: recebe tudo pronto e desenha. Quem decide é
 * `lib/carreira-de-jogador` e `lib/patrocinio-pessoal`.
 */

import type { ReactNode } from "react"
import { Check, Lock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { formatCurrency } from "@/lib/currency"

export type FaixaDaVitrine = "bronze" | "prata" | "ouro" | "lendario"

/**
 * A FAIXA SAI DO PREÇO, e o corte é o mesmo para equipamento e para bem de
 * status — os dois competem pelo mesmo dinheiro, então precisam competir na
 * mesma régua. Ler duas escalas diferentes na mesma tela seria pior que não ter
 * escala nenhuma.
 */
export function faixaPeloPreco(preco: number): FaixaDaVitrine {
  if (preco >= 400_000) return "lendario"
  if (preco >= 120_000) return "ouro"
  if (preco >= 40_000) return "prata"
  return "bronze"
}

const METAL: Record<FaixaDaVitrine, { borda: string; brilho: string; texto: string; selo: string }> = {
  bronze: {
    borda: "border-amber-800/45",
    brilho: "from-amber-700/25 via-amber-600/10 to-transparent",
    texto: "text-amber-200/70",
    selo: "bg-amber-900/45 text-amber-100/80",
  },
  prata: {
    borda: "border-slate-300/35",
    brilho: "from-slate-200/25 via-slate-300/10 to-transparent",
    texto: "text-slate-100/80",
    selo: "bg-slate-500/35 text-slate-50/85",
  },
  ouro: {
    borda: "border-amber-300/55",
    brilho: "from-amber-300/30 via-amber-200/12 to-transparent",
    texto: "text-amber-100",
    selo: "bg-amber-400/25 text-amber-100",
  },
  lendario: {
    borda: "border-[var(--brand)]/60",
    brilho: "from-[var(--brand)]/30 via-fuchsia-400/12 to-transparent",
    texto: "text-[var(--brand)]",
    selo: "bg-[var(--brand)]/20 text-[var(--brand)]",
  },
}

/** Matiz estável por item — a mesma chuteira é sempre da mesma cor. */
function matizDoItem(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) % 360
}

/**
 * A ARTE DO ITEM — gradiente em camadas, sem nenhum arquivo de imagem.
 *
 * ⚠️ TRÊS CAMADAS E NÃO UMA: um fundo em matiz próprio, um facho diagonal que
 * dá volume e uma malha de linhas que dá textura. Um gradiente só, chapado,
 * lê como placeholder — que é exatamente a impressão de "card simples" que esta
 * tela existe para desfazer.
 */
export function ArteDoItem({
  id,
  faixa,
  icone,
  className,
}: {
  id: string
  faixa: FaixaDaVitrine
  icone: ReactNode
  className?: string
}) {
  const matiz = matizDoItem(id)
  return (
    <div
      aria-hidden
      className={cn("relative grid place-items-center overflow-hidden rounded-xl", className)}
      style={{
        background:
          `radial-gradient(120% 100% at 20% 0%, hsl(${matiz} 72% 42% / .55) 0%, hsl(${(matiz + 40) % 360} 65% 22% / .35) 45%, rgba(4,8,12,.92) 100%)`,
      }}
    >
      {/* o facho: é ele que faz o retângulo parecer um objeto com luz em cima */}
      <div
        className="pointer-events-none absolute -inset-x-8 -top-10 h-24 rotate-[-18deg]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent)" }}
      />
      {/* a malha: textura fina, quase subliminar, que tira o ar de bloco chapado */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[.18]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,.10) 0 1px, transparent 1px 7px)",
        }}
      />
      <div className={cn("relative drop-shadow-[0_2px_6px_rgba(0,0,0,.6)]", METAL[faixa].texto)}>{icone}</div>
    </div>
  )
}

export interface CartaoDaVitrineProps {
  id: string
  nome: string
  /** A linha curta que diz o que o item faz. Vem pronta de quem chama. */
  descricao: string
  categoria: string
  preco: number
  icone: ReactNode
  /** Selos de efeito: "+3 ritmo", "+15 energia". Já formatados. */
  efeitos?: string[]
  comprado?: boolean
  equipado?: boolean
  /** Falso quando falta dinheiro — o cartão dessatura, mas continua visível. */
  acessivel?: boolean
  aoAgir?: () => void
  /** Texto do botão. Quem chama decide, porque só ele sabe o que a ação é. */
  rotuloDaAcao?: string
}

export function CartaoDaVitrine({
  id, nome, descricao, categoria, preco, icone, efeitos = [],
  comprado, equipado, acessivel = true, aoAgir, rotuloDaAcao,
}: CartaoDaVitrineProps) {
  const t = useTranslation().carreiraDeJogador
  const faixa = faixaPeloPreco(preco)
  const metal = METAL[faixa]
  const bloqueado = !comprado && !acessivel

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-black/45 transition-all",
        metal.borda,
        equipado && "ring-1 ring-[var(--brand)]/70",
        bloqueado ? "opacity-45 saturate-[.35]" : "hover:-translate-y-0.5 hover:bg-black/30",
      )}
    >
      {/* o brilho da faixa, só na borda superior: dá o metal sem pintar o cartão */}
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b", metal.brilho)} />

      <div className="relative flex items-start gap-3 p-3">
        <ArteDoItem id={id} faixa={faixa} icone={icone} className="h-16 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13px] font-black leading-tight text-white/90">{nome}</p>
            {equipado ? (
              <span className="shrink-0 rounded-full bg-[var(--brand)]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--brand)]">
                {t.em_uso}
              </span>
            ) : comprado ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            ) : bloqueado ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-white/30" />
            ) : null}
          </div>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/35">{categoria}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/55">{descricao}</p>
        </div>
      </div>

      {efeitos.length > 0 && (
        <div className="relative flex flex-wrap gap-1 px-3">
          {efeitos.map(e => (
            <span key={e} className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200/85">
              {e}
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-auto flex items-center justify-between gap-2 p-3">
        <span className={cn("text-[12px] font-black tabular-nums", comprado ? "text-white/35" : metal.texto)}>
          {comprado ? t.no_seu_armario : formatCurrency(preco)}
        </span>
        {aoAgir && (
          <button
            onClick={aoAgir}
            disabled={bloqueado || (comprado && equipado)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors disabled:opacity-30",
              comprado
                ? "border border-[var(--brand)]/40 text-[var(--brand)] hover:bg-[var(--brand)]/10"
                : "bg-[var(--brand)]/85 text-black hover:bg-[var(--brand)]",
            )}
          >
            {rotuloDaAcao ?? (comprado ? t.equipar : t.comprar)}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A FAIXA DE STATUS DO TOPO — dinheiro, energia, estilo, reputação.
 *
 * ⚠️ ELA É PARTE DA LOJA, NÃO ENFEITE. Comprar sem ver o saldo obriga o jogador
 * a sair da tela para decidir, e foi assim que a versão em botões funcionava: o
 * dinheiro morava num painel e os itens em outro.
 */
export function BarraDaVitrine({ itens }: { itens: { rotulo: string; valor: string; icone: ReactNode; tom?: "brand" | "neutro" }[] }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
      {itens.map(i => (
        <div key={i.rotulo} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/45 px-3 py-2">
          <span className={cn("shrink-0", i.tom === "brand" ? "text-[var(--brand)]" : "text-white/35")}>{i.icone}</span>
          <div className="min-w-0">
            <p className="truncate text-[9px] font-black uppercase tracking-wider text-white/35">{i.rotulo}</p>
            <p className="truncate text-[13px] font-black tabular-nums text-white/90">{i.valor}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Cabeçalho de seção da vitrine, com contagem — separa as prateleiras. */
export function PrateleiraDaVitrine({
  titulo, subtitulo, children,
}: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2.5 flex items-baseline gap-2 border-b border-white/[.07] pb-1.5">
        <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />
        <h3 className="text-[12px] font-black uppercase tracking-wider text-white/80">{titulo}</h3>
        {subtitulo && <span className="text-[10px] text-white/35">{subtitulo}</span>}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}
