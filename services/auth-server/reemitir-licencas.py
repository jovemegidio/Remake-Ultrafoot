#!/usr/bin/env python3
"""ETAPA 5 — reemite as licencas do esquema antigo (HMAC) no novo (Ed25519).

    python3 reemitir-licencas.py              # simulacao: mostra o que faria
    python3 reemitir-licencas.py --executar   # grava de verdade
    python3 reemitir-licencas.py --conferir   # so relatorio, nao muda nada

POR QUE ISTO EXISTE.

A v1.0.202 corta as chaves antigas: elas deixam de validar. Quem ja pagou nao
pode ficar para tras, entao TODA conta ativada precisa ter uma licenca na tabela
`licencas` ANTES do corte. Este script e o que garante isso.

ORDEM QUE NAO PODE INVERTER (§6 do plano): rodar ISTO antes de remover o
`ULTRAFOOT_LICENSE_SECRET` e o `preparar-env-licenca.mjs`. Remover o segredo
primeiro deixaria os compradores atuais sem caminho de migracao — a chave velha
para de valer e a nova ainda nao existe.

RODA NA VPS, onde estao o banco e a chave privada. Nao ha rota HTTP para isto de
proposito, pelo mesmo motivo do `tornar-admin.py`: emissao em massa pela API
seria um alvo obvio.

SEGURANCA. O script nao ASSINA nada e por isso nao precisa da chave privada — so
sorteia identificadores e grava na tabela. A assinatura acontece depois, na
primeira ativacao de cada jogador (`/licenca/ativar`). Consequencia pratica: da
para reemitir mesmo antes de a privada estar na VPS.
"""
import os
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import licenca  # noqa: E402

DB = Path(os.environ.get("ULTRAFOOT_AUTH_DB", "/var/lib/ultrafoot/auth.db"))


def contas_a_reemitir(con) -> list:
    """Contas que precisam de licenca nova.

    O criterio e `ativado = 1`: e o que marca quem realmente pagou, seja por
    chave digitada no registro, por compra na loja ou por liberacao manual do
    admin. Contas bloqueadas ficam de FORA — reemitir para quem foi banido
    devolveria o acesso que o banimento tirou.

    A subconsulta exclui quem JA tem licenca no esquema novo: e o que torna o
    script idempotente, e rodar duas vezes nao gera chave duplicada.
    """
    return con.execute(
        "SELECT c.id, c.email, c.nome FROM contas c"
        " WHERE c.ativado = 1 AND c.bloqueada = 0"
        "   AND NOT EXISTS (SELECT 1 FROM licencas l"
        "                   WHERE l.conta_id = c.id AND l.revogada = 0)"
        " ORDER BY c.id"
    ).fetchall()


def relatorio(con) -> None:
    def n(sql: str) -> int:
        return con.execute(sql).fetchone()[0]

    print()
    print("  SITUACAO ATUAL")
    print(f"    contas ativadas ............. {n('SELECT COUNT(*) FROM contas WHERE ativado = 1')}")
    print(f"      dessas, bloqueadas ........ {n('SELECT COUNT(*) FROM contas WHERE ativado = 1 AND bloqueada = 1')}")
    print(f"    licencas no esquema NOVO .... {n('SELECT COUNT(*) FROM licencas WHERE revogada = 0')}")
    print(f"      ja ativadas numa maquina .. {n('SELECT COUNT(*) FROM licencas WHERE revogada = 0 AND device IS NOT NULL')}")
    print(f"    chaves do esquema ANTIGO .... {n('SELECT COUNT(*) FROM licencas_migradas')}")

    # Quem comprou e NUNCA criou conta nao aparece em lugar nenhum do banco: nao
    # ha o que reemitir para essa pessoa, e o plano (§4) ja assume isso. O jogo
    # nao trava sem registro, entao ela continua jogando e o suporte resolve
    # caso a caso. Dizer isso aqui evita a leitura errada de que o numero acima
    # cobre 100% dos compradores.
    orfas = n("SELECT COUNT(*) FROM licencas_migradas lm"
              " WHERE NOT EXISTS (SELECT 1 FROM contas c WHERE c.id = lm.conta_id"
              "                   AND c.ativado = 1)")
    if orfas:
        print(f"    chaves antigas sem conta ativa ... {orfas}  (resolver no suporte)")
    print()


def main() -> int:
    executar = "--executar" in sys.argv
    so_conferir = "--conferir" in sys.argv

    if not DB.exists():
        print(f"banco nao encontrado em {DB}", file=sys.stderr)
        print("defina ULTRAFOOT_AUTH_DB se ele estiver em outro caminho", file=sys.stderr)
        return 1

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    # A tabela pode nao existir se o schema.sql novo ainda nao rodou nesta VPS.
    # Falhar aqui com mensagem clara e melhor do que um "no such table" cru.
    existe = con.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'licencas'").fetchone()
    if not existe:
        print("a tabela `licencas` nao existe neste banco.", file=sys.stderr)
        print("suba o auth-server novo uma vez (ele aplica o schema) e rode de novo.",
              file=sys.stderr)
        return 1

    relatorio(con)
    if so_conferir:
        return 0

    pendentes = contas_a_reemitir(con)
    if not pendentes:
        print("  Nada a fazer: toda conta ativada ja tem licenca no esquema novo.\n")
        return 0

    print(f"  {len(pendentes)} conta(s) sem licenca no esquema novo:\n")
    for c in pendentes[:20]:
        print(f"    #{c['id']:<5} {c['email']}")
    if len(pendentes) > 20:
        print(f"    ... e mais {len(pendentes) - 20}")
    print()

    if not executar:
        print("  SIMULACAO - nada foi gravado.")
        print("  Para valer:  python3 reemitir-licencas.py --executar\n")
        return 0

    emitidas, falhas = 0, 0
    for c in pendentes:
        try:
            codigo = licenca.emitir(con, c["id"])
            emitidas += 1
            print(f"    #{c['id']:<5} {c['email']:<38} {codigo}")
        except Exception as e:
            # Uma conta com problema NAO pode abortar as outras: no meio de uma
            # migracao, parar na metade e o pior resultado possivel.
            falhas += 1
            print(f"    #{c['id']:<5} {c['email']:<38} FALHOU: {e}", file=sys.stderr)

    # Commit unico no fim: ou a leva inteira entra, ou nenhuma. Commit por conta
    # deixaria o banco num estado parcial se o processo morresse no meio.
    con.commit()

    print()
    print(f"  {emitidas} licenca(s) emitida(s), {falhas} falha(s).")
    print()
    print("  PROXIMOS PASSOS")
    print("    1. O launcher troca a chave antiga pela nova sozinho, via")
    print("       /licenca/minha (etapa 7). O jogador nao precisa fazer nada.")
    print("    2. So DEPOIS de publicar a v1.0.202 e confirmar a migracao,")
    print("       remova o ULTRAFOOT_LICENSE_SECRET da VPS (etapa 9).")
    print()
    return 0 if falhas == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
