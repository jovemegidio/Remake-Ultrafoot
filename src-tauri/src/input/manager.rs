// LACO NATIVO — uma thread, sozinha, so para o botao central.
//
// ── O que este laco NAO faz ─────────────────────────────────────────────────
// Ele nao le botoes A/B/X/Y, nao le analogico e nao le gatilho. Isso e de
// proposito, e e a decisao de arquitetura mais importante do modulo.
//
// O webview JA le tudo isso a 60 Hz, com o tratamento correto de DirectInput
// para DualShock/DualSense (ver hooks/use-gamepad.ts — ordem de botoes trocada
// e D-pad no hat switch do eixo 9). Ler de novo aqui criaria DUAS fontes para o
// mesmo aperto, atravessando o IPC do Tauri: na melhor hipotese o A dispararia
// duas vezes, na pior as duas fontes discordariam sobre o estado e o jogo
// ficaria com um botao "grudado". Nao ha ganho de latencia que pague isso — o
// IPC e mais lento que o polling local, nao mais rapido.
//
// Entao o nativo entrega exatamente o que falta: o Guide, a ocupacao dos slots
// e a capability. Um dado que o webview nao tem, e nada que ele ja tenha.
//
// ── Custo em CPU ────────────────────────────────────────────────────────────
// `XInputGetState` num slot VAZIO e caro: a chamada percorre a enumeracao de
// dispositivos e chega a custar mais de 1 ms. Quatro slots vazios a 60 Hz seriam
// 4 ms a cada 16 ms de uma thread — num jogo que precisa de folga para simular
// temporada, isso e inaceitavel e apareceria como engasgo.
//
// Por isso o laco tem duas marchas: com controle ligado, 60 Hz (o botao central
// precisa parecer instantaneo); sem nenhum controle, 4 Hz. O atraso de ate
// 250 ms para NOTAR um controle novo nao incomoda ninguem, porque quem avisa
// que apareceu controle e o evento `gamepadconnected` do webview, que e
// imediato e chama `input_native_wake`.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
use super::capability::steam_esta_hospedando;
use super::capability::{CenterButtonCapability, CenterButtonReport};
use super::device::NativeSlot;
#[cfg(target_os = "windows")]
use super::device::NativeFamily;

/// Evento de botao central. O frontend trata como "o jogador PEDIU o Modo
/// Controle" — nunca como um botao de jogo qualquer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CenterButtonEvent {
    pub slot: u32,
    /// "xinput" hoje. Existe para que o frontend possa distinguir a origem
    /// quando um dia houver um segundo backend, sem mudar o contrato.
    pub source: String,
}

/// Retrato completo do backend nativo. Vai no evento `uf:input:native` e e o
/// que a tela de depuracao mostra.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSnapshot {
    pub running: bool,
    pub platform_supported: bool,
    pub center_button: CenterButtonReport,
    pub slots: Vec<NativeSlot>,
    /// Quantos slots estao ocupados. O frontend usa para decidir a marcha do
    /// proprio polling sem precisar varrer a lista.
    pub connected_count: u32,
}

struct EstadoDoLaco {
    parar: Arc<AtomicBool>,
    rodando: bool,
}

fn estado() -> &'static Mutex<EstadoDoLaco> {
    static ESTADO: OnceLock<Mutex<EstadoDoLaco>> = OnceLock::new();
    ESTADO.get_or_init(|| {
        Mutex::new(EstadoDoLaco { parar: Arc::new(AtomicBool::new(false)), rodando: false })
    })
}

/// Ultimo retrato publicado, para responder `input_native_snapshot` sem esperar
/// a proxima volta do laco.
fn ultimo() -> &'static Mutex<NativeSnapshot> {
    static ULTIMO: OnceLock<Mutex<NativeSnapshot>> = OnceLock::new();
    ULTIMO.get_or_init(|| Mutex::new(snapshot_parado()))
}

/// Pedido de "acorde agora" vindo do webview (ele viu `gamepadconnected` antes
/// de nos). Sem isto, ligar um controle com o jogo aberto poderia levar 250 ms
/// para ser notado pelo nativo — pouco, mas o suficiente para o primeiro aperto
/// do botao Xbox se perder, que e justamente o aperto que importa.
static ACORDAR: AtomicBool = AtomicBool::new(false);

fn snapshot_parado() -> NativeSnapshot {
    NativeSnapshot {
        running: false,
        platform_supported: cfg!(target_os = "windows"),
        center_button: CenterButtonReport::desconhecido("backend nativo ainda nao iniciado"),
        slots: (0..4).map(NativeSlot::vazio).collect(),
        connected_count: 0,
    }
}

pub fn snapshot_atual() -> NativeSnapshot {
    ultimo().lock().map(|s| s.clone()).unwrap_or_else(|_| snapshot_parado())
}

pub fn acordar() {
    ACORDAR.store(true, Ordering::Relaxed);
}

pub fn parar() {
    if let Ok(mut e) = estado().lock() {
        e.parar.store(true, Ordering::Relaxed);
        e.rodando = false;
    }
    if let Ok(mut s) = ultimo().lock() {
        s.running = false;
    }
}

pub fn iniciar(app: AppHandle) {
    let parar_flag = {
        let Ok(mut e) = estado().lock() else { return };
        if e.rodando {
            // Ja rodando. Chamar de novo e normal — o provider do React remonta
            // em Strict Mode e no hot reload; iniciar duas threads de polling
            // duplicaria os eventos de Guide e o Modo Controle piscaria.
            return;
        }
        e.parar = Arc::new(AtomicBool::new(false));
        e.rodando = true;
        e.parar.clone()
    };

    std::thread::Builder::new()
        .name("ultrafoot-input".into())
        .spawn(move || laco(app, parar_flag))
        .ok();
}

