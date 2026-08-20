// GERENTE DE INPUT — o unico lugar que decide "quem esta no comando" e
// transforma aperto em ACAO.
//
//   controle fisico
//        ↓  AdaptadorWebGamepad (botoes/eixos)  +  AdaptadorNativo (botao central)
//   QuadroNormalizado
//        ↓  perfil do controle → PhysicalButton
//        ↓  pilha de contextos + amarracoes → GameAction
//   BarramentoDeAcoes → interface
//
// ── As tres regras que este arquivo existe para garantir ────────────────────
//
// 1. O REACT NUNCA VE EIXO. Nada aqui chama `setState` por quadro. O estado
//    publicado (`assinar`/`retrato`) muda quando o MODO muda ou quando um
//    controle conecta — dezenas de vezes por sessao, nao 60 vezes por segundo.
//    A versao antiga rerenderizava o app inteiro a 60 Hz e travava maquina
//    fraca; o eixo cru nunca mais sobe para o React.
//
// 2. UM SO EMISSOR de `gamepad:button`. O `useGamepad` antigo abria um laco de
//    polling E disparava o evento POR CHAMADA — entao dois componentes usando o
//    hook fariam todo botao chegar em dobro aos 44 arquivos que ouvem esse
//    evento. Na pratica so o provider o chamava, mas a tela de partida ao vivo
//    ja o tinha importado; era uma linha de distancia. Agora o laco e do
//    PROCESSO e os hooks antigos so leem dele — a armadilha deixou de existir.
//
// 3. MODO DE ENTRADA ≠ MODO DE EXIBICAO. Trocar para o mouse nao desliga o
//    preset de TV, e ligar o Modo Controle nao muda a escala se o jogador
//    escolheu Desktop. Sao dois eixos independentes de proposito — quem joga no
//    sofa com mouse sem fio existe.

"use client"

import { ACOES_REPETIVEIS, type GameAction, type OrigemDaAcao } from "./actions"
import { NOME_LEGADO, resolverAcao } from "./bindings"
import { barramentoDeAcoes } from "./bus"
import { pilhaDeContextos, type InputContext } from "./contexts"
import { DetectorDeIntencao, deadzoneRadial, direcaoDoEixo, type Direcao } from "./intent"
import { lerPreferencias, observarPreferencias, type PreferenciasDeInput } from "./preferences"
import { ControladorDeRepeticao } from "./repeat"
import { AdaptadorNativo, RETRATO_SEM_NATIVO, type RelatorioDoCentro } from "./adapters/native"
import { AdaptadorWebGamepad, type QuadroNormalizado } from "./adapters/web-gamepad"
import type { ControllerDevice } from "@/lib/controller/devices"
import { TODOS_OS_BOTOES, type PhysicalButton } from "@/lib/controller/profiles"

export type InputMode = "mouse" | "gamepad"

/** O pouco que o React precisa saber. Muda raramente — de proposito. */
export interface RetratoDoInput {
  inputMode: InputMode
  dispositivos: readonly ControllerDevice[]
  primario: ControllerDevice | null
  centro: RelatorioDoCentro
  /** Recem-conectado, para o aviso discreto. Zera sozinho. */
  avisoDeConexao: ControllerDevice | null
  avisoDeDesconexao: boolean
}

type Ouvinte = (retrato: RetratoDoInput) => void
type OuvinteDeEixo = (direito: { x: number; y: number }, esquerdo: { x: number; y: number }) => void

/** Teclas que viram acao. Ver a nota sobre teclado no fim do arquivo. */
const TECLAS: Record<string, GameAction> = {
  ArrowUp: "UI_UP",
  ArrowDown: "UI_DOWN",
  ArrowLeft: "UI_LEFT",
  ArrowRight: "UI_RIGHT",
  Enter: "UI_CONFIRM",
  Escape: "UI_BACK",
}

function digitando(): boolean {
  const a = document.activeElement
  if (!(a instanceof HTMLElement)) return false
  return (
    a.tagName === "INPUT" ||
    a.tagName === "TEXTAREA" ||
    a.tagName === "SELECT" ||
    a.isContentEditable
  )
}

