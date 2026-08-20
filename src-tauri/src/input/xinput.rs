// BACKEND XINPUT — o unico lugar do projeto que enxerga o botao Xbox.
//
// ── Por que precisa existir ──────────────────────────────────────────────────
// O jogo roda numa WebView2, e a Web Gamepad API do Chromium le os controles
// Xbox por `XInputGetState`. Essa funcao, a documentada, NAO reporta o Guide:
// a Microsoft reservou o bit 0x0400 e o omitiu da mascara publica. Resultado
// pratico: `buttons[16]` simplesmente nao chega para controle Xbox no Windows,
// e o pedido "apertar o botao Xbox liga o Modo Controle" era impossivel de
// atender do lado do JavaScript. So por isso este modulo existe.
//
// ── Por que ordinal 100 e nao SDL/GameInput ─────────────────────────────────
// `XInputGetStateEx` e a MESMA funcao com a mascara completa. Ela e exportada
// so por ordinal (100) em xinput1_4.dll e xinput1_3.dll — DLLs da propria
// Microsoft, que ja estao carregadas no processo. Resolver um ordinal por
// `GetProcAddress` nao e hook, nao e injecao, nao e driver e nao le memoria de
// ninguem: e a chamada normal de uma funcao exportada, so que sem nome.
//
// As alternativas foram medidas e descartadas:
//   - gilrs: usa XInput publico. Nao ve o Guide. Falharia o requisito principal.
//   - SDL2/SDL3: resolve, mas por dentro faz EXATAMENTE isto aqui — e obrigaria
//     a empacotar SDL3.dll e cmake no build, por uma funcao.
//   - GameInput: e a API oficial e teria sido a primeira escolha, mas nao tem
//     bindings no crate `windows` (nao esta no metadata do Win32); exigiria FFI
//     escrita a mao mais o redistribuivel no Windows 10.
//
// Custo desta escolha: ZERO crates novas. So uma feature a mais no `windows`
// que ja era dependencia (`Win32_System_LibraryLoader`).
//
// ── Se o ordinal nao existir ────────────────────────────────────────────────
// xinput9_1_0.dll nao tem o 100. Nesse caso NAO caimos em gambiarra: o modulo
// reporta `Unavailable` e o jogo passa a ensinar a combinacao de fallback.
// Prometer o botao e nao entregar e pior do que nunca ter prometido.

#![cfg(target_os = "windows")]

use std::sync::OnceLock;

use windows::core::{s, PCSTR};
use windows::Win32::Foundation::HMODULE;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};

/// Bit do Guide/Nexus. Ausente da mascara publica do SDK de proposito.
pub const XINPUT_GAMEPAD_GUIDE: u16 = 0x0400;

const ERROR_SUCCESS: u32 = 0;
pub const XUSER_MAX_COUNT: u32 = 4;

/// Copia local de XINPUT_STATE.
///
/// Por que nao usar o tipo do crate `windows`: entre versoes do crate os campos
/// de `XINPUT_GAMEPAD` trocaram de `u16` cru para newtypes (`XINPUT_GAMEPAD_
/// BUTTON_FLAGS`). Um `bump` de dependencia quebraria a compilacao deste
/// arquivo por um detalhe que nao nos interessa. O layout binario e estavel ha
/// vinte anos — declara-lo aqui deixa o modulo imune a isso, e de quebra
/// dispensa a feature `Win32_UI_Input_XboxController`.
#[repr(C)]
#[derive(Clone, Copy, Default)]
pub struct XInputStateRaw {
    pub packet_number: u32,
    pub buttons: u16,
    pub left_trigger: u8,
    pub right_trigger: u8,
    pub thumb_lx: i16,
    pub thumb_ly: i16,
    pub thumb_rx: i16,
    pub thumb_ry: i16,
}

type XInputGetStateFn = unsafe extern "system" fn(u32, *mut XInputStateRaw) -> u32;

/// Como este processo consegue (ou nao) ler o botao central.
pub struct XInputBackend {
    get_state: Option<XInputGetStateFn>,
    /// Se a funcao resolvida enxerga o Guide. `XInputGetState` puro nao enxerga.
    ve_guide: bool,
    /// Nome legivel para diagnostico ("xinput1_4.dll#100").
    origem: String,
}

