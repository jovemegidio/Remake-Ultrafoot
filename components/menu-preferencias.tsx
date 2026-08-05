"use client"

// PAINEIS DO MENU PRINCIPAL — Configuracoes e Acessibilidade.
//
// A tela inicial ganhou os dois icones do canto superior esquerdo (engrenagem e
// acessibilidade) e eles precisavam FAZER alguma coisa. A tela cheia de
// Configuracoes (/configuracoes) nao serve aqui: ela monta o GameHeader e o time
// do usuario, ou seja, assume uma carreira aberta — abrir aquilo a partir da
// splash e o caminho conhecido para o efeito que grava com o save ainda nao
// hidratado. Entao o menu recebe painel proprio, com o subconjunto que faz
// sentido ANTES de existir carreira.
//
// Regra de ouro deste arquivo: nada aqui grava no save por conta propria. O que
// mexe no save (idioma, volume dos efeitos) chega por callback e so e oferecido
// quando o store ja hidratou (`podeGravar`); o resto (tela cheia, desempenho,
// acessibilidade) mora em localStorage e vale para o jogo inteiro.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { Check, Eye, Gauge, Languages, Maximize2, RotateCcw, Volume2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { accessibilityStore, type FontScale } from "@/lib/accessibility-store"
import { IDIOMAS } from "@/lib/i18n"
import { isFullscreenEnabled, setFullscreen } from "@/lib/fullscreen"
import {
  applyPerformanceProfile,
  PERFORMANCE_STORAGE_KEY,
  type PerformanceProfile,
} from "@/components/performance-profile"
import { anunciarSfx } from "@/lib/sfx-volume"

/* ─── Pecas comuns ─────────────────────────────────────────────────────────── */

function Moldura({
  titulo,
  subtitulo,
  icone,
  aoFechar,
  children,
}: {
  titulo: string
  subtitulo: string
  icone: ReactNode
  aoFechar: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[120] flex" role="dialog" aria-modal="true" aria-label={titulo}>
      {/* Clicar fora fecha. E um <button> de propriedade para o leitor de tela
          anunciar a saida — um <div> com onClick nao e alcancavel por teclado. */}
      <button
        aria-label="Fechar"
        onClick={aoFechar}
        className="absolute inset-0 bg-black/70"
        style={{ animation: "fadeIn .25s ease-out" }}
      />
      <div
        className="relative z-10 flex h-full w-full max-w-[26rem] flex-col border-r border-white/[0.07] bg-[#04070b]/95 shadow-[0_0_90px_rgba(0,0,0,0.85)]"
        style={{ animation: "slide-in-left .35s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Faixa diagonal da identidade, ecoando o menu. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-[0.14]"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 42%, 0 78%)",
            background: "linear-gradient(120deg, var(--brand) 0%, transparent 72%)",
          }}
        />

        <header className="relative flex items-start justify-between gap-4 px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)]/12 text-[var(--brand)] ring-1 ring-[var(--brand)]/25">
              {icone}
            </div>
            <div>
              <h2 className="text-lg font-black leading-none text-white">{titulo}</h2>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
                {subtitulo}
              </p>
            </div>
          </div>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative flex-1 space-y-5 overflow-y-auto px-6 pb-8 scrollbar-thin">{children}</div>

        <footer className="relative border-t border-white/[0.06] px-6 py-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/25">
            Esc para voltar ao menu
          </span>
        </footer>
      </div>
    </div>
  )
}

