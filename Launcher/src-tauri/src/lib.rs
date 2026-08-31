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

// Módulos do launcher. Cada um resolve uma coisa que faltava para ele se
// comportar como plataforma (Steam/Epic/EA) e não como baixador de .exe.
mod controle; // pausar, cancelar e limitar a banda do download
mod diario; // log em arquivo + diagnóstico para o suporte
mod disco; // espaço livre e pasta de instalação escolhida
mod jogo; // supervisão do jogo aberto, tempo de jogo e crash
mod patch; // atualização por arquivo (delta) e verificação de integridade
mod requisitos; // WebView2, VC++, .NET, DirectX: audita e instala o que falta

const LATEST_JSON_URL: &str =
    "https://ultrafoot.179-198-103-30.sslip.io/downloads/latest.json";

// Endpoint estável do PRÓPRIO launcher (release rolling "launcher").
const LAUNCHER_UPDATE_URL: &str =
    "https://ultrafoot.179-198-103-30.sslip.io/downloads/launcher.json";

// ─── Reserva no GitHub ───────────────────────────────────────────────────────
//
// O servidor próprio é a fonte PRIMÁRIA, mas ele é uma máquina só: se cair,
// ficar sem disco ou o domínio sslip.io não resolver, NINGUÉM mais recebe
// atualização — nem do jogo, nem do launcher. O GitHub Releases continua
// publicado e é a segunda opção: mesma estrutura de JSON, custo zero de
// manutenção. Só é consultado quando o primário falha.
const LATEST_JSON_URL_RESERVA: &str =
    "https://github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json";

const LAUNCHER_UPDATE_URL_RESERVA: &str =
    "https://github.com/jovemegidio/Ultrafoot26/releases/download/launcher/launcher.json";

/// Busca um JSON no endereço primário e, se ele falhar por QUALQUER motivo
/// (rede, HTTP != 2xx, corpo inválido), tenta o de reserva. O timeout curto no
/// primário evita que um servidor pendurado segure o launcher até o TCP desistir.
fn buscar_json_com_reserva(primario: &str, reserva: &str) -> Result<serde_json::Value, String> {
    let tentar = |url: &str, segundos: u64| -> Result<serde_json::Value, String> {
        ureq::get(url)
            .timeout(std::time::Duration::from_secs(segundos))
            .call()
            .map_err(|e| format!("{url}: {e}"))?
            .into_json()
            .map_err(|e| format!("{url}: JSON inválido: {e}"))
    };
    match tentar(primario, 8) {
        Ok(v) => Ok(v),
        Err(erro_primario) => tentar(reserva, 15).map_err(|erro_reserva| {
            format!("servidor e reserva falharam — {erro_primario} | {erro_reserva}")
        }),
    }
}

// Configuração remota do launcher (notícias, banner, redes, status do servidor).
const LAUNCHER_CONFIG_URL: &str =
    "https://github.com/jovemegidio/Ultrafoot26/releases/download/launcher/launcher-config.json";

// Releases multiplataforma (Linux/macOS) publicados pela CI: tags "desktop-<versão>".
#[cfg(not(windows))]
const RELEASES_API_URL: &str =
    "https://api.github.com/repos/jovemegidio/Ultrafoot26/releases?per_page=30";

// ─── DESCOBERTA DE ENDEREÇOS ─────────────────────────────────────────────────
//
// O PROBLEMA QUE ISTO RESOLVE — e é o pedido "o launcher não pode precisar ser
// atualizado a cada versão do jogo":
//
// A versão do JOGO já vem de runtime (latest.json), então publicar 1.0.229 não
// exige launcher novo. O que ainda exigia era mudar de ENDEREÇO: as URLs acima
// são constantes COMPILADAS no executável. A VPS já morreu uma vez e mudou de
// IP; quando isso acontece, o launcher instalado passa a apontar para um lugar
// que não existe mais e não há como consertá-lo remotamente — ele não consegue
// nem baixar a própria atualização, porque o endereço da atualização é
// justamente um dos que quebraram. Vira tijolo, e a única saída é cada jogador
// reinstalar o launcher na mão.
//
// A saída é o launcher perguntar ONDE ficam as coisas, em vez de saber de cor:
//
//   1. endpoints.json na pasta compartilhada (%APPDATA%/Ultrafoot). Permite
//      consertar UM jogador por suporte, sem build nova.
//   2. Ponteiro remoto no GitHub RAW, no branch padrão. É o endereço mais
//      estável que temos: não depende de release, não depende da VPS, e o
//      conteúdo é editável com um commit. Se a VPS trocar de IP amanhã, edita-se
//      este arquivo e TODOS os launchers já instalados passam a achar o novo
//      servidor sozinhos.
//   3. As constantes compiladas, como último recurso — é o que sempre foi.
//
// O resultado da descoberta é gravado em cache no disco: depois da primeira vez
// o launcher funciona offline e não paga o custo da consulta a cada abertura.
const ENDPOINTS_POINTER_URL: &str =
    "https://raw.githubusercontent.com/jovemegidio/Ultrafoot26/main/public/endpoints.json";

#[derive(Clone)]
struct Endpoints {
    latest: String,
    latest_reserva: String,
    launcher: String,
    launcher_reserva: String,
    config: String,
    #[allow(dead_code)]
    releases_api: String,
}

impl Default for Endpoints {
    fn default() -> Self {
        Self {
            latest: LATEST_JSON_URL.into(),
            latest_reserva: LATEST_JSON_URL_RESERVA.into(),
            launcher: LAUNCHER_UPDATE_URL.into(),
            launcher_reserva: LAUNCHER_UPDATE_URL_RESERVA.into(),
            config: LAUNCHER_CONFIG_URL.into(),
            #[cfg(not(windows))]
            releases_api: RELEASES_API_URL.into(),
            #[cfg(windows)]
            releases_api: String::new(),
        }
    }
}

fn caminho_cache_endpoints() -> Option<std::path::PathBuf> {
    pasta_compartilhada().map(|p| p.join("endpoints.json"))
}

/// Sobrepõe o padrão com o que vier no JSON, campo a campo. Um arquivo com uma
/// chave só muda uma coisa e mantém o resto — importante para o suporte poder
/// corrigir um endereço sem precisar reescrever todos.
fn aplicar_endpoints(base: &mut Endpoints, valor: &serde_json::Value) {
    let pegar = |chave: &str, destino: &mut String| {
        if let Some(v) = valor.get(chave).and_then(|x| x.as_str()) {
            let v = v.trim();
            if v.starts_with("https://") {
                *destino = v.to_string();
            }
        }
    };
    pegar("latest", &mut base.latest);
    pegar("latestReserva", &mut base.latest_reserva);
    pegar("launcher", &mut base.launcher);
    pegar("launcherReserva", &mut base.launcher_reserva);
    pegar("config", &mut base.config);
    pegar("releasesApi", &mut base.releases_api);
}

static ENDPOINTS: std::sync::OnceLock<Endpoints> = std::sync::OnceLock::new();

fn endpoints() -> &'static Endpoints {
    ENDPOINTS.get_or_init(|| {
        let mut resolvidos = Endpoints::default();

        // 1) Cache/override local. Vale também como memória offline da última
        //    descoberta bem-sucedida.
        if let Some(caminho) = caminho_cache_endpoints() {
            if let Ok(texto) = std::fs::read_to_string(&caminho) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&texto) {
                    aplicar_endpoints(&mut resolvidos, &v);
                }
            }
        }

        // 2) Ponteiro remoto. Timeout curto: se ele não responder, seguimos com
        //    o que já temos — descoberta nunca pode atrasar a abertura do app.
        if let Ok(resposta) = ureq::get(ENDPOINTS_POINTER_URL)
            .timeout(std::time::Duration::from_secs(5))
            .call()
        {
            if let Ok(v) = resposta.into_json::<serde_json::Value>() {
                aplicar_endpoints(&mut resolvidos, &v);
                // Grava o cache para a próxima abertura (inclusive offline).
                if let Some(caminho) = caminho_cache_endpoints() {
                    let _ = std::fs::write(&caminho, v.to_string());
                }
            }
        }

        resolvidos
    })
}

#[derive(Serialize, Clone, Default)]
struct InstalledGame {
    installed: bool,
    version: Option<String>,
    path: Option<String>,
}

