// O LAUNCHER CONTINUA VIVO ENQUANTO O JOGO RODA.
//
// Antes, `launch_game` terminava com `app.exit(0)`: o launcher se matava no
// instante em que o jogo abria. A consequência não era estética — era funcional:
//
//   • a presença no FC Hub morria justo quando a pessoa começava a jogar (a aba
//     existe para mostrar quem está jogando, e mostrava exatamente o contrário);
//   • não havia como saber quanto tempo alguém jogou, nem quando foi a última
//     vez — a informação mais visível de qualquer biblioteca de launcher;
//   • jogo fechando por crash era indistinguível de jogo fechado normalmente,
//     porque não sobrava ninguém para observar o código de saída.
//
// Agora o launcher some da barra de tarefas (vai para a bandeja) e fica
// supervisionando o processo filho. É o que Steam, Epic e EA App fazem.

use serde::Serialize;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager};

struct SessaoAtiva {
    filho: std::process::Child,
    inicio: std::time::Instant,
}

fn ativa() -> &'static Mutex<Option<SessaoAtiva>> {
    static ATIVA: OnceLock<Mutex<Option<SessaoAtiva>>> = OnceLock::new();
    ATIVA.get_or_init(|| Mutex::new(None))
}

#[derive(Serialize, Clone, Default)]
pub struct TempoDeJogo {
    pub total_segundos: u64,
    /// Época em segundos. 0 = nunca jogou.
    pub ultima_vez: u64,
    pub sessoes: u64,
}

#[derive(Serialize, Clone, Default)]
pub struct EstadoDoJogo {
    pub rodando: bool,
    pub sessao_segundos: u64,
    pub total_segundos: u64,
    pub ultima_vez: u64,
    pub sessoes: u64,
}

fn arquivo_de_tempo() -> Option<std::path::PathBuf> {
    crate::pasta_compartilhada().map(|p| p.join("tempo-de-jogo.json"))
}

pub fn tempo_total() -> TempoDeJogo {
    let Some(arquivo) = arquivo_de_tempo() else { return TempoDeJogo::default() };
    let Ok(texto) = std::fs::read_to_string(arquivo) else { return TempoDeJogo::default() };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&texto) else {
        return TempoDeJogo::default();
    };
    TempoDeJogo {
        total_segundos: v.get("totalSegundos").and_then(|x| x.as_u64()).unwrap_or(0),
        ultima_vez: v.get("ultimaVez").and_then(|x| x.as_u64()).unwrap_or(0),
        sessoes: v.get("sessoes").and_then(|x| x.as_u64()).unwrap_or(0),
    }
}

/// Soma a sessão que acabou de terminar.
///
/// Sessão de menos de 30 s não conta como partida jogada: abrir e fechar por
/// engano — ou um crash na abertura — não pode virar "você jogou 12 vezes".
fn somar_sessao(segundos: u64) {
    if segundos < 30 {
        return;
    }
    let atual = tempo_total();
    let novo = serde_json::json!({
        "totalSegundos": atual.total_segundos + segundos,
        "ultimaVez": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        "sessoes": atual.sessoes + 1,
    });
    if let Some(arquivo) = arquivo_de_tempo() {
        let _ = std::fs::write(arquivo, novo.to_string());
    }
}

/// Fecha a sessão em andamento ANTES de o launcher morrer.
///
/// Quem soma o tempo é `supervisionar`, e ele só soma quando VÊ o jogo terminar.
/// Se o launcher sai primeiro, aquela thread morre junto com o processo e a
/// partida inteira some do "tempo de jogo" — e sair com o jogo aberto é caso
/// comum (fechar no X, "Sair" na bandeja). Aqui a sessão é contabilizada com o
/// tempo decorrido até agora; o jogo continua rodando (o `Child` do Rust não
/// mata o processo ao ser descartado).
pub fn fechar_sessao_em_andamento() {
    let Ok(mut guarda) = ativa().lock() else { return };
    let Some(sessao) = guarda.take() else { return };
    let segundos = sessao.inicio.elapsed().as_secs();
    drop(guarda);
    somar_sessao(segundos);
    crate::diario!("INFO", "launcher saiu com o jogo aberto ({segundos}s creditados)");
}

