// Ultrafoot Launcher — backend nativo (Windows, Linux e macOS).
//
// Responsabilidades:
//   • detectar a versão do Ultrafoot 26 instalada;
//   • consultar a última versão publicada por plataforma;
//   • baixar e instalar/atualizar o jogo (com progresso);
//   • abrir o jogo instalado.
//
// Windows: setup.exe (NSIS) via latest.json.
// Linux:   .AppImage colocado em ~/.local/share/UltrafootLauncher, chmod +x.
// macOS:   .dmg montado e o .app copiado para ~/Applications.
// Em Linux/macOS o launcher guarda a versão/caminho num game.json próprio (não há
// registro do Windows).

use serde::Serialize;
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter};

const LATEST_JSON_URL: &str =
    "https://github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json";

// Endpoint estável do PRÓPRIO launcher (release rolling "launcher").
const LAUNCHER_UPDATE_URL: &str =
    "https://github.com/jovemegidio/Ultrafoot26/releases/download/launcher/launcher.json";

// Configuração remota do launcher (notícias, banner, redes, status do servidor).
const LAUNCHER_CONFIG_URL: &str =
    "https://github.com/jovemegidio/Ultrafoot26/releases/download/launcher/launcher-config.json";

// Releases multiplataforma (Linux/macOS) publicados pela CI: tags "desktop-<versão>".
#[cfg(not(windows))]
const RELEASES_API_URL: &str =
    "https://api.github.com/repos/jovemegidio/Ultrafoot26/releases?per_page=30";

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
    /// bytes por segundo (0 quando não aplicável)
    speed: u64,
    /// segundos restantes estimados (0 quando desconhecido)
    eta: u64,
}

fn emit(app: &AppHandle, phase: &'static str) {
    let _ = app.emit(
        "launcher://progress",
        Progress { phase, percent: 100, downloaded: 0, total: 0, speed: 0, eta: 0 },
    );
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

// ── Linux/macOS: o launcher gerencia a instalação e guarda um game.json ──

#[cfg(not(windows))]
fn launcher_data_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    #[cfg(target_os = "macos")]
    let base = std::path::Path::new(&home)
        .join("Library")
        .join("Application Support");
    #[cfg(not(target_os = "macos"))]
    let base = std::path::Path::new(&home).join(".local").join("share");
    base.join("UltrafootLauncher")
}

#[cfg(not(windows))]
fn game_meta_path() -> std::path::PathBuf {
    launcher_data_dir().join("game.json")
}

#[cfg(not(windows))]
fn write_game_meta(version: &str, path: &str) -> Result<(), String> {
    let dir = launcher_data_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("não consegui criar {}: {e}", dir.display()))?;
    let meta = serde_json::json!({ "version": version, "path": path });
    std::fs::write(game_meta_path(), meta.to_string())
        .map_err(|e| format!("não consegui salvar metadados: {e}"))?;
    Ok(())
}

#[cfg(not(windows))]
fn read_installed_game() -> InstalledGame {
    let Ok(text) = std::fs::read_to_string(game_meta_path()) else {
        return InstalledGame::default();
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        return InstalledGame::default();
    };
    let version = v.get("version").and_then(|x| x.as_str()).map(|s| s.to_string());
    let path = v.get("path").and_then(|x| x.as_str()).map(|s| s.to_string());
    let exists = path
        .as_ref()
        .map(|p| std::path::Path::new(p).exists())
        .unwrap_or(false);
    if exists {
        InstalledGame { installed: true, version, path }
    } else {
        InstalledGame::default()
    }
}

// ─── Comandos expostos à UI ──────────────────────────────────────────────────

#[tauri::command]
fn get_installed_game() -> InstalledGame {
    read_installed_game()
}

#[tauri::command]
fn fetch_latest() -> Result<LatestInfo, String> {
    #[cfg(windows)]
    {
        fetch_latest_windows()
    }
    #[cfg(target_os = "linux")]
    {
        fetch_latest_desktop(".appimage")
    }
    #[cfg(target_os = "macos")]
    {
        fetch_latest_desktop(".dmg")
    }
    #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
    {
        Err("plataforma não suportada".into())
    }
}

