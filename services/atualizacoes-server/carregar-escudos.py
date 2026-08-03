#!/usr/bin/env python3
"""Carga de ESCUDOS no banco de atualizacoes, rodando na propria VPS.

    sudo -u ultrafoot python3 carregar-escudos.py escudos.json --ensaio
    sudo -u ultrafoot python3 carregar-escudos.py escudos.json --publicar \
        --notas "Escudos licenciados: Serie A italiana e Serie B/C brasileira"

Irmao do carregar-fotos.py, pelo mesmo motivo: o arquivo tem megabytes de imagem
em base64, ja esta no disco do servidor depois de um scp, e escrever direto no
SQLite evita o token de administrador, o limite de corpo do nginx e a banda de
subida de casa.

De onde vem o JSON: `node scripts/publicar-escudos-pasta.mjs --pasta "<pasta>"
--exportar escudos.json`, rodado de um diretorio com node_modules (C:\\Ultrafoot
— o `sharp` nao existe no G:). Confira o relatorio do ensaio: o casamento por
nome e a unica parte que pode colar o escudo de um homonimo.

⚠️ NAO USE O importar-seed.py PARA ISTO. Ele grava o clube INTEIRO
(`nome=excluded.nome`, `kits_json=excluded.kits_json`), entao um arquivo que so
tem escudo apagaria nome, cores, estadio e uniforme dos 500+ clubes que ja estao
no banco — e o estrago so apareceria no manifesto seguinte. Aqui a unica coluna
tocada e `escudo_sha`.

Rode como o usuario `ultrafoot`, nunca root: o servico e dono do banco e dos
arquivos de imagem, e um WAL criado por root deixa o servico sem escrever.
"""

import json
import os
import sys
import time
from pathlib import Path

# ⚠️ OS CAMINHOS PRECISAM VIR ANTES DO IMPORT: server.py resolve DB_PATH e
# PUB_DIR no momento em que e carregado, e os PADRoES DELE APONTAM PARA OUTRO
# LUGAR (`/var/lib/ultrafoot/atualizacoes.db`, sem o subdiretorio). Sem estes
# valores — os mesmos de ultrafoot-atualizacoes.service — a carga cria um banco
# vazio paralelo, termina dizendo "gravados: N" e nada chega ao jogador.
os.environ.setdefault("ULTRAFOOT_ATU_DB", "/var/lib/ultrafoot/atualizacoes/atualizacoes.db")
os.environ.setdefault("ULTRAFOOT_ATU_PUB", "/var/www/ultrafoot/atualizacoes")

# Serve nos dois lugares onde este script roda: ao lado do server.py quando esta
# implantado em /opt/ultrafoot/atualizacoes, e sozinho em /tmp quando so o par
# JSON+script foi copiado.
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI if (AQUI / "server.py").exists() else Path("/opt/ultrafoot/atualizacoes")))
import server  # noqa: E402  (o modulo do servico, reaproveitado inteiro)

ensaio = "--ensaio" in sys.argv
publicar = "--publicar" in sys.argv
# ⚠️ A NOTA E ARGUMENTO, nao constante. Enquanto foi constante, o manifesto v11
# saiu anunciando o clube errado — e ninguem percebe, porque a nota so aparece
# para o jogador.
notas = sys.argv[sys.argv.index("--notas") + 1] if "--notas" in sys.argv else "Novos escudos"
soltos = [a for i, a in enumerate(sys.argv[1:], 1)
          if not a.startswith("--") and sys.argv[i - 1] != "--notas"]
if not soltos:
    sys.exit("uso: carregar-escudos.py <arquivo.json> [--ensaio] [--publicar] [--notas TEXTO]")
arquivo = soltos[0]

itens = json.load(open(arquivo, encoding="utf-8"))["clubes"]
print(f"banco  : {server.DB_PATH}")
print(f"imagens: {server.IMG_DIR}")
print(f"arquivo: {len(itens)} clubes")

con = server.conectar()
antes = con.execute("SELECT COUNT(*) FROM clubes").fetchone()[0]
com_escudo = con.execute("SELECT COUNT(*) FROM clubes WHERE escudo_sha IS NOT NULL").fetchone()[0]
print(f"clubes no banco antes: {antes} ({com_escudo} com escudo)")

# Quem ja tem escudo vai ser SUBSTITUIDO: vale dizer quais, antes de fazer.
chaves = [(j.get("file_key") or "").strip() for j in itens]
existentes = {r["file_key"] for r in con.execute(
    "SELECT file_key FROM clubes WHERE escudo_sha IS NOT NULL AND file_key IN (%s)"
    % ",".join("?" * len(chaves)), chaves)} if chaves else set()
if existentes:
    print(f"substituindo escudo de {len(existentes)}: {', '.join(sorted(existentes))}")

ok, falhas = 0, []
if not ensaio:
    with con:
        for j in itens:
            fk = (j.get("file_key") or "").strip()
            if not fk:
                falhas.append("item sem file_key")
                continue
            try:
                sha = server.guardar_imagem(con, j["escudo_data"], f"escudo:{fk}")
                # ⚠️ SO `escudo_sha`. O clube pode ja existir no banco com nome,
                # cores, estadio e uniforme vindos da carga inicial; um UPSERT
                # com as outras colunas as zeraria em silencio.
                con.execute(
                    "INSERT INTO clubes (file_key, escudo_sha, atualizado_em, rascunho)"
                    " VALUES (?,?,?,0)"
                    " ON CONFLICT(file_key) DO UPDATE SET escudo_sha=excluded.escudo_sha,"
                    " atualizado_em=excluded.atualizado_em, rascunho=0",
                    (fk, sha, int(time.time())),
                )
                ok += 1
            except Exception as e:  # um escudo torto nao derruba a carga inteira
                falhas.append(f"{fk}: {e}")
        server.registrar(con, None, "carga_escudos", f"{ok} escudos")

depois = con.execute("SELECT COUNT(*) FROM clubes").fetchone()[0]
print(f"gravados: {ok} | falhas: {len(falhas)} | clubes no banco agora: {depois}")
for f in falhas[:10]:
    print("  !", f)

if publicar and not ensaio:
    with con:
        r = server.publicar(con, None, notas)
    print("PUBLICADO:", r)
else:
    print("Nada publicado — o manifesto no ar continua o de antes.")