fn emitir(app: &AppHandle, estado: EstadoDoJogo) {
    let _ = app.emit("launcher://jogo", estado);
}

pub fn estado_atual() -> EstadoDoJogo {
    let t = tempo_total();
    let sessao = ativa()
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|s| s.inicio.elapsed().as_secs()));
    EstadoDoJogo {
        rodando: sessao.is_some(),
        sessao_segundos: sessao.unwrap_or(0),
        total_segundos: t.total_segundos,
        ultima_vez: t.ultima_vez,
        sessoes: t.sessoes,
    }
}

#[tauri::command]
pub fn estado_do_jogo() -> EstadoDoJogo {
    estado_atual()
}

/// O que a janela do launcher faz quando o jogo abre.
///
/// Padrão: sumir para a bandeja. Ninguém quer duas janelas disputando o Alt+Tab,
/// mas FECHAR o launcher (o que ele fazia) custa presença, tempo de jogo e
/// detecção de crash. Esconder tem o efeito visual de fechar, sem o custo.
fn preferencia_ao_abrir() -> String {
    let padrao = "bandeja".to_string();
    let Some(pasta) = crate::pasta_compartilhada() else { return padrao };
    let Ok(texto) = std::fs::read_to_string(pasta.join("janela.json")) else { return padrao };
    serde_json::from_str::<serde_json::Value>(&texto)
        .ok()
        .and_then(|v| v.get("aoAbrirOJogo").and_then(|x| x.as_str()).map(|s| s.to_string()))
        .unwrap_or(padrao)
}

#[tauri::command]
pub fn definir_acao_ao_abrir(acao: String) -> Result<(), String> {
    let pasta = crate::pasta_compartilhada().ok_or("não encontrei a pasta de dados")?;
    let corpo = serde_json::json!({ "aoAbrirOJogo": acao });
    std::fs::write(pasta.join("janela.json"), corpo.to_string())
        .map_err(|e| format!("não consegui guardar a preferência: {e}"))
}

#[tauri::command]
pub fn acao_ao_abrir() -> String {
    preferencia_ao_abrir()
}

/// Abre o jogo e passa a supervisioná-lo.
pub fn abrir(app: &AppHandle, caminho: &str) -> Result<(), String> {
    {
        let mut guarda = ativa().lock().map_err(|_| "estado interno inconsistente")?;
        // Já rodando? Não abre um segundo. Duas instâncias do jogo escrevem no
        // mesmo save — é assim que uma carreira se perde.
        if let Some(sessao) = guarda.as_mut() {
            match sessao.filho.try_wait() {
                Ok(None) => return Err("o jogo já está aberto".into()),
                _ => {
                    *guarda = None;
                }
            }
        }
    }

    let mut comando = std::process::Command::new(caminho);
    // "--via-launcher" evita o redirecionamento do jogo de volta ao launcher.
    comando.arg("--via-launcher").env("ULTRAFOOT_VIA_LAUNCHER", "1");
    // Trabalhar na pasta do jogo: caminhos relativos do executável dependem
    // disso, e o diretório atual do launcher pode ser qualquer coisa.
    if let Some(dir) = std::path::Path::new(caminho).parent() {
        comando.current_dir(dir);
    }

    let filho = comando
        .spawn()
        .map_err(|e| format!("não consegui abrir o jogo: {e}"))?;
    let pid = filho.id();
    crate::diario!("INFO", "jogo aberto (pid {pid}): {caminho}");

    if let Ok(mut guarda) = ativa().lock() {
        *guarda = Some(SessaoAtiva { filho, inicio: std::time::Instant::now() });
    }

    match preferencia_ao_abrir().as_str() {
        "fechar" => {
            // Quem preferir o comportamento antigo continua tendo — mas agora é
            // escolha, e escolher isto significa abrir mão do tempo de jogo.
            app.exit(0);
            return Ok(());
        }
        "minimizar" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.minimize();
            }
        }
        "nada" => {}
        _ => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        }
    }

    emitir(app, estado_atual());
    supervisionar(app.clone());
    Ok(())
}