#[cfg(windows)]
fn fetch_latest_windows() -> Result<LatestInfo, String> {
    let body: serde_json::Value = ureq::get(LATEST_JSON_URL)
        .call()
        .map_err(|e| format!("falha ao consultar atualizações: {e}"))?
        .into_json()
        .map_err(|e| format!("latest.json inválido: {e}"))?;

    let version = body.get("version").and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let notes = body.get("notes").and_then(|v| v.as_str()).unwrap_or_default().to_string();
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

/// Linux/macOS: acha o release "desktop-*" mais recente e o asset com a extensão.
#[cfg(not(windows))]
fn fetch_latest_desktop(ext: &str) -> Result<LatestInfo, String> {
    let releases: serde_json::Value = ureq::get(RELEASES_API_URL)
        .set("User-Agent", "UltrafootLauncher")
        .call()
        .map_err(|e| format!("falha ao consultar releases: {e}"))?
        .into_json()
        .map_err(|e| format!("resposta inválida: {e}"))?;

    let arr = releases.as_array().ok_or("resposta inesperada da API")?;
    for rel in arr {
        let tag = rel.get("tag_name").and_then(|t| t.as_str()).unwrap_or("");
        if !tag.starts_with("desktop-") {
            continue;
        }
        let version = tag.trim_start_matches("desktop-").to_string();
        let notes = rel.get("body").and_then(|b| b.as_str()).unwrap_or_default().to_string();
        if let Some(assets) = rel.get("assets").and_then(|a| a.as_array()) {
            for a in assets {
                let name = a.get("name").and_then(|n| n.as_str()).unwrap_or("");
                if name.to_lowercase().ends_with(ext) {
                    let url = a
                        .get("browser_download_url")
                        .and_then(|u| u.as_str())
                        .unwrap_or_default()
                        .to_string();
                    if !url.is_empty() {
                        return Ok(LatestInfo { version, notes, url });
                    }
                }
            }
        }
    }
    Err(format!("nenhum release desktop com {ext} encontrado"))
}

#[tauri::command]
async fn download_and_install(app: AppHandle, url: String, version: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_install(&app, &url, &version))
        .await
        .map_err(|e| format!("tarefa interrompida: {e}"))?
}

/// Baixa `url` para `dest` com progresso (velocidade/ETA), RETOMANDO de um download
/// parcial e com ATÉ 3 tentativas em caso de falha de rede.
fn download_with_progress(app: &AppHandle, url: &str, dest: &std::path::Path) -> Result<(), String> {
    let _ = std::fs::remove_file(dest);

    let mut last_err = String::new();
    for attempt in 1..=3 {
        match download_attempt(app, url, dest) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = e;
                if attempt < 3 {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
            }
        }
    }
    Err(format!("download falhou após 3 tentativas: {last_err}"))
}