#[derive(Serialize, Clone, Default)]
struct LatestInfo {
    version: String,
    notes: String,
    url: String,
    /// Endereço ALTERNATIVO do mesmo instalador, quando publicado.
    ///
    /// ⚠️ A RESERVA ERA MEIA RESERVA. `buscar_json_com_reserva` já trocava de
    /// servidor para achar o MANIFESTO (VPS → GitHub), mas o `url` gravado
    /// dentro dele apontava para a VPS nos dois casos. Com a VPS fora do ar o
    /// launcher caía na pior combinação possível: descobria que existe versão
    /// nova pelo GitHub e não conseguia baixar o binário de lugar nenhum — e
    /// como o auto-update é o caminho pelo qual ele se conserta, isso é o
    /// começo do tijolo. Publicar as duas fontes custa um campo.
    #[serde(rename = "urlReserva")]
    url_reserva: Option<String>,
    /// Endereço do manifesto de arquivos desta versão, quando publicado.
    ///
    /// É o que habilita a atualização diferencial: com ele, o launcher baixa só
    /// os arquivos que mudaram. Ausente = versão publicada no formato antigo, e
    /// o caminho continua sendo o instalador inteiro.
    manifesto: Option<String>,
    /// sha256 esperado do instalador, quando o manifesto publica (launcher.json).
    /// Ausente em manifesto antigo: cai na conferência só por tamanho.
    sha256: Option<String>,
    /// Tamanho exato em bytes. Sozinho já teria barrado o incidente de 02/08/2026.
    size: Option<u64>,
    /// false = NÃO instalar sozinho. É o freio do loop: quando a mesma versão já
    /// falhou duas vezes, o launcher para de tentar e devolve a decisão ao jogador.
    auto: bool,
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

/// Progresso detalhado. Usado pelo motor de patch, que conta bytes de vários
/// arquivos como se fossem um download só.
pub(crate) fn emitir_progresso(
    app: &AppHandle,
    phase: &'static str,
    percent: u32,
    downloaded: u64,
    total: u64,
    speed: u64,
    eta: u64,
) {
    let _ = app.emit(
        "launcher://progress",
        Progress { phase, percent, downloaded, total, speed, eta },
    );
}

/// Notificação do Windows (bandeja).
///
/// Existe porque o launcher agora passa boa parte do tempo ESCONDIDO — na
/// bandeja durante o download e enquanto o jogo roda. Sem notificação, "o
/// download acabou" e "o jogo caiu" só apareceriam quando a pessoa lembrasse de
/// reabrir a janela.
///
/// Não incomoda quem está olhando: se a janela do launcher está visível e em
/// foco, a informação já está na tela e o aviso é dispensado.
pub(crate) fn avisar_sistema(app: &AppHandle, titulo: &str, corpo: &str) {
    use tauri::Manager;
    use tauri_plugin_notification::NotificationExt;

    let em_foco = app
        .get_webview_window("main")
        .map(|w| {
            w.is_focused().unwrap_or(false) && w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false)
        })
        .unwrap_or(false);
    if em_foco {
        return;
    }
    let _ = app.notification().builder().title(titulo).body(corpo).show();
}

/// Apaga downloads parciais deixados para trás (pedido explícito do jogador ao
/// cancelar). Mantido num lugar só para não sobrar arquivo órfão em %TEMP%.
pub(crate) fn limpar_parciais() {
    let temp = std::env::temp_dir();
    for nome in [
        "Ultrafoot-setup.exe",
        "Ultrafoot-setup.exe.origem",
        "Ultrafoot26.AppImage.part",
        "Ultrafoot26.dmg",
    ] {
        let _ = std::fs::remove_file(temp.join(nome));
    }
}

// ─── Detecção do jogo instalado ──────────────────────────────────────────────

#[cfg(windows)]
pub(crate) fn read_installed_game() -> InstalledGame {
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

    // VARRE TUDO E FICA COM A MAIOR VERSAO — nao com a primeira encontrada.
    //
    // Antes isto dava `return` na primeira chave que batia. Quem tivesse uma
    // entrada velha em HKCU (instalacao antiga que nunca foi desinstalada)
    // ficava preso nela: o launcher lia a versao velha, oferecia atualizar,
    // instalava certo, e na proxima abertura lia a MESMA chave velha de novo.
    // Era o "atualiza, sai, entra e atualiza dnv".
    let mut melhor: Option<(Vec<u32>, InstalledGame)> = None;

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
            let uninstall: String = sub.get_value("UninstallString").unwrap_or_default();
            let path_exe = resolve_game_exe(&install_loc, &display_icon, &uninstall);

            // Chave sem executavel no disco e resto de desinstalacao: ignora,
            // senao ela venceria uma instalacao boa e o Jogar abriria o nada.
            if path_exe.is_none() {
                continue;
            }

            let peso = parse_versao(&version);
            let candidato = InstalledGame {
                installed: true,
                version: (!version.is_empty()).then_some(version),
                path: path_exe,
            };
            if melhor.as_ref().map(|(p, _)| peso > *p).unwrap_or(true) {
                melhor = Some((peso, candidato));
            }
        }
    }

    melhor.map(|(_, g)| g).unwrap_or_default()
}

/// Normaliza um `DisplayVersion` para comparacao numerica.
///
/// O registro nem sempre traz "1.0.239" limpo: ja apareceu com prefixo `v`,
/// com quarto componente (`1.0.239.0`) e com sufixo (`1.0.239 (x64)`). Sem
/// normalizar, "v1.0.239" virava [0,0,0] e o launcher achava que TODA versao
/// publicada era mais nova — atualizava para sempre.
fn parse_versao(s: &str) -> Vec<u32> {
    s.trim()
        .trim_start_matches(['v', 'V'])
        .split(|c: char| !c.is_ascii_digit())
        .filter(|p| !p.is_empty())
        .filter_map(|p| p.parse::<u32>().ok())
        .collect()
}

