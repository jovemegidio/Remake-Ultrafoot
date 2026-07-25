"use client"

import { cn } from "@/lib/utils"
import type { LauncherConfig, ServerStatus } from "@/lib/launcher-bridge"
import { MessageCircle, ExternalLink, Megaphone } from "lucide-react"

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

export function CommunityBar({
  config,
  serverStatus,
  onOpen,
}: {
  config: LauncherConfig | null
  serverStatus: ServerStatus | null
  onOpen: (url: string) => void
}) {
  const social = config?.social
  const hasSocial = Boolean(social && (social.discord || social.youtube || social.tiktok || social.instagram))
  const announcement = config?.announcement
  if (!announcement && !hasSocial && !serverStatus) return null

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

      {(hasSocial || serverStatus) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/60 px-4 py-2 md:px-6">
          {serverStatus && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  serverStatus.online ? "bg-primary" : "bg-destructive",
                )}
              />
              Servidor {serverStatus.online ? "online" : "offline"}
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
