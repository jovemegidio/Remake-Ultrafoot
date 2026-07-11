use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

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

struct DiscordRpc(Mutex<Option<DiscordIpcClient>>);

#[tauri::command]
fn discord_update(rpc: tauri::State<DiscordRpc>, details: String, state: String) {
    let mut guard = rpc.0.lock().unwrap();
    if let Some(client) = guard.as_mut() {
        let _ = client.set_activity(
            activity::Activity::new()
                .details(&details)
                .state(&state)
                .assets(
                    activity::Assets::new()
                        .large_image("ultrafoot_logo")
                        .large_text("Ultrafoot 26"),
                ),
        );
    }
}

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

// ─── App entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Tenta conectar ao Discord — falha silenciosamente se o Discord não estiver aberto
    let discord_client = DiscordIpcClient::new(DISCORD_APP_ID)
        .ok()
        .and_then(|mut c| c.connect().ok().map(|_| c));

    tauri::Builder::default()
        .manage(DiscordRpc(Mutex::new(discord_client)))
        .invoke_handler(tauri::generate_handler![
            discord_update,
            discord_clear,
            get_bluetooth_gamepad_battery
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .register_uri_scheme_protocol("game-asset", |_app, request| {
            let path = request.uri().path().trim_start_matches('/');
            // Use exe directory — assets are bundled alongside ultrafoot.exe
            let exe_path = std::env::current_exe().expect("failed to get exe path");
            let exe_dir = exe_path.parent().expect("failed to get exe dir");
            let file_path = exe_dir.join(path);
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
