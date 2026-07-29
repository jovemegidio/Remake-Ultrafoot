-- Esquema de contas e compras do Ultrafoot.
--
-- SQLite com WAL: um arquivo unico (backup e copiar o arquivo) e leitura
-- concorrente sem travar escrita. Postgres so se um dia houver mais de um
-- servidor de aplicacao — nao e o caso.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Contas ──────────────────────────────────────────────────────────────────
--
-- `senha_hash` e NULO para quem entrou pelo Google: essa conta nao tem senha, e
-- guardar uma string vazia abriria caminho para login com senha em branco.
-- `email` e unico e sempre guardado em minusculas (ver normalizacao no servidor)
-- para "A@x.com" e "a@x.com" nao virarem duas contas.
CREATE TABLE IF NOT EXISTS contas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT    NOT NULL UNIQUE,
  nome           TEXT    NOT NULL DEFAULT '',
  senha_hash     TEXT,
  senha_salt     TEXT,
  google_sub     TEXT UNIQUE,          -- identificador estavel do Google (nao o email)
  criada_em      INTEGER NOT NULL,
  ultimo_login   INTEGER,
  bloqueada      INTEGER NOT NULL DEFAULT 0,
  -- Motivo do banimento fica registrado: banir sem justificativa some com o
  -- contexto e ninguem consegue revisar a decisao depois.
  motivo_bloqueio TEXT NOT NULL DEFAULT '',
  bloqueada_em   INTEGER,
  admin          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_contas_google ON contas(google_sub);

-- ─── Sessoes ─────────────────────────────────────────────────────────────────
--
-- Guardamos o HASH do token, nunca o token em si: vazar o banco nao deve
-- permitir assumir sessoes. Mesma logica de senha.
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash  TEXT    PRIMARY KEY,
  conta_id    INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  criada_em   INTEGER NOT NULL,
  expira_em   INTEGER NOT NULL,
  dispositivo TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sessoes_conta ON sessoes(conta_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);

-- ─── Compras ─────────────────────────────────────────────────────────────────
--
-- Dado FINANCEIRO: nunca e apagado nem editado. Estorno entra como novo
-- lancamento com `estorno_de` apontando para a compra original — assim o
-- historico continua auditavel e o saldo e sempre derivado da soma.
--
-- `id_externo` e unico para o mesmo pagamento nao ser creditado duas vezes se
-- o gateway reenviar o webhook (idempotencia).
CREATE TABLE IF NOT EXISTS compras (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id     INTEGER NOT NULL REFERENCES contas(id),
  produto      TEXT    NOT NULL,
  valor_cents  INTEGER NOT NULL,
  moeda        TEXT    NOT NULL DEFAULT 'BRL',
  id_externo   TEXT UNIQUE,
  estorno_de   INTEGER REFERENCES compras(id),
  criada_em    INTEGER NOT NULL,
  meta         TEXT    NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_compras_conta ON compras(conta_id);

-- ─── Licencas antigas ────────────────────────────────────────────────────────
--
-- Ponte para quem ja jogava com codigo serial. Ao entrar pela primeira vez, o
-- codigo e vinculado a uma conta e nao pode ser reaproveitado por outra.
-- Sem isto, ligar a exigencia de login expulsaria quem ja pagou.
CREATE TABLE IF NOT EXISTS licencas_migradas (
  codigo     TEXT    PRIMARY KEY,
  conta_id   INTEGER NOT NULL REFERENCES contas(id),
  migrada_em INTEGER NOT NULL
);

-- ─── Tentativas de login ─────────────────────────────────────────────────────
--
-- Base do limite de tentativas por email/IP. Registro efemero: o servidor limpa
-- o que passou da janela.
CREATE TABLE IF NOT EXISTS tentativas (
  chave    TEXT    NOT NULL,
  quando   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tentativas ON tentativas(chave, quando);

-- ─── Auditoria administrativa ────────────────────────────────────────────────
--
-- Toda acao de admin sobre uma conta fica registrada. Banimento e uma decisao
-- que afeta alguem que pagou: precisa de quem fez, quando e por que.
CREATE TABLE IF NOT EXISTS admin_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER NOT NULL REFERENCES contas(id),
  alvo_id    INTEGER NOT NULL REFERENCES contas(id),
  acao       TEXT    NOT NULL,
  motivo     TEXT    NOT NULL DEFAULT '',
  quando     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_log_alvo ON admin_log(alvo_id);

-- ─── Saves da conta ──────────────────────────────────────────────────────────
--
-- O SAVE em si nao mora aqui: ele fica no cloud-save-server, guardado por um
-- codigo de 6 caracteres. Esta tabela e so o CATALOGO — qual codigo pertence a
-- qual conta.
--
-- E o que resolve o caso real: a pessoa formata o computador, entra na conta e
-- ve os proprios codigos, em vez de ter de lembrar de "ABC123" de cabeca.
--
-- O codigo e PRIMARY KEY: um codigo pertence a UMA conta. Sem isso, alguem que
-- descobrisse o codigo alheio poderia reivindica-lo e ele apareceria nas duas
-- listas.
CREATE TABLE IF NOT EXISTS saves_da_conta (
  codigo        TEXT    PRIMARY KEY,
  conta_id      INTEGER NOT NULL REFERENCES contas(id),
  rotulo        TEXT    NOT NULL DEFAULT '',
  criado_em     INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saves_conta ON saves_da_conta(conta_id, atualizado_em DESC);
