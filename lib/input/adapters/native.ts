// ADAPTADOR NATIVO — a unica ponte com src-tauri/src/input.
//
// Ele existe por UM motivo: o botao Xbox. `XInputGetState`, que o Chromium usa
// para ler controles Xbox no Windows, nao reporta o Guide — entao `buttons[16]`
// nunca chega ao JavaScript e "apertar o botao Xbox liga o Modo Controle" era
// impossivel de atender so com a Web Gamepad API.
//
// ── Degradacao, nao quebra ──────────────────────────────────────────────────
// O jogo tambem roda no navegador (versao web da VPS) e em `npm run dev`, onde
// nao ha Tauri nenhum. Nesses casos este adaptador simplesmente nao inicia e
// reporta `Unknown` — e o jogo segue 100% jogavel no controle, so que a ativacao
// acontece pelo combo de fallback. Nada aqui pode ser condicao para o Modo
// Controle funcionar.

export type CenterButtonCapability = "AVAILABLE" | "RESERVED_BY_SYSTEM" | "UNAVAILABLE" | "UNKNOWN"

export interface RelatorioDoCentro {
  capability: CenterButtonCapability
  backend: string
  reason: string
}

export interface SlotNativo {
  slot: number
  connected: boolean
  family: string
  centerButtonReadable: boolean
  centerButtonPressed: boolean
  packet: number
}

export interface RetratoNativo {
  running: boolean
  platformSupported: boolean
  centerButton: RelatorioDoCentro
  slots: SlotNativo[]
  connectedCount: number
}

export const RETRATO_SEM_NATIVO: RetratoNativo = {
  running: false,
  platformSupported: false,
  centerButton: {
    capability: "UNKNOWN",
    backend: "nenhuma",
    reason: "sem camada nativa (navegador ou modo de desenvolvimento)",
  },
  slots: [],
  connectedCount: 0,
}

export interface OuvintesDoNativo {
  /** Borda de subida do botao central. */
  aoBotaoCentral: (slot: number, origem: string) => void
  /** Topologia ou capability mudou. */
  aoRetrato: (retrato: RetratoNativo) => void
}

function temTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

export class AdaptadorNativo {
  private ouvintes: OuvintesDoNativo
  private desinscrever: Array<() => void> = []
  private iniciado = false
  private retrato: RetratoNativo = RETRATO_SEM_NATIVO

  constructor(ouvintes: OuvintesDoNativo) {
    this.ouvintes = ouvintes
  }

  get atual(): RetratoNativo {
    return this.retrato
  }

  /** O botao central e utilizavel AGORA? Decide se a interface o ensina. */
  get centroDisponivel(): boolean {
    return this.retrato.centerButton.capability === "AVAILABLE"
  }

  async iniciar(): Promise<void> {
    if (this.iniciado || !temTauri()) return
    this.iniciado = true

    try {
      // Import dinamico: no build web estatico estes modulos nao sao
      // resolviveis em runtime, e um import de topo faria a PAGINA INTEIRA
      // falhar em vez de so o controle degradar.
      const [{ invoke }, { listen }] = await Promise.all([
        import("@tauri-apps/api/core"),
        import("@tauri-apps/api/event"),
      ])

      this.desinscrever.push(
        await listen<{ slot: number; source: string }>("uf:input:center", e => {
          this.ouvintes.aoBotaoCentral(e.payload.slot, e.payload.source)
        }),
      )
      this.desinscrever.push(
        await listen<RetratoNativo>("uf:input:native", e => {
          this.retrato = e.payload
          this.ouvintes.aoRetrato(e.payload)
        }),
      )

      await invoke("input_native_start")
      // Um retrato imediato, sem esperar a primeira mudanca de topologia: a
      // tela de configuracoes precisa saber a capability assim que abre, e a
      // primeira emissao do laco so vem quando algo MUDA.
      const primeiro = await invoke<RetratoNativo>("input_native_snapshot")
      this.retrato = primeiro
      this.ouvintes.aoRetrato(primeiro)
    } catch (erro) {
      // Backend ausente ou comando nao registrado (build antigo do .exe com
      // frontend novo). Falhar aqui NAO pode derrubar o controle.
      console.warn("[input] camada nativa indisponivel:", erro)
      this.retrato = RETRATO_SEM_NATIVO
      this.ouvintes.aoRetrato(this.retrato)
    }
  }

  /** O webview viu `gamepadconnected` antes do laco nativo — acorda ele. */
  async acordar(): Promise<void> {
    if (!temTauri() || !this.iniciado) return
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      await invoke("input_native_wake")
    } catch {
      // Silencio proposital: acordar e otimizacao, nao requisito. Se falhar, o
      // laco nativo percebe o controle novo em ate 250 ms por conta propria.
    }
  }

  async parar(): Promise<void> {
    this.desinscrever.forEach(f => f())
    this.desinscrever = []
    this.iniciado = false
    if (!temTauri()) return
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      await invoke("input_native_stop")
    } catch {
      /* o processo esta encerrando; nao ha o que fazer nem o que relatar */
    }
  }
}
