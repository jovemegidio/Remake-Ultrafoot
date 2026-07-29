"use client"

import { useEffect, useMemo } from "react"
import { AlertTriangle, Check } from "lucide-react"
import { isKitVariantAvailable, type Team } from "@/lib/teams-data"
import { TeamCrest } from "@/components/team-crest"
import { KitImage, type KitVariant } from "@/components/match/kit-image"
import { cn } from "@/lib/utils"

const VARIANTS: KitVariant[] = ["home", "away", "third"]
const LABEL: Record<KitVariant, string> = { home: "Casa", away: "Visitante", third: "Terceiro" }

/**
 * Cor dominante estimada de cada uniforme.
 *
 * APROXIMACAO ASSUMIDA: o clube guarda so duas cores (cor1/cor2), nao uma cor
 * por camisa. Casa usa a primeira, visitante e terceiro usam a segunda. Serve
 * para AVISAR sobre cores parecidas, nunca para impedir a escolha — se a
 * estimativa errar, o jogador decide do mesmo jeito.
 */
function corDoUniforme(team: Team, v: KitVariant): string {
  return (v === "home" ? team.cor1 : team.cor2) || team.cor1 || "#888888"
}

function paraRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const c = h.length === 3 ? h.split("").map(x => x + x).join("") : h.padEnd(6, "0")
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]
}

/** Distancia euclidiana no RGB. Grosseira de proposito: basta separar "parecido" de "distinto". */
function coresConflitam(a: string, b: string): boolean {
  const [r1, g1, b1] = paraRgb(a)
  const [r2, g2, b2] = paraRgb(b)
  const d = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
  return d < 90 // ~35% do maximo (441)
}

