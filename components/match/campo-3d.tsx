"use client"

/**
 * CAMPO 3D — a partida vista pelo Pitch Engine PRO (partida-3d/motor.js).
 *
 * ARQUITETURA, e por que ela é assim:
 *
 * O 3D **encena**, não simula. Quem decide gol, cartão e placar continua sendo
 * o `match-engine` — o mesmo calibrado em 20 mil partidas, com táticas, funções
 * individuais e bolas paradas. O motor 3D recebe os eventos já decididos e os
 * põe em cena.
 *
 * Não é preferência: é aritmética, e está documentada no próprio motor. Numa
 * RTX 3060 a 60 fps o 3D produz ~7,6 segundos de jogo por segundo real; o 2D
 * produz 120. Nenhum multiplicador fecha essa conta. Encenando, a velocidade
 * dos dois deixa de precisar bater.
 *
 * FALLBACK É OBRIGATÓRIO. Este componente virou a forma padrão de assistir, e
 * WebGL falha por motivos que não controlamos: driver antigo, GPU sem suporte,
 * máquina virtual, aba sem aceleração. Se o motor não subir, quem chama recebe
 * `aoFalhar` e volta para o radar 2D — o jogador nunca pode ficar sem partida
 * porque a placa de vídeo não colaborou.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AlertTriangle } from "lucide-react"
import { performanceStore } from "@/components/performance-profile"
import type { EventoParaEncenar, Motor, QualidadeMotor } from "@/partida-3d/partida-3d/motor"
import { getFormationSlots } from "@/lib/formations"

export interface Campo3DProps {
  /** Eventos do match-engine, do mais NOVO para o mais antigo (como no state). */
  eventos: { id: string; tipo: string; lado: "home" | "away"; minuto?: number }[]
  /** Multiplicador de velocidade da cena (não afeta o relógio do jogo). */
  velocidade?: number
  pausado?: boolean
  formacao?: string
  casa: { nome: string; sigla: string; corPrincipal: string; corSecundaria: string }
  fora: { nome: string; sigla: string; corPrincipal: string; corSecundaria: string }
  /**
   * Chamado quando o 3D não pode ser usado. Quem chama DEVE mostrar o 2D.
   * Recebe o motivo para a mensagem — o jogador merece saber por que trocou.
   */
  aoFalhar: (motivo: string) => void
}

/**
 * O perfil de desempenho do jogo manda na qualidade da cena.
 *
 * ⚠️ `balanced` apontava para `high` — e `balanced` é o PADRÃO de quem nunca
 * mexeu nas configurações, ou seja, quase todo mundo. Pelos números do próprio
 * motor isso é a diferença entre **64 mil tufos de grama com sombra 4096**
 * (`high`) e **22 mil com sombra 1024** (`mid`). O jogador do perfil
 * "equilibrado" estava rodando a cena mais pesada que o motor sabe montar, e o
 * sintoma era travamento durante a partida.
 *
 * Equilibrado é para EQUILIBRAR: `mid`. Quem quiser a cena cheia escolhe
 * "Qualidade máxima" nas configurações e assume o custo.
 */
const QUALIDADE_POR_PERFIL: Record<string, QualidadeMotor> = {
  economy: "low",
  balanced: "mid",
  quality: "high",
}

