"use client"

import Link from "next/link"
import { ArrowLeft, Scale, ShieldCheck } from "lucide-react"
import { LEGAL_CONTACT, LEGAL_VERSION, PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal"

function Section({ title, paragraphs }: { title: string; paragraphs: readonly (readonly [string, string])[] }) {
  return <section className="mt-8"><h2 className="text-xl font-black text-white">{title}</h2><div className="mt-4 space-y-4">{paragraphs.map(([heading, content]) => <article key={heading} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-bold text-[var(--brand)]">{heading}</h3><p className="mt-2 text-sm leading-6 text-white/70">{content}</p></article>)}</div></section>
}

export default function LegalPage() {
  return <main className="min-h-screen bg-[#07090c] px-5 py-8 text-white"><div className="mx-auto max-w-3xl"><Link href="/splash/?menu=1" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar ao jogo</Link><header className="mt-8 rounded-2xl border border-[var(--brand)]/25 bg-gradient-to-br from-[#0c302a] to-[#101215] p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-9 w-9 text-[var(--brand)]" /><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--brand)]">Ultrafoot 26</p><h1 className="text-2xl font-black">Termos, privacidade e uso aceitável</h1></div></div><p className="mt-4 text-sm leading-6 text-white/70">Vigência: {LEGAL_VERSION}. Este texto é uma base operacional do jogo e deve ser revisado por assessoria jurídica antes de comercialização.</p></header><Section title="Termos de Uso" paragraphs={TERMS_OF_USE} /><section id="uso" className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5"><div className="flex gap-3"><Scale className="h-5 w-5 shrink-0 text-amber-300" /><div><h2 className="font-black text-white">Uso aceitável e proteção contra scraping</h2><p className="mt-2 text-sm leading-6 text-white/70">É proibido usar bots, crawlers, scripts ou engenharia de tráfego para copiar conteúdo, enumerar salas, extrair bancos do serviço, sobrecarregar endpoints ou burlar limites. O jogo aplica limite de requisições e de mensagens no serviço online; violações podem resultar em bloqueio.</p></div></div></section><Section title="Política de Privacidade" paragraphs={PRIVACY_POLICY} /><p className="my-8 text-xs text-white/40">Contato: {LEGAL_CONTACT}</p></div></main>
}
