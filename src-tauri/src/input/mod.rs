// CAMADA NATIVA DE INPUT — a fronteira entre o controle fisico e o jogo.
//
// O frontend NUNCA fala com XInput, HID ou DLL nenhuma. Ele fala com estes tres
// comandos e ouve dois eventos, e so. Trocar o backend um dia (GameInput, SDL,
// um driver novo da Sony) e mexer aqui dentro; nada em `lib/input/` precisa
// saber. Foi por isso que o modulo nasceu separado em vez de virar mais um
// punhado de comandos no lib.rs.
//
//   COMANDOS
//     input_native_start     inicia o laco (idempotente)
//     input_native_stop      encerra o laco
//     input_native_snapshot  retrato atual, sem esperar evento
//     input_native_wake      "acabou de conectar um controle, acorde"
//
//   EVENTOS
//     uf:input:native   NativeSnapshot, so quando a topologia muda
//     uf:input:center   CenterButtonEvent, na borda de subida do Guide
//
// Ver manager.rs para por que o laco nao le botao comum, e xinput.rs para por
// que o botao central precisa de uma entrada por ordinal.

mod capability;
mod device;
mod manager;
#[cfg(target_os = "windows")]
mod xinput;

pub use manager::NativeSnapshot;

use tauri::AppHandle;

#[tauri::command]
pub fn input_native_start(app: AppHandle) {
    manager::iniciar(app);
}

#[tauri::command]
pub fn input_native_stop() {
    manager::parar();
}

#[tauri::command]
pub fn input_native_snapshot() -> NativeSnapshot {
    manager::snapshot_atual()
}

#[tauri::command]
pub fn input_native_wake() {
    manager::acordar();
}
