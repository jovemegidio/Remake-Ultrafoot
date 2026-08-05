// ESPAÇO EM DISCO E ONDE O JOGO É INSTALADO.
//
// Por que checar espaço ANTES de baixar: o instalador do Ultrafoot passa de meio
// giga, e disco cheio no meio da instalação é exatamente a falha silenciosa que
// gerou o loop de atualização de 02/08/2026 — o NSIS termina, o registro não
// muda, o launcher relê a versão velha e recomeça. Recusar antes, dizendo quanto
// falta, troca um loop mudo por uma frase acionável.
//
// A pasta de instalação é uma escolha do jogador (SSD pequeno + HD grande é a
// máquina típica de quem joga football manager). O NSIS aceita destino em modo
// silencioso pelo `/D=`, então dá para oferecer a escolha sem abrir instalador.

use serde::Serialize;

// ─── Espaço livre ────────────────────────────────────────────────────────────

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn GetDiskFreeSpaceExW(
        lpDirectoryName: *const u16,
        lpFreeBytesAvailableToCaller: *mut u64,
        lpTotalNumberOfBytes: *mut u64,
        lpTotalNumberOfFreeBytes: *mut u64,
    ) -> i32;
}

/// Bytes livres no volume que contém `caminho`. `None` quando não dá para saber
/// (plataforma sem suporte, caminho inválido) — e aí NINGUÉM é barrado: é
/// melhor tentar instalar do que impedir por falta de informação.
pub fn espaco_livre_em(caminho: &std::path::Path) -> Option<u64> {
    // Sobe até um diretório que exista: a pasta de destino pode ainda não ter
    // sido criada, mas o volume dela existe.
    let mut alvo = caminho;
    while !alvo.exists() {
        alvo = alvo.parent()?;
    }

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let largo: Vec<u16> = alvo.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let mut livre_para_mim: u64 = 0;
        let mut total: u64 = 0;
        let mut livre_total: u64 = 0;
        let ok = unsafe {
            GetDiskFreeSpaceExW(largo.as_ptr(), &mut livre_para_mim, &mut total, &mut livre_total)
        };
        if ok == 0 {
            return None;
        }
        // `livre_para_mim` respeita cota de usuário; é o número que realmente
        // limita a gravação deste processo.
        Some(livre_para_mim)
    }
    #[cfg(not(windows))]
    {
        // Sem libc como dependência, o `df` resolve e não custa nada aqui.
        let saida = std::process::Command::new("df")
            .arg("-Pk")
            .arg(alvo)
            .output()
            .ok()?;
        let texto = String::from_utf8_lossy(&saida.stdout);
        let linha = texto.lines().nth(1)?;
        let kb: u64 = linha.split_whitespace().nth(3)?.parse().ok()?;
        Some(kb * 1024)
    }
}

/// "1,4 GB" — o formato que vai para a tela e para o diagnóstico.
pub fn humano(bytes: u64) -> String {
    const GB: f64 = 1_073_741_824.0;
    const MB: f64 = 1_048_576.0;
    let b = bytes as f64;
    if b >= GB {
        format!("{:.1} GB", b / GB)
    } else {
        format!("{:.0} MB", b / MB)
    }
}

/// Margem sobre o tamanho do download.
///
/// O instalador é baixado E extraído: em pico, o disco segura o .exe temporário
/// mais os arquivos escritos. 2,2× o pacote é o que cobre esse pico com folga
/// para o NSIS trabalhar, mais 300 MB de respiro para o sistema — um Windows com
/// zero byte livre trava por conta própria, mesmo que a instalação caiba.
pub fn precisa_de(tamanho_do_pacote: u64) -> u64 {
    (tamanho_do_pacote as f64 * 2.2) as u64 + 300 * 1_048_576
}

/// Barra o download quando o disco não comporta. A mensagem diz o que falta —
/// "sem espaço" sozinho manda a pessoa adivinhar quanto liberar.
pub fn conferir_espaco(destino: &std::path::Path, tamanho_do_pacote: u64) -> Result<(), String> {
    if tamanho_do_pacote == 0 {
        return Ok(()); // tamanho desconhecido: não dá para julgar
    }
    let Some(livre) = espaco_livre_em(destino) else {
        return Ok(());
    };
    let necessario = precisa_de(tamanho_do_pacote);
    if livre >= necessario {
        return Ok(());
    }
    Err(format!(
        "espaço insuficiente em {}: são precisos {} e há {} livres. Libere {} e tente de novo.",
        destino.display(),
        humano(necessario),
        humano(livre),
        humano(necessario - livre)
    ))
}

