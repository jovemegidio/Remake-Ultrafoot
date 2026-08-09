#!/usr/bin/env python3
"""Carga de TRANSFERENCIAS no banco de atualizacoes, rodando na VPS.

    sudo -u ultrafoot python3 carregar-transferencias.py transferencias.json --ensaio
    sudo -u ultrafoot python3 carregar-transferencias.py transferencias.json --publicar \
        --notas "Elencos 26/27: Atletico-MG, Gremio, Athletico-PR e Sport"

Irmao do carregar-fotos.py. E por aqui que a correcao de ELENCO chega ao jogador
sem instalador novo: o jogo aplica `de` como saida e `para` como chegada em
lib/players-data.ts, e o pacote fica gravado no disco — vale online e offline.

⚠️ O NOME E COMPARADO CRU, so em minuscula, SEM tirar acento. "Leo Duarte" nao
casa com "Léo Duarte" e a saida nao acontece, em silencio. Idem o clube.

⚠️ NAO REPETE: antes de inserir, procura a mesma (nome, de, para). Rodar duas
vezes duplicaria a chegada e o atleta apareceria dobrado no elenco.
"""
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("ULTRAFOOT_ATU_DB", "/var/lib/ultrafoot/atualizacoes/atualizacoes.db")
os.environ.setdefault("ULTRAFOOT_ATU_PUB", "/var/www/ultrafoot/atualizacoes")
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI if (AQUI / "server.py").exists() else Path("/opt/ultrafoot/atualizacoes")))
import server  # noqa: E402

ensaio = "--ensaio" in sys.argv
publicar = "--publicar" in sys.argv
notas = sys.argv[sys.argv.index("--notas") + 1] if "--notas" in sys.argv else "Atualizacao de elencos"
soltos = [a for i, a in enumerate(sys.argv[1:], 1)
          if not a.startswith("--") and sys.argv[i - 1] != "--notas"]
if not soltos:
    sys.exit("uso: carregar-transferencias.py <arquivo.json> [--ensaio] [--publicar] [--notas TEXTO]")

itens = json.load(open(soltos[0], encoding="utf-8"))["transferencias"]
con = server.conectar()
antes = con.execute("SELECT COUNT(*) FROM transferencias").fetchone()[0]
print(f"banco: {server.DB_PATH}")
print(f"transferencias no banco antes: {antes} | no arquivo: {len(itens)}")

novos, repetidos, falhas = 0, 0, []
if not ensaio:
    with con:
        for t in itens:
            nome = (t.get("nome") or "").strip()
            de, para = t.get("de"), t.get("para")
            if not nome or not (de or para):
                falhas.append(f"{nome}: faltou nome ou clube")
                continue
            ja = con.execute(
                "SELECT id FROM transferencias WHERE nome = ? AND IFNULL(de,'') = ? AND IFNULL(para,'') = ?",
                (nome, de or "", para or ""),
            ).fetchone()
            if ja:
                repetidos += 1
                continue
            con.execute(
                "INSERT INTO transferencias (nome, de, para, pos, idade, base, nac, criado_em, rascunho)"
                " VALUES (?,?,?,?,?,?,?,?,0)",
                (nome, de, para, t.get("pos"), t.get("idade"), t.get("base"), t.get("nac"), int(time.time())),
            )
            novos += 1
        server.registrar(con, None, "carga_transferencias", f"{novos} transferencias")

depois = con.execute("SELECT COUNT(*) FROM transferencias").fetchone()[0]
print(f"inseridas: {novos} | ja existiam: {repetidos} | falhas: {len(falhas)} | agora: {depois}")
for f in falhas[:10]:
    print("  !", f)

if publicar and not ensaio:
    with con:
        r = server.publicar(con, None, notas)
    print("PUBLICADO:", r)
else:
    print("Nada publicado — o manifesto no ar continua o de antes.")
