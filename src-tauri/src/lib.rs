// Rich Presence e SO DESKTOP: a crate usa IPC do Discord (named pipes/sockets) e
// nao ha cliente Discord no Android/iOS. Guardado com cfg(desktop) para o build
// mobile nem compilar essa dependencia.
#[cfg(desktop)]
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
#[cfg(desktop)]
use std::sync::Mutex;
use tauri::Manager;

mod input;
mod licenca;
mod native_engine;
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

// ─── Abertura direta ─────────────────────────────────────────────────────────

// ATE 1.0.239 O JOGO SE RECUSAVA A ABRIR SOZINHO. Aberto direto (atalho da area
// de trabalho, menu iniciar, duplo-clique no .exe), ele abria o Ultrafoot
// Launcher e chamava `exit(0)` — o launcher e que "assumia o boot", no modelo do
// Battle.net. Para quem clicava, o jogo simplesmente PISCAVA E SUMIA: janela
// nenhuma, erro nenhum, exit 0. Indistinguivel de crash, e o atalho que o
// instalador cria na area de trabalho aponta justamente para o .exe sem
// argumento — ou seja, o caminho mais natural era o quebrado.
//
// Agora o atalho do jogo abre o JOGO e o do launcher abre o LAUNCHER. O launcher
// continua sendo o dono da atualizacao e do online, e continua passando
// `--via-launcher`; ninguem mais le esse argumento, e ele fica inofensivo de
// proposito — atalho antigo que ja o carrega continua funcionando.

// ─── App entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]

/// Chave de ativacao deixada pelo LAUNCHER, se houver.
///
/// O launcher escreve `ativacao.json` numa pasta neutra (APPDATA/Ultrafoot no
/// Windows): os dois apps tem identificadores diferentes e nao enxergam o
/// armazenamento um do outro. Aqui so LEMOS o texto — quem confere a assinatura
/// e o jogo, com o segredo dele. Confiar no arquivo faria de um editor de texto
/// um gerador de licencas.
fn pasta_compartilhada_do_launcher() -> Option<std::path::PathBuf> {
    let base = if cfg!(windows) {
        std::env::var_os("APPDATA").map(std::path::PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join("Library/Application Support"))
    } else {
        std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".local/share"))
    }?;
    Some(base.join("Ultrafoot"))
}

#[tauri::command]
fn ler_ativacao_do_launcher() -> Option<String> {
    std::fs::read_to_string(pasta_compartilhada_do_launcher()?.join("ativacao.json")).ok()
}

/// Sessao da conta em que o LAUNCHER entrou.
///
/// O jogo nao tem login proprio; e por este arquivo que ele descobre de quem e a
/// carreira e consegue catalogar os saves na conta certa.
#[tauri::command]
fn ler_sessao_do_launcher() -> Option<String> {
    std::fs::read_to_string(pasta_compartilhada_do_launcher()?.join("sessao.json")).ok()
}