function Secao({ titulo, icone, children }: { titulo: string; icone: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
        <span className="text-[var(--brand)]/70">{icone}</span>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

/** Interruptor proprio: o Switch do radix vive dentro de forms do jogo e traz
 *  contexto que a splash nao tem. Aqui basta um botao com role="switch". */
function Chave({
  rotulo,
  descricao,
  ligado,
  aoMudar,
}: {
  rotulo: string
  descricao: string
  ligado: boolean
  aoMudar: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={ligado}
      onClick={() => aoMudar(!ligado)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/15 hover:bg-white/[0.04]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{rotulo}</span>
        <span className="block text-[11px] leading-snug text-white/40">{descricao}</span>
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
          ligado ? "bg-[var(--brand)]" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200",
            ligado ? "left-[18px] bg-[#04070b]" : "left-0.5 bg-white",
          )}
        />
      </span>
    </button>
  )
}

function Opcoes<T extends string | number>({
  valor,
  opcoes,
  aoEscolher,
  colunas = 4,
}: {
  valor: T
  opcoes: { id: T; label: string; nota?: string }[]
  aoEscolher: (id: T) => void
  colunas?: 2 | 3 | 4
}) {
  return (
    <div className={cn("grid gap-2", colunas === 2 && "grid-cols-2", colunas === 3 && "grid-cols-3", colunas === 4 && "grid-cols-4")}>
      {opcoes.map(o => {
        const ativo = o.id === valor
        return (
          <button
            key={String(o.id)}
            onClick={() => aoEscolher(o.id)}
            aria-pressed={ativo}
            className={cn(
              "rounded-xl border px-2 py-2.5 text-center transition-all duration-200",
              ativo
                ? "border-[var(--brand)]/45 bg-[var(--brand)]/12 text-white"
                : "border-white/[0.06] bg-white/[0.02] text-white/45 hover:border-white/15 hover:text-white/80",
            )}
          >
            <span className="block truncate text-xs font-bold">{o.label}</span>
            {o.nota && <span className="mt-0.5 block truncate text-[10px] text-white/35">{o.nota}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ─── Configuracoes ────────────────────────────────────────────────────────── */

export interface PainelConfiguracoesProps {
  aoFechar: () => void
  /** Idioma atual do save. */
  idioma: string
  aoEscolherIdioma: (id: string) => void
  /** Volume dos efeitos (0–100) do save. */
  volumeSfx: number
  aoMudarVolumeSfx: (v: number) => void
  /** O save ja hidratou do disco? Enquanto nao, nao oferecemos nada que grave. */
  podeGravar: boolean
}

export function PainelConfiguracoes({
  aoFechar,
  idioma,
  aoEscolherIdioma,
  volumeSfx,
  aoMudarVolumeSfx,
  podeGravar,
}: PainelConfiguracoesProps) {
  const [telaCheia, setTelaCheia] = useState(false)
  const [desempenho, setDesempenho] = useState<PerformanceProfile>("balanced")
  // O volume anda no arrasto (para ouvir), mas so GRAVA quando o dedo sai do
  // controle: gravar a cada pixel escreveria o save dezenas de vezes por segundo.
  const [volume, setVolume] = useState(volumeSfx)

  useEffect(() => {
    setTelaCheia(isFullscreenEnabled())
    const guardado = localStorage.getItem(PERFORMANCE_STORAGE_KEY)
    if (guardado === "economy" || guardado === "balanced" || guardado === "quality") setDesempenho(guardado)
  }, [])

  useEffect(() => setVolume(volumeSfx), [volumeSfx])

  return (
    <Moldura
      titulo="Configurações"
      subtitulo="Ajustes do jogo"
      icone={<Gauge className="h-5 w-5" />}
      aoFechar={aoFechar}
    >
      <Secao titulo="Idioma" icone={<Languages className="h-3.5 w-3.5" />}>
        <Opcoes
          colunas={2}
          valor={IDIOMAS.some(i => i.id === idioma) ? idioma : (IDIOMAS.find(i => i.variantes?.includes(idioma))?.id ?? "pt-BR")}
          opcoes={IDIOMAS.map(i => ({ id: i.id, label: i.label, nota: i.flag }))}
          aoEscolher={id => podeGravar && aoEscolherIdioma(id)}
        />
        {!podeGravar && (
          <p className="text-[11px] text-white/30">Carregando as suas preferências…</p>
        )}
      </Secao>

      <Secao titulo="Efeitos sonoros" icone={<Volume2 className="h-3.5 w-3.5" />}>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Volume</span>
            <span className="text-sm font-bold tabular-nums text-[var(--brand)]">{volume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            disabled={!podeGravar}
            aria-label="Volume dos efeitos sonoros"
            onChange={e => {
              const v = Number(e.target.value)
              setVolume(v)
              anunciarSfx(v)
            }}
            onPointerUp={() => aoMudarVolumeSfx(volume)}
            onBlur={() => aoMudarVolumeSfx(volume)}
            onKeyUp={() => aoMudarVolumeSfx(volume)}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-[var(--brand)] disabled:opacity-40"
          />
        </div>
      </Secao>

      <Secao titulo="Tela" icone={<Maximize2 className="h-3.5 w-3.5" />}>
        <Chave
          rotulo="Tela cheia"
          descricao="Ocupa o monitor inteiro ao abrir o jogo"
          ligado={telaCheia}
          aoMudar={v => {
            setTelaCheia(v)
            void setFullscreen(v)
          }}
        />
      </Secao>

      <Secao titulo="Desempenho" icone={<Gauge className="h-3.5 w-3.5" />}>
        <Opcoes
          colunas={3}
          valor={desempenho}
          opcoes={[
            { id: "economy", label: "Leve", nota: "PC modesto" },
            { id: "balanced", label: "Padrão", nota: "recomendado" },
            { id: "quality", label: "Máximo", nota: "PC forte" },
          ]}
          aoEscolher={p => {
            setDesempenho(p)
            applyPerformanceProfile(p)
          }}
        />
      </Secao>

      <p className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-white/35">
        Moeda, comentarista, tema, escalações salvas e atualizações continuam em
        <span className="text-white/60"> Configurações</span> dentro da carreira.
      </p>
    </Moldura>
  )
}

/* ─── Acessibilidade ───────────────────────────────────────────────────────── */

const ESCALAS: { id: FontScale; label: string }[] = [
  { id: 100, label: "100%" },
  { id: 110, label: "110%" },
  { id: 125, label: "125%" },
  { id: 150, label: "150%" },
]

const CHAVES = [
  { key: "highContrast", rotulo: "Alto contraste", descricao: "Reforça texto e bordas apagadas" },
  { key: "reduceMotion", rotulo: "Reduzir movimento", descricao: "Desliga animações e transições" },
  { key: "focusHighlight", rotulo: "Realce de foco", descricao: "Contorno forte no item selecionado" },
  { key: "underlineLinks", rotulo: "Sublinhar ações", descricao: "Sublinha links e botões clicáveis" },
] as const

export function PainelAcessibilidade({ aoFechar }: { aoFechar: () => void }) {
  const a11y = useSyncExternalStore(
    accessibilityStore.subscribe,
    accessibilityStore.getSnapshot,
    accessibilityStore.getServerSnapshot,
  )

  return (
    <Moldura
      titulo="Acessibilidade"
      subtitulo="Vale para o jogo inteiro"
      icone={<Eye className="h-5 w-5" />}
      aoFechar={aoFechar}
    >
      <Secao titulo="Tamanho da fonte" icone={<Eye className="h-3.5 w-3.5" />}>
        <Opcoes
          valor={a11y.fontScale}
          opcoes={ESCALAS}
          aoEscolher={v => accessibilityStore.set("fontScale", v)}
        />
        <p className="text-[11px] text-white/30">A mudança aparece na hora, em todas as telas.</p>
      </Secao>

      <Secao titulo="Leitura e movimento" icone={<Check className="h-3.5 w-3.5" />}>
        <div className="space-y-2">
          {CHAVES.map(c => (
            <Chave
              key={c.key}
              rotulo={c.rotulo}
              descricao={c.descricao}
              ligado={a11y[c.key]}
              aoMudar={v => accessibilityStore.set(c.key, v)}
            />
          ))}
        </div>
      </Secao>

      <button
        onClick={() => accessibilityStore.reset()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-semibold text-white/55 transition-colors hover:border-white/20 hover:text-white"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restaurar o padrão
      </button>
    </Moldura>
  )
}
