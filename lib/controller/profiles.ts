// PERFIS DE CONTROLE — de indice cru para botao FISICO.
//
// ── Por que os botoes tem nome de POSICAO ───────────────────────────────────
// Nada aqui se chama "A" ou "Cross". Chamam-se FACE_DOWN, FACE_RIGHT... porque
// A e ✕ sao o MESMO botao — o de baixo do losango — e chamar um pelo nome do
// outro e a origem de metade dos bugs de controle em PC.
//
// O Xbox chama o de baixo de A e o da direita de B. O PlayStation chama o de
// baixo de ✕ e o da direita de ○. Se o codigo guardasse "A", o glifo do
// DualSense teria de perguntar "A quer dizer ✕ ou ○?" toda vez. Guardando
// FACE_DOWN, a resposta e sempre a mesma e o glifo e so uma tabela de nomes.
//
// ── Por que nao da para confiar no indice ───────────────────────────────────
// `mapping === "standard"` e o navegador dizendo "eu ja normalizei" — ai o
// indice 0 e mesmo o de baixo. Fora disso, nao:
//
//   DualShock 4 / DualSense por Bluetooth, sem DS4Windows nem Steam, chegam em
//   DirectInput cru com `mapping: ""` e a ordem □ ✕ ○ △ — indice 0 e o
//   ESQUERDO, nao o de baixo. E o D-pad nem e botao: e um hat switch no eixo 9.
//
// Isso ja estava resolvido em hooks/use-gamepad.ts e o conhecimento foi trazido
// para ca, agora como PERFIL nomeado em vez de dois `if` embutidos no laco —
// para caber Nintendo, Steam Deck e generico sem mexer no laco.

/**
 * Botao fisico, por posicao. Este e o unico vocabulario de hardware do projeto.
 */
export type PhysicalButton =
  | "FACE_DOWN"
  | "FACE_RIGHT"
  | "FACE_LEFT"
  | "FACE_UP"
  | "SHOULDER_L"
  | "SHOULDER_R"
  | "TRIGGER_L"
  | "TRIGGER_R"
  | "SELECT"
  | "START"
  | "STICK_L"
  | "STICK_R"
  | "DPAD_UP"
  | "DPAD_DOWN"
  | "DPAD_LEFT"
  | "DPAD_RIGHT"
  | "CENTER"
  | "TOUCHPAD"

export const TODOS_OS_BOTOES: readonly PhysicalButton[] = [
  "FACE_DOWN", "FACE_RIGHT", "FACE_LEFT", "FACE_UP",
  "SHOULDER_L", "SHOULDER_R", "TRIGGER_L", "TRIGGER_R",
  "SELECT", "START", "STICK_L", "STICK_R",
  "DPAD_UP", "DPAD_DOWN", "DPAD_LEFT", "DPAD_RIGHT",
  "CENTER", "TOUCHPAD",
]

export type IdDoPerfil =
  | "standard"
  | "xbox_one"
  | "xbox_series"
  | "dualshock4"
  | "dualsense"
  | "dualsense_edge"
  | "directinput_sony"
  | "steam_input"
  | "generic"

/** Como ler UM controle: onde estao os botoes e os eixos. */
export interface PerfilDeControle {
  id: IdDoPerfil
  rotulo: string
  /** Indice de cada botao no array `Gamepad.buttons`. -1 = nao existe aqui. */
  botoes: Record<PhysicalButton, number>
  /** Eixos dos analogicos. */
  eixos: { lx: number; ly: number; rx: number; ry: number }
  /**
   * Eixo do hat switch, quando o D-pad NAO e botao. -1 quando e botao.
   * So aparece em DirectInput cru.
   */
  hat: number
  /** O botao central chega pelo webview neste perfil? */
  centroNoWebview: boolean
}

/**
 * Standard Gamepad do W3C. Vale sempre que `mapping === "standard"` — que no
 * Windows e o caso de todo controle Xbox (XInput) e de Sony com driver.
 */
const STANDARD: Record<PhysicalButton, number> = {
  FACE_DOWN: 0, FACE_RIGHT: 1, FACE_LEFT: 2, FACE_UP: 3,
  SHOULDER_L: 4, SHOULDER_R: 5, TRIGGER_L: 6, TRIGGER_R: 7,
  SELECT: 8, START: 9, STICK_L: 10, STICK_R: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
  CENTER: 16, TOUCHPAD: 17,
}

