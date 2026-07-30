-- BANCO DE ATUALIZACOES DO ULTRAFOOT
--
-- Guarda o que muda nos clubes depois que o jogo ja saiu: escudo, uniforme,
-- cores, estadio, elenco e transferencias. O jogo NAO consulta este banco: ele
-- baixa o manifesto estatico que sai daqui (ver server.py > publicar).
--
-- POR QUE UM BANCO E NAO O JSON EDITADO A MAO:
--   * o JSON anterior era um arquivo unico, editado no braco, sem historico —
--     um erro de virgula derrubava a atualizacao de todo mundo de uma vez;
--   * escudo e uniforme viajavam como data URL em base64 dentro do proprio
--     JSON. O seed embutido no jogo chegou a 30 MB assim. Aqui a imagem vira
--     ARQUIVO, deduplicado por sha256, e o manifesto carrega so a URL.
--
-- WAL: leitura do gerador de manifesto nao trava a escrita do painel.
PRAGMA journal_mode = WAL;

-- ─── Clubes ──────────────────────────────────────────────────────────────────
-- `file_key` e a MESMA chave que o jogo usa (lib/team-overrides). Sem isso a
-- atualizacao chega e nao casa com clube nenhum, em silencio.
CREATE TABLE IF NOT EXISTS clubes (
  file_key       TEXT PRIMARY KEY,
  nome           TEXT,
  nome_oficial   TEXT,
  curto          TEXT,
  cor1           TEXT,
  cor2           TEXT,
  prestigio      INTEGER,
  estadio_nome   TEXT,
  estadio_cap    INTEGER,
  patrocinador   TEXT,
  -- sha da imagem em `imagens`; a URL final e montada na publicacao
  escudo_sha     TEXT,
  -- kits como JSON: {"home":{"primary","secondary","pattern","sha","disabled"},...}
  -- E um blob de proposito: o formato de kit ja mudou duas vezes no jogo, e uma
  -- coluna por variante x campo viraria uma migracao a cada mudanca.
  kits_json      TEXT,
  atualizado_em  INTEGER NOT NULL DEFAULT 0,
  -- Rascunho nao sai no manifesto. E o que deixa mexer com calma e publicar de
  -- uma vez, em vez de o jogador receber o clube pela metade.
  rascunho       INTEGER NOT NULL DEFAULT 0
);

-- ─── Atletas ─────────────────────────────────────────────────────────────────
-- `chave` = `${file_key}__${nome_normalizado}`, o mesmo formato de
-- lib/player-overrides. O nome ORIGINAL fica guardado para a edicao sobreviver
-- a uma renomeacao.
CREATE TABLE IF NOT EXISTS jogadores (
  chave          TEXT PRIMARY KEY,
  file_key       TEXT NOT NULL,
  nome_original  TEXT NOT NULL,
  nome           TEXT,
  pos            TEXT,
  base           INTEGER,
  idade          INTEGER,
  nac            TEXT,
  foto_sha       TEXT,
  atualizado_em  INTEGER NOT NULL DEFAULT 0,
  rascunho       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_jogadores_clube ON jogadores(file_key);

-- ─── Transferencias ──────────────────────────────────────────────────────────
-- `de` vazio = chegada sem saida (contratacao de fora do universo do jogo).
-- `para` vazio = saiu do futebol coberto pelo jogo.
CREATE TABLE IF NOT EXISTS transferencias (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT NOT NULL,
  de         TEXT,
  para       TEXT,
  pos        TEXT,
  idade      INTEGER,
  base       INTEGER,
  nac        TEXT,
  criado_em  INTEGER NOT NULL DEFAULT 0,
  rascunho   INTEGER NOT NULL DEFAULT 0
);

-- ─── Competicoes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ligas (
  competicao   TEXT PRIMARY KEY,
  clubes_json  TEXT,
  atualizado_em INTEGER NOT NULL DEFAULT 0,
  rascunho     INTEGER NOT NULL DEFAULT 0
);

-- ─── Imagens ─────────────────────────────────────────────────────────────────
-- Enderecadas por sha256 do conteudo: subir o mesmo escudo duas vezes nao gera
-- arquivo novo, e trocar a imagem nunca invalida o cache da anterior (o nome
-- muda junto com o conteudo).
CREATE TABLE IF NOT EXISTS imagens (
  sha        TEXT PRIMARY KEY,
  ext        TEXT NOT NULL,
  bytes      INTEGER NOT NULL,
  origem     TEXT,
  criado_em  INTEGER NOT NULL DEFAULT 0
);

-- ─── Historico de publicacoes ────────────────────────────────────────────────
-- `versao` e o inteiro que o cliente compara. NUNCA pode retroceder: o jogo so
-- aceita numero MAIOR do que o que ja tem, e publicar um numero igual ou menor
-- nao da erro nenhum — simplesmente nao chega em ninguem.
CREATE TABLE IF NOT EXISTS publicacoes (
  versao        INTEGER PRIMARY KEY,
  notas         TEXT,
  publicado_em  INTEGER NOT NULL,
  clubes        INTEGER NOT NULL DEFAULT 0,
  jogadores     INTEGER NOT NULL DEFAULT 0,
  transferencias INTEGER NOT NULL DEFAULT 0,
  ligas         INTEGER NOT NULL DEFAULT 0,
  bytes         INTEGER NOT NULL DEFAULT 0,
  por_conta     INTEGER
);

-- ─── Registro de quem mexeu ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS log_admin (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id  INTEGER,
  email     TEXT,
  acao      TEXT NOT NULL,
  alvo      TEXT,
  quando    INTEGER NOT NULL
);