impl XInputBackend {
    pub fn ve_guide(&self) -> bool {
        self.ve_guide
    }

    pub fn origem(&self) -> &str {
        &self.origem
    }

    /// Le um slot. `None` = nada conectado nesse slot.
    pub fn ler(&self, slot: u32) -> Option<XInputStateRaw> {
        let f = self.get_state?;
        let mut estado = XInputStateRaw::default();
        // SAFETY: `f` veio de GetProcAddress numa DLL do sistema e tem esta
        // assinatura desde o XInput 1.1; `estado` e um buffer valido, do
        // tamanho exato que a funcao escreve.
        let rc = unsafe { f(slot, &mut estado as *mut _) };
        if rc == ERROR_SUCCESS {
            Some(estado)
        } else {
            // Qualquer outro codigo (ERROR_DEVICE_NOT_CONNECTED = 1167 e o
            // esperado) significa "slot vazio". Nao e erro, e o caso normal:
            // tres dos quatro slots ficam assim o tempo todo.
            None
        }
    }
}

/// Resolve o backend UMA vez por processo.
///
/// A ordem importa. 1_4 e a versao do Windows 8+; 1_3 e a do runtime do DirectX
/// e existe em praticamente toda maquina com jogo instalado; 9_1_0 e o fallback
/// universal e o unico SEM o ordinal 100 — por isso e o ultimo e entra so como
/// "consigo ler o controle, mas nao o Guide".
pub fn backend() -> &'static XInputBackend {
    static BACKEND: OnceLock<XInputBackend> = OnceLock::new();
    BACKEND.get_or_init(resolver)
}

fn resolver() -> XInputBackend {
    const COM_ORDINAL: [PCSTR; 2] = [s!("xinput1_4.dll"), s!("xinput1_3.dll")];

    for nome in COM_ORDINAL {
        let Some(modulo) = carregar(nome) else { continue };
        // MAKEINTRESOURCEA(100): um PCSTR cujo "ponteiro" e o proprio numero do
        // ordinal. E assim que a API do Windows recebe ordinal em vez de nome.
        if let Some(f) = resolver_proc(modulo, PCSTR(100 as *const u8)) {
            return XInputBackend {
                get_state: Some(f),
                ve_guide: true,
                origem: format!("{}#100", texto(nome)),
            };
        }
        // A DLL existe mas nao exporta o 100 (acontece com wrappers de terceiros
        // instalados por cima, tipo x360ce antigo). Ainda serve para saber quais
        // slots estao ocupados — so nao serve para o Guide.
        if let Some(f) = resolver_proc(modulo, s!("XInputGetState")) {
            return XInputBackend {
                get_state: Some(f),
                ve_guide: false,
                origem: format!("{}!XInputGetState", texto(nome)),
            };
        }
    }

    if let Some(modulo) = carregar(s!("xinput9_1_0.dll")) {
        if let Some(f) = resolver_proc(modulo, s!("XInputGetState")) {
            return XInputBackend {
                get_state: Some(f),
                ve_guide: false,
                origem: "xinput9_1_0.dll!XInputGetState".into(),
            };
        }
    }

    XInputBackend { get_state: None, ve_guide: false, origem: "nenhuma".into() }
}

fn carregar(nome: PCSTR) -> Option<HMODULE> {
    // SAFETY: nome e um literal C valido e estatico.
    unsafe { LoadLibraryA(nome) }.ok()
}

fn resolver_proc(modulo: HMODULE, entrada: PCSTR) -> Option<XInputGetStateFn> {
    // SAFETY: `modulo` veio de LoadLibraryA e nunca e liberado (vive o processo
    // inteiro, como toda DLL de sistema). O transmute troca o ponteiro opaco
    // pela assinatura real da funcao, que e conhecida e estavel.
    unsafe {
        let proc = GetProcAddress(modulo, entrada)?;
        Some(std::mem::transmute::<unsafe extern "system" fn() -> isize, XInputGetStateFn>(proc))
    }
}

fn texto(nome: PCSTR) -> String {
    // SAFETY: literal C terminado em nul.
    unsafe { nome.to_string() }.unwrap_or_else(|_| "?".into())
}
