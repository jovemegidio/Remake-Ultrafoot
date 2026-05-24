use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

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

// ─── App entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Tenta conectar ao Discord — falha silenciosamente se o Discord não estiver aberto
    let discord_client = DiscordIpcClient::new(DISCORD_APP_ID)
        .ok()
        .and_then(|mut c| c.connect().ok().map(|_| c));

    tauri::Builder::default()
        .manage(DiscordRpc(Mutex::new(discord_client)))
        .invoke_handler(tauri::generate_handler![discord_update, discord_clear])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
