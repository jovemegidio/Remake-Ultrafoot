#!/usr/bin/env python3
"""Carrega um lote de FOTOS de atleta no canal, sem tocar em mais nada.

    sudo -u ultrafoot python3 carregar-fotos-lote.py fotos.json [--publicar]

Entrada: a saida do `scripts/publicar-fotos-catalogo.mjs`, ou seja
`{"jogadores": [{"file_key": ..., "nome_original": ..., "foto_data": "data:..."}]}`.

POR QUE NAO CHAMAR O `_salvar_jogador` DO PAINEL:

    Aquele caminho recebe a FICHA INTEIRA do atleta e faz
        ON CONFLICT(chave) DO UPDATE SET nome=excluded.nome, pos=excluded.pos,
        base=excluded.base, idade=excluded.idade, nac=excluded.nac,
        foto_sha=COALESCE(excluded.foto_sha, jogadores.foto_sha)

    So a FOTO tem COALESCE. Um lote de rosto nao traz nome, posicao, idade nem
    nacionalidade — passar por ali gravaria NULL em todas elas e apagaria as
    edicoes de quem ja tinha ficha no canal. O sintoma seria mudo: o atleta
    continua no jogo, mas volta ao dado do seed.

    Por isso aqui e UPDATE de uma coluna so, e a `chave` sai de
    `server.chave_jogador` — a mesma normalizacao do jogo. Chave diferente e
    edicao que nunca encontra o atleta, tambem sem erro visivel.
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
    jogadores = (json.loads(fonte.read_text(encoding="utf-8")).get("jogadores")) or []
    if not jogadores:
        print("lote vazio — nada a fazer")
        sys.exit(1)

    server.iniciar_banco()
    server.PUB_DIR.mkdir(parents=True, exist_ok=True)
    server.IMG_DIR.mkdir(parents=True, exist_ok=True)

    novos = trocados = iguais = falhas = 0
    ficha_preservada = 0
    agora = int(time.time())

    with server.conectar() as con:
        for item in jogadores:
            fk = (item.get("file_key") or "").strip()
            original = (item.get("nome_original") or "").strip()
            data = item.get("foto_data")
            if not fk or not original or not data:
                continue
            try:
                chave = server.chave_jogador(fk, original)
                sha = server.guardar_imagem(con, data, f"face:{chave}")
                linha = con.execute(
                    "SELECT foto_sha, nome, pos, idade FROM jogadores WHERE chave=?",
                    (chave,),
                ).fetchone()

                if linha is None:
                    con.execute(
                        "INSERT INTO jogadores (chave, file_key, nome_original, foto_sha,"
                        " atualizado_em, rascunho) VALUES (?,?,?,?,?,0)",
                        (chave, fk, original, sha, agora),
                    )
                    novos += 1
                elif linha[0] == sha:
                    iguais += 1
                else:
                    if any(v not in (None, "") for v in linha[1:]):
                        ficha_preservada += 1
                    con.execute(
                        "UPDATE jogadores SET foto_sha=?, atualizado_em=? WHERE chave=?",
                        (sha, agora, chave),
                    )
                    trocados += 1
            except Exception as e:  # noqa: BLE001
                falhas += 1
                print(f"  ! {fk}/{original}: {e}")

        print(
            f"novos: {novos} | foto trocada: {trocados} | ja identicos: {iguais} | "
            f"falhas: {falhas}"
        )
        print(f"fichas preservadas (tinham nome/pos/idade): {ficha_preservada}")

        if publicar_depois:
            r = server.publicar(con, None, "Lote de fotos 1.0.283")
            print(f"publicado: versao {r['versao']} — {r['clubes']} clubes, {r['bytes']} bytes")


if __name__ == "__main__":
    main()