/// Caminho do .exe do jogo a partir do que o desinstalador do Windows registrou.
///
/// SAO TRES FONTES DE PROPOSITO. Devolver `None` aqui nao mostra erro nenhum na
/// tela: o botao continua escrito "Jogar", o clique chama `launch_game`, o Rust
/// responde "nao encontrei o jogo instalado" e a UI engole. O jogador clica e
/// NADA ACONTECE. Enquanto isso `installed: true` continua valendo (vem do
/// DisplayVersion), entao nem o estado do botao denuncia o problema. Por isso
/// vale insistir em todas as pistas do registro antes de desistir.
#[cfg(windows)]
fn resolve_game_exe(install_loc: &str, display_icon: &str, uninstall_string: &str) -> Option<String> {
    use std::path::Path;

    /// `ultrafoot.exe` sim, `uninstall.exe`/`Ultrafoot Launcher.exe` nao.
    fn e_o_jogo(p: &Path) -> bool {
        let ext_ok = p.extension().map(|x| x.eq_ignore_ascii_case("exe")).unwrap_or(false);
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
        ext_ok && stem.contains("ultrafoot") && !stem.contains("launcher") && !stem.contains("uninstall")
    }

    fn procurar_na_pasta(dir: &Path) -> Option<String> {
        let direct = dir.join("Ultrafoot 26.exe");
        if direct.exists() {
            return Some(direct.to_string_lossy().into_owned());
        }
        for entry in std::fs::read_dir(dir).ok()?.flatten() {
            let p = entry.path();
            if e_o_jogo(&p) {
                return Some(p.to_string_lossy().into_owned());
            }
        }
        None
    }

    // O NSIS grava o InstallLocation COM ASPAS no valor: o registro guarda
    // literalmente `"C:\...\Ultrafoot 26"`. Sem tirar as aspas, `Path::join` e
    // `read_dir` recebem um caminho que nao existe e falham os dois — a busca
    // inteira pelo exe do jogo virava letra morta, e o launcher so continuava
    // achando o jogo pelo DisplayIcon (que ja trimava). Uma reserva sozinha
    // segurando o "Jogar" e o tipo de coisa que quebra o dia em que ela some.
    let install_loc = install_loc.trim().trim_matches('"');

    // 1) A pasta de instalacao.
    if !install_loc.is_empty() {
        if let Some(achado) = procurar_na_pasta(Path::new(install_loc)) {
            return Some(achado);
        }
    }

    // 2) DisplayIcon aponta direto para o .exe (com aspas, e as vezes com ",0").
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

    // 3) A pasta do desinstalador. `UninstallString` sempre existe — sem ele o
    //    Windows nao conseguiria desinstalar — e o uninstall.exe mora na mesma
    //    pasta do jogo. E a pista que sobra quando as duas de cima falham.
    //
    //    E uma LINHA DE COMANDO, nao um caminho: vem como `"C:\...\uninstall.exe" /S`.
    //    Sem separar o programa dos argumentos, o `/S` entraria no caminho.
    let bruto = uninstall_string.trim();
    let uninstall = if let Some(resto) = bruto.strip_prefix('"') {
        resto.split('"').next().unwrap_or(resto)
    } else {
        bruto.split(" /").next().unwrap_or(bruto).trim()
    };
    if !uninstall.is_empty() {
        if let Some(dir) = Path::new(uninstall).parent() {
            if let Some(achado) = procurar_na_pasta(dir) {
                return Some(achado);
            }
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
pub(crate) fn read_installed_game() -> InstalledGame {
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
    let jogo = read_installed_game();
    // ESTA LINHA É O SINAL DE VIDA DA INTERFACE.
    //
    // É a primeira coisa que a tela pede ao abrir. Se ela aparece no diário, a
    // webview carregou e o React rodou; se o log tem o "launcher iniciado" mas
    // NÃO tem esta linha, o processo subiu e a interface não — que é o sintoma
    // de janela em branco (CSP bloqueando um script, arquivo faltando no
    // pacote). Sem isso, os dois casos dão o mesmo relato: "não abre".
    diario!(
        "INFO",
        "interface no ar — jogo instalado={} versão={}",
        jogo.installed,
        jogo.version.clone().unwrap_or_else(|| "?".into())
    );
    jogo
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

// ─── Canal de atualização (estável / beta) ───────────────────────────────────
//
// Uma build ruim hoje atinge todo mundo de uma vez, porque só existe um canal.
// Com o canal beta, quem quiser testa antes; o resto continua no estável e a
// correção chega sem susto. É o mesmo desenho das "betas" da Steam, e do lado do
// servidor não custa endpoint novo: o próprio latest.json carrega um bloco
// `beta` opcional. Sem esse bloco publicado, pedir beta simplesmente devolve o
// estável — nunca deixa o jogador sem atualização.

fn arquivo_de_canal() -> Option<std::path::PathBuf> {
    pasta_compartilhada().map(|p| p.join("canal.json"))
}

pub(crate) fn canal_atual() -> String {
    arquivo_de_canal()
        .and_then(|c| std::fs::read_to_string(c).ok())
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        .and_then(|v| v.get("canal").and_then(|x| x.as_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| "estavel".into())
}

#[tauri::command]
fn canal() -> String {
    canal_atual()
}

#[tauri::command]
fn definir_canal(canal: String) -> Result<(), String> {
    let arquivo = arquivo_de_canal().ok_or("não encontrei a pasta de dados")?;
    let corpo = serde_json::json!({ "canal": canal });
    std::fs::write(arquivo, corpo.to_string())
        .map_err(|e| format!("não consegui guardar o canal: {e}"))?;
    diario!("INFO", "canal de atualização: {canal}");
    Ok(())
}

/// Versões publicadas às quais dá para voltar (campo `anteriores` do latest.json).
///
/// Existe para o dia em que uma versão sai com um defeito que impede jogar:
/// sem isto, a única saída do jogador é esperar a correção.
#[derive(Serialize, Clone)]
struct VersaoDisponivel {
    version: String,
    url: String,
    notes: String,
    manifesto: Option<String>,
}

#[tauri::command]
fn versoes_anteriores() -> Result<Vec<VersaoDisponivel>, String> {
    let alvo = endpoints();
    let body = buscar_json_com_reserva(&alvo.latest, &alvo.latest_reserva)
        .map_err(|e| format!("falha ao consultar versões: {e}"))?;
    let lista = body
        .get("anteriores")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(lista
        .iter()
        .filter_map(|v| {
            let version = v.get("version")?.as_str()?.to_string();
            let url = v
                .get("url")
                .and_then(|u| u.as_str())
                .or_else(|| {
                    v.get("platforms")
                        .and_then(|p| p.get("windows-x86_64"))
                        .and_then(|w| w.get("url"))
                        .and_then(|u| u.as_str())
                })?
                .to_string();
            Some(VersaoDisponivel {
                version,
                url,
                notes: v.get("notes").and_then(|n| n.as_str()).unwrap_or_default().to_string(),
                manifesto: v.get("manifesto").and_then(|m| m.as_str()).map(|s| s.to_string()),
            })
        })
        .collect())
}

#[cfg(windows)]
fn fetch_latest_windows() -> Result<LatestInfo, String> {
    let alvo = endpoints();
    let body: serde_json::Value = buscar_json_com_reserva(&alvo.latest, &alvo.latest_reserva)
        .map_err(|e| format!("falha ao consultar atualizações: {e}"))?;

    // Bloco `beta`, quando existe E o jogador pediu esse canal.
    let raiz = if canal_atual() == "beta" {
        body.get("beta").filter(|b| b.get("version").is_some()).unwrap_or(&body)
    } else {
        &body
    };

    let version = raiz.get("version").and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let notes = raiz.get("notes").and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let plataforma = raiz.get("platforms").and_then(|p| p.get("windows-x86_64"));
    let url = plataforma
        .and_then(|w| w.get("url"))
        .and_then(|u| u.as_str())
        .unwrap_or_default()
        .to_string();

    // O manifesto pode vir na plataforma (o normal) ou solto na raiz, para
    // publicação que ainda não separou por sistema.
    let manifesto = plataforma
        .and_then(|w| w.get("manifesto"))
        .or_else(|| raiz.get("manifesto"))
        .and_then(|m| m.as_str())
        .filter(|m| m.starts_with("https://"))
        .map(|m| m.to_string());

    // ⚠️ O QUE O INSTALADOR TEM DE SER — LIDO DO latest.json.
    //
    // `do_install_windows` recusa o arquivo que não bate com estes campos, mas
    // ele só recebe o que ESTA função devolver. Enquanto aqui havia só
    // `..Default::default()`, o `sha256` publicado no latest.json (desde a
    // 1.0.346) chegava sempre como `None`, e a conferência caía no piso:
    // cabeçalho `MZ` mais o tamanho anunciado pelo MESMO servidor que enviou o
    // arquivo. Publicar o hash e não lê-lo é ter a tranca e deixá-la aberta.
    //
    // Aceita nos dois lugares: dentro de `platforms.windows-x86_64` (formato por
    // plataforma) e solto na raiz (publicação antiga). Um hash que não seja 64
    // hexadecimais é descartado em vez de reprovar o instalador: manifesto
    // malformado não pode virar "não dá para atualizar".
    let sha256 = plataforma
        .and_then(|w| w.get("sha256"))
        .or_else(|| raiz.get("sha256"))
        .and_then(|s| s.as_str())
        .map(|s| s.trim())
        .filter(|s| s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit()))
        .map(|s| s.to_string());
    let size = plataforma
        .and_then(|w| w.get("size"))
        .or_else(|| raiz.get("size"))
        .and_then(|s| s.as_u64())
        .filter(|n| *n > 0);

    if version.is_empty() || url.is_empty() {
        return Err("latest.json sem versão ou URL do Windows".into());
    }
    // `auto` continua sendo do auto-update do LAUNCHER (é lá que mora o freio de
    // tentativas); hash e tamanho valem para os dois.
    Ok(LatestInfo { version, notes, url, manifesto, sha256, size, ..Default::default() })
}

/// Linux/macOS: acha o release "desktop-*" mais recente e o asset com a extensão.
#[cfg(not(windows))]
fn fetch_latest_desktop(ext: &str) -> Result<LatestInfo, String> {
    let releases: serde_json::Value = ureq::get(&endpoints().releases_api)
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
                        return Ok(LatestInfo { version, notes, url, ..Default::default() });
                    }
                }
            }
        }
    }
    Err(format!("nenhum release desktop com {ext} encontrado"))
}

#[tauri::command]
async fn download_and_install(
    app: AppHandle,
    url: String,
    version: String,
    sha256: Option<String>,
    size: Option<u64>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || do_install(&app, &url, &version, &sha256, size))
        .await
        .map_err(|e| format!("tarefa interrompida: {e}"))?
}

