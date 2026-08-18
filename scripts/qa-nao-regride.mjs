// O GATE CONTRA REGRESSÃO — "sumiu funcionalidade" não pode mais passar batido.
//
// ⚠️ POR QUE ELE EXISTE. Em 16/08/2026 o usuário relatou que a Divisão de
// Acesso havia sumido e que funcionalidades da 1.0.321 à 1.0.328 não estavam
// mais no jogo. Estava certo: existia uma árvore rotulada "1.0.332" **sem 14
// módulos** que a 1.0.330 tinha — entre eles `divisao-de-acesso.ts` (1.0.318),
// `arbitragem.ts` (VAR), `partida-do-atleta.ts` (329) e todo o online (327/330).
// Não era um bug de código: era uma árvore ANTIGA com o número novo, e nada no
// caminho de publicação percebia.
//
// Este gate torna isso impossível de passar em silêncio: ele lista o que o jogo
// TEM DE TER e reprova quando falta. Cada linha aqui é uma funcionalidade que
// já foi entregue ao jogador — tirar uma exige apagar a linha, o que é uma
// decisão consciente, e não um efeito colateral de sincronizar pasta errada.
//
// Uso:
//   node scripts/qa-nao-regride.mjs            (na raiz do projeto)
//   node scripts/qa-nao-regride.mjs <caminho>  (audita outra árvore)

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const RAIZ = process.argv[2] || process.cwd()
let falhas = 0
const erro = m => { console.log("FALTA: " + m); falhas++ }

const temArquivo = rel => existsSync(path.join(RAIZ, rel))
const conteudo = rel => { try { return readFileSync(path.join(RAIZ, rel), "utf8") } catch { return "" } }

/**
 * O inventário. Formato: [versão, o que é, arquivo, marca dentro do arquivo].
 * A MARCA importa tanto quanto o arquivo: um `carreira-de-jogador.ts` pode
 * existir e ser a versão de três releases atrás — foi exatamente o caso que
 * originou este gate (o arquivo estava lá, sem uma linha da 324 à 329).
 */
