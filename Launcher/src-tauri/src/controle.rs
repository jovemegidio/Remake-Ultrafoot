// PAUSAR, CANCELAR E SEGURAR A BANDA DO DOWNLOAD.
//
// O launcher já retomava um download interrompido (Range HTTP), mas o jogador
// não tinha como interromper de propósito: começou, engoliu a banda da casa até
// o fim. Quem joga online enquanto baixa, quem divide internet com mais gente ou
// quem tem franquia móvel simplesmente fechava o launcher no gerenciador de
// tarefas — e aí o arquivo parcial ficava sem dono.
//
// Três controles, os mesmos da Steam:
//   • PAUSAR  — o loop de leitura para de consumir, a conexão é mantida.
//   • CANCELAR— o loop devolve erro; o pedaço baixado FICA no disco para a
//               próxima tentativa continuar de onde parou.
//   • LIMITE  — teto de KB/s aplicado por espera calculada (balde de fichas).
//
// Tudo em estado global de propósito: só existe um download por vez no launcher
// (a trava de instância única garante um processo só), e passar um handle por
// cinco camadas de função para chegar no loop de leitura não pagaria.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tauri::{AppHandle, Emitter};

static PAUSADO: AtomicBool = AtomicBool::new(false);
static CANCELADO: AtomicBool = AtomicBool::new(false);
/// 0 = sem limite.
static LIMITE_KBPS: AtomicU64 = AtomicU64::new(0);

#[derive(serde::Serialize, Clone, Copy)]
pub struct EstadoDoDownload {
    pub pausado: bool,
    pub cancelado: bool,
    pub limite_kbps: u64,
}

fn estado() -> EstadoDoDownload {
    EstadoDoDownload {
        pausado: PAUSADO.load(Ordering::Relaxed),
        cancelado: CANCELADO.load(Ordering::Relaxed),
        limite_kbps: LIMITE_KBPS.load(Ordering::Relaxed),
    }
}

fn avisar(app: &AppHandle) {
    let _ = app.emit("launcher://download-estado", estado());
}

/// Zera pausa e cancelamento. Chamado no começo de cada trabalho de download —
/// um cancelamento antigo não pode matar o download seguinte.
pub fn iniciar(app: &AppHandle) {
    PAUSADO.store(false, Ordering::Relaxed);
    CANCELADO.store(false, Ordering::Relaxed);
    avisar(app);
}

/// Ponto de parada do loop de leitura.
///
/// Devolve `Err` quando o jogador cancelou — a mensagem é reconhecida por
/// `foi_cancelado` para a UI não mostrar "erro" em algo que ela mesma pediu.
pub fn checar(app: &AppHandle) -> Result<(), String> {
    if CANCELADO.load(Ordering::Relaxed) {
        return Err(MENSAGEM_CANCELADO.into());
    }
    if !PAUSADO.load(Ordering::Relaxed) {
        return Ok(());
    }
    avisar(app);
    while PAUSADO.load(Ordering::Relaxed) {
        if CANCELADO.load(Ordering::Relaxed) {
            return Err(MENSAGEM_CANCELADO.into());
        }
        std::thread::sleep(std::time::Duration::from_millis(150));
    }
    avisar(app);
    Ok(())
}

pub const MENSAGEM_CANCELADO: &str = "download cancelado";

/// Cancelamento não é falha: quem chamou usa isto para não gritar na tela nem
/// gastar uma das tentativas automáticas.
pub fn foi_cancelado(erro: &str) -> bool {
    erro.contains(MENSAGEM_CANCELADO)
}

/// Balde de fichas simples: mantém a média de bytes por segundo abaixo do teto
/// dormindo o que passou do orçamento. Recriado a cada tentativa de download.
pub struct Regulador {
    inicio: std::time::Instant,
    bytes: u64,
}

impl Regulador {
    pub fn novo() -> Self {
        Self { inicio: std::time::Instant::now(), bytes: 0 }
    }

    pub fn contar(&mut self, lidos: u64) {
        self.bytes += lidos;
        let limite = LIMITE_KBPS.load(Ordering::Relaxed);
        if limite == 0 {
            return;
        }
        let bytes_por_segundo = (limite * 1024) as f64;
        let devido = self.bytes as f64 / bytes_por_segundo;
        let passado = self.inicio.elapsed().as_secs_f64();
        if devido > passado {
            let espera = devido - passado;
            // Teto por espera: dormir demais de uma vez faz a barra parecer
            // travada e atrasa o atendimento do pause/cancel.
            std::thread::sleep(std::time::Duration::from_secs_f64(espera.min(0.5)));
        }
    }
}

// ─── Comandos ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn pausar_download(app: AppHandle) {
    PAUSADO.store(true, Ordering::Relaxed);
    crate::diario!("INFO", "download pausado pelo jogador");
    avisar(&app);
}

#[tauri::command]
pub fn retomar_download(app: AppHandle) {
    PAUSADO.store(false, Ordering::Relaxed);
    crate::diario!("INFO", "download retomado");
    avisar(&app);
}

/// Cancela o download em andamento.
///
/// O arquivo parcial FICA por padrão: cancelar quase sempre é "agora não", e
/// jogar fora 400 MB já baixados para depois baixar de novo seria hostil. Quem
/// quer mesmo liberar o disco pede `apagar_parcial`.
#[tauri::command]
pub fn cancelar_download(app: AppHandle, apagar_parcial: Option<bool>) {
    CANCELADO.store(true, Ordering::Relaxed);
    PAUSADO.store(false, Ordering::Relaxed); // destrava o loop para ele ver o cancelamento
    crate::diario!("INFO", "download cancelado pelo jogador");
    avisar(&app);
    if apagar_parcial.unwrap_or(false) {
        // Dá tempo de o loop soltar o arquivo antes de apagar.
        std::thread::spawn(|| {
            std::thread::sleep(std::time::Duration::from_millis(400));
            crate::limpar_parciais();
        });
    }
}

fn arquivo_de_rede() -> Option<std::path::PathBuf> {
    crate::pasta_compartilhada().map(|p| p.join("rede.json"))
}

/// Recarrega o limite salvo. Chamado na abertura do launcher.
pub fn carregar_limite() {
    let Some(arquivo) = arquivo_de_rede() else { return };
    let Ok(texto) = std::fs::read_to_string(arquivo) else { return };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&texto) else { return };
    if let Some(kbps) = v.get("limiteKbps").and_then(|x| x.as_u64()) {
        LIMITE_KBPS.store(kbps, Ordering::Relaxed);
    }
}

/// Teto de velocidade em KB/s. 0 desliga.
#[tauri::command]
pub fn definir_limite_de_banda(app: AppHandle, kbps: u64) -> Result<(), String> {
    LIMITE_KBPS.store(kbps, Ordering::Relaxed);
    if let Some(arquivo) = arquivo_de_rede() {
        let corpo = serde_json::json!({ "limiteKbps": kbps });
        std::fs::write(arquivo, corpo.to_string())
            .map_err(|e| format!("não consegui guardar o limite: {e}"))?;
    }
    crate::diario!("INFO", "limite de banda: {kbps} KB/s");
    avisar(&app);
    Ok(())
}

#[tauri::command]
pub fn estado_do_download() -> EstadoDoDownload {
    estado()
}