#[derive(Serialize)]
pub struct EspacoNoDisco {
    pub caminho: String,
    pub livre: Option<u64>,
    pub livre_texto: String,
}

#[tauri::command]
pub fn espaco_no_disco(caminho: Option<String>) -> EspacoNoDisco {
    let alvo = caminho
        .filter(|c| !c.is_empty())
        .map(std::path::PathBuf::from)
        .or_else(|| pasta_escolhida().map(std::path::PathBuf::from))
        .or_else(|| {
            crate::read_installed_game()
                .path
                .and_then(|p| std::path::Path::new(&p).parent().map(|d| d.to_path_buf()))
        })
        .unwrap_or_else(|| std::env::temp_dir());

    let livre = espaco_livre_em(&alvo);
    EspacoNoDisco {
        caminho: alvo.to_string_lossy().into_owned(),
        livre,
        livre_texto: livre.map(humano).unwrap_or_else(|| "?".into()),
    }
}

// ─── Pasta de instalação escolhida ───────────────────────────────────────────

fn arquivo_de_preferencia() -> Option<std::path::PathBuf> {
    crate::pasta_compartilhada().map(|p| p.join("instalacao.json"))
}

/// Pasta escolhida pelo jogador, se houver. Vazio = destino padrão do NSIS.
pub fn pasta_escolhida() -> Option<String> {
    let caminho = arquivo_de_preferencia()?;
    let texto = std::fs::read_to_string(caminho).ok()?;
    let v: serde_json::Value = serde_json::from_str(&texto).ok()?;
    let pasta = v.get("pasta")?.as_str()?.trim().to_string();
    (!pasta.is_empty()).then_some(pasta)
}

#[tauri::command]
pub fn pasta_de_instalacao() -> Option<String> {
    // Já instalado? O que vale é onde o jogo REALMENTE está, não o que foi
    // escolhido um dia — reinstalar em outro lugar deixaria duas cópias.
    if let Some(exe) = crate::read_installed_game().path {
        if let Some(dir) = std::path::Path::new(&exe).parent() {
            return Some(dir.to_string_lossy().into_owned());
        }
    }
    pasta_escolhida()
}

/// Abre o seletor de pastas e guarda a escolha. Devolve a pasta escolhida.
///
/// SÓ VALE ANTES DA PRIMEIRA INSTALAÇÃO: com o jogo instalado, mudar de pasta
/// exigiria mover ~1 GB e reescrever o registro, e o meio-termo (instalar de
/// novo no lugar novo) deixa a cópia velha ocupando disco em silêncio. Quem quer
/// trocar desinstala e instala de novo — que é o que Steam e Epic também fazem.
#[tauri::command]
pub async fn escolher_pasta_de_instalacao(app: tauri::AppHandle) -> Result<Option<String>, String> {
    if crate::read_installed_game().installed {
        return Err(
            "o jogo já está instalado. Para mudar de pasta, desinstale primeiro e instale de novo."
                .into(),
        );
    }

    let escolha = tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;
        app.dialog().file().blocking_pick_folder()
    })
    .await
    .map_err(|e| format!("tarefa interrompida: {e}"))?;

    let Some(caminho) = escolha else { return Ok(None) };
    let texto = caminho.to_string();

    // A pasta do jogo é criada dentro da escolhida, como Steam faz com
    // steamapps/common — escolher "D:\" e receber os arquivos soltos na raiz do
    // disco é a surpresa clássica dos instaladores antigos.
    let destino = std::path::Path::new(&texto).join("Ultrafoot 26");
    let destino = destino.to_string_lossy().into_owned();

    let arquivo = arquivo_de_preferencia().ok_or("não encontrei a pasta de dados")?;
    let corpo = serde_json::json!({ "pasta": destino });
    std::fs::write(arquivo, corpo.to_string())
        .map_err(|e| format!("não consegui guardar a escolha: {e}"))?;
    crate::diario!("INFO", "pasta de instalação escolhida: {destino}");
    Ok(Some(destino))
}

#[tauri::command]
pub fn limpar_pasta_de_instalacao() -> Result<(), String> {
    if let Some(arquivo) = arquivo_de_preferencia() {
        let _ = std::fs::remove_file(arquivo);
    }
    Ok(())
}
