// Rich Presence e SO DESKTOP: a crate usa IPC do Discord (named pipes/sockets) e
// nao ha cliente Discord no Android/iOS. Guardado com cfg(desktop) para o build
// mobile nem compilar essa dependencia.
#[cfg(desktop)]
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
#[cfg(desktop)]
use std::sync::Mutex;
use tauri::Manager;

mod online_server;

/// Decodifica percent-encoding (%20, %EF%BC%82...) do caminho da URI.
///
/// request.uri().path() devolve o caminho AINDA CODIFICADO. Sem decodificar, um arquivo
/// como "Ainda Bem - Marisa Monte.webm" era procurado no disco como
/// "%EF%BC%82Ainda%20Bem..." e nunca existia -> 404. Era por isso que a musica nunca
/// tocava: o player carregava a faixa, mas o audio dava 404 silencioso.
fn percent_decode(s: &str) -> String {
    fn hex_val(b: u8) -> Option<u8> {
        match b {
            b'0'..=b'9' => Some(b - b'0'),
            b'a'..=b'f' => Some(b - b'a' + 10),
            b'A'..=b'F' => Some(b - b'A' + 10),
            _ => None,
        }
    }

    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn parse_byte_range(range: &str, total: usize) -> Option<(usize, usize)> {
    let range = range.strip_prefix("bytes=")?;
    let mut iter = range.split('-');
    let start: usize = iter.next()?.trim().parse().ok()?;
    let end_str = iter.next()?.trim();
    let end = if end_str.is_empty() {
        total.saturating_sub(1)
    } else {
        end_str.parse::<usize>().ok()?.min(total.saturating_sub(1))
    };
    if start > end {
        return None;
    }
    Some((start, end))
}

#[cfg(target_os = "windows")]
mod bluetooth_battery {
    use windows::{
        core::{IInspectable, Interface, Result, HSTRING},
        Devices::Enumeration::{DeviceInformation, DeviceInformationKind},
        Foundation::IReference,
    };
    use windows_collections::IIterable;

    const BATTERY_PROPERTY: &str = "System.Devices.Aep.Bluetooth.Le.BatteryLevel";
    const BLUETOOTH_CONNECTED_AQS: &str = "System.Devices.Aep.ProtocolId:=\"{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}\" AND System.Devices.Aep.IsConnected:=System.StructuredQueryType.Boolean#True";

    fn battery_percent(value: &IInspectable) -> Option<u8> {
        value
            .cast::<IReference<u8>>()
            .and_then(|reference| reference.Value())
            .ok()
            .or_else(|| {
                value
                    .cast::<IReference<u32>>()
                    .and_then(|reference| reference.Value())
                    .ok()
                    .and_then(|level| u8::try_from(level).ok())
            })
    }

    fn controller_score(device_name: &str, browser_name: &str) -> i32 {
        let device = device_name.to_ascii_lowercase();
        let browser = browser_name.to_ascii_lowercase();

        if !device.is_empty()
            && !browser.is_empty()
            && (browser.contains(&device) || device.contains(&browser))
        {
            return 100;
        }

        let controller_markers = [
            "controller",
            "gamepad",
            "xbox",
            "dualsense",
            "dualshock",
            "wireless controller",
            "8bitdo",
            "gamesir",
        ];

        if controller_markers
            .iter()
            .any(|marker| device.contains(marker) && browser.contains(marker))
        {
            return 80;
        }

        if controller_markers
            .iter()
            .any(|marker| device.contains(marker))
        {
            return 10;
        }

        0
    }

    pub fn level_for_controller(controller_name: &str) -> Result<Option<f32>> {
        let requested_properties = IIterable::from(vec![HSTRING::from(BATTERY_PROPERTY)]);
        let devices = DeviceInformation::FindAllAsyncWithKindAqsFilterAndAdditionalProperties(
            &HSTRING::from(BLUETOOTH_CONNECTED_AQS),
            &requested_properties,
            DeviceInformationKind::AssociationEndpoint,
        )?
        .get()?;

        let mut selected: Option<(i32, u8)> = None;
        for index in 0..devices.Size()? {
            let device = devices.GetAt(index)?;
            let name = device.Name()?.to_string_lossy();
            let score = controller_score(&name, controller_name);
            if score == 0 {
                continue;
            }

            let level = device
                .Properties()?
                .Lookup(&HSTRING::from(BATTERY_PROPERTY))
                .ok()
                .and_then(|value| battery_percent(&value));
            let Some(level) = level else {
                continue;
            };

            if selected.map_or(true, |(best_score, _)| score > best_score) {
                selected = Some((score, level));
            }
        }

        Ok(selected.map(|(_, level)| f32::from(level) / 100.0))
    }
}

// ─── Discord RPC state ────────────────────────────────────────────────────────

// Substitua pelo seu Application ID do Discord Developer Portal
// https://discord.com/developers/applications → New Application → General Information → Application ID
const DISCORD_APP_ID: &str = "1481784878197637160";

#[cfg(desktop)]
struct DiscordRpc(Mutex<Option<DiscordIpcClient>>);

#[cfg(target_os = "windows")]
mod discord_social {
    use std::ffi::c_char;

    extern "C" {
        fn uf_discord_social_init() -> bool;
        fn uf_discord_social_shutdown();
        fn uf_discord_social_login() -> bool;
        fn uf_discord_social_disconnect();
        fn uf_discord_social_snapshot(output: *mut c_char, capacity: usize) -> usize;
    }

    pub fn init() -> bool {
        unsafe { uf_discord_social_init() }
    }

    pub fn login() -> bool {
        unsafe { uf_discord_social_login() }
    }

    pub fn disconnect() {
        unsafe { uf_discord_social_disconnect() }
    }

    pub fn snapshot() -> Result<serde_json::Value, String> {
        let needed = unsafe { uf_discord_social_snapshot(std::ptr::null_mut(), 0) };
        if needed == 0 {
            return Err("Discord Social SDK não retornou estado".into());
        }
        let mut buffer = vec![0u8; needed];
        unsafe {
            uf_discord_social_snapshot(buffer.as_mut_ptr().cast(), buffer.len());
        }
        if matches!(buffer.last(), Some(0)) {
            buffer.pop();
        }
        serde_json::from_slice(&buffer).map_err(|error| error.to_string())
    }

    pub struct ShutdownGuard;
    impl Drop for ShutdownGuard {
        fn drop(&mut self) {
            unsafe { uf_discord_social_shutdown() }
        }
    }
}

#[tauri::command]
fn discord_social_snapshot() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        return discord_social::snapshot();
    }
    #[cfg(not(target_os = "windows"))]
    Ok(serde_json::json!({
        "available": false,
        "phase": "unsupported",
        "error": "Discord Social SDK ainda não está empacotado nesta plataforma",
        "detectedName": "",
        "authenticated": false,
        "user": null,
        "friends": []
    }))
}

