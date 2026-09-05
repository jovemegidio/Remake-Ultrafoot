"use client"

import { safeLocalSet } from "@/lib/safe-storage"
import { useEffect, useState } from "react"
import { LinkLeve as Link } from "@/components/link-leve"
import { ShieldCheck } from "lucide-react"
import { ACCEPTANCE_KEY, LEGAL_VERSION } from "@/lib/legal"

export function LegalConsent({ onAccepted }: { onAccepted: () => void }) {
  const [ready, setReady] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(ACCEPTANCE_KEY)
    if (stored === LEGAL_VERSION) { setAccepted(true); onAccepted() }
    setReady(true)
  }, [onAccepted])

  if (!ready || accepted) return null
  return <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm">
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#101215] p-6 shadow-2xl">
      <ShieldCheck className="h-9 w-9 text-[var(--brand)]" />
      <h1 className="uf-heading mt-3 text-xl font-black text-white">Antes de jogar</h1>
      <p className="mt-2 text-sm leading-6 text-white/65">Para usar o Ultrafoot 26, leia e aceite os Termos de Uso e a Política de Privacidade. O uso de automação, coleta em massa ou tentativa de contornar os serviços online é proibido.</p>
      <div className="mt-4 flex gap-4 text-sm font-semibold text-[var(--brand)]"><Link href="/legal/" target="_blank">Ler termos e privacidade</Link><Link href="/legal/#uso" target="_blank">Regras de uso</Link></div>
      <button onClick={() => { safeLocalSet(ACCEPTANCE_KEY, LEGAL_VERSION); setAccepted(true); onAccepted() }} className="mt-6 w-full rounded-lg bg-[var(--brand)] px-4 py-3 text-sm font-black text-[var(--brand-ink)] hover:bg-[#42ffe0]">Aceito os termos</button>
    </div>
  </div>
}
