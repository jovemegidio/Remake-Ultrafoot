// AUDITORIA DOS REQUISITOS DO SISTEMA.
//
// ─── O problema ──────────────────────────────────────────────────────────────
// O instalador do jogo entrega os arquivos e vai embora. Se faltar na máquina o
// runtime do WebView2 ou o Visual C++ Redistributable, o jogo instala
// "com sucesso" e depois **não abre** — ou abre com uma janela branca. Do lado
// do jogador isso é indistinguível de jogo quebrado, e o relato que chega é
// "instalei e não acontece nada".
//
// É o mesmo motivo pelo qual a Steam roda uma lista de redistribuíveis na
// primeira execução de cada jogo, e a EA App tem "reparar dependências".
//
// ─── O que é auditado ────────────────────────────────────────────────────────
// ESSENCIAL — sem isto o Ultrafoot não abre, e o launcher instala sozinho:
//   • Runtime do Microsoft Edge WebView2 — o jogo É uma aplicação Tauri: toda a
//     interface roda dentro dele. É a dependência número um.
//   • Visual C++ 2015-2022 x64 — a biblioteca de runtime C que o executável e o
//     próprio WebView2 usam.
//
// RECOMENDADO — o jogo funciona sem, mas cobre máquinas antigas:
//   • .NET Framework 4.8 — o Windows 10 1903+ já traz. Fica na lista porque
//     instalações antigas (e Windows 8.1) não têm, e ferramentas auxiliares do
//     sistema dependem dele.
//   • DirectX (D3DCompiler) — o Windows 8+ já traz o `d3dcompiler_47.dll`, que
//     é o que a aceleração gráfica do WebView2 usa. Quando ele falta, o jogo
//     abre em modo software e fica lento; o pacote da Microsoft repõe.
//
// ⚠️ NÃO INSTALAMOS O QUE JÁ ESTÁ LÁ. Cada item é DETECTADO antes: rodar um
// redistribuível à toa custa minutos, pede UAC sem motivo e é a forma mais
// rápida de o jogador achar que o launcher está fazendo algo errado.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Clone)]
pub struct Requisito {
    pub id: String,
    pub nome: String,
    pub descricao: String,
    /// Sem isto o jogo não abre — o launcher instala sozinho antes de jogar.
    pub essencial: bool,
    pub instalado: bool,
    /// O que foi encontrado na máquina (versão do registro, quando existe).
    pub versao: Option<String>,
    pub url: Option<String>,
    pub argumentos: Vec<String>,
    /// Instaladores de sistema pedem elevação — vira um prompt do Windows.
    pub precisa_admin: bool,
    /// Instalador que já veio junto com o jogo (evita baixar de novo).
    pub local: Option<String>,
    pub tamanho_mb: u32,
}

// ─── Detecção ────────────────────────────────────────────────────────────────

/// Recebe a raiz JÁ ABERTA (`RegKey::predef(...)`) porque o `winreg` 0.52 não
/// exporta um nome para o tipo da constante `HKEY_*` — dá para usá-las, não para
/// declará-las num parâmetro.
#[cfg(windows)]
fn valor_do_registro(raiz: &winreg::RegKey, caminho: &str, nome: &str) -> Option<String> {
    let chave = raiz.open_subkey(caminho).ok()?;
    // O valor pode ser texto (pv, Version) ou número (Release, Installed).
    chave
        .get_value::<String, _>(nome)
        .ok()
        .or_else(|| chave.get_value::<u32, _>(nome).ok().map(|n| n.to_string()))
}

