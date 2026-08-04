#!/usr/bin/env python3
"""Carga de UNIFORMES no banco de atualizacoes, rodando na propria VPS.

    sudo -u ultrafoot python3 carregar-camisas.py camisas.json --ensaio
    sudo -u ultrafoot python3 carregar-camisas.py camisas.json --publicar \\
        --notas "Uniformes licenciados: Premier League, Serie A, La Liga..."

Irmao do carregar-escudos.py, pelo mesmo motivo: o arquivo tem megabytes de
imagem em base64, ja esta no disco do servidor depois de um scp, e escrever
direto no SQLite evita o token de administrador, o limite de corpo do nginx e a
banda de subida de casa.

De onde vem o JSON: `node scripts/publicar-camisas-pasta.mjs --raiz "<pasta>"
--somente "<ligas>" --exportar camisas.json`, rodado de um diretorio com
node_modules (C:\\Ultrafoot — o `sharp` nao existe no G:).

⚠️ NAO USE O importar-seed.py PARA ISTO. Ele grava o clube INTEIRO e um arquivo
que so tem uniforme apagaria nome, cores, estadio e ESCUDO dos 779 clubes que ja
estao no banco. Aqui a unica coluna tocada e `kits_json`.

⚠️ E O `kits_json` E MESCLADO, NAO SUBSTITUIDO. E um blob com as tres variantes;
gravar so `home` e `away` por cima apagaria o `third` que ja estava la, e o
jogador perderia o terceiro uniforme sem ninguem entender por que. Variante que
o pacote nao traz fica como estava.

Rode como o usuario `ultrafoot`, nunca root: o servico e dono do banco e dos
arquivos de imagem, e um WAL criado por root deixa o servico sem escrever.
"""

import json
import os
import sys
import time
from pathlib import Path

# ⚠️ OS CAMINHOS PRECISAM VIR ANTES DO IMPORT: server.py resolve DB_PATH e
# PUB_DIR no momento em que e carregado, e os padroes DELE apontam para outro
# lugar. Sem estes valores a carga cria um banco vazio paralelo, termina dizendo
# "gravados: N" e nada chega ao jogador.
os.environ.setdefault("ULTRAFOOT_ATU_DB", "/var/lib/ultrafoot/atualizacoes/atualizacoes.db")
os.environ.setdefault("ULTRAFOOT_ATU_PUB", "/var/www/ultrafoot/atualizacoes")

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI if (AQUI / "server.py").exists() else Path("/opt/ultrafoot/atualizacoes")))
import server  # noqa: E402  (o modulo do servico, reaproveitado inteiro)

VARIANTES = ("home", "away", "third")

ensaio = "--ensaio" in sys.argv
publicar = "--publicar" in sys.argv
notas = sys.argv[sys.argv.index("--notas") + 1] if "--notas" in sys.argv else "Novos uniformes"
soltos = [a for i, a in enumerate(sys.argv[1:], 1)
          if not a.startswith("--") and sys.argv[i - 1] != "--notas"]
if not soltos:
    sys.exit("uso: carregar-camisas.py <arquivo.json> [--ensaio] [--publicar] [--notas TEXTO]")

itens = json.load(open(soltos[0], encoding="utf-8"))["clubes"]
print(f"banco  : {server.DB_PATH}")
print(f"imagens: {server.IMG_DIR}")
print(f"arquivo: {len(itens)} clubes, "
      f"{sum(len(j.get('kits') or {}) for j in itens)} uniformes")

con = server.conectar()
antes = con.execute("SELECT COUNT(*) FROM clubes").fetchone()[0]
com_kit = con.execute(
    "SELECT COUNT(*) FROM clubes WHERE kits_json IS NOT NULL AND kits_json NOT IN ('', '{}')"
).fetchone()[0]
print(f"clubes no banco antes: {antes} ({com_kit} com uniforme)")

ok, variantes_gravadas, falhas = 0, 0, []
if not ensaio:
    with con:
        for j in itens:
            fk = (j.get("file_key") or "").strip()
            novos = j.get("kits") or {}
            if not fk or not novos:
                falhas.append(f"{fk or '?'}: sem file_key ou sem uniforme")
                continue
            try:
                linha = con.execute("SELECT kits_json FROM clubes WHERE file_key = ?", (fk,)).fetchone()
                try:
                    atuais = json.loads(linha["kits_json"]) if linha and linha["kits_json"] else {}
                except Exception:
                    atuais = {}  # blob corrompido: melhor recomecar do que abortar

                for variante in VARIANTES:
                    novo = novos.get(variante)
                    if not novo or not novo.get("data"):
                        continue  # variante ausente PERMANECE como estava
                    sha = server.guardar_imagem(con, novo["data"], f"kit:{fk}:{variante}")
                    # Preserva cor e padrao que ja existiam nesta variante: o
                    # pacote so traz a imagem, e o manifesto le os tres campos.
                    anterior = atuais.get(variante) or {}
                    atuais[variante] = {**anterior, "sha": sha}
                    atuais[variante].pop("disabled", None)
                    variantes_gravadas += 1

                con.execute(
                    "INSERT INTO clubes (file_key, kits_json, atualizado_em, rascunho)"
                    " VALUES (?,?,?,0)"
                    " ON CONFLICT(file_key) DO UPDATE SET kits_json=excluded.kits_json,"
                    " atualizado_em=excluded.atualizado_em, rascunho=0",
                    (fk, json.dumps(atuais, ensure_ascii=False), int(time.time())),
                )
                ok += 1
            except Exception as e:  # uma camisa torta nao derruba a carga inteira
                falhas.append(f"{fk}: {e}")
        server.registrar(con, None, "carga_camisas", f"{ok} clubes, {variantes_gravadas} uniformes")

depois = con.execute("SELECT COUNT(*) FROM clubes").fetchone()[0]
print(f"gravados: {ok} clubes / {variantes_gravadas} uniformes | falhas: {len(falhas)}"
      f" | clubes no banco agora: {depois}")
for f in falhas[:10]:
    print("  !", f)

if publicar and not ensaio:
    with con:
        r = server.publicar(con, None, notas)
    print("PUBLICADO:", r)
else:
    print("Nada publicado — o manifesto no ar continua o de antes.")
