// IDENTIDADE DO CONTROLE — quem esta ligado, de que geracao, por qual fio.
//
// ── Por que nao basta o nome ────────────────────────────────────────────────
// O codigo antigo decidia por `id.includes("dualsense")`. Funciona ate a
// primeira maquina em que o Windows chama o mesmo aparelho de "Wireless
// Controller" — que e o nome que o DualShock 4 usa POR PADRAO. Nome e texto de
// driver: muda com atualizacao do Windows, com idioma e com adaptador.
//
// VendorId/ProductId nao mudam. E o Chromium os entrega dentro de `gamepad.id`
// para todo controle que entra por HID:
//
//   "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"
//                                          ^^^^         ^^^^
//
// ── O buraco honesto ────────────────────────────────────────────────────────
// Controle Xbox no Windows NAO entra por HID: entra por XInput, e o Chromium
// reporta so "Xbox 360 Controller (XInput STANDARD GAMEPAD)" — sem VID/PID,
// para QUALQUER geracao. Ou seja: da para saber que e um Xbox, nao da para
// saber se e One, Series ou Elite, a menos que ele chegue por Bluetooth puro.
//
// Isso NAO afeta o jogo: os glifos de Xbox sao A/B/X/Y em todas as geracoes e o
// mapeamento e identico. Afeta so o rotulo "Controle ativo" na tela de
// configuracoes, que nesse caso diz "Xbox Wireless Controller" em vez do modelo
// exato. Preferimos dizer menos a inventar.

import { PERFIS, type IdDoPerfil, type PerfilDeControle } from "./profiles"

export type ControllerFamily = "xbox" | "playstation" | "nintendo" | "steam" | "generic"

export type ControllerModel =
  | "xbox_one"
  | "xbox_series"
  | "xbox_elite"
  | "xbox_generic"
  | "dualshock4"
  | "dualsense"
  | "dualsense_edge"
  | "switch_pro"
  | "steam_deck"
  | "steam_controller"
  | "unknown"

export type ControllerConnection = "usb" | "bluetooth" | "wireless" | "unknown"

export interface ControllerCapabilities {
  vibration: boolean
  triggerVibration: boolean
  touchpad: boolean
  gyro: boolean
  /** O botao central chega ao JOGO (por webview OU por backend nativo). */
  centerButton: boolean
}

export interface ControllerDevice {
  /** Estavel enquanto o controle estiver ligado. `Gamepad.index` + identidade. */
  id: string
  index: number
  rawName: string
  vendorId: number | null
  productId: number | null
  family: ControllerFamily
  model: ControllerModel
  connection: ControllerConnection
  capabilities: ControllerCapabilities
  profile: PerfilDeControle
  /** Rotulo humano: "DualSense", "Xbox Wireless Controller". */
  label: string
  /** 0–1, ou null quando o sistema nao expoe. */
  battery: number | null
}

// ── Tabelas de hardware ─────────────────────────────────────────────────────
// Fonte: identificadores USB publicados pelos fabricantes. Manter ORDENADO por
// fabricante e comentado — a proxima geracao de controle entra aqui e em mais
// lugar nenhum.

const SONY = 0x054c
const MICROSOFT = 0x045e
const NINTENDO = 0x057e
const VALVE = 0x28de

