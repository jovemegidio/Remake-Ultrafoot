"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bell, Clock, DollarSign, Goal, Info, Mail, Search, Star, Trash2, Trophy, X, Zap } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useNotifications, type Notification } from "@/components/notifications-system"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { useGameEngine } from "@/lib/game-engine"
import { acceptOffer, counterSponsorOffer, generateOffers } from "@/lib/sponsor-engine"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"

type MessageFilter = "all" | "unread" | "important"

const notificationIcons = {
  goal: Goal,
  match_start: Clock,
  match_end: Trophy,
  transfer: DollarSign,
  injury: AlertTriangle,
  achievement: Star,
  news: Zap,
  system: Info,
} satisfies Record<Notification["type"], typeof Bell>

function formatDate(value: Date) {
  if (Number.isNaN(value.getTime())) return "Data não disponível"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value)
}

export default function MensagensPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  const { state: saveState, setState: setSaveState } = useGameState()
  const gameEngine = useGameEngine()
  const { notifications, unreadCount, markAsRead, removeNotification } = useNotifications()
  const sponsorOffers = saveState.sponsorOffers ?? []
  const [filter, setFilter] = useState<MessageFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [counteringSponsor, setCounteringSponsor] = useState<string | null>(null)
  const [counterMonthly, setCounterMonthly] = useState(0)
  const [counterDuration, setCounterDuration] = useState(2)

  useEffect(() => {
    if (saveState.selectedTeamShort && saveState.sponsorOffers === undefined) {
      setSaveState({ sponsorOffers: generateOffers(userTeam.prestigio, 1, saveState.season ?? 2026), activeSponsors: saveState.activeSponsors ?? [] })
    }
  }, [saveState.selectedTeamShort, saveState.sponsorOffers, saveState.activeSponsors, setSaveState, userTeam.prestigio])

  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent).detail?.button === "B") router.back()
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router])

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("pt-BR")
    return notifications.filter(notification => {
      if (filter === "unread" && notification.read) return false
      if (filter === "important" && !["high", "urgent"].includes(notification.priority ?? "low")) return false
      return !query || `${notification.title} ${notification.message}`.toLocaleLowerCase("pt-BR").includes(query)
    })
  }, [filter, notifications, searchQuery])

  const selectedMessage = notifications.find(notification => notification.id === selectedId) ?? filteredMessages[0] ?? null

  const selectMessage = (notification: Notification) => {
    setSelectedId(notification.id)
    if (!notification.read) markAsRead(notification.id)
  }

  const deleteMessage = (id: string) => {
    removeNotification(id)
    if (selectedId === id) setSelectedId(null)
  }

  const acceptSponsor = (id: string) => {
    const offer = sponsorOffers.find(item => item.sponsor.id === id)
    if (!offer) return
    setSaveState({
      activeSponsors: acceptOffer(offer, saveState.activeSponsors ?? []),
      sponsorOffers: sponsorOffers.filter(item => item.sponsor.id !== id),
    })
    gameEngine.addClubRevenue(offer.sponsor.monthlyValue)
  }

  const counterSponsor = (id: string) => {
    const offer = sponsorOffers.find(item => item.sponsor.id === id)
    if (!offer) return
    const result = counterSponsorOffer(offer, counterMonthly, counterDuration)
    setSaveState({ sponsorOffers: sponsorOffers.map(item => item.sponsor.id === id ? result.offer : item) })
    setCounteringSponsor(null)
  }

  return (
    <div className="h-screen bg-transparent flex flex-col overflow-hidden pb-20 md:pb-0">
      <GameHeader team={userTeam} />
      <main className="flex-1 overflow-y-auto p-4">
        {sponsorOffers.some(offer => offer.status !== "rejected") && (
          <section className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
            <h2 className="font-bold text-amber-200">Propostas comerciais recebidas</h2>
            <p className="mt-1 text-xs text-white/45">Os contratos aceitos entram na receita mensal do clube.</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {sponsorOffers.filter(offer => offer.status !== "rejected").map(offer => (
                <div key={offer.sponsor.id} className="rounded-lg bg-black/30 p-3">
                  <div className="flex justify-between gap-2"><b>{offer.sponsor.name}</b><span className="text-[var(--brand)]">{formatCurrency(offer.sponsor.monthlyValue)}/mês</span></div>
                  <p className="mt-1 text-[11px] text-white/45">{offer.durationSeasons} temporada(s) · bônus por título {formatCurrency((offer.sponsor.bonuses.titleBonus ?? 0))}</p>
                  {offer.message && <p className="mt-2 text-xs text-amber-200">{offer.message}</p>}
                  {counteringSponsor === offer.sponsor.id && <div className="mt-2 grid grid-cols-2 gap-2"><input aria-label="Valor mensal da contraproposta" type="number" value={counterMonthly} onChange={event => setCounterMonthly(Number(event.target.value))} className="rounded bg-white/10 p-2 text-xs" /><input aria-label="Duração da contraproposta" type="number" min={1} max={5} value={counterDuration} onChange={event => setCounterDuration(Number(event.target.value))} className="rounded bg-white/10 p-2 text-xs" /></div>}
                  <div className="mt-3 flex gap-2"><button onClick={() => acceptSponsor(offer.sponsor.id)} className="flex-1 rounded bg-[var(--brand)] px-2 py-1.5 text-xs font-bold text-[var(--brand-ink)]">Aceitar</button><button onClick={() => { if (counteringSponsor === offer.sponsor.id) counterSponsor(offer.sponsor.id); else { setCounteringSponsor(offer.sponsor.id); setCounterMonthly(Math.round(offer.sponsor.monthlyValue * 1.1)); setCounterDuration(offer.durationSeasons) } }} className="flex-1 rounded bg-amber-400/15 px-2 py-1.5 text-xs text-amber-200">{counteringSponsor === offer.sponsor.id ? "Enviar" : "Contraproposta"}</button></div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-1">
            <div><h1 className="uf-heading text-2xl font-semibold text-white">Mensagens da carreira</h1><p className="mt-1 text-sm text-white/50">{unreadCount} não lidas</p></div>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Buscar mensagens..." className="h-10 w-full rounded-lg border border-white/10 bg-[#1a1a1a] pl-10 pr-9 text-sm text-white" />{searchQuery && <button aria-label="Limpar busca" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"><X className="h-4 w-4" /></button>}</div>
            <div className="grid grid-cols-3 gap-2">
              {([['all', 'Todas'], ['unread', 'Não lidas'], ['important', 'Importantes']] as const).map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={cn("rounded-lg border px-2 py-2 text-xs", filter === id ? "border-[var(--brand)] bg-[var(--brand)]/10 text-white" : "border-white/10 bg-[#1a1a1a] text-white/50")}>{label}</button>)}
            </div>
            <div className="max-h-[calc(100vh-310px)] space-y-2 overflow-y-auto">
              {filteredMessages.length === 0 ? <div className="rounded-xl border border-white/[0.04] bg-[var(--uf-bg-surface)] p-8 text-center"><Mail className="mx-auto mb-3 h-10 w-10 text-white/20" /><p className="text-sm text-white/50">Nenhuma mensagem real registrada nesta carreira.</p></div> : filteredMessages.map(notification => {
                const Icon = notificationIcons[notification.type]
                return <button key={notification.id} onClick={() => selectMessage(notification)} className={cn("w-full rounded-xl border p-4 text-left", selectedMessage?.id === notification.id ? "border-[var(--brand)] bg-[var(--brand)]/5" : "border-white/[0.04] bg-[var(--uf-bg-surface)]", !notification.read && "bg-[var(--brand)]/5")}><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5"><Icon className="h-5 w-5 text-[var(--brand)]" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className={cn("truncate text-sm", !notification.read ? "font-semibold text-white" : "text-white/70")}>{notification.title}</span>{!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />}</div><p className="mt-1 truncate text-xs text-white/45">{notification.message}</p><p className="mt-1 text-[10px] text-white/30">{formatDate(notification.timestamp)}</p></div></div></button>
              })}
            </div>
          </section>

          <section className="lg:col-span-2">
            {selectedMessage ? <div className="h-full overflow-hidden rounded-xl border border-white/[0.04] bg-[var(--uf-bg-surface)]"><div className="flex items-center justify-between gap-3 border-b border-white/[0.04] px-6 py-4"><div><h2 className="text-lg font-semibold text-white">{selectedMessage.title}</h2><p className="mt-1 flex items-center gap-1 text-xs text-white/40"><Clock className="h-3 w-3" />{formatDate(selectedMessage.timestamp)}</p></div><Button variant="ghost" size="icon" onClick={() => deleteMessage(selectedMessage.id)} className="text-white/50 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button></div><div className="p-6"><p className="whitespace-pre-line leading-relaxed text-white/80">{selectedMessage.message}</p><div className="mt-8 flex gap-3 border-t border-white/[0.04] pt-6">{selectedMessage.href && <Button onClick={() => router.push(selectedMessage.href!)} className="bg-[var(--brand)] text-[var(--brand-ink)]">Abrir área relacionada</Button>}<Button variant="outline" onClick={() => deleteMessage(selectedMessage.id)} className="border-white/10 bg-transparent text-white/70"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></div></div></div> : <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-xl border border-white/[0.04] bg-[var(--uf-bg-surface)] p-12 text-center"><Bell className="mb-4 h-16 w-16 text-white/20" /><h3 className="font-semibold text-white">Caixa de entrada vazia</h3><p className="mt-2 text-sm text-white/50">Os eventos reais da sua carreira aparecerão aqui.</p></div>}
          </section>
        </div>
      </main>
    </div>
  )
}