/// Baixa `url` para `dest` com progresso (velocidade/ETA), RETOMANDO de um download
/// parcial e com ATÉ 3 tentativas em caso de falha de rede.
pub(crate) fn download_with_progress(app: &AppHandle, url: &str, dest: &std::path::Path) -> Result<(), String> {
    // ⚠️ O PEDAÇO PARCIAL SÓ VALE PARA A MESMA URL. Ver o bug de %TEMP% mais
    // abaixo: um parcial de OUTRA versão fazia o `Range` pedir a continuação de
    // um arquivo já completo, o servidor devolvia 416 e a atualização morria em
    // silêncio — para sempre, até alguém limpar o temp na mão.
    //
    // Antes isto era resolvido apagando o destino SEMPRE. Só que apagar sempre
    // também jogava fora o download legítimo de quem pausou ou cancelou, e o
    // pause acabou de virar recurso. A marca de origem separa os dois casos:
    // mesma URL, continua; URL diferente, começa do zero.
    let marca = std::path::PathBuf::from(format!("{}.origem", dest.display()));
    let mesma_origem = std::fs::read_to_string(&marca).map(|u| u.trim() == url).unwrap_or(false);
    if !mesma_origem {
        let _ = std::fs::remove_file(dest);
    }
    let _ = std::fs::write(&marca, url);

    controle::iniciar(app);

    let mut last_err = String::new();
    for attempt in 1..=3 {
        match download_attempt(app, url, dest) {
            Ok(()) => {
                let _ = std::fs::remove_file(&marca);
                return Ok(());
            }
            Err(e) => {
                // Cancelamento é ordem do jogador, não falha de rede: nem repete
                // nem vira erro genérico na tela.
                if controle::foi_cancelado(&e) {
                    diario!("INFO", "download interrompido a pedido");
                    return Err(e);
                }
                diario!("AVISO", "tentativa {attempt} de download falhou: {e}");
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
    // ⚠️ 416 NÃO É FALHA DE REDE — É "ESSE RANGE NÃO EXISTE".
    //
    // O motivo normal é o parcial JÁ ESTAR completo: baixou tudo, a conferência
    // reprovou por outro motivo e o arquivo ficou. O ureq trata 4xx como erro,
    // então isto queimava as três tentativas e falhava PARA SEMPRE — até alguém
    // limpar o %TEMP% na mão, que é o beco de 02/08/2026 entrando por outra
    // porta. Com o arquivo inteiro no disco não há o que baixar: devolvemos
    // sucesso e quem chamou segue para a conferência, que é quem decide se ele
    // presta (e o apaga quando não presta).
    let resp = match req.call() {
        Ok(r) => r,
        Err(ureq::Error::Status(416, _)) if existing > 0 => {
            diario!("AVISO", "o servidor recusou o Range: o arquivo parcial já está completo");
            let _ = app.emit(
                "launcher://progress",
                Progress {
                    phase: "downloading",
                    percent: 100,
                    downloaded: existing,
                    total: existing,
                    speed: 0,
                    eta: 0,
                },
            );
            return Ok(());
        }
        Err(e) => return Err(format!("download falhou: {e}")),
    };

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
    let mut regulador = controle::Regulador::novo();

    loop {
        // Pausa/cancelamento entram AQUI, entre blocos: é o único ponto em que
        // parar não deixa meio bloco gravado, e o arquivo continua válido para
        // ser retomado depois.
        controle::checar(app)?;
        let n = reader.read(&mut buf).map_err(|e| format!("erro ao baixar: {e}"))?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| format!("erro ao gravar: {e}"))?;
        downloaded += n as u64;
        regulador.contar(n as u64);

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

fn do_install(
    app: &AppHandle,
    url: &str,
    version: &str,
    sha256: &Option<String>,
    size: Option<u64>,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = version;
        do_install_windows(app, url, sha256, size)
    }
    #[cfg(target_os = "linux")]
    {
        do_install_linux(app, url, version, sha256, size)
    }
    #[cfg(target_os = "macos")]
    {
        do_install_macos(app, url, version, sha256, size)
    }
    #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
    {
        let _ = (app, url, version, sha256, size);
        Err("plataforma não suportada".into())
    }
}

#[cfg(windows)]
fn do_install_windows(
    app: &AppHandle,
    url: &str,
    sha_esperado: &Option<String>,
    size_esperado: Option<u64>,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    // NSIS silencioso, SEM janela (pedido: instalar/atualizar dentro do launcher
    // sem abrir o instalador nem piscar console). O /S já roda sem UI; o
    // CREATE_NO_WINDOW garante que nenhum console apareça. O temp é apagado depois
    // (linha do remove_file) — não deixa rastro.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let tmp = std::env::temp_dir().join("Ultrafoot-setup.exe");

    // ── ESPAÇO EM DISCO, ANTES DE COMEÇAR ──
    //
    // Disco cheio no meio da instalação é falha MUDA: o NSIS termina, o registro
    // não muda, o launcher relê a versão velha e oferece a mesma atualização de
    // novo. Foi assim que nasceu o loop de 02/08/2026. Perguntar o tamanho ao
    // servidor custa uma requisição HEAD e transforma isso numa frase clara.
    let tamanho = ureq::head(url)
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .ok()
        .and_then(|r| r.header("Content-Length").and_then(|v| v.parse::<u64>().ok()))
        .unwrap_or(0);
    if tamanho > 0 {
        let temp = std::env::temp_dir();
        if let Some(livre) = disco::espaco_livre_em(&temp) {
            let preciso = tamanho + tamanho / 10;
            if livre < preciso {
                return Err(format!(
                    "espaço insuficiente em {} para baixar o instalador: são precisos {} e há {} livres.",
                    temp.display(),
                    disco::humano(preciso),
                    disco::humano(livre)
                ));
            }
        }
        let destino = disco::pasta_de_instalacao()
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::env::temp_dir());
        disco::conferir_espaco(&destino, tamanho)?;
    }

    download_with_progress(app, url, &tmp)?;

    // ⚠️ CONFERIR ANTES DE EXECUTAR (1.0.346). ESTA LINHA NAO EXISTIA.
    //
    // O launcher baixava este .exe e o EXECUTAVA direto, sem conferir nada — nem
    // hash, nem tamanho, nem sequer o cabecalho do arquivo. Qualquer coisa que
    // chegasse por aquela URL virava um processo na maquina do jogador, com o
    // `/S` do NSIS (sem janela, sem pergunta). O caminho de auto-atualizacao do
    // PROPRIO launcher ja conferia desde 02/08/2026; o do jogo ficou de fora, e
    // nada falhava — por isso passou despercebido.
    //
    // O hash vem do latest.json, que passou a publica-lo na mesma versao. Quando
    // ele falta (release antigo), `conferir_instalador` ainda barra arquivo que
    // nao e executavel do Windows, truncado, ou de tamanho diferente do
    // anunciado — menos que autenticidade, mas muito acima de nada.
    if let Err(e) = conferir_instalador(&tmp, sha_esperado, size_esperado.or(if tamanho > 0 { Some(tamanho) } else { None })) {
        let _ = std::fs::remove_file(&tmp); // nao deixa lixo para a proxima tentativa
        diario!("ERRO", "instalador recusado: {e}");
        return Err(e);
    }

    emit(app, "installing");
    diario!("INFO", "instalando o jogo ({} bytes)", tamanho);

    let mut comando = std::process::Command::new(&tmp);
    comando.arg("/S").creation_flags(CREATE_NO_WINDOW);

    // PASTA ESCOLHIDA PELO JOGADOR. O `/D=` do NSIS tem duas regras rígidas:
    // precisa ser o ÚLTIMO argumento e não pode vir entre aspas — mesmo com
    // espaço no caminho. Passar aspas aqui faz o instalador criar uma pasta com
    // aspas no nome, e ninguém acha o jogo depois.
    //
    // Só vale para a PRIMEIRA instalação: com o jogo já instalado, o NSIS
    // atualiza onde ele está, e mandar outro destino criaria uma segunda cópia.
    if !read_installed_game().installed {
        if let Some(pasta) = disco::pasta_escolhida() {
            let limpo = pasta.trim_end_matches(['\\', '/']).to_string();
            diario!("INFO", "instalando em {limpo}");
            comando.raw_arg(format!("/D={limpo}"));
        }
    }

    let status = comando
        .status()
        .map_err(|e| format!("não consegui iniciar o instalador: {e}"))?;
    if !status.success() {
        let codigo = status.code().unwrap_or(-1);
        diario!("ERRO", "instalador terminou com código {codigo}");
        return Err(format!("o instalador terminou com erro (código {codigo})"));
    }

    let _ = std::fs::remove_file(&tmp);
    limpar_parciais();
    diario!("INFO", "instalação concluída");
    avisar_sistema(app, "Ultrafoot 26 pronto", "A instalação terminou. Bom jogo!");
    emit(app, "done");
    Ok(())
}

#[cfg(target_os = "linux")]
fn do_install_linux(
    app: &AppHandle,
    url: &str,
    version: &str,
    sha_esperado: &Option<String>,
    size_esperado: Option<u64>,
) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let tmp = std::env::temp_dir().join("Ultrafoot26.AppImage.part");
    download_with_progress(app, url, &tmp)?;
    // Confere ANTES de marcar executavel e rodar — ver a nota em do_install_windows.
    if let Err(e) = conferir_baixado(&tmp, sha_esperado, size_esperado) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
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
fn do_install_macos(
    app: &AppHandle,
    url: &str,
    version: &str,
    sha_esperado: &Option<String>,
    size_esperado: Option<u64>,
) -> Result<(), String> {
    let dmg = std::env::temp_dir().join("Ultrafoot26.dmg");
    download_with_progress(app, url, &dmg)?;
    // Confere ANTES de montar o volume — ver a nota em do_install_windows.
    if let Err(e) = conferir_baixado(&dmg, sha_esperado, size_esperado) {
        let _ = std::fs::remove_file(&dmg);
        return Err(e);
    }
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

// ─── Freio do loop de atualização ────────────────────────────────────────────
//
// ⚠️ O PROBLEMA QUE ISTO RESOLVE (02/08/2026, relatado por jogador):
// "o launcher crashou, fica no loop infinito de atualizando".
//
// `self_update` SEMPRE parecia dar certo: ele só dispara o instalador destacado
// e encerra o launcher. Se a instalação falhava — arquivo corrompido, antivírus,
// permissão —, o .bat reabria o launcher na MESMA versão, o manifesto continuava
// anunciando a versão nova, e tudo recomeçava. Para sempre, sem nenhum erro na
// tela, porque quem falhou foi um processo que o launcher já não acompanhava.
//
// A saída é lembrar entre execuções: se a mesma versão já foi tentada duas vezes
// e o launcher continua sendo o que era, ele para de tentar sozinho.

const MAX_TENTATIVAS: u32 = 2;

fn arquivo_de_tentativas() -> std::path::PathBuf {
    std::env::temp_dir().join("ultrafoot-launcher-tentativas.json")
}

/// Segundos desde a época. Para carimbar a última falha de rede.
fn agora_em_segundos() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// O registro inteiro, ou `Null` quando não há/está corrompido.
fn registro_de_tentativas(versao: &str) -> serde_json::Value {
    let v: serde_json::Value = std::fs::read_to_string(arquivo_de_tentativas())
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or(serde_json::Value::Null);
    // Versão diferente: o registro não vale — a nova merece chance limpa.
    if v.get("versao").and_then(|x| x.as_str()) != Some(versao) {
        return serde_json::Value::Null;
    }
    v
}

/// Quantas vezes já tentamos instalar ESTA versão.
fn tentativas_de(versao: &str) -> u32 {
    registro_de_tentativas(versao)
        .get("vezes")
        .and_then(|x| x.as_u64())
        .unwrap_or(0) as u32
}

/// Quando (epoch) o download desta versão falhou por rede pela última vez.
///
/// ⚠️ ESTE CAMPO É O QUE FALTAVA PARA O FREIO FUNCIONAR DE VERDADE.
///
/// `registrar_tentativa` só é chamado DEPOIS que o arquivo baixou e passou na
/// conferência — de propósito, para um download interrompido não gastar as
/// chances de uma instalação que nem começou. Só que isso deixava o caso mais
/// comum de todos sem nenhum freio: quando o SERVIDOR está fora do ar, nada
/// baixa, nada é registrado, e o launcher recomeça o ciclo inteiro a cada
/// abertura — três tentativas de download, cada uma esperando o TCP desistir,
/// com a tela de "Atualizando" cobrindo tudo enquanto isso.
///
/// Foi o que aconteceu em 28/08/2026 com a VPS fora do ar: o diário mostra as
/// três tentativas às 22:22, e as três de novo às 22:34, na abertura seguinte.
/// Do lado de quem usa, isso é "o launcher fica atualizando toda vez".
///
/// Com o carimbo, uma falha de rede compra silêncio por algumas horas: o
/// launcher segue funcionando na versão que tem, e volta a tentar depois.
fn ultima_falha_de(versao: &str) -> u64 {
    registro_de_tentativas(versao)
        .get("ultimaFalha")
        .and_then(|x| x.as_u64())
        .unwrap_or(0)
}

/// Quanto tempo o launcher fica sem reoferecer uma versão que não baixou.
///
/// Seis horas: longo o bastante para não incomodar quem abre o launcher várias
/// vezes no mesmo dia, curto o bastante para a correção chegar sozinha quando o
/// servidor voltar — sem ninguém precisar reinstalar nada.
const ESPERA_APOS_FALHA_DE_REDE: u64 = 6 * 60 * 60;

fn gravar_registro(versao: &str, vezes: u32, ultima_falha: u64) {
    let corpo = serde_json::json!({
        "versao": versao,
        "vezes": vezes,
        "ultimaFalha": ultima_falha,
    });
    let _ = std::fs::write(arquivo_de_tentativas(), corpo.to_string());
}

fn registrar_tentativa(versao: &str) {
    let vezes = tentativas_de(versao) + 1;
    // Preserva a falha anterior: instalar não apaga o histórico de rede.
    gravar_registro(versao, vezes, ultima_falha_de(versao));
}

/// O download não chegou ao fim (servidor fora, rede caindo, DNS).
fn registrar_falha_de_rede(versao: &str) {
    let vezes = tentativas_de(versao);
    gravar_registro(versao, vezes, agora_em_segundos());
    diario!(
        "AVISO",
        "não consegui baixar a atualização {versao}; só vou tentar de novo daqui a algumas horas"
    );
}

/// Some com o registro quando a atualização deu certo (o launcher já é a versão
/// nova, então nada aqui vale mais).
fn limpar_tentativas() {
    let _ = std::fs::remove_file(arquivo_de_tentativas());
}

fn sha256_do_arquivo(caminho: &std::path::Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let mut f = std::fs::File::open(caminho).map_err(|e| e.to_string())?;
    let mut h = Sha256::new();
    std::io::copy(&mut f, &mut h).map_err(|e| e.to_string())?;
    Ok(format!("{:x}", h.finalize()))
}

/// ⚠️ CONFERE ANTES DE EXECUTAR. Nunca remover.
///
/// O launcher rodava como instalador QUALQUER arquivo que chegasse na URL. Em
/// 02/08/2026 chegou um arquivo de 94 MB no lugar do instalador de 17,5 MB
/// (falha na publicação) e todo jogador em versão anterior entrou em loop.
fn conferir_instalador(
    caminho: &std::path::Path,
    sha_esperado: &Option<String>,
    tamanho_esperado: Option<u64>,
) -> Result<(), String> {
    let tamanho = std::fs::metadata(caminho).map_err(|e| e.to_string())?.len();

    // Piso de sanidade, válido mesmo com manifesto antigo (sem sha/size): um
    // instalador NSIS começa com "MZ" e nunca é minúsculo. Pega página de erro
    // HTML servida com 200, que é o disfarce mais comum de download quebrado.
    let mut cabecalho = [0u8; 2];
    {
        use std::io::Read;
        let mut f = std::fs::File::open(caminho).map_err(|e| e.to_string())?;
        f.read_exact(&mut cabecalho).map_err(|e| e.to_string())?;
    }
    if &cabecalho != b"MZ" {
        return Err("o arquivo baixado não é um instalador do Windows".into());
    }
    if tamanho < 1_000_000 {
        return Err(format!("o instalador baixado está incompleto ({tamanho} bytes)"));
    }

    if let Some(esperado) = tamanho_esperado {
        if tamanho != esperado {
            return Err(format!(
                "o instalador baixado tem {tamanho} bytes, mas deveria ter {esperado}"
            ));
        }
    }
    if let Some(esperado) = sha_esperado {
        let obtido = sha256_do_arquivo(caminho)?;
        if !obtido.eq_ignore_ascii_case(esperado) {
            return Err("o instalador baixado está corrompido (assinatura não confere)".into());
        }
    }
    Ok(())
}

/// Confere um arquivo baixado que NAO e executavel do Windows (AppImage, DMG).
///
/// Mesmo papel de `conferir_instalador`, sem o teste do cabecalho `MZ`: um
/// AppImage comeca com ELF e um DMG com outra coisa, entao aquele teste
/// reprovaria justamente os arquivos certos. O que importa aqui — tamanho
/// anunciado e sha256 — vale igual nas tres plataformas.
#[cfg(any(target_os = "linux", target_os = "macos"))]
fn conferir_baixado(
    caminho: &std::path::Path,
    sha_esperado: &Option<String>,
    tamanho_esperado: Option<u64>,
) -> Result<(), String> {
    let tamanho = std::fs::metadata(caminho).map_err(|e| e.to_string())?.len();
    if tamanho < 1_000_000 {
        return Err(format!("o arquivo baixado está incompleto ({tamanho} bytes)"));
    }
    if let Some(esperado) = tamanho_esperado {
        if tamanho != esperado {
            return Err(format!(
                "o arquivo baixado tem {tamanho} bytes, mas deveria ter {esperado}"
            ));
        }
    }
    if let Some(esperado) = sha_esperado {
        let obtido = sha256_do_arquivo(caminho)?;
        if !obtido.eq_ignore_ascii_case(esperado) {
            return Err("o arquivo baixado está corrompido (assinatura não confere)".into());
        }
    }
    Ok(())
}

/// Baixa o instalador do LAUNCHER de uma fonte e o confere.
///
/// Apaga o arquivo quando ele não presta, para a fonte seguinte (ou a próxima
/// tentativa) começar de disco limpo em vez de tentar retomar lixo.
fn baixar_instalador_do_launcher(
    app: &AppHandle,
    url: &str,
    tmp: &std::path::Path,
    sha256: &Option<String>,
    size: Option<u64>,
) -> Result<(), String> {
    download_with_progress(app, url, tmp)?;
    if let Err(e) = conferir_instalador(tmp, sha256, size) {
        let _ = std::fs::remove_file(tmp); // não deixa lixo para a próxima tentativa
        return Err(e);
    }
    Ok(())
}

fn do_self_update(
    app: &AppHandle,
    url: &str,
    url_reserva: Option<&str>,
    versao: &str,
    sha256: &Option<String>,
    size: Option<u64>,
) -> Result<(), String> {
    let tmp = std::env::temp_dir().join("Ultrafoot-Launcher-setup.exe");

    // ⚠️ DUAS FONTES PARA O MESMO BINÁRIO — ver o campo `url_reserva`.
    //
    // A segunda é tentada quando a primeira falha por QUALQUER motivo: rede,
    // HTTP, ou hash que não confere. O `sha256` é o mesmo nos dois casos, então
    // trocar de servidor não afrouxa nada — só tira o servidor único do caminho
    // crítico do conserto.
    let mut ultimo = match baixar_instalador_do_launcher(app, url, &tmp, sha256, size) {
        Ok(()) => None,
        Err(e) => Some(e),
    };
    if let Some(erro) = &ultimo {
        if let Some(reserva) = url_reserva.filter(|r| !r.is_empty() && *r != url) {
            diario!("AVISO", "fonte principal do launcher falhou ({erro}); tentando a reserva");
            ultimo = match baixar_instalador_do_launcher(app, reserva, &tmp, sha256, size) {
                Ok(()) => None,
                Err(e) => Some(e),
            };
        }
    }
    if let Some(e) = ultimo {
        // Cancelamento é ordem do jogador, não falha de servidor: não pode
        // comprar as horas de silêncio do freio.
        if !controle::foi_cancelado(&e) {
            registrar_falha_de_rede(versao);
        }
        return Err(e);
    }

    // Só conta a tentativa depois que o arquivo passou: um download interrompido
    // não deve gastar as chances de uma instalação que nunca chegou a começar.
    registrar_tentativa(versao);
    emit(app, "installing");
    spawn_installer_and_relaunch(&tmp)?;
    Ok(())
}

/// Roda o instalador do launcher e reabre o app — DESTACADO (Windows).
#[cfg(windows)]
fn spawn_installer_and_relaunch(setup: &std::path::Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    // ⚠️ SO `CREATE_NO_WINDOW` — NAO somar `DETACHED_PROCESS` (relato: "uma tela
    // preta de `timeout /t 2 /nobreak` aparece durante a instalacao").
    //
    // As duas flags se atrapalham. `DETACHED_PROCESS` diz "nao herde o console
    // do pai e nao receba nenhum"; o `cmd.exe`, sendo aplicacao de console e
    // ficando sem um, **aloca um console proprio — visivel**, com o titulo da
    // linha que estiver rodando. O `>nul` do script esconde o TEXTO, nunca a
    // janela. `CREATE_NO_WINDOW` sozinho cria o console ja oculto, que e o que
    // se quer aqui.
    //
    // Tirar `DETACHED_PROCESS` nao encurta a vida do processo: no Windows o
    // filho nao morre com o pai (nao ha job object envolvido), e e por isso que
    // o .bat consegue esperar os 2 s, rodar o instalador e reabrir o launcher
    // depois que o processo antigo ja saiu.
    //
    // Este era o UNICO spawn do launcher que somava as duas flags — os outros
    // seis (instalador do jogo, requisitos, etc.) ja usavam so `CREATE_NO_WINDOW`
    // e nunca mostraram janela.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("não consegui iniciar a atualização: {e}"))?;
    Ok(())
}

#[cfg(not(windows))]
fn spawn_installer_and_relaunch(_setup: &std::path::Path) -> Result<(), String> {
    Err("auto-update do launcher é suportado apenas no Windows".into())
}

/// Compara "1.0.1" > "1.0.0" numericamente, segmento a segmento.
///
/// Usa a mesma normalizacao do registro: `split('.')` cru transformava
/// "v1.0.239" em [0,0,0] e "1.0.239 (x64)" em [1,0,0], fazendo qualquer
/// publicacao parecer mais nova que o que ja estava instalado.
fn is_newer(latest: &str, current: &str) -> bool {
    let a = parse_versao(latest);
    let b = parse_versao(current);
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
        .ok_or_else(|| {
            // Mensagem ACIONAVEL. "não encontrei o jogo instalado" nao dizia ao
            // jogador o que fazer, e o registro pode listar o jogo (DisplayVersion
            // existe, o botao diz "Jogar") sem trazer o caminho do .exe — dai o
            // clique falhava sem explicacao nenhuma.
            "o registro do Windows não diz onde o .exe do jogo está. \
             Reinstale o jogo pelo launcher para recadastrar o caminho."
                .to_string()
        })?;

    // Um caminho registrado que nao existe mais (jogo apagado na mao, pasta
    // movida) daria um erro de sistema cru vindo do spawn.
    if !std::path::Path::new(&target).exists() {
        return Err(format!("o arquivo do jogo não está mais em {target}"));
    }

    #[cfg(target_os = "macos")]
    {
        // No macOS abrimos o bundle .app com `open`.
        std::process::Command::new("open")
            .arg(&target)
            .status()
            .map_err(|e| format!("não consegui abrir o jogo: {e}"))?;
        let _ = app;
        return Ok(());
    }
    // Windows e Linux: o launcher CONTINUA VIVO supervisionando o jogo (tempo de
    // jogo, presença e detecção de crash). Ver o comentário de abertura de
    // `jogo.rs` — o `app.exit(0)` que existia aqui era o que impedia tudo isso.
    #[cfg(not(target_os = "macos"))]
    {
        jogo::abrir(&app, &target)
    }
}

// ─── Desinstalar pelo launcher ───────────────────────────────────────────────

/// Remove o jogo usando o desinstalador registrado pelo próprio NSIS.
///
/// Fazer isso na mão (apagar a pasta) deixaria a chave do registro para trás — e
/// é essa chave que o launcher lê para saber o que está instalado. Meia
/// desinstalação é pior do que nenhuma: o jogo some, o launcher continua achando
/// que ele existe e o botão Jogar aponta para o nada.
#[cfg(windows)]
#[tauri::command]
async fn desinstalar_jogo(app: AppHandle) -> Result<(), String> {
    if jogo::esta_rodando() {
        return Err("feche o Ultrafoot antes de desinstalar".into());
    }
    let comando = uninstall_string().ok_or("não encontrei o desinstalador do jogo no registro")?;

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        diario!("INFO", "desinstalando: {comando}");

        // `_?=` faz o desinstalador do NSIS rodar do lugar em vez de se copiar
        // para o temp — sem isso o processo volta na hora e não dá para saber
        // quando terminou, e o launcher mostraria "instalado" logo depois.
        let caminho = std::path::PathBuf::from(&comando);
        let pasta = caminho.parent().map(|p| p.to_path_buf());
        let mut cmd = std::process::Command::new(&caminho);
        cmd.arg("/S").creation_flags(CREATE_NO_WINDOW);
        if let Some(dir) = &pasta {
            cmd.raw_arg(format!("_?={}", dir.display()));
        }
        let status = cmd.status().map_err(|e| format!("não consegui desinstalar: {e}"))?;
        if !status.success() {
            return Err(format!(
                "o desinstalador terminou com erro (código {})",
                status.code().unwrap_or(-1)
            ));
        }
        // O desinstalador do NSIS deixa o próprio .exe para trás quando roda com
        // `_?=`; a pasta vazia fica ocupando lugar sem servir para nada.
        if let Some(dir) = pasta {
            let _ = std::fs::remove_file(dir.join("uninstall.exe"));
            let _ = std::fs::remove_dir(&dir);
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("tarefa interrompida: {e}"))??;

    diario!("INFO", "jogo desinstalado");
    avisar_sistema(&app, "Ultrafoot 26 removido", "A desinstalação terminou.");
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
async fn desinstalar_jogo(_app: AppHandle) -> Result<(), String> {
    Err("desinstalar pelo launcher só está disponível no Windows".into())
}

/// Caminho do desinstalador registrado pelo NSIS (sem os argumentos).
#[cfg(windows)]
fn uninstall_string() -> Option<String> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let raizes = [
        (RegKey::predef(HKEY_CURRENT_USER), r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
        (RegKey::predef(HKEY_LOCAL_MACHINE), r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
        (RegKey::predef(HKEY_LOCAL_MACHINE), r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];
    for (raiz, caminho) in raizes.iter() {
        let Ok(uninstall) = raiz.open_subkey(*caminho) else { continue };
        for nome in uninstall.enum_keys().flatten() {
            let Ok(sub) = uninstall.open_subkey(&nome) else { continue };
            let display: String = sub.get_value("DisplayName").unwrap_or_default();
            let minusculo = display.to_lowercase();
            if !minusculo.contains("ultrafoot") || minusculo.contains("launcher") {
                continue;
            }
            let bruto: String = sub.get_value("UninstallString").unwrap_or_default();
            let bruto = bruto.trim();
            if bruto.is_empty() {
                continue;
            }
            // Vem como `"C:\...\uninstall.exe" /S` ou sem aspas: separa o
            // programa dos argumentos, senão o `/S` entra no caminho.
            let so_o_exe = if let Some(resto) = bruto.strip_prefix('"') {
                resto.split('"').next().unwrap_or(resto).to_string()
            } else {
                bruto.split(" /").next().unwrap_or(bruto).trim().to_string()
            };
            if std::path::Path::new(&so_o_exe).exists() {
                return Some(so_o_exe);
            }
        }
    }
    None
}

/// Cria o atalho na área de trabalho apontando para o jogo.
///
/// Feito pelo WScript.Shell porque criar um .lnk de verdade exige COM
/// (IShellLink) — uma dependência inteira para uma linha de PowerShell que o
/// Windows já traz.
#[cfg(windows)]
#[tauri::command]
fn criar_atalho() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let alvo = read_installed_game().path.ok_or("o jogo não está instalado")?;
    let script = format!(
        "$a=[Environment]::GetFolderPath('Desktop');\
         $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $a 'Ultrafoot 26.lnk'));\
         $s.TargetPath='{alvo}';$s.WorkingDirectory=Split-Path '{alvo}';$s.Save()"
    );
    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("não consegui criar o atalho: {e}"))?;
    if !status.success() {
        return Err("não consegui criar o atalho".into());
    }
    diario!("INFO", "atalho criado na área de trabalho");
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn criar_atalho() -> Result<(), String> {
    Err("atalho automático só está disponível no Windows".into())
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
        let alvo = endpoints();
        let body: serde_json::Value =
            buscar_json_com_reserva(&alvo.launcher, &alvo.launcher_reserva)
                .map_err(|e| format!("falha ao consultar atualização do launcher: {e}"))?;

        let version = body.get("version").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let url = body.get("url").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let notes = body.get("notes").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let sha256 = body.get("sha256").and_then(|v| v.as_str()).map(|s| s.to_string());
        let size = body.get("size").and_then(|v| v.as_u64());
        // Segunda fonte do MESMO binário (ver o campo em `LatestInfo`). Só
        // aceita https: um manifesto adulterado não vai apontar o instalador
        // para http nem para caminho local.
        let url_reserva = body
            .get("urlReserva")
            .and_then(|v| v.as_str())
            .map(|s| s.trim())
            .filter(|s| s.starts_with("https://"))
            .map(|s| s.to_string());

        if version.is_empty() || url.is_empty() {
            return Ok(None);
        }
        if !is_newer(&version, env!("CARGO_PKG_VERSION")) {
            // Já estamos na versão anunciada: se havia tentativa registrada, ela
            // deu certo — e o contador não pode sobrar para envenenar a próxima.
            limpar_tentativas();
            return Ok(None);
        }
        // Se esta mesma versão já foi tentada até o limite e o launcher AINDA é o
        // antigo, instalar de novo daria no mesmo. Devolve a decisão ao jogador
        // em vez de repetir o ciclo.
        //
        // A segunda condição cobre o outro caminho, que era o mais comum e não
        // tinha freio nenhum: o download que nem chega a terminar porque o
        // servidor está fora. Ver `ultima_falha_de`.
        let falhou_ha_pouco = {
            let ultima = ultima_falha_de(&version);
            ultima > 0 && agora_em_segundos().saturating_sub(ultima) < ESPERA_APOS_FALHA_DE_REDE
        };
        let auto = tentativas_de(&version) < MAX_TENTATIVAS && !falhou_ha_pouco;
        // `manifesto` é do JOGO (atualização por arquivo). O launcher se
        // atualiza pelo instalador inteiro — ele tem 17 MB, não 600.
        Ok(Some(LatestInfo { version, notes, url, url_reserva, sha256, size, auto, manifesto: None }))
    }
}

#[tauri::command]
async fn self_update(
    app: AppHandle,
    url: String,
    url_reserva: Option<String>,
    version: Option<String>,
    sha256: Option<String>,
    size: Option<u64>,
) -> Result<(), String> {
    let app2 = app.clone();
    let versao = version.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || {
        do_self_update(&app2, &url, url_reserva.as_deref(), &versao, &sha256, size)
    })
    .await
    .map_err(|e| format!("tarefa interrompida: {e}"))??;
    app.exit(0);
    Ok(())
}

/// SAIR DE VEZ — o único caminho de saída do launcher.
///
/// A tela pergunta antes ("deseja mesmo fechar?"); quando a resposta é sim, quem
/// encerra é este comando, e não `window.destroy()` do lado do JavaScript.
///
/// A diferença importa: destruir a janela deixa de pé a bandeja e as threads de
/// download/supervisão, e depende de uma permissão da janela para funcionar —
/// era exatamente por essa permissão faltar que o X não fechava nada. `app.exit`
/// não depende de permissão nenhuma e derruba o processo inteiro, que é o que
/// "fechar o launcher" significa para quem clicou.
#[tauri::command]
fn encerrar_launcher(app: AppHandle) {
    diario!("INFO", "launcher encerrado pelo usuário");
    encerrar(&app);
}

/// Saída única: credita a sessão de jogo aberta e derruba o processo.
fn encerrar(app: &AppHandle) {
    jogo::fechar_sessao_em_andamento();
    app.exit(0);
}

#[derive(Serialize, Clone)]
struct ServerStatus {
    online: bool,
    game_version: Option<String>,
}

#[tauri::command]
fn fetch_launcher_config() -> Result<serde_json::Value, String> {
    ureq::get(&endpoints().config)
        .timeout(std::time::Duration::from_secs(8))
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


// ─── Login com Google (PKCE) ─────────────────────────────────────────────────
//
// App DESKTOP nao pode receber o retorno do OAuth numa URL publica: o Google
// exige um `redirect_uri` que o app controle. O padrao e abrir uma porta EFEMERA
// em 127.0.0.1, mandar o navegador para o Google e esperar ele voltar nela.
//
// Detalhes que evitam problema:
//   • Porta 0 = o SO escolhe uma livre. Fixar porta quebra se algo ja a usar, e
//     o Google aceita qualquer porta em http://127.0.0.1 para cliente Desktop.
//   • O `state` e conferido aqui. Sem essa checagem, um site malicioso poderia
//     mandar um `code` proprio para a nossa porta e logar o jogador na conta
//     ERRADA (CSRF de OAuth).
//   • Timeout: se o usuario fechar o navegador sem concluir, a thread nao pode
//     ficar presa para sempre segurando a porta.
/// Pasta neutra que o LAUNCHER e o JOGO enxergam.
///
/// Cada app Tauri tem a propria pasta de dados (identificadores diferentes), e
/// por isso o launcher nao consegue escrever no armazenamento do jogo. Este
/// diretorio comum e o ponto de encontro dos dois.
pub(crate) fn pasta_compartilhada() -> Option<std::path::PathBuf> {
    let base = if cfg!(windows) {
        std::env::var_os("APPDATA").map(std::path::PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join("Library/Application Support"))
    } else {
        std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".local/share"))
    }?;
    let pasta = base.join("Ultrafoot");
    std::fs::create_dir_all(&pasta).ok()?;
    Some(pasta)
}

/// Deixa a chave de ativacao onde o jogo vai ler ao abrir.
///
/// O launcher NAO registra o jogo — so entrega a chave. Quem confere a
/// assinatura e o proprio jogo, com o segredo dele. Se fosse o launcher a dizer
/// "esta registrado", bastaria adulterar este arquivo para liberar tudo.
#[tauri::command]
fn salvar_ativacao(codigo: String, email: String) -> Result<(), String> {
    let pasta = pasta_compartilhada().ok_or("nao encontrei a pasta de dados")?;
    let conteudo = serde_json::json!({
        "codigo": codigo,
        "email": email,
        "origem": "launcher",
    });
    std::fs::write(pasta.join("ativacao.json"), conteudo.to_string())
        .map_err(|e| format!("nao consegui gravar a ativacao: {e}"))
}

/// Deixa a sessao da conta onde o JOGO consegue ler.
///
/// O jogo nao tem tela de login: quem entra e o launcher. Compartilhando a
/// sessao, o jogo passa a saber de quem e a carreira e consegue catalogar os
/// saves na conta — que e o que permite recuperar tudo depois de formatar.
///
/// O arquivo some no logout (`token` vazio): sessao de quem saiu nao pode ficar
/// esquecida no disco.
#[tauri::command]
fn salvar_sessao(token: String, email: String, nome: String) -> Result<(), String> {
    let pasta = pasta_compartilhada().ok_or("nao encontrei a pasta de dados")?;
    let arquivo = pasta.join("sessao.json");
    if token.is_empty() {
        let _ = std::fs::remove_file(&arquivo);
        return Ok(());
    }
    let conteudo = serde_json::json!({ "token": token, "email": email, "nome": nome });
    std::fs::write(&arquivo, conteudo.to_string())
        .map_err(|e| format!("nao consegui gravar a sessao: {e}"))
}

#[tauri::command]
async fn google_login(app: AppHandle, auth_url_base: String, state: String) -> Result<String, String> {
    use std::io::{BufRead, BufReader, Write as IoWrite};
    use std::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("nao consegui abrir a porta local: {e}"))?;
    let porta = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect = format!("http://127.0.0.1:{porta}");

    // O front monta a URL sem o redirect_uri (so ele sabe a porta agora).
    let url = format!("{auth_url_base}&redirect_uri={}&state={}",
        urlencoding_simples(&redirect), urlencoding_simples(&state));

    tauri_plugin_opener::open_url(&url, None::<&str>)
        .map_err(|e| format!("nao consegui abrir o navegador: {e}"))?;

    let resultado = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        // ⚠️ NÃO-BLOQUEANTE DE PROPÓSITO.
        //
        // Com o listener bloqueante, o `limite` abaixo só era avaliado DEPOIS
        // que alguma conexão chegasse — ou seja, nunca, justamente no caso que
        // ele existe para cobrir. Quem fechasse o navegador sem concluir deixava
        // esta thread e a porta local presas até o launcher morrer. Agora o
        // prazo corre mesmo sem ninguém do outro lado.
        listener.set_nonblocking(true).ok();
        let limite = std::time::Instant::now() + std::time::Duration::from_secs(300);
        loop {
            if std::time::Instant::now() > limite {
                return Err("tempo esgotado aguardando o Google".into());
            }
            let mut fluxo = match listener.accept() {
                Ok((f, _)) => f,
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(120));
                    continue;
                }
                Err(_) => continue,
            };
            // O socket aceito herda o modo do listener. A leitura abaixo é por
            // linha e bloqueante; sem prazo próprio, um cliente que abre a
            // conexão e não fala nada seguraria a thread de novo.
            fluxo.set_nonblocking(false).ok();
            let _ = fluxo.set_read_timeout(Some(std::time::Duration::from_secs(10)));

            let mut linha = String::new();
            BufReader::new(&fluxo).read_line(&mut linha).ok();

            // "GET /?code=...&state=... HTTP/1.1"
            let alvo = linha.split_whitespace().nth(1).unwrap_or("").to_string();
            let mut code = String::new();
            let mut state_recebido = String::new();
            if let Some(q) = alvo.split('?').nth(1) {
                for par in q.split('&') {
                    let mut kv = par.splitn(2, '=');
                    match (kv.next(), kv.next()) {
                        (Some("code"), Some(v)) => code = desurlencode(v),
                        (Some("state"), Some(v)) => state_recebido = desurlencode(v),
                        _ => {}
                    }
                }
            }

            // ⚠️ CONEXÃO SEM `code` NÃO É FALHA — É RUÍDO, E ELE CHEGA SEMPRE.
            //
            // O Chrome abre conexões TCP especulativas antes de navegar, e todo
            // navegador pede /favicon.ico depois de renderizar a página. Qualquer
            // uma delas chegando primeiro caía no `return Err` lá embaixo e
            // matava um login que ia dar certo — falha intermitente, do tipo que
            // não se reproduz na máquina de quem programou. Só o retorno do
            // Google traz `code`: o resto se responde e se ignora.
            if code.is_empty() {
                let _ = write!(fluxo, "HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n");
                let _ = fluxo.flush();
                continue;
            }

            let ok = state_recebido == state;
            let corpo = if ok {
                "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Ultrafoot 26</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(1200px 600px at 50% -10%,#0d2a2a 0%,#060b0e 60%),#060b0e;color:#e6edf0;font:15px/1.6 ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif;padding:24px}.cartao{max-width:420px;width:100%;text-align:center;padding:40px 32px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(10,18,21,.72);backdrop-filter:blur(12px);box-shadow:0 30px 80px rgba(0,0,0,.5)}.marca{font:800 11px/1 ui-sans-serif,system-ui;letter-spacing:.32em;text-transform:uppercase;color:#48eed6;margin-bottom:26px}.selo{width:60px;height:60px;margin:0 auto 20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;background:#48eed61f;border:1px solid #48eed640;color:#48eed6}h1{margin:0 0 8px;font-size:21px;letter-spacing:-.01em}p{margin:0;color:#8b9aa1;font-size:14px}.rodape{margin-top:26px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07);font-size:12px;color:#5d6b72}</style></head><body><div class='cartao'><div class='marca'>Ultrafoot 26</div><div class='selo'>&#10003;</div><h1>Tudo certo</h1><p>Sua conta foi conectada. Volte para o Ultrafoot Launcher para continuar.</p><div class='rodape'>Pode fechar esta aba.</div></div></body></html>"
            } else {
                "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Ultrafoot 26</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(1200px 600px at 50% -10%,#0d2a2a 0%,#060b0e 60%),#060b0e;color:#e6edf0;font:15px/1.6 ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif;padding:24px}.cartao{max-width:420px;width:100%;text-align:center;padding:40px 32px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(10,18,21,.72);backdrop-filter:blur(12px);box-shadow:0 30px 80px rgba(0,0,0,.5)}.marca{font:800 11px/1 ui-sans-serif,system-ui;letter-spacing:.32em;text-transform:uppercase;color:#ff8f8f;margin-bottom:26px}.selo{width:60px;height:60px;margin:0 auto 20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;background:#ff6b6b1f;border:1px solid #ff6b6b40;color:#ff6b6b}h1{margin:0 0 8px;font-size:21px;letter-spacing:-.01em}p{margin:0;color:#8b9aa1;font-size:14px}.rodape{margin-top:26px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07);font-size:12px;color:#5d6b72}</style></head><body><div class='cartao'><div class='marca'>Ultrafoot 26</div><div class='selo'>!</div><h1>N&atilde;o deu certo</h1><p>N&atilde;o foi poss&iacute;vel concluir a entrada. Tente de novo pelo launcher.</p><div class='rodape'>Pode fechar esta aba.</div></div></body></html>"
            };
            // ⚠️ `\r\n` EXPLÍCITO. Antes as quebras eram literais no meio da
            // string: funcionavam só porque ESTE arquivo está em CRLF, e uma
            // normalização para LF (um `git config`, um editor) transformaria o
            // cabeçalho HTTP em algo malformado sem mudar uma linha de código.
            let _ = write!(
                fluxo,
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                corpo.len(),
                corpo
            );
            let _ = fluxo.flush();

            if !ok {
                return Err("resposta do Google invalida (state nao confere)".into());
            }
            return Ok(format!("{code}|{redirect}"));
        }
    })
    .await
    .map_err(|e| format!("tarefa interrompida: {e}"))?;

    let _ = app;
    resultado
}