#[tauri::command]
fn discord_social_login() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return if discord_social::login() {
            Ok(())
        } else {
            Err("Não foi possível iniciar a autenticação do Discord".into())
        };
    }
    #[cfg(not(target_os = "windows"))]
    Err("Discord Social SDK indisponível nesta plataforma".into())
}

#[tauri::command]
fn discord_social_disconnect() {
    #[cfg(target_os = "windows")]
    discord_social::disconnect();
}

#[cfg(desktop)]
#[tauri::command]
fn discord_update(
    rpc: tauri::State<DiscordRpc>,
    details: String,
    state: String,
    start_timestamp: i64,
    large_text: Option<String>,
    small_image: Option<String>,
    small_text: Option<String>,
) {
    let mut guard = rpc.0.lock().unwrap();

    // O Discord pode ser aberto depois do Ultrafoot. A conexão inicial falhar não
    // deve deixar o Rich Presence desativado durante toda a sessão.
    if guard.is_none() {
        *guard = DiscordIpcClient::new(DISCORD_APP_ID)
            .ok()
            .and_then(|mut client| client.connect().ok().map(|_| client));
    }

    if let Some(client) = guard.as_mut() {
        let mut assets = activity::Assets::new()
            .large_image("ultrafoot_logo")
            .large_text(large_text.as_deref().unwrap_or("Ultrafoot 26"));
        if let Some(image) = small_image.as_deref() {
            assets = assets.small_image(image);
        }
        if let Some(text) = small_text.as_deref() {
            assets = assets.small_text(text);
        }

        let mut presence = activity::Activity::new()
            .activity_type(activity::ActivityType::Playing)
            .details(&details)
            .state(&state)
            .assets(assets)
            .buttons(vec![activity::Button::new(
                "Conhecer Ultrafoot 26",
                "https://github.com/jovemegidio/Ultrafoot26/releases/latest",
            )]);
        if start_timestamp > 0 {
            presence = presence.timestamps(activity::Timestamps::new().start(start_timestamp));
        }
        let _ = client.set_activity(presence);
    }
}

