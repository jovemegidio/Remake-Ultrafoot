"use client"

// AVISO DE ATUALIZAÇÃO DE ELENCO — o "squad update" do EA FC, dentro do jogo.
//
// O QUE ELE RESOLVE: corrigir uma transferência, um escudo ou licenciar o rosto
// de um elenco inteiro exigia publicar o jogo todo (mais de meio giga) e esperar
// cada jogador atualizar. Aqui a correção chega em poucos KB, e — o ponto que o
// pedido fez questão — SEM MEXER NA VERSÃO DO JOGO: o pacote tem numeração
// própria, então quem está na 1.0.243 continua na 1.0.243 depois de aplicar.
//
// TRÊS DECISÕES QUE NÃO SÃO ÓBVIAS LENDO O CÓDIGO:
//
//  1. NÃO usa o sistema de notificações do jogo (components/notifications-system).
//     Aquele é escopado por CARREIRA (`getCareerScopedKey`) e some quando o
//     jogador troca de save; uma correção de elenco é global e precisa aparecer
//     inclusive no menu principal, antes de existir carreira nenhuma.
//  2. NÃO aparece durante a partida nem no meio da criação de carreira. Aplicar
//     um pacote ali dentro trocaria o elenco embaixo do jogo em andamento.
//  3. Aplicar NÃO recarrega sozinho. A gravação já aconteceu e vale para sempre;
//     recarregar é só para ver na hora, e é escolha de quem está jogando — pode
//     estar no meio de uma negociação.

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Download, RefreshCw, Users, X } from "lucide-react"
import {
  aplicarAtualizacao,
  consultarServidor,
  dispensarVersao,
  foiDispensada,
  getAtualizacao,
  guardarFotosLocalmente,
  resumir,
  type AtualizacaoElencos,
} from "@/lib/atualizacao-elencos"
import { storeGet, storeSet } from "@/lib/persistent-store"

/** Telas em que o aviso não pode interromper. */
const ROTAS_SILENCIOSAS = ["/partida", "/analise-partida", "/splash", "/novo-jogo", "/editar"]

const CHAVE_ULTIMA_CONSULTA = "ultrafoot:atualizacao-elencos:ultima-consulta"
/** Uma consulta a cada 4 horas basta: correção de elenco não sai de hora em hora. */
const INTERVALO_MS = 4 * 60 * 60 * 1000
/** Respiro depois do boot — a tela inicial não divide atenção com isto. */
const ESPERA_INICIAL_MS = 7000

// O layout não desmonta ao navegar, mas um remonte (hot reload, troca de tema)
// não pode virar uma segunda consulta na mesma sessão.
let jaConsultou = false

function podeConsultar(): boolean {
  if (jaConsultou) return false
  const ultima = Number(storeGet(CHAVE_ULTIMA_CONSULTA) ?? 0)
  return !ultima || Date.now() - ultima > INTERVALO_MS
}

export function AvisoAtualizacaoElencos() {
  const pathname = usePathname()
  const [pacote, setPacote] = useState<AtualizacaoElencos | null>(null)
  const [estado, setEstado] = useState<"oferecendo" | "aplicando" | "aplicado">("oferecendo")
  const [fotos, setFotos] = useState<{ feitas: number; total: number } | null>(null)

  useEffect(() => {
    if (!podeConsultar()) return
    let vivo = true
    const alarme = setTimeout(() => {
      jaConsultou = true
      storeSet(CHAVE_ULTIMA_CONSULTA, String(Date.now()))
      void consultarServidor()
        .then(novo => {
          if (!vivo || !novo) return
          // Já tenho esta versão, ou já disse "agora não" para ela.
          if (novo.versao <= getAtualizacao().versao) return
          if (foiDispensada(novo.versao)) return
          setPacote(novo)
        })
        .catch(() => { /* sem rede: silêncio, como o resto do canal */ })
    }, ESPERA_INICIAL_MS)
    return () => { vivo = false; clearTimeout(alarme) }
  }, [])

  if (!pacote) return null
  if (ROTAS_SILENCIOSAS.some(r => pathname?.startsWith(r))) return null

  const r = resumir(pacote)
  const partes = [
    r.clubes ? `${r.clubes} ${r.clubes === 1 ? "clube" : "clubes"}` : "",
    r.jogadores ? `${r.jogadores} ${r.jogadores === 1 ? "atleta" : "atletas"}` : "",
    r.transferencias ? `${r.transferencias} ${r.transferencias === 1 ? "transferência" : "transferências"}` : "",
    r.fotos ? `${r.fotos} ${r.fotos === 1 ? "foto" : "fotos"}` : "",
  ].filter(Boolean)

  async function baixar() {
    if (!pacote) return
    setEstado("aplicando")
    // Gravação síncrona: quando isto volta, o pacote já está no disco e o elenco
    // já vale. As fotos vêm depois porque são o pedaço lento.
    aplicarAtualizacao(pacote)
    // Guardar os retratos é o que faz a atualização valer OFFLINE também: eles
    // chegam como URL remota, e sem a cópia sumiriam quando faltasse internet.
    await guardarFotosLocalmente(pacote, (feitas, total) => setFotos({ feitas, total }))
    setFotos(null)
    setEstado("aplicado")
  }

  function agoraNao() {
    if (pacote) dispensarVersao(pacote.versao)
    setPacote(null)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="fixed bottom-4 right-4 z-[70] w-[min(24rem,calc(100vw-2rem))]"
      >
        <div className="rounded-xl border border-[var(--brand)]/30 bg-[#0a0e1a]/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[var(--brand)]/15 p-2">
              <Users className="h-5 w-5 text-[var(--brand)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white">
                {estado === "aplicado" ? "Elenco atualizado" : "Atualização de elenco disponível"}
              </h3>

              {estado === "aplicado" ? (
                <p className="mt-1 text-xs text-white/60">
                  Já está salvo, e vale offline. Recarregue para ver agora, ou continue
                  jogando — na próxima vez que abrir, já estará aplicado.
                </p>
              ) : fotos ? (
                <p className="mt-1 text-xs text-white/60">
                  Guardando as fotos para funcionar sem internet… {fotos.feitas}/{fotos.total}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-white/60">
                    {partes.length ? partes.join(" · ") : "Correções de dados"}
                    {pacote.notas ? ` — ${pacote.notas}` : ""}
                  </p>
                  <p className="mt-1.5 text-[11px] text-white/40">
                    Pacote v{pacote.versao}. Não altera a versão do jogo.
                  </p>
                </>
              )}

              <div className="mt-3 flex items-center gap-2">
                {estado === "aplicado" ? (
                  <>
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink)] transition hover:brightness-110"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Recarregar
                    </button>
                    <button
                      onClick={() => setPacote(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition hover:text-white"
                    >
                      Depois
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={baixar}
                      disabled={estado === "aplicando"}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-ink)] transition hover:brightness-110 disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {estado === "aplicando" ? "Aplicando..." : "Baixar"}
                    </button>
                    <button
                      onClick={agoraNao}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition hover:text-white"
                    >
                      Agora não
                    </button>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => setPacote(null)}
              aria-label="Fechar"
              className="rounded p-1 text-white/40 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
