// ATUALIZAÇÃO POR ARQUIVO (DELTA) E VERIFICAÇÃO DE INTEGRIDADE.
//
// ─── O problema ──────────────────────────────────────────────────────────────
// Toda atualização do Ultrafoot baixava o instalador INTEIRO. Uma correção de
// três linhas custava o pacote completo para cada jogador, toda vez. Com o ritmo
// de publicação do jogo (várias versões por semana), isso é o maior custo real
// do produto: banda do servidor, paciência de quem tem internet ruim e uma
// janela grande de "algo pode dar errado no meio".
//
// ─── Como funciona ───────────────────────────────────────────────────────────
// A publicação passa a gerar um MANIFESTO: a lista de todos os arquivos da
// versão, cada um com seu sha256 e tamanho. Os conteúdos ficam num armazém
// endereçado por conteúdo (`blobs/<2 primeiros do sha>/<sha>`): arquivo que não
// mudou entre versões tem o mesmo sha e já está publicado — não sobe de novo, e
// mais importante, não desce de novo.
//
// O launcher então:
//   1. lê o manifesto da versão nova;
//   2. confere o que já tem no disco (sha por arquivo, com cache para não
//      reprocessar 1 GB a cada conferida);
//   3. baixa SÓ os blobs dos arquivos que faltam ou mudaram;
//   4. aplica tudo de uma vez e apaga os arquivos que saíram da versão.
//
// Uma correção pequena vira alguns megabytes em vez de meio giga.
//
// ─── As três regras que não podem cair ───────────────────────────────────────
// • NADA é aplicado antes de TODOS os blobs estarem baixados e conferidos. Um
//   patch aplicado pela metade é uma instalação quebrada — pior do que não ter
//   atualizado, e sem instalador para consertar.
// • Caminho do manifesto é dado de rede: `..`, caminho absoluto e letra de
//   unidade são recusados. Sem isso, um manifesto adulterado escreveria em
//   qualquer lugar do disco do jogador.
// • Falhou qualquer etapa? Devolve erro e quem chamou cai no instalador
//   completo. O delta é otimização, nunca o único caminho.

use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use tauri::AppHandle;

// ─── Formato do manifesto ────────────────────────────────────────────────────

#[derive(Deserialize, Clone)]
pub struct ArquivoDoManifesto {
    pub caminho: String,
    pub sha256: String,
    pub tamanho: u64,
}

#[derive(Deserialize, Clone)]
pub struct Manifesto {
    pub versao: String,
    /// URL base do armazém de blobs (termina com "/").
    pub blobs: String,
    /// "gz" quando os blobs estão comprimidos; ausente = crus.
    #[serde(default)]
    pub compressao: Option<String>,
    pub arquivos: Vec<ArquivoDoManifesto>,
}

impl Manifesto {
    fn comprimido(&self) -> bool {
        self.compressao.as_deref() == Some("gz")
    }

    fn url_do_blob(&self, sha: &str) -> String {
        let base = if self.blobs.ends_with('/') {
            self.blobs.clone()
        } else {
            format!("{}/", self.blobs)
        };
        let prefixo = &sha[..2.min(sha.len())];
        if self.comprimido() {
            format!("{base}{prefixo}/{sha}.gz")
        } else {
            format!("{base}{prefixo}/{sha}")
        }
    }
}

#[derive(Serialize, Clone, Default)]
pub struct Relatorio {
    pub versao: String,
    pub arquivos_no_total: usize,
    /// Arquivos que precisavam ser baixados (faltando ou diferentes).
    pub arquivos_baixados: usize,
    pub bytes_baixados: u64,
    /// Quanto a versão inteira pesa — a conta que mostra a economia.
    pub bytes_da_versao: u64,
    pub arquivos_removidos: usize,
    /// `false` em verificação sem reparo, quando há arquivo corrompido.
    pub ok: bool,
    pub problemas: Vec<String>,
}

// ─── Pasta do jogo e segurança de caminho ────────────────────────────────────

fn pasta_do_jogo() -> Result<std::path::PathBuf, String> {
    let exe = crate::read_installed_game()
        .path
        .ok_or("não sei onde o jogo está instalado")?;
    std::path::Path::new(&exe)
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "caminho do jogo inválido".to_string())
}