#[cfg(desktop)]
#[tauri::command]
fn discord_clear(rpc: tauri::State<DiscordRpc>) {
    let mut guard = rpc.0.lock().unwrap();
    if let Some(client) = guard.as_mut() {
        let _ = client.clear_activity();
    }
}

#[tauri::command]
fn get_bluetooth_gamepad_battery(controller_name: String) -> Result<Option<f32>, String> {
    #[cfg(target_os = "windows")]
    {
        bluetooth_battery::level_for_controller(&controller_name).map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = controller_name;
        Ok(None)
    }
}

// ─── Player de midia do SISTEMA (Spotify, YouTube Music, etc) ────────────────
//
// O jogo NAO embute mais trilha (eram 1,6 GB e musica de terceiros). Em vez disso ele
// vira um "controle remoto" do que o jogador ja esta ouvindo, via SMTC do Windows
// (System Media Transport Controls). Funciona com qualquer player que registre uma
// sessao de midia — Spotify inclusive — sem login, sem API key e sem Premium.

#[derive(serde::Serialize, Clone, Default)]
struct NowPlaying {
    /// false quando nao ha NENHUM player tocando (a UI esconde o widget).
    available: bool,
    title: String,
    artist: String,
    album: String,
    /// Id do app da sessao (ex.: "Spotify.exe") — so para a UI dizer a fonte.
    source: String,
    is_playing: bool,
}

#[cfg(target_os = "windows")]
mod media {
    use super::NowPlaying;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };

    /// Sessao de midia ATUAL do sistema (a que o Windows considera em foco).
    fn current() -> Option<Session> {
        let manager = Manager::RequestAsync().ok()?.get().ok()?;
        manager.GetCurrentSession().ok()
    }

    pub fn now_playing() -> NowPlaying {
        let Some(session) = current() else {
            return NowPlaying::default();
        };

        let mut np = NowPlaying {
            available: true,
            ..Default::default()
        };

        if let Ok(props) = session
            .TryGetMediaPropertiesAsync()
            .and_then(|op| op.get())
        {
            np.title = props.Title().map(|s| s.to_string()).unwrap_or_default();
            np.artist = props.Artist().map(|s| s.to_string()).unwrap_or_default();
            np.album = props.AlbumTitle().map(|s| s.to_string()).unwrap_or_default();
        }

        np.source = session
            .SourceAppUserModelId()
            .map(|s| s.to_string())
            .unwrap_or_default();

        if let Ok(info) = session.GetPlaybackInfo() {
            np.is_playing = matches!(info.PlaybackStatus(), Ok(Status::Playing));
        }

        np
    }

    pub fn play_pause() -> bool {
        current()
            .and_then(|s| s.TryTogglePlayPauseAsync().ok())
            .and_then(|op| op.get().ok())
            .unwrap_or(false)
    }

    pub fn next() -> bool {
        current()
            .and_then(|s| s.TrySkipNextAsync().ok())
            .and_then(|op| op.get().ok())
            .unwrap_or(false)
    }

    pub fn previous() -> bool {
        current()
            .and_then(|s| s.TrySkipPreviousAsync().ok())
            .and_then(|op| op.get().ok())
            .unwrap_or(false)
    }
}

