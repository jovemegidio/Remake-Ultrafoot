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
  // ⚠️ ERA `abaDaUrl` NO ESCRITÓRIO. Na 1.0.358 as abas viraram TELAS (o menu
  // apontava para `?aba=` e nada acontecia, porque a navegação é client-side e o
  // componente não remontava). O que precisa continuar existindo é o caminho de
  // volta do link antigo, que hoje é `rotaDaAbaAntiga`.
  ["1.0.338", "Link antigo `?aba=` leva a tela nova do atleta", "app/carreira/jogador/page.tsx", "rotaDaAbaAntiga"],
  ["1.0.338", "Campo na partida vivida do atleta", "components/match/campo-do-atleta.tsx", "CampoDoAtleta"],
  ["1.0.338", "Partida do atleta desenha o campo", "app/carreira/jogador/partida/page.tsx", "CampoDoAtleta"],
  ["1.0.338", "Gate do campo do atleta", "scripts/test-campo-do-atleta.ts", "onze nomes reais"],
  ["1.0.339", "Treino por intensidade na carreira de atleta", "lib/carreira-de-jogador.ts", "treinarNaSemana"],
  // A intensidade mudou de tela junto com a reforma da 1.0.358: hoje ela mora em
  // "Evolucao e atributos", que e a tela do treino.
  ["1.0.339", "Intensidade do treino na tela do atleta", "app/carreira/jogador/evolucao/page.tsx", "definirIntensidadeDeTreino"],
  ["1.0.339", "Gate do treino do atleta", "scripts/test-treino-do-atleta.ts", "tem efeito medivel"],
  ["1.0.340", "Conversas com familia, empresario e diretoria", "lib/conversas-do-atleta.ts", "conversasDoMomento"],
  ["1.0.340", "Conversas na tela do atleta", "app/carreira/jogador/page.tsx", "responderConversa"],
  ["1.0.340", "Gate das conversas do atleta", "scripts/test-conversas-do-atleta.ts", "e enfeite"],
  // A marca era "concluidasPorConfronto" — o NOME de uma variavel de
  // contagem, que a 1.0.366 reescreveu ao corrigir a partida do estadual que
  // sumia. A rede continua inteira; quem mudou foi o nome. Trocada por
  // `identidadeFrouxa`, que nasceu no proprio commit da 1.0.341 e E o
  // mecanismo: casar a partida pela identidade do confronto quando a chave do
  // calendario regenerado nao casa mais.
  ["1.0.341", "Partida disputada sobrevive a calendario regenerado", "lib/use-game-manager.ts", "identidadeFrouxa"],
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
  ["1.0.378", "Escala da modalidade chega ao mercado", "lib/mercado-da-modalidade.ts", "naEscalaDaModalidade"],
  ["1.0.378", "Folha propria das ligas femininas", "lib/club-economy.ts", "brasileirao_fem_a1"],
  ["1.0.378", "Patrocinio carimba a temporada do jogo", "lib/sponsor-engine.ts", "season: number"],
  ["1.0.378", "Alias de RSC criado para o prefetch do roteador", "scripts/fix-next-export-rsc.mjs", "paginaDentroDoDiretorio"],
  ["1.0.379", "Verba propria da categoria de base", "lib/youth-career-engine.ts", "verbaDaTemporada"],
  ["1.0.379", "Mercado da base debita a verba, nao o caixa do clube", "app/mercado/page.tsx", "pagaPelaVerba"],
  ["1.0.379", "A carreira online tem temporada que fecha", "services/multiplayer-relay-vps/carreira-online.mjs", "encerrarTemporada"],
  ["1.0.379", "Rodizio pelo metodo do circulo, sem repetir confronto", "services/multiplayer-relay-vps/carreira-online.mjs", "rotacionados.length - 1 - i"],
  ["1.0.379", "Mata-mata no fim da temporada online", "services/multiplayer-relay-vps/carreira-online.mjs", "abrirMataMata"],
  ["1.0.379", "Empate na chave decidido pela campanha", "services/multiplayer-relay-vps/carreira-online.mjs", "vencedoresDaFase"],
  ["1.0.379", "A tela mostra a fase da chave", "app/online/carreira/page.tsx", "nomeDaFase"],
  ["1.0.347", "Imprensa pergunta pela modalidade", "lib/game-engine.ts", "A IMPRENSA PERGUNTAVA A MESMA COISA"],
  ["1.0.347", "Lesao com consequencia na carreira de atleta", "lib/carreira-de-jogador.ts", "sortearLesao"],
  ["1.0.347", "Capitania na carreira de atleta", "lib/carreira-de-jogador.ts", "A BRACADEIRA"],
  ["1.0.347", "Pre-temporada na carreira de atleta", "lib/carreira-de-jogador.ts", "preTemporada"],
  ["1.0.347", "Auditoria de telas serve os escudos podados", "scripts/qa-audit.mjs", "publicDir"],
  ["1.0.347", "Hidratacao das escalacoes", "app/elenco/escalacoes/page.tsx", "NADA DO SAVE PODE ENTRAR"],
  ["1.0.347", "Gate das tres modalidades", "scripts/test-modalidades-ponta-a-ponta.ts", "a bracadeira"],
  ["1.0.352", "Painel do atleta recolhivel", "app/elenco/gerenciamento/page.tsx", "painelDoAtletaRecolhido"],
  // O fundo passou para a casca comum das quatro telas do atleta (1.0.358) — e la
  // ele finalmente APARECE: estava em `-z-10`, atras do fundo do body.
  ["1.0.352", "Fundo do escritorio do atleta", "components/carreira-jogador/atleta-shell.tsx", "in-game-02.webp"],
  ["1.0.352", "Online nao marca escolha sem o jogador mexer", "app/configuracoes/page.tsx", "mexeuNoOnline"],
  ["1.0.352", "Gate do online que nao toca no save", "scripts/test-online-nao-toca-no-save.ts", "nao encosta no save"],
  ["1.0.353", "Narracao da partida do atleta", "lib/partida-do-atleta.ts", "montarNarracao"],
  ["1.0.353", "Narracao na tela da partida", "app/carreira/jogador/partida/page.tsx", "narracaoDaPartida"],
  ["1.0.353", "Gate da narracao x placar", "scripts/test-narracao-do-atleta.ts", "contradizendo o placar"],
  ["1.0.354", "Pool de clubes pre-computado", "scripts/precomputar-pool.mjs", "GALINHA E DO OVO"],
  ["1.0.354", "Teams-data le o pool pronto", "lib/teams-data.ts", "_poolPrecomputado"],
  ["1.0.354", "Manager Rush jogavel", "app/online/rush/page.tsx", "MINUTO_INICIAL"],
  ["1.0.354", "Regra e forcas do Rush num lugar so", "lib/manager-rush.ts", "forcasDoRush"],
  ["1.0.354", "Gate do equilibrio do Rush", "scripts/test-manager-rush.ts", "IMPOSSIVEL"],
  ["1.0.355", "Auditoria do save em disco", "scripts/qa-saves-em-disco.mjs", "ESCAPOU DA PRIMEIRA VERSAO"],
  ["1.0.356", "Universo so na memoria de quem usa", "lib/persistent-store.ts", "CHAVE_CARREIRA_ATIVA"],
  ["1.0.356", "Gate de memoria do universo", "scripts/test-universo-na-memoria.ts", "158 MB de heap"],
  ["1.0.349", "Idiomas parciais com reserva no portugues", "lib/i18n/index.ts", "comReservaEmPortugues"],
  ["1.0.349", "Cobertura de idioma medida, nao rotulada", "lib/i18n/index.ts", "coberturaDoIdioma"],
  ["1.0.349", "Extrator de texto chumbado", "scripts/extrair-textos.mjs", "SÓ ANTES DE UMA TAG DE FECHAMENTO"],
  ["1.0.349", "Catraca da traducao", "scripts/qa-traducao.mjs", "TETO QUE SÓ DESCE"],
  ["1.0.349", "Gate da reserva de idioma", "scripts/test-idiomas-com-reserva.ts", "NÃO PODE DEIXAR BURACO"],
  ["1.0.348", "Instalador do jogo conferido antes de executar", "Launcher/src-tauri/src/lib.rs", "CONFERIR ANTES DE EXECUTAR"],
  ["1.0.348", "latest.json publica sha256 e tamanho", "scripts/publish-release.mjs", "createHash"],
  ["1.0.348", "Deploy nao aborta por falta de changelog", "scripts/publicar-launcher-config.mjs", "ESCRITA SOZINHA"],
  ["1.0.358", "Telas do atleta em rota propria", "components/carreira-jogador/atleta-shell.tsx", "AtletaShell"],
  ["1.0.358", "Menu do atleta aponta para as telas", "components/game-header.tsx", "/carreira/jogador/calendario"],
  ["1.0.358", "Calendario do atleta com tabela embutida", "app/carreira/jogador/calendario/page.tsx", "carreira.tabela"],
  ["1.0.358", "Atleta sem clube: rescisao e mercado", "lib/carreira-de-jogador.ts", "rescindirContrato"],
  ["1.0.358", "Contraproposta do agente", "lib/carreira-de-jogador.ts", "contrapropor"],
  ["1.0.358", "Rescisao do atleta no cabecalho", "components/game-header.tsx", "ehCarreiraDeAtleta && carreiraDeAtleta"],
  ["1.0.358", "Pre-jogo e ao vivo na partida do atleta", "app/carreira/jogador/partida/page.tsx", "ENTRAR EM CAMPO"],
  ["1.0.358", "Placar do atleta nao entrega o fim", "app/carreira/jogador/partida/page.tsx", "placarAte"],
  ["1.0.358", "Fundo do mercado nos modos online", "app/online/page.tsx", "online-mercado.webp"],
  ["1.0.358", "Gate do atleta sem clube", "scripts/qa-sem-clube.ts", "SEM CLUBE OK"],
  ["1.0.358", "Gate de tela do atleta (scroll e menu)", "e2e/carreira-atleta.spec.ts", "sobra faixa morta"],
  ["1.0.358", "Nome da carreira de atleta e o do ATLETA", "app/novo-jogo/page.tsx", "nomeDaCarreira"],
  ["1.0.358", "Gate de criacao da carreira de atleta", "e2e/criar-carreira-atleta.spec.ts", "cai no escritorio"],
  ["1.0.358", "Espera da criacao com rosto", "app/novo-jogo/page.tsx", "montando_sua_temporada"],
  ["1.0.358", "Elencos carregam enquanto a pessoa escolhe", "app/novo-jogo/page.tsx", "requestIdleCallback"],
  ["1.0.358", "Socorro de navegacao le a transicao do React", "components/native-app-provider.tsx", "pendenteRef"],
  ["1.0.358", "Pre-office sem scroll e com noticias em barra", "app/pre-office/page.tsx", "AS NOTÍCIAS VIRARAM UMA BARRA"],
  ["1.0.358", "Online nao mostra a carreira no cabecalho", "components/game-header.tsx", "emModoOnline"],
  ["1.0.358", "Camisa sem a sigla da posicao por cima", "app/elenco/gerenciamento/page.tsx", "SEM NÚMERO, NÃO ENTRA NADA"],
  ["1.0.358", "Universo nao fica em memoria duas vezes", "lib/persistent-store.ts", "esquecerDoCache"],
  ["1.0.358", "Catraca de memoria das telas", "e2e/memoria-das-telas.spec.ts", "TETO_MB"],
  ["1.0.358", "Criar atleta fora das configuracoes iniciais", "app/novo-jogo/page.tsx", "showAtletaSetup"],
  ["1.0.358", "Criacao vai direto ao carregamento", "lib/hard-navigation.ts", "recarregar"],
  ["1.0.358", "Relay avisa os DOIS lados do pareamento", "services/multiplayer-relay-vps/rivals.mjs", "partidaAbertaDe"],
  ["1.0.358", "Manager Champions: tabela da semana", "services/multiplayer-relay-vps/rivals.mjs", "classificacaoSemanal"],
  ["1.0.358", "Rota da classificacao semanal", "services/multiplayer-relay-vps/server.mjs", "/v1/champions/classificacao"],
  // A frase foi extraida para o dicionario logo depois de escrita: o marcador
  // aponta para a CHAVE, que nao muda quando o texto muda.
  ["1.0.358", "Tela do Manager Champions", "app/online/champions/page.tsx", "t.champions.classificacao_da_semana"],
  ["1.0.358", "Gate do champions no relay", "scripts/qa-rivals-servidor.mjs", "champions pontuou a semana"],
  // EVENTOS DA SEMANA, MANAGER DRAFT E CARREIRA ONLINE (1.0.358).
  ["1.0.358", "Regras do evento da semana", "lib/eventos-da-semana.ts", "REGRAS_DO_EVENTO"],
  ["1.0.358", "A regra vem da semana do servidor", "lib/eventos-da-semana.ts", "regraDaSemana"],
  ["1.0.358", "Tela dos Eventos da semana", "app/online/eventos/page.tsx", "t.eventos.classificacao"],
  ["1.0.358", "Tabela do evento no relay", "services/multiplayer-relay-vps/rivals.mjs", "registrarEvento"],
  ["1.0.358", "Rotas do evento da semana", "services/multiplayer-relay-vps/server.mjs", "/v1/eventos/resultado"],
  ["1.0.358", "Porta de entrada do Manager Draft", "app/online/draft/page.tsx", "ultrafoot:abrir-draft"],
  ["1.0.358", "O Hub abre o draft por bandeira", "components/fc-hub.tsx", "ultrafoot:abrir-draft"],
  ["1.0.358", "Mundo compartilhado da Carreira Online", "services/multiplayer-relay-vps/carreira-online.mjs", "papel_ocupado"],
  // O clube virou entidade com quatro cadeiras (cooperativa e diretoria online):
  // a tabela e do CLUBE, e cada papel tem uma mao que os outros nao tem.
  ["1.0.358", "Clube compartilhado por ate 4 pessoas", "services/multiplayer-relay-vps/carreira-online.mjs", "PAPEIS = ["],
  ["1.0.358", "Permissoes por papel vem do servidor", "services/multiplayer-relay-vps/carreira-online.mjs", "permissoes: membro ?"],
  ["1.0.358", "Teto de gastos do presidente", "services/multiplayer-relay-vps/carreira-online.mjs", "acima_do_teto"],
  ["1.0.358", "Relatorio do olheiro", "services/multiplayer-relay-vps/carreira-online.mjs", "sem_olheiro"],
  ["1.0.358", "Tela mostra o botao pelas permissoes", "app/online/carreira/page.tsx", "mundo.permissoes"],
  ["1.0.358", "Gate dos papeis no clube", "scripts/qa-mundo-online.mjs", "quatro pessoas no mesmo clube"],
  ["1.0.358", "Semente por confronto (mesmo jogo nos dois lados)", "services/multiplayer-relay-vps/carreira-online.mjs", "semente: crypto.randomInt"],
  ["1.0.358", "Rotas do mundo compartilhado", "services/multiplayer-relay-vps/server.mjs", "/v1/carreira/entrar"],
  ["1.0.358", "Cliente do mundo compartilhado", "lib/carreira-online.ts", "enviarPlacarDoMundo"],
  ["1.0.358", "Tela da Carreira Online joga com a semente", "app/online/carreira/page.tsx", "semearMotorDePartida"],
  ["1.0.358", "Gate do mundo online", "scripts/qa-mundo-online.mjs", "a vaga é compartilhada"],

  ["1.0.366", "Partida do estadual nao some ao reconstruir o save", "lib/use-game-manager.ts", "chavesDoCalendario"],
  ["1.0.366", "Resultado aberto na partida do atleta", "lib/partida-ao-vivo-do-atleta.ts", "avancarAteOLance"],
  ["1.0.366", "A carreira do atleta VIVE a partida", "lib/partida-do-atleta.ts", "montarPartidaAoVivo"],
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
