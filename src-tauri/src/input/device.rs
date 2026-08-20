// MODELO DE DISPOSITIVO — o vocabulario que o resto do jogo usa para falar de
// controle, do lado nativo.
//
// Por que ele e MAGRO de proposito: o webview ja enxerga nome, botoes, eixos e
// (para tudo que nao e XInput) o par VendorId/ProductId dentro de `gamepad.id`.
// Duplicar isso aqui criaria duas fontes de verdade para o MESMO dado, e a
// primeira divergencia entre elas seria um bug invisivel — o glifo de um lado,
// o mapeamento do outro.
//
// O nativo responde so o que o webview NAO consegue responder:
//   - o botao central (Guide/Nexus) existe e foi apertado?
//   - qual slot XInput esta ocupado?
//   - o botao central esta disponivel para o jogo ou reservado pelo sistema?
//
// A classificacao fina (familia, modelo, geracao) vive em lib/controller/devices.ts,
// onde o VID/PID esta disponivel. Aqui so declaramos o suficiente para o
// frontend casar um slot nativo com um gamepad do navegador.

use serde::Serialize;

/// Familia do controle, do ponto de vista do backend nativo.
///
/// So `Xbox` e detectavel aqui: XInput e, por definicao, a interface dos
/// controles Xbox e dos que se disfarcam de Xbox (DS4Windows, Steam Input,
/// 8BitDo em modo XInput). Sony em modo nativo NAO aparece no XInput — ele
/// chega ao webview como HID, e e la que o classificamos.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NativeFamily {
    Xbox,
    Unknown,
}

/// Um slot XInput (0..3) e o que sabemos dele agora.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSlot {
    /// Indice XInput. E ele que o frontend usa para casar com `Gamepad.index`
    /// quando o navegador reporta `mapping: "standard"` — a ordem coincide.
    pub slot: u32,
    pub connected: bool,
    pub family: NativeFamily,
    /// Verdadeiro quando ESTE slot esta sendo lido pela variante que enxerga o
    /// Guide. Falso significa "conectado, mas o botao central e cego aqui".
    pub center_button_readable: bool,
    /// Estado ao vivo do botao central. So confiavel com `center_button_readable`.
    pub center_button_pressed: bool,
    /// `dwPacketNumber` do XInput. Muda a cada leitura com atividade; serve de
    /// prova de vida sem precisar copiar o estado inteiro para o frontend.
    pub packet: u32,
}

impl NativeSlot {
    pub fn vazio(slot: u32) -> Self {
        Self {
            slot,
            connected: false,
            family: NativeFamily::Unknown,
            center_button_readable: false,
            center_button_pressed: false,
            packet: 0,
        }
    }
}