/// Runtime do WebView2. Procura nas três chaves possíveis: máquina 64 bits,
/// máquina 32 bits e instalação por usuário — o instalador escolhe uma
/// dependendo de como foi executado, e olhar só uma delas dá falso negativo.
#[cfg(windows)]
fn webview2() -> Option<String> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    const CLIENTE: &str = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    let lugares = [
        (RegKey::predef(HKEY_LOCAL_MACHINE), format!(r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{CLIENTE}")),
        (RegKey::predef(HKEY_LOCAL_MACHINE), format!(r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{CLIENTE}")),
        (RegKey::predef(HKEY_CURRENT_USER), format!(r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{CLIENTE}")),
    ];
    for (raiz, caminho) in lugares.iter() {
        if let Some(v) = valor_do_registro(raiz, caminho, "pv") {
            // "0.0.0.0" é o que fica quando o runtime foi desinstalado.
            if !v.is_empty() && v != "0.0.0.0" {
                return Some(v);
            }
        }
    }
    None
}

#[cfg(windows)]
fn vcredist() -> Option<String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    let maquina = RegKey::predef(HKEY_LOCAL_MACHINE);
    for caminho in [
        r"SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        r"SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
    ] {
        if valor_do_registro(&maquina, caminho, "Installed").as_deref() == Some("1") {
            return valor_do_registro(&maquina, caminho, "Version").or(Some("ok".into()));
        }
    }
    None
}

/// .NET Framework 4.x. O número em `Release` é a forma oficial de comparar —
/// 528040 é o 4.8. Ver a tabela da Microsoft antes de mexer neste valor.
#[cfg(windows)]
fn dotnet48() -> Option<String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    let bruto = valor_do_registro(
        &RegKey::predef(HKEY_LOCAL_MACHINE),
        r"SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full",
        "Release",
    )?;
    let release: u32 = bruto.parse().ok()?;
    (release >= 528_040).then(|| format!("Release {release}"))
}

/// O que a aceleração gráfica do WebView2 realmente usa é o `d3dcompiler_47`.
#[cfg(windows)]
fn directx() -> Option<String> {
    let sistema = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
    let compilador = std::path::Path::new(&sistema).join("System32").join("d3dcompiler_47.dll");
    compilador.exists().then(|| "d3dcompiler_47 presente".to_string())
}

/// Instalador que veio junto com o jogo, quando existe (não precisa baixar).
#[cfg(windows)]
fn instalador_local(nome: &str) -> Option<String> {
    let exe = crate::read_installed_game().path?;
    let raiz = std::path::Path::new(&exe).parent()?;
    for pasta in ["prerequisites", "resources/prerequisites"] {
        let alvo = raiz.join(pasta.replace('/', "\\")).join(nome);
        if alvo.exists() {
            return Some(alvo.to_string_lossy().into_owned());
        }
    }
    None
}

// ─── Extras publicados remotamente ───────────────────────────────────────────
//
// Permite acrescentar um requisito sem lançar versão nova do launcher (o
// `launcher-config.json` é editável sem rebuild).
//
// ⚠️ SHA256 OBRIGATÓRIO. Isto aqui BAIXA E EXECUTA um programa, muitas vezes
// como administrador. Sem conferir a assinatura do arquivo, quem conseguisse
// alterar o arquivo de configuração — ou responder no lugar dele — mandaria o
// launcher rodar o que quisesse na máquina de todo mundo. Extra sem `sha256` é
// ignorado, de propósito.
#[derive(Deserialize)]
struct RequisitoRemoto {
    id: String,
    nome: String,
    #[serde(default)]
    descricao: String,
    url: String,
    sha256: String,
    #[serde(default)]
    argumentos: Vec<String>,
    #[serde(default)]
    precisa_admin: bool,
    /// Caminho de arquivo cuja existência indica "já instalado".
    #[serde(default)]
    arquivo_teste: Option<String>,
    #[serde(default)]
    tamanho_mb: u32,
}

fn extras_remotos() -> Vec<Requisito> {
    let Ok(config) = crate::fetch_launcher_config() else { return Vec::new() };
    let Some(lista) = config.get("requisitos").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    lista
        .iter()
        .filter_map(|item| {
            let r: RequisitoRemoto = serde_json::from_value(item.clone()).ok()?;
            if r.sha256.len() != 64 {
                crate::diario!("AVISO", "requisito remoto '{}' ignorado: sem sha256", r.id);
                return None;
            }
            let instalado = r
                .arquivo_teste
                .as_ref()
                .map(|c| std::path::Path::new(c).exists())
                .unwrap_or(false);
            Some(Requisito {
                id: r.id,
                nome: r.nome,
                descricao: r.descricao,
                essencial: false,
                instalado,
                versao: None,
                url: Some(r.url),
                argumentos: r.argumentos,
                precisa_admin: r.precisa_admin,
                local: None,
                tamanho_mb: r.tamanho_mb,
            })
        })
        .collect()
}

// ─── A lista ─────────────────────────────────────────────────────────────────

#[cfg(windows)]
fn lista() -> Vec<Requisito> {
    let wv = webview2();
    let vc = vcredist();
    let net = dotnet48();
    let dx = directx();

    let mut itens = vec![
        Requisito {
            id: "webview2".into(),
            nome: "Microsoft Edge WebView2".into(),
            descricao: "Motor onde o Ultrafoot roda. Sem ele o jogo não abre.".into(),
            essencial: true,
            instalado: wv.is_some(),
            versao: wv,
            url: Some("https://go.microsoft.com/fwlink/p/?LinkId=2124703".into()),
            // O bootstrapper baixa e instala a versão certa para o sistema.
            argumentos: vec!["/silent".into(), "/install".into()],
            precisa_admin: false,
            local: instalador_local("MicrosoftEdgeWebview2Setup.exe"),
            tamanho_mb: 2,
        },
        Requisito {
            id: "vcredist".into(),
            nome: "Visual C++ 2015-2022 (x64)".into(),
            descricao: "Bibliotecas de runtime usadas pelo jogo e pelo WebView2.".into(),
            essencial: true,
            instalado: vc.is_some(),
            versao: vc,
            url: Some("https://aka.ms/vs/17/release/vc_redist.x64.exe".into()),
            argumentos: vec!["/install".into(), "/quiet".into(), "/norestart".into()],
            precisa_admin: true,
            local: instalador_local("vc_redist.x64.exe"),
            tamanho_mb: 18,
        },
        Requisito {
            id: "dotnet48".into(),
            nome: ".NET Framework 4.8".into(),
            descricao: "Já vem no Windows 10 recente. Cobre instalações antigas.".into(),
            essencial: false,
            instalado: net.is_some(),
            versao: net,
            url: Some("https://go.microsoft.com/fwlink/?LinkId=2085155".into()),
            argumentos: vec!["/q".into(), "/norestart".into()],
            precisa_admin: true,
            tamanho_mb: 2,
            local: None,
        },
        Requisito {
            id: "directx".into(),
            nome: "DirectX (D3DCompiler)".into(),
            descricao: "Aceleração gráfica da interface. Sem ele o jogo fica lento.".into(),
            essencial: false,
            instalado: dx.is_some(),
            versao: dx,
            url: Some(
                "https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe"
                    .into(),
            ),
            argumentos: vec!["/Q".into()],
            precisa_admin: true,
            tamanho_mb: 1,
            local: None,
        },
    ];
    itens.extend(extras_remotos());
    itens
}

#[cfg(not(windows))]
fn lista() -> Vec<Requisito> {
    // Linux/macOS resolvem dependência pelo gerenciador de pacotes do sistema.
    Vec::new()
}

#[tauri::command]
pub fn auditar_requisitos() -> Vec<Requisito> {
    let itens = lista();
    let faltando: Vec<&str> = itens
        .iter()
        .filter(|r| !r.instalado)
        .map(|r| r.id.as_str())
        .collect();
    if faltando.is_empty() {
        crate::diario!("INFO", "requisitos do sistema: tudo presente");
    } else {
        crate::diario!("AVISO", "requisitos faltando: {}", faltando.join(", "));
    }
    itens
}

// ─── Instalação ──────────────────────────────────────────────────────────────

#[cfg(windows)]
fn executar(caminho: &std::path::Path, argumentos: &[String], admin: bool) -> Result<i32, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    if !admin {
        let saida = std::process::Command::new(caminho)
            .args(argumentos)
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| format!("não consegui executar o instalador: {e}"))?;
        return Ok(saida.code().unwrap_or(-1));
    }

    // ELEVAÇÃO. Redistribuíveis do sistema exigem administrador, e o launcher
    // roda como usuário comum (o jogo instala em currentUser). O `-Verb RunAs`
    // faz o Windows pedir a permissão — recusar devolve erro, não trava.
    let lista_args = if argumentos.is_empty() {
        String::new()
    } else {
        format!(
            " -ArgumentList {}",
            argumentos
                .iter()
                .map(|a| format!("'{}'", a.replace('\'', "''")))
                .collect::<Vec<_>>()
                .join(",")
        )
    };
    let script = format!(
        "$p = Start-Process -FilePath '{}'{} -Verb RunAs -Wait -PassThru; exit $p.ExitCode",
        caminho.display().to_string().replace('\'', "''"),
        lista_args
    );
    let saida = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("não consegui pedir a elevação: {e}"))?;
    Ok(saida.code().unwrap_or(-1))
}

