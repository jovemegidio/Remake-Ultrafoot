"use client"

import { cn } from "@/lib/utils"
import { Users, Wifi, WifiOff, MessageCircle, ExternalLink, KeyRound, LogIn, ShieldCheck } from "lucide-react"
import type { LauncherConfig, ServerStatus } from "@/lib/launcher-bridge"
import type { Sessao } from "@/lib/auth"
import { iniciais, type Preferencias } from "@/lib/preferencias"

/**
 * FC HUB — a aba social do launcher.
 *
 * Junta num lugar só o que estava espalhado: quem você é, se o servidor do modo
 * online está de pé e por onde falar com a comunidade. Antes, para saber se dava
 * para jogar online, era preciso abrir o jogo e descobrir lá dentro.
 */
export function SocialPanel({
  sessao,
  prefs,
  serverStatus,
  config,
  ativado,
  onEntrar,
  onAtivar,
  onOpen,
}: {
  sessao: Sessao | null
  prefs: Preferencias
  serverStatus: ServerStatus | null
  config: LauncherConfig | null
  ativado: boolean
  onEntrar: () => void
  onAtivar: () => void
  onOpen: (url: string) => void
}) {
  const online = serverStatus?.online ?? false
  const social = config?.social

  const redes: { nome: string; url?: string; discord?: boolean }[] = [
    { nome: "Discord", url: social?.discord, discord: true },
    { nome: "YouTube", url: social?.youtube },
    { nome: "TikTok", url: social?.tiktok },
    { nome: "Instagram", url: social?.instagram },
  ]

  return (
    <div className="space-y-5">
      {/* Cartao do jogador */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-4 p-5">
          {prefs.fotoAvatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={prefs.fotoAvatar} alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${prefs.corAvatar}` }}
            />
          ) : (
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold"
              style={{ background: `${prefs.corAvatar}22`, color: prefs.corAvatar }}
            >
              {prefs.avatar || iniciais(sessao?.nome || sessao?.email || "")}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-foreground">
              {sessao ? (sessao.nome || sessao.email) : "Você ainda não entrou"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {sessao ? sessao.email : "Crie sua conta para levar compras e carreiras para qualquer computador."}
            </p>
            {sessao && (
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  ativado
                    ? "bg-primary/15 text-primary"
                    : "bg-white/[0.06] text-muted-foreground",
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                {ativado ? "Versão completa ativada" : "Versão simples"}
              </span>
            )}
          </div>
          {!sessao ? (
            <button
              onClick={onEntrar}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              <LogIn className="h-4 w-4" /> Entrar
            </button>
          ) : !ativado ? (
            <button
              onClick={onAtivar}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/20"
            >
              <KeyRound className="h-4 w-4" /> Ativar
            </button>
          ) : null}
        </div>
      </section>

      {/* Estado do FC Hub */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <Users className="h-4 w-4 text-primary" /> FC Hub — modo online
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
              online ? "bg-primary/12 text-primary" : "bg-white/[0.05] text-muted-foreground",
            )}
          >
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {online ? "Servidor no ar" : "Servidor fora do ar"}
          </span>
          {serverStatus?.game_version && (
            <span className="text-xs text-muted-foreground">
              Versão aceita no online:{" "}
              <span className="font-mono text-foreground">v{serverStatus.game_version}</span>
            </span>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          O campeonato pela internet, o mercado entre amigos e as mensagens ficam dentro do jogo,
          na aba FC Hub. O servidor só aceita clientes na versão indicada acima — por isso, quando
          ela mudar, atualize antes de entrar numa sala.
        </p>
      </section>

      {/* Comunidade */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <MessageCircle className="h-4 w-4 text-primary" /> Comunidade
        </h3>
        {redes.some(r => r.url) ? (
          <div className="flex flex-wrap gap-2">
            {redes.filter(r => r.url).map(r => (
              <button
                key={r.nome}
                onClick={() => onOpen(r.url!)}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {r.discord ? <MessageCircle className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                {r.nome}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Os canais da comunidade aparecem aqui assim que o launcher conseguir falar com o servidor.
          </p>
        )}
      </section>
    </div>
  )
}
