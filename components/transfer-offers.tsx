"use client"

import { useMemo, useState } from "react"
import {
  DollarSign,
  Check,
  X,
  Clock,
  ArrowRightLeft,
  Building2,
  User,
  Calendar,
  TrendingUp,
  AlertCircle,
} from "lucide-react"
import { useGameEngine, type TransferOffer } from "@/lib/game-engine"
import { formatCurrency } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

export function TransferOffers() {
  const gameEngine = useGameEngine()
  
  const pendingOffers = useMemo(() => {
    return gameEngine.transferOffers.filter(o => o.status === "pendente")
  }, [gameEngine.transferOffers])
  
  const pastOffers = useMemo(() => {
    return gameEngine.transferOffers
      .filter(o => o.status !== "pendente")
      .slice(-10)
      .reverse()
  }, [gameEngine.transferOffers])
  
  const handleResponse = (offerId: number, accept: boolean) => {
    gameEngine.respondToOffer(offerId, accept)
  }
  
  if (pendingOffers.length === 0 && pastOffers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <ArrowRightLeft className="h-8 w-8 text-white/30" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Nenhuma oferta recebida</h3>
        <p className="text-sm text-white/50 max-w-md">
          Outros clubes podem fazer ofertas pelos seus jogadores durante a temporada.
          Continue jogando e avancando as semanas para receber propostas.
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Ofertas Pendentes */}
      {pendingOffers.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            Ofertas Pendentes ({pendingOffers.length})
          </h3>
          <div className="space-y-3">
            {pendingOffers.map(offer => (
              <OfferCard 
                key={offer.id} 
                offer={offer} 
                onAccept={() => handleResponse(offer.id, true)}
                onReject={() => handleResponse(offer.id, false)}
                onCounter={(amount,coverage,weeks) => gameEngine.counterTransferOffer(offer.id,amount,coverage,weeks)}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Historico de Ofertas */}
      {pastOffers.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Historico de Ofertas
          </h3>
          <div className="space-y-2">
            {pastOffers.map(offer => (
              <PastOfferRow key={offer.id} offer={offer} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function OfferCard({ 
  offer, 
  onAccept, 
  onReject 
  ,onCounter
}: { 
  offer: TransferOffer
  onAccept: () => void
  onReject: () => void 
  onCounter: (amount:number,coverage?:number,weeks?:number)=>"accepted"|"revised"|"rejected"
}) {
  const gameEngine = useGameEngine()
  const player = gameEngine.squadPlayers.find(p => p.id === offer.playerId)
  const [counterOpen,setCounterOpen]=useState(false)
  const [counterAmount,setCounterAmount]=useState(offer.offerAmount)
  const [coverage,setCoverage]=useState(offer.wageCoverage??100)
  const [weeks,setWeeks]=useState(offer.loanWeeks??26)
  
  return (
    <div className="rounded-xl bg-[#1a1a1a] border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-transparent border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#ffd700]/20 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{offer.fromTeam}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider">
              {offer.offerType === "compra" ? "Proposta de Compra" : "Proposta de Emprestimo"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-[var(--brand)]">
            {formatCurrency(offer.offerAmount)}
          </div>
          <div className="text-[10px] text-white/40">
            Expira em {offer.expiresWeek - gameEngine.currentWeek} semana(s)
          </div>
        </div>
      </div>
      
      {/* Player Info */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
            <User className="h-7 w-7 text-white/50" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold text-white">{offer.playerName}</div>
            <div className="flex items-center gap-3 text-xs text-white/50">
              {player && (
                <>
                  <span>{player.position}</span>
                  <span>{player.age} anos</span>
                  <span className="text-[var(--brand)]">OVR {player.overall}</span>
                </>
              )}
            </div>
          </div>
          {player && (
            <div className="text-right">
              <div className="text-xs text-white/40">Valor de mercado</div>
              <div className="text-sm font-medium text-white">{formatCurrency(player.marketValue)}</div>
            </div>
          )}
        </div>
        
        {/* Offer Details */}
        {offer.offerType === "emprestimo" && (
          <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg bg-white/[0.03]">
            <div>
              <div className="text-[10px] text-white/40 uppercase">Duracao</div>
              <div className="text-sm font-medium text-white">{offer.loanWeeks} semanas</div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase">Cobertura Salarial</div>
              <div className="text-sm font-medium text-white">{offer.wageCoverage}%</div>
            </div>
          </div>
        )}
        
        {/* Comparison */}
        {player && offer.offerType === "compra" && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] mb-4">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className={cn(
                "h-4 w-4",
                offer.offerAmount >= player.marketValue ? "text-[var(--brand)]" : "text-red-400"
              )} />
              <span className="text-white/60">
                {offer.offerAmount >= player.marketValue ? "Acima" : "Abaixo"} do valor de mercado
              </span>
            </div>
            <span className={cn(
              "text-sm font-bold",
              offer.offerAmount >= player.marketValue ? "text-[var(--brand)]" : "text-red-400"
            )}>
              {offer.offerAmount >= player.marketValue ? "+" : "-"}
              {formatCurrency(Math.abs(offer.offerAmount - player.marketValue))}
            </span>
          </div>
        )}
        
        {/* Actions */}
        {offer.counterMessage&&<div className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{offer.counterMessage}</div>}
        {counterOpen&&<div className="mb-3 grid gap-2 rounded-lg bg-black/30 p-3 sm:grid-cols-3"><label className="text-[10px] uppercase text-white/45">Valor solicitado<input type="number" min={0} step={100000} value={counterAmount} onChange={e=>setCounterAmount(Number(e.target.value))} className="mt-1 w-full rounded bg-white/10 p-2 text-sm text-white"/></label>{offer.offerType==="emprestimo"&&<><label className="text-[10px] uppercase text-white/45">Salário coberto %<input type="number" min={0} max={100} value={coverage} onChange={e=>setCoverage(Number(e.target.value))} className="mt-1 w-full rounded bg-white/10 p-2 text-sm text-white"/></label><label className="text-[10px] uppercase text-white/45">Semanas<input type="number" min={4} value={weeks} onChange={e=>setWeeks(Number(e.target.value))} className="mt-1 w-full rounded bg-white/10 p-2 text-sm text-white"/></label></>}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            <X className="h-4 w-4" />
            Recusar
          </button>
          <button onClick={()=>{if(!counterOpen){setCounterAmount(Math.max(offer.offerAmount,player?.marketValue??offer.offerAmount));setCounterOpen(true)}else{onCounter(counterAmount,coverage,weeks);setCounterOpen(false)}}} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-400/10 text-amber-300 text-sm font-medium hover:bg-amber-400/20">{counterOpen?"Enviar contraproposta":"Contraproposta"}</button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] text-sm font-semibold hover:bg-[var(--brand-2)] transition-colors"
          >
            <Check className="h-4 w-4" />
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}

function PastOfferRow({ offer }: { offer: TransferOffer }) {
  const statusConfig = {
    aceita: { label: "Aceita", color: "text-[var(--brand)]", bg: "bg-[var(--brand)]/10" },
    rejeitada: { label: "Rejeitada", color: "text-red-400", bg: "bg-red-400/10" },
    expirada: { label: "Expirada", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  }
  
  const config = statusConfig[offer.status as keyof typeof statusConfig] || statusConfig.expirada
  
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", config.bg)}>
        {offer.status === "aceita" ? (
          <Check className={cn("h-4 w-4", config.color)} />
        ) : offer.status === "rejeitada" ? (
          <X className={cn("h-4 w-4", config.color)} />
        ) : (
          <Clock className={cn("h-4 w-4", config.color)} />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{offer.playerName}</div>
        <div className="text-xs text-white/50">
          {offer.fromTeam} - {offer.offerType === "compra" ? "Compra" : "Emprestimo"}
        </div>
      </div>
      
      <div className="text-right">
        <div className="text-sm font-medium text-white">{formatCurrency(offer.offerAmount)}</div>
        <div className={cn("text-[10px] font-medium", config.color)}>{config.label}</div>
      </div>
    </div>
  )
}
