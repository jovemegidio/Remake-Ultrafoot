"use client"

// TELA DE ATUALIZACOES (Personalizar > Atualizacoes).
//
// SAO DUAS COISAS DIFERENTES, e a tela existe principalmente para nao confundi-las:
//
//   A BUILD  — o jogo em si (motor, telas, correcoes). Vem inteira, pelo Ultrafoot
//              Launcher, e nao ha o que configurar aqui.
//   O PACOTE — elenco, transferencia, escudo, uniforme e retrato de atleta. Tem
//              numeracao PROPRIA e chega em poucos KB, sem reinstalar nada e sem
//              mexer na versao do jogo.
//
// Ate a 1.0.238 isto era um formulario de tres canais com consentimento de rede,
// e dava para montar combinacoes que se contradiziam. Na 1.0.240 o pacote foi
// desligado inteiro (um pacote velho sobrescrevia o elenco de uma build nova).
// Agora ele volta com a trava de data em lib/atualizacao-elencos, e o que sobra
// aqui e so: em que pe estou, e quero receber isso?

import { useCallback, useEffect, useState } from "react"
import { Download, RefreshCw, ShieldCheck, Users } from "lucide-react"
import { useVersaoDoJogo } from "@/lib/versao-do-jogo"
import {
  aplicarAtualizacao,
  consultarServidor,
  getAtualizacao,
  guardarFotosLocalmente,
  resumir,
  type AtualizacaoElencos,
} from "@/lib/atualizacao-elencos"
import { canalAtivo, setCanal, EVENTO_PREFERENCIAS } from "@/lib/atualizacoes-preferencias"

type Busca = "parado" | "buscando" | "guardando" | "atualizado" | "aplicado" | "sem-rede"

export function AtualizacoesPanel() {
  const versao = useVersaoDoJogo()
  const [versaoPacote, setVersaoPacote] = useState(0)
  const [canais, setCanais] = useState({ elencos: true, times: true })
  const [busca, setBusca] = useState<Busca>("parado")
  const [encontrado, setEncontrado] = useState<AtualizacaoElencos | null>(null)
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null)

  // Leitura só depois da montagem: o store do Tauri hidrata assíncrono, e ler no
  // render daria divergência entre o HTML pré-renderizado e a tela.
  const sincronizar = useCallback(() => {
    setVersaoPacote(getAtualizacao().versao)
    setCanais({ elencos: canalAtivo("elencos"), times: canalAtivo("times") })
  }, [])

  useEffect(() => {
    sincronizar()
    window.addEventListener(EVENTO_PREFERENCIAS, sincronizar)
    return () => window.removeEventListener(EVENTO_PREFERENCIAS, sincronizar)
  }, [sincronizar])

  async function buscar() {
    setBusca("buscando")
    const novo = await consultarServidor()
    if (!novo) { setBusca("sem-rede"); return }
    if (novo.versao <= getAtualizacao().versao) { setBusca("atualizado"); return }
    setEncontrado(novo)
    setBusca("parado")
  }

  async function aplicar() {
    if (!encontrado) return
    const pacote = encontrado
    aplicarAtualizacao(pacote)
    setEncontrado(null)
    sincronizar()
    // Sem a cópia local, o retrato aparece com internet e some sem ela.
    setBusca("guardando")
    await guardarFotosLocalmente(pacote, (feitas, total) => setProgresso({ feitas, total }))
    setProgresso(null)
    setBusca("aplicado")
  }

  const r = encontrado ? resumir(encontrado) : null

  return (
    <div className="space-y-6">
      {/* ─── A build ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-[var(--brand)]/15 p-2.5">
            <ShieldCheck className="h-5 w-5 text-[var(--brand)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Você está na versão {versao}</h3>
            <p className="mt-1 text-sm text-white/60">
              O Ultrafoot Launcher mantém o jogo sempre na última versão publicada. A
              atualização é baixada e instalada automaticamente ao abrir o launcher —
              não há nada para configurar aqui.
            </p>
          </div>
        </div>
      </div>

      {/* ─── O pacote de elencos ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-white/10 p-2.5">
            <Users className="h-5 w-5 text-white/70" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white">
              Atualização de elenco {versaoPacote > 0 ? `· pacote v${versaoPacote}` : ""}
            </h3>
            <p className="mt-1 text-sm text-white/60">
              Transferências, elencos corrigidos, escudos, uniformes e rostos de
              atletas chegam em poucos KB, sem reinstalar o jogo.{" "}
              <span className="text-white/45">A versão do jogo não muda.</span>
            </p>

            {encontrado && r ? (
              <div className="mt-3 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-3">
                <p className="text-sm font-medium text-white">
                  Pacote v{encontrado.versao} disponível
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  {[
                    r.clubes ? `${r.clubes} clubes` : "",
                    r.jogadores ? `${r.jogadores} atletas` : "",
                    r.transferencias ? `${r.transferencias} transferências` : "",
                    r.fotos ? `${r.fotos} fotos` : "",
                  ].filter(Boolean).join(" · ") || "Correções de dados"}
                  {encontrado.notas ? ` — ${encontrado.notas}` : ""}
                </p>
                <button
                  onClick={aplicar}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink)] transition hover:brightness-110"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar e aplicar
                </button>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={buscar}
                disabled={busca === "buscando"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busca === "buscando" ? "animate-spin" : ""}`} />
                {busca === "buscando" ? "Procurando..." : "Procurar agora"}
              </button>
              {busca === "guardando" && (
                <span className="text-xs text-white/50">
                  Guardando as fotos para funcionar sem internet
                  {progresso ? ` — ${progresso.feitas}/${progresso.total}` : "…"}
                </span>
              )}
              {busca === "atualizado" && (
                <span className="text-xs text-white/50">Você já está com o pacote mais recente.</span>
              )}
              {busca === "aplicado" && (
                <span className="text-xs text-[var(--brand)]">
                  Aplicado. Recarregue o jogo para ver na hora.
                </span>
              )}
              {busca === "sem-rede" && (
                <span className="text-xs text-white/50">
                  Não foi possível falar com o servidor agora.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── O que aceitar ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-base font-semibold text-white">O que você quer receber</h3>
        <p className="mt-1 text-sm text-white/60">
          Desligar não apaga nada do que já foi baixado — o jogo apenas volta a usar o
          que veio na build. Religar devolve tudo na hora, sem baixar de novo.
        </p>
        <div className="mt-4 space-y-3">
          <Interruptor
            titulo="Elencos e transferências"
            detalhe="Atletas, mudanças de clube e rostos licenciados."
            ligado={canais.elencos}
            aoTrocar={v => setCanal("elencos", v)}
          />
          <Interruptor
            titulo="Times e competições"
            detalhe="Escudo, uniforme, cores, estádio e participantes."
            ligado={canais.times}
            aoTrocar={v => setCanal("times", v)}
          />
        </div>
      </div>
    </div>
  )
}

function Interruptor({
  titulo,
  detalhe,
  ligado,
  aoTrocar,
}: {
  titulo: string
  detalhe: string
  ligado: boolean
  aoTrocar: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => aoTrocar(!ligado)}
      role="switch"
      aria-checked={ligado}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{titulo}</span>
        <span className="mt-0.5 block text-xs text-white/50">{detalhe}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${ligado ? "bg-[var(--brand)]" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${ligado ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  )
}
