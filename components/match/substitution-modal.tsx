"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowLeftRight, ArrowUp, Check, X, ChevronRight, Zap, HeartPulse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerAvatar } from "@/components/player-avatar"
import { cn } from "@/lib/utils"
import type { Team } from "@/lib/teams-data"

export interface MatchPlayer {
  /**
   * ⚠️ POSICIONAL (`idOffset + i + 1`), NAO o id do atleta no elenco. Serve para
   * a UI distinguir as cartas; usar isto para mexer no elenco atinge outra
   * pessoa. Quem precisa do atleta de verdade usa `atletaId`.
   */
  id: number
  /** Id REAL do atleta no elenco, quando conhecido. Chave do perfil canonico. */
  atletaId?: number
  /** Posicoes secundarias declaradas — entram na familiaridade do perfil. */
  posicoesSecundarias?: string[]
  name: string
  number: number
  position: string
  rating: number
  stamina: number
  // Atributos de PlayerCard estilo FUT
  pace?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
  // Visual
  goals?: number
  assists?: number
  yellow?: boolean
  red?: boolean
  // Slot tático ocupado no início da partida. Mantê-lo na substituição impede
  // que o radar redesenhe todos os jogadores em posições diferentes.
  tacticalSlot?: number
  formationPosition?: string
  /** Posicao no campo (0-100) definida pelo tecnico em Gerenciamento do Time. */
  fieldX?: number
  fieldY?: number
}

interface SubstitutionModalProps {
  open: boolean
  onClose: () => void
  team: Team
  starters: MatchPlayer[]
  bench: MatchPlayer[]
  subsRemaining: number
  onConfirm: (changes: SubstitutionChange[]) => void
}

export interface SubstitutionChange { out: MatchPlayer; inPlayer: MatchPlayer }

// ─────────────────────────────────────────────────────────────────────────────
// Player Row — leitura rápida de banco/escalação durante a partida
// ─────────────────────────────────────────────────────────────────────────────