/// Converte "resources/dados.json" em caminho absoluto DENTRO da pasta do jogo.
///
/// Recusa qualquer coisa que possa escapar dela. O manifesto vem da rede: sem
/// esta trava, `"../../Windows/System32/x.dll"` seria obedecido.
fn caminho_seguro(raiz: &std::path::Path, relativo: &str) -> Result<std::path::PathBuf, String> {
    let limpo = relativo.replace('\\', "/");
    if limpo.starts_with('/') || limpo.contains(':') {
        return Err(format!("caminho absoluto recusado: {relativo}"));
    }
    let mut destino = raiz.to_path_buf();
    for parte in limpo.split('/') {
        if parte.is_empty() || parte == "." {
            continue;
        }
        if parte == ".." {
            return Err(format!("caminho suspeito recusado: {relativo}"));
        }
        destino.push(parte);
    }
    Ok(destino)
}

// ─── Cache do estado local ───────────────────────────────────────────────────
//
// Sem ele, conferir a instalação significaria calcular o sha de todos os
// arquivos a cada atualização. Com música e imagens, isso passa de 1 GB de
// leitura — dezenas de segundos toda vez, para descobrir o que já se sabia.
//
// A chave da confiança é (tamanho + data de modificação): se os dois batem com
// o que gravamos da última vez, o sha guardado vale. Qualquer alteração no
// arquivo muda um dos dois, e aí ele é reprocessado.

#[derive(Serialize, Deserialize, Clone)]
struct EntradaDoCache {
    sha: String,
    tam: u64,
    mt: u64,
}

#[derive(Serialize, Deserialize, Default)]
struct CacheLocal {
    versao: String,
    arquivos: std::collections::HashMap<String, EntradaDoCache>,
}

fn caminho_do_cache(raiz: &std::path::Path) -> std::path::PathBuf {
    raiz.join(".ultrafoot-estado.json")
}

fn ler_cache(raiz: &std::path::Path) -> CacheLocal {
    std::fs::read_to_string(caminho_do_cache(raiz))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn gravar_cache(raiz: &std::path::Path, cache: &CacheLocal) {
    if let Ok(texto) = serde_json::to_string(cache) {
        let _ = std::fs::write(caminho_do_cache(raiz), texto);
    }
}

fn modificado_em(meta: &std::fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn sha_do_arquivo(caminho: &std::path::Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let mut f = std::fs::File::open(caminho).map_err(|e| e.to_string())?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 262_144];
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(format!("{:x}", h.finalize()))
}

// ─── Download de um blob ─────────────────────────────────────────────────────

struct Andamento {
    baixados: u64,
    total: u64,
    inicio: std::time::Instant,
    ultimo_aviso: std::time::Instant,
}

impl Andamento {
    fn avisar(&mut self, app: &AppHandle, forcar: bool) {
        if !forcar && self.ultimo_aviso.elapsed().as_millis() < 200 {
            return;
        }
        self.ultimo_aviso = std::time::Instant::now();
        let passado = self.inicio.elapsed().as_secs_f64().max(0.001);
        let velocidade = (self.baixados as f64 / passado) as u64;
        let restante = self.total.saturating_sub(self.baixados);
        let eta = if velocidade > 0 { restante / velocidade } else { 0 };
        let percent = if self.total > 0 {
            ((self.baixados.saturating_mul(100)) / self.total) as u32
        } else {
            0
        };
        crate::emitir_progresso(app, "downloading", percent.min(100), self.baixados, self.total, velocidade, eta);
    }
}

/// Baixa um blob, conferindo o sha do CONTEÚDO (não do arquivo transferido).
///
/// Com compressão, o sha do `.gz` seria outro a cada recompressão; o que
/// identifica o arquivo é o conteúdo final, e é ele que é verificado.
fn baixar_blob(
    app: &AppHandle,
    manifesto: &Manifesto,
    arquivo: &ArquivoDoManifesto,
    destino: &std::path::Path,
    andamento: &mut Andamento,
) -> Result<(), String> {
    use sha2::{Digest, Sha256};

    let url = manifesto.url_do_blob(&arquivo.sha256);
    let resposta = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(60))
        .call()
        .map_err(|e| format!("falha ao baixar {}: {e}", arquivo.caminho))?;

    let bruto = resposta.into_reader();
    let mut leitor: Box<dyn Read> = if manifesto.comprimido() {
        Box::new(flate2::read::GzDecoder::new(bruto))
    } else {
        Box::new(bruto)
    };

    if let Some(pai) = destino.parent() {
        std::fs::create_dir_all(pai).map_err(|e| format!("não consegui criar {}: {e}", pai.display()))?;
    }
    let mut saida = std::fs::File::create(destino)
        .map_err(|e| format!("não consegui gravar {}: {e}", destino.display()))?;

    let mut hash = Sha256::new();
    let mut buf = vec![0u8; 262_144];
    let mut regulador = crate::controle::Regulador::novo();
    let mut escritos: u64 = 0;

    loop {
        crate::controle::checar(app)?;
        let n = leitor
            .read(&mut buf)
            .map_err(|e| format!("erro ao baixar {}: {e}", arquivo.caminho))?;
        if n == 0 {
            break;
        }
        hash.update(&buf[..n]);
        saida.write_all(&buf[..n]).map_err(|e| format!("erro ao gravar: {e}"))?;
        escritos += n as u64;
        regulador.contar(n as u64);
        andamento.baixados += n as u64;
        andamento.avisar(app, false);
    }
    saida.flush().ok();
    drop(saida);

    let obtido = format!("{:x}", hash.finalize());
    if !obtido.eq_ignore_ascii_case(&arquivo.sha256) {
        let _ = std::fs::remove_file(destino);
        return Err(format!(
            "{} chegou corrompido (assinatura não confere)",
            arquivo.caminho
        ));
    }
    if escritos != arquivo.tamanho {
        let _ = std::fs::remove_file(destino);
        return Err(format!(
            "{} veio com {escritos} bytes, mas deveria ter {}",
            arquivo.caminho, arquivo.tamanho
        ));
    }
    Ok(())
}

