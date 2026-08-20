// ADAPTADOR WEB — le a Web Gamepad API e devolve QUADRO NORMALIZADO.
//
// Ele e a fonte de botoes e eixos do jogo. O backend nativo (src-tauri/src/input)
// NAO duplica isso: entrega so o botao central, que e o unico dado que este
// adaptador nao consegue obter para controles Xbox. Ver o cabecalho de
// manager.rs para o porque de nao haver duas fontes para o mesmo aperto.
//
// ── O que ele resolve e o adaptador ingenuo nao ─────────────────────────────
// 1. Perfil por controle: DualShock por Bluetooth sem driver tem outra ordem de
//    botoes e o D-pad num hat switch. Ver lib/controller/profiles.ts.
// 2. Quem manda com dois controles ligados: o ULTIMO que teve input de verdade.
//    Antes era sempre `gamepads[0]`, e quem pegasse o segundo controle ficava
//    com o jogo mudo, sem nenhuma pista do motivo.
// 3. Zero alocacao por quadro no caminho quente: os mapas de botao sao
//    reutilizados. A 60 Hz, criar um objeto novo por quadro alimenta o coletor
//    de lixo com lixo previsivel — e coleta no meio de uma partida aparece como
//    engasgo.

import {
  identificar,
  type ContextoDeIdentificacao,
  type ControllerDevice,
} from "@/lib/controller/devices"
import {
  direcoesDoHat,
  TODOS_OS_BOTOES,
  type PhysicalButton,
} from "@/lib/controller/profiles"

export interface QuadroNormalizado {
  device: ControllerDevice
  botoes: Record<PhysicalButton, boolean>
  esquerdo: { x: number; y: number }
  direito: { x: number; y: number }
  /** Gatilhos analogicos 0–1, quando o controle os expoe. */
  gatilhos: { esquerdo: number; direito: number }
}

export interface OuvintesDoAdaptador {
  aoQuadro: (quadro: QuadroNormalizado) => void
  aoConectar: (device: ControllerDevice) => void
  aoDesconectar: (device: ControllerDevice) => void
}

function mapaVazio(): Record<PhysicalButton, boolean> {
  const m = {} as Record<PhysicalButton, boolean>
  for (const b of TODOS_OS_BOTOES) m[b] = false
  return m
}

/** Pressionado? Trata tanto `GamepadButton` quanto o `number` de drivers antigos. */
function apertado(b: GamepadButton | number | undefined): boolean {
  if (b === undefined) return false
  return typeof b === "object" ? b.pressed : b > 0.5
}

function valor(b: GamepadButton | number | undefined): number {
  if (b === undefined) return 0
  return typeof b === "object" ? b.value : b
}

export class AdaptadorWebGamepad {
  private ouvintes: OuvintesDoAdaptador
  private contexto: ContextoDeIdentificacao = { centroNativoDisponivel: false }
  private raf: number | null = null
  private ultimoQuadro = 0
  private ativos = new Map<number, ControllerDevice>()
  private donoIndice: number | null = null
  /** Reutilizado a cada quadro — ver decisao 3 do cabecalho. */
  private botoes = mapaVazio()

  constructor(ouvintes: OuvintesDoAdaptador) {
    this.ouvintes = ouvintes
  }

  /** O nativo descobriu se consegue ler o botao central. Muda `capabilities`. */
  informarCentroNativo(disponivel: boolean): void {
    this.contexto = { centroNativoDisponivel: disponivel }
  }

  iniciar(): void {
    if (this.raf != null || typeof window === "undefined") return
    window.addEventListener("gamepadconnected", this.aoConectarNavegador)
    window.addEventListener("gamepaddisconnected", this.aoDesconectarNavegador)
    this.raf = requestAnimationFrame(this.laco)
  }

