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
import { tipoParaCena } from "@/lib/eventos-para-3d"
import { assetsFutebol } from "@/lib/assets-futebol"

/** O que o 3D precisa saber de um atleta para desenhá-lo. Tudo opcional. */
export interface AtletaVisual {
  id?: string
  nome?: string
  numero?: number
  posicao?: string
}

export interface Campo3DProps {
  /** Eventos do match-engine, do mais NOVO para o mais antigo (como no state). */
  eventos: { id: string; tipo: string; lado: "home" | "away"; minuto?: number }[]
  /** Multiplicador de velocidade da cena (não afeta o relógio do jogo). */
  velocidade?: number
  pausado?: boolean
  formacao?: string
  /** Duração de cada tempo, em minutos de jogo. Vem do contexto da partida. */
  duracaoDoTempo?: number
  /**
   * Câmera da transmissão. O padrão é `transmissao`, que é o plano que o
   * jogador espera de um jogo de futebol.
   *
   * ⚠️ As câmeras CONTEXTUAIS (pênalti atrás do cobrador, falta em plano baixo,
   * escanteio junto à bandeirinha) são do Director do motor e NÃO se controlam
   * daqui — ele as assume sozinho quando o lance pede e devolve o plano normal
   * depois. Forçar o modo por fora brigaria com ele e mataria justamente o que
   * o V5 tem de melhor.
   */
  camera?: "dinamica" | "transmissao" | "tele" | "aerea"
  casa: { nome: string; sigla: string; corPrincipal: string; corSecundaria: string }
  fora: { nome: string; sigla: string; corPrincipal: string; corSecundaria: string }
  /**
   * Os 11 titulares de cada lado, NA ORDEM DOS SLOTS da escalação.
   *
   * A ordem importa: o motor casa o índice do atleta com o índice do slot da
   * formação. Fora de ordem, o goleiro apareceria no ataque.
   */
  titularesCasa?: AtletaVisual[]
  titularesFora?: AtletaVisual[]
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

/**
 * A APARÊNCIA DO ATLETA SAI DO ID DELE, e não do banco.
 *
 * O jogo não guarda cabelo, tom de pele ou formato de rosto — e não deve passar
 * a guardar só para o 3D: seriam três campos novos por atleta em 66 mil atletas,
 * inflando save e seed para uma decisão puramente visual. Derivar do id dá o que
 * importa: **estabilidade**. O mesmo atleta aparece igual em toda partida, em
 * toda máquina, sem custar um byte de save.
 *
 * ⚠️ Só devolve o que dá para afirmar. Altura e porte NÃO são inventados aqui —
 * o jogo nunca teve esse dado (ver [[ultrafoot-dados-fisicos-inventados]]), e o
 * motor tem fallback próprio para eles. Preencher com número inventado seria
 * transformar palpite em dado.
 */
const CABELOS = ["short", "buzz", "fade", "curly", "long"] as const
const TONS_DE_PELE = ["#f2d3b3", "#e0b088", "#c68642", "#8d5524", "#5c3317"]
const CORES_DE_CABELO = ["#1b1310", "#2f2119", "#4a3220", "#7a5230", "#b58a4c"]
const ROSTOS = ["balanced", "slim", "wide", "long", "round"] as const

function semente(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function aparenciaDoAtleta(atleta: AtletaVisual, indice: number) {
  const s = semente(atleta.id ?? atleta.nome ?? `slot-${indice}`)
  return {
    nome: atleta.nome,
    numero: atleta.numero,
    cabelo: CABELOS[s % CABELOS.length],
    tomPele: TONS_DE_PELE[(s >>> 3) % TONS_DE_PELE.length],
    corCabelo: CORES_DE_CABELO[(s >>> 7) % CORES_DE_CABELO.length],
    rostoPreset: ROSTOS[(s >>> 11) % ROSTOS.length],
  }
}

export function Campo3D({
  eventos, velocidade = 1, pausado = false, formacao = "4-3-3", duracaoDoTempo,
  camera = "transmissao", casa, fora, titularesCasa, titularesFora, aoFalhar,
}: Campo3DProps) {
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
          // PASSO 6 — os assets do V5. `obrigatorio: false` é o que preserva o
          // fallback procedural: se um GLB ou textura faltar (disco podado,
          // download incompleto), a partida continua com o modelo simples em vez
          // de virar tela preta. Ver o aviso de FALLBACK no topo deste arquivo.
          assets3D: { ...assetsFutebol, obrigatorio: false },
          // PASSO 7 — clube real. `casa`/`fora` já traziam nome, sigla e cores;
          // o uniforme entra pelo mesmo objeto, sem duplicar dado de clube.
          casa: { ...casa, jogadores3D: (titularesCasa ?? []).map(aparenciaDoAtleta) },
          fora: { ...fora, jogadores3D: (titularesFora ?? []).map(aparenciaDoAtleta) },
          aoProgredir: (pct, etapa) => { if (vivo) setProgresso({ pct, etapa }) },
          aoIniciar: () => { if (vivo) setPronto(true) },
          aoFalhar: (erro) => { if (vivo) falhar.current(erro.message) },
        })
        instancia.definirFormacao(getFormationSlots(formacao))
        // PASSO 10 — velocidade e pausa ja tinham ponte; a DURACAO nao tinha, e
        // sem ela o relogio da cena divergia do relogio da partida.
        if (duracaoDoTempo) instancia.definirDuracaoDoTempo(duracaoDoTempo)
        instancia.definirCamera(camera)
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
  useEffect(() => {
    if (duracaoDoTempo) motor.current?.definirDuracaoDoTempo(duracaoDoTempo)
  }, [duracaoDoTempo])
  useEffect(() => { motor.current?.definirCamera(camera) }, [camera])
  useEffect(() => { motor.current?.definirFormacao(getFormationSlots(formacao)) }, [formacao])

