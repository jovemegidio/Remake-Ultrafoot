"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GameHeader } from "@/components/game-header"
import { useUserTeam } from "@/lib/save-system"
import { useNotifications, type Notification } from "@/components/notifications-system"
import { cn } from "@/lib/utils"
import { Bell, CheckCheck, Inbox, MessagesSquare, Trash2 } from "lucide-react"

/**
 * Central de Notificações — página, não mais painel lateral.
 *
 * O sino do cabeçalho abria um drawer que sumia a cada navegação e passava
 * despercebido: mensagens da diretoria e propostas ficavam sem resposta. Agora
 * é uma tela do menu, e o escritório redireciona para cá enquanto houver algo
 * não lido (ver components/pending-inbox-gate.tsx).
 */
export default function NotificacoesPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications()
  const [selecionada, setSelecionada] = useState<Notification | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.button === "B") {
        if (selecionada) setSelecionada(null)
        else router.back()
      }
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, selecionada])

  const formatarTempo = (data: Date) => {
    const mins = Math.floor((Date.now() - data.getTime()) / 60000)
    if (mins < 1) return "Agora"
    if (mins < 60) return `${mins}min atrás`
    const horas = Math.floor(mins / 60)
    if (horas < 24) return `${horas}h atrás`
    return `${Math.floor(horas / 24)}d atrás`
  }

  return (
    <div className="h-screen overflow-hidden bg-[#050508] pb-20 md:pb-0">
      <GameHeader team={userTeam} />

      <main className="flex h-[calc(100vh-48px-56px)] flex-col">
        <div className="border-b border-white/[0.04] bg-[#0d0d0d] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-white">
                <Bell className="h-5 w-5 text-[#00ffc8]" />
                Central de Notificações
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#00ffc8] px-2 py-0.5 text-[10px] font-black text-black">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="mt-0.5 text-xs text-white/50">
                Diretoria, comissão técnica, mercado e departamento médico.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:text-white"
                >
                  <CheckCheck className="h-3.5 w-3.5" />Marcar todas como lidas
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 rounded-lg border border-red-400/25 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Lista */}
          <div className="overflow-y-auto pr-1 scrollbar-game">
            {notifications.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/35">
                <Bell className="h-12 w-12" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {notifications.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { markAsRead(item.id); setSelecionada(item) }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                      selecionada?.id === item.id
                        ? "border-[#00ffc8]/50 bg-[#00ffc8]/[0.07]"
                        : item.read
                          ? "border-white/[0.05] bg-[#0c0c10] hover:border-white/15"
                          : "border-white/15 bg-[#101018] hover:border-white/25",
                    )}
                  >
                    <span className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      item.read ? "bg-white/15" : "bg-[#00ffc8]",
                    )} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", item.read ? "text-white/70" : "font-semibold text-white")}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-white/45">{item.message}</span>
                      <span className="mt-1 block text-[10px] text-white/30">{formatarTempo(item.timestamp)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detalhe */}
          <div className="overflow-y-auto scrollbar-game">
            {selecionada ? (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#00ffc8]">Central do clube</p>
                <h2 className="mt-2 text-xl font-bold text-white">{selecionada.title}</h2>
                <p className="mt-1 text-xs text-white/40">{formatarTempo(selecionada.timestamp)}</p>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/75">{selecionada.message}</p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {selecionada.action && (
                    <button
                      onClick={selecionada.action.onClick}
                      className="rounded-lg bg-[#00ffc8] px-4 py-2 text-xs font-bold text-black"
                    >
                      {selecionada.action.label}
                    </button>
                  )}
                  <button
                    onClick={() => { removeNotification(selecionada.id); setSelecionada(null) }}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 hover:text-white"
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-white/[0.05] bg-[#0c0c10] p-8 text-center">
                <Inbox className="h-10 w-10 text-white/15" />
                <p className="text-sm text-white/40">Selecione uma notificação para ler</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => router.push("/mensagens")}
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white"
                  >
                    <Inbox className="h-3.5 w-3.5" />Caixa de entrada
                  </button>
                  <button
                    onClick={() => router.push("/mensagens?tab=atletas")}
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:text-white"
                  >
                    <MessagesSquare className="h-3.5 w-3.5" />Conversas com atletas
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