export function Campo3D({ eventos, velocidade = 1, pausado = false, formacao = "4-3-3", casa, fora, aoFalhar }: Campo3DProps) {
  const palco = useRef<HTMLDivElement | null>(null)
  const motor = useRef<Motor | null>(null)
  const [progresso, setProgresso] = useState({ pct: 0, etapa: "preparando" })
  const [pronto, setPronto] = useState(false)
  const fila = useRef<typeof eventos>([])
  const temporizadorDaFila = useRef<number | null>(null)
  const velocidadeAtual = useRef(velocidade)
  const perfil = useSyncExternalStore(
    performanceStore.subscribe,
    performanceStore.getSnapshot,
    performanceStore.getServerSnapshot,
  )

  // `aoFalhar` numa ref: se ele entrasse nas dependências do efeito de montagem,
  // uma função recriada a cada render destruiria e remontaria a cena WebGL —
  // que é exatamente o vazamento que o motor foi convertido para evitar.
  const falhar = useRef(aoFalhar)
  falhar.current = aoFalhar

  // ── Montagem: UMA vez por tela ────────────────────────────────────────────
  useEffect(() => {
    const alvo = palco.current
    if (!alvo) return
    let vivo = true

    // Importação dinâmica: o `three` e o motor somam alguns MB e não podem
    // entrar no bundle de quem nunca abre uma partida.
    void import("@/partida-3d/partida-3d/motor")
      .then(({ criarMotor }) => {
        if (!vivo) return
        const instancia = criarMotor({
          palco: alvo,
          qualidade: QUALIDADE_POR_PERFIL[perfil] ?? "mid",
          casa,
          fora,
          aoProgredir: (pct, etapa) => { if (vivo) setProgresso({ pct, etapa }) },
          aoIniciar: () => { if (vivo) setPronto(true) },
          aoFalhar: (erro) => { if (vivo) falhar.current(erro.message) },
        })
        instancia.definirFormacao(getFormationSlots(formacao))
        motor.current = instancia
        return instancia.iniciar()
      })
      .catch((erro: Error) => {
        // Falha ao BAIXAR o módulo (chunk faltando no export estático, disco
        // podado pelo instalador) cai aqui, não no `aoFalhar` do motor.
        if (vivo) falhar.current(erro.message || "não foi possível carregar o motor 3D")
      })

    return () => {
      vivo = false
      // Sem isto a WebGL fica viva ao sair da tela e voltar cria um SEGUNDO
      // motor — dois contextos disputando a GPU até o navegador derrubar os dois.
      motor.current?.destruir()
      motor.current = null
      if (temporizadorDaFila.current !== null) window.clearTimeout(temporizadorDaFila.current)
      temporizadorDaFila.current = null
      fila.current = []
    }
    // `perfil` fora das deps de propósito: trocar a qualidade no meio da
    // partida remontaria a cena e o jogador perderia o lance. Vale na próxima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    velocidadeAtual.current = velocidade
    motor.current?.definirVelocidade(velocidade)
  }, [velocidade])
  useEffect(() => { motor.current?.definirPausa(pausado) }, [pausado])
  useEffect(() => { motor.current?.definirFormacao(getFormationSlots(formacao)) }, [formacao])

  // ── Encenação: só o que CHEGOU depois da última vez ───────────────────────
  //
  // A lista vem inteira a cada tick e do mais novo para o mais antigo. Encenar
  // tudo faria o motor repetir o jogo do zero a cada quadro; guardar o último id
  // já encenado é o que transforma a lista num fluxo.
  const ultimoEncenado = useRef<string | null>(null)
  useEffect(() => {
    if (!pronto || !motor.current) return
    const novos: typeof eventos = []
    for (const evento of eventos) {
      if (evento.id === ultimoEncenado.current) break
      novos.push(evento)
    }
    if (novos.length === 0) return
    ultimoEncenado.current = eventos[0]?.id ?? null
    // De volta à ordem cronológica. Limitamos apenas o backlog do primeiro
    // carregamento; depois cada item entra uma única vez, na mesma ordem da
    // aba Narração.
    fila.current.push(...novos.reverse().slice(-8))

    const executarProximo = () => {
      if (!motor.current || temporizadorDaFila.current !== null) return
      const evento = fila.current.shift()
      if (!evento) return
      const paraEncenar: EventoParaEncenar = {
        tipo: evento.tipo, lado: evento.lado, minuto: evento.minuto,
      }
      motor.current.encenar(paraEncenar)
      // Um evento precisa respirar antes do seguinte. A espera acompanha a
      // velocidade escolhida, mas nunca vira um piscar ilegível.
      const espera = Math.max(700, Math.round(2800 / Math.max(1, velocidadeAtual.current)))
      temporizadorDaFila.current = window.setTimeout(() => {
        temporizadorDaFila.current = null
        executarProximo()
      }, espera)
    }
    executarProximo()
  }, [eventos, pronto])

  return (
    <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#173a32] shadow-[0_24px_70px_rgba(0,0,0,.42)]">
      <div ref={palco} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(0,0,0,.34)_100%)]" />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md border border-white/10 bg-black/45 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/75 backdrop-blur-sm">
        <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> transmissão 3D · câmera tática
      </div>
      {!pronto && (
        <div className="absolute inset-0 grid place-items-center bg-black/85">
          <div className="w-64 text-center">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/50">{progresso.etapa}</p>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-200"
                style={{ width: `${Math.max(4, progresso.pct)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Aviso curto de que a partida caiu para o 2D, com o motivo. */
export function AvisoQuedaPara2D({ motivo }: { motivo: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
      <AlertTriangle className="size-3.5 shrink-0" />
      O 3D não pôde ser usado nesta máquina ({motivo}). A partida segue no campo 2D.
    </p>
  )
}
