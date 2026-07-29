//! VERIFICACAO DO CERTIFICADO DE LICENCA — Ed25519, no lado NATIVO.
//!
//! POR QUE AQUI E NAO EM JAVASCRIPT.
//!
//! O plano original verificava com `crypto.subtle.verify("Ed25519", ...)` na
//! webview. Medindo, o suporte nao esta garantido: no Chromium o Ed25519 so saiu
//! do flag no Chrome 137, e o jogo roda em WEBVIEW2 — cuja versao e a que
//! estiver instalada na maquina do jogador, nao a que nos escolhemos. Em Windows
//! desatualizado o `importKey` lanca, a verificacao falha e o COMPRADOR LEGITIMO
//! perde o registro. E exatamente o falso negativo que o projeto decidiu evitar
//! (ver app/splash/page.tsx: o jogo nao trava sem registro justamente porque
//! punir quem pagou dói mais do que deixar passar quem nao pagou).
//!
//! Verificando no Rust, a criptografia nao depende de nada instalado na maquina:
//! e o mesmo binario para todo mundo.
//!
//! O QUE ESTE MODULO GARANTE — e o que NAO garante.
//!
//!   Garante: um certificado so e aceito se foi assinado pela chave PRIVADA que
//!   mora na VPS. Sem ela nao se produz assinatura valida (forjar exige quebrar
//!   Ed25519). Adulterar qualquer campo — codigo, device, validade — invalida a
//!   assinatura, porque ela cobre o payload inteiro.
//!
//!   NAO garante: que ninguem edite o binario para pular esta funcao. Nenhuma
//!   verificacao no cliente garante isso. A diferenca que importa para a receita
//!   e que um patch afeta UMA maquina e nao gera nada distribuivel, enquanto uma
//!   chave forjada circula em forum e cada copia e uma venda perdida.

use serde::{Deserialize, Serialize};

/// Chaves PUBLICAS conhecidas, indexadas pelo `kid` que viaja no certificado.
///
/// Sao publicas de verdade: com elas so se CONFERE assinatura, nunca se cria
/// uma. Podem ficar no binario e no git sem risco — e essa e a diferenca para o
/// HMAC de antes, cujo segredo ia no bundle e permitia EMITIR licenca.
///
/// ROTACAO: para trocar a chave, ADICIONE a nova aqui mantendo a antiga. Os
/// certificados ja emitidos continuam conferindo com a antiga e ninguem que
/// comprou perde o registro. Remover uma entrada invalida todos os certificados
/// assinados com ela — so faca isso depois de reemitir as licencas legitimas.
const CHAVES_PUBLICAS: &[(&str, &str)] = &[
    ("v1", "MCowBQYDK2VwAyEAflhQ7JrCIif43rnVxdO2jImk+OFkWV0BaLgN1hvoewg="),
];

/// O que o servidor assinou. Os campos entram na assinatura EXATAMENTE como
/// serializados aqui — mudar um nome de campo quebra os certificados existentes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Certificado {
    /// UF26-ABCDE-FGHIJ-KLMNO
    pub codigo: String,
    /// Identificador da maquina. Amarra o certificado a este PC: copiar o
    /// arquivo para outro computador nao registra o jogo la.
    pub device: String,
    /// Qual chave publica confere este certificado.
    pub kid: String,
    /// Epoch em segundos. So informativo — o certificado nao expira, porque o
    /// jogador comprou o jogo, nao um aluguel.
    pub emitido_em: i64,
    /// Numero de serie, para cruzar com o banco no suporte.
    pub serie: u32,
}

/// Resultado da verificacao, no formato que o TypeScript consome.
#[derive(Debug, Serialize)]
pub struct ResultadoLicenca {
    pub valido: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub certificado: Option<Certificado>,
    /// "formato" | "assinatura" | "kid-desconhecido" | "device" | "sem-chave"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motivo: Option<String>,
}

impl ResultadoLicenca {
    fn recusado(motivo: &str) -> Self {
        Self { valido: false, certificado: None, motivo: Some(motivo.into()) }
    }
}

/// Decodifica base64 padrao (com '+' e '/'), sem dependencia externa.
///
/// Escrito a mao de proposito: puxar a crate `base64` so para isto acrescenta
/// dependencia a um binario que ja e grande, e o algoritmo cabe em 20 linhas.
fn de_base64(texto: &str) -> Option<Vec<u8>> {
    const TABELA: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut acumulador: u32 = 0;
    let mut bits: u32 = 0;
    let mut saida = Vec::new();
    for b in texto.bytes() {
        if b == b'=' || b == b'\n' || b == b'\r' || b == b' ' {
            continue;
        }
        let valor = TABELA.iter().position(|&c| c == b)? as u32;
        acumulador = (acumulador << 6) | valor;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            saida.push((acumulador >> bits) as u8);
        }
    }
    Some(saida)
}

