#!/usr/bin/env python3
"""Troca, no banco do canal, imagens PNG pela versao WEBP SEM PERDAS.

    sudo -u ultrafoot ULTRAFOOT_ATU_DB=... ULTRAFOOT_ATU_PUB=... \\
        python3 trocar-imagens-por-webp.py troca.json [--publicar] [--apagar-orfaos]

Entrada: a saida do `scripts/converter-canal-para-webp.mjs`, ou seja
`{"trocas": [{"sha": "<sha do png>", "data": "data:image/webp;base64,..."}]}`.

O sha e o NOME do arquivo e tambem a chave em `clubes.escudo_sha`,
`clubes.kits_json` e `jogadores.foto_sha`. Trocar a imagem muda o sha, entao os
tres lugares precisam ser reescritos na MESMA transacao — um deles de fora
deixaria o clube apontando para um arquivo que ninguem mais serve.

⚠️ `kits_json` NAO da para tratar com UPDATE simples: o sha mora dentro de um
JSON com uma entrada por variante (`{"home": {"sha": ...}, "away": ...}`). E
preciso ler, trocar a variante certa e regravar — a mesma licao do
carregar-uniformes-lote.py, que mescla variante a variante em vez de
sobrescrever o conjunto.

⚠️ O PNG antigo NAO e apagado por padrao. Enquanto o manifesto anterior estiver
no ar, ha cliente pedindo aquela URL. `--apagar-orfaos` remove tudo que o banco
nao referencia mais — rode depois de publicar, nao antes.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import server  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    arquivo = sys.argv[1]
    publicar = "--publicar" in sys.argv
    apagar = "--apagar-orfaos" in sys.argv

    with open(arquivo, encoding="utf-8") as f:
        pacote = json.load(f)
    trocas = pacote.get("trocas") or []
    print(f"{len(trocas)} imagens no pacote")

    con = server.conectar()
    escudos = fotos = kits = 0
    falhas = []

    for t in trocas:
        antigo = (t.get("sha") or "").strip()
        data = t.get("data") or ""
        if not antigo or not data:
            falhas.append(antigo or "(sem sha)")
            continue
        try:
            novo = server.guardar_imagem(con, data, origem="conversao-webp")
        except Exception as e:  # noqa: BLE001
            falhas.append(f"{antigo}: {e}")
            continue
        if novo == antigo:
            continue

        cur = con.execute("UPDATE clubes SET escudo_sha=? WHERE escudo_sha=?", (novo, antigo))
        escudos += cur.rowcount
        cur = con.execute("UPDATE jogadores SET foto_sha=? WHERE foto_sha=?", (novo, antigo))
        fotos += cur.rowcount

        # kits_json: o sha esta aninhado por variante.
        linhas = con.execute(
            "SELECT file_key, kits_json FROM clubes WHERE kits_json LIKE ?", (f"%{antigo}%",)
        ).fetchall()
        for file_key, kj in linhas:
            try:
                d = json.loads(kj or "{}")
            except json.JSONDecodeError:
                falhas.append(f"{file_key}: kits_json invalido")
                continue
            mudou = False
            for variante, v in d.items():
                if isinstance(v, dict) and v.get("sha") == antigo:
                    v["sha"] = novo
                    mudou = True
            if mudou:
                con.execute(
                    "UPDATE clubes SET kits_json=? WHERE file_key=?",
                    (json.dumps(d, ensure_ascii=False), file_key),
                )
                kits += 1

    con.commit()
    print(f"escudos: {escudos} | fotos: {fotos} | clubes com kit reescrito: {kits} | falhas: {len(falhas)}")
    for f in falhas[:20]:
        print("  !", f)

    if publicar:
        print(server.publicar(con, None, "Imagens do canal convertidas para webp sem perdas"))
        con.commit()

    if apagar:
        usados = set()
        usados |= {r[0] for r in con.execute("SELECT escudo_sha FROM clubes WHERE escudo_sha IS NOT NULL")}
        usados |= {r[0] for r in con.execute("SELECT foto_sha FROM jogadores WHERE foto_sha IS NOT NULL")}
        for (kj,) in con.execute("SELECT kits_json FROM clubes WHERE kits_json IS NOT NULL"):
            try:
                d = json.loads(kj or "{}")
            except json.JSONDecodeError:
                continue
            for v in d.values():
                if isinstance(v, dict) and v.get("sha"):
                    usados.add(v["sha"])
        pasta = Path(os.environ["ULTRAFOOT_ATU_PUB"]) / "img"
        n = bytes_ = 0
        for f in pasta.iterdir():
            if not f.is_file():
                continue
            if f.name.rsplit(".", 1)[0] in usados:
                continue
            bytes_ += f.stat().st_size
            f.unlink()
            n += 1
        # ⚠️ NAO monte um `NOT IN (?,?,?...)` com milhares de shas: o SQLite tem
        # teto de variaveis por consulta e a limpeza falharia so quando o canal
        # crescesse. Tabela temporaria resolve e ainda usa indice.
        con.execute("CREATE TEMP TABLE IF NOT EXISTS _usados (sha TEXT PRIMARY KEY)")
        con.execute("DELETE FROM _usados")
        con.executemany("INSERT OR IGNORE INTO _usados (sha) VALUES (?)", [(s,) for s in usados])
        con.execute("DELETE FROM imagens WHERE sha NOT IN (SELECT sha FROM _usados)")
        con.commit()
        print(f"orfaos apagados: {n} ({bytes_ / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