const MODELOS: Record<number, Record<number, { model: ControllerModel; label: string }>> = {
  [SONY]: {
    0x05c4: { model: "dualshock4", label: "DualShock 4" },
    0x09cc: { model: "dualshock4", label: "DualShock 4 (v2)" },
    0x0ba0: { model: "dualshock4", label: "DualShock 4 (adaptador sem fio)" },
    0x0ce6: { model: "dualsense", label: "DualSense" },
    0x0df2: { model: "dualsense_edge", label: "DualSense Edge" },
  },
  [MICROSOFT]: {
    0x02d1: { model: "xbox_one", label: "Xbox One" },
    0x02dd: { model: "xbox_one", label: "Xbox One" },
    0x02e3: { model: "xbox_elite", label: "Xbox Elite" },
    0x02ea: { model: "xbox_one", label: "Xbox One S" },
    0x02fd: { model: "xbox_one", label: "Xbox One S (Bluetooth)" },
    0x0b00: { model: "xbox_elite", label: "Xbox Elite Series 2" },
    0x0b05: { model: "xbox_elite", label: "Xbox Elite Series 2 (Bluetooth)" },
    0x0b12: { model: "xbox_series", label: "Xbox Series X|S" },
    0x0b13: { model: "xbox_series", label: "Xbox Series X|S (Bluetooth)" },
    0x0b20: { model: "xbox_series", label: "Xbox Series X|S (Bluetooth)" },
    0x0b21: { model: "xbox_series", label: "Xbox Series X|S" },
    0x0b22: { model: "xbox_series", label: "Xbox Series X|S" },
  },
  [NINTENDO]: {
    0x2009: { model: "switch_pro", label: "Switch Pro Controller" },
  },
  [VALVE]: {
    0x1102: { model: "steam_controller", label: "Steam Controller" },
    0x1142: { model: "steam_controller", label: "Steam Controller" },
    0x11ff: { model: "steam_deck", label: "Steam Deck" },
  },
}

/** PIDs que so existem em modo Bluetooth. Unico sinal confiavel de conexao. */
const SO_BLUETOOTH = new Set([0x02fd, 0x0b05, 0x0b13, 0x0b20])

/**
 * Extrai VendorId/ProductId do `gamepad.id`.
 *
 * Dois formatos, porque o Chromium mudou de um para o outro entre plataformas e
 * versoes e os dois ainda aparecem em campo:
 *   "... (Vendor: 054c Product: 0ce6)"   — Windows/Linux
 *   "054c-0ce6-Wireless Controller"      — macOS e Chromium antigo
 */
export function identificadoresDoId(id: string): { vendorId: number | null; productId: number | null } {
  const rotulado = /vendor:\s*([0-9a-f]{4}).*?product:\s*([0-9a-f]{4})/i.exec(id)
  if (rotulado) {
    return { vendorId: Number.parseInt(rotulado[1], 16), productId: Number.parseInt(rotulado[2], 16) }
  }
  const prefixado = /^([0-9a-f]{4})-([0-9a-f]{4})-/i.exec(id)
  if (prefixado) {
    return { vendorId: Number.parseInt(prefixado[1], 16), productId: Number.parseInt(prefixado[2], 16) }
  }
  return { vendorId: null, productId: null }
}

function familiaPorTexto(id: string): ControllerFamily {
  const t = id.toLowerCase()
  // Xbox primeiro: "wireless controller" tambem casa com Sony, mas nenhum Sony
  // se anuncia como xinput.
  if (t.includes("xbox") || t.includes("xinput")) return "xbox"
  if (t.includes("dualsense") || t.includes("dualshock") || t.includes("playstation") || t.includes("sony")) {
    return "playstation"
  }
  if (t.includes("nintendo") || t.includes("switch") || t.includes("joy-con")) return "nintendo"
  if (t.includes("steam")) return "steam"
  if (t.includes("wireless controller")) return "playstation"
  return "generic"
}

function familiaPorFabricante(vendorId: number | null): ControllerFamily | null {
  switch (vendorId) {
    case SONY: return "playstation"
    case MICROSOFT: return "xbox"
    case NINTENDO: return "nintendo"
    case VALVE: return "steam"
    default: return null
  }
}

function perfilPara(model: ControllerModel, family: ControllerFamily, mapping: string): IdDoPerfil {
  // `mapping === "standard"` e o navegador garantindo que ja normalizou. Vale
  // mais que qualquer palpite nosso — so saimos dele quando ele NAO garante.
  const cru = mapping !== "standard"
  if (family === "playstation") {
    if (cru) return "directinput_sony"
    if (model === "dualsense") return "dualsense"
    if (model === "dualsense_edge") return "dualsense_edge"
    if (model === "dualshock4") return "dualshock4"
    return "dualshock4"
  }
  if (family === "xbox") {
    if (model === "xbox_series") return "xbox_series"
    if (model === "xbox_one" || model === "xbox_elite") return "xbox_one"
    return "standard"
  }
  if (family === "steam") return "steam_input"
  return cru ? "generic" : "standard"
}

