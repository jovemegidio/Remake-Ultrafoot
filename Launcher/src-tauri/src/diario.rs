// DIÁRIO DO LAUNCHER — o arquivo que faltava em 02/08/2026.
//
// Naquele dia a instalação falhou em silêncio, o launcher entrou em loop de
// atualização e não sobrou NADA para investigar: nenhum log, nenhum código de
// erro, nenhuma pista de qual etapa quebrou. O relato possível era "fica
// atualizando pra sempre", e não dava para ir além disso.
//
// Este módulo existe para que a próxima falha deixe rastro. Ele grava um
// arquivo por dia em %APPDATA%/Ultrafoot/logs, guarda uma semana e nunca
// interrompe o launcher: log que quebra o app é pior do que não ter log, então
// TUDO aqui ignora erro de escrita de propósito.

use std::io::Write;
use std::sync::Mutex;

/// Quantos dias de log ficam no disco. Uma semana cobre "aconteceu de novo
/// ontem" sem transformar a pasta em depósito.
const DIAS_GUARDADOS: u64 = 7;

fn pasta_de_logs() -> Option<std::path::PathBuf> {
    let pasta = crate::pasta_compartilhada()?.join("logs");
    std::fs::create_dir_all(&pasta).ok()?;
    Some(pasta)
}

/// Segundos desde a época (UTC).
fn agora() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Converte segundos-da-época em (ano, mês, dia, hora, minuto, segundo) UTC.
///
/// Sem `chrono`: uma dependência inteira para carimbar hora em log não se paga,
/// e o algoritmo civil-from-days é fechado e testável. Fonte: Howard Hinnant,
/// `civil_from_days` — o mesmo que a libstdc++ usa.
pub fn data_hora(epoca: u64) -> (i64, u32, u32, u32, u32, u32) {
    let dias = (epoca / 86_400) as i64;
    let resto = epoca % 86_400;

    let z = dias + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // dia da era [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let ano = if m <= 2 { y + 1 } else { y };

    (
        ano,
        m,
        d,
        (resto / 3600) as u32,
        ((resto % 3600) / 60) as u32,
        (resto % 60) as u32,
    )
}

fn carimbo() -> String {
    let (a, m, d, h, mi, s) = data_hora(agora());
    format!("{a:04}-{m:02}-{d:02} {h:02}:{mi:02}:{s:02}Z")
}

fn arquivo_do_dia() -> Option<std::path::PathBuf> {
    let (a, m, d, ..) = data_hora(agora());
    Some(pasta_de_logs()?.join(format!("launcher-{a:04}-{m:02}-{d:02}.log")))
}

// Uma escrita por vez. As threads de download, de supervisão do jogo e a da UI
// escrevem no mesmo arquivo; sem isto as linhas se entrelaçam.
static TRAVA: Mutex<()> = Mutex::new(());

/// Grava uma linha no diário. Também vai para o stderr em depuração.
pub fn registrar(nivel: &str, mensagem: &str) {
    #[cfg(debug_assertions)]
    eprintln!("[{nivel}] {mensagem}");

    let Some(caminho) = arquivo_do_dia() else { return };
    let _guarda = TRAVA.lock();
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&caminho) {
        let _ = writeln!(f, "{} {:<5} {}", carimbo(), nivel, mensagem);
    }
}

#[macro_export]
macro_rules! diario {
    ($nivel:expr, $($arg:tt)*) => {
        $crate::diario::registrar($nivel, &format!($($arg)*))
    };
}

/// Apaga logs velhos. Chamado uma vez, na abertura.
pub fn limpar_antigos() {
    let Some(pasta) = pasta_de_logs() else { return };
    let limite = agora().saturating_sub(DIAS_GUARDADOS * 86_400);
    let Ok(itens) = std::fs::read_dir(&pasta) else { return };
    for item in itens.flatten() {
        let caminho = item.path();
        let nome = caminho.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if !nome.starts_with("launcher-") || !nome.ends_with(".log") {
            continue;
        }
        let velho = item
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() < limite)
            .unwrap_or(false);
        if velho {
            let _ = std::fs::remove_file(&caminho);
        }
    }
}

/// Abre a pasta de logs no explorador de arquivos.
#[tauri::command]
pub fn abrir_pasta_de_logs() -> Result<(), String> {
    let pasta = pasta_de_logs().ok_or("não encontrei a pasta de logs")?;
    tauri_plugin_opener::open_path(pasta.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|e| format!("não consegui abrir a pasta: {e}"))
}

/// Junta num arquivo só tudo que o suporte precisa perguntar.
///
/// É o "colete os logs" do EA App: em vez de pedir ao jogador cinco
/// informações que ele não sabe onde achar, ele manda UM arquivo.
#[tauri::command]
pub fn gerar_diagnostico() -> Result<String, String> {
    let pasta = pasta_de_logs().ok_or("não encontrei a pasta de logs")?;
    let jogo = crate::read_installed_game();
    let (a, m, d, h, mi, _) = data_hora(agora());

    let mut texto = String::new();
    texto.push_str("=== Diagnóstico do Ultrafoot Launcher ===\n");
    texto.push_str(&format!("Gerado em ....: {carimbo}\n", carimbo = carimbo()));
    texto.push_str(&format!("Launcher .....: {}\n", env!("CARGO_PKG_VERSION")));
    texto.push_str(&format!("Sistema ......: {} {}\n", std::env::consts::OS, std::env::consts::ARCH));
    texto.push_str(&format!("Jogo instalado: {}\n", jogo.installed));
    texto.push_str(&format!("Versão do jogo: {}\n", jogo.version.clone().unwrap_or_else(|| "—".into())));
    texto.push_str(&format!("Caminho ......: {}\n", jogo.path.clone().unwrap_or_else(|| "—".into())));

    if let Some(caminho) = jogo.path.as_deref() {
        if let Some(dir) = std::path::Path::new(caminho).parent() {
            let livre = crate::disco::espaco_livre_em(dir);
            texto.push_str(&format!(
                "Disco do jogo : {} livres\n",
                livre.map(crate::disco::humano).unwrap_or_else(|| "?".into())
            ));
        }
    }
    texto.push_str(&format!(
        "Tempo de jogo : {} min em {} sessões\n",
        crate::jogo::tempo_total().total_segundos / 60,
        crate::jogo::tempo_total().sessoes
    ));

    texto.push_str("\n=== Últimas linhas do diário ===\n");
    if let Some(arq) = arquivo_do_dia() {
        if let Ok(conteudo) = std::fs::read_to_string(&arq) {
            let linhas: Vec<&str> = conteudo.lines().collect();
            let inicio = linhas.len().saturating_sub(400);
            for linha in &linhas[inicio..] {
                texto.push_str(linha);
                texto.push('\n');
            }
        }
    }

    let destino = pasta.join(format!("diagnostico-{a:04}{m:02}{d:02}-{h:02}{mi:02}.txt"));
    std::fs::write(&destino, texto).map_err(|e| format!("não consegui gravar o diagnóstico: {e}"))?;
    // Abre a pasta já com o arquivo à vista — pedir "vá em %APPDATA%" é onde o
    // suporte perde a pessoa.
    let _ = tauri_plugin_opener::reveal_item_in_dir(&destino);
    Ok(destino.to_string_lossy().into_owned())
}
