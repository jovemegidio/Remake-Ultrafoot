// O BOTAO CENTRAL PODE NAO SER NOSSO.
//
// Xbox Guide e PS Button sao botoes de SISTEMA. Quem pode ficar com eles, e em
// que ordem, muda conforme a maquina:
//
//   - Windows: a Game Bar escuta o Guide, mas NAO o consome. O jogo continua
//     conseguindo ler o bit — os dois recebem.
//   - Steam Input LIGADO: a Steam esconde o controle fisico e apresenta um
//     controle virtual no lugar. O Guide vira "abrir o overlay/Big Picture" e
//     NAO chega ao jogo. Esse e o caso mais comum de "nao funciona" no PC.
//   - xinput9_1_0.dll (Windows antigo, ou app forcado a essa versao): a DLL nao
//     tem o ordinal 100, entao nao existe caminho nenhum para o Guide.
//
// A regra do projeto e nao mentir sobre isso. Em vez de tentar e falhar em
// silencio, medimos e declaramos um estado, e a interface se ajusta: com
// `Available` o jogo ensina "aperte o botao Xbox"; sem ele, ensina a combinacao
// de fallback (View + Menu). Nunca prometemos o botao central para depois nao
// entregar.
//
// O que NAO fazemos aqui, de proposito: hook global de teclado/gamepad, injecao
// de DLL, desligar o overlay da Steam ou a Game Bar. Um jogo que quebra o
// overlay da Steam para ganhar um atalho e um jogo que sera desinstalado.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CenterButtonCapability {
    /// Ha caminho para ler o botao central e nada visivel o esta reservando.
    Available,
    /// Alguem do sistema (hoje: Steam Input) esta com ele. Fallback obrigatorio.
    ReservedBySystem,
    /// Nao existe caminho nesta maquina/plataforma. Fallback obrigatorio.
    Unavailable,
    /// Ainda nao deu para medir — nenhum controle ligado, ou backend nao iniciado.
    Unknown,
}

/// Diagnostico legivel, para a tela de depuracao e para o relatorio de suporte.
/// Sempre acompanha a capability: um estado sem motivo e impossivel de depurar
/// a distancia, e este e exatamente o tipo de problema que so acontece na
/// maquina de outra pessoa.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CenterButtonReport {
    pub capability: CenterButtonCapability,
    /// Qual DLL/entrada foi usada ("xinput1_4.dll#100", "nenhuma", ...).
    pub backend: String,
    /// Frase curta em portugues explicando o estado.
    pub reason: String,
}

impl CenterButtonReport {
    pub fn desconhecido(motivo: &str) -> Self {
        Self {
            capability: CenterButtonCapability::Unknown,
            backend: "nenhuma".into(),
            reason: motivo.into(),
        }
    }
}

/// A Steam esta hospedando este processo?
///
/// Nao ha API para perguntar "o Steam Input esta ligado para este jogo" sem o
/// Steamworks SDK. O que da para saber sem SDK nenhum: se o processo foi
/// lancado PELA Steam, ela injeta variaveis de ambiente. Quando foi, o Guide e
/// dela — e essa e a hipotese conservadora certa, porque errar para
/// `ReservedBySystem` custa um fallback a mais, e errar para `Available` custa
/// um botao que o jogador aperta e nada acontece.
pub fn steam_esta_hospedando() -> bool {
    ["SteamAppId", "SteamGameId", "SteamOverlayGameId", "SteamClientLaunch"]
        .iter()
        .any(|chave| std::env::var_os(chave).is_some())
}
