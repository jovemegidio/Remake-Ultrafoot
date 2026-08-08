"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatSize } from "@/lib/format"
import { useT } from "@/lib/i18n"
import type { GameStatus, InstallState, LaunchMode } from "./launcher-shell"
import {
  Download, Play, RefreshCw, Loader2, Wifi, WifiOff, Wrench, LogIn,
  Pause, PlayCircle, XCircle, Square,
} from "lucide-react"

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return ""
  const mb = bytesPerSec / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB/s`
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
}

function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0) return ""
  if (seconds < 60) return `${seconds}s restantes`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}min ${s.toString().padStart(2, "0")}s restantes`
}

export function DownloadControl({
  status,
  install,
  mode,
  logado,
  downloadSizeMb,
  pausado,
  jogando,
  onDownload,
  onRepair,
  onPausar,
  onRetomar,
  onCancelar,
  onPararJogo,
  size = "lg",
}: {
  status: GameStatus
  install: InstallState
  mode: LaunchMode
  /** Sem conta o download fica travado — ver `startDownload` em launcher-shell. */
  logado: boolean
  downloadSizeMb: number | null | undefined
  pausado: boolean
  /** O jogo está aberto AGORA — o launcher sobrevive a ele desde jogo.rs. */
  jogando: boolean
  onDownload: () => void
  onRepair: () => void
  onPausar: () => void
  onRetomar: () => void
  onCancelar: () => void
  onPararJogo: () => void
  size?: "lg" | "sm"
}) {
  const t = useT()
  const online = mode === "online"
  if (status === "downloading") {
    const pct = Math.round(install.progress)
    const installing = install.phase === "installing" || install.phase === "applying"
    const conferindo = install.phase === "checking"
    const label = pausado
      ? t("baixar.pausado")
      : install.phase === "prereq"
        ? t("baixar.requisitos")
        : install.phase === "applying"
        ? t("baixar.aplicando")
        : install.phase === "installing"
          ? t("baixar.instalando")
          : conferindo
            ? t("baixar.conferindo")
            : install.version
              ? t("baixar.atualizando")
              : t("baixar.baixando")
    const speed = formatSpeed(install.speed)
    const eta = formatEta(install.eta)
    // Só o download dá para interromper. Durante a aplicação do patch e a
    // instalação, parar no meio deixaria o jogo pela metade — e é justamente o
    // estado do qual não há como sair sem reinstalar tudo.
    const podeControlar = !installing && !conferindo
    return (
      <div className={cn("w-full", size === "lg" ? "max-w-md" : "max-w-none")}>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            {pausado ? (
              <Pause className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            )}
            {label}… {installing ? "" : `${pct}%`}
          </span>
          {!installing && (
            <span className="text-muted-foreground">
              {formatSize(Math.round(((downloadSizeMb || 0) * pct) / 100))} / {formatSize(downloadSizeMb)}
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-200",
              pausado ? "bg-accent" : "bg-primary",
              installing && "animate-pulse",
            )}
            style={{ width: installing ? "100%" : `${pct}%` }}
          />
        </div>
        {!installing && (speed || eta) && !pausado && (
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{speed}</span>
            <span>{eta}</span>
          </div>
        )}
        {podeControlar && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={pausado ? onRetomar : onPausar}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {pausado ? <PlayCircle className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {pausado ? t("acao.retomar") : t("acao.pausar")}
            </button>
            <button
              onClick={onCancelar}
              /* O pedaço baixado FICA no disco: cancelar quase sempre é "agora
                 não", e recomeçar do zero depois seria hostil. */
              title="O que já foi baixado continua no disco para retomar depois."
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <XCircle className="h-3.5 w-3.5" />
              {t("acao.cancelar")}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (status === "playable") {
    // JOGANDO AGORA. Antes este estado não existia: o launcher se matava ao
    // abrir o jogo. Agora ele fica de pé, conta o tempo e oferece o "Parar".
    if (jogando) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button size={size === "lg" ? "lg" : "default"} disabled className="gap-2 font-semibold">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("acao.jogando")}
          </Button>
          <button
            onClick={onPararJogo}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Square className="h-3.5 w-3.5" /> {t("acao.parar")}
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size={size === "lg" ? "lg" : "default"}
          onClick={onDownload}
          className={cn(
            "gap-2 font-semibold",
            !online && "bg-accent text-accent-foreground hover:bg-accent/90",
          )}
        >
          <Play className="h-4 w-4" fill="currentColor" />
          {online ? t("acao.jogarOnline") : t("acao.jogarOffline")}
        </Button>
        {/* Reparar baixa o instalador inteiro: offline nem aparece, para nao
            oferecer o que nao tem como acontecer. */}
        {online && (
          <button
            onClick={onRepair}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            title={
              logado
                ? "Reinstala a versão atual por cima, corrigindo arquivos danificados."
                : "Reparar baixa o jogo de novo — entre na sua conta para usar."
            }
          >
            <Wrench className="h-3.5 w-3.5" />
            {t("acao.reparar")}
          </button>
        )}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {online ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-primary" /> {t("rede.anticheat")}
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-accent" /> {t("rede.edicaoLiberada")}
            </>
          )}
        </span>
      </div>
    )
  }

  // SEM REDE NAO EXISTE DOWNLOAD. Antes o botao "Instalar" continuava clicavel e
  // simplesmente nao fazia nada — a pessoa clicava tres, quatro vezes achando que
  // o launcher travou. Offline ele diz o motivo, como o jogo faz.
  if (!online && (status === "not-installed" || status === "update")) {
    const instalar = status === "not-installed"
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3">
          <WifiOff className="h-4 w-4 shrink-0 text-accent" />
          <span className="text-sm font-semibold text-foreground">
            {instalar ? "Sem internet para instalar" : "Sem internet para atualizar"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Conecte-se e o launcher {instalar ? "baixa o jogo" : "traz a atualização"} ({formatSize(downloadSizeMb)}).
        </span>
      </div>
    )
  }

  // ATUALIZAR NAO E ESCOLHA. O launcher ja disparou o download sozinho (ver o
  // efeito de auto-update em launcher-shell); o botao aqui e so para quem quiser
  // forcar de novo depois de uma falha de rede. Nao ha "jogar assim mesmo": ficar
  // numa versao velha quebra o online e e o que esta regra existe para impedir.
  if (status === "update") {
    return (
      <div className="flex flex-col gap-1">
        <Button
          size={size === "lg" ? "lg" : "default"}
          onClick={onDownload}
          className="gap-2 bg-accent font-semibold text-accent-foreground hover:bg-accent/90"
        >
          <RefreshCw className="h-4 w-4" />
          {t("acao.atualizar")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("baixar.obrigatoria", { tamanho: formatSize(downloadSizeMb) })}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size={size === "lg" ? "lg" : "default"}
        onClick={onDownload}
        className="gap-2 font-semibold"
      >
        {logado ? <Download className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
        {logado ? t("acao.instalar") : t("acao.entrarParaInstalar")}
      </Button>
      <span className="text-xs text-muted-foreground">
        {logado ? (
          t("baixar.tamanho", { tamanho: formatSize(downloadSizeMb) })
        ) : (
          <>Crie sua conta ou entre para baixar o jogo · {formatSize(downloadSizeMb)}</>
        )}
      </span>
    </div>
  )
}