  parar(): void {
    if (typeof window === "undefined") return
    window.removeEventListener("gamepadconnected", this.aoConectarNavegador)
    window.removeEventListener("gamepaddisconnected", this.aoDesconectarNavegador)
    if (this.raf != null) cancelAnimationFrame(this.raf)
    this.raf = null
  }

  dispositivos(): ControllerDevice[] {
    return [...this.ativos.values()]
  }

  /** Quem executou o ultimo input valido. E dele que saem os glifos. */
  primario(): ControllerDevice | null {
    if (this.donoIndice == null) return null
    return this.ativos.get(this.donoIndice) ?? null
  }

  private aoConectarNavegador = () => {
    // O evento chega antes de o gamepad aparecer em `getGamepads()` em alguns
    // drivers. Nao tratamos nada aqui: o proximo quadro descobre sozinho. O
    // evento serve so para acordar o backend nativo, que faz isso pelo
    // InputManager.
  }

  private aoDesconectarNavegador = () => {
    // Idem: o laco percebe a ausencia e emite `aoDesconectar` com o device que
    // ja estava identificado — usar `e.gamepad` aqui daria um objeto sem perfil.
  }

  private laco = () => {
    this.raf = requestAnimationFrame(this.laco)

    const agora = performance.now()
    // ~60 Hz. Em tela de 144 Hz, o rAF dispara 144x/s e ler o controle mais
    // rapido que o proprio controle envia (250 Hz no melhor caso, 125 Hz o
    // normal) so gasta CPU.
    if (agora - this.ultimoQuadro < 15) return
    this.ultimoQuadro = agora

    const lista = navigator.getGamepads?.() ?? []
    let algum = false

    // 1) Sincroniza conexoes.
    const vistos = new Set<number>()
    for (const gp of lista) {
      if (!gp?.connected) continue
      algum = true
      vistos.add(gp.index)
      if (!this.ativos.has(gp.index)) {
        const device = identificar(gp, this.contexto)
        this.ativos.set(gp.index, device)
        this.ouvintes.aoConectar(device)
      }
    }
    for (const [indice, device] of [...this.ativos]) {
      if (vistos.has(indice)) continue
      this.ativos.delete(indice)
      if (this.donoIndice === indice) this.donoIndice = null
      this.ouvintes.aoDesconectar(device)
    }

    if (!algum) return

    // 2) Elege o dono. `timestamp` sobe a cada leitura COM atividade; quem
    //    mexeu por ultimo assume, e trocar de maos funciona sem desparear nada.
    let dono: Gamepad | null = null
    for (const gp of lista) {
      if (!gp?.connected) continue
      if (!dono) { dono = gp; continue }
      const ativo =
        gp.buttons.some(b => apertado(b)) || gp.axes.some(v => Math.abs(v) > 0.35)
      if (ativo && gp.timestamp >= dono.timestamp) dono = gp
    }
    if (!dono) return
    this.donoIndice = dono.index

    const device = this.ativos.get(dono.index)
    if (!device) return

    // 3) Normaliza pelo perfil.
    const { botoes: mapa, eixos, hat } = device.profile
    const hatAtivo = hat >= 0 ? direcoesDoHat(dono.axes[hat]) : null

    for (const nome of TODOS_OS_BOTOES) {
      const indice = mapa[nome]
      const doHat = hatAtivo?.[nome]
      this.botoes[nome] = doHat ?? (indice >= 0 ? apertado(dono.buttons[indice]) : false)
    }

    this.ouvintes.aoQuadro({
      device,
      botoes: this.botoes,
      esquerdo: { x: dono.axes[eixos.lx] ?? 0, y: dono.axes[eixos.ly] ?? 0 },
      direito: { x: dono.axes[eixos.rx] ?? 0, y: dono.axes[eixos.ry] ?? 0 },
      gatilhos: {
        esquerdo: valor(dono.buttons[mapa.TRIGGER_L]),
        direito: valor(dono.buttons[mapa.TRIGGER_R]),
      },
    })
  }
}