/// `sav` NA PASTA DO JOGO, APONTANDO PARA ONDE OS SAVES REALMENTE ESTAO.
///
/// Pedido do usuario: a pasta instalada devia parecer organizada, com um `sav`
/// como o do Brasfoot. Os saves NAO se mudam para ca — eles vivem em
/// `%APPDATA%\com.ultrafoot.remake\ultrafoot-clubs.json`, que e o unico lugar
/// que sobrevive a reinstalacao e a atualizacao. Mover isso obrigaria a migrar
/// a carreira de todo mundo, com risco de perder save, para ganhar aparencia.
///
/// A juncao (`mklink /J`) resolve os dois lados: quem abre a pasta do jogo ve
/// `sav` e entra direto nos saves; o arquivo continua onde sempre esteve.
/// Juncao NAO exige administrador (link simbolico exigiria), e por isso e ela.
///
/// Falhar aqui e SEM CONSEQUENCIA de proposito: se a pasta for somente leitura,
/// se o disco nao for NTFS ou se o `cmd` nao responder, fica so o aviso em
/// texto com o caminho. Um atalho de conveniencia jamais pode impedir o jogo de
/// abrir.
// ─── Modo loja (Steam, Epic, GOG…) ───────────────────────────────────────────
//
// ⚠️ ASSADO NO BUILD, NAO LIDO DE UM ARQUIVO.
//
// A alternativa obvia — um `loja.json` ao lado do executavel — seria um arquivo
// que qualquer pessoa cria para destravar os extras do build da venda direta.
// Aqui nao ha o que copiar: sao dois binarios diferentes, e o valor entra por
// `option_env!` no momento da compilacao. O front recebe o MESMO valor por
// `NEXT_PUBLIC_ULTRAFOOT_LOJA`, para os dois lados nunca discordarem sobre em
// que build estao.
//
// `None` = venda direta (o canal do Ultrafoot Launcher). `Some("steam")`,
// `Some("epic")`… = a loja e dona da instalacao e da licenca.
pub(crate) fn modo_loja() -> Option<&'static str> {
    match option_env!("ULTRAFOOT_LOJA") {
        // "1" e o valor historico do front (era o unico que existia) e vale
        // como "sim, e loja, sem dizer qual". "0" e vazio valem como venda
        // direta — para um `ULTRAFOOT_LOJA=0` no ambiente nao ligar o modo
        // loja por acidente. A MESMA regra esta em lib/loja.ts.
        Some(v) if !v.trim().is_empty() && v.trim() != "0" => Some(v.trim()),
        _ => None,
    }
}

/// Este binario foi compilado para uma loja?
pub(crate) fn em_loja() -> bool {
    modo_loja().is_some()
}

/// Em que loja este binario foi publicado. Vazio na venda direta.
///
/// Exposto para o diagnostico do suporte: "o jogador esta na build da Steam ou
/// na do launcher?" e a primeira pergunta de metade dos relatos, e adivinhar
/// pela versao nao funciona — o numero e o mesmo nos dois.
#[tauri::command]
fn loja() -> Option<String> {
    modo_loja().map(|s| s.to_string())
}

#[cfg(target_os = "windows")]
fn criar_atalho_sav(app: &tauri::App) {
    use std::os::windows::process::CommandExt;
    use tauri::Manager;

    // ⚠️ NA LOJA, NADA E ESCRITO DENTRO DA PASTA DE INSTALACAO.
    //
    // Steam e Epic sao donas desse diretorio: elas o verificam ("verificar
    // integridade dos arquivos"), o substituem a cada patch e podem instala-lo
    // onde este processo nao tem permissao de escrita. Uma juncao que aparece
    // do nada ali e, na melhor das hipoteses, ruido no verificador.
    //
    // Nada se perde: o save nunca morou aqui. Ele fica em %APPDATA% (e por isso
    // sobrevive ao patch da loja); esta juncao era so um atalho de conveniencia
    // para quem abre a pasta do jogo pelo Explorer — e na loja o caminho para
    // essa pasta e "Procurar arquivos locais", nao um atalho nosso.
    if em_loja() {
        return;
    }

    let Ok(dados) = app.path().app_data_dir() else { return };
    let Ok(exe) = std::env::current_exe() else { return };
    let Some(pasta_do_jogo) = exe.parent() else { return };
    let atalho = pasta_do_jogo.join("sav");

    // Ja existe (juncao de uma execucao anterior, ou pasta de verdade que
    // alguem criou): nao mexe. Reapontar apagaria o que estiver la dentro.
    if atalho.exists() {
        return;
    }
    let _ = std::fs::create_dir_all(&dados);

    let ok = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(&atalho)
        .arg(&dados)
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW: sem piscar console no arranque
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    if !ok {
        // Sem juncao, o caminho vira texto — continua respondendo "onde esta o
        // meu save?", que e a pergunta que o `sav` existe para responder.
        let _ = std::fs::write(
            pasta_do_jogo.join("ONDE-ESTAO-OS-SAVES.txt"),
            format!(
                "Os saves do Ultrafoot 26 ficam em:\r\n\r\n{}\r\n\r\n\
                 O arquivo ultrafoot-clubs.json guarda as carreiras, as edicoes de clube\r\n\
                 e as imagens baixadas. Para fazer copia de seguranca, copie essa pasta.\r\n",
                dados.display()
            ),
        );
    }
}

