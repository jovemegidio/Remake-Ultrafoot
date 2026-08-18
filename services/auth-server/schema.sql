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
  admin          INTEGER NOT NULL DEFAULT 0,
  -- Codigo de amigo (7KM2-49XB): o identificador curto que a pessoa passa para
  -- quem quer adiciona-la, como o Riot ID. NULO ate ela pedir o dela — e por
  -- isso o UNIQUE mora num indice PARCIAL, criado pelo servidor: varios NULL
  -- precisam conviver.
  codigo_amigo   TEXT
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

-- ─── Presença e chat do FC Hub ───────────────────────────────────────────────
--
-- Quem está online sai DAQUI, não do Discord. Antes a lista de "jogadores
-- online" era a lista de amigos do Discord que estavam jogando — ou seja, ficava
-- vazia para quem não usa Discord, que é a maioria.
--
-- Uma linha por conta (o id é a chave): presença é estado atual, não histórico.
-- Quem está online é quem foi visto nos últimos segundos; não existe "sair",
-- porque fechar o jogo no tapa nunca dispararia esse aviso.
CREATE TABLE IF NOT EXISTS presenca (
  conta_id  INTEGER PRIMARY KEY REFERENCES contas(id),
  nome      TEXT    NOT NULL DEFAULT '',
  clube     TEXT    NOT NULL DEFAULT '',
  situacao  TEXT    NOT NULL DEFAULT '',
  -- O que a pessoa está fazendo agora, em uma linha pronta para a tela
  -- ("Flamengo 2 × 1 Palmeiras · 67'"). `atividade` é o mesmo em código
  -- (partida, mercado, treino…) para a interface escolher ícone e cor sem
  -- tentar interpretar texto. `origem` separa quem está no jogo de quem só
  -- abriu o launcher — chamar alguém para jogar vira loteria sem isso.
  detalhe   TEXT    NOT NULL DEFAULT '',
  atividade TEXT    NOT NULL DEFAULT '',
  origem    TEXT    NOT NULL DEFAULT '',
  visto_em  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_presenca_visto ON presenca(visto_em DESC);

-- Chat público do FC Hub. Guardamos pouco de propósito: é conversa de saguão,
-- não histórico que alguém vá querer consultar meses depois. O servidor apaga o
-- que passa do limite para o banco não crescer sem fim.
CREATE TABLE IF NOT EXISTS chat (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id  INTEGER NOT NULL REFERENCES contas(id),
  nome      TEXT    NOT NULL DEFAULT '',
  texto     TEXT    NOT NULL,
  quando    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_id ON chat(id DESC);

-- ─── Carteira da loja ────────────────────────────────────────────────────────
--
-- Saldo em CENTAVOS, inteiro. Dinheiro em ponto flutuante acumula erro de
-- arredondamento e um dia alguem perde credito por causa disso.
--
-- O saldo fica numa tabela propria, e nao calculado a partir de `compras`, para
-- a checagem de "tem saldo?" ser uma leitura direta — recomputar o extrato
-- inteiro a cada compra fica lento e abre janela para gastar duas vezes.
CREATE TABLE IF NOT EXISTS carteira (
  conta_id      INTEGER PRIMARY KEY REFERENCES contas(id),
  saldo_cents   INTEGER NOT NULL DEFAULT 0,
  atualizado_em INTEGER NOT NULL
);

-- Entradas de credito (recarga, brinde, estorno). Fica separado de `compras`
-- porque compra e saida: misturar os dois num extrato so torna impossivel
-- responder "quanto foi creditado" sem interpretar sinal.
CREATE TABLE IF NOT EXISTS creditos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id    INTEGER NOT NULL REFERENCES contas(id),
  valor_cents INTEGER NOT NULL,
  origem      TEXT    NOT NULL DEFAULT '',
  quando      INTEGER NOT NULL,
  -- Idempotencia: o mesmo pedido de recarga nao pode creditar duas vezes se a
  -- resposta se perder e o cliente repetir.
  id_externo  TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_creditos_conta ON creditos(conta_id, quando DESC);

-- ─── Pedidos e séries emitidas ───────────────────────────────────────────────
--
-- Um pedido é criado ANTES do pagamento e só entrega o produto quando o Asaas
-- confirma pelo webhook. Sem essa tabela, o webhook chegaria sem saber a qual
-- conta e a qual produto o pagamento se refere.
CREATE TABLE IF NOT EXISTS pedidos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id    INTEGER NOT NULL REFERENCES contas(id),
  produto     TEXT    NOT NULL,
  valor_cents INTEGER NOT NULL,
  -- Como foi pago (PIX, BOLETO, CREDIT_CARD). Antes isto so era MANDADO ao
  -- Asaas e nunca guardado — o banco sabia quanto entrou, mas nao por onde, e
  -- emitir recibo obrigava a abrir o extrato do Asaas a mao. O valor final vem
  -- do webhook, nao do pedido: quem escolhe "UNDEFINED" decide na hora de pagar.
  forma       TEXT    NOT NULL DEFAULT '',
  -- id da cobrança no Asaas; é por ele que o webhook encontra o pedido.
  asaas_id    TEXT UNIQUE,
  status      TEXT    NOT NULL DEFAULT 'pendente',
  criado_em   INTEGER NOT NULL,
  entregue_em INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pedidos_conta ON pedidos(conta_id, criado_em DESC);

-- Séries de licença emitidas PELO SERVIDOR (lote 9). Existe para a numeração
-- nunca repetir: duas séries iguais geram o mesmo código, e o segundo comprador
-- receberia uma chave já vinculada a outra conta.
CREATE TABLE IF NOT EXISTS series_emitidas (
  serie_emitida INTEGER PRIMARY KEY,
  conta_id      INTEGER NOT NULL REFERENCES contas(id),
  quando        INTEGER NOT NULL
);

-- ─── Recibos emitidos ────────────────────────────────────────────────────────
--
-- A NUMERAÇÃO mora aqui, e não no HTML do recibo. Se o número nascesse no
-- navegador, dois admins emitindo ao mesmo tempo produziriam o MESMO número — e
-- comprovante com número repetido não serve como comprovante.
--
-- A sequência reinicia a cada ano (UF-2026-0001). `(ano, sequencia)` é UNIQUE de
-- propósito: o servidor é multi-thread, e é o banco — não a boa vontade do
-- código — que garante que a corrida entre dois pedidos simultâneos falhe em vez
-- de duplicar. Quem perde a corrida tenta o número seguinte.
--
-- Nada aqui é apagado nem editado: recibo emitido é documento que já está na mão
-- de alguém. Emissão errada se conserta emitindo outro, não reescrevendo.
--
-- `conta_id` é NULO quando a venda aconteceu fora do launcher (Pix na mão, por
-- exemplo) e não há conta a que amarrar — o recibo existe do mesmo jeito.
--
-- `pedido_id` é UNIQUE e é o que sustenta o botão de recibo do launcher: o
-- comprador pede o recibo do pedido dele e o servidor devolve o que já existe em
-- vez de emitir outro. Sem isso, cada clique queimaria um número novo e a mesma
-- venda teria três comprovantes diferentes. É NULO na emissão manual, que não
-- nasce de pedido nenhum — e NULL não colide em UNIQUE no SQLite, então várias
-- emissões manuais convivem sem problema.
CREATE TABLE IF NOT EXISTS recibos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ano         INTEGER NOT NULL,
  sequencia   INTEGER NOT NULL,
  numero      TEXT    NOT NULL UNIQUE,   -- UF-2026-0001, exatamente como é impresso
  conta_id    INTEGER REFERENCES contas(id),
  pedido_id   INTEGER REFERENCES pedidos(id),   -- unico pelo indice logo abaixo
  nome        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  valor_cents INTEGER NOT NULL,
  forma       TEXT    NOT NULL DEFAULT '',
  chave       TEXT    NOT NULL DEFAULT '',
  item        TEXT    NOT NULL DEFAULT '',
  pago_em     INTEGER NOT NULL,
  emitido_por INTEGER NOT NULL REFERENCES contas(id),
  emitido_em  INTEGER NOT NULL,
  UNIQUE (ano, sequencia)
);

CREATE INDEX IF NOT EXISTS idx_recibos_emissao ON recibos(emitido_em DESC);
CREATE INDEX IF NOT EXISTS idx_recibos_conta ON recibos(conta_id);

-- É ISTO que garante um recibo por pedido. Índice em vez de `UNIQUE` na coluna
-- porque o SQLite não aceita ALTER TABLE ... ADD COLUMN UNIQUE: assim o banco que
-- já existe e o banco novo terminam com exatamente a mesma regra. Vários NULL
-- convivem (emissão manual não tem pedido).
CREATE UNIQUE INDEX IF NOT EXISTS idx_recibos_pedido ON recibos(pedido_id);

-- ─── Licenças Ed25519 ────────────────────────────────────────────────────────
--
-- Substitui o esquema de HMAC, em que o MESMO segredo assinava a chave vendida
-- e ia dentro do jogo para conferi-la — quem o extraísse do bundle emitia
-- licença à vontade.
--
-- Aqui o `codigo` é um identificador ALEATÓRIO, não um dado assinado: a verdade
-- sobre "esta chave vale" mora nesta tabela, não na matemática. Não há como
-- forjar um código, nem com a chave privada na mão, porque ele precisa EXISTIR
-- aqui. A assinatura Ed25519 entra depois, no certificado que o servidor
-- devolve para o jogo conferir offline.
CREATE TABLE IF NOT EXISTS licencas (
  codigo           TEXT    PRIMARY KEY,          -- UF26-ABCDE-FGHIJ-KLMNO
  conta_id         INTEGER REFERENCES contas(id),
  serie            INTEGER NOT NULL,             -- para cruzar no suporte
  emitida_em       INTEGER NOT NULL,
  -- NULL até a primeira ativação. Depois, amarra a licença a UMA máquina: sem
  -- isso um código vazado registraria o jogo em quantos PCs quisessem.
  device           TEXT,
  ativada_em       INTEGER,
  -- Diferente da lista embutida no build, a revogação aqui vale IMEDIATAMENTE
  -- na próxima ativação, sem esperar a próxima versão publicada.
  revogada         INTEGER NOT NULL DEFAULT 0,
  motivo_revogacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_licencas_conta ON licencas(conta_id);

-- ─── Amizades ────────────────────────────────────────────────────────────────
--
-- Uma LINHA POR PAR, com `a_id < b_id` sempre (ver `_par` no servidor). Guardar
-- as duas direções pareceria mais simples, mas abre a porta para o estado ficar
-- meio-aceito: A vê B como amigo e B não vê A. Com par canônico isso é
-- impossível — só existe um registro para decidir.
--
-- `pedido_por` é quem mandou o convite. É o que permite mostrar "aguardando
-- resposta" para um lado e "responder" para o outro sem uma coluna extra, e o
-- que impede a pessoa de aceitar o próprio pedido.
CREATE TABLE IF NOT EXISTS amizades (
  a_id          INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  b_id          INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  estado        TEXT    NOT NULL DEFAULT 'pendente',   -- pendente | aceita
  pedido_por    INTEGER NOT NULL,
  criada_em     INTEGER NOT NULL,
  respondida_em INTEGER,
  PRIMARY KEY (a_id, b_id)
);

CREATE INDEX IF NOT EXISTS idx_amizades_b ON amizades(b_id, estado);

-- Bloqueio é de MÃO ÚNICA e independente da amizade: quem bloqueia deixa de
-- receber pedido e mensagem daquela conta, e o bloqueado não é avisado (avisar
-- transforma o bloqueio em convite para criar outra conta e insistir).
CREATE TABLE IF NOT EXISTS bloqueios (
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  alvo_id  INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  quando   INTEGER NOT NULL,
  PRIMARY KEY (conta_id, alvo_id)
);

-- ─── Mensagens diretas ───────────────────────────────────────────────────────
--
-- Conversa privada entre DUAS contas amigas. Diferente do chat do saguão, isto
-- NÃO é descartável: quem manda "topa uma liga sábado?" espera que a mensagem
-- ainda esteja lá quando o outro abrir o launcher amanhã. Por isso a limpeza é
-- por CONVERSA (as últimas N de cada par), e não um teto global — senão duas
-- pessoas conversando apagariam a conversa de todas as outras.
--
-- `lida_em` é NULO enquanto o destinatário não abriu: é dele que sai o "2 não
-- lidas" no ícone. Só o destinatário marca como lida.
CREATE TABLE IF NOT EXISTS mensagens (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  de_id    INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  para_id  INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  texto    TEXT    NOT NULL,
  quando   INTEGER NOT NULL,
  lida_em  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mensagens_par ON mensagens(de_id, para_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_caixa ON mensagens(para_id, lida_em);

-- ─── Mural de atividade ──────────────────────────────────────────────────────
--
-- "O que os outros estão fazendo no Ultrafoot" que SOBREVIVE a estar offline.
-- Presença responde "quem está online AGORA" e some em 90s; título ganho,
-- contratação e virada de temporada são justamente o que a pessoa quer ver
-- quando abre o launcher depois de dois dias.
--
-- Quem publica é o JOGO, em eventos que ele já conhece. `chave` existe para o
-- mesmo evento não entrar duas vezes quando o jogador reabre um save antigo ou
-- a resposta se perde e o cliente repete.
CREATE TABLE IF NOT EXISTS feed (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  tipo     TEXT    NOT NULL DEFAULT '',   -- titulo | contratacao | temporada | partida | marco
  texto    TEXT    NOT NULL,
  clube    TEXT    NOT NULL DEFAULT '',
  chave    TEXT    NOT NULL DEFAULT '',
  quando   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feed_conta ON feed(conta_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_chave ON feed(conta_id, chave) WHERE chave <> '';