fn download_attempt(app: &AppHandle, url: &str, dest: &std::path::Path) -> Result<(), String> {
    use std::time::Instant;

    let existing = std::fs::metadata(dest).map(|m| m.len()).unwrap_or(0);

    let mut req = ureq::get(url);
    if existing > 0 {
        req = req.set("Range", &format!("bytes={existing}-"));
    }
    let resp = req.call().map_err(|e| format!("download falhou: {e}"))?;

    let resuming = resp.status() == 206;
    let remaining: u64 = resp
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    let start = if resuming { existing } else { 0 };
    let total = if resuming { existing + remaining } else { remaining };

    let mut file = if resuming {
        std::fs::OpenOptions::new()
            .append(true)
            .open(dest)
            .map_err(|e| format!("não consegui abrir o arquivo parcial: {e}"))?
    } else {
        std::fs::File::create(dest)
            .map_err(|e| format!("não consegui criar o arquivo temporário: {e}"))?
    };

    let mut reader = resp.into_reader();
    let mut buf = [0u8; 262_144];
    let mut downloaded: u64 = start;
    let mut last_percent: u32 = u32::MAX;
    let mut last_time = Instant::now();
    let mut last_bytes = start;

    loop {
        let n = reader.read(&mut buf).map_err(|e| format!("erro ao baixar: {e}"))?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| format!("erro ao gravar: {e}"))?;
        downloaded += n as u64;

        let percent = if total > 0 {
            ((downloaded.saturating_mul(100)) / total) as u32
        } else {
            0
        };
        if percent != last_percent {
            last_percent = percent;
            let now = Instant::now();
            let dt = now.duration_since(last_time).as_secs_f64();
            let speed = if dt > 0.05 {
                (((downloaded - last_bytes) as f64) / dt) as u64
            } else {
                0
            };
            let eta = if speed > 0 {
                total.saturating_sub(downloaded) / speed
            } else {
                0
            };
            let _ = app.emit(
                "launcher://progress",
                Progress {
                    phase: "downloading",
                    percent: percent.min(100),
                    downloaded,
                    total,
                    speed,
                    eta,
                },
            );
            if dt > 0.05 {
                last_time = now;
                last_bytes = downloaded;
            }
        }
    }
    file.flush().ok();

    if total > 0 && downloaded < total {
        return Err(format!("download incompleto ({downloaded}/{total} bytes)"));
    }
    Ok(())
}

// ── Instalação por plataforma ──

fn do_install(app: &AppHandle, url: &str, version: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = version;
        do_install_windows(app, url)
    }
    #[cfg(target_os = "linux")]
    {
        do_install_linux(app, url, version)
    }
    #[cfg(target_os = "macos")]
    {
        do_install_macos(app, url, version)
    }
    #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
    {
        let _ = (app, url, version);
        Err("plataforma não suportada".into())
    }
}

#[cfg(windows)]
fn do_install_windows(app: &AppHandle, url: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    // NSIS silencioso, SEM janela (pedido: instalar/atualizar dentro do launcher
    // sem abrir o instalador nem piscar console). O /S já roda sem UI; o
    // CREATE_NO_WINDOW garante que nenhum console apareça. O temp é apagado depois
    // (linha do remove_file) — não deixa rastro.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let tmp = std::env::temp_dir().join("Ultrafoot-setup.exe");
    download_with_progress(app, url, &tmp)?;
    emit(app, "installing");

    let status = std::process::Command::new(&tmp)
        .arg("/S")
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("não consegui iniciar o instalador: {e}"))?;
    if !status.success() {
        return Err(format!(
            "o instalador terminou com erro (código {})",
            status.code().unwrap_or(-1)
        ));
    }

    let _ = std::fs::remove_file(&tmp);
    emit(app, "done");
    Ok(())
}

#[cfg(target_os = "linux")]
fn do_install_linux(app: &AppHandle, url: &str, version: &str) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let tmp = std::env::temp_dir().join("Ultrafoot26.AppImage.part");
    download_with_progress(app, url, &tmp)?;
    emit(app, "installing");

    let dir = launcher_data_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("não consegui criar {}: {e}", dir.display()))?;
    let dest = dir.join("Ultrafoot26.AppImage");

    // Move (ou copia) o AppImage baixado para o destino final.
    if std::fs::rename(&tmp, &dest).is_err() {
        std::fs::copy(&tmp, &dest).map_err(|e| format!("não consegui instalar: {e}"))?;
        let _ = std::fs::remove_file(&tmp);
    }

    // chmod +x para o AppImage ser executável.
    let mut perm = std::fs::metadata(&dest).map_err(|e| e.to_string())?.permissions();
    perm.set_mode(0o755);
    std::fs::set_permissions(&dest, perm).map_err(|e| e.to_string())?;

    write_game_meta(version, &dest.to_string_lossy())?;
    emit(app, "done");
    Ok(())
}

