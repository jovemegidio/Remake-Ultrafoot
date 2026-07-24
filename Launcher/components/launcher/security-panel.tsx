"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { LaunchMode } from "./launcher-shell"
import {
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  Loader2,
  Check,
  Cpu,
  FileCheck2,
  ScanSearch,
  FileSignature,
  Wrench,
} from "lucide-react"

type CheckState = "idle" | "running" | "ok"

const CHECKS = [
  {
    key: "files",
    label: "Integridade dos arquivos do jogo",
    detail: "Compara os arquivos locais com os hashes oficiais da versão instalada.",
    icon: FileCheck2,
  },
  {
    key: "memory",
    label: "Proteção de memória em tempo real",
    detail: "Impede leitura e escrita externa na memória do processo (overall, dinheiro, moral).",
    icon: Cpu,
  },
  {
    key: "process",
    label: "Varredura de processos suspeitos",
    detail: "Detecta Cheat Engine, editores de memória, injetores e debuggers ativos.",
    icon: ScanSearch,
  },
  {
    key: "signature",
    label: "Assinatura do executável",
    detail: "Valida a assinatura digital do UltraShield e do cliente do jogo.",
    icon: FileSignature,
  },
] as const

export function SecurityPanel({ mode }: { mode: LaunchMode }) {
  const online = mode === "online"
  const [states, setStates] = useState<Record<string, CheckState>>(
    () => Object.fromEntries(CHECKS.map((c) => [c.key, "idle"])),
  )
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
    }
  }, [])

  const runScan = useCallback(() => {
    if (scanning || !online) return
    timers.current.forEach(clearTimeout)
    timers.current = []
    setScanning(true)
    setStates(Object.fromEntries(CHECKS.map((c) => [c.key, "idle"])))

    CHECKS.forEach((check, i) => {
      const startAt = setTimeout(() => {
        setStates((prev) => ({ ...prev, [check.key]: "running" }))
      }, i * 700)
      const doneAt = setTimeout(() => {
        setStates((prev) => ({ ...prev, [check.key]: "ok" }))
        if (i === CHECKS.length - 1) {
          setScanning(false)
          setLastScan(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
        }
      }, i * 700 + 600)
      timers.current.push(startAt, doneAt)
    })
  }, [scanning, online])

  return (
    <div className="flex flex-col gap-6">
      {/* Status principal */}
      <section
        className={cn(
          "flex flex-col gap-4 rounded-xl border p-5 md:flex-row md:items-center md:justify-between md:p-6",
          online ? "border-primary/40 bg-primary/5" : "border-accent/40 bg-accent/5",
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
              online ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent",
            )}
          >
            {online ? <ShieldCheck className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">UltraShield Anti-Cheat</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  online ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent",
                )}
              >
                {online ? "Ativo" : "Desativado"}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-pretty text-sm text-muted-foreground">
              {online
                ? "No modo Online, o UltraShield protege a memória e os arquivos do jogo. Qualquer tentativa de editar overall, dinheiro ou outros dados com ferramentas externas resulta em bloqueio e banimento."
                : "No modo Offline, a proteção fica desativada. Você tem liberdade para editar dados, usar mods e ferramentas — mas esses saves não são válidos para o modo Online nem para rankings."}
            </p>
          </div>
        </div>
      </section>

      {/* Verificação de integridade (só online) */}
      {online ? (
        <section className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">
                Verificação de integridade
              </h3>
              <p className="text-sm text-muted-foreground">
                {lastScan ? `Última verificação às ${lastScan}` : "Nunca verificado nesta sessão"}
              </p>
            </div>
            <Button onClick={runScan} disabled={scanning} className="gap-2 font-semibold">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {scanning ? "Verificando…" : "Verificar agora"}
            </Button>
          </div>

          <ul className="mt-5 flex flex-col gap-2">
            {CHECKS.map((check) => {
              const state = states[check.key]
              return (
                <li
                  key={check.key}
                  className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3"
                >
                  <div className="mt-0.5 text-muted-foreground">
                    <check.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{check.label}</p>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                  <div className="mt-0.5 shrink-0">
                    {state === "running" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    {state === "ok" && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        <Check className="h-4 w-4" /> OK
                      </span>
                    )}
                    {state === "idle" && (
                      <span className="text-xs text-muted-foreground">Pendente</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">
                Edição liberada
              </h3>
              <p className="mt-1 max-w-xl text-pretty text-sm text-muted-foreground">
                Ferramentas de edição, treinadores e mods são permitidos no modo Offline. Divirta-se
                montando cenários impossíveis — dinheiro infinito, overall máximo e o que mais quiser.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  Saves criados no modo Offline ficam marcados e não podem ser usados em partidas
                  Online, competições ou rankings.
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Lista de ferramentas bloqueadas */}
      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h3 className="font-display text-base font-semibold text-foreground">
          Ferramentas bloqueadas no modo Online
        </h3>
        <p className="text-sm text-muted-foreground">
          O UltraShield encerra o jogo e registra a tentativa se detectar qualquer um destes:
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "Cheat Engine",
            "Editores de memória",
            "Injetores de DLL",
            "Debuggers (x64dbg, OllyDbg)",
            "Table makers / trainers",
            "Speed hacks",
            "Saves modificados",
          ].map((tool) => (
            <span
              key={tool}
              className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-foreground"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              {tool}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