const INVENTARIO = [
  ["1.0.318", "Divisão de Acesso (base da pirâmide)", "lib/divisao-de-acesso.ts", "DIVISOES_DE_ACESSO"],
  ["1.0.318", "Clube próprio", "lib/clubes-personalizados.ts", ""],
  ["1.0.322", "Futebol feminino (21 ligas)", "lib/futebol-feminino.ts", "LIGAS_FEMININAS"],
  ["1.0.322", "Elencos femininos reais", "data/seeds/elencos-femininos.json", ""],
  ["1.0.322", "Modalidade da carreira", "lib/modalidade-de-carreira.ts", "MODALIDADES"],
  ["1.0.322", "Carreira de base com tabela e copa", "lib/youth-career-engine.ts", "montarTemporadaDaBase"],
  ["1.0.322", "Carreira de jogador", "lib/carreira-de-jogador.ts", "criarCarreiraDeJogador"],
  ["1.0.324", "Fila da posição (fim do 'fora dos planos')", "lib/carreira-de-jogador.ts", "confiancaMerecida"],
  ["1.0.324", "Hierarquia lida do elenco real", "lib/carreira-de-jogador.ts", "hierarquiaDaPosicao"],
  ["1.0.325", "Arquétipos do atleta", "lib/carreira-de-jogador.ts", "ARQUETIPOS"],
  ["1.0.325", "Potencial oculto (faixa)", "lib/carreira-de-jogador.ts", "potencialVisivel"],
  ["1.0.325", "Evolução orgânica", "lib/carreira-de-jogador.ts", "evoluirOrganicamente"],
  ["1.0.326", "Empresário", "lib/carreira-de-jogador.ts", "EMPRESARIOS"],
  ["1.0.326", "Aposentadoria vira treinador", "lib/carreira-de-jogador.ts", "resumoDaCarreira"],
  ["1.0.327", "Menu online", "lib/modos-online.ts", "MODOS_ONLINE"],
  ["1.0.327", "Tela do online", "app/online/page.tsx", ""],
  ["1.0.328", "Entrevistas com consequência", "lib/carreira-de-jogador.ts", "entrevistaDaVez"],
  ["1.0.329", "Viver a partida", "lib/partida-do-atleta.ts", "montarPartidaDoAtleta"],
  ["1.0.330", "Manager Rivals (cliente)", "lib/manager-rivals.ts", "entrarNaFila"],
  ["1.0.330", "Competitivo no relay", "services/multiplayer-relay-vps/rivals.mjs", "Competitivo"],
  ["1.0.331", "Gravacao atrasada nao troca o save ativo", "lib/save-system.ts", "gravacao atrasada"],
  ["1.0.331", "Motor isolado por carreira", "app/splash/page.tsx", "tinhaMotorProprio"],
  ["1.0.331", "Clube resolvido pela identidade imutavel", "lib/time-da-carreira.ts", "getTeamByFileKey"],
  ["1.0.331", "Identidade global dos clubes do pool", "lib/teams-data.ts", "IDENTIDADE GLOBAL DO POOL"],
  ["1.0.331", "Prefetch limitado por maquina e sessao", "components/game-header.tsx", "rotasPrincipaisAquecidas"],
  ["1.0.331", "Gate de identidade de clubes", "scripts/test-identidade-clubes-331.ts", "divisoes brasileiras sem estrangeiros"],
  ["1.0.333", "VAR realista em duas etapas", "lib/match-engine.ts", "resolvePendingVar"],
  ["1.0.333", "VAR visivel na partida ao vivo", "app/partida/ao-vivo/page.tsx", "eraChecagemDoVar"],
  ["1.0.333", "Gate do VAR realista", "scripts/test-var-realista-333.ts", "relogio congelado"],
  ["1.0.333", "VAR no motor (gol e penalti revisados)", "lib/match-engine.ts", "resolvePendingVar"],
  ["1.0.333", "Gate do VAR", "scripts/test-var.ts", "resolvePendingVar"],
  ["1.0.334", "Siglas legiveis no lugar do slug de arquivo", "lib/club-identity.ts", "DESEMPATE"],
  ["1.0.334", "Desempate de siglas por liga", "data/seeds/siglas-clubes.json", ""],
  ["1.0.334", "Gate das siglas", "scripts/test-siglas-legiveis.ts", "nao mostra mais"],
  ["1.0.334", "Escudo de reserva com sigla legivel", "components/team-crest.tsx", "siglaExibivel"],
  ["1.0.334", "Controle em toda tela (camada global)", "components/gamepad-navegacao-global.tsx", "telaAssumiuOGamepad"],
  ["1.0.334", "Modo controle (barra + anel de foco)", "components/modo-controle.tsx", "data-controle"],
  ["1.0.334", "Modo controle montado no layout", "app/layout.tsx", "<ModoControle />"],
  ["1.0.334", "Gate da navegacao por controle", "scripts/test-gamepad-navegacao.ts", "desce na MESMA coluna"],
  ["1.0.334", "Escudo feminino com excecao", "lib/escudos-map.ts", "A EXCECAO vem antes da regra"],
  ["1.0.334", "Gate do escudo feminino", "scripts/test-escudo-feminino.ts", "a excecao vence"],
  ["1.0.335", "Mercado pela modalidade da carreira", "lib/mercado-da-modalidade.ts", "vitrineDaModalidade"],
  ["1.0.335", "Mercado da tela le a modalidade do save", "app/mercado/page.tsx", "vitrineDaModalidade"],
  ["1.0.335", "Leilao pela modalidade da carreira", "app/leiloes/page.tsx", "vitrineDaModalidade"],
  ["1.0.335", "Clube feminino com nome limpo", "lib/futebol-feminino.ts", "NOME LIMPO"],
  ["1.0.335", "Fontes masculinas fechadas para clube feminino", "lib/players-data.ts", "ehFeminino"],
  ["1.0.335", "Clube de estreia da carreira de atleta", "lib/carreira-de-jogador.ts", "clubesDeEstreia"],
  ["1.0.335", "Gate do mercado por modalidade", "scripts/qa-mercado-por-modalidade.ts", "vazou"],
  ["1.0.336", "Amistoso 1v1 online (tela da sala)", "app/online/amistoso/page.tsx", "AMISTOSO 1v1 ONLINE"],
  ["1.0.336", "Amistoso aponta para a propria tela", "lib/modos-online.ts", "/online/amistoso"],
  ["1.0.337", "FC Hub e Draft abrem por acao, nao por query morta", "lib/modos-online.ts", "abrir-hub"],
  ["1.0.337", "Menu online trata a acao do Hub", "app/online/page.tsx", "ultrafoot:fc-hub"],
  ["1.0.337", "Rivals entra na sala do relay (fim do beco)", "app/online/rivals/page.tsx", "joinInternetRoom"],
  ["1.0.337", "Rivals usa o relay configurado, como o resto do online", "lib/manager-rivals.ts", "configuredRelayUrl"],
  ["1.0.337", "Gate dos destinos do menu online", "scripts/test-destinos-online.ts", "NENHUM arquivo lê esse parâmetro"],
  ["1.0.338", "Menu proprio da carreira de atleta", "components/game-header.tsx", "NAV_MENU_PLAYER_ITEMS"],
  ["1.0.338", "Identidade do atleta no cabecalho", "components/game-header.tsx", "ehCarreiraDeAtleta"],
  ["1.0.338", "Relogio do cabecalho segue a rodada do atleta", "components/game-header.tsx", "FICAVA PARADO EM 01 JAN"],
  ["1.0.338", "Aba da carreira de atleta vem da URL", "app/carreira/jogador/page.tsx", "abaDaUrl"],
  ["1.0.338", "Campo na partida vivida do atleta", "components/match/campo-do-atleta.tsx", "CampoDoAtleta"],
  ["1.0.338", "Partida do atleta desenha o campo", "app/carreira/jogador/partida/page.tsx", "CampoDoAtleta"],
  ["1.0.338", "Gate do campo do atleta", "scripts/test-campo-do-atleta.ts", "onze nomes reais"],
  ["1.0.339", "Treino por intensidade na carreira de atleta", "lib/carreira-de-jogador.ts", "treinarNaSemana"],
  ["1.0.339", "Intensidade do treino na tela do atleta", "app/carreira/jogador/page.tsx", "definirIntensidadeDeTreino"],
  ["1.0.339", "Gate do treino do atleta", "scripts/test-treino-do-atleta.ts", "tem efeito medivel"],
  ["1.0.340", "Conversas com familia, empresario e diretoria", "lib/conversas-do-atleta.ts", "conversasDoMomento"],
  ["1.0.340", "Conversas na tela do atleta", "app/carreira/jogador/page.tsx", "responderConversa"],
  ["1.0.340", "Gate das conversas do atleta", "scripts/test-conversas-do-atleta.ts", "e enfeite"],
  ["1.0.341", "Partida disputada sobrevive a calendario regenerado", "lib/use-game-manager.ts", "concluidasPorConfronto"],
  ["1.0.341", "Gate da partida simulada que persiste", "scripts/test-simular-persiste.ts", "como se nao tivesse sido simulada"],
  ["1.0.342", "Elencos do pool compactados para o bundle", "scripts/compactar-elencos-do-pool.mjs", "NOMES DOS CAMPOS"],
  ["1.0.342", "Runtime expande o elenco compacto", "lib/pool-elencos.ts", "expandirElencosCompactos"],
  ["1.0.342", "Compactacao roda no caminho do tauri", "scripts/build-tauri.mjs", "compactar-elencos-do-pool"],
  ["1.0.342", "Gate do elenco compacto", "scripts/test-elencos-compactos.ts", "sem perder um campo"],
  ["1.0.342", "Elencos TM compactados para o bundle", "scripts/compactar-elencos-tm.mjs", "posicional"],
  ["1.0.342", "Runtime expande o elenco TM compacto", "lib/elencos-reais-tm.ts", "expandirElencosTM"],
  ["1.0.343", "Feminino nao ganha do masculino por homonimo", "lib/teams-data.ts", "ehClubeFemininoPorChave"],
  ["1.0.344", "Manifesto de fotos compactado", "scripts/compactar-manifesto-de-fotos.mjs", "chunk COMPARTILHADO"],
  ["1.0.344", "Runtime expande o manifesto de fotos", "lib/player-photos.ts", "expandirManifestoDeFotos"],
  ["1.0.344", "Gate do manifesto de fotos", "scripts/test-manifesto-de-fotos.ts", "MESMA foto de antes"],
  ["1.0.345", "Indices de busca de clube memoizados", "lib/teams-data.ts", "invalidarIndicesDeBusca"],
  ["1.0.345", "Gate de desempenho da busca de clube", "scripts/test-busca-de-clube-rapida.ts", "ms por chamada"],
  ["1.0.346", "Limpeza do universo de carreiras que nao sao a ativa", "lib/save-system.ts", "limparUniversosDeOutrasCarreiras"],
  ["1.0.346", "Limpeza ligada na gravacao do universo", "lib/save-system.ts", "limparUniversosDeOutrasCarreiras(careerId)"],
  ["1.0.346", "Gate do estado que nao pode inchar", "scripts/test-universo-nao-incha.ts", "deveria haver no maximo 1"],
  ["1.0.346", "Universo em arquivo proprio (gravacao barata)", "lib/persistent-store.ts", "ARQUIVO_DO_UNIVERSO"],
  ["1.0.346", "Mudanca de casa do universo ja gravado", "lib/persistent-store.ts", "_mudarUniversoDeArquivo"],
  ["1.0.346", "Um commit por rajada, nao por chave", "lib/persistent-store.ts", "ehAUltimaDaFila"],
  ["1.0.346", "Commit alcanca os DOIS arquivos", "lib/persistent-store.ts", "_commitDosArquivosSujos"],
  ["1.0.347", "VAR com o protocolo real (monitor so no erro claro)", "lib/match-engine.ts", "exigeRevisaoNoMonitor"],
  ["1.0.347", "Online sempre visivel no menu principal", "app/splash/page.tsx", "ONLINE FICA SEMPRE VISIVEL"],
  ["1.0.347", "Moral do elenco normalizada na hidratacao", "lib/game-engine.ts", "MORAL DO ELENCO: CAMPO NOVO"],
  ["1.0.347", "Tom, escala e cobranca por modalidade", "lib/tom-da-modalidade.ts", "pesoDasAreas"],
  ["1.0.347", "Diretoria le a modalidade", "lib/confianca-da-diretoria.ts", "pesoDasAreas"],
  ["1.0.347", "Fala da diretoria por modalidade", "lib/conversa-diretoria.ts", "tomDaModalidade"],
  ["1.0.347", "Treino rende pela modalidade", "lib/efeito-do-treinador.ts", "rendimentoDeTreinoDaModalidade"],
  ["1.0.347", "Imprensa pergunta pela modalidade", "lib/game-engine.ts", "A IMPRENSA PERGUNTAVA A MESMA COISA"],
  ["1.0.347", "Lesao com consequencia na carreira de atleta", "lib/carreira-de-jogador.ts", "sortearLesao"],
  ["1.0.347", "Capitania na carreira de atleta", "lib/carreira-de-jogador.ts", "A BRACADEIRA"],
  ["1.0.347", "Pre-temporada na carreira de atleta", "lib/carreira-de-jogador.ts", "preTemporada"],
  ["1.0.347", "Auditoria de telas serve os escudos podados", "scripts/qa-audit.mjs", "publicDir"],
  ["1.0.347", "Hidratacao das escalacoes", "app/elenco/escalacoes/page.tsx", "NADA DO SAVE PODE ENTRAR"],
  ["1.0.347", "Gate das tres modalidades", "scripts/test-modalidades-ponta-a-ponta.ts", "a bracadeira"],
  ["1.0.352", "Painel do atleta recolhivel", "app/elenco/gerenciamento/page.tsx", "painelDoAtletaRecolhido"],
  ["1.0.352", "Fundo do escritorio do atleta", "app/carreira/jogador/page.tsx", "in-game-02.webp"],
  ["1.0.352", "Online nao marca escolha sem o jogador mexer", "app/configuracoes/page.tsx", "mexeuNoOnline"],
  ["1.0.352", "Gate do online que nao toca no save", "scripts/test-online-nao-toca-no-save.ts", "nao encosta no save"],
  ["1.0.349", "Idiomas parciais com reserva no portugues", "lib/i18n/index.ts", "comReservaEmPortugues"],
  ["1.0.349", "Cobertura de idioma medida, nao rotulada", "lib/i18n/index.ts", "coberturaDoIdioma"],
  ["1.0.349", "Extrator de texto chumbado", "scripts/extrair-textos.mjs", "SÓ ANTES DE UMA TAG DE FECHAMENTO"],
  ["1.0.349", "Catraca da traducao", "scripts/qa-traducao.mjs", "TETO QUE SÓ DESCE"],
  ["1.0.349", "Gate da reserva de idioma", "scripts/test-idiomas-com-reserva.ts", "NÃO PODE DEIXAR BURACO"],
  ["1.0.348", "Instalador do jogo conferido antes de executar", "Launcher/src-tauri/src/lib.rs", "CONFERIR ANTES DE EXECUTAR"],
  ["1.0.348", "latest.json publica sha256 e tamanho", "scripts/publish-release.mjs", "createHash"],
  ["1.0.348", "Deploy nao aborta por falta de changelog", "scripts/publicar-launcher-config.mjs", "ESCRITA SOZINHA"],
  ["—", "Arbitragem / VAR", "lib/arbitragem.ts", ""],
  ["—", "Eventos para o 3D", "lib/eventos-para-3d.ts", ""],
  ["—", "Histórico de lesões", "lib/historico-de-lesoes.ts", ""],
  ["—", "Confiança da diretoria", "lib/confianca-da-diretoria.ts", ""],
  ["—", "Simulação da partida", "lib/simulacao-da-partida.ts", ""],
]

