"use client"

// TELA DE ATUALIZACOES (Personalizar > Atualizacoes).
//
// ATE A 1.0.238 ISTO ERA UM PAINEL DE ESCOLHAS: tres canais (elencos, times,
// jogo), cada um com seu interruptor, mais consentimento de rede e "buscar
// automaticamente". O jogador montava a propria combinacao — e era comum acabar
// com uma build velha conversando com o servidor online de outra versao, ou com
// um manifesto de elencos de meses atras sobrescrevendo o elenco que veio no
// build novo.
//
// Agora ha uma coisa so: a BUILD, inteira, instalada pelo Ultrafoot Launcher.
// Elenco, time, liga e motor viajam juntos e na mesma versao. Nao ha pedaco para
// ligar ou desligar, entao esta tela deixou de ser um formulario e virou o que
// ela sempre deveria ter sido — a resposta para "estou atualizado?".

import { Download, ShieldCheck } from "lucide-react"
import { useVersaoDoJogo } from "@/lib/versao-do-jogo"

export function AtualizacoesPanel() {
  const versao = useVersaoDoJogo()

  return (
    <div className="space-y-6">
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

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-white/10 p-2.5">
            <Download className="h-5 w-5 text-white/70" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Tudo vem junto</h3>
            <p className="mt-1 text-sm text-white/60">
              Elencos, transferências oficiais, escudos, uniformes e participantes das
              competições fazem parte da build — não são mais pacotes separados. Isso
              garante que o que você joga e o que o servidor espera sejam sempre a mesma
              versão.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
