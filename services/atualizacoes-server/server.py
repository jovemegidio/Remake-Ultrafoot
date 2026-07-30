#!/usr/bin/env python3
"""SERVIDOR DE ATUALIZACOES DO ULTRAFOOT — o banco de elencos, escudos e uniformes.

O QUE ELE E: o lugar onde as atualizacoes sao MONTADAS (painel web + SQLite).
O QUE ELE NAO E: o lugar de onde o jogo baixa.

Essa separacao e o ponto principal do desenho. O jogo continua lendo um ARQUIVO
ESTATICO em /atualizacoes/elencos.json, servido pelo nginx, exatamente como ja
lia antes deste servico existir. Publicar aqui apenas REESCREVE aquele arquivo.

Por que assim, e nao servindo o JSON direto do banco:
  * o caminho de download e o mais critico do sistema — e ele que decide se o
    jogador recebe ou nao a atualizacao — e ja esta provado funcionando com
    nginx servindo arquivo. Colocar Python na frente disso troca algo que
    funciona por algo que pode cair;
  * esse caminho aguenta todos os jogadores ao mesmo tempo sem nenhum processo
    nosso no meio;
  * se este servico estiver fora do ar, os jogadores continuam recebendo a
    ultima versao publicada. So o painel para.

IMAGEM E ARQUIVO, NAO BASE64. O seed embutido no jogo (team-overrides.json)
chegou a 30 MB porque guardava escudo e uniforme como data URL dentro do
proprio JSON. Aqui a imagem e gravada em disco com o nome sendo o sha256 do
conteudo, e o manifesto leva so a URL — o manifesto fica em poucos KB e o
navegador/webview cacheia a imagem por nome, para sempre.

AUTENTICACAO: nao existe senha propria. O painel usa a MESMA conta do
auth-server; este processo abre o auth.db em modo somente-leitura e confere o
token e a coluna `admin`. Assim nao ha uma segunda senha para vazar, e tirar o
admin de alguem no auth-server tira aqui junto.

So biblioteca padrao, como os outros servicos — nada de pip na VPS.
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64
import binascii
import hashlib
import json
import os
import re
import sqlite3
import time
import unicodedata
import urllib.parse

HOST = "127.0.0.1"
# 8788 = cloud-save, 8790 = auth (e o relay). 8792 fica livre.
PORT = int(os.environ.get("ULTRAFOOT_ATU_PORT", "8792"))

DB_PATH = Path(os.environ.get("ULTRAFOOT_ATU_DB", "/var/lib/ultrafoot/atualizacoes.db"))
AUTH_DB = Path(os.environ.get("ULTRAFOOT_AUTH_DB", "/var/lib/ultrafoot/auth.db"))
SCHEMA = Path(__file__).with_name("schema.sql")
PAINEL = Path(__file__).with_name("painel.html")

# Onde o nginx serve os arquivos publicos. E aqui que a publicacao escreve.
PUB_DIR = Path(os.environ.get("ULTRAFOOT_ATU_PUB", "/var/www/ultrafoot/atualizacoes"))
IMG_DIR = PUB_DIR / "img"
BASE_URL = os.environ.get("ULTRAFOOT_ATU_URL", "https://ultrafoot.179-198-103-30.sslip.io")

# Um escudo PNG grande passa de 1 MB; o limite cobre com folga e ainda barra
# alguem tentando subir um video.
MAX_BODY = 12 * 1024 * 1024
EXTS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg"}


# ─── Banco ────────────────────────────────────────────────────────────────────

def conectar() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def iniciar_banco() -> None:
    with conectar() as con:
        con.executescript(SCHEMA.read_text(encoding="utf-8"))


def conta_admin(token: str):
    """Valida o token no banco do auth-server. Devolve (id, email) ou None.

    Aberto em modo=ro: este processo nao tem por que escrever no banco de
    contas, e um bug aqui nao pode corromper login de ninguem.
    """
    if not token or not AUTH_DB.exists():
        return None
    th = hashlib.sha256(token.encode()).hexdigest()
    try:
        con = sqlite3.connect(f"file:{AUTH_DB}?mode=ro", uri=True, timeout=5)
        con.row_factory = sqlite3.Row
        with con:
            linha = con.execute(
                "SELECT c.id, c.email, c.admin, c.bloqueada FROM sessoes s"
                " JOIN contas c ON c.id = s.conta_id"
                " WHERE s.token_hash = ? AND s.expira_em > ?",
                (th, int(time.time())),
            ).fetchone()
    except Exception:
        return None
    if not linha or linha["bloqueada"] or not linha["admin"]:
        return None
    return (linha["id"], linha["email"])


def registrar(con, conta, acao: str, alvo: str = "") -> None:
    con.execute(
        "INSERT INTO log_admin (conta_id, email, acao, alvo, quando) VALUES (?,?,?,?,?)",
        (conta[0] if conta else None, conta[1] if conta else "", acao, alvo[:200], int(time.time())),
    )


# ─── Chaves ───────────────────────────────────────────────────────────────────

def norm_nome(nome: str) -> str:
    """Mesma normalizacao de lib/player-overrides.normPlayerName.

    Tem de bater CARACTERE A CARACTERE com a do jogo: chave diferente = edicao
    que nunca encontra o atleta, sem nenhum erro visivel.
    """
    sem_acento = unicodedata.normalize("NFD", nome or "")
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", sem_acento.lower())


def chave_jogador(file_key: str, nome_original: str) -> str:
    return f"{file_key}__{norm_nome(nome_original)}"


# ─── Imagens ──────────────────────────────────────────────────────────────────

def guardar_imagem(con, data_url: str, origem: str = "") -> str:
    """Grava a imagem e devolve o sha. Aceita data URL (o que o editor produz).

    Deduplicado por conteudo: subir o mesmo escudo de novo nao cria arquivo.
    """
    m = re.match(r"^data:([^;,]+);base64,(.+)$", (data_url or "").strip(), re.S)
    if not m:
        raise ValueError("imagem precisa ser data URL base64")
    mime, b64 = m.group(1).lower(), m.group(2)
    ext = EXTS.get(mime)
    if not ext:
        raise ValueError(f"formato nao aceito: {mime}")
    try:
        bruto = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("base64 invalido")
    if not bruto:
        raise ValueError("imagem vazia")
    if len(bruto) > MAX_BODY:
        raise ValueError("imagem grande demais")

    sha = hashlib.sha256(bruto).hexdigest()
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    destino = IMG_DIR / f"{sha}.{ext}"
    if not destino.exists():
        # Grava em temporario e move: um leitor nunca ve arquivo pela metade.
        tmp = destino.with_suffix(destino.suffix + ".parcial")
        tmp.write_bytes(bruto)
        os.replace(tmp, destino)
    con.execute(
        "INSERT OR IGNORE INTO imagens (sha, ext, bytes, origem, criado_em) VALUES (?,?,?,?,?)",
        (sha, ext, len(bruto), origem[:120], int(time.time())),
    )
    return sha


def url_da_imagem(con, sha: str) -> str | None:
    if not sha:
        return None
    linha = con.execute("SELECT ext FROM imagens WHERE sha = ?", (sha,)).fetchone()
    if not linha:
        return None
    return f"{BASE_URL}/atualizacoes/img/{sha}.{linha['ext']}"


# ─── Manifesto ────────────────────────────────────────────────────────────────

def montar_manifesto(con, versao: int, notas: str) -> dict:
    """Monta o JSON no formato que lib/atualizacao-elencos.ts ja sabe ler.

    Formato inalterado de proposito: cliente antigo continua entendendo o que
    chega, e nao ha um dia de transicao em que ninguem recebe nada.
    """
    times: dict[str, dict] = {}
    for c in con.execute("SELECT * FROM clubes WHERE rascunho = 0"):
        item: dict = {}
        for campo in ("nome", "nome_oficial", "curto", "cor1", "cor2", "prestigio",
                      "estadio_nome", "estadio_cap", "patrocinador"):
            if c[campo] not in (None, ""):
                # O cliente usa nomeOficial (camelCase); o resto bate 1:1.
                item["nomeOficial" if campo == "nome_oficial" else campo] = c[campo]
        logo = url_da_imagem(con, c["escudo_sha"])
        if logo:
            item["logoUrl"] = logo
        kits = {}
        try:
            cru = json.loads(c["kits_json"] or "{}")
        except Exception:
            cru = {}
        for variante in ("home", "away", "third"):
            k = cru.get(variante) or {}
            saida = {}
            for campo in ("primary", "secondary", "pattern"):
                if k.get(campo):
                    saida[campo] = k[campo]
            if k.get("disabled"):
                saida["disabled"] = True
            img = url_da_imagem(con, k.get("sha") or "")
            if img:
                saida["imageUrl"] = img
            if saida:
                kits[variante] = saida
        if kits:
            item["kits"] = kits
        if item:
            times[c["file_key"]] = item

    jogadores: dict[str, dict] = {}
    for j in con.execute("SELECT * FROM jogadores WHERE rascunho = 0"):
        item = {}
        for campo in ("nome", "pos", "base", "idade", "nac"):
            if j[campo] not in (None, ""):
                item[campo] = j[campo]
        foto = url_da_imagem(con, j["foto_sha"])
        if foto:
            item["faceDataUrl"] = foto
        if item:
            jogadores[j["chave"]] = item

    transferencias = []
    for t in con.execute("SELECT * FROM transferencias WHERE rascunho = 0 ORDER BY id"):
        item = {"nome": t["nome"]}
        for campo in ("de", "para", "pos", "idade", "base", "nac"):
            if t[campo] not in (None, ""):
                item[campo] = t[campo]
        transferencias.append(item)

    ligas = {}
    for l in con.execute("SELECT * FROM ligas WHERE rascunho = 0"):
        try:
            clubes = json.loads(l["clubes_json"] or "[]")
        except Exception:
            clubes = []
        if clubes:
            ligas[l["competicao"]] = {"clubes": clubes}

    return {
        "versao": versao,
        "publicado_em": int(time.time()),
        "notas": notas or "",
        "times": times,
        "jogadores": jogadores,
        "transferencias": transferencias,
        "ligas": ligas,
    }


def serializar_manifesto(manifesto: dict) -> bytes:
    """Uma unica forma de virar bytes — usada pela previa E pela publicacao."""
    return json.dumps(manifesto, ensure_ascii=False, indent=2).encode("utf-8")


def versao_publicada(con) -> int:
    linha = con.execute("SELECT MAX(versao) v FROM publicacoes").fetchone()
    return int(linha["v"] or 0)


def publicar(con, conta, notas: str) -> dict:
    """Escreve o manifesto no diretorio publico. E a unica coisa que o jogo ve.

    A versao sai do que ja foi publicado + 1. Nunca do que esta escrito em
    lugar nenhum: numero que retrocede nao da erro, so deixa de chegar.
    """
    versao = versao_publicada(con) + 1
    manifesto = montar_manifesto(con, versao, notas)
    corpo = serializar_manifesto(manifesto)

    PUB_DIR.mkdir(parents=True, exist_ok=True)
    destino = PUB_DIR / "elencos.json"
    tmp = destino.with_suffix(".json.parcial")
    tmp.write_bytes(corpo)
    # Troca atomica: ninguem baixa um manifesto pela metade.
    os.replace(tmp, destino)

    con.execute(
        "INSERT INTO publicacoes (versao, notas, publicado_em, clubes, jogadores,"
        " transferencias, ligas, bytes, por_conta) VALUES (?,?,?,?,?,?,?,?,?)",
        (versao, notas or "", manifesto["publicado_em"], len(manifesto["times"]),
         len(manifesto["jogadores"]), len(manifesto["transferencias"]),
         len(manifesto["ligas"]), len(corpo), conta[0] if conta else None),
    )
    registrar(con, conta, "publicar", f"versao {versao}")
    return {
        "versao": versao,
        "bytes": len(corpo),
        "clubes": len(manifesto["times"]),
        "jogadores": len(manifesto["jogadores"]),
        "transferencias": len(manifesto["transferencias"]),
        "ligas": len(manifesto["ligas"]),
    }


# ─── HTTP ─────────────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    server_version = "ultrafoot-atualizacoes"

    def log_message(self, *_):
        pass

    def _cors(self) -> None:
        # Mesma politica do auth-server: sem cookie, credencial so no header.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _responder(self, codigo: int, corpo: dict) -> None:
        dado = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(dado)))
        self.end_headers()
        self.wfile.write(dado)

    def _corpo(self) -> dict:
        """Corpo JSON do POST.

        LANCA em vez de devolver {} quando o corpo nao presta. Devolvendo dict
        vazio, um JSON malformado (ou em codificacao errada — um nome com acento
        enviado fora de UTF-8) caia no mesmo caminho de "campo faltando", e o
        admin recebia "informe o clube e o nome do atleta" tendo preenchido os
        dois. A mensagem apontava para o lugar errado.
        """
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return {}
        if n > MAX_BODY:
            raise ValueError("corpo grande demais")
        bruto = self.rfile.read(n)
        try:
            dado = json.loads(bruto)
        except UnicodeDecodeError:
            raise ValueError("corpo precisa estar em UTF-8")
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON invalido: {e.msg}")
        if not isinstance(dado, dict):
            raise ValueError("esperado um objeto JSON")
        return dado

    def _token(self) -> str:
        auth = self.headers.get("Authorization") or ""
        return auth[7:].strip() if auth.startswith("Bearer ") else ""

    def _rota(self) -> str:
        # O nginx repassa com o prefixo /atualizacoes; aceitamos com e sem ele
        # para o servico poder ser testado direto na porta.
        caminho = self.path.split("?")[0]
        if caminho.startswith("/atualizacoes"):
            caminho = caminho[len("/atualizacoes"):] or "/"
        return caminho

    # ── GET ──
    def do_GET(self):
        rota = self._rota()
        if rota in ("/health", "/health/"):
            with conectar() as con:
                return self._responder(200, {
                    "ok": True, "service": "ultrafoot-atualizacoes",
                    "versao_publicada": versao_publicada(con),
                })
        if rota in ("/painel", "/painel/"):
            return self._pagina()

        conta = conta_admin(self._token())
        if not conta:
            # 404, nao 403: quem nao e admin nem fica sabendo que a area existe.
            return self._responder(404, {"erro": "nao encontrado"})

        with conectar() as con:
            if rota == "/admin/resumo":
                return self._responder(200, self._resumo(con))
            if rota == "/admin/clubes":
                consulta = urllib.parse.urlparse(self.path).query
                busca = (urllib.parse.parse_qs(consulta).get("busca", [""])[0] or "").strip().lower()
                linhas = con.execute(
                    "SELECT file_key, nome, curto, cor1, cor2, escudo_sha, rascunho,"
                    " atualizado_em FROM clubes ORDER BY nome LIMIT 400"
                ).fetchall()
                itens = []
                for c in linhas:
                    if busca and busca not in (c["nome"] or "").lower() and busca not in c["file_key"].lower():
                        continue
                    itens.append({
                        "file_key": c["file_key"], "nome": c["nome"], "curto": c["curto"],
                        "cor1": c["cor1"], "cor2": c["cor2"], "rascunho": bool(c["rascunho"]),
                        "escudo": url_da_imagem(con, c["escudo_sha"]),
                        "atualizado_em": c["atualizado_em"],
                    })
                return self._responder(200, {"itens": itens})
            if rota.startswith("/admin/clube/"):
                return self._ver_clube(con, rota[len("/admin/clube/"):])
        return self._responder(404, {"erro": "nao encontrado"})

    def _resumo(self, con) -> dict:
        def n(sql):
            return int(con.execute(sql).fetchone()[0])
        ultima = con.execute(
            "SELECT versao, notas, publicado_em, bytes FROM publicacoes"
            " ORDER BY versao DESC LIMIT 1"
        ).fetchone()
        return {
            "clubes": n("SELECT COUNT(*) FROM clubes WHERE rascunho = 0"),
            "clubes_rascunho": n("SELECT COUNT(*) FROM clubes WHERE rascunho = 1"),
            "jogadores": n("SELECT COUNT(*) FROM jogadores WHERE rascunho = 0"),
            "transferencias": n("SELECT COUNT(*) FROM transferencias WHERE rascunho = 0"),
            "ligas": n("SELECT COUNT(*) FROM ligas WHERE rascunho = 0"),
            "imagens": n("SELECT COUNT(*) FROM imagens"),
            "versao_publicada": versao_publicada(con),
            "ultima": dict(ultima) if ultima else None,
        }

    def _ver_clube(self, con, file_key: str):
        file_key = urllib.parse.unquote(file_key)
        c = con.execute("SELECT * FROM clubes WHERE file_key = ?", (file_key,)).fetchone()
        if not c:
            return self._responder(404, {"erro": "clube nao encontrado"})
        try:
            kits = json.loads(c["kits_json"] or "{}")
        except Exception:
            kits = {}
        for variante, k in list(kits.items()):
            if isinstance(k, dict) and k.get("sha"):
                k["url"] = url_da_imagem(con, k["sha"])
        elenco = [dict(j) for j in con.execute(
            "SELECT chave, nome_original, nome, pos, base, idade, nac, rascunho"
            " FROM jogadores WHERE file_key = ? ORDER BY nome_original", (file_key,))]
        return self._responder(200, {
            "clube": {k: c[k] for k in c.keys() if k != "kits_json"},
            "escudo": url_da_imagem(con, c["escudo_sha"]),
            "kits": kits,
            "elenco": elenco,
        })

    def _pagina(self):
        try:
            html = PAINEL.read_bytes()
        except OSError:
            return self._responder(500, {"erro": "painel indisponivel"})
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)

    # ── POST ──
    def do_POST(self):
        rota = self._rota()
        conta = conta_admin(self._token())
        if not conta:
            return self._responder(404, {"erro": "nao encontrado"})

        try:
            # Dentro do try: _corpo lanca ValueError em corpo malformado, e o
            # admin merece ver o motivo em vez de um 500 sem explicacao.
            corpo = self._corpo()
            with conectar() as con:
                if rota == "/admin/clube/salvar":
                    return self._responder(200, self._salvar_clube(con, conta, corpo))
                if rota == "/admin/clube/remover":
                    fk = (corpo.get("file_key") or "").strip()
                    con.execute("DELETE FROM clubes WHERE file_key = ?", (fk,))
                    registrar(con, conta, "remover_clube", fk)
                    return self._responder(200, {"ok": True})
                if rota == "/admin/jogador/salvar":
                    return self._responder(200, self._salvar_jogador(con, conta, corpo))
                if rota == "/admin/jogador/remover":
                    ch = (corpo.get("chave") or "").strip()
                    con.execute("DELETE FROM jogadores WHERE chave = ?", (ch,))
                    registrar(con, conta, "remover_jogador", ch)
                    return self._responder(200, {"ok": True})
                if rota == "/admin/transferencia/salvar":
                    return self._responder(200, self._salvar_transferencia(con, conta, corpo))
                if rota == "/admin/transferencia/remover":
                    con.execute("DELETE FROM transferencias WHERE id = ?", (int(corpo.get("id") or 0),))
                    registrar(con, conta, "remover_transferencia", str(corpo.get("id")))
                    return self._responder(200, {"ok": True})
                if rota == "/admin/transferencias":
                    itens = [dict(t) for t in con.execute(
                        "SELECT * FROM transferencias ORDER BY id DESC LIMIT 300")]
                    return self._responder(200, {"itens": itens})
                if rota == "/admin/liga/salvar":
                    comp = (corpo.get("competicao") or "").strip()
                    clubes = corpo.get("clubes") or []
                    if not comp:
                        return self._responder(400, {"erro": "informe a competicao"})
                    con.execute(
                        "INSERT INTO ligas (competicao, clubes_json, atualizado_em, rascunho)"
                        " VALUES (?,?,?,?) ON CONFLICT(competicao) DO UPDATE SET"
                        " clubes_json = excluded.clubes_json, atualizado_em = excluded.atualizado_em,"
                        " rascunho = excluded.rascunho",
                        (comp, json.dumps(clubes, ensure_ascii=False), int(time.time()),
                         1 if corpo.get("rascunho") else 0))
                    registrar(con, conta, "salvar_liga", comp)
                    return self._responder(200, {"ok": True})
                if rota == "/admin/previa":
                    versao = versao_publicada(con) + 1
                    m = montar_manifesto(con, versao, corpo.get("notas") or "")
                    # MESMA serializacao da publicacao (serializar_manifesto):
                    # sem isso a previa anunciava um tamanho e o arquivo saia com
                    # outro, e o numero deixava de servir para decidir qualquer
                    # coisa.
                    return self._responder(200, {
                        "versao": versao, "bytes": len(serializar_manifesto(m)),
                        "clubes": len(m["times"]), "jogadores": len(m["jogadores"]),
                        "transferencias": len(m["transferencias"]), "ligas": len(m["ligas"]),
                    })
                if rota == "/admin/publicar":
                    return self._responder(200, publicar(con, conta, corpo.get("notas") or ""))
                if rota == "/admin/importar":
                    return self._responder(200, self._importar(con, conta, corpo))
        except ValueError as e:
            return self._responder(400, {"erro": str(e)})
        except Exception as e:  # nao derruba o servico por causa de um payload torto
            return self._responder(500, {"erro": f"falha: {e}"})

        return self._responder(404, {"erro": "nao encontrado"})

    def _salvar_clube(self, con, conta, corpo: dict) -> dict:
        fk = (corpo.get("file_key") or "").strip()
        if not fk:
            raise ValueError("informe o file_key do clube")
        escudo_sha = None
        if corpo.get("escudo_data"):
            escudo_sha = guardar_imagem(con, corpo["escudo_data"], f"escudo:{fk}")
        elif corpo.get("escudo_sha"):
            escudo_sha = corpo["escudo_sha"]

        kits = {}
        for variante in ("home", "away", "third"):
            k = (corpo.get("kits") or {}).get(variante) or {}
            saida = {}
            for campo in ("primary", "secondary", "pattern"):
                if k.get(campo):
                    saida[campo] = k[campo]
            if k.get("disabled"):
                saida["disabled"] = True
            if k.get("data"):
                saida["sha"] = guardar_imagem(con, k["data"], f"kit:{fk}:{variante}")
            elif k.get("sha"):
                saida["sha"] = k["sha"]
            if saida:
                kits[variante] = saida

        agora = int(time.time())
        existente = con.execute("SELECT escudo_sha, kits_json FROM clubes WHERE file_key = ?", (fk,)).fetchone()
        if existente and escudo_sha is None:
            escudo_sha = existente["escudo_sha"]
        if existente and not kits:
            try:
                kits = json.loads(existente["kits_json"] or "{}")
            except Exception:
                kits = {}

        con.execute(
            "INSERT INTO clubes (file_key, nome, nome_oficial, curto, cor1, cor2, prestigio,"
            " estadio_nome, estadio_cap, patrocinador, escudo_sha, kits_json, atualizado_em, rascunho)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            " ON CONFLICT(file_key) DO UPDATE SET"
            " nome=excluded.nome, nome_oficial=excluded.nome_oficial, curto=excluded.curto,"
            " cor1=excluded.cor1, cor2=excluded.cor2, prestigio=excluded.prestigio,"
            " estadio_nome=excluded.estadio_nome, estadio_cap=excluded.estadio_cap,"
            " patrocinador=excluded.patrocinador, escudo_sha=excluded.escudo_sha,"
            " kits_json=excluded.kits_json, atualizado_em=excluded.atualizado_em,"
            " rascunho=excluded.rascunho",
            (fk, corpo.get("nome"), corpo.get("nome_oficial"), corpo.get("curto"),
             corpo.get("cor1"), corpo.get("cor2"), corpo.get("prestigio"),
             corpo.get("estadio_nome"), corpo.get("estadio_cap"), corpo.get("patrocinador"),
             escudo_sha, json.dumps(kits, ensure_ascii=False), agora,
             1 if corpo.get("rascunho") else 0))
        registrar(con, conta, "salvar_clube", fk)
        return {"ok": True, "file_key": fk, "escudo": url_da_imagem(con, escudo_sha)}

    def _salvar_jogador(self, con, conta, corpo: dict) -> dict:
        fk = (corpo.get("file_key") or "").strip()
        original = (corpo.get("nome_original") or "").strip()
        if not fk or not original:
            raise ValueError("informe o clube e o nome original do atleta")
        chave = chave_jogador(fk, original)
        foto_sha = None
        if corpo.get("foto_data"):
            foto_sha = guardar_imagem(con, corpo["foto_data"], f"face:{chave}")
        con.execute(
            "INSERT INTO jogadores (chave, file_key, nome_original, nome, pos, base, idade,"
            " nac, foto_sha, atualizado_em, rascunho) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
            " ON CONFLICT(chave) DO UPDATE SET nome=excluded.nome, pos=excluded.pos,"
            " base=excluded.base, idade=excluded.idade, nac=excluded.nac,"
            " foto_sha=COALESCE(excluded.foto_sha, jogadores.foto_sha),"
            " atualizado_em=excluded.atualizado_em, rascunho=excluded.rascunho",
            (chave, fk, original, corpo.get("nome"), corpo.get("pos"), corpo.get("base"),
             corpo.get("idade"), corpo.get("nac"), foto_sha, int(time.time()),
             1 if corpo.get("rascunho") else 0))
        registrar(con, conta, "salvar_jogador", chave)
        return {"ok": True, "chave": chave}

    def _salvar_transferencia(self, con, conta, corpo: dict) -> dict:
        nome = (corpo.get("nome") or "").strip()
        if not nome:
            raise ValueError("informe o nome do atleta")
        if not (corpo.get("de") or corpo.get("para")):
            raise ValueError("informe pelo menos o clube de origem ou o de destino")
        con.execute(
            "INSERT INTO transferencias (nome, de, para, pos, idade, base, nac, criado_em, rascunho)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (nome, corpo.get("de"), corpo.get("para"), corpo.get("pos"), corpo.get("idade"),
             corpo.get("base"), corpo.get("nac"), int(time.time()),
             1 if corpo.get("rascunho") else 0))
        registrar(con, conta, "salvar_transferencia", nome)
        return {"ok": True}

    def _importar(self, con, conta, corpo: dict) -> dict:
        """Carga em lote — usada pela carga inicial dos overrides ja existentes."""
        clubes = corpo.get("clubes") or []
        n = 0
        for c in clubes:
            try:
                self._salvar_clube(con, conta, c)
                n += 1
            except ValueError:
                continue
        registrar(con, conta, "importar", f"{n} clubes")
        return {"ok": True, "importados": n}


def main() -> None:
    iniciar_banco()
    PUB_DIR.mkdir(parents=True, exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"ultrafoot-atualizacoes em http://{HOST}:{PORT} (db {DB_PATH})", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
