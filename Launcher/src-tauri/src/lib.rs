// Ultrafoot Launcher — backend nativo.
//
// Responsabilidades:
//   • detectar a versão do Ultrafoot 26 instalada (registro do Windows);
//   • consultar a última versão publicada (latest.json no GitHub);
//   • baixar o setup.exe com progresso e instalar/atualizar EM SILÊNCIO (/S);
//   • abrir o jogo instalado.
//
// O mesmo latest.json que o updater do jogo usava — assim launcher e jogo
// enxergam exatamente a mesma "última versão".

use serde::Serialize;
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter};

const LATEST_JSON_URL: &str =
    "https://github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json";

#[derive(Serialize, Clone, Default)]
struct InstalledGame {
    installed: bool,
    version: Option<String>,
    path: Option<String>,
}

#[derive(Serialize, Clone)]
struct LatestInfo {
    version: String,
    notes: String,
    url: String,
}

#[derive(Serialize, Clone)]
struct Progress {
    phase: &'static str,
    percent: u32,
    downloaded: u64,
    total: u64,
}

// ─── Detecção do jogo instalado ──────────────────────────────────────────────

#[cfg(windows)]
fn read_installed_game() -> InstalledGame {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let roots = [
        (
            RegKey::predef(HKEY_CURRENT_USER),
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
    ];

    for (root, path) in roots.iter() {
        let Ok(uninstall) = root.open_subkey(*path) else {
            continue;
        };
        for name in uninstall.enum_keys().flatten() {
            let Ok(sub) = uninstall.open_subkey(&name) else {
                continue;
            };
            let display: String = sub.get_value("DisplayName").unwrap_or_default();
            if !display.to_lowercase().contains("ultrafoot") {
                continue;
            }
            // Ignora a própria entrada do launcher — queremos o JOGO.
            if display.to_lowercase().contains("launcher") {
                continue;
            }
            let version: String = sub.get_value("DisplayVersion").unwrap_or_default();
            let install_loc: String = sub.get_value("InstallLocation").unwrap_or_default();
            let display_icon: String = sub.get_value("DisplayIcon").unwrap_or_default();
            return InstalledGame {
                installed: true,
                version: (!version.is_empty()).then_some(version),
                path: resolve_game_exe(&install_loc, &display_icon),
            };
        }
    }
    InstalledGame::default()
}

#[cfg(windows)]
fn resolve_game_exe(install_loc: &str, display_icon: &str) -> Option<String> {
    use std::path::Path;

    if !install_loc.is_empty() {
        let direct = Path::new(install_loc).join("Ultrafoot 26.exe");
        if direct.exists() {
            return Some(direct.to_string_lossy().into_owned());
        }
        if let Ok(entries) = std::fs::read_dir(install_loc) {
            for entry in entries.flatten() {
                let p = entry.path();
                let is_exe = p
                    .extension()
                    .map(|x| x.eq_ignore_ascii_case("exe"))
                    .unwrap_or(false);
                let stem = p
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if is_exe && stem.contains("ultrafoot") && !stem.contains("launcher") {
                    return Some(p.to_string_lossy().into_owned());
                }
            }
        }
    }

    // DisplayIcon costuma ser "C:\...\Ultrafoot 26.exe,0".
    if !display_icon.is_empty() {
        let icon = display_icon
            .split(',')
            .next()
            .unwrap_or(display_icon)
            .trim()
            .trim_matches('"');
        if Path::new(icon).exists() {
            return Some(icon.to_string());
        }
    }
    None
}

#[cfg(not(windows))]
fn read_installed_game() -> InstalledGame {
    InstalledGame::default()
}

// ─── Comandos expostos à UI ──────────────────────────────────────────────────

#[tauri::command]
fn get_installed_game() -> InstalledGame {
    read_installed_game()
}

#[tauri::command]
fn fetch_latest() -> Result<LatestInfo, String> {
    let body: serde_json::Value = ureq::get(LATEST_JSON_URL)
        .call()
        .map_err(|e| format!("falha ao consultar atualizações: {e}"))?
        .into_json()
        .map_err(|e| format!("latest.json inválido: {e}"))?;

    let version = body
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let notes = body
        .get("notes")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let url = body
        .get("platforms")
        .and_then(|p| p.get("windows-x86_64"))
        .and_then(|w| w.get("url"))
        .and_then(|u| u.as_str())
        .unwrap_or_default()
        .to_string();

    if version.is_empty() || url.is_empty() {
        return Err("latest.json sem versão ou URL do Windows".into());
    }
    Ok(LatestInfo { version, notes, url })
}

#[tauri::command]
async fn download_and_install(app: AppHandle, url: String) -> Result<(), String> {
    // Trabalho bloqueante (rede + processo) fora da thread do webview.
    tauri::async_runtime::spawn_blocking(move || do_install(&app, &url))
        .await
        .map_err(|e| format!("tarefa interrompida: {e}"))?
}

fn do_install(app: &AppHandle, url: &str) -> Result<(), String> {
    // 1) baixa o setup.exe para a pasta temporária, reportando progresso real.
    let resp = ureq::get(url)
        .call()
        .map_err(|e| format!("download falhou: {e}"))?;
    let total: u64 = resp
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let tmp = std::env::temp_dir().join("Ultrafoot-setup.exe");
    let mut file = std::fs::File::create(&tmp)
        .map_err(|e| format!("não consegui criar o arquivo temporário: {e}"))?;
    let mut reader = resp.into_reader();
    let mut buf = [0u8; 262_144];
    let mut downloaded: u64 = 0;
    let mut last_percent: u32 = u32::MAX;

    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("erro ao baixar: {e}"))?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])
            .map_err(|e| format!("erro ao gravar: {e}"))?;
        downloaded += n as u64;

        let percent = if total > 0 {
            ((downloaded.saturating_mul(100)) / total) as u32
        } else {
            0
        };
        if percent != last_percent {
            last_percent = percent;
            let _ = app.emit(
                "launcher://progress",
                Progress {
                    phase: "downloading",
                    percent: percent.min(100),
                    downloaded,
                    total,
                },
            );
        }
    }
    file.flush().ok();
    drop(file);

    // 2) instala/atualiza em SILÊNCIO (/S do NSIS). O launcher mostra "Instalando…".
    let _ = app.emit(
        "launcher://progress",
        Progress {
            phase: "installing",
            percent: 100,
            downloaded,
            total,
        },
    );

    let status = std::process::Command::new(&tmp)
        .arg("/S")
        .status()
        .map_err(|e| format!("não consegui iniciar o instalador: {e}"))?;

    if !status.success() {
        return Err(format!(
            "o instalador terminou com erro (código {})",
            status.code().unwrap_or(-1)
        ));
    }

    let _ = std::fs::remove_file(&tmp);
    let _ = app.emit(
        "launcher://progress",
        Progress {
            phase: "done",
            percent: 100,
            downloaded,
            total,
        },
    );
    Ok(())
}

#[tauri::command]
fn launch_game(path: Option<String>) -> Result<(), String> {
    let exe = path
        .filter(|p| !p.is_empty())
        .or_else(|| read_installed_game().path)
        .ok_or_else(|| "não encontrei o executável do jogo".to_string())?;

    std::process::Command::new(&exe)
        .spawn()
        .map_err(|e| format!("não consegui abrir o jogo: {e}"))?;
    Ok(())
}

// ─── Entrada do app ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_installed_game,
            fetch_latest,
            download_and_install,
            launch_game
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Ultrafoot Launcher");
}
