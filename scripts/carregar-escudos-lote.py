#!/usr/bin/env python3
"""Carrega um lote de ESCUDOS no banco do canal, sem tocar em mais nada.

    sudo -u ultrafoot python3 carregar-escudos-lote.py escudos.json [--publicar]

Entrada: a saida do `scripts/publicar-escudos-pasta.mjs`, ou seja
`{"clubes": [{"file_key": ..., "escudo_data": "data:image/webp;base64,..."}]}`.

POR QUE NAO USAR O `importar-seed.py`:

    O importador existente faz
        INSERT ... ON CONFLICT(file_key) DO UPDATE SET
            nome=excluded.nome, ..., kits_json=excluded.kits_json,
            escudo_sha=COALESCE(excluded.escudo_sha, clubes.escudo_sha)

    So o ESCUDO tem COALESCE. Todo o resto e sobrescrito pelo que vier no
    arquivo — e um lote de escudos nao traz uniforme nenhum, entao `kits_json`
    viraria `{}`. Medido em 10/08/2026 antes de rodar: dos 470 clubes do lote,
    263 tinham uniforme publicado no canal. O importador teria apagado os 263,
    em silencio, e o jogador veria o time voltar para a camisa generica.

    Aquele importador esta certo para o que ele faz (carga INICIAL, a partir do
    team-overrides completo, onde o arquivo e a verdade inteira). Aqui a verdade
    e parcial: so o escudo. Por isso um UPDATE de uma coluna so.

A gravacao da imagem reusa `server.guardar_imagem`, o mesmo caminho do painel —
uma so regra de deduplicacao por sha para os dois.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import server  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    fonte = Path(sys.argv[1])
    publicar_depois = "--publicar" in sys.argv
    lote = json.loads(fonte.read_text(encoding="utf-8"))
    clubes = lote.get("clubes") or []
    if not clubes:
        print("lote vazio — nada a fazer")
        sys.exit(1)

    server.iniciar_banco()
    server.PUB_DIR.mkdir(parents=True, exist_ok=True)
    server.IMG_DIR.mkdir(parents=True, exist_ok=True)

    novos = atualizados = iguais = falhas = 0
    agora = int(time.time())

    with server.conectar() as con:
        for item in clubes:
            file_key = item.get("file_key")
            data = item.get("escudo_data")
            if not file_key or not data:
                continue
            try:
                sha = server.guardar_imagem(con, data, f"escudo:{file_key}")
                linha = con.execute(
                    "SELECT escudo_sha FROM clubes WHERE file_key=?", (file_key,)
                ).fetchone()

                if linha is None:
                    # Clube que ainda nao existe no canal: cria com o escudo e
                    # NADA mais. kits_json vazio aqui e o estado real (nao ha
                    # uniforme a preservar), nao uma sobrescrita.
                    con.execute(
                        "INSERT INTO clubes (file_key, escudo_sha, kits_json,"
                        " atualizado_em, rascunho) VALUES (?,?,?,?,0)",
                        (file_key, sha, "{}", agora),
                    )
                    novos += 1
                elif linha[0] == sha:
                    iguais += 1
                else:
                    # UMA coluna. `kits_json`, cores e nome ficam como estao.
                    con.execute(
                        "UPDATE clubes SET escudo_sha=?, atualizado_em=? WHERE file_key=?",
                        (sha, agora, file_key),
                    )
                    atualizados += 1
            except Exception as e:  # noqa: BLE001
                falhas += 1
                print(f"  ! {file_key}: {e}")

        print(
            f"novos: {novos} | escudo trocado: {atualizados} | "
            f"ja identicos: {iguais} | falhas: {falhas}"
        )

        if publicar_depois:
            r = server.publicar(con, None, "Lote de escudos 1.0.283")
            print(f"publicado: versao {r['versao']} — {r['clubes']} clubes, {r['bytes']} bytes")


if __name__ == "__main__":
    main()