console.log(`auditando: ${RAIZ}\n`)

// A versão declarada nos dois arquivos tem de bater — o desalinhamento entre
// eles já publicou binário anunciando uma versão e se identificando como outra.
// Ela é lida ANTES do inventário porque também define o corte: uma árvore
// 1.0.333 não pode ser reprovada por não ter o que só existe na 1.0.334.
let declarada = null
try {
  const pkg = JSON.parse(conteudo("package.json")).version
  const tauri = JSON.parse(conteudo("src-tauri/tauri.conf.json")).version
  if (pkg !== tauri) erro(`versões desalinhadas: package.json ${pkg} × tauri.conf.json ${tauri}`)
  else { declarada = pkg; console.log(`versão declarada: ${pkg}\n`) }
} catch { erro("não consegui ler as versões declaradas") }

const numero = v => (v ?? "").split(".").map(n => parseInt(n, 10) || 0)
/** A entrada já deveria existir nesta árvore? "—" = sempre; futura = ainda não. */
const jaDevia = versao => {
  if (versao === "—" || !declarada) return true
  const a = numero(versao), b = numero(declarada)
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] < b[i] }
  return true
}

let adiante = 0
for (const [versao, nome, arquivo, marca] of INVENTARIO) {
  if (!jaDevia(versao)) { adiante++; continue }
  if (!temArquivo(arquivo)) { erro(`[${versao}] ${nome} — arquivo ausente: ${arquivo}`); continue }
  if (marca && !conteudo(arquivo).includes(marca)) {
    erro(`[${versao}] ${nome} — o arquivo existe mas é uma versão ANTIGA (sem "${marca}" em ${arquivo})`)
  }
}
if (adiante) console.log(`(${adiante} item(ns) do inventário são de versão posterior a ${declarada} — não cobrados aqui)`)

console.log(falhas === 0
  ? "\nTUDO PRESENTE — nenhuma funcionalidade entregue sumiu."
  : `\n${falhas} funcionalidade(s) SUMIRAM. Esta árvore NÃO pode virar build.`)
process.exit(falhas === 0 ? 0 : 1)