/**
 * Sony em DirectInput cru. A ordem do losango e □ ✕ ○ △ — repare que FACE_DOWN
 * e 1 e FACE_LEFT e 0, o oposto do padrao. Era exatamente isso que fazia o ✕
 * (confirmar) virar □ e o ○ (voltar) virar ✕.
 */
const DIRECTINPUT_SONY: Record<PhysicalButton, number> = {
  FACE_LEFT: 0, FACE_DOWN: 1, FACE_RIGHT: 2, FACE_UP: 3,
  SHOULDER_L: 4, SHOULDER_R: 5, TRIGGER_L: 6, TRIGGER_R: 7,
  SELECT: 8, START: 9, STICK_L: 10, STICK_R: 11,
  CENTER: 12, TOUCHPAD: 13,
  // Sem botao de D-pad: vem do hat switch.
  DPAD_UP: -1, DPAD_DOWN: -1, DPAD_LEFT: -1, DPAD_RIGHT: -1,
}

function perfil(
  id: IdDoPerfil,
  rotulo: string,
  extras: Partial<Omit<PerfilDeControle, "id" | "rotulo">> = {},
): PerfilDeControle {
  return {
    id,
    rotulo,
    botoes: STANDARD,
    eixos: { lx: 0, ly: 1, rx: 2, ry: 3 },
    hat: -1,
    centroNoWebview: false,
    ...extras,
  }
}

export const PERFIS: Record<IdDoPerfil, PerfilDeControle> = {
  standard: perfil("standard", "Controle padrão"),
  // Xbox no Windows sempre entra por XInput, e o Chromium le por
  // `XInputGetState` — que NAO reporta o Guide. Por isso `centroNoWebview:
  // false` para toda a familia Xbox: o botao central so chega pelo backend
  // nativo (src-tauri/src/input). Marcar `true` aqui seria prometer um botao
  // que nunca dispara.
  xbox_one: perfil("xbox_one", "Xbox One"),
  xbox_series: perfil("xbox_series", "Xbox Series"),
  // Sony COM driver/Steam: vira standard, e ai o PS Button e o indice 16 —
  // este e o unico caso em que o botao central chega de graca ao JavaScript.
  dualshock4: perfil("dualshock4", "DualShock 4", { centroNoWebview: true }),
  dualsense: perfil("dualsense", "DualSense", { centroNoWebview: true }),
  dualsense_edge: perfil("dualsense_edge", "DualSense Edge", { centroNoWebview: true }),
  // Sony SEM driver. Alem dos botoes trocados, o analogico direito nao esta em
  // (2,3): 3 e 4 sao os gatilhos e o Y direito vai para o eixo 5. Ler (2,3)
  // devolvia a pressao do L2 como "eixo vertical" — a mira andava sozinha.
  directinput_sony: perfil("directinput_sony", "PlayStation (sem driver)", {
    botoes: DIRECTINPUT_SONY,
    eixos: { lx: 0, ly: 1, rx: 2, ry: 5 },
    hat: 9,
    centroNoWebview: true,
  }),
  // Steam Input apresenta um controle VIRTUAL em layout Xbox. O botao central
  // e consumido pela propria Steam (abre o overlay) e nunca chega ao jogo.
  steam_input: perfil("steam_input", "Steam Input"),
  generic: perfil("generic", "Controle genérico"),
}

/**
 * Direcoes ativas de um hat switch.
 *
 * O eixo devolve oito posicoes entre -1 e 1; em repouso fica em ~1.28 (fora da
 * faixa) ou exatamente 0, dependendo do driver — por isso a faixa valida e
 * conferida antes de qualquer conta.
 */
export function direcoesDoHat(valor: number | undefined): Partial<Record<PhysicalButton, boolean>> {
  if (typeof valor !== "number" || valor > 1.05 || valor < -1.05) return {}
  const graus = Math.round(((valor + 1) / 2) * 360)
  const perto = (alvo: number) => Math.abs(((graus - alvo + 540) % 360) - 180) < 68
  return {
    DPAD_UP: perto(0),
    DPAD_RIGHT: perto(90),
    DPAD_DOWN: perto(180),
    DPAD_LEFT: perto(270),
  }
}