class GerenteDeInput {
  private web: AdaptadorWebGamepad
  private nativo: AdaptadorNativo
  private intencao = new DetectorDeIntencao()
  private repeticao = new ControladorDeRepeticao()
  private prefs: PreferenciasDeInput = lerPreferencias()

  private modo: InputMode = "mouse"
  private dispositivos: ControllerDevice[] = []
  private primario: ControllerDevice | null = null
  private centro: RelatorioDoCentro = RETRATO_SEM_NATIVO.centerButton
  private avisoDeConexao: ControllerDevice | null = null
  private avisoDeDesconexao = false

  private anteriores: Record<PhysicalButton, boolean> = {} as Record<PhysicalButton, boolean>
  private direcaoAnterior: Direcao = null
  private comboDesde: number | null = null
  private ultimoEixoPublicado = 0

  private ouvintes = new Set<Ouvinte>()
  private ouvintesDeEixo = new Set<OuvinteDeEixo>()
  private retratoCache: RetratoDoInput | null = null
  private iniciado = false
  private limpezas: Array<() => void> = []

  constructor() {
    for (const b of TODOS_OS_BOTOES) this.anteriores[b] = false

    this.web = new AdaptadorWebGamepad({
      aoQuadro: q => this.processarQuadro(q),
      aoConectar: d => this.aoConectar(d),
      aoDesconectar: d => this.aoDesconectar(d),
    })

    this.nativo = new AdaptadorNativo({
      aoBotaoCentral: () => this.pedidoDeModoControle("botão central"),
      aoRetrato: r => {
        this.centro = r.centerButton
        this.web.informarCentroNativo(r.centerButton.capability === "AVAILABLE")
        this.publicar()
      },
    })
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  iniciar(): void {
    if (this.iniciado || typeof window === "undefined") return
    this.iniciado = true

    this.aplicarPreferencias(lerPreferencias())
    this.limpezas.push(observarPreferencias(p => this.aplicarPreferencias(p)))

    this.web.iniciar()
    void this.nativo.iniciar()

    const aoConectarNavegador = () => void this.nativo.acordar()
    window.addEventListener("gamepadconnected", aoConectarNavegador)
    window.addEventListener("mousemove", this.aoMouseMover, { passive: true })
    window.addEventListener("mousedown", this.aoMouseClicar, { passive: true })
    window.addEventListener("keydown", this.aoTecla)

    const bateria = window.setInterval(() => void this.atualizarBateria(), 60_000)

    this.limpezas.push(() => {
      window.clearInterval(bateria)
      window.removeEventListener("gamepadconnected", aoConectarNavegador)
      window.removeEventListener("mousemove", this.aoMouseMover)
      window.removeEventListener("mousedown", this.aoMouseClicar)
      window.removeEventListener("keydown", this.aoTecla)
    })
  }

  parar(): void {
    if (!this.iniciado) return
    this.iniciado = false
    this.web.parar()
    void this.nativo.parar()
    this.limpezas.forEach(f => f())
    this.limpezas = []
  }

  private aplicarPreferencias(p: PreferenciasDeInput): void {
    this.prefs = p
    this.intencao.ajustar({ deadzone: p.deadzone, intencao: p.intencao })
    this.repeticao.ajustar({
      atrasoInicialMs: p.atrasoInicialMs,
      intervaloMs: p.intervaloRepeticaoMs,
    })
    // Preferencia explicita manda na hora, sem esperar o proximo aperto: quem
    // marcou "Controle" nas opcoes espera a interface mudar ali, nao daqui a
    // pouco.
    if (p.entrada === "gamepad" && this.modo !== "gamepad") this.trocarModo("gamepad")
    if (p.entrada === "mouse" && this.modo !== "mouse") this.trocarModo("mouse")
  }

  // ── Estado publicado ──────────────────────────────────────────────────────

  assinar(ouvinte: Ouvinte): () => void {
    this.ouvintes.add(ouvinte)
    return () => {
      this.ouvintes.delete(ouvinte)
    }
  }

  /**
   * Eixos ao vivo, para quem REALMENTE precisa (tatica, partida, mapa).
   *
   * Fora do barramento de acoes de proposito: eixo e continuo e nao vira acao.
   * Quem nao assina nao paga nada; quem assina recebe no maximo a 30 Hz e so
   * quando ha movimento fora da deadzone.
   */
  observarEixos(ouvinte: OuvinteDeEixo): () => void {
    this.ouvintesDeEixo.add(ouvinte)
    return () => {
      this.ouvintesDeEixo.delete(ouvinte)
    }
  }

  retrato(): RetratoDoInput {
    if (!this.retratoCache) {
      this.retratoCache = {
        inputMode: this.modo,
        dispositivos: this.dispositivos,
        primario: this.primario,
        centro: this.centro,
        avisoDeConexao: this.avisoDeConexao,
        avisoDeDesconexao: this.avisoDeDesconexao,
      }
    }
    return this.retratoCache
  }

  private publicar(): void {
    // Invalida o cache e avisa. `useSyncExternalStore` compara por REFERENCIA,
    // entao o cache tem de ser trocado aqui e em nenhum outro lugar — devolver
    // um objeto novo a cada leitura faria o React renderizar em laco infinito.
    this.retratoCache = null
    const r = this.retrato()
    this.ouvintes.forEach(o => o(r))
  }

  // ── Modo de entrada ───────────────────────────────────────────────────────

  get inputMode(): InputMode {
    return this.modo
  }

  private trocarModo(novo: InputMode): void {
    if (this.modo === novo) return
    this.modo = novo
    this.repeticao.limpar()
    this.intencao.zerarMouse()

    // O atributo no <html> e o que a folha de estilo consome (cursor, anel de
    // foco, tamanho de alvo). Ficar no DOM em vez de num contexto React e
    // proposital: muda sem render nenhum.
    const raiz = document.documentElement
    if (novo === "gamepad") raiz.dataset.inputMode = "gamepad"
    else delete raiz.dataset.inputMode

    this.publicar()
  }

  /** Pedido explicito (botao central, combo, opcao). Sempre liga. */
  pedidoDeModoControle(origem: string): void {
    if (!this.prefs.botaoCentralAtiva && origem === "botão central") return
    if (this.modo === "gamepad") {
      // JA ESTA LIGADO — e nao desligamos.
      //
      // Um botao que liga E desliga o mesmo modo e confuso justamente onde mais
      // atrapalha: o jogador aperta o Xbox achando que abriu algo, o Modo
      // Controle cai, o cursor reaparece e ele acha que o jogo travou. A volta
      // ao mouse acontece por MOVER O MOUSE, que e inequivoco.
      return
    }
    this.trocarModo("gamepad")
    window.dispatchEvent(new CustomEvent("uf:input:modo", { detail: { modo: "gamepad", origem } }))
  }

  // ── Dispositivos ──────────────────────────────────────────────────────────

  /**
   * BATERIA — vem do Windows, nao do navegador.
   *
   * A Web Gamepad API nao expoe nivel de bateria em Chromium. O jogo ja tinha a
   * resposta pelo lado nativo (`get_bluetooth_gamepad_battery`, que le o
   * `Devices.Enumeration`), e ela continua sendo usada aqui — mover o polling
   * para o gerente foi o que impediu que essa funcionalidade se perdesse na
   * troca de motor.
   *
   * A cada 60 s, nao a cada quadro: nivel de bateria muda em horas, e a consulta
   * atravessa o IPC e enumera dispositivos do sistema. O intervalo antigo era
   * 30 s; dobrou porque nada no jogo reage a bateria alem de um numero no canto.
   */
  private async atualizarBateria(): Promise<void> {
    const alvo = this.primario ?? this.dispositivos[0]
    if (!alvo || typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      const nivel = await invoke<number | null>("get_bluetooth_gamepad_battery", {
        controllerName: alvo.rawName,
      })
      const normalizado = typeof nivel === "number" ? Math.max(0, Math.min(1, nivel)) : null
      if (alvo.battery === normalizado) return
      // Muta o objeto e troca a REFERENCIA da lista: `useSyncExternalStore`
      // compara por referencia, entao sem a lista nova o numero mudaria no
      // objeto e a tela nunca redesenharia.
      alvo.battery = normalizado
      this.dispositivos = [...this.dispositivos]
      this.publicar()
    } catch {
      // Controle com fio, comando ausente num .exe antigo, ou o Windows sem
      // resposta. Bateria e enfeite: falhar aqui nao pode afetar o input.
    }
  }

  private aoConectar(device: ControllerDevice): void {
    this.dispositivos = this.web.dispositivos()
    this.avisoDeConexao = device
    this.avisoDeDesconexao = false
    this.publicar()
    void this.atualizarBateria()
    // O aviso e um toque discreto, nao um modal: some sozinho. Guardar um timer
    // por dispositivo seria exagero — conectar dois controles em 4 s e raro e o
    // pior caso e um aviso sumir cedo.
    window.setTimeout(() => {
      if (this.avisoDeConexao?.id === device.id) {
        this.avisoDeConexao = null
        this.publicar()
      }
    }, 4000)
  }

  private aoDesconectar(device: ControllerDevice): void {
    this.dispositivos = this.web.dispositivos()
    if (this.primario?.id === device.id) this.primario = this.web.primario()
    // Sem NENHUM controle: avisa e volta ao mouse, senao a pessoa fica numa
    // tela sem cursor e sem controle — o unico estado realmente sem saida.
    if (!this.dispositivos.length) {
      this.avisoDeDesconexao = true
      if (this.prefs.entrada !== "gamepad") this.trocarModo("mouse")
      window.setTimeout(() => {
        this.avisoDeDesconexao = false
        this.publicar()
      }, 6000)
    }
    this.publicar()
  }

  // ── Quadro do controle ────────────────────────────────────────────────────

  private processarQuadro(q: QuadroNormalizado): void {
    const agora = performance.now()

    if (this.primario?.id !== q.device.id) {
      this.primario = q.device
      this.publicar()
    }

    const contexto = pilhaDeContextos.topo()
    let houveIntencao = false

    // 1) Bordas de subida + repeticao dos direcionais.
    for (const botao of TODOS_OS_BOTOES) {
      const agoraApertado = q.botoes[botao]
      const antes = this.anteriores[botao]
      this.anteriores[botao] = agoraApertado

      if (agoraApertado && !antes) {
        houveIntencao = true
        if (botao === "CENTER") {
          this.pedidoDeModoControle("botão central")
          continue
        }
        this.despachar(botao, contexto, "gamepad", false)
      }

      // Repeticao SO para o que e navegacao. Um A segurado nao pode confirmar
      // trinta vezes — foi assim que uma versao antiga assinava contrato em
      // duplicata quando o controle ficava apoiado no colo.
      const acao = resolverAcao(botao, contexto, this.prefs.amarracoes)
      if (acao && ACOES_REPETIVEIS.has(acao)) {
        const passo = this.repeticao.consultar(`b:${botao}`, agoraApertado, agora)
        if (passo === "repeticao") this.despachar(botao, contexto, "gamepad", true)
      }
    }

    // 2) Combo de fallback (View+Menu / Share+Options).
    this.avaliarCombo(q, agora)

    // 3) Analogico esquerdo → direcao, com deadzone radial e repeticao.
    const esq = deadzoneRadial(q.esquerdo.x, q.esquerdo.y, this.prefs.deadzone)
    const direcao = direcaoDoEixo(esq.x, esq.y)
    if (direcao) {
      const botao = (
        { up: "DPAD_UP", down: "DPAD_DOWN", left: "DPAD_LEFT", right: "DPAD_RIGHT" } as const
      )[direcao]
      // Direcao nova dispara na hora; a mesma direcao segurada so repete depois
      // do atraso inicial. Trocar de direcao zera a contagem da anterior, senao
      // voltar para uma direcao ja usada herdaria a cadencia acelerada dela.
      if (direcao !== this.direcaoAnterior) this.repeticao.limpar()
      const passo = this.repeticao.consultar(`s:${direcao}`, true, agora)
      if (passo) this.despachar(botao, contexto, "gamepad", passo === "repeticao")
    } else if (this.direcaoAnterior) {
      this.repeticao.limpar()
    }
    this.direcaoAnterior = direcao

    // 4) So um movimento FRANCO assume o Modo Controle. Ver lib/input/intent.ts:
    //    analogico gasto repousa em 0.03–0.12 e ligaria o modo sozinho.
    if (!houveIntencao && this.intencao.eixoDoControle(q.esquerdo.x, q.esquerdo.y)) {
      houveIntencao = true
    }
    if (houveIntencao && this.prefs.entrada !== "mouse") this.trocarModo("gamepad")

    // 5) Eixos ao vivo para quem assinou, no maximo a 30 Hz.
    if (this.ouvintesDeEixo.size && agora - this.ultimoEixoPublicado >= 33) {
      const dir = deadzoneRadial(q.direito.x, q.direito.y, this.prefs.deadzone)
      if (dir.x || dir.y || esq.x || esq.y) {
        this.ultimoEixoPublicado = agora
        this.ouvintesDeEixo.forEach(o => o(dir, esq))
      }
    }
  }

  /**
   * Combo de ativacao, para quando o botao central nao e nosso.
   *
   * Precisa dos DOIS botoes segurados por `seguraMs`. Nao vale apertar em
   * sequencia: View e Menu tem funcao propria no jogo (contexto secundario e
   * pausa), e um combo por toque roubaria os dois.
   */
  private avaliarCombo(q: QuadroNormalizado, agora: number): void {
    const { a, b, seguraMs } = this.prefs.combo
    const ambos = q.botoes[a] && q.botoes[b]
    if (!ambos) {
      this.comboDesde = null
      return
    }
    if (this.comboDesde == null) {
      this.comboDesde = agora
      return
    }
    if (agora - this.comboDesde >= seguraMs) {
      this.comboDesde = null
      this.pedidoDeModoControle("combinação")
    }
  }

  private despachar(
    botao: PhysicalButton,
    contexto: InputContext,
    origem: OrigemDaAcao,
    repetida: boolean,
  ): void {
    // COMPATIBILIDADE: 44 arquivos ouvem `gamepad:button` com nome de botao
    // Xbox. Continuam funcionando exatamente como antes — e agora recebem UMA
    // vez, nao duas. Ver regra 2 do cabecalho.
    const legado = NOME_LEGADO[botao]
    if (legado) {
      window.dispatchEvent(new CustomEvent("gamepad:button", { detail: { button: legado } }))
    }

    const acao = resolverAcao(botao, contexto, this.prefs.amarracoes)
    if (!acao) return
    barramentoDeAcoes.emitir({ action: acao, origem, repetida, contexto, instante: performance.now() })
  }

  // ── Mouse e teclado ───────────────────────────────────────────────────────

  private aoMouseMover = (e: MouseEvent) => {
    if (this.modo !== "gamepad" || this.prefs.entrada === "gamepad") return
    // `movementX/Y` e o delta real do dispositivo. Usar a diferenca de
    // clientX/Y daria falso positivo quando a PAGINA rola sob um mouse parado —
    // e o Modo Controle cairia sozinho durante uma navegacao no D-pad, que e
    // exatamente quando a pagina mais rola.
    if (this.intencao.mouseMoveu(e.movementX ?? 0, e.movementY ?? 0, performance.now())) {
      this.trocarModo("mouse")
    }
  }

  private aoMouseClicar = () => {
    if (this.prefs.entrada === "gamepad") return
    if (this.intencao.mouseClicou()) this.trocarModo("mouse")
  }

  /**
   * TECLADO — aditivo, nunca substitutivo.
   *
   * As telas ja tratam o proprio teclado ha versoes. Reemitir Enter/Escape como
   * `gamepad:button` faria a acao acontecer DUAS vezes em toda tela antiga.
   * Entao o teclado alimenta so o barramento novo (`origem: "keyboard"`), que
   * so tem consumidores novos. Codigo novo ganha teclado de graca; codigo
   * antigo nao muda de comportamento.
   */
  private aoTecla = (e: KeyboardEvent) => {
    if (digitando() || e.ctrlKey || e.altKey || e.metaKey) return
    const acao = TECLAS[e.key]
    if (!acao) return
    barramentoDeAcoes.emitir({
      action: acao,
      origem: "keyboard",
      repetida: e.repeat,
      contexto: pilhaDeContextos.topo(),
      instante: performance.now(),
    })
  }
}

/**
 * Instancia unica do processo.
 *
 * Modulo, nao contexto React: o laco nao pode nascer e morrer com uma arvore de
 * componentes. Em Strict Mode o provider monta duas vezes, e duas instancias
 * significariam dois lacos e todo botao chegando em dobro — o defeito que a
 * regra 2 do cabecalho descreve.
 */
export const gerenteDeInput = new GerenteDeInput()