#[cfg(target_os = "windows")]
fn laco(app: AppHandle, parar_flag: Arc<AtomicBool>) {
    use super::xinput::{backend, XINPUT_GAMEPAD_GUIDE, XUSER_MAX_COUNT};

    let backend = backend();
    let mut anterior: Vec<NativeSlot> = (0..XUSER_MAX_COUNT).map(NativeSlot::vazio).collect();
    let mut ultimo_publicado: Option<String> = None;

    while !parar_flag.load(Ordering::Relaxed) {
        let mut agora: Vec<NativeSlot> = Vec::with_capacity(XUSER_MAX_COUNT as usize);
        let mut ligados = 0u32;

        for slot in 0..XUSER_MAX_COUNT {
            match backend.ler(slot) {
                Some(estado) => {
                    ligados += 1;
                    let guide = backend.ve_guide() && (estado.buttons & XINPUT_GAMEPAD_GUIDE) != 0;
                    agora.push(NativeSlot {
                        slot,
                        connected: true,
                        family: NativeFamily::Xbox,
                        center_button_readable: backend.ve_guide(),
                        center_button_pressed: guide,
                        packet: estado.packet_number,
                    });
                }
                None => agora.push(NativeSlot::vazio(slot)),
            }
        }

        // BORDA DE SUBIDA, nunca o estado cru. Emitir enquanto o botao esta
        // segurado mandaria ~60 eventos por segundo pelo IPC e o Modo Controle
        // ligaria e desligaria junto. So o instante do aperto interessa.
        for (novo, velho) in agora.iter().zip(anterior.iter()) {
            if novo.center_button_pressed && !velho.center_button_pressed {
                let _ = app.emit(
                    "uf:input:center",
                    CenterButtonEvent { slot: novo.slot, source: "xinput".into() },
                );
            }
        }

        let relatorio = relatorio_do_centro(backend.ve_guide(), backend.origem(), ligados);
        let retrato = NativeSnapshot {
            running: true,
            platform_supported: true,
            center_button: relatorio,
            slots: agora.clone(),
            connected_count: ligados,
        };

        // So publica quando a TOPOLOGIA muda (conectou, desconectou, capability
        // mudou). O `packet` sobe a cada movimento do analogico; incluir isso na
        // assinatura faria o retrato ser reemitido a 60 Hz e cada emissao vira
        // um render no React. A chave e de proposito grosseira.
        let mapa_de_ocupacao: String =
            agora.iter().map(|s| if s.connected { '1' } else { '0' }).collect();
        let assinatura = format!(
            "{}|{}|{:?}",
            ligados, mapa_de_ocupacao, retrato.center_button.capability
        );
        if ultimo_publicado.as_deref() != Some(assinatura.as_str()) {
            let _ = app.emit("uf:input:native", retrato.clone());
            ultimo_publicado = Some(assinatura);
        }
        if let Ok(mut s) = ultimo().lock() {
            *s = retrato;
        }

        anterior = agora;

        // Duas marchas (ver cabecalho). `acordar()` derruba a marcha lenta na
        // hora, sem esperar os 250 ms.
        let intervalo: u64 = if ligados > 0 { 16 } else { 250 };
        let mut restante = intervalo;
        while restante > 0 && !parar_flag.load(Ordering::Relaxed) {
            if ACORDAR.swap(false, Ordering::Relaxed) {
                break;
            }
            let passo = restante.min(16);
            std::thread::sleep(Duration::from_millis(passo));
            restante -= passo;
        }
    }

    if let Ok(mut s) = ultimo().lock() {
        s.running = false;
    }
}

#[cfg(not(target_os = "windows"))]
fn laco(app: AppHandle, _parar_flag: Arc<AtomicBool>) {
    // Linux/macOS/mobile: nao ha backend de botao central por enquanto. O jogo
    // continua 100% jogavel no controle — so a ATIVACAO pelo botao central cai
    // no fallback (View+Menu / Share+Options), que e configuravel e vale em
    // qualquer plataforma. Publicamos o retrato uma vez para que a tela de
    // configuracoes possa dizer isso ao jogador em vez de ficar em silencio.
    let retrato = NativeSnapshot {
        running: true,
        platform_supported: false,
        center_button: CenterButtonReport {
            capability: CenterButtonCapability::Unavailable,
            backend: "nenhuma".into(),
            reason: "leitura do botao central so implementada no Windows".into(),
        },
        slots: (0..4).map(NativeSlot::vazio).collect(),
        connected_count: 0,
    };
    let _ = app.emit("uf:input:native", retrato.clone());
    if let Ok(mut s) = ultimo().lock() {
        *s = retrato;
    }
}

#[cfg(target_os = "windows")]
fn relatorio_do_centro(ve_guide: bool, origem: &str, ligados: u32) -> CenterButtonReport {
    if steam_esta_hospedando() {
        return CenterButtonReport {
            capability: CenterButtonCapability::ReservedBySystem,
            backend: origem.into(),
            reason: "o jogo foi aberto pela Steam; o botao central abre o overlay dela".into(),
        };
    }
    if !ve_guide {
        return CenterButtonReport {
            capability: CenterButtonCapability::Unavailable,
            backend: origem.into(),
            reason: "esta versao do XInput nao expoe o botao central".into(),
        };
    }
    if ligados == 0 {
        return CenterButtonReport {
            capability: CenterButtonCapability::Unknown,
            backend: origem.into(),
            reason: "nenhum controle XInput conectado para medir".into(),
        };
    }
    CenterButtonReport {
        capability: CenterButtonCapability::Available,
        backend: origem.into(),
        reason: "botao central legivel para este processo".into(),
    }
}