// Modal de selecao de uniformes: escolhe o kit (casa/visitante/terceiro) do time da casa
// e do adversario. Abre com a tecla Q na pre-partida, no lugar de "Opcoes de vantagem".
//
// As camisas usam KitImage: quando o clube nao tem arte (25 clubes nao tem), ela desenha
// a camisa com as cores do time em vez de mostrar o texto alternativo — que era o que
// deixava o modal com cara de quebrado.
function TeamKits({
  team, selected, onSelect, lado, dica,
}: {
  team: Team
  selected: KitVariant
  onSelect: (v: KitVariant) => void
  lado: "casa" | "visitante"
  dica: string
}) {
  const cor = team.cor1 || "#ffffff"
  const variants = VARIANTS.filter(variant => isKitVariantAvailable(team.file_key, variant))
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Cabecalho com escudo e cor do clube: antes so havia o nome em texto, e
          nada dizia de quem era cada coluna alem da posicao na tela. */}
      <div className="flex items-center gap-3">
        <TeamCrest team={team} size="md" />
        <div className="min-w-0">
          <div className="truncate text-base font-bold leading-tight text-white">{team.nome}</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {lado === "casa" ? "Mandante" : "Visitante"}
          </div>
        </div>
      </div>
      <div className="h-0.5 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${cor}, transparent)` }} />

      <div className={cn("grid w-full gap-2.5", variants.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {variants.map((v) => {
          const isSel = selected === v
          return (
            <button
              key={v}
              onClick={() => onSelect(v)}
              aria-pressed={isSel}
              className={cn(
                "group relative flex min-w-0 flex-col items-center gap-2 rounded-xl border p-3 transition-all",
                isSel
                  ? "border-transparent bg-white/[0.07] shadow-lg"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]",
              )}
              style={isSel ? { boxShadow: `0 0 0 2px ${cor}, 0 8px 24px -12px ${cor}` } : undefined}
            >
              <div
                className={cn(
                  "relative transition-transform duration-200",
                  "h-24 w-24 max-[860px]:h-20 max-[860px]:w-20 max-[720px]:h-16 max-[720px]:w-16",
                  isSel ? "scale-105" : "opacity-60 group-hover:opacity-90",
                )}
              >
                <KitImage team={team} variant={v} />
              </div>
              <span
                className={cn("text-[11px] font-bold uppercase tracking-wide", isSel ? "text-white" : "text-white/40")}
              >
                {LABEL[v]}
              </span>
              {isSel && (
                <span
                  className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ backgroundColor: cor }}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} color="#08121a" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="text-center text-[10px] text-white/25">{dica}</div>
    </div>
  )
}

export function UniformSelectorModal({
  open,
  homeTeam,
  awayTeam,
  homeKit,
  awayKit,
  onHomeKit,
  onAwayKit,
  onClose,
}: {
  open: boolean
  homeTeam: Team
  awayTeam: Team
  homeKit: KitVariant
  awayKit: KitVariant
  onHomeKit: (v: KitVariant) => void
  onAwayKit: (v: KitVariant) => void
  onClose: () => void
}) {
  const homeVariants = useMemo(
    () => VARIANTS.filter(variant => isKitVariantAvailable(homeTeam.file_key, variant)),
    [homeTeam.file_key],
  )
  const awayVariants = useMemo(
    () => VARIANTS.filter(variant => isKitVariantAvailable(awayTeam.file_key, variant)),
    [awayTeam.file_key],
  )

  useEffect(() => {
    if (!homeVariants.includes(homeKit)) onHomeKit(homeVariants[0] ?? "home")
    if (!awayVariants.includes(awayKit)) onAwayKit(awayVariants[0] ?? "home")
  }, [homeVariants, awayVariants, homeKit, awayKit, onHomeKit, onAwayKit])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "q") { e.preventDefault(); onClose() }
    }
    // CONTROLE: LB/RB trocam o kit da casa, LT/RT o do visitante, A/B fecham.
    // (O modal foi criado depois do sistema de gamepad e nao respondia ao controle.)
    const cycle = (variants: KitVariant[], cur: KitVariant, dir: 1 | -1): KitVariant => {
      const i = Math.max(0, variants.indexOf(cur))
      return variants[(i + dir + variants.length) % variants.length] ?? "home"
    }
    const onPad = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail
      switch (button) {
        case "LB": onHomeKit(cycle(homeVariants, homeKit, -1)); break
        case "RB": onHomeKit(cycle(homeVariants, homeKit, 1)); break
        case "LT": onAwayKit(cycle(awayVariants, awayKit, -1)); break
        case "RT": onAwayKit(cycle(awayVariants, awayKit, 1)); break
        case "A":
        case "B": onClose(); break
      }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("gamepad:button", onPad)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("gamepad:button", onPad)
    }
  }, [open, onClose, homeKit, awayKit, homeVariants, awayVariants, onHomeKit, onAwayKit])

  const conflito = useMemo(
    () => coresConflitam(corDoUniforme(homeTeam, homeKit), corDoUniforme(awayTeam, awayKit)),
    [homeTeam, awayTeam, homeKit, awayKit],
  )

  if (!open) return null

  return (
    <div
      role="dialog"
      data-state="open"
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/85 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="my-auto flex max-h-[calc(100vh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1214] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 shrink-0 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--brand)]/70">Pre-jogo</div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Uniformes</h2>
          <p className="mt-0.5 text-xs text-white/35">Escolha o uniforme de cada equipe</p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-5 overflow-y-auto px-1 sm:gap-8">
          <TeamKits
            team={homeTeam}
            selected={homeKit}
            onSelect={onHomeKit}
            lado="casa"
            dica="LB / RB"
          />

          <div className="flex flex-col items-center gap-2 self-center">
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
            <span className="text-sm font-black tracking-widest text-white/25">VS</span>
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
          </div>

          <TeamKits
            team={awayTeam}
            selected={awayKit}
            onSelect={onAwayKit}
            lado="visitante"
            dica="LT / RT"
          />
        </div>

        {/* Aviso de cores parecidas — a razao de existir troca de uniforme. Sem
            ele o modal so pergunta "qual camisa?" sem dizer por que importa. */}
        {conflito && (
          <div className="mt-4 flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span className="text-[11px] text-amber-200/80">
              As duas equipes entram com cores parecidas. Considere trocar um dos uniformes.
            </span>
          </div>
        )}

        <div className="mt-5 flex shrink-0 flex-col items-center gap-2.5">
          <button
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] px-10 py-2.5 text-sm font-bold text-black shadow-lg shadow-[var(--brand)]/15 transition-all hover:brightness-110"
          >
            Confirmar
          </button>
          <p className="text-[10px] text-white/25">
            LB/RB trocam o uniforme do mandante · LT/RT o do visitante · A confirma
          </p>
        </div>
      </div>
    </div>
  )
}