/// Extrai os 32 bytes crus da chave Ed25519 de dentro do SPKI.
///
/// O SPKI de uma Ed25519 tem 44 bytes: 12 de cabecalho DER (algoritmo) e os 32
/// finais sao a chave. Conferimos o tamanho em vez de fatiar as cegas — um
/// base64 truncado viraria uma chave silenciosamente errada, e toda licenca
/// legitima seria recusada sem explicacao.
fn chave_do_spki(spki: &[u8]) -> Option<[u8; 32]> {
    if spki.len() != 44 {
        return None;
    }
    let mut chave = [0u8; 32];
    chave.copy_from_slice(&spki[12..44]);
    Some(chave)
}

/// Confere o certificado e devolve o conteudo se a assinatura bater.
///
/// `bruto` e o que o servidor devolveu: `<payload-base64>.<assinatura-base64>`.
/// O ponto separa os dois porque nenhum dos lados usa '.' no base64 padrao.
///
/// `device_atual` e o identificador desta maquina. Passar `None` pula a
/// checagem — util no suporte, para inspecionar um certificado alheio, JAMAIS
/// no caminho normal de registro.
pub fn verificar(bruto: &str, device_atual: Option<&str>) -> ResultadoLicenca {
    if CHAVES_PUBLICAS.is_empty() {
        // Build feita sem preencher as chaves publicas. Falha explicita: sem
        // isto o jogo diria "codigo invalido" a TODO comprador e o motivo real
        // ficaria invisivel.
        return ResultadoLicenca::recusado("sem-chave");
    }

    let (payload_b64, assinatura_b64) = match bruto.split_once('.') {
        Some(par) => par,
        None => return ResultadoLicenca::recusado("formato"),
    };

    let payload = match de_base64(payload_b64) {
        Some(p) => p,
        None => return ResultadoLicenca::recusado("formato"),
    };
    let assinatura = match de_base64(assinatura_b64) {
        Some(a) if a.len() == 64 => a,
        _ => return ResultadoLicenca::recusado("formato"),
    };

    let certificado: Certificado = match serde_json::from_slice(&payload) {
        Ok(c) => c,
        Err(_) => return ResultadoLicenca::recusado("formato"),
    };

    let publica_b64 = match CHAVES_PUBLICAS.iter().find(|(k, _)| *k == certificado.kid) {
        Some((_, v)) => *v,
        // `kid` que nao conhecemos: certificado de uma chave mais nova que esta
        // build. Motivo proprio para o suporte distinguir de assinatura falsa.
        None => return ResultadoLicenca::recusado("kid-desconhecido"),
    };

    let spki = match de_base64(publica_b64) {
        Some(s) => s,
        None => return ResultadoLicenca::recusado("sem-chave"),
    };
    let bytes_chave = match chave_do_spki(&spki) {
        Some(c) => c,
        None => return ResultadoLicenca::recusado("sem-chave"),
    };

    let chave = match ed25519_dalek::VerifyingKey::from_bytes(&bytes_chave) {
        Ok(c) => c,
        Err(_) => return ResultadoLicenca::recusado("sem-chave"),
    };
    let mut bytes_assinatura = [0u8; 64];
    bytes_assinatura.copy_from_slice(&assinatura);
    let assinatura = ed25519_dalek::Signature::from_bytes(&bytes_assinatura);

    // A assinatura cobre o payload CRU, byte a byte — nao o struct desserializado.
    // Verificar o struct reserializado seria um erro sutil: qualquer diferenca de
    // ordem de campos ou espaco mudaria os bytes e invalidaria certificado bom.
    use ed25519_dalek::Verifier;
    if chave.verify(&payload, &assinatura).is_err() {
        return ResultadoLicenca::recusado("assinatura");
    }

    // A assinatura so e conferida ANTES desta checagem de proposito: com o
    // certificado ja provado autentico, comparar o device e so aplicar a regra
    // que o servidor gravou nele.
    if let Some(device) = device_atual {
        if certificado.device != device {
            return ResultadoLicenca::recusado("device");
        }
    }

    ResultadoLicenca { valido: true, certificado: Some(certificado), motivo: None }
}