#[tauri::command]
fn media_now_playing() -> NowPlaying {
    #[cfg(target_os = "windows")]
    {
        media::now_playing()
    }
    // Linux (MPRIS) e macOS (MediaRemote) entram aqui depois; por ora o widget
    // simplesmente nao aparece nessas plataformas.
    #[cfg(not(target_os = "windows"))]
    {
        NowPlaying::default()
    }
}

#[tauri::command]
fn media_play_pause() -> bool {
    #[cfg(target_os = "windows")]
    {
        media::play_pause()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[tauri::command]
fn media_next() -> bool {
    #[cfg(target_os = "windows")]
    {
        media::next()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[tauri::command]
fn media_previous() -> bool {
    #[cfg(target_os = "windows")]
    {
        media::previous()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

// ─── Redirecionamento para o launcher ────────────────────────────────────────

// Ao ser aberto DIRETO (atalho, duplo-clique no .exe), o jogo abre o Ultrafoot
// Launcher primeiro e se encerra — o launcher assume o boot. Quando o launcher
// abre o jogo, ele passa "--via-launcher", e af o jogo segue normalmente. Se o
// launcher nao estiver instalado, o jogo abre normal (nunca trava o jogador).
#[cfg(desktop)]
fn maybe_redirect_to_launcher() {
    let via_launcher = std::env::args().any(|a| a == "--via-launcher")
        || std::env::var("ULTRAFOOT_VIA_LAUNCHER").is_ok();
    if via_launcher {
        return;
    }
    if let Some(launcher) = find_launcher_exe() {
        if std::process::Command::new(&launcher).spawn().is_ok() {
            std::process::exit(0);
        }
    }
}

#[cfg(all(desktop, windows))]
fn find_launcher_exe() -> Option<std::path::PathBuf> {
    use std::path::Path;
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
            let d = display.to_lowercase();
            if !d.contains("ultrafoot") || !d.contains("launcher") {
                continue;
            }
            let loc: String = sub.get_value("InstallLocation").unwrap_or_default();
            if !loc.is_empty() {
                let exe = Path::new(&loc).join("Ultrafoot Launcher.exe");
                if exe.exists() {
                    return Some(exe);
                }
                if let Ok(entries) = std::fs::read_dir(&loc) {
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
                        if is_exe && stem.contains("launcher") {
                            return Some(p);
                        }
                    }
                }
            }
            let icon: String = sub.get_value("DisplayIcon").unwrap_or_default();
            if !icon.is_empty() {
                let ic = icon.split(',').next().unwrap_or(icon.as_str()).trim().trim_matches('"');
                if Path::new(ic).exists() {
                    return Some(std::path::PathBuf::from(ic));
                }
            }
        }
    }
    None
}

#[cfg(all(desktop, not(windows)))]
fn find_launcher_exe() -> Option<std::path::PathBuf> {
    None
}

// ─── App entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Antes de tudo: se o jogo foi aberto direto, abre o launcher e sai.
    #[cfg(desktop)]
    maybe_redirect_to_launcher();

    // DESKTOP: conecta ao Discord (falha em silencio se ele nao estiver aberto).
    #[cfg(desktop)]
    let discord_client = DiscordIpcClient::new(DISCORD_APP_ID)
        .ok()
        .and_then(|mut c| c.connect().ok().map(|_| c));

    #[cfg(target_os = "windows")]
    let discord_social_guard = {
        let _ = discord_social::init();
        discord_social::ShutdownGuard
    };

    let builder = tauri::Builder::default()
        .manage(online_server::OnlineServerManager::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init());

    // Rich Presence e SO DESKTOP (depende do cliente Discord no PC). A atualizacao
    // do jogo agora e responsabilidade do Ultrafoot Launcher — nao ha mais updater
    // in-game (o jogo so verifica a versao para travar o online desatualizado).
    #[cfg(desktop)]
    let builder = builder
        .manage(DiscordRpc(Mutex::new(discord_client)))
        .invoke_handler(tauri::generate_handler![
            discord_update,
            discord_clear,
            discord_social_snapshot,
            discord_social_login,
            discord_social_disconnect,
            get_bluetooth_gamepad_battery,
            media_now_playing,
            media_play_pause,
            media_next,
            media_previous
            ,online_server::online_start_server
            ,online_server::online_stop_server
            ,online_server::online_server_status
            ,online_server::online_join_server
            ,online_server::online_room_snapshot
            ,online_server::online_set_ready
            ,online_server::online_submit_action
        ]);

    // MOBILE: o mesmo jogo, sem os comandos que dependem do Discord. Os que tem
    // fallback multiplataforma (midia, bateria do controle) continuam expostos.
    #[cfg(not(desktop))]
    let builder = builder
        .invoke_handler(tauri::generate_handler![
            discord_social_snapshot,
            discord_social_login,
            discord_social_disconnect,
            get_bluetooth_gamepad_battery,
            media_now_playing,
            media_play_pause,
            media_next,
            media_previous
            ,online_server::online_start_server
            ,online_server::online_stop_server
            ,online_server::online_server_status
            ,online_server::online_join_server
            ,online_server::online_room_snapshot
            ,online_server::online_set_ready
            ,online_server::online_submit_action
        ]);

    #[cfg(target_os = "windows")]
    let builder = builder.manage(discord_social_guard);

    builder
        .register_uri_scheme_protocol("game-asset", |webview, request| {
            // Decodifica o percent-encoding: nomes de musica tem espacos e acentos.
            let path = percent_decode(request.uri().path().trim_start_matches('/'));
            let path = path.as_str();
            // Resolve pelo diretório de recursos da plataforma. No Windows ele costuma
            // ficar ao lado do executável; no macOS fica em Contents/Resources e em
            // pacotes Linux a localização depende do formato (AppImage/deb).
            let exe_path = std::env::current_exe().expect("failed to get exe path");
            let exe_dir = exe_path.parent().expect("failed to get exe dir");
            let resource_dir = webview.app_handle().path().resource_dir().ok();
            let file_path = resource_dir.as_deref().unwrap_or(exe_dir).join(path);
            let mime = if path.ends_with(".png") {
                "image/png"
            } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
                "image/jpeg"
            } else if path.ends_with(".webp") {
                "image/webp"
            } else if path.ends_with(".svg") {
                "image/svg+xml"
            } else if path.ends_with(".mp3") {
                "audio/mpeg"
            } else if path.ends_with(".webm") {
                "audio/webm"
            } else if path.ends_with(".ogg") {
                "audio/ogg"
            } else {
                "application/octet-stream"
            };
            let file_data = match std::fs::read(&file_path) {
                Ok(data) => data,
                Err(_) => {
                    // bundle.resources glob flattens subdirs — try filename one level up
                    // e.g. escudos/ligue_1/psg.png → escudos/psg.png
                    let fallback = file_path
                        .file_name()
                        .zip(file_path.parent().and_then(|p| p.parent()))
                        .and_then(|(name, dir)| std::fs::read(dir.join(name)).ok());
                    match fallback {
                        Some(data) => data,
                        None => return tauri::http::Response::builder()
                            .status(404)
                            .body(vec![])
                            .unwrap(),
                    }
                }
            };
            let total_len = file_data.len();
            // Support HTTP Range requests (required for audio streaming in WebView2)
            if let Some(range_val) = request.headers().get("range") {
                if let Ok(range_str) = range_val.to_str() {
                    if let Some((start, end)) = parse_byte_range(range_str, total_len) {
                        let chunk = file_data[start..=end].to_vec();
                        let chunk_len = chunk.len();
                        return tauri::http::Response::builder()
                            .status(206)
                            .header("Content-Type", mime)
                            .header("Content-Range", format!("bytes {}-{}/{}", start, end, total_len))
                            .header("Accept-Ranges", "bytes")
                            .header("Content-Length", chunk_len.to_string())
                            .header("Access-Control-Allow-Origin", "*")
                            .body(chunk)
                            .unwrap();
                    }
                }
            }
            tauri::http::Response::builder()
                .header("Content-Type", mime)
                .header("Accept-Ranges", "bytes")
                .header("Content-Length", total_len.to_string())
                .header("Access-Control-Allow-Origin", "*")
                .body(file_data)
                .unwrap()
        })
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