function PlayerRow({
  player,
  team,
  selected,
  disabled,
  onClick,
  variant = "out",
}: {
  player: MatchPlayer
  team: Team
  selected: boolean
  disabled?: boolean
  onClick: () => void
  variant?: "out" | "in"
}) {
  const stamina = Math.round(player.stamina ?? 100)
  const stamColor = stamina > 70 ? "#00ffc8" : stamina > 40 ? "#eab308" : "#ef4444"
  const accent = variant === "out" ? "#fb7185" : "#00ffc8"

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative grid min-h-[66px] w-full grid-cols-[42px_1fr_auto] items-center gap-3 overflow-hidden rounded-xl border px-3 py-2 text-left transition-all",
        selected ? "border-current bg-white/[0.08] shadow-lg" : "border-white/[0.06] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.055]",
        disabled && "cursor-not-allowed opacity-30",
      )}
      style={{ color: selected ? accent : undefined, boxShadow: selected ? `inset 3px 0 0 ${accent}, 0 12px 30px rgba(0,0,0,.22)` : undefined }}
    >
      {/* ROSTO, e não só o número. Na hora de mexer no time o técnico procura o
          ATLETA, e esta lista mostrava um quadradinho com o número da camisa —
          o único lugar do jogo onde escalar era ler número. O `fileKey` é o que
          faz a foto do canal de atualização aparecer (a chave lá é
          `fileKey__nome`); sem ele o avatar cai na silhueta por posição, que
          continua sendo o fallback quando o atleta não tem retrato. */}
      <div className="relative h-10 w-10 shrink-0">
        <PlayerAvatar
          name={player.name}
          fileKey={team.file_key}
          position={player.position}
          teamColor={team.cor1}
          size="sm"
          className="h-10 w-10 rounded-lg"
        />
        <span className="absolute -left-1 -top-1 min-w-[15px] rounded bg-[#080b0b] px-1 text-center text-[9px] font-black text-white/85 shadow">
          {player.number}
        </span>
        <span className="absolute -bottom-1 -right-1 rounded bg-[#080b0b] px-1 py-0.5 text-[8px] font-black text-white/75">
          {player.position}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-bold text-white">{player.name}</span>
          {player.yellow && <span className="h-3 w-2 shrink-0 rounded-[2px] bg-yellow-400" title="Cartão amarelo" />}
          {player.red && <span className="h-3 w-2 shrink-0 rounded-[2px] bg-red-500" title="Cartão vermelho" />}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${stamina}%`, background: stamColor }} />
          </div>
          <span className="w-7 text-right text-[9px] font-bold tabular-nums text-white/45">{stamina}%</span>
        </div>
        <div className="mt-1 flex gap-2 text-[8px] font-semibold uppercase tracking-wider text-white/30">
          {player.pace != null && <span>Rit {player.pace}</span>}
          {player.passing != null && <span>Pas {player.passing}</span>}
          {player.defending != null && <span>Def {player.defending}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-lg font-black leading-none text-white">{player.rating}</div>
          <div className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/30">OVR</div>
        </div>
        {selected && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: accent }}>
            {variant === "out" ? <ArrowDown className="h-3.5 w-3.5 text-black" /> : <ArrowUp className="h-3.5 w-3.5 text-black" />}
          </span>
        )}
        {!selected && (
          <ChevronRight className="h-4 w-4 text-white/15 transition group-hover:text-white/50" />
        )}
      </div>

      {player.goals != null && player.goals > 0 && (
        <span className="absolute right-2 top-1 rounded bg-emerald-400/15 px-1.5 text-[8px] font-bold text-emerald-300">
          {player.goals}G
        </span>
      )}
      {stamina <= 45 && (
        <span className="absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/15">
          <HeartPulse className="h-2.5 w-2.5 text-red-400" />
        </span>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal principal
// ─────────────────────────────────────────────────────────────────────────────

export function SubstitutionModal({
  open,
  onClose,
  team,
  starters,
  bench,
  subsRemaining,
  onConfirm,
}: SubstitutionModalProps) {
  const [out, setOut] = useState<MatchPlayer | null>(null)
  const [inPlayer, setIn] = useState<MatchPlayer | null>(null)
  const [pending, setPending] = useState<SubstitutionChange[]>([])
  // Cursor do CONTROLE: area (quem SAI / quem ENTRA) + indice na grade. O modal
  // abria pelo controle mas era inoperavel sem mouse — nenhum botao selecionava
  // ninguem (relato: "nao consigo fazer substituicoes").
  const [padArea, setPadArea] = useState<"out" | "in">("out")
  const [padIndex, setPadIndex] = useState(0)

  // Handlers em ref para o listener global nao ser recriado a cada render.
  const padStateRef = useRef({ padArea, padIndex, out, inPlayer, pending })
  padStateRef.current = { padArea, padIndex, out, inPlayer, pending }

  useEffect(() => {
    if (!open) return
    const onPad = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail || {}
      const cur = padStateRef.current
      const lista = cur.padArea === "out" ? starters : bench
      if (button === "DPAD_LEFT") setPadIndex(i => Math.max(0, i - 1))
      else if (button === "DPAD_RIGHT") setPadIndex(i => Math.min(Math.max(0, lista.length - 1), i + 1))
      else if (button === "DPAD_UP" || button === "DPAD_DOWN") {
        // Alterna entre as duas colunas (sai <-> entra), preservando o indice.
        setPadArea(a => (a === "out" ? "in" : "out"))
        setPadIndex(i => Math.min(i, Math.max(0, (cur.padArea === "out" ? bench : starters).length - 1)))
      } else if (button === "A") {
        const alvo = lista[cur.padIndex]
        if (!alvo) return
        if (cur.padArea === "out") {
          if (!pendingIdsRef.current.usedOut.has(alvo.id)) setOut(o => (o?.id === alvo.id ? null : alvo))
        } else {
          if (!pendingIdsRef.current.usedIn.has(alvo.id)) setIn(o => (o?.id === alvo.id ? null : alvo))
        }
      } else if (button === "X") {
        addRef.current()
      } else if (button === "START") {
        confirmRef.current()
      }
      // B fecha via handler da partida (setShowSubModal(false)).
    }
    window.addEventListener("gamepad:button", onPad)
    return () => window.removeEventListener("gamepad:button", onPad)
  }, [open, starters, bench])

  // Refs preenchidas mais abaixo (apos handleAdd/handleConfirm existirem).
  const addRef = useRef<() => void>(() => {})
  const confirmRef = useRef<() => void>(() => {})
  const pendingIdsRef = useRef<{ usedOut: Set<number>; usedIn: Set<number> }>({ usedOut: new Set(), usedIn: new Set() })

  if (!open) return null

  const canAdd = !!out && !!inPlayer && pending.length < subsRemaining
  const canConfirm = pending.length > 0

  const handleAdd = () => {
    if (!canAdd || !out || !inPlayer) return
    setPending(current => [...current, { out, inPlayer }])
    setOut(null)
    setIn(null)
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(pending)
    setPending([])
    setOut(null)
    setIn(null)
    setPending([])
  }

  const handleClose = () => {
    setOut(null)
    setIn(null)
    onClose()
  }

  // Sugestão automática: jogador com menor stamina
  const usedOut = new Set(pending.map(change => change.out.id))
  const usedIn = new Set(pending.map(change => change.inPlayer.id))
  const suggestedOut = starters.filter(player => !usedOut.has(player.id)).sort((a, b) => a.stamina - b.stamina)[0]

  // Alimenta as refs usadas pelo handler do controle (declaradas antes do return).
  addRef.current = handleAdd
  confirmRef.current = handleConfirm
  pendingIdsRef.current = { usedOut, usedIn }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-lg">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#090d0c] shadow-[0_30px_100px_rgba(0,0,0,.7)]">
        {/* Header */}
        <div
          className="relative flex items-center justify-between border-b border-white/[0.06] px-6 py-4"
          style={{
            background: `linear-gradient(90deg, ${team.cor1}30 0%, transparent 60%)`,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: `${team.cor1}20`, border: `1px solid ${team.cor1}40` }}
            >
              <ArrowLeftRight className="h-5 w-5" style={{ color: team.cor1 }} />
            </div>
            <div>
              <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.22em] text-[var(--brand)]/70">Central tática</p>
              <h3 className="text-xl font-black tracking-tight text-white">
                Substituição
              </h3>
              <p className="text-[11px] text-white/50 tracking-wider uppercase">
                {team.nome} · {subsRemaining} restantes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-white/35 md:flex">
              <span className={cn("rounded-full px-2 py-1", out ? "bg-rose-400/15 text-rose-300" : "bg-white/5")}>1 · Saída</span>
              <ChevronRight className="h-3 w-3" />
              <span className={cn("rounded-full px-2 py-1", inPlayer ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "bg-white/5")}>2 · Entrada</span>
              <ChevronRight className="h-3 w-3" />
              <span className={cn("rounded-full px-2 py-1", pending.length ? "bg-white/10 text-white/75" : "bg-white/5")}>3 · Confirmar</span>
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-bold tracking-wider",
                subsRemaining > 2
                  ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                  : subsRemaining > 0
                    ? "bg-yellow-400/15 text-yellow-400"
                    : "bg-red-400/15 text-red-400",
              )}
            >
              {subsRemaining}/5
            </span>
            <button
              onClick={handleClose}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)]">
          {/* SAI */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold text-white/60 tracking-[0.2em] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                SAI DE CAMPO
              </h4>
              {suggestedOut && !out && (
                <button
                  onClick={() => setOut(suggestedOut)}
                  className="flex items-center gap-1 text-[10px] text-yellow-400 hover:text-yellow-300 font-medium tracking-wider"
                >
                  <Zap className="h-3 w-3" />
                  SUGESTÃO: #{suggestedOut.number}
                </button>
              )}
            </div>
            <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-game">
              {starters.map((p, i) => (
                <div key={p.id} className={cn("rounded-xl", padArea === "out" && padIndex === i && "ring-2 ring-white/80 ring-offset-2 ring-offset-[#090d0c]")}>
                  <PlayerRow
                    player={p}
                    team={team}
                    selected={out?.id === p.id}
                    disabled={usedOut.has(p.id)}
                    variant="out"
                    onClick={() => setOut(out?.id === p.id ? null : p)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="hidden items-center justify-center lg:flex">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <ArrowLeftRight className="h-4 w-4 text-white/35" />
            </div>
          </div>

          {/* ENTRA */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-bold text-white/60 tracking-[0.2em] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                ENTRA EM CAMPO
              </h4>
              <span className="text-[10px] text-white/40 tracking-wider">
                {bench.length} no banco
              </span>
            </div>
            <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-game">
              {bench.map((p, i) => (
                <div key={p.id} className={cn("rounded-xl", padArea === "in" && padIndex === i && "ring-2 ring-white/80 ring-offset-2 ring-offset-[#090d0c]")}>
                  <PlayerRow
                    player={p}
                    team={team}
                    selected={inPlayer?.id === p.id}
                    disabled={usedIn.has(p.id)}
                    variant="in"
                    onClick={() => setIn(inPlayer?.id === p.id ? null : p)}
                  />
                </div>
              ))}
              {bench.length === 0 && (
                <div className="col-span-full rounded-xl border border-white/[0.04] bg-white/[0.02] p-8 text-center text-xs text-white/40">
                  Banco vazio
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer com preview da substituição */}
        <div className="border-t border-white/[0.06] bg-black/35 px-5 py-3">
          {pending.length > 0 && <div className="mb-3 flex flex-wrap gap-2">
            {pending.map((change, index) => <button key={`${change.out.id}-${change.inPlayer.id}`} onClick={() => setPending(current => current.filter((_, i) => i !== index))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-white/70 hover:border-red-400/50" title="Remover troca">{change.out.name} → <span className="text-[var(--brand)]">{change.inPlayer.name}</span> ×</button>)}
          </div>}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {out ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative h-9 w-9 flex-shrink-0">
                    <PlayerAvatar name={out.name} fileKey={team.file_key} position={out.position} teamColor={team.cor1} size="sm" className="h-9 w-9 rounded-lg" />
                    <span className="absolute -left-1 -top-1 min-w-[14px] rounded bg-red-500/90 px-1 text-center text-[8px] font-black text-white">
                      {out.number}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">{out.name}</div>
                    <div className="text-[10px] text-red-400">SAI · {Math.round(out.stamina)}% de energia</div>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-white/40">Selecione quem sai</span>
              )}

              <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />

              {inPlayer ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative h-9 w-9 flex-shrink-0">
                    <PlayerAvatar name={inPlayer.name} fileKey={team.file_key} position={inPlayer.position} teamColor={team.cor1} size="sm" className="h-9 w-9 rounded-lg" />
                    <span className="absolute -left-1 -top-1 min-w-[14px] rounded bg-[var(--brand)] px-1 text-center text-[8px] font-black text-[var(--brand-ink)]">
                      {inPlayer.number}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">{inPlayer.name}</div>
                    <div className="text-[10px] text-[var(--brand)]">ENTRA · OVR {inPlayer.rating}</div>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-white/40 flex-1">Selecione quem entra</span>
              )}
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleClose}
                className="text-xs border-white/10 bg-transparent text-white/70 hover:bg-white/5"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!canAdd}
                variant="outline"
                className="text-xs border-[var(--brand)]/30 bg-transparent text-[var(--brand)] disabled:opacity-30"
              >
                ADICIONAR À FILA
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="text-xs bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)] disabled:opacity-30 font-bold tracking-wide"
              >
                <Check className="mr-2 h-3.5 w-3.5" />
                CONFIRMAR {pending.length} {pending.length === 1 ? "TROCA" : "TROCAS"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