/// Fica de olho no processo do jogo até ele terminar.
fn supervisionar(app: AppHandle) {
    std::thread::spawn(move || {
        let mut ultimo_aviso = std::time::Instant::now();
        loop {
            std::thread::sleep(std::time::Duration::from_millis(1000));

            let terminou = {
                let Ok(mut guarda) = ativa().lock() else { break };
                let Some(sessao) = guarda.as_mut() else { break };
                match sessao.filho.try_wait() {
                    Ok(Some(saida)) => {
                        let segundos = sessao.inicio.elapsed().as_secs();
                        let codigo = saida.code().unwrap_or(-1);
                        *guarda = None;
                        Some((segundos, codigo))
                    }
                    Ok(None) => None,
                    // Não conseguimos mais observar o processo: encerra a
                    // sessão em vez de contar tempo para sempre.
                    Err(_) => {
                        let segundos = sessao.inicio.elapsed().as_secs();
                        *guarda = None;
                        Some((segundos, 0))
                    }
                }
            };

            let Some((segundos, codigo)) = terminou else {
                // Enquanto roda, avisa a UI de tempos em tempos para o contador
                // da sessão andar sem custo de um evento por segundo.
                if ultimo_aviso.elapsed().as_secs() >= 15 {
                    ultimo_aviso = std::time::Instant::now();
                    emitir(&app, estado_atual());
                }
                continue;
            };

            somar_sessao(segundos);
            crate::diario!(
                if codigo == 0 { "INFO" } else { "ERRO" },
                "jogo fechou após {segundos}s (código {codigo})"
            );

            // A janela volta quando o jogo sai — é o que Steam faz, e evita o
            // launcher fantasma só na bandeja depois de horas de partida.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
            }

            // CRASH tem tratamento próprio: código != 0 depois de menos de um
            // minuto quase sempre é falha de abertura (DLL faltando, GPU,
            // antivírus), e é a hora certa de oferecer "verificar arquivos".
            if codigo != 0 {
                crate::avisar_sistema(
                    &app,
                    "O Ultrafoot fechou inesperadamente",
                    "Abra o launcher e use Verificar arquivos para conferir a instalação.",
                );
                let _ = app.emit("launcher://jogo-caiu", codigo);
            }

            emitir(&app, estado_atual());
            break;
        }
    });
}

/// Encerra o jogo pelo launcher ("Parar", como na Steam).
#[tauri::command]
pub fn parar_jogo(app: AppHandle) -> Result<(), String> {
    let mut guarda = ativa().lock().map_err(|_| "estado interno inconsistente")?;
    let Some(sessao) = guarda.as_mut() else {
        return Err("o jogo não está aberto".into());
    };
    sessao.filho.kill().map_err(|e| format!("não consegui encerrar o jogo: {e}"))?;
    crate::diario!("INFO", "jogo encerrado pelo launcher");
    drop(guarda);
    emitir(&app, estado_atual());
    Ok(())
}

/// O jogo está rodando agora? Usado antes de aplicar patch e de desinstalar —
/// mexer nos arquivos com o executável aberto é falha garantida no Windows.
pub fn esta_rodando() -> bool {
    ativa()
        .lock()
        .ok()
        .and_then(|mut g| g.as_mut().map(|s| matches!(s.filho.try_wait(), Ok(None))))
        .unwrap_or(false)
}

#[tauri::command]
pub fn tempo_de_jogo() -> TempoDeJogo {
    tempo_total()
}