#[cfg(target_os = "macos")]
fn do_install_macos(app: &AppHandle, url: &str, version: &str) -> Result<(), String> {
    let dmg = std::env::temp_dir().join("Ultrafoot26.dmg");
    download_with_progress(app, url, &dmg)?;
    emit(app, "installing");

    let mount = std::env::temp_dir().join("ultrafoot-mnt");
    let _ = std::fs::create_dir_all(&mount);

    let st = std::process::Command::new("hdiutil")
        .args(["attach", "-nobrowse", "-mountpoint"])
        .arg(&mount)
        .arg(&dmg)
        .status()
        .map_err(|e| format!("hdiutil attach falhou: {e}"))?;
    if !st.success() {
        return Err("não consegui montar o .dmg".into());
    }

    let result = (|| -> Result<String, String> {
        // Acha o .app dentro do dmg montado.
        let app_src = std::fs::read_dir(&mount)
            .map_err(|e| e.to_string())?
            .flatten()
            .map(|e| e.path())
            .find(|p| p.extension().map(|x| x == "app").unwrap_or(false))
            .ok_or("não achei o .app dentro do .dmg")?;

        let home = std::env::var("HOME").map_err(|_| "sem HOME")?;
        let apps_dir = std::path::Path::new(&home).join("Applications");
        std::fs::create_dir_all(&apps_dir).ok();
        let app_name = app_src.file_name().ok_or("nome de app inválido")?;
        let dest = apps_dir.join(app_name);

        // Remove versão antiga e copia a nova.
        let _ = std::process::Command::new("rm").arg("-rf").arg(&dest).status();
        let st = std::process::Command::new("cp")
            .arg("-R")
            .arg(&app_src)
            .arg(&dest)
            .status()
            .map_err(|e| format!("cp falhou: {e}"))?;
        if !st.success() {
            return Err("não consegui copiar o app para ~/Applications".into());
        }
        Ok(dest.to_string_lossy().into_owned())
    })();

    // Desmonta o dmg sempre.
    let _ = std::process::Command::new("hdiutil").arg("detach").arg(&mount).status();
    let _ = std::fs::remove_file(&dmg);

    let dest = result?;
    write_game_meta(version, &dest)?;
    emit(app, "done");
    Ok(())
}

fn do_self_update(app: &AppHandle, url: &str) -> Result<(), String> {
    let tmp = std::env::temp_dir().join("Ultrafoot-Launcher-setup.exe");
    download_with_progress(app, url, &tmp)?;
    emit(app, "installing");
    spawn_installer_and_relaunch(&tmp)?;
    Ok(())
}

/// Roda o instalador do launcher e reabre o app — DESTACADO (Windows).
#[cfg(windows)]
fn spawn_installer_and_relaunch(setup: &std::path::Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const DETACHED_PROCESS: u32 = 0x0000_0008;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let bat = std::env::temp_dir().join("ultrafoot-launcher-update.bat");
    let script = format!(
        "@echo off\r\ntimeout /t 2 /nobreak >nul\r\n\"{}\" /S\r\nstart \"\" \"{}\"\r\ndel \"%~f0\"\r\n",
        setup.display(),
        exe.display()
    );
    std::fs::write(&bat, script)
        .map_err(|e| format!("não consegui preparar a atualização: {e}"))?;

    std::process::Command::new("cmd")
        .arg("/C")
        .arg(&bat)
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
        .spawn()
        .map_err(|e| format!("não consegui iniciar a atualização: {e}"))?;
    Ok(())
}

#[cfg(not(windows))]
fn spawn_installer_and_relaunch(_setup: &std::path::Path) -> Result<(), String> {
    Err("auto-update do launcher é suportado apenas no Windows".into())
}

