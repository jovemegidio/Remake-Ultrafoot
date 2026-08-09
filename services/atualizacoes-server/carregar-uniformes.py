#!/usr/bin/env python3
"""Carga de UNIFORMES no banco de atualizacoes, rodando na propria VPS.

    sudo -u ultrafoot python3 carregar-uniformes.py uniformes.json --ensaio
    sudo -u ultrafoot python3 carregar-uniformes.py uniformes.json --publicar \
        --notas "Uniformes: Portuguesa"

Irmao do carregar-escudos.py e do carregar-fotos.py, pelo mesmo motivo: o
arquivo tem megabytes de imagem em base64, ja esta no disco do servidor depois
de um scp, e escrever direto no SQLite evita o token de administrador, o limite
de corpo do nginx e a banda de subida de casa.

De onde vem o JSON: `node scripts/publicar-uniformes-pasta.mjs --pasta "<pasta>"
--exportar uniformes.json`, rodado de um diretorio com node_modules
(C:\\Ultrafoot — o `sharp` nao existe no G:).

⚠️ NAO USE O importar-seed.py PARA ISTO, e nem o /admin/importar: os dois gravam
o clube INTEIRO (`nome=excluded.nome`, `escudo_sha=excluded.escudo_sha`), entao
um arquivo que so tem uniforme apagaria nome, cores, estadio e ESCUDO dos 700+
clubes que ja estao no banco. Aqui a unica coluna tocada e `kits_json`.

⚠️ E O kits_json E MESCLADO, variante a variante. Publicar so a camisa de casa
com um `json.dumps` do que veio no arquivo APAGARIA a de fora que ja estava la —
sem erro nenhum, e o estrago so apareceria no manifesto seguinte.

Rode como o usuario `ultrafoot`, nunca root: o servico e dono do banco e dos
arquivos de imagem, e um WAL criado por root deixa o servico sem escrever.
"""

import json
import os
import sys
import time
from pathlib import Path

# ⚠️ OS CAMINHOS PRECISAM VIR ANTES DO IMPORT: server.py resolve DB_PATH e
# PUB_DIR no momento em que e carregado, e os PADROES DELE APONTAM PARA OUTRO
# LUGAR (`/var/lib/ultrafoot/atualizacoes.db`, sem o subdiretorio). Sem estes
# valores — os mesmos de ultrafoot-atualizacoes.service — a carga cria um banco
# vazio paralelo, termina dizendo "gravados: N" e nada chega ao jogador.
os.environ.setdefault("ULTRAFOOT_ATU_DB", "/var/lib/ultrafoot/atualizacoes/atualizacoes.db")
os.environ.setdefault("ULTRAFOOT_ATU_PUB", "/var/www/ultrafoot/atualizacoes")

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI if (AQUI / "server.py").exists() else Path("/opt/ultrafoot/atualizacoes")))
import server  # noqa: E402  (o modulo do servico, reaproveitado inteiro)

VARIANTES = ("home", "away", "third")

ensaio = "--ensaio" in sys.argv
publicar = "--publicar" in sys.argv
# ⚠️ A NOTA E ARGUMENTO, nao constante: ela e a unica coisa que o jogador le.
notas = sys.argv[sys.argv.index("--notas") + 1] if "--notas" in sys.argv else "Novos uniformes"
soltos = [a for i, a in enumerate(sys.argv[1:], 1)
          if not a.startswith("--") and sys.argv[i - 1] != "--notas"]
if not soltos:
    sys.exit("uso: carregar-uniformes.py <arquivo.json> [--ensaio] [--publicar] [--notas TEXTO]")

itens = json.load(open(soltos[0], encoding="utf-8"))["clubes"]
print(f"banco  : {server.DB_PATH}")
print(f"imagens: {server.IMG_DIR}")
print(f"arquivo: {len(itens)} clubes")

con = server.conectar()
antes = con.execute("SELECT COUNT(*) FROM clubes").fetchone()[0]
com_kit = con.execute(
    "SELECT COUNT(*) FROM clubes WHERE kits_json IS NOT NULL AND kits_json NOT IN ('', '{}')").fetchone()[0]
print(f"clubes no banco antes: {antes} ({com_kit} com uniforme)")


def kits_atuais(fk: str) -> dict:
    linha = con.execute("SELECT kits_json FROM clubes WHERE file_key = ?", (fk,)).fetchone()
    if not linha:
        return {}
    try:
        return json.loads(linha["kits_json"] or "{}") or {}
    except Exception:
        return {}


# Dizer o que vai ser SUBSTITUIDO, antes de fazer — a variante que ja existe
# some para sempre, e o ensaio e a unica chance de perceber.
for j in itens:
    fk = (j.get("file_key") or "").strip()
    atuais = kits_atuais(fk)
    novas = [v for v in VARIANTES if (j.get("kits") or {}).get(v)]
    subst = [v for v in novas if atuais.get(v, {}).get("sha")]
    print(f"  {fk}: grava {', '.join(novas) or '-'}"
          + (f" | SUBSTITUI {', '.join(subst)}" if subst else "")
          + (f" | mantem {', '.join(v for v in atuais if v not in novas)}"
             if any(v not in novas for v in atuais) else ""))

ok, falhas = 0, []
if not ensaio:
    with con:
        for j in itens:
            fk = (j.get("file_key") or "").strip()
            if not fk:
                falhas.append("item sem file_key")
                continue
            try:
                kits = kits_atuais(fk)
                for variante in VARIANTES:
                    k = (j.get("kits") or {}).get(variante) or {}
                    if not k:
                        continue
                    saida = dict(kits.get(variante) or {})
                    for campo in ("primary", "secondary", "pattern"):
                        if k.get(campo):
                            saida[campo] = k[campo]
                    if k.get("disabled"):
                        saida["disabled"] = True
                    if k.get("data"):
                        saida["sha"] = server.guardar_imagem(con, k["data"], f"kit:{fk}:{variante}")
                    elif k.get("sha"):
                        saida["sha"] = k["sha"]
                    kits[variante] = saida
                # ⚠️ SO `kits_json`. O clube ja existe no banco com nome, cores,
                # estadio e ESCUDO vindos das outras cargas; um UPSERT com as
                # demais colunas as zeraria em silencio.
                con.execute(
                    "INSERT INTO clubes (file_key, kits_json, atualizado_em, rascunho)"
                    " VALUES (?,?,?,0)"
                    " ON CONFLICT(file_key) DO UPDATE SET kits_json=excluded.kits_json,"
                    " atualizado_em=excluded.atualizado_em, rascunho=0",
                    (fk, json.dumps(kits, ensure_ascii=False), int(time.time())),
                )
                ok += 1
            except Exception as e:  # um uniforme torto nao derruba a carga inteira
                falhas.append(f"{fk}: {e}")
        server.registrar(con, None, "carga_uniformes", f"{ok} clubes")

depois = con.execute("SELECT COUNT(*) FROM clubes").fetchone()[0]
com_kit_agora = con.execute(
    "SELECT COUNT(*) FROM clubes WHERE kits_json IS NOT NULL AND kits_json NOT IN ('', '{}')").fetchone()[0]
print(f"gravados: {ok} | falhas: {len(falhas)} | clubes agora: {depois} ({com_kit_agora} com uniforme)")
for f in falhas[:10]:
    print("  !", f)

if publicar and not ensaio:
    with con:
        r = server.publicar(con, None, notas)
    print("PUBLICADO:", r)
else:
    print("Nada publicado — o manifesto no ar continua o de antes.")