/// Codificacao minima de URL — evitamos dependencia nova so para isto.
fn urlencoding_simples(s: &str) -> String {
    s.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
        _ => format!("%{b:02X}"),
    }).collect()
}

fn desurlencode(s: &str) -> String {
    let bytes = s.replace('+', " ").into_bytes();
    let mut saida = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&String::from_utf8_lossy(&bytes[i + 1..i + 3]), 16) {
                saida.push(v);
                i += 3;
                continue;
            }
        }
        saida.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&saida).into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // UMA INSTANCIA POR VEZ — e o PRIMEIRO plugin de proposito: ele decide se
        // este processo continua vivo, e essa decisao tem de vir antes de
        // qualquer outro plugin reservar recurso (bandeja, autostart, janela).
        //
        // O launcher acumula tres portas de entrada — atalho na area de trabalho,
        // "iniciar com o Windows" e o icone na bandeja — e ainda e reaberto pelo
        // instalador do jogo. Sem trava, cada uma abria um processo novo, e dois
        // launchers baixando a mesma atualizacao gravam no MESMO arquivo temporario:
        // um corrompe o download do outro.
        //
        // Fechar no X so ESCONDE a janela (vai para a bandeja). Por isso a segunda
        // abertura nao pode simplesmente morrer calada: quem clicou espera ver o
        // launcher. `show_main` traz a janela de volta e da foco nela.
        //
        // O auto-update nao e afetado: `self_update` chama `app.exit(0)` antes de o
        // .bat esperar os 2s e reabrir o executavel — o processo antigo ja morreu
        // quando o novo sobe.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_opener::init())
        // Seletor de pasta de instalação (o jogador escolhe o disco).
        .plugin(tauri_plugin_dialog::init())
        // Avisos do sistema: o launcher passa muito tempo escondido (bandeja
        // durante o download, e enquanto o jogo roda) — sem notificação, "o
        // download acabou" e "o jogo caiu" ficariam invisíveis.
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            diario::limpar_antigos();
            diario!(
                "INFO",
                "launcher {} iniciado ({} {})",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                std::env::consts::ARCH
            );
            controle::carregar_limite();
            // AUDITORIA DOS REQUISITOS NA ABERTURA, fora da thread da UI.
            //
            // Só LÊ o registro e registra no diário — não instala nada aqui. O
            // valor é o diagnóstico: quando alguém disser "instalei e não abre",
            // a resposta já está no log daquele dia, sem precisar perguntar nada.
            std::thread::spawn(|| {
                let _ = requisitos::auditar_requisitos();
            });

            // DESCOBERTA DE ENDEREÇOS FORA DA THREAD DA UI.
            //
            // `endpoints()` faz uma consulta de rede na PRIMEIRA chamada, e no
            // Tauri os comandos síncronos rodam na thread principal — resolver
            // no primeiro `fetch_latest` seguraria a janela por até 5 s. Aqui
            // ela é aquecida em paralelo, logo na abertura: quando a UI pedir,
            // o OnceLock já está preenchido e a chamada é instantânea.
            std::thread::spawn(|| {
                let _ = endpoints();
            });

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
                    // "Sair" na bandeja não pergunta nada — é um item de menu
                    // que já diz o que faz. Mas passa pela mesma saída da tela,
                    // para o tempo de jogo em andamento não se perder.
                    "quit" => encerrar(app),
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
            encerrar_launcher,
            fetch_launcher_config,
            check_server_status,
            google_login,
            salvar_ativacao,
            salvar_sessao,
            // Atualização diferencial e integridade
            patch::atualizar_por_partes,
            patch::verificar_arquivos,
            patch::tem_manifesto,
            // Controle do download
            controle::pausar_download,
            controle::retomar_download,
            controle::cancelar_download,
            controle::definir_limite_de_banda,
            controle::estado_do_download,
            // Disco e pasta de instalação
            disco::espaco_no_disco,
            disco::pasta_de_instalacao,
            disco::escolher_pasta_de_instalacao,
            disco::limpar_pasta_de_instalacao,
            // O jogo em execução
            jogo::estado_do_jogo,
            jogo::parar_jogo,
            jogo::tempo_de_jogo,
            jogo::acao_ao_abrir,
            jogo::definir_acao_ao_abrir,
            // Requisitos do sistema (WebView2, VC++, .NET, DirectX)
            requisitos::auditar_requisitos,
            requisitos::instalar_requisito,
            requisitos::garantir_requisitos,
            // Manutenção
            desinstalar_jogo,
            criar_atalho,
            canal,
            definir_canal,
            versoes_anteriores,
            diario::abrir_pasta_de_logs,
            diario::gerar_diagnostico
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Ultrafoot Launcher");
}