function capacidadesDe(
  family: ControllerFamily,
  model: ControllerModel,
  centroDisponivel: boolean,
): ControllerCapabilities {
  const sony = family === "playstation"
  return {
    // Vibracao vem da Gamepad Haptics API do webview e vale para qualquer
    // controle que o navegador exponha — ver lib/vibracao-do-controle.ts.
    vibration: true,
    // Gatilho adaptativo do DualSense NAO passa pela Web Gamepad API. Marcamos
    // a capacidade porque o hardware a tem, mas nada no jogo depende dela.
    triggerVibration: model === "dualsense" || model === "dualsense_edge",
    touchpad: sony,
    gyro: sony || model === "switch_pro",
    centerButton: centroDisponivel,
  }
}

export interface ContextoDeIdentificacao {
  /** O backend nativo consegue ler o botao central agora? */
  centroNativoDisponivel: boolean
}

/** Transforma um `Gamepad` do navegador num dispositivo identificado. */
export function identificar(
  gamepad: Gamepad,
  contexto: ContextoDeIdentificacao = { centroNativoDisponivel: false },
): ControllerDevice {
  const { vendorId, productId } = identificadoresDoId(gamepad.id)
  const family = familiaPorFabricante(vendorId) ?? familiaPorTexto(gamepad.id)

  const conhecido = vendorId != null && productId != null ? MODELOS[vendorId]?.[productId] : undefined
  const model: ControllerModel =
    conhecido?.model ?? (family === "xbox" ? "xbox_generic" : "unknown")

  const label =
    conhecido?.label ??
    (family === "xbox"
      ? "Xbox Wireless Controller"
      : family === "playstation"
        ? "Controle PlayStation"
        : family === "nintendo"
          ? "Controle Nintendo"
          : family === "steam"
            ? "Steam Input"
            : "Controle")

  const perfilId = perfilPara(model, family, gamepad.mapping)
  const profile = PERFIS[perfilId]

  // O botao central so e "capacidade" quando existe caminho REAL: ou o perfil o
  // entrega pelo webview (Sony), ou o backend nativo consegue le-lo (Xbox).
  // Fora disso a interface tem de ensinar o fallback, nao o botao.
  const centerButton =
    (profile.centroNoWebview && gamepad.buttons.length > profile.botoes.CENTER) ||
    (family === "xbox" && contexto.centroNativoDisponivel)

  const connection: ControllerConnection =
    productId != null && SO_BLUETOOTH.has(productId)
      ? "bluetooth"
      : perfilId === "directinput_sony"
        ? // Sony em DirectInput cru quase sempre e Bluetooth sem driver: por USB
          // o Windows costuma entregar o mapeamento padrao.
          "bluetooth"
        : family === "xbox"
          ? "wireless"
          : "unknown"

  return {
    id: `${vendorId ?? "x"}:${productId ?? "x"}:${gamepad.index}`,
    index: gamepad.index,
    rawName: gamepad.id,
    vendorId,
    productId,
    family,
    model,
    connection,
    capabilities: capacidadesDe(family, model, centerButton),
    profile,
    label,
    battery: null,
  }
}

/** Familia de glifos a usar. Nintendo herda Xbox (mesmo losango invertido? nao — ver glyphs). */
export function familiaDeGlifo(family: ControllerFamily): "xbox" | "playstation" | "nintendo" | "generic" {
  if (family === "playstation") return "playstation"
  if (family === "nintendo") return "nintendo"
  if (family === "xbox" || family === "steam") return "xbox"
  return "generic"
}