#[cfg(not(windows))]
fn executar(_c: &std::path::Path, _a: &[String], _admin: bool) -> Result<i32, String> {
    Err("requisitos do sistema só se aplicam ao Windows".into())
}

fn instalar_um(app: &tauri::AppHandle, requisito: &Requisito) -> Result<(), String> {
    if requisito.instalado {
        return Ok(());
    }
    crate::diario!("INFO", "instalando requisito {}", requisito.id);
    crate::emitir_progresso(app, "prereq", 0, 0, 0, 0, 0);

    // 1) Instalador que já veio com o jogo — nada a baixar.
    let caminho = if let Some(local) = requisito.local.as_ref().filter(|c| std::path::Path::new(c).exists()) {
        std::path::PathBuf::from(local)
    } else {
        let url = requisito.url.as_ref().ok_or("requisito sem instalador")?;
        let destino = std::env::temp_dir().join(format!("ultrafoot-req-{}.exe", requisito.id));
        let _ = std::fs::remove_file(&destino);
        crate::download_with_progress(app, url, &destino)?;

        // Piso de sanidade: instalador do Windows começa com "MZ". Pega página
        // de erro HTML servida com 200 — o disfarce mais comum de link morto.
        let mut cabecalho = [0u8; 2];
        {
            use std::io::Read;
            let mut f = std::fs::File::open(&destino).map_err(|e| e.to_string())?;
            f.read_exact(&mut cabecalho).map_err(|e| e.to_string())?;
        }
        if &cabecalho != b"MZ" {
            let _ = std::fs::remove_file(&destino);
            return Err(format!("o download de {} não é um instalador", requisito.nome));
        }
        destino
    };

    crate::emitir_progresso(app, "prereq", 50, 0, 0, 0, 0);
    let codigo = executar(&caminho, &requisito.argumentos, requisito.precisa_admin)?;

    // 3010 = instalado, precisa reiniciar. 1638 = versão igual ou mais nova já
    // presente. Os dois são sucesso; tratá-los como erro faria o launcher
    // insistir para sempre num requisito que já está lá.
    if !matches!(codigo, 0 | 3010 | 1638) {
        return Err(format!(
            "{} terminou com erro (código {codigo})",
            requisito.nome
        ));
    }

    // CONFERE DE NOVO NA MÁQUINA. O código de saída diz que o instalador rodou,
    // não que a dependência ficou utilizável.
    let agora = lista().into_iter().find(|r| r.id == requisito.id);
    match agora {
        Some(r) if r.instalado => {
            crate::diario!("INFO", "requisito {} instalado", requisito.id);
            Ok(())
        }
        _ if codigo == 3010 => {
            crate::diario!("INFO", "requisito {} instalado — reinício pendente", requisito.id);
            Ok(())
        }
        _ => Err(format!(
            "{} foi instalado mas continua ausente. Reinicie o computador e tente de novo.",
            requisito.nome
        )),
    }
}