/// Comando exposto ao TypeScript.
///
/// Fica no Rust, e nao no JS, pelo motivo do cabecalho deste arquivo: nao
/// depender da versao do WebView2 instalada na maquina do jogador.
#[tauri::command]
pub fn verificar_licenca(certificado: String, device: Option<String>) -> ResultadoLicenca {
    verificar(&certificado, device.as_deref())
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn base64_decodifica_o_que_o_node_gera() {
        assert_eq!(de_base64("aGVsbG8=").unwrap(), b"hello");
        assert_eq!(de_base64("").unwrap(), Vec::<u8>::new());
        // Caractere fora da tabela precisa falhar, nao virar lixo silencioso.
        assert!(de_base64("!!!").is_none());
    }

    #[test]
    fn spki_de_tamanho_errado_e_recusado() {
        assert!(chave_do_spki(&[0u8; 43]).is_none());
        assert!(chave_do_spki(&[0u8; 44]).is_some());
    }

    #[test]
    fn certificado_malformado_nao_passa() {
        assert!(!verificar("sem-ponto", None).valido);
        assert!(!verificar("a.b", None).valido);
    }

    /// Certificado REAL, gerado por `services/auth-server/licenca.py` assinando
    /// com a privada de producao (kid v1). Esta constante e o contrato entre os
    /// dois lados: se alguem mudar a serializacao no Python — ordem de campos,
    /// espacos, nome de chave — este teste quebra AQUI, e nao na maquina do
    /// comprador depois da build publicada.
    const CERT_REAL: &str = concat!(
        "eyJjb2RpZ28iOiJVRjI2LUFCQ0RFLUZHSElKLUtMTU5PIiwiZGV2aWNlIjoiTUFRVUlOQS1URVNURS0x",
        "IiwiZW1pdGlkb19lbSI6MTc1MzkwMDAwMCwia2lkIjoidjEiLCJzZXJpZSI6N30=",
        ".",
        "85c6Fhc52zN3bwFYS3oyNdHN/f6btOkpeZz/6Elf43p2e8jyUB0m5gUZXhZud2/IWh5ITspUCVV65kKE",
        "cD5gAg=="
    );
    const DEVICE_REAL: &str = "MAQUINA-TESTE-1";

    #[test]
    fn certificado_do_servidor_e_aceito() {
        let r = verificar(CERT_REAL, Some(DEVICE_REAL));
        assert!(r.valido, "motivo: {:?}", r.motivo);
        let c = r.certificado.unwrap();
        assert_eq!(c.codigo, "UF26-ABCDE-FGHIJ-KLMNO");
        assert_eq!(c.kid, "v1");
        assert_eq!(c.serie, 7);
    }

    /// §7 do plano: "certificado valido de OUTRA maquina -> rejeitado".
    /// Sem isto, um certificado comprado uma vez registraria o jogo em qualquer
    /// PC e a venda perderia sentido.
    #[test]
    fn certificado_de_outra_maquina_e_recusado() {
        let r = verificar(CERT_REAL, Some("OUTRO-PC"));
        assert!(!r.valido);
        assert_eq!(r.motivo.as_deref(), Some("device"));
    }

    /// §7 do plano: "certificado forjado -> rejeitado". Mexer em UM byte do
    /// payload precisa invalidar a assinatura, porque ela cobre o payload inteiro.
    #[test]
    fn payload_adulterado_quebra_a_assinatura() {
        let (payload, assinatura) = CERT_REAL.split_once('.').unwrap();
        // Troca a serie 7 por 8 no JSON e re-codifica.
        let bruto = String::from_utf8(de_base64(payload).unwrap()).unwrap();
        let mexido = bruto.replace("\"serie\":7", "\"serie\":8");
        assert_ne!(bruto, mexido, "o payload de teste precisa conter a serie");
        let forjado = format!("{}.{}", base64_de(mexido.as_bytes()), assinatura);

        let r = verificar(&forjado, Some(DEVICE_REAL));
        assert!(!r.valido);
        assert_eq!(r.motivo.as_deref(), Some("assinatura"));
    }

    /// Assinatura aleatoria (sem a privada) nao pode passar.
    #[test]
    fn assinatura_inventada_e_recusada() {
        let (payload, _) = CERT_REAL.split_once('.').unwrap();
        let forjado = format!("{}.{}", payload, base64_de(&[7u8; 64]));
        let r = verificar(&forjado, Some(DEVICE_REAL));
        assert!(!r.valido);
        assert_eq!(r.motivo.as_deref(), Some("assinatura"));
    }

    /// `kid` que esta build nao conhece precisa ter motivo PROPRIO: e um
    /// certificado de chave mais nova, nao uma fraude. O suporte distingue os
    /// dois casos por esta string.
    #[test]
    fn kid_desconhecido_tem_motivo_proprio() {
        let payload = br#"{"codigo":"UF26-A-B-C","device":"X","emitido_em":1,"kid":"v9","serie":1}"#;
        let falso = format!("{}.{}", base64_de(payload), base64_de(&[0u8; 64]));
        let r = verificar(&falso, None);
        assert!(!r.valido);
        assert_eq!(r.motivo.as_deref(), Some("kid-desconhecido"));
    }

    /// Codificador auxiliar — so os testes precisam dele; o caminho de producao
    /// apenas decodifica.
    fn base64_de(dados: &[u8]) -> String {
        const TABELA: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut saida = String::new();
        for pedaco in dados.chunks(3) {
            let b = [pedaco[0], *pedaco.get(1).unwrap_or(&0), *pedaco.get(2).unwrap_or(&0)];
            let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
            saida.push(TABELA[(n >> 18) as usize & 63] as char);
            saida.push(TABELA[(n >> 12) as usize & 63] as char);
            saida.push(if pedaco.len() > 1 { TABELA[(n >> 6) as usize & 63] as char } else { '=' });
            saida.push(if pedaco.len() > 2 { TABELA[n as usize & 63] as char } else { '=' });
        }
        saida
    }
}
