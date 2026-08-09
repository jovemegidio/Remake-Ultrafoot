#!/usr/bin/env python3
"""Carga de RETRATOS no banco de atualizacoes, rodando na propria VPS.

    sudo -u ultrafoot python3 carregar-fotos.py fotos-flamengo.json --ensaio
    sudo -u ultrafoot python3 carregar-fotos.py fotos-flamengo.json --publicar \
        --notas "Rostos licenciados: Flamengo"

Irmao do importar-seed.py, pelo mesmo motivo: o arquivo tem megabytes de imagem
em base64, ja esta no disco do servidor depois de um scp, e escrever direto no
SQLite evita o token de administrador, o limite de corpo do nginx e a banda de
subida de casa.

De onde vem o JSON: `node scripts/publicar-fotos-catalogo.mjs --exportar
fotos-<clube>.json <fileKey>="<pasta do catalogo DF11>"`, rodado de um diretorio
com node_modules (C:\\Ultrafoot — o `sharp` nao existe no G:). Confira as linhas
"por sobrenome" do ensaio: sao a unica parte do casamento que nao e igualdade, e
portanto a unica que pode colar o rosto errado.

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
# (Cruzeiro e Sao Paulo) saiu anunciando "Corinthians e Cruzeiro" — e ninguem
# percebe, porque a nota so aparece para o jogador.
notas = sys.argv[sys.argv.index("--notas") + 1] if "--notas" in sys.argv else "Novos retratos"
soltos = [a for i, a in enumerate(sys.argv[1:], 1)
          if not a.startswith("--") and sys.argv[i - 1] != "--notas"]
if not soltos:
    sys.exit("uso: carregar-fotos.py <arquivo.json> [--ensaio] [--publicar] [--notas TEXTO]")
arquivo = soltos[0]

itens = json.load(open(arquivo, encoding="utf-8"))["jogadores"]
print(f"banco  : {server.DB_PATH}")
print(f"imagens: {server.IMG_DIR}")
print(f"arquivo: {len(itens)} atletas")

con = server.conectar()
antes = con.execute("SELECT COUNT(*) FROM jogadores").fetchone()[0]
print(f"jogadores no banco antes: {antes}")

ok, falhas = 0, []
if not ensaio:
    with con:
        for j in itens:
            fk = (j.get("file_key") or "").strip()
            original = (j.get("nome_original") or "").strip()
            if not fk or not original:
                falhas.append(f"{fk}/{original}: faltou clube ou nome")
                continue
            chave = server.chave_jogador(fk, original)
            try:
                sha = server.guardar_imagem(con, j["foto_data"], f"face:{chave}")
                con.execute(
                    "INSERT INTO jogadores (chave, file_key, nome_original, foto_sha,"
                    " atualizado_em, rascunho) VALUES (?,?,?,?,?,0)"
                    " ON CONFLICT(chave) DO UPDATE SET foto_sha=excluded.foto_sha,"
                    " atualizado_em=excluded.atualizado_em, rascunho=0",
                    (chave, fk, original, sha, int(time.time())),
                )
                ok += 1
            except Exception as e:  # uma foto torta nao derruba a carga inteira
                falhas.append(f"{chave}: {e}")
        server.registrar(con, None, "carga_fotos", f"{ok} retratos")

depois = con.execute("SELECT COUNT(*) FROM jogadores").fetchone()[0]
print(f"gravados: {ok} | falhas: {len(falhas)} | jogadores no banco agora: {depois}")
for f in falhas[:10]:
    print("  !", f)

if publicar and not ensaio:
    with con:
        r = server.publicar(con, None, notas)
    print("PUBLICADO:", r)
else:
    print("Nada publicado — o manifesto no ar continua o de antes.")