#[tauri::command]
pub async fn instalar_requisito(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let itens = lista();
        let alvo = itens
            .into_iter()
            .find(|r| r.id == id)
            .ok_or_else(|| format!("requisito desconhecido: {id}"))?;
        instalar_um(&app2, &alvo)
    })
    .await
    .map_err(|e| format!("tarefa interrompida: {e}"))?
}

/// Garante os ESSENCIAIS antes de instalar/atualizar o jogo.
///
/// Devolve os nomes do que foi instalado agora — a UI usa para contar o que fez.
/// Falhar aqui NÃO impede o download: é melhor o jogo estar no disco e faltar um
/// runtime (que a aba Gerenciar mostra) do que travar a instalação inteira.
#[tauri::command]
pub async fn garantir_requisitos(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut instalados = Vec::new();
        for requisito in lista().into_iter().filter(|r| r.essencial && !r.instalado) {
            match instalar_um(&app2, &requisito) {
                Ok(()) => instalados.push(requisito.nome.clone()),
                Err(e) => {
                    crate::diario!("ERRO", "requisito {}: {e}", requisito.id);
                    crate::avisar_sistema(
                        &app2,
                        "Falta um componente do Windows",
                        &format!("{}: {e}", requisito.nome),
                    );
                }
            }
        }
        Ok(instalados)
    })
    .await
    .map_err(|e| format!("tarefa interrompida: {e}"))?
}
