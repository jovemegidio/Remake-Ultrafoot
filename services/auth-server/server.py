#!/usr/bin/env python3
"""Contas, sessoes e compras do Ultrafoot.

Servico SEPARADO do cloud-save-server de proposito: compra e dado financeiro, e
uma falha no save nao pode derrubar o que sustenta o acesso pago.

So biblioteca padrao, como o cloud-save-server — nada de pip na VPS.

SEGURANCA, decisoes que nao devem ser afrouxadas sem pensar:

  • Senha passa por scrypt (hashlib.scrypt, stdlib) com salt de 16 bytes por
    conta. Nunca guardamos a senha, nem algo reversivel a partir dela.
  • Do token de sessao guardamos apenas o SHA-256. Vazar o banco nao permite
    assumir sessao de ninguem.
  • Comparacoes de segredo usam compare_digest (tempo constante) para nao
    vazar informacao pelo tempo de resposta.
  • Login errado responde a MESMA mensagem para email inexistente e senha
    errada — dizer qual dos dois falhou entrega quais emails tem conta.
  • Limite de tentativas por email+IP, para forca bruta nao ser viavel.

O servico escuta em 127.0.0.1; quem expoe para fora e o nginx, com TLS.
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
import time
import urllib.parse
import urllib.request

# Emissao/ativacao Ed25519. Modulo IRMAO, no mesmo diretorio — o import falharia
# se o servico fosse iniciado de outra pasta, entao garantimos o caminho.
sys.path.insert(0, str(Path(__file__).parent))
import licenca  # noqa: E402

HOST = "127.0.0.1"
PORT = int(os.environ.get("ULTRAFOOT_AUTH_PORT", "8790"))
DB_PATH = Path(os.environ.get("ULTRAFOOT_AUTH_DB", "/var/lib/ultrafoot/auth.db"))
SCHEMA = Path(__file__).with_name("schema.sql")

GOOGLE_CLIENT_ID = os.environ.get("ULTRAFOOT_GOOGLE_CLIENT_ID", "")
# O Google EXIGE client_secret na troca do codigo mesmo com PKCE (respondia
# `client_secret is missing`). Ele fica so aqui, em variavel de ambiente do
# servidor — nunca no launcher, de onde qualquer um extrairia do binario.
GOOGLE_CLIENT_SECRET = os.environ.get("ULTRAFOOT_GOOGLE_CLIENT_SECRET", "")
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

MAX_BODY = 64 * 1024
SESSAO_DIAS = 30
TENTATIVAS_MAX = 8
TENTATIVAS_JANELA = 15 * 60  # segundos

# Presenca: 90s cobre com folga uma batida a cada 30s, inclusive com rede ruim.
# Menos que isso e o jogador pisca entre online e offline na lista dos outros.
PRESENCA_JANELA = 90
CHAT_INTERVALO = 2      # segundos entre mensagens da mesma conta
CHAT_LIMITE = 300       # mensagens guardadas no total

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ─── Banco ────────────────────────────────────────────────────────────────────

def conectar() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def iniciar_banco() -> None:
    with conectar() as con:
        con.executescript(SCHEMA.read_text(encoding="utf-8"))
        # Colunas novas em banco que ja existe. `CREATE TABLE IF NOT EXISTS` nao
        # altera tabela criada antes, entao quem ja tinha conta ficaria sem elas.
        existentes = {l["name"] for l in con.execute("PRAGMA table_info(contas)")}
        for coluna, definicao in (
            ("telefone", "TEXT NOT NULL DEFAULT ''"),
            ("ativado", "INTEGER NOT NULL DEFAULT 0"),
            ("licenca_serie", "INTEGER"),
            ("licenca_lote", "INTEGER"),
            ("asaas_cliente", "TEXT"),
        ):
            if coluna not in existentes:
                con.execute(f"ALTER TABLE contas ADD COLUMN {coluna} {definicao}")


# ─── Codigo de ativacao ───────────────────────────────────────────────────────
#
# MESMO algoritmo de lib/license.ts: base32 Crockford, serie 24 bits + lote 6 +
# HMAC-SHA256 truncado em 45. Validar aqui tambem permite dizer na hora do
# cadastro se a chave e boa, e amarrar a chave a UMA conta — o jogo sozinho, por
# ser offline, nao consegue saber que a mesma chave foi usada em outra maquina.

PREFIXO_LICENCA = "UF26"

# ETAPA 6 (docs/plano-licenca-ed25519.md): o HMAC saiu daqui.
#
# `LICENCA_SEGREDO`, `validar_codigo_licenca()`, `montar_codigo()` e a lista
# `licencas-revogadas.json` foram removidos. O segredo era simetrico: o MESMO
# valor que emitia licenca precisava ir dentro do jogo para conferi-la offline, e
# `NEXT_PUBLIC_*` o deixava em texto puro no bundle.
#
# Agora a validade de um codigo se resolve na tabela `licencas` (modulo
# `licenca.py`), e a revogacao vale na proxima ativacao em vez de depender de uma
# lista embutida na build.
#
# `normalizar` mora em licenca.py — um lugar so, para as trocas do Crockford nao
# divergirem entre os dois arquivos.
normalizar_codigo = licenca.normalizar


def formato_de_codigo(bruto: str) -> bool:
    """So o FORMATO — nao diz se o codigo vale.

    Serve para recusar lixo antes de ir ao banco. Quem decide a validade e a
    tabela `licencas`; nao existe mais nada aqui capaz de afirmar que uma chave
    e boa a partir do proprio texto dela.
    """
    partes = normalizar_codigo(bruto).split("-")
    if len(partes) != 4 or partes[0] != PREFIXO_LICENCA:
        return False
    corpo = "".join(partes[1:])
    return len(corpo) == 15 and all(ch in licenca.ALFABETO for ch in corpo)


def ativar_conta(con, conta_id: int, bruto: str) -> str:
    """Vincula a licenca a esta conta. Devolve "" em caso de sucesso, ou o erro.

    ETAPA 6: antes isto conferia o HMAC do codigo. Agora consulta a tabela
    `licencas` — a chave precisa EXISTIR lá, o que torna impossivel forjar mesmo
    com a privada na mao (a verdade mora no banco, nao na matematica).
    """
    if not (bruto or "").strip():
        return ""  # sem codigo = versao simples, nao e erro

    codigo = normalizar_codigo(bruto)
    if not formato_de_codigo(codigo):
        return "codigo de ativacao invalido"

    linha = con.execute("SELECT conta_id, serie, revogada FROM licencas WHERE codigo = ?",
                        (codigo,)).fetchone()
    if not linha:
        return "codigo de ativacao invalido"
    if linha["revogada"]:
        return "este codigo foi cancelado; fale com o suporte"

    # UMA chave, UMA conta. Sem isto, um codigo vazado ativaria contas sem limite
    # e nao haveria como saber qual delas e a legitima.
    if linha["conta_id"] and linha["conta_id"] != conta_id:
        return "este codigo ja esta vinculado a outra conta"
    if not linha["conta_id"]:
        # Chave vendida fora do launcher: o primeiro a vincular vira dono.
        con.execute("UPDATE licencas SET conta_id = ? WHERE codigo = ?", (conta_id, codigo))

    con.execute("UPDATE contas SET ativado = 1, licenca_serie = ? WHERE id = ?",
                (linha["serie"], conta_id))
    return ""


def codigo_da_conta(con, conta_id: int) -> str:
    """Chave de ativacao da conta, para o launcher repassar ao jogo.

    E o que faz a promessa "ativou uma vez, nao pede registro de novo" valer em
    QUALQUER maquina onde a pessoa entrar: a conta e que carrega o direito, e o
    codigo volta so para o dono dele.
    """
    return licenca.da_conta(con, conta_id)


# ─── Loja ─────────────────────────────────────────────────────────────────────
#
# O catalogo mora no SERVIDOR, nao no launcher. Assim da para corrigir preco ou
# tirar um item do ar sem publicar versao nova para todo mundo.
#
# `preco_cents` em centavos e inteiro: dinheiro em ponto flutuante acumula erro.
#
# ⚠️ SO ENTRA AQUI O QUE O PRODUTO REALMENTE ENTREGA.
#
# Isto ja falhou uma vez: o catalogo tinha "temas exclusivos" e "verba extra"
# que NAO faziam nada. Os 20 temas ja sao livres para todo mundo no launcher, e
# nenhuma parte do jogo lia a verba comprada — a compra so gravava uma linha no
# extrato. Foram removidos.
#
# Antes de adicionar item novo, responda: onde esta o codigo que ENTREGA isso?
# Se a resposta for "vou fazer depois", o item nao entra.
CATALOGO = [
    # PRIMEIRO ITEM: o registro do jogo. E o que a pessoa vem comprar; deixar
    # tema na frente de licenca inverte a prioridade da vitrine.
    {"id": "registro", "nome": "Registro do Ultrafoot 26", "tipo": "registro",
     "descricao": "Libera a versao completa do jogo, para sempre, em qualquer computador "
                  "onde voce entrar na sua conta. A chave e emitida na hora do pagamento.",
     "preco_cents": 3000, "carga": {}},
]

CATALOGO_POR_ID = {item["id"]: item for item in CATALOGO}


def saldo_da_conta(con, conta_id: int) -> int:
    linha = con.execute("SELECT saldo_cents FROM carteira WHERE conta_id = ?",
                        (conta_id,)).fetchone()
    return int(linha["saldo_cents"]) if linha else 0


def creditar(con, conta_id: int, valor_cents: int, origem: str, id_externo: str = "") -> bool:
    """Credita a carteira. Devolve False se este `id_externo` ja foi creditado."""
    if valor_cents <= 0:
        return False
    agora = int(time.time())
    if id_externo:
        ja = con.execute("SELECT 1 FROM creditos WHERE id_externo = ?", (id_externo,)).fetchone()
        if ja:
            return False
    con.execute("INSERT INTO creditos (conta_id, valor_cents, origem, quando, id_externo)"
                " VALUES (?,?,?,?,?)",
                (conta_id, valor_cents, origem[:80], agora, id_externo or None))
    con.execute("INSERT INTO carteira (conta_id, saldo_cents, atualizado_em) VALUES (?,?,?)"
                " ON CONFLICT(conta_id) DO UPDATE SET"
                " saldo_cents = saldo_cents + excluded.saldo_cents,"
                " atualizado_em = excluded.atualizado_em",
                (conta_id, valor_cents, agora))
    return True


# ─── Emissao de chave de registro ─────────────────────────────────────────────
#
# O servidor CONSEGUE emitir chaves porque tem o mesmo segredo que as valida.
# E o que permite vender o registro na loja e entregar na hora, sem ninguem
# despachar codigo a mao.
#
# ETAPA 6: o esquema de serie+lote saiu junto com o HMAC. Nao existe mais "lote
# reservado" a proteger — o codigo passou a ser um identificador ALEATORIO de 75
# bits sorteado com `secrets`, entao duas emissoes nunca colidem por construcao,
# venham de onde vierem. `montar_codigo()` e `series_emitidas` deixaram de
# existir; quem emite e `licenca.emitir()`.


def emitir_codigo_para(con, conta_id: int) -> str:
    """Emite (ou reaproveita) a chave de registro desta conta.

    Reaproveitar importa: se a pessoa comprar de novo por engano, ou se a
    entrega for repetida por um webhook duplicado, ela precisa continuar com A
    MESMA chave — duas chaves para a mesma conta viram suporte no dia seguinte.
    A idempotencia agora mora em `licenca.emitir()`.
    """
    codigo = licenca.emitir(con, conta_id)
    ativar_conta(con, conta_id, codigo)
    return codigo


# ─── Asaas (pagamento) ────────────────────────────────────────────────────────
#
# O token da API fica SO no servidor. Nunca no launcher: com ele se emite
# cobranca e se consulta cliente da conta inteira.
#
# A entrega NAO acontece quando o cliente diz que pagou — acontece quando o ASAAS
# avisa, pelo webhook. Confiar no cliente aqui e entregar produto de graca para
# quem souber chamar a rota.

ASAAS_TOKEN = os.environ.get("ULTRAFOOT_ASAAS_TOKEN", "")
# Sandbox enquanto nao houver conta de producao. Trocar por
# https://api.asaas.com/v3 quando for cobrar de verdade.
ASAAS_BASE = os.environ.get("ULTRAFOOT_ASAAS_BASE", "https://api-sandbox.asaas.com/v3")
# Segredo combinado com o Asaas no cadastro do webhook. Sem ele, qualquer um que
# descubra a URL "confirma" pagamentos e leva produto sem pagar.
ASAAS_WEBHOOK_TOKEN = os.environ.get("ULTRAFOOT_ASAAS_WEBHOOK_TOKEN", "")


def asaas(rota: str, corpo: dict | None = None, metodo: str = "GET") -> dict | None:
    if not ASAAS_TOKEN:
        return None
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(f"{ASAAS_BASE}{rota}", data=dados, method=metodo)
    req.add_header("access_token", ASAAS_TOKEN)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception as e:
        detalhe = ""
        try:
            detalhe = e.read().decode("utf-8", "replace")[:300]  # type: ignore[attr-defined]
        except Exception:
            detalhe = repr(e)
        print(f"[asaas] {metodo} {rota} falhou: {detalhe}", file=sys.stderr, flush=True)
        return None


def cliente_asaas(con, conta) -> str | None:
    """Id do cliente no Asaas, criando na primeira compra."""
    if conta["asaas_cliente"]:
        return conta["asaas_cliente"]
    criado = asaas("/customers", {
        "name": conta["nome"] or conta["email"].split("@")[0],
        "email": conta["email"],
        # `externalReference` deixa o painel do Asaas apontar de volta para a
        # conta certa — sem isso, conciliar pagamento com jogador vira garimpo.
        "externalReference": f"conta:{conta['id']}",
        **({"mobilePhone": re.sub(r"[^0-9]", "", conta["telefone"])} if conta["telefone"] else {}),
    }, "POST")
    if not criado or not criado.get("id"):
        return None
    con.execute("UPDATE contas SET asaas_cliente = ? WHERE id = ?", (criado["id"], conta["id"]))
    return criado["id"]


# ─── Senha ────────────────────────────────────────────────────────────────────
#
# scrypt com n=2**15: cerca de 100ms por verificacao em CPU de VPS. Devagar de
# proposito — e o que torna forca bruta cara. Se ficar lento demais sob carga,
# baixe `n`, NUNCA remova o hash.

def hash_senha(senha: str, salt: bytes) -> str:
    # `maxmem` e OBRIGATORIO aqui. O scrypt precisa de 128*n*r bytes — com
    # n=2**15 e r=8 dao exatamente 32 MiB, e o limite padrao do OpenSSL e
    # justamente 32 MiB, entao a chamada estoura com "memory limit exceeded" e
    # NENHUM registro ou login funciona. Damos folga de 2x.
    return hashlib.scrypt(
        senha.encode("utf-8"), salt=salt, n=2**15, r=8, p=1, dklen=32,
        maxmem=64 * 1024 * 1024,
    ).hex()


def normalizar_email(email: str) -> str:
    return (email or "").strip().lower()


def migrar_licenca(con: sqlite3.Connection, conta_id: int, codigo: str) -> None:
    """Vincula um codigo serial ja usado na maquina do jogador a esta conta.

    ⚠️ REGRA QUE NAO PODE QUEBRAR: quem ja pagou NAO PODE perder o registro ao
    criar conta. O launcher envia o codigo que encontrou na maquina e aqui ele
    passa a pertencer a esta conta.

    O INSERT e idempotente e nao rouba: `codigo` e chave primaria, entao se ele
    ja estiver vinculado a OUTRA conta o insert e ignorado — o dono original
    continua dono. Sem isso, alguem poderia digitar o codigo alheio e assumir a
    licenca.

    ETAPA 6: `licencas_migradas` e a tabela do esquema ANTIGO e continua aqui de
    proposito. E o registro de quem tinha chave HMAC na maquina — a materia-prima
    da reemissao (`reemitir-licencas.py`) e a rede de protecao do suporte para
    quem comprou e nunca criou conta. Apagar isto perderia o historico de vendas
    que ainda nao migrou.
    """
    codigo = (codigo or "").strip().upper()
    if not codigo:
        return
    con.execute(
        "INSERT OR IGNORE INTO licencas_migradas (codigo, conta_id, migrada_em) VALUES (?,?,?)",
        (codigo, conta_id, int(time.time())),
    )


# ─── Sessao ───────────────────────────────────────────────────────────────────

def novo_token() -> tuple[str, str]:
    """Devolve (token_claro, token_hash). O claro so existe nesta resposta."""
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode()).hexdigest()


def criar_sessao(con: sqlite3.Connection, conta_id: int, dispositivo: str) -> str:
    token, token_hash = novo_token()
    agora = int(time.time())
    con.execute(
        "INSERT INTO sessoes (token_hash, conta_id, criada_em, expira_em, dispositivo)"
        " VALUES (?,?,?,?,?)",
        (token_hash, conta_id, agora, agora + SESSAO_DIAS * 86400, dispositivo[:120]),
    )
    con.execute("UPDATE contas SET ultimo_login = ? WHERE id = ?", (agora, conta_id))
    return token


def conta_da_sessao(con: sqlite3.Connection, token: str) -> sqlite3.Row | None:
    if not token:
        return None
    th = hashlib.sha256(token.encode()).hexdigest()
    linha = con.execute(
        "SELECT c.* FROM sessoes s JOIN contas c ON c.id = s.conta_id"
        " WHERE s.token_hash = ? AND s.expira_em > ?",
        (th, int(time.time())),
    ).fetchone()
    if linha and linha["bloqueada"]:
        return None

    # JANELA DESLIZANTE — "entrou uma vez, continua entrado".
    #
    # Com prazo fixo a sessao morria 30 dias depois do login e o jogador tinha de
    # digitar a senha de novo sem entender por que. Cada uso empurra o prazo para
    # frente; so quem some por 30 dias inteiros precisa entrar outra vez. O
    # `expira_em` continua existindo porque uma sessao eterna nao teria como ser
    # descartada de um aparelho perdido.
    if linha:
        agora = int(time.time())
        novo = agora + SESSAO_DIAS * 86400
        # Grava so quando falta menos de um dia do que ja esta la: sem isso seria
        # um UPDATE em toda requisicao, inclusive nas de leitura.
        con.execute(
            "UPDATE sessoes SET expira_em = ? WHERE token_hash = ? AND expira_em < ?",
            (novo, th, novo - 86400),
        )
    return linha


# ─── Limite de tentativas ─────────────────────────────────────────────────────

def excedeu_tentativas(con: sqlite3.Connection, chave: str) -> bool:
    corte = int(time.time()) - TENTATIVAS_JANELA
    con.execute("DELETE FROM tentativas WHERE quando < ?", (corte,))
    n = con.execute("SELECT COUNT(*) n FROM tentativas WHERE chave = ?", (chave,)).fetchone()["n"]
    return n >= TENTATIVAS_MAX


def registrar_tentativa(con: sqlite3.Connection, chave: str) -> None:
    con.execute("INSERT INTO tentativas (chave, quando) VALUES (?,?)", (chave, int(time.time())))


# ─── Google (PKCE) ────────────────────────────────────────────────────────────
#
# O launcher abre o navegador, recebe o `code` num servidor local e manda para
# ca junto do `code_verifier`. Quem troca o codigo por token e o SERVIDOR — o
# launcher nunca ve credencial de troca. Cliente Desktop nao usa client_secret
# no PKCE, por isso ele nao aparece aqui.

def trocar_codigo_google(code: str, verifier: str, redirect_uri: str) -> dict | None:
    if not GOOGLE_CLIENT_ID:
        return None
    campos = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "code_verifier": verifier,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    if GOOGLE_CLIENT_SECRET:
        campos["client_secret"] = GOOGLE_CLIENT_SECRET
    dados = urllib.parse.urlencode(campos).encode()
    try:
        req = urllib.request.Request(GOOGLE_TOKEN_URL, data=dados,
                                     headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=15) as r:
            token = json.loads(r.read())
    except Exception as e:
        # O motivo REAL fica so no log do servidor. Devolver ao cliente entregaria
        # detalhe de configuracao a quem nao precisa. Sem isto, a falha do Google
        # some e o unico sintoma e "nao foi possivel validar" — foi o que ocorreu.
        detalhe = ""
        try:
            detalhe = e.read().decode("utf-8", "replace")[:300]  # type: ignore[attr-defined]
        except Exception:
            detalhe = repr(e)
        print(f"[google] troca de codigo falhou: {detalhe}", file=sys.stderr, flush=True)
        return None

    # O id_token e um JWT assinado pelo Google. Aqui lemos o payload para pegar
    # sub/email. A CONFIANCA vem de o token ter chegado direto do endpoint do
    # Google por HTTPS nesta mesma requisicao — nao de dado enviado pelo cliente.
    id_token = token.get("id_token", "")
    partes = id_token.split(".")
    if len(partes) != 3:
        return None
    payload = partes[1] + "=" * (-len(partes[1]) % 4)
    try:
        info = json.loads(__import__("base64").urlsafe_b64decode(payload))
    except Exception:
        return None
    if info.get("aud") != GOOGLE_CLIENT_ID or not info.get("sub"):
        return None
    return info


# ─── HTTP ─────────────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    server_version = "ultrafoot-auth"

    def log_message(self, *_):  # silencia log por requisicao
        pass

    def _cors(self) -> None:
        """Cabecalhos de CORS.

        O launcher roda numa WEBVIEW, cuja origem e `tauri.localhost` (ou
        `http://localhost` em dev) — nunca o dominio deste servidor. Sem estes
        cabecalhos o navegador bloqueia a chamada ANTES de sair da maquina e o
        cliente ve apenas "failed to fetch", sem pista do motivo.

        Liberamos qualquer origem porque nao ha cookie nem credencial de
        navegador em jogo: a autenticacao viaja no header Authorization, que o
        atacante teria de possuir de antemao. Se um dia usarmos cookies, isto
        PRECISA virar uma lista fechada de origens.
        """
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self):
        # Preflight: o navegador pergunta antes de mandar POST com JSON.
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _responder(self, codigo: int, corpo: dict) -> None:
        dado = json.dumps(corpo).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(dado)))
        self.end_headers()
        self.wfile.write(dado)

    def _corpo(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY:
            return {}
        try:
            return json.loads(self.rfile.read(n))
        except Exception:
            return {}

    def _token(self) -> str:
        auth = self.headers.get("Authorization") or ""
        return auth[7:].strip() if auth.startswith("Bearer ") else ""

    def _ip(self) -> str:
        return self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()

    # ── GET ──
    def do_GET(self):
        if self.path == "/health":
            return self._responder(200, {"ok": True, "service": "ultrafoot-auth"})
        if self.path == "/loja":
            with conectar() as con:
                conta = conta_da_sessao(con, self._token())
                if not conta:
                    return self._responder(401, {"erro": "sessao invalida"})
                meus = con.execute(
                    "SELECT produto, valor_cents, criada_em FROM compras"
                    " WHERE conta_id = ? AND estorno_de IS NULL ORDER BY criada_em DESC",
                    (conta["id"],)).fetchall()
                pendentes = con.execute(
                    "SELECT id, produto, valor_cents, criado_em FROM pedidos"
                    " WHERE conta_id = ? AND status = 'pendente' ORDER BY criado_em DESC LIMIT 5",
                    (conta["id"],)).fetchall()
                return self._responder(200, {
                    "catalogo": CATALOGO,
                    "saldo_cents": saldo_da_conta(con, conta["id"]),
                    "meus_itens": [dict(m) for m in meus],
                    "pedidos_pendentes": [dict(p) for p in pendentes],
                    "ativado": bool(conta["ativado"]),
                    "pagamento_ligado": bool(ASAAS_TOKEN),
                })
        if self.path.split("?")[0] == "/hub/chat":
            return self._chat_ler()
        if self.path == "/saves":
            with conectar() as con:
                conta = conta_da_sessao(con, self._token())
                if not conta:
                    return self._responder(401, {"erro": "sessao invalida"})
                linhas = con.execute(
                    "SELECT codigo, rotulo, criado_em, atualizado_em FROM saves_da_conta"
                    " WHERE conta_id = ? ORDER BY atualizado_em DESC LIMIT 50",
                    (conta["id"],)).fetchall()
                return self._responder(200, {"saves": [dict(l) for l in linhas]})
        if self.path == "/me":
            with conectar() as con:
                conta = conta_da_sessao(con, self._token())
                if not conta:
                    return self._responder(401, {"erro": "sessao invalida"})
                compras = con.execute(
                    "SELECT produto, valor_cents, moeda, criada_em FROM compras"
                    " WHERE conta_id = ? AND estorno_de IS NULL ORDER BY criada_em DESC",
                    (conta["id"],),
                ).fetchall()
                return self._responder(200, {
                    "id": conta["id"], "email": conta["email"], "nome": conta["nome"],
                    "telefone": conta["telefone"], "ativado": bool(conta["ativado"]),
                    # O launcher usa isto so para MOSTRAR o atalho do painel. Quem
                    # autoriza de verdade continua sendo o servidor, em cada rota
                    # /admin/*: esconder o botao nunca foi controle de acesso.
                    "admin": bool(conta["admin"]),
                    "codigo_ativacao": codigo_da_conta(con, conta["id"]),
                    "compras": [dict(c) for c in compras],
                })
        return self._responder(404, {"erro": "nao encontrado"})

    # ── POST ──
    def do_POST(self):
        rota = self.path.split("?")[0]
        corpo = self._corpo()

        if rota == "/registrar":
            return self._registrar(corpo)
        if rota == "/login":
            return self._login(corpo)
        if rota == "/google":
            return self._google(corpo)
        if rota == "/loja/pagar":
            return self._pagar(corpo)
        if rota == "/asaas/webhook":
            return self._webhook_asaas(corpo)
        if rota == "/loja/comprar":
            return self._comprar(corpo)
        if rota == "/hub/presenca":
            return self._presenca(corpo)
        if rota == "/hub/chat":
            return self._chat_enviar(corpo)
        if rota == "/saves/registrar":
            return self._registrar_save(corpo)
        if rota == "/saves/esquecer":
            return self._esquecer_save(corpo)
        if rota == "/ativar":
            return self._ativar(corpo)
        if rota == "/licenca/ativar":
            return self._licenca_ativar(corpo)
        if rota == "/licenca/minha":
            return self._licenca_minha(corpo)
        if rota.startswith("/admin/"):
            return self._admin(rota, corpo)
        if rota == "/sair":
            with conectar() as con:
                th = hashlib.sha256(self._token().encode()).hexdigest()
                con.execute("DELETE FROM sessoes WHERE token_hash = ?", (th,))
            return self._responder(200, {"ok": True})
        return self._responder(404, {"erro": "nao encontrado"})

    def _registrar(self, corpo: dict):
        email = normalizar_email(corpo.get("email", ""))
        senha = corpo.get("senha") or ""
        nome = (corpo.get("nome") or "").strip()[:80]
        telefone = re.sub(r"[^0-9+() -]", "", (corpo.get("telefone") or "").strip())[:24]
        codigo = (corpo.get("codigo_ativacao") or "").strip()
        if not EMAIL_RE.match(email):
            return self._responder(400, {"erro": "email invalido"})
        if len(senha) < 8:
            return self._responder(400, {"erro": "a senha precisa de ao menos 8 caracteres"})

        # Um codigo ERRADO nao pode criar a conta e so avisar depois: a pessoa
        # ficaria com conta sem ativacao e sem entender por que. Conferimos antes.
        #
        # So o FORMATO aqui: a validade sai do banco, dentro de `ativar_conta`, e
        # repetir a consulta antes do INSERT seria ida a mais ao banco sem ganho
        # (o rollback logo abaixo ja cobre o codigo que nao existe).
        if codigo and not formato_de_codigo(codigo):
            return self._responder(400, {"erro": "codigo de ativacao invalido"})

        salt = secrets.token_bytes(16)
        with conectar() as con:
            try:
                cur = con.execute(
                    "INSERT INTO contas (email, nome, telefone, senha_hash, senha_salt, criada_em)"
                    " VALUES (?,?,?,?,?,?)",
                    (email, nome, telefone, hash_senha(senha, salt), salt.hex(), int(time.time())),
                )
            except sqlite3.IntegrityError:
                # Nao confirmamos que o email existe: so um erro generico.
                return self._responder(409, {"erro": "nao foi possivel criar a conta"})
            conta_id = cur.lastrowid
            erro = ativar_conta(con, conta_id, codigo)
            if erro:
                # Desfaz a criacao inteira. O unico erro possivel aqui e "codigo
                # ja vinculado a outra conta", e criar a conta assim mesmo daria a
                # impressao de que a chave foi aceita.
                con.rollback()
                return self._responder(409, {"erro": erro})
            migrar_licenca(con, conta_id, corpo.get("codigo_registro", ""))
            token = criar_sessao(con, conta_id, corpo.get("dispositivo", ""))
            ativado = bool(con.execute("SELECT ativado FROM contas WHERE id = ?",
                                       (conta_id,)).fetchone()["ativado"])
        return self._responder(201, {"token": token, "email": email, "nome": nome,
                                     "ativado": ativado, "codigo_ativacao": codigo if ativado else ""})

    def _pagar(self, corpo: dict):
        """Cria a cobranca Pix no Asaas e devolve o QR/link para o jogador.

        NAO entrega nada aqui. A entrega acontece no webhook, quando o Asaas
        confirma o recebimento — confiar no cliente dizer "paguei" e entregar de
        graca para quem souber chamar a rota.
        """
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})
            if not ASAAS_TOKEN:
                return self._responder(503, {
                    "erro": "o pagamento ainda nao esta configurado neste servidor",
                })

            item = CATALOGO_POR_ID.get(corpo.get("produto") or "")
            if not item:
                return self._responder(404, {"erro": "item nao encontrado"})
            if item["id"] == "registro" and conta["ativado"]:
                return self._responder(409, {"erro": "sua conta ja esta registrada"})

            cliente = cliente_asaas(con, conta)
            if not cliente:
                return self._responder(502, {"erro": "nao consegui falar com o Asaas agora"})

            agora = int(time.time())
            cur = con.execute(
                "INSERT INTO pedidos (conta_id, produto, valor_cents, status, criado_em)"
                " VALUES (?,?,?,?,?)",
                (conta["id"], item["id"], item["preco_cents"], "pendente", agora))
            pedido_id = cur.lastrowid

            cobranca = asaas("/payments", {
                "customer": cliente,
                "billingType": corpo.get("forma") if corpo.get("forma") in
                    ("PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED") else "PIX",
                "value": round(item["preco_cents"] / 100, 2),
                # Vencimento hoje: Pix nao espera, e boleto com prazo longo deixa
                # pedido pendente ocupando a fila por dias.
                "dueDate": time.strftime("%Y-%m-%d", time.gmtime(agora + 86400)),
                "description": f"Ultrafoot 26 — {item['nome']}",
                # Amarra a cobranca ao PEDIDO, nao a conta: e o pedido que diz
                # qual produto entregar quando o webhook chegar.
                "externalReference": f"pedido:{pedido_id}",
            }, "POST")

            if not cobranca or not cobranca.get("id"):
                con.execute("UPDATE pedidos SET status = 'falhou' WHERE id = ?", (pedido_id,))
                return self._responder(502, {"erro": "nao consegui gerar a cobranca"})

            con.execute("UPDATE pedidos SET asaas_id = ? WHERE id = ?",
                        (cobranca["id"], pedido_id))

            pix = asaas(f"/payments/{cobranca['id']}/pixQrCode") or {}
        return self._responder(201, {
            "pedido": pedido_id,
            "cobranca": cobranca["id"],
            "link": cobranca.get("invoiceUrl"),
            "pix_copia_e_cola": pix.get("payload"),
            "pix_qr_base64": pix.get("encodedImage"),
            "valor_cents": item["preco_cents"],
        })

    def _entregar_pedido(self, con, pedido) -> None:
        """Entrega o produto de um pedido pago. Idempotente de proposito.

        O Asaas reenvia webhook quando nao recebe 200 — sem essa protecao, uma
        falha de rede vira registro emitido duas vezes ou saldo creditado em
        dobro.
        """
        if pedido["status"] == "entregue":
            return
        item = CATALOGO_POR_ID.get(pedido["produto"])
        agora = int(time.time())

        if item and item["tipo"] == "registro":
            # ETAPA 6: emissao unica agora — `emitir_codigo_para` delega a
            # `licenca.emitir`. A emissao dupla (HMAC + Ed25519) existia so para a
            # transicao e saiu junto com o esquema antigo.
            #
            # Falhar aqui NAO pode derrubar a entrega: o pagamento ja aconteceu.
            # O pedido fica como pago-e-nao-entregue e o webhook do Asaas tenta de
            # novo; sumir com o dinheiro do jogador seria pior.
            try:
                emitir_codigo_para(con, pedido["conta_id"])
            except Exception as e:  # pragma: no cover - defesa de entrega
                print(f"[licenca] falha ao emitir para conta {pedido['conta_id']}: {e}",
                      file=sys.stderr)
                return
        elif item and item["tipo"] in ("tema_launcher", "verba"):
            # Estes ja sao itens de catalogo: registramos a compra do mesmo jeito
            # que a compra por saldo, para o extrato ficar unico.
            con.execute("INSERT INTO compras (conta_id, produto, valor_cents, moeda, criada_em)"
                        " VALUES (?,?,?,?,?)",
                        (pedido["conta_id"], pedido["produto"], pedido["valor_cents"], "BRL", agora))
        else:
            # Produto desconhecido (catalogo mudou depois do pedido): credita o
            # valor na carteira em vez de sumir com o dinheiro do jogador.
            creditar(con, pedido["conta_id"], pedido["valor_cents"],
                     f"pedido {pedido['id']} sem produto", f"pedido:{pedido['id']}")

        con.execute("UPDATE pedidos SET status = 'entregue', entregue_em = ? WHERE id = ?",
                    (agora, pedido["id"]))

    def _webhook_asaas(self, corpo: dict):
        """Confirmacao de pagamento vinda do Asaas.

        A autenticacao e o token combinado no cadastro do webhook. Sem ele,
        qualquer um que descubra a URL "confirma" pagamentos e leva produto de
        graca — por isso a rota recusa quando o token nao esta configurado, em
        vez de aceitar tudo.
        """
        enviado = self.headers.get("asaas-access-token", "")
        if not ASAAS_WEBHOOK_TOKEN or not hmac.compare_digest(enviado, ASAAS_WEBHOOK_TOKEN):
            return self._responder(401, {"erro": "nao autorizado"})

        evento = corpo.get("event") or ""
        pagamento = corpo.get("payment") or {}
        asaas_id = pagamento.get("id") or ""

        # Só estes dois significam dinheiro na conta. `PAYMENT_CREATED` e afins
        # chegam antes de qualquer pagamento acontecer.
        if evento not in ("PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"):
            return self._responder(200, {"ok": True, "ignorado": evento})

        with conectar() as con:
            pedido = con.execute("SELECT * FROM pedidos WHERE asaas_id = ?", (asaas_id,)).fetchone()
            if not pedido:
                # 200 de proposito: sem o pedido nao ha o que fazer, e devolver
                # erro faria o Asaas reenviar para sempre.
                print(f"[asaas] webhook sem pedido correspondente: {asaas_id}",
                      file=sys.stderr, flush=True)
                return self._responder(200, {"ok": True, "sem_pedido": True})
            self._entregar_pedido(con, pedido)
        return self._responder(200, {"ok": True})

    def _comprar(self, corpo: dict):
        """Compra um item da loja gastando o saldo da carteira.

        Saldo conferido e debitado na MESMA transacao da compra: separar as duas
        coisas abriria a janela classica de gastar o mesmo saldo duas vezes com
        dois cliques rapidos.
        """
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})

            item = CATALOGO_POR_ID.get(corpo.get("produto") or "")
            if not item:
                return self._responder(404, {"erro": "item nao encontrado"})

            # Item de tema e permanente: comprar de novo so tiraria dinheiro.
            if item["tipo"] == "tema_launcher":
                ja_tem = con.execute(
                    "SELECT 1 FROM compras WHERE conta_id = ? AND produto = ? AND estorno_de IS NULL",
                    (conta["id"], item["id"])).fetchone()
                if ja_tem:
                    return self._responder(409, {"erro": "voce ja tem este item"})

            saldo = saldo_da_conta(con, conta["id"])
            if saldo < item["preco_cents"]:
                return self._responder(402, {
                    "erro": "saldo insuficiente",
                    "saldo_cents": saldo,
                    "preco_cents": item["preco_cents"],
                })

            agora = int(time.time())
            con.execute("UPDATE carteira SET saldo_cents = saldo_cents - ?, atualizado_em = ?"
                        " WHERE conta_id = ?", (item["preco_cents"], agora, conta["id"]))
            con.execute("INSERT INTO compras (conta_id, produto, valor_cents, moeda, criada_em)"
                        " VALUES (?,?,?,?,?)",
                        (conta["id"], item["id"], item["preco_cents"], "BRL", agora))
            novo_saldo = saldo_da_conta(con, conta["id"])
        return self._responder(201, {"ok": True, "produto": item["id"], "saldo_cents": novo_saldo})

    # ── FC Hub: presenca e chat ──
    #
    # Quem esta online sai da tabela `presenca`, alimentada por batida do proprio
    # jogo. Nao existe rota de "sair": fechar o jogo no tapa nunca a chamaria, e
    # a lista ficaria cheia de fantasma. Some sozinho quem para de bater.
    def _presenca(self, corpo: dict):
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})
            agora = int(time.time())
            nome = (corpo.get("nome") or conta["nome"] or conta["email"].split("@")[0])[:40]
            clube = (corpo.get("clube") or "")[:40]
            situacao = (corpo.get("situacao") or "")[:60]
            con.execute(
                "INSERT INTO presenca (conta_id, nome, clube, situacao, visto_em)"
                " VALUES (?,?,?,?,?)"
                " ON CONFLICT(conta_id) DO UPDATE SET nome=excluded.nome, clube=excluded.clube,"
                " situacao=excluded.situacao, visto_em=excluded.visto_em",
                (conta["id"], nome, clube, situacao, agora))

            corte = agora - PRESENCA_JANELA
            # Limpa o que envelheceu aqui mesmo: sem isso a tabela so cresce e a
            # consulta abaixo teria de filtrar uma lista cada vez maior.
            con.execute("DELETE FROM presenca WHERE visto_em < ?", (agora - 3600,))
            linhas = con.execute(
                "SELECT p.conta_id, p.nome, p.clube, p.situacao, p.visto_em"
                " FROM presenca p JOIN contas c ON c.id = p.conta_id"
                " WHERE p.visto_em >= ? AND c.bloqueada = 0"
                " ORDER BY p.visto_em DESC LIMIT 200",
                (corte,)).fetchall()
        return self._responder(200, {
            "eu": conta["id"],
            "online": [dict(l) for l in linhas],
        })

    def _chat_enviar(self, corpo: dict):
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})
            texto = (corpo.get("texto") or "").strip()[:300]
            if not texto:
                return self._responder(400, {"erro": "mensagem vazia"})
            agora = int(time.time())

            # Um intervalo minimo entre mensagens da MESMA conta. Sem isso, uma
            # pessoa sozinha empurra o chat inteiro para fora da tela.
            ultima = con.execute(
                "SELECT quando FROM chat WHERE conta_id = ? ORDER BY id DESC LIMIT 1",
                (conta["id"],)).fetchone()
            if ultima and agora - ultima["quando"] < CHAT_INTERVALO:
                return self._responder(429, {"erro": "espere um instante antes de enviar de novo"})

            nome = (conta["nome"] or conta["email"].split("@")[0])[:40]
            con.execute("INSERT INTO chat (conta_id, nome, texto, quando) VALUES (?,?,?,?)",
                        (conta["id"], nome, texto, agora))
            # Mantem so as ultimas mensagens: e conversa de saguao, nao arquivo.
            con.execute(
                "DELETE FROM chat WHERE id <= (SELECT MAX(id) - ? FROM chat)",
                (CHAT_LIMITE,))
        return self._responder(201, {"ok": True})

    def _chat_ler(self):
        parametros = urllib.parse.parse_qs(self.path.split("?", 1)[1] if "?" in self.path else "")
        try:
            desde = int(parametros.get("desde", ["0"])[0])
        except ValueError:
            desde = 0
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})
            linhas = con.execute(
                "SELECT id, conta_id, nome, texto, quando FROM chat WHERE id > ?"
                " ORDER BY id DESC LIMIT 60", (desde,)).fetchall()
        # Devolvemos em ordem cronologica: quem consome so anexa no fim da lista.
        return self._responder(200, {"mensagens": [dict(l) for l in reversed(linhas)]})

    # ── Catalogo de saves da conta ──
    #
    # O save NAO passa por aqui — quem guarda o conteudo e o cloud-save-server.
    # Este servico so anota "o codigo X e da conta Y", que e o que permite
    # recuperar tudo depois de uma formatacao.
    def _registrar_save(self, corpo: dict):
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})
            codigo = re.sub(r"[^A-F0-9]", "", (corpo.get("codigo") or "").upper())
            if len(codigo) != 6:
                return self._responder(400, {"erro": "codigo invalido"})
            rotulo = (corpo.get("rotulo") or "").strip()[:80]
            agora = int(time.time())

            dono = con.execute("SELECT conta_id FROM saves_da_conta WHERE codigo = ?",
                               (codigo,)).fetchone()
            if dono and dono["conta_id"] != conta["id"]:
                # Um codigo de 6 hex e adivinhavel por forca bruta; deixar
                # reivindicar o de outra pessoa entregaria a carreira dela.
                return self._responder(409, {"erro": "este codigo pertence a outra conta"})
            if dono:
                con.execute("UPDATE saves_da_conta SET rotulo = ?, atualizado_em = ?"
                            " WHERE codigo = ?", (rotulo or "", agora, codigo))
            else:
                con.execute("INSERT INTO saves_da_conta (codigo, conta_id, rotulo, criado_em,"
                            " atualizado_em) VALUES (?,?,?,?,?)",
                            (codigo, conta["id"], rotulo, agora, agora))
        return self._responder(200, {"ok": True, "codigo": codigo})

    def _esquecer_save(self, corpo: dict):
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})
            codigo = re.sub(r"[^A-F0-9]", "", (corpo.get("codigo") or "").upper())
            # Some so do catalogo. O save continua no cloud-save-server: apagar
            # de verdade a partir de uma lista e caminho curto para perda de dado.
            con.execute("DELETE FROM saves_da_conta WHERE codigo = ? AND conta_id = ?",
                        (codigo, conta["id"]))
        return self._responder(200, {"ok": True})

    def _ativar(self, corpo: dict):
        """Ativa a versao completa depois, para quem criou a conta sem codigo."""
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})
            codigo = (corpo.get("codigo_ativacao") or "").strip()
            if not codigo:
                return self._responder(400, {"erro": "informe o codigo de ativacao"})
            erro = ativar_conta(con, conta["id"], codigo)
            if erro:
                return self._responder(400, {"erro": erro})
        return self._responder(200, {"ok": True, "ativado": True,
                                     "codigo_ativacao": normalizar_codigo(codigo)})

    def _login(self, corpo: dict):
        email = normalizar_email(corpo.get("email", ""))
        senha = corpo.get("senha") or ""
        chave = f"{email}|{self._ip()}"
        generico = {"erro": "email ou senha invalidos"}

        with conectar() as con:
            if excedeu_tentativas(con, chave):
                return self._responder(429, {"erro": "muitas tentativas; tente em alguns minutos"})
            conta = con.execute("SELECT * FROM contas WHERE email = ?", (email,)).fetchone()

            # Mesmo sem conta, gastamos tempo parecido: senao o tempo de resposta
            # revela quais emails existem.
            salt = bytes.fromhex(conta["senha_salt"]) if conta and conta["senha_salt"] else secrets.token_bytes(16)
            calculado = hash_senha(senha, salt)
            guardado = conta["senha_hash"] if conta and conta["senha_hash"] else calculado[::-1]

            if not conta or conta["bloqueada"] or not hmac.compare_digest(calculado, guardado):
                registrar_tentativa(con, chave)
                return self._responder(401, generico)

            con.execute("DELETE FROM tentativas WHERE chave = ?", (chave,))
            migrar_licenca(con, conta["id"], corpo.get("codigo_registro", ""))
            token = criar_sessao(con, conta["id"], corpo.get("dispositivo", ""))
            ativado = bool(conta["ativado"])
            codigo_ativacao = codigo_da_conta(con, conta["id"])
        return self._responder(200, {"token": token, "email": conta["email"], "nome": conta["nome"],
                                     "ativado": ativado, "codigo_ativacao": codigo_ativacao})

    # ── Licenca Ed25519 ──
    #
    # Fluxo novo (docs/plano-licenca-ed25519.md): o codigo vendido e um
    # identificador ALEATORIO conferido na tabela `licencas`; o servidor devolve
    # um certificado assinado com a chave privada, e o jogo confere OFFLINE com a
    # publica embutida no binario (src-tauri/src/licenca.rs).
    #
    # Convive de proposito com o esquema HMAC antigo: enquanto a reemissao
    # (etapa 5 do plano) nao rodar, quem comprou com chave antiga ainda depende
    # dela. Remover o esquema velho antes disso deixaria esses compradores sem
    # caminho de migracao.

    def _licenca_ativar(self, corpo: dict):
        """Primeira ativacao: confere o codigo no banco e assina o certificado.

        SEM SESSAO de proposito — quem comprou fora do launcher precisa ativar
        sem ter conta. A protecao e o proprio identificador aleatorio (2^75) mais
        o rate limit abaixo.
        """
        codigo = (corpo.get("codigo") or "").strip()
        device = (corpo.get("device") or "").strip()
        if not codigo or not device:
            return self._responder(400, {"erro": "codigo e device sao obrigatorios"})

        with conectar() as con:
            # RATE LIMIT OBRIGATORIO (§3.4 do plano). Sem ele esta rota vira
            # oraculo de forca bruta contra o espaco de chaves: da para testar
            # codigos a vontade e descobrir quais existem.
            #
            # A chave e o IP, e nao o codigo: limitar por codigo nao segura nada,
            # porque o atacante troca de codigo a cada tentativa — e ainda
            # deixaria ele travar a ativacao de um comprador legitimo de fora.
            chave = f"licenca:{self._ip()}"
            if excedeu_tentativas(con, chave):
                return self._responder(429, {"erro": "muitas tentativas; tente de novo em 15 minutos"})

            certificado, erro = licenca.ativar(con, codigo, device)
            if erro:
                # A tentativa so conta quando FALHA. Ativacao legitima repetida
                # (reinstalar o jogo) nao pode consumir a cota de ninguem.
                registrar_tentativa(con, chave)
                # 503 quando o servidor nao tem a chave configurada: e falha
                # NOSSA, nao codigo errado do jogador, e o launcher precisa
                # distinguir para nao acusar o comprador.
                if not licenca.disponivel():
                    return self._responder(503, {"erro": erro})
                return self._responder(400, {"erro": erro})

            con.execute("DELETE FROM tentativas WHERE chave = ?", (chave,))
            return self._responder(200, {"certificado": certificado})

    def _licenca_minha(self, corpo: dict):
        """Licenca da conta — recuperacao depois de formatar a maquina.

        Aqui EXIGE sessao: e a rota que devolve o codigo de quem ja comprou.
        Sem sessao, saber um email bastaria para levar a chave alheia.
        """
        with conectar() as con:
            conta = conta_da_sessao(con, self._token())
            if not conta:
                return self._responder(401, {"erro": "sessao invalida"})
            codigo = licenca.da_conta(con, conta["id"])
            if not codigo:
                return self._responder(404, {"erro": "nenhuma licenca para esta conta"})
            return self._responder(200, {"codigo": codigo})

    # ── Administracao ──
    #
    # O admin usa a MESMA sessao de qualquer conta; o que autoriza e a coluna
    # `admin`. Assim nao existe segunda senha nem token mestre para vazar, e
    # revogar o acesso e um UPDATE.
    def _admin(self, rota: str, corpo: dict):
        with conectar() as con:
            eu = conta_da_sessao(con, self._token())
            if not eu or not eu["admin"]:
                # 404, nao 403: nao confirmamos a existencia da area para quem
                # nao e admin.
                return self._responder(404, {"erro": "nao encontrado"})

            if rota == "/admin/contas":
                termo = f"%{(corpo.get('busca') or '').strip().lower()}%"
                linhas = con.execute(
                    "SELECT id, email, nome, telefone, criada_em, ultimo_login, bloqueada,"
                    "       motivo_bloqueio, bloqueada_em, admin, ativado, licenca_serie,"
                    "       (google_sub IS NOT NULL) AS via_google,"
                    "       (SELECT COUNT(*) FROM compras WHERE conta_id = contas.id"
                    "        AND estorno_de IS NULL) AS compras"
                    " FROM contas WHERE email LIKE ? OR nome LIKE ?"
                    " ORDER BY criada_em DESC LIMIT 200",
                    (termo, termo),
                ).fetchall()
                return self._responder(200, {"contas": [dict(l) for l in linhas]})

            # Estas duas agem sobre um CODIGO, nao sobre uma conta — precisam vir
            # antes da exigencia de `conta_id` logo abaixo. Chave vendida fora do
            # launcher pode nem ter conta vinculada.
            if rota == "/admin/revogar-licenca":
                codigo = (corpo.get("codigo") or "").strip()
                motivo = (corpo.get("motivo") or "").strip()[:300]
                if not codigo:
                    return self._responder(400, {"erro": "codigo ausente"})
                if not motivo:
                    # Revogacao sem motivo registrado vira mistério no suporte
                    # meses depois: ninguem lembra por que a chave foi cortada.
                    return self._responder(400, {"erro": "informe o motivo da revogacao"})
                alvo = con.execute("SELECT conta_id FROM licencas WHERE codigo = ?",
                                   (licenca.normalizar(codigo),)).fetchone()
                if not alvo:
                    return self._responder(404, {"erro": "licenca nao encontrada"})
                licenca.revogar(con, codigo, motivo)
                con.execute(
                    "INSERT INTO admin_log (admin_id, alvo_id, acao, motivo, quando)"
                    " VALUES (?,?,?,?,?)",
                    (eu["id"], alvo["conta_id"], "revogar-licenca", f"{codigo}: {motivo}",
                     int(time.time())))
                # A revogacao vale da PROXIMA ativacao em diante. Quem ja ativou
                # segue com o certificado local valendo offline — cortar isso
                # exigiria consultar o servidor a cada partida, quebrando a
                # promessa de jogar sem internet.
                return self._responder(200, {"ok": True, "ativacoes_futuras_bloqueadas": True})

            if rota == "/admin/soltar-device":
                codigo = (corpo.get("codigo") or "").strip()
                if not codigo:
                    return self._responder(400, {"erro": "codigo ausente"})
                alvo = con.execute("SELECT conta_id FROM licencas WHERE codigo = ?",
                                   (licenca.normalizar(codigo),)).fetchone()
                if not alvo:
                    return self._responder(404, {"erro": "licenca nao encontrada"})
                licenca.soltar_device(con, codigo)
                con.execute(
                    "INSERT INTO admin_log (admin_id, alvo_id, acao, motivo, quando)"
                    " VALUES (?,?,?,?,?)",
                    (eu["id"], alvo["conta_id"], "soltar-device", codigo, int(time.time())))
                return self._responder(200, {"ok": True})

            alvo_id = corpo.get("conta_id")
            if not isinstance(alvo_id, int):
                return self._responder(400, {"erro": "conta_id ausente"})
            alvo = con.execute("SELECT * FROM contas WHERE id = ?", (alvo_id,)).fetchone()
            if not alvo:
                return self._responder(404, {"erro": "conta nao encontrada"})

            if rota == "/admin/banir":
                # Um admin nao pode se banir nem banir outro admin: isso evita
                # perder o acesso administrativo por engano ou por briga interna.
                if alvo["id"] == eu["id"] or alvo["admin"]:
                    return self._responder(400, {"erro": "nao e possivel banir um administrador"})
                motivo = (corpo.get("motivo") or "").strip()[:300]
                if not motivo:
                    return self._responder(400, {"erro": "informe o motivo do banimento"})
                agora = int(time.time())
                con.execute(
                    "UPDATE contas SET bloqueada = 1, motivo_bloqueio = ?, bloqueada_em = ?"
                    " WHERE id = ?", (motivo, agora, alvo_id))
                # Derruba as sessoes abertas: banir sem isso deixaria a pessoa
                # jogando ate o token expirar, semanas depois.
                con.execute("DELETE FROM sessoes WHERE conta_id = ?", (alvo_id,))
                con.execute(
                    "INSERT INTO admin_log (admin_id, alvo_id, acao, motivo, quando)"
                    " VALUES (?,?,?,?,?)", (eu["id"], alvo_id, "banir", motivo, agora))
                return self._responder(200, {"ok": True})

            if rota == "/admin/desbanir":
                agora = int(time.time())
                con.execute(
                    "UPDATE contas SET bloqueada = 0, motivo_bloqueio = '', bloqueada_em = NULL"
                    " WHERE id = ?", (alvo_id,))
                con.execute(
                    "INSERT INTO admin_log (admin_id, alvo_id, acao, motivo, quando)"
                    " VALUES (?,?,?,?,?)", (eu["id"], alvo_id, "desbanir", "", agora))
                return self._responder(200, {"ok": True})

            if rota == "/admin/creditar":
                # ⚠️ ENQUANTO NAO HA MEIO DE PAGAMENTO, e por aqui que entra
                # saldo. Fica restrito a admin e registrado, para o extrato nunca
                # ter credito sem origem.
                valor = corpo.get("valor_cents")
                if not isinstance(valor, int) or valor <= 0:
                    return self._responder(400, {"erro": "valor_cents invalido"})
                creditar(con, alvo_id, valor, (corpo.get("motivo") or "credito manual"),
                         corpo.get("id_externo") or "")
                con.execute("INSERT INTO admin_log (admin_id, alvo_id, acao, motivo, quando)"
                            " VALUES (?,?,?,?,?)",
                            (eu["id"], alvo_id, "creditar", f"{valor} centavos", int(time.time())))
                return self._responder(200, {"ok": True, "saldo_cents": saldo_da_conta(con, alvo_id)})

            if rota == "/admin/historico":
                linhas = con.execute(
                    "SELECT l.acao, l.motivo, l.quando, a.email AS admin_email"
                    " FROM admin_log l JOIN contas a ON a.id = l.admin_id"
                    " WHERE l.alvo_id = ? ORDER BY l.quando DESC LIMIT 50", (alvo_id,)).fetchall()
                return self._responder(200, {"historico": [dict(l) for l in linhas]})

        return self._responder(404, {"erro": "nao encontrado"})

    def _google(self, corpo: dict):
        info = trocar_codigo_google(
            corpo.get("code", ""), corpo.get("code_verifier", ""), corpo.get("redirect_uri", ""),
        )
        if not info:
            return self._responder(401, {"erro": "nao foi possivel validar com o Google"})

        sub = info["sub"]
        email = normalizar_email(info.get("email", ""))
        nome = (info.get("name") or "").strip()[:80]

        with conectar() as con:
            conta = con.execute("SELECT * FROM contas WHERE google_sub = ?", (sub,)).fetchone()
            if not conta and email:
                # Mesmo email por senha e por Google = MESMA pessoa: vinculamos em
                # vez de criar conta duplicada, senao as compras ficam divididas.
                conta = con.execute("SELECT * FROM contas WHERE email = ?", (email,)).fetchone()
                if conta:
                    con.execute("UPDATE contas SET google_sub = ? WHERE id = ?", (sub, conta["id"]))
            if not conta:
                cur = con.execute(
                    "INSERT INTO contas (email, nome, google_sub, criada_em) VALUES (?,?,?,?)",
                    (email or f"{sub}@google.local", nome, sub, int(time.time())),
                )
                conta_id = cur.lastrowid
            else:
                if conta["bloqueada"]:
                    return self._responder(403, {"erro": "conta bloqueada"})
                conta_id = conta["id"]
            migrar_licenca(con, conta_id, corpo.get("codigo_registro", ""))
            token = criar_sessao(con, conta_id, corpo.get("dispositivo", ""))
            linha = con.execute("SELECT ativado FROM contas WHERE id = ?", (conta_id,)).fetchone()
            ativado = bool(linha["ativado"])
            codigo_ativacao = codigo_da_conta(con, conta_id)
        return self._responder(200, {"token": token, "email": email, "nome": nome,
                                     "ativado": ativado, "codigo_ativacao": codigo_ativacao})


if __name__ == "__main__":
    iniciar_banco()
    print(f"ultrafoot-auth em http://{HOST}:{PORT} (db: {DB_PATH})")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
