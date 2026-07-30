#!/usr/bin/env python3
"""Carga inicial DIRETO no banco, rodando na propria VPS.

    python3 importar-seed.py team-overrides.json            # importa
    python3 importar-seed.py team-overrides.json --publicar  # importa e publica

Por que existe, se o painel ja importa por HTTP: a carga inicial sao ~29 MB de
escudo e uniforme em base64. Mandar isso por HTTP significa atravessar o nginx,
o limite de corpo e a banda de subida de casa — para um dado que ja esta no
disco do servidor depois de um unico scp. Aqui o arquivo e lido localmente e
escrito direto no SQLite.

Tambem resolve o problema do ovo e da galinha: importar pelo painel exige um
token de administrador, e a primeira carga costuma acontecer antes de alguem ter
entrado no painel.

Roda como o usuario do servico (ultrafoot), senao os arquivos de imagem saem com
dono errado e o nginx nao consegue ler.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import server  # noqa: E402  (o modulo do servico, reaproveitado inteiro)


def converter(file_key: str, ov: dict) -> dict:
    clube = {"file_key": file_key}
    for origem, destino in (("nome", "nome"), ("nomeOficial", "nome_oficial"),
                            ("curto", "curto"), ("cor1", "cor1"), ("cor2", "cor2"),
                            ("prestigio", "prestigio"), ("estadio_nome", "estadio_nome"),
                            ("estadio_cap", "estadio_cap"), ("patrocinador", "patrocinador")):
        if ov.get(origem) not in (None, ""):
            clube[destino] = ov[origem]
    logo = ov.get("logoUrl")
    if isinstance(logo, str) and logo.startswith("data:"):
        clube["escudo_data"] = logo
    kits = {}
    for variante in ("home", "away", "third"):
        k = (ov.get("kits") or {}).get(variante)
        if not isinstance(k, dict):
            continue
        saida = {}
        for campo in ("primary", "secondary", "pattern"):
            if k.get(campo):
                saida[campo] = k[campo]
        if k.get("disabled"):
            saida["disabled"] = True
        img = k.get("imageUrl")
        if isinstance(img, str) and img.startswith("data:"):
            saida["data"] = img
        if saida:
            kits[variante] = saida
    if kits:
        clube["kits"] = kits
    return clube


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    fonte = Path(sys.argv[1])
    publicar_depois = "--publicar" in sys.argv

    seed = json.loads(fonte.read_text(encoding="utf-8"))
    server.iniciar_banco()
    server.PUB_DIR.mkdir(parents=True, exist_ok=True)
    server.IMG_DIR.mkdir(parents=True, exist_ok=True)

    ok = 0
    vazios = 0
    falhas = 0
    with server.conectar() as con:
        for file_key, ov in seed.items():
            if not isinstance(ov, dict):
                continue
            dados = converter(file_key, ov)
            if len(dados) <= 1:
                vazios += 1
                continue
            try:
                # Reaproveita a MESMA gravacao do painel: uma so regra de
                # validacao e de deduplicacao de imagem para os dois caminhos.
                escudo_sha = None
                if dados.get("escudo_data"):
                    escudo_sha = server.guardar_imagem(con, dados["escudo_data"], f"escudo:{file_key}")
                kits = {}
                for variante, k in (dados.get("kits") or {}).items():
                    saida = {c: k[c] for c in ("primary", "secondary", "pattern") if k.get(c)}
                    if k.get("disabled"):
                        saida["disabled"] = True
                    if k.get("data"):
                        saida["sha"] = server.guardar_imagem(con, k["data"], f"kit:{file_key}:{variante}")
                    if saida:
                        kits[variante] = saida
                con.execute(
                    "INSERT INTO clubes (file_key, nome, nome_oficial, curto, cor1, cor2,"
                    " prestigio, estadio_nome, estadio_cap, patrocinador, escudo_sha,"
                    " kits_json, atualizado_em, rascunho) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)"
                    " ON CONFLICT(file_key) DO UPDATE SET nome=excluded.nome,"
                    " nome_oficial=excluded.nome_oficial, curto=excluded.curto,"
                    " cor1=excluded.cor1, cor2=excluded.cor2, prestigio=excluded.prestigio,"
                    " estadio_nome=excluded.estadio_nome, estadio_cap=excluded.estadio_cap,"
                    " patrocinador=excluded.patrocinador,"
                    " escudo_sha=COALESCE(excluded.escudo_sha, clubes.escudo_sha),"
                    " kits_json=excluded.kits_json, atualizado_em=excluded.atualizado_em",
                    (file_key, dados.get("nome"), dados.get("nome_oficial"), dados.get("curto"),
                     dados.get("cor1"), dados.get("cor2"), dados.get("prestigio"),
                     dados.get("estadio_nome"), dados.get("estadio_cap"), dados.get("patrocinador"),
                     escudo_sha, json.dumps(kits, ensure_ascii=False),
                     int(__import__("time").time())))
                ok += 1
            except Exception as e:
                falhas += 1
                print(f"  ! {file_key}: {e}")

        print(f"importados: {ok} | sem conteudo: {vazios} | falhas: {falhas}")
        if publicar_depois:
            r = server.publicar(con, None, "Carga inicial: escudos, uniformes e cores dos clubes")
            print(f"publicado: versao {r['versao']} — {r['clubes']} clubes, {r['bytes']} bytes")


if __name__ == "__main__":
    main()