/// Grava um panic do lado nativo em arquivo, antes de a janela fechar.
///
/// ⚠️ SEM ISTO UM PANIC NAO DEIXAVA RASTRO NENHUM. O jogo roda como aplicativo de
/// janela, sem console ligado: quando o lado Rust entra em panic, o processo
/// morre e a janela some. Para o jogador e "o jogo fechou sozinho"; para quem vai
/// consertar, e nada — nem mensagem, nem linha, nem versao. Em loja essa e a
/// diferenca entre um defeito que se corrige e uma avaliacao negativa sem causa.
///
/// O arquivo fica ao lado do save, em LOCALAPPDATA/Ultrafoot 26, e nao no
/// diretorio temporario: o jogador consegue anexa-lo num relato, e ele sobrevive
/// a uma limpeza de disco.
///
/// ⚠️ O HOOK NAO PODE ENTRAR EM PANIC. Ele roda DENTRO de um panic; se falhar,
/// vira panic duplo e o processo aborta sem nem o rastro anterior. Por isso cada
/// passo aqui desiste em silencio: perder o registro e ruim, derrubar o
/// encerramento e pior.
fn instalar_registro_de_falha() {
    let anterior = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let destino = std::env::var("LOCALAPPDATA")
            .map(std::path::PathBuf::from)
            .map(|p| p.join("Ultrafoot 26"))
            .unwrap_or_else(|_| std::env::temp_dir());
        let _ = std::fs::create_dir_all(&destino);

        // `location()` da arquivo e linha; a mensagem chega como &str ou String
        // conforme o panic foi disparado, e as duas formas precisam ser lidas.
        let onde = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "local desconhecido".to_string());
        let mensagem = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "sem mensagem".to_string());

        let quando = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let linha = format!(
            "[{}] v{} panic em {} — {}",
            quando,
            env!("CARGO_PKG_VERSION"),
            onde,
            mensagem
        );

        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(destino.join("falhas-nativas.log"))
        {
            let _ = writeln!(f, "{}", linha);
        }

        // O hook original continua valendo: em debug ele imprime o backtrace, e
        // substitui-lo por completo esconderia o rastro de quem desenvolve.
        anterior(info);
    }));
}

pub fn run() {
    // Antes de qualquer coisa: um panic durante a montagem tambem precisa deixar
    // rastro, e a montagem e justamente onde eles acontecem.
    instalar_registro_de_falha();
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
            ,ler_ativacao_do_launcher
            ,ler_sessao_do_launcher
            ,loja
            ,licenca::verificar_licenca
            ,native_engine::project_squad
            ,online_server::online_start_server
            ,online_server::online_stop_server
            ,online_server::online_server_status
            ,online_server::online_join_server
            ,online_server::online_room_snapshot
            ,online_server::online_set_ready
            ,online_server::online_submit_action
            // Modo Controle: o backend nativo existe para UMA coisa que o
            // webview nao consegue ver — o botao central. Ver src/input.
            ,input::input_native_start
            ,input::input_native_stop
            ,input::input_native_snapshot
            ,input::input_native_wake
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
            ,ler_ativacao_do_launcher
            ,ler_sessao_do_launcher
            ,loja
            ,licenca::verificar_licenca
            ,native_engine::project_squad
            ,online_server::online_start_server
            ,online_server::online_stop_server
            ,online_server::online_server_status
            ,online_server::online_join_server
            ,online_server::online_room_snapshot
            ,online_server::online_set_ready
            ,online_server::online_submit_action
            // Modo Controle: o backend nativo existe para UMA coisa que o
            // webview nao consegue ver — o botao central. Ver src/input.
            ,input::input_native_start
            ,input::input_native_stop
            ,input::input_native_snapshot
            ,input::input_native_wake
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
        .setup(|_app| {
            #[cfg(target_os = "windows")]
            criar_atalho_sav(_app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
