#!/usr/bin/env python3
"""Emissao e ativacao de licenca — Ed25519.

O QUE MUDA EM RELACAO AO ESQUEMA ANTIGO.

Antes, o codigo vendido era um HMAC do segredo mestre. Como o jogo confere
offline, esse MESMO segredo ia dentro do bundle (`NEXT_PUBLIC_*`, em texto
puro) — e com ele qualquer pessoa emitia licenca, porque assinar e conferir
usam a mesma chave no HMAC.

Agora sao duas metades:

  PRIVADA   assina o certificado, so aqui na VPS
  PUBLICA   confere no jogo, pode ir no binario sem risco

E o codigo vendido deixa de ser um dado assinado: passa a ser um identificador
ALEATORIO conferido nesta tabela. A diferenca importa — chave assinada e
forjavel por quem tem o segredo; identificador aleatorio nao e adivinhavel nem
com a privada na mao, porque a verdade esta no banco, nao na matematica.

DEPENDENCIA. Ed25519 nao existe na stdlib. O projeto tem a regra de "nada de
pip na VPS" (server.py), entao usamos o pacote da DISTRO:

    apt install python3-cryptography

Se faltar, este modulo se desliga em vez de derrubar o servico: `disponivel()`
devolve False e as rotas respondem 503. Melhor a loja avisar "indisponivel" do
que o auth-server inteiro nao subir e ninguem conseguir nem entrar na conta.
"""

from pathlib import Path
import base64
import json
import os
import re
import secrets
import time

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    _CRYPTO = True
except ImportError:  # pragma: no cover - depende do ambiente da VPS
    _CRYPTO = False

# Caminho do ARQUIVO da chave, nao o conteudo: variavel de ambiente com a chave
# dentro vaza em `ps`, em log de crash e no journal do systemd.
CHAVE_PRIVADA = Path(os.environ.get("ULTRAFOOT_LICENSE_PRIVATE_KEY", ""))
KID = os.environ.get("ULTRAFOOT_LICENSE_KID", "v1")

ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # Crockford, igual ao formato antigo
PREFIXO = "UF26"

_privada = None


def disponivel() -> bool:
    """True se da para emitir e assinar licenca neste servidor."""
    return _CRYPTO and CHAVE_PRIVADA.is_file()


def _carregar_privada():
    """Le a chave uma vez e guarda. Ler a cada assinatura seria I/O a toa."""
    global _privada
    if _privada is None:
        dados = CHAVE_PRIVADA.read_bytes()
        _privada = serialization.load_pem_private_key(dados, password=None)
    return _privada


def gerar_codigo() -> str:
    """Identificador aleatorio no formato UF26-ABCDE-FGHIJ-KLMNO.

    75 bits de `secrets` (gerador criptografico, nao `random`). O espaco e de
    2^75: mesmo com o rate limit desligado, varrer por forca bruta e inviavel.

    Formato IDENTICO ao antigo de proposito — o jogador digita a mesma coisa, a
    interface nao muda e o suporte nao precisa reaprender nada.
    """
    bruto = secrets.randbits(75)
    grupos = []
    for _ in range(15):
        grupos.append(bruto & 0x1F)
        bruto >>= 5
    texto = "".join(ALFABETO[g] for g in reversed(grupos))
    return f"{PREFIXO}-{texto[0:5]}-{texto[5:10]}-{texto[10:15]}"


def normalizar(bruto: str) -> str:
    """Mesmas trocas do Crockford do esquema antigo (O→0, I/L→1, U→V).

    So no CORPO: aplicadas ao prefixo, o U de "UF26" viraria V e todo codigo
    legitimo seria recusado. Este bug ja aconteceu uma vez no lib/license.ts.
    """
    limpo = re.sub(r"[^0-9A-Z-]", "", (bruto or "").upper())
    if not limpo.startswith(PREFIXO):
        return limpo
    corpo = limpo[len(PREFIXO):]
    corpo = corpo.replace("O", "0").replace("I", "1").replace("L", "1").replace("U", "V")
    return PREFIXO + corpo


