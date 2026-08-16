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
  ["—", "Arbitragem / VAR", "lib/arbitragem.ts", ""],
  ["—", "Eventos para o 3D", "lib/eventos-para-3d.ts", ""],
  ["—", "Histórico de lesões", "lib/historico-de-lesoes.ts", ""],
  ["—", "Confiança da diretoria", "lib/confianca-da-diretoria.ts", ""],
  ["—", "Simulação da partida", "lib/simulacao-da-partida.ts", ""],
]

console.log(`auditando: ${RAIZ}\n`)
for (const [versao, nome, arquivo, marca] of INVENTARIO) {
  if (!temArquivo(arquivo)) { erro(`[${versao}] ${nome} — arquivo ausente: ${arquivo}`); continue }
  if (marca && !conteudo(arquivo).includes(marca)) {
    erro(`[${versao}] ${nome} — o arquivo existe mas é uma versão ANTIGA (sem "${marca}" em ${arquivo})`)
  }
}

// A versão declarada nos dois arquivos tem de bater — o desalinhamento entre
// eles já publicou binário anunciando uma versão e se identificando como outra.
try {
  const pkg = JSON.parse(conteudo("package.json")).version
  const tauri = JSON.parse(conteudo("src-tauri/tauri.conf.json")).version
  if (pkg !== tauri) erro(`versões desalinhadas: package.json ${pkg} × tauri.conf.json ${tauri}`)
  else console.log(`versão declarada: ${pkg}`)
} catch { erro("não consegui ler as versões declaradas") }

console.log(falhas === 0
  ? "\nTUDO PRESENTE — nenhuma funcionalidade entregue sumiu."
  : `\n${falhas} funcionalidade(s) SUMIRAM. Esta árvore NÃO pode virar build.`)
process.exit(falhas === 0 ? 0 : 1)