// ─── Motor ───────────────────────────────────────────────────────────────────

fn buscar_manifesto(url: &str) -> Result<Manifesto, String> {
    let corpo: serde_json::Value = ureq::get(url)
        .timeout(std::time::Duration::from_secs(20))
        .call()
        .map_err(|e| format!("não consegui buscar o manifesto: {e}"))?
        .into_json()
        .map_err(|e| format!("manifesto inválido: {e}"))?;
    let manifesto: Manifesto =
        serde_json::from_value(corpo).map_err(|e| format!("manifesto em formato inesperado: {e}"))?;
    if manifesto.arquivos.is_empty() {
        return Err("manifesto sem arquivos".into());
    }
    if !manifesto.blobs.starts_with("https://") {
        return Err("manifesto sem endereço https dos blobs".into());
    }
    Ok(manifesto)
}

/// Coração do delta e da verificação.
///
/// `forcar_hash` ignora o cache e recalcula tudo (é o "verificar integridade").
/// `aplicar` diferencia conferir de consertar.
fn executar(
    app: &AppHandle,
    url_do_manifesto: &str,
    forcar_hash: bool,
    aplicar: bool,
) -> Result<Relatorio, String> {
    if crate::jogo::esta_rodando() {
        return Err("feche o Ultrafoot antes de atualizar ou verificar os arquivos".into());
    }

    let raiz = pasta_do_jogo()?;
    let manifesto = buscar_manifesto(url_do_manifesto)?;
    crate::diario!(
        "INFO",
        "manifesto {} com {} arquivos (delta iniciado, aplicar={aplicar})",
        manifesto.versao,
        manifesto.arquivos.len()
    );

    let mut cache = ler_cache(&raiz);
    let mut relatorio = Relatorio {
        versao: manifesto.versao.clone(),
        arquivos_no_total: manifesto.arquivos.len(),
        bytes_da_versao: manifesto.arquivos.iter().map(|a| a.tamanho).sum(),
        ok: true,
        ..Default::default()
    };

    // ── 1) O que precisa vir ──
    crate::controle::iniciar(app);
    let mut precisam: Vec<ArquivoDoManifesto> = Vec::new();
    let total_de_arquivos = manifesto.arquivos.len().max(1);

    for (indice, arquivo) in manifesto.arquivos.iter().enumerate() {
        crate::controle::checar(app)?;
        if indice % 25 == 0 {
            let percent = ((indice * 100) / total_de_arquivos) as u32;
            crate::emitir_progresso(app, "checking", percent, indice as u64, total_de_arquivos as u64, 0, 0);
        }

        let destino = caminho_seguro(&raiz, &arquivo.caminho)?;
        let Ok(meta) = std::fs::metadata(&destino) else {
            precisam.push(arquivo.clone());
            continue;
        };
        if meta.len() != arquivo.tamanho {
            precisam.push(arquivo.clone());
            continue;
        }

        let mt = modificado_em(&meta);
        if !forcar_hash {
            if let Some(entrada) = cache.arquivos.get(&arquivo.caminho) {
                if entrada.tam == arquivo.tamanho && entrada.mt == mt {
                    if entrada.sha.eq_ignore_ascii_case(&arquivo.sha256) {
                        continue;
                    }
                    precisam.push(arquivo.clone());
                    continue;
                }
            }
        }

        let sha = sha_do_arquivo(&destino)?;
        cache.arquivos.insert(
            arquivo.caminho.clone(),
            EntradaDoCache { sha: sha.clone(), tam: arquivo.tamanho, mt },
        );
        if !sha.eq_ignore_ascii_case(&arquivo.sha256) {
            relatorio.problemas.push(arquivo.caminho.clone());
            precisam.push(arquivo.clone());
        }
    }
    crate::emitir_progresso(app, "checking", 100, total_de_arquivos as u64, total_de_arquivos as u64, 0, 0);

    relatorio.arquivos_baixados = precisam.len();
    relatorio.bytes_baixados = precisam.iter().map(|a| a.tamanho).sum();
    relatorio.ok = relatorio.problemas.is_empty() && precisam.is_empty();

    // Só conferir: já respondeu.
    if !aplicar {
        gravar_cache(&raiz, &cache);
        crate::diario!(
            "INFO",
            "verificação: {} arquivos fora do lugar de {}",
            precisam.len(),
            manifesto.arquivos.len()
        );
        return Ok(relatorio);
    }

    if precisam.is_empty() {
        // Nada a fazer — mas a versão do registro pode estar atrasada (caso do
        // patch aplicado e interrompido antes de gravar).
        cache.versao = manifesto.versao.clone();
        gravar_cache(&raiz, &cache);
        anotar_versao(&manifesto.versao);
        crate::emitir_progresso(app, "done", 100, 0, 0, 0, 0);
        return Ok(relatorio);
    }

    // ── 2) Espaço ──
    let pasta_temporaria = raiz.join(".ultrafoot-patch");
    crate::disco::conferir_espaco(&raiz, relatorio.bytes_baixados)?;

    // ── 3) Baixar tudo ANTES de aplicar qualquer coisa ──
    std::fs::create_dir_all(&pasta_temporaria)
        .map_err(|e| format!("não consegui criar a pasta de trabalho: {e}"))?;

    let mut andamento = Andamento {
        baixados: 0,
        total: relatorio.bytes_baixados,
        inicio: std::time::Instant::now(),
        ultimo_aviso: std::time::Instant::now(),
    };

    let mut prontos: Vec<(ArquivoDoManifesto, std::path::PathBuf)> = Vec::new();
    for arquivo in &precisam {
        let temporario = pasta_temporaria.join(&arquivo.sha256);

        // Blob já baixado numa tentativa anterior: aproveita. É o que faz um
        // patch interrompido continuar de onde parou, em vez de recomeçar.
        if let Ok(meta) = std::fs::metadata(&temporario) {
            if meta.len() == arquivo.tamanho
                && sha_do_arquivo(&temporario).map(|s| s.eq_ignore_ascii_case(&arquivo.sha256)).unwrap_or(false)
            {
                andamento.baixados += arquivo.tamanho;
                andamento.avisar(app, true);
                prontos.push((arquivo.clone(), temporario));
                continue;
            }
            let _ = std::fs::remove_file(&temporario);
        }

        let mut tentativa = 0;
        loop {
            tentativa += 1;
            match baixar_blob(app, &manifesto, arquivo, &temporario, &mut andamento) {
                Ok(()) => break,
                Err(e) if crate::controle::foi_cancelado(&e) => return Err(e),
                Err(e) if tentativa < 3 => {
                    crate::diario!("AVISO", "tentativa {tentativa} falhou: {e}");
                    // O que já entrou nesta tentativa não conta duas vezes.
                    andamento.baixados = andamento.baixados.saturating_sub(
                        std::fs::metadata(&temporario).map(|m| m.len()).unwrap_or(0),
                    );
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
                Err(e) => return Err(e),
            }
        }
        prontos.push((arquivo.clone(), temporario));
    }

    // ── 4) Aplicar ──
    crate::emitir_progresso(app, "applying", 100, andamento.total, andamento.total, 0, 0);
    for (arquivo, temporario) in &prontos {
        let destino = caminho_seguro(&raiz, &arquivo.caminho)?;
        if let Some(pai) = destino.parent() {
            std::fs::create_dir_all(pai)
                .map_err(|e| format!("não consegui criar {}: {e}", pai.display()))?;
        }
        // No Windows o rename falha se o destino existir, e um .exe em uso não
        // pode ser apagado — daí a mensagem falar do jogo aberto.
        if destino.exists() {
            std::fs::remove_file(&destino).map_err(|e| {
                format!(
                    "não consegui substituir {} ({e}). Feche o jogo e tente de novo.",
                    arquivo.caminho
                )
            })?;
        }
        std::fs::rename(temporario, &destino)
            .or_else(|_| std::fs::copy(temporario, &destino).map(|_| ()))
            .map_err(|e| format!("não consegui aplicar {}: {e}", arquivo.caminho))?;

        let mt = std::fs::metadata(&destino).map(|m| modificado_em(&m)).unwrap_or(0);
        cache.arquivos.insert(
            arquivo.caminho.clone(),
            EntradaDoCache { sha: arquivo.sha256.clone(), tam: arquivo.tamanho, mt },
        );
    }

    // ── 5) Arquivos que saíram da versão ──
    //
    // Só apaga o que ESTAVA no manifesto anterior. Arquivo desconhecido na pasta
    // (mod, screenshot, log do jogador) não é problema nosso — apagar seria.
    let novos: std::collections::HashSet<&str> =
        manifesto.arquivos.iter().map(|a| a.caminho.as_str()).collect();
    let antigos: Vec<String> = cache.arquivos.keys().cloned().collect();
    for antigo in antigos {
        if novos.contains(antigo.as_str()) {
            continue;
        }
        if let Ok(alvo) = caminho_seguro(&raiz, &antigo) {
            if alvo.exists() && std::fs::remove_file(&alvo).is_ok() {
                relatorio.arquivos_removidos += 1;
            }
        }
        cache.arquivos.remove(&antigo);
    }

    cache.versao = manifesto.versao.clone();
    gravar_cache(&raiz, &cache);
    let _ = std::fs::remove_dir_all(&pasta_temporaria);
    anotar_versao(&manifesto.versao);

    crate::diario!(
        "INFO",
        "delta concluído: {} arquivos, {} bytes (versão inteira: {} bytes)",
        relatorio.arquivos_baixados,
        relatorio.bytes_baixados,
        relatorio.bytes_da_versao
    );
    relatorio.ok = true;
    crate::emitir_progresso(app, "done", 100, andamento.total, andamento.total, 0, 0);
    Ok(relatorio)
}

/// Grava a versão nova no registro do Windows.
///
/// O patch não passa pelo NSIS, então ninguém mais atualizaria o
/// `DisplayVersion` — e é dele que o launcher tira "qual versão está instalada".
/// Sem isto, o jogo ficaria eternamente parecendo desatualizado e o launcher
/// tentaria aplicar o mesmo patch para sempre.
#[cfg(windows)]
fn anotar_versao(versao: &str) {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WRITE};
    use winreg::RegKey;

    let raizes = [
        (RegKey::predef(HKEY_CURRENT_USER), r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
        (RegKey::predef(HKEY_LOCAL_MACHINE), r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];
    for (raiz, caminho) in raizes.iter() {
        let Ok(uninstall) = raiz.open_subkey(*caminho) else { continue };
        for nome in uninstall.enum_keys().flatten() {
            let Ok(sub) = uninstall.open_subkey_with_flags(&nome, KEY_READ | KEY_WRITE) else {
                continue;
            };
            let display: String = sub.get_value("DisplayName").unwrap_or_default();
            let minusculo = display.to_lowercase();
            if !minusculo.contains("ultrafoot") || minusculo.contains("launcher") {
                continue;
            }
            if sub.set_value("DisplayVersion", &versao.to_string()).is_ok() {
                crate::diario!("INFO", "registro atualizado para {versao}");
                return;
            }
        }
    }
    crate::diario!("AVISO", "não consegui gravar a versão {versao} no registro");
}

#[cfg(not(windows))]
fn anotar_versao(_versao: &str) {}

// ─── Comandos ────────────────────────────────────────────────────────────────

/// Atualiza baixando só o que mudou. Erro aqui = a UI cai no instalador completo.
#[tauri::command]
pub async fn atualizar_por_partes(app: AppHandle, url_do_manifesto: String) -> Result<Relatorio, String> {
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || executar(&app2, &url_do_manifesto, false, true))
        .await
        .map_err(|e| format!("tarefa interrompida: {e}"))?
}

/// "Verificar integridade dos arquivos". Com `reparar`, baixa só os quebrados.
#[tauri::command]
pub async fn verificar_arquivos(
    app: AppHandle,
    url_do_manifesto: String,
    reparar: Option<bool>,
) -> Result<Relatorio, String> {
    let app2 = app.clone();
    let consertar = reparar.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || executar(&app2, &url_do_manifesto, true, consertar))
        .await
        .map_err(|e| format!("tarefa interrompida: {e}"))?
}

/// Existe manifesto publicado para esta versão? A UI usa para decidir entre
/// oferecer "atualização rápida" e o caminho antigo.
#[tauri::command]
pub fn tem_manifesto(url_do_manifesto: String) -> bool {
    ureq::head(&url_do_manifesto)
        .timeout(std::time::Duration::from_secs(6))
        .call()
        .map(|r| r.status() == 200)
        .unwrap_or(false)
}