def emitir(con, conta_id: int) -> str:
    """Emite (ou reaproveita) a licenca desta conta.

    Reaproveitar importa: compra repetida por engano, ou webhook duplicado do
    Asaas, precisa devolver A MESMA chave. Duas chaves para a mesma conta viram
    chamado de suporte no dia seguinte.
    """
    ja = con.execute(
        "SELECT codigo FROM licencas WHERE conta_id = ? AND revogada = 0"
        " ORDER BY emitida_em LIMIT 1", (conta_id,)).fetchone()
    if ja:
        return ja["codigo"]

    linha = con.execute("SELECT MAX(serie) AS ultima FROM licencas").fetchone()
    serie = int(linha["ultima"] or 0) + 1

    # Colisao e praticamente impossivel em 2^75, mas o INSERT tem PRIMARY KEY:
    # tentar de novo custa nada e evita um erro 500 inexplicavel se acontecer.
    for _ in range(5):
        codigo = gerar_codigo()
        existe = con.execute("SELECT 1 FROM licencas WHERE codigo = ?", (codigo,)).fetchone()
        if not existe:
            break
    else:
        raise RuntimeError("nao consegui gerar codigo unico")

    con.execute(
        "INSERT INTO licencas (codigo, conta_id, serie, emitida_em) VALUES (?,?,?,?)",
        (codigo, conta_id, serie, int(time.time())))
    return codigo


def _assinar(payload: dict) -> str:
    """Monta `<payload-base64>.<assinatura-base64>`.

    O separador e '.' porque o base64 padrao nao usa esse caractere. A assinatura
    cobre os BYTES do payload — o Rust confere exatamente os mesmos bytes, sem
    reserializar, senao qualquer diferenca de ordem de campo invalidaria um
    certificado legitimo.
    """
    bruto = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    assinatura = _carregar_privada().sign(bruto)
    return (base64.b64encode(bruto).decode() + "." + base64.b64encode(assinatura).decode())


def ativar(con, bruto: str, device: str) -> tuple[str | None, str]:
    """Ativa a licenca nesta maquina. Devolve (certificado, erro).

    UMA licenca, UMA maquina. Sem essa trava, um codigo vazado registraria o
    jogo em quantos PCs quisessem e a venda perderia sentido.

    Reativar na MESMA maquina e permitido e devolve o mesmo certificado: quem
    reinstala o Windows ou o jogo nao pode ficar de fora.
    """
    if not disponivel():
        return None, "o servidor de licencas nao esta configurado"

    codigo = normalizar(bruto)
    device = (device or "").strip()[:80]
    if not device:
        return None, "identificador de maquina ausente"

    linha = con.execute("SELECT * FROM licencas WHERE codigo = ?", (codigo,)).fetchone()
    if not linha:
        return None, "codigo invalido"
    if linha["revogada"]:
        return None, "este codigo foi cancelado; fale com o suporte"

    if linha["device"] and linha["device"] != device:
        return None, "este codigo ja esta em uso em outro computador"

    if not linha["device"]:
        con.execute("UPDATE licencas SET device = ?, ativada_em = ? WHERE codigo = ?",
                    (device, int(time.time()), codigo))

    certificado = _assinar({
        "codigo": codigo,
        "device": device,
        "kid": KID,
        "emitido_em": int(time.time()),
        "serie": int(linha["serie"]),
    })
    return certificado, ""


def da_conta(con, conta_id: int) -> str:
    """Licenca ativa da conta, para recuperar apos formatar a maquina."""
    linha = con.execute(
        "SELECT codigo FROM licencas WHERE conta_id = ? AND revogada = 0"
        " ORDER BY emitida_em LIMIT 1", (conta_id,)).fetchone()
    return linha["codigo"] if linha else ""


def soltar_device(con, codigo: str) -> None:
    """Desamarra a licenca da maquina, para o suporte liberar troca de PC.

    Trocar de computador e legitimo e acontece. Sem esta valvula, o unico jeito
    seria emitir outra licenca — e ai a antiga ficaria valida por ai.
    """
    con.execute("UPDATE licencas SET device = NULL, ativada_em = NULL WHERE codigo = ?",
                (normalizar(codigo),))


def revogar(con, codigo: str, motivo: str) -> None:
    """Cancela a licenca. Diferente do esquema antigo, vale IMEDIATAMENTE.

    Antes a revogacao dependia de uma lista embutida no build — so tinha efeito
    na proxima versao publicada. Aqui a proxima ativacao ja e recusada.

    Nota: quem JA ativou continua com o certificado local funcionando offline.
    Cortar isso exigiria o jogo consultar o servidor toda vez, o que quebraria a
    promessa de jogar sem internet.
    """
    con.execute("UPDATE licencas SET revogada = 1, motivo_revogacao = ? WHERE codigo = ?",
                (motivo[:300], normalizar(codigo)))
