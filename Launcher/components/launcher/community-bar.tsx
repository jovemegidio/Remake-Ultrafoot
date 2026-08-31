"use client"

import { cn } from "@/lib/utils"
import type { LauncherConfig } from "@/lib/launcher-bridge"
import { MessageCircle, ExternalLink, Megaphone, Users } from "lucide-react"

function SocialButton({ label, href, onOpen, discord }: { label: string; href: string; onOpen: (u: string) => void; discord?: boolean }) {
  return (
    <button
      onClick={() => onOpen(href)}
      className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {discord ? <MessageCircle className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}

// ⚠️ O ESTADO DO SERVIDOR NÃO É DESENHADO AQUI — e por isso a barra nem o recebe.
//
// Ele já era dito no painel da direita, em dois lugares que têm função própria:
// o rodapé com o ponto colorido (indicador permanente, ao lado do atalho do FC
// Hub) e o vazio da lista de amigos, que explica POR QUE ela está vazia. Esta
// faixa era a terceira menção da mesma coisa — e a mais barulhenta, porque
// atravessa a tela inteira. Com a VPS fora do ar, a tela dizia "servidor
// offline" três vezes ao mesmo tempo.
export function CommunityBar({
  config,
  tecnicosOnline,
  onOpen,
}: {
  config: LauncherConfig | null
  /** Quantos tecnicos estao no Ultrafoot agora (presenca da conta). `undefined`
   *  = deslogado ou sem rede: nesse caso a barra NAO diz "0 online", que pareceria
   *  jogo morto quando o problema e so nao termos como perguntar. */
  tecnicosOnline?: number
  onOpen: (url: string) => void
}) {
  const social = config?.social
  const hasSocial = Boolean(social && (social.discord || social.youtube || social.tiktok || social.instagram))
  const announcement = config?.announcement
  if (!announcement && !hasSocial && tecnicosOnline === undefined) return null

  return (
    <div className="flex flex-col">
      {announcement && (
        <div
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium md:px-6",
            announcement.level === "warning"
              ? "bg-accent/15 text-accent"
              : "bg-primary/10 text-primary",
          )}
        >
          <Megaphone className="h-4 w-4 shrink-0" />
          <span>{announcement.text}</span>
        </div>
      )}

      {(hasSocial || tecnicosOnline !== undefined) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/60 px-4 py-2 md:px-6">
          {/* QUEM ESTA NO JOGO AGORA, na barra de sempre. Antes esse numero so
              existia dentro da aba FC Hub — ou seja, era preciso ir procurar
              para descobrir que havia gente online. */}
          {tecnicosOnline !== undefined && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {tecnicosOnline === 1 ? "1 técnico no Ultrafoot" : `${tecnicosOnline} técnicos no Ultrafoot`}
            </span>
          )}

          {hasSocial && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {social?.discord && <SocialButton label="Discord" href={social.discord} onOpen={onOpen} discord />}
              {social?.youtube && <SocialButton label="YouTube" href={social.youtube} onOpen={onOpen} />}
              {social?.tiktok && <SocialButton label="TikTok" href={social.tiktok} onOpen={onOpen} />}
              {social?.instagram && <SocialButton label="Instagram" href={social.instagram} onOpen={onOpen} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
