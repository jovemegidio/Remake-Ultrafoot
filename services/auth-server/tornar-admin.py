#!/usr/bin/env python3
"""Marca (ou desmarca) uma conta como administradora.

Não existe rota HTTP para isto de propósito: promover a admin pela API criaria
um caminho para escalar privilégio. Só quem tem acesso ao servidor promove.

    python3 tornar-admin.py alguem@exemplo.com          # promove
    python3 tornar-admin.py alguem@exemplo.com --tirar  # rebaixa
    python3 tornar-admin.py --listar                    # mostra os admins
"""
import os
import sqlite3
import sys
from pathlib import Path

DB = Path(os.environ.get("ULTRAFOOT_AUTH_DB", "/var/lib/ultrafoot/auth.db"))


def main() -> int:
    if not DB.exists():
        print(f"banco nao encontrado em {DB}", file=sys.stderr)
        return 1

    args = [a for a in sys.argv[1:]]
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    if "--listar" in args or not args:
        linhas = con.execute("SELECT email, nome FROM contas WHERE admin = 1").fetchall()
        if not linhas:
            print("nenhum administrador cadastrado")
        for l in linhas:
            print(f"{l['email']}  {l['nome']}")
        return 0

    tirar = "--tirar" in args
    email = next((a for a in args if not a.startswith("--")), "").strip().lower()
    if not email:
        print("informe o e-mail", file=sys.stderr)
        return 1

    conta = con.execute("SELECT id, email FROM contas WHERE email = ?", (email,)).fetchone()
    if not conta:
        # Erro claro e util: o caso comum e a pessoa ainda nao ter criado a conta
        # no launcher, e um "0 linhas afetadas" silencioso confundiria.
        print(f"nenhuma conta com o e-mail {email} — crie a conta no launcher primeiro",
              file=sys.stderr)
        return 1

    con.execute("UPDATE contas SET admin = ? WHERE id = ?", (0 if tirar else 1, conta["id"]))
    con.commit()
    print(f"{conta['email']} agora {'NAO e' if tirar else 'e'} administrador")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