/// Compara "1.0.1" > "1.0.0" numericamente, segmento a segmento.
fn is_newer(latest: &str, current: &str) -> bool {
    let parse = |s: &str| {
        s.split('.')
            .map(|p| p.parse::<u32>().unwrap_or(0))
            .collect::<Vec<u32>>()
    };
    let a = parse(latest);
    let b = parse(current);
    let n = a.len().max(b.len());
    for i in 0..n {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    false
}

#[tauri::command]
fn launch_game(app: AppHandle, path: Option<String>) -> Result<(), String> {
    let target = path
        .filter(|p| !p.is_empty())
        .or_else(|| read_installed_game().path)
        .ok_or_else(|| "não encontrei o jogo instalado".to_string())?;

    #[cfg(target_os = "macos")]
    {
        // No macOS abrimos o bundle .app com `open`.
        std::process::Command::new("open")
            .arg(&target)
            .status()
            .map_err(|e| format!("não consegui abrir o jogo: {e}"))?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        // Windows (.exe) e Linux (.AppImage): executa direto.
        // "--via-launcher" evita o redirecionamento do jogo de volta ao launcher.
        std::process::Command::new(&target)
            .arg("--via-launcher")
            .env("ULTRAFOOT_VIA_LAUNCHER", "1")
            .spawn()
            .map_err(|e| format!("não consegui abrir o jogo: {e}"))?;
    }

    app.exit(0);
    Ok(())
}

/// Versão MAIS NOVA do próprio launcher (launcher.json). Só no Windows por ora —
/// o launcher.json aponta para o setup.exe do Windows.
#[tauri::command]
fn check_launcher_update() -> Result<Option<LatestInfo>, String> {
    #[cfg(not(windows))]
    {
        return Ok(None);
    }
    #[cfg(windows)]
    {
        let body: serde_json::Value = ureq::get(LAUNCHER_UPDATE_URL)
            .call()
            .map_err(|e| format!("falha ao consultar atualização do launcher: {e}"))?
            .into_json()
            .map_err(|e| format!("launcher.json inválido: {e}"))?;

        let version = body.get("version").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let url = body.get("url").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let notes = body.get("notes").and_then(|v| v.as_str()).unwrap_or_default().to_string();

        if version.is_empty() || url.is_empty() {
            return Ok(None);
        }
        if is_newer(&version, env!("CARGO_PKG_VERSION")) {
            Ok(Some(LatestInfo { version, notes, url }))
        } else {
            Ok(None)
        }
    }
}

#[tauri::command]
async fn self_update(app: AppHandle, url: String) -> Result<(), String> {
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || do_self_update(&app2, &url))
        .await
        .map_err(|e| format!("tarefa interrompida: {e}"))??;
    app.exit(0);
    Ok(())
}

#[derive(Serialize, Clone)]
struct ServerStatus {
    online: bool,
    game_version: Option<String>,
}

#[tauri::command]
fn fetch_launcher_config() -> Result<serde_json::Value, String> {
    ureq::get(LAUNCHER_CONFIG_URL)
        .call()
        .map_err(|e| format!("falha ao buscar a configuração: {e}"))?
        .into_json()
        .map_err(|e| format!("configuração inválida: {e}"))
}

#[tauri::command]
fn check_server_status(url: String) -> ServerStatus {
    let health = format!("{}/health", url.trim_end_matches('/'));
    match ureq::get(&health)
        .timeout(std::time::Duration::from_secs(6))
        .call()
    {
        Ok(resp) => {
            let v: serde_json::Value = resp.into_json().unwrap_or(serde_json::Value::Null);
            let ok = v.get("ok").and_then(|b| b.as_bool()).unwrap_or(true);
            let game_version = v
                .get("gameVersion")
                .and_then(|s| s.as_str())
                .map(|s| s.to_string());
            ServerStatus { online: ok, game_version }
        }
        Err(_) => ServerStatus { online: false, game_version: None },
    }
}

/// Mostra e foca a janela principal (usado pela bandeja).
fn show_main(app: &AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.maximize();
        let _ = w.set_focus();
    }
}

// ─── Entrada do app ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
            use tauri::Manager;

            // O launcher SEMPRE abre em janela cheia. O `maximized` do
            // tauri.conf.json cobre o caso normal; maximizar aqui tambem garante
            // o estado quando a janela e restaurada de uma sessao anterior
            // (bandeja/auto-start), em que a config inicial nao e reaplicada.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.maximize();
            }

            let open_item = MenuItemBuilder::with_id("open", "Abrir launcher").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Sair").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&open_item, &quit_item]).build()?;

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Ultrafoot Launcher")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_installed_game,
            fetch_latest,
            download_and_install,
            launch_game,
            check_launcher_update,
            self_update,
            fetch_launcher_config,
            check_server_status
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Ultrafoot Launcher");
}