  /**
   * PAINEL DE TELEMETRIA DO 3D — passo 13.
   *
   * ⚠️ Existe porque LOD é INVISÍVEL quando funciona. O sistema tem três níveis
   * (detalhe, médio, proxy) e o sintoma de estar quebrado não é erro nenhum: é o
   * jogo ficando pesado sem motivo aparente, ou atletas distantes com detalhe de
   * primeiro plano. Sem ler os números, "está funcionando" vira opinião.
   *
   * Ele também é o único lugar que denuncia `falhasAssets` — um GLB que não
   * carregou cai no fallback procedural em silêncio, de propósito (a partida não
   * pode virar tela preta), e sem este painel ninguém saberia que caiu.
   *
   * Fica atrás de `?debug3d=1`: some em produção sem precisar de build separada.
   */
  const [telemetria, setTelemetria] = useState<ReturnType<NonNullable<typeof motor.current>["lerTelemetria"]> | null>(null)
  const mostrarDebug = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("debug3d") === "1"
  useEffect(() => {
    if (!mostrarDebug || !pronto) return
    // 2 por segundo: o suficiente para acompanhar, longe de competir com a cena.
    const id = window.setInterval(() => setTelemetria(motor.current?.lerTelemetria() ?? null), 500)
    return () => window.clearInterval(id)
  }, [mostrarDebug, pronto])

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
      // PASSO 11 — TRADUZIR, e não repassar cru. O vocabulário do motor de
      // partida não é o da cena: `offside` e `chance` precisam de decisão, e
      // `injury`/`card` NÃO devem virar lance nenhum (encenar cartão sem cor
      // mostraria vermelho onde houve amarelo). Ver lib/eventos-para-3d.ts.
      const tipoDaCena = tipoParaCena(evento.tipo)
      if (tipoDaCena) {
        const paraEncenar: EventoParaEncenar = {
          tipo: tipoDaCena, lado: evento.lado, minuto: evento.minuto,
        }
        motor.current.encenar(paraEncenar)
      }
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
      {mostrarDebug && telemetria?.render3D && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-white/15 bg-black/75 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80 backdrop-blur-sm">
          <div className="mb-1 font-bold text-[var(--brand)]">render3D</div>
          <div>LOD detalhe/medio/proxy: {telemetria.render3D.lodDetalhe}/{telemetria.render3D.lodMedio}/{telemetria.render3D.lodProxy}</div>
          <div>torcida: {telemetria.render3D.crowdCount}</div>
          <div>GLB jogador: {telemetria.render3D.jogadorGLB ? "sim" : "NAO"} · estadio: {telemetria.render3D.estadioGLB ? "sim" : "NAO"}</div>
          <div>camera: {telemetria.render3D.cameraModo} · fov {Math.round(telemetria.render3D.fov)}</div>
          {telemetria.render3D.falhasAssets.length > 0 && (
            <div className="mt-1 text-amber-300">falhas: {telemetria.render3D.falhasAssets.join(", ")}</div>
          )}
        </div>
      )}
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