// ─── Testes ──────────────────────────────────────────────────────────────────
//
// ⚠️ CADA CASO AQUI É UM DEFEITO QUE JÁ CHEGOU COMO RELATO DE JOGADOR.
//
// `parse_versao` e `is_newer` decidem uma coisa só — "preciso atualizar?" — e
// quando erram o sintoma é sempre o mesmo: "atualiza, sai, entro e atualiza
// dnv". São funções puras, sem rede, sem registro e sem disco; o custo de
// travá-las com teste é este arquivo, e ele paga sozinho na primeira vez que
// alguém mexer na normalização.
#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn versao_limpa() {
        assert_eq!(parse_versao("1.0.239"), vec![1, 0, 239]);
    }

    #[test]
    fn versao_com_prefixo_v() {
        // O registro já devolveu "v1.0.239". Com `split('.')` cru isto virava
        // [0, 0, 0] e TODA publicação parecia mais nova.
        assert_eq!(parse_versao("v1.0.239"), vec![1, 0, 239]);
        assert_eq!(parse_versao("V1.0.239"), vec![1, 0, 239]);
    }

    #[test]
    fn versao_com_sufixo_e_quarto_componente() {
        assert_eq!(parse_versao("1.0.239 (x64)"), vec![1, 0, 239, 64]);
        assert_eq!(parse_versao("1.0.239.0"), vec![1, 0, 239, 0]);
    }

    #[test]
    fn versao_vazia_ou_lixo() {
        assert_eq!(parse_versao(""), Vec::<u32>::new());
        assert_eq!(parse_versao("   "), Vec::<u32>::new());
        assert_eq!(parse_versao("desconhecida"), Vec::<u32>::new());
    }

    #[test]
    fn mais_nova_de_verdade() {
        assert!(is_newer("1.0.240", "1.0.239"));
        assert!(is_newer("1.1.0", "1.0.999"));
        assert!(is_newer("2.0.0", "1.9.9"));
    }

    #[test]
    fn mesma_versao_nao_atualiza() {
        assert!(!is_newer("1.0.239", "1.0.239"));
        // O ponto do teste: as três grafias abaixo são a MESMA versão. Se
        // qualquer uma delas passar por "mais nova", volta o loop de update.
        assert!(!is_newer("1.0.239", "v1.0.239"));
        assert!(!is_newer("1.0.239", "1.0.239.0"));
        assert!(!is_newer("v1.0.239", "1.0.239"));
    }

    #[test]
    fn versao_mais_velha_nao_atualiza() {
        assert!(!is_newer("1.0.238", "1.0.239"));
        assert!(!is_newer("1.0.9", "1.0.10")); // comparação numérica, não textual
    }

    #[test]
    fn instalada_ilegivel_nao_forca_atualizacao_infinita() {
        // Versão instalada vazia vira [] e qualquer publicada ganha — é o
        // comportamento certo (não dá para afirmar que está atualizado), mas
        // fica registrado aqui para a mudança ser deliberada, não acidental.
        assert!(is_newer("1.0.239", ""));
        assert!(!is_newer("", ""));
    }
}
