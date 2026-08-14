#!/usr/bin/env python3
"""Carrega um lote de UNIFORMES no banco do canal, sem tocar em mais nada.

    sudo -u ultrafoot python3 carregar-uniformes-lote.py uniformes.json [--publicar]

Entrada: a saida do `scripts/publicar-uniformes-pasta.mjs`, ou seja
`{"clubes": [{"file_key": ..., "kits": {"home": {"data": "data:..."}, ...}}]}`.

DUAS PROTECOES, as duas vindas de erro real:

 1. NAO MEXE NO ESCUDO. O `importar-seed.py` sobrescreve a linha inteira do
    clube; um lote de uniforme nao traz escudo, entao usa-lo aqui zeraria
    `nome`, `cor1`, `cor2`... Aqui e UPDATE de uma coluna so (`kits_json`).

 2. MESCLA VARIANTE A VARIANTE, nao substitui o conjunto. Se o canal ja publicou
    o `home` de um clube e este lote traz so o `away`, gravar o lote inteiro por
    cima apagaria o `home` — o clube perderia o uniforme principal e ninguem
    veria erro. As variantes que o lote nao traz ficam como estao.

A imagem passa por `server.guardar_imagem`, o mesmo caminho do painel: uma so
regra de deduplicacao por sha.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import server  # noqa: E402

VARIANTES = ("home", "away", "third")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    fonte = Path(sys.argv[1])
    publicar_depois = "--publicar" in sys.argv
    clubes = (json.loads(fonte.read_text(encoding="utf-8")).get("clubes")) or []
    if not clubes:
        print("lote vazio — nada a fazer")
        sys.exit(1)

    server.iniciar_banco()
    server.PUB_DIR.mkdir(parents=True, exist_ok=True)
    server.IMG_DIR.mkdir(parents=True, exist_ok=True)

    novos = mexidos = iguais = falhas = 0
    pecas_novas = pecas_preservadas = 0
    agora = int(time.time())

    with server.conectar() as con:
        for item in clubes:
            file_key = item.get("file_key")
            kits_novos = item.get("kits") or {}
            if not file_key or not kits_novos:
                continue
            try:
                linha = con.execute(
                    "SELECT kits_json FROM clubes WHERE file_key=?", (file_key,)
                ).fetchone()
                atuais = {}
                if linha and linha[0]:
                    try:
                        atuais = json.loads(linha[0]) or {}
                    except json.JSONDecodeError:
                        atuais = {}

                final = dict(atuais)
                mudou = False
                for variante in VARIANTES:
                    k = kits_novos.get(variante)
                    if not isinstance(k, dict):
                        if variante in atuais:
                            pecas_preservadas += 1
                        continue
                    saida = {c: k[c] for c in ("primary", "secondary", "pattern") if k.get(c)}
                    if k.get("disabled"):
                        saida["disabled"] = True
                    if k.get("data"):
                        saida["sha"] = server.guardar_imagem(
                            con, k["data"], f"kit:{file_key}:{variante}"
                        )
                    if not saida:
                        continue
                    if atuais.get(variante) != saida:
                        final[variante] = saida
                        mudou = True
                        pecas_novas += 1

                if linha is None:
                    con.execute(
                        "INSERT INTO clubes (file_key, kits_json, atualizado_em, rascunho)"
                        " VALUES (?,?,?,0)",
                        (file_key, json.dumps(final, ensure_ascii=False), agora),
                    )
                    novos += 1
                elif mudou:
                    con.execute(
                        "UPDATE clubes SET kits_json=?, atualizado_em=? WHERE file_key=?",
                        (json.dumps(final, ensure_ascii=False), agora, file_key),
                    )
                    mexidos += 1
                else:
                    iguais += 1
            except Exception as e:  # noqa: BLE001
                falhas += 1
                print(f"  ! {file_key}: {e}")

        print(
            f"novos: {novos} | uniforme trocado: {mexidos} | ja identicos: {iguais} | "
            f"falhas: {falhas}"
        )
        print(f"pecas gravadas: {pecas_novas} | variantes preservadas: {pecas_preservadas}")

        if publicar_depois:
            r = server.publicar(con, None, "Lote de uniformes 1.0.283")
            print(f"publicado: versao {r['versao']} — {r['clubes']} clubes, {r['bytes']} bytes")


if __name__ == "__main__":
    main()
