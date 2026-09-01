# Pendente: espelhar a 1.0.386 na VPS

**Estado em 01/09/2026:** a 1.0.386 foi publicada no **GitHub** (instalador,
assinatura e `latest.json` — o canal que o updater de dentro do jogo lê). O
espelho na **VPS não foi feito** porque o servidor está inacessível.

## O que foi medido, não suposto

    porta 22   timeout
    porta 80   timeout
    porta 443  timeout
    ping       2 enviados, 0 recebidos (100% de perda)

Testado duas vezes, com minutos de intervalo. **Não é a rede daqui**: no mesmo
momento `https://api.github.com` respondia 200 e o `gh` operava normalmente. O
domínio resolve certo (`ultrafoot.179-198-103-30.sslip.io` → 179.198.103.30) — é
o host que não responde.

⚠️ **Isso não é efeito da publicação.** Com a VPS fora, a versão web do jogo e a
página de download já estão offline para todo mundo, e o painel de admin também.
Resolver o servidor é o item mais urgente, antes do espelho.

## O que fica desatualizado enquanto isso

| canal | estado |
|---|---|
| GitHub `latest.json` (updater do jogo) | **1.0.386** |
| VPS `/downloads/` (página de download) | 1.0.384 |
| VPS manifesto / delta do launcher | 1.0.384 |
| Novidades e changelog do launcher | 1.0.384 |

O jogador que já tem o jogo instalado **recebe a 1.0.386 normalmente**, porque o
updater lê o GitHub. Quem for baixar pelo site não consegue baixar nada enquanto
a VPS estiver fora.

## Como retomar quando a VPS voltar

Rodar da árvore que compilou (`C:\UF372-clone`), com a chave SSH:

```bash
cd /c/UF372-clone
export ULTRAFOOT_VPS_KEY=~/.ssh/id_ed25519_vps   # confirmar qual chave é a da VPS
ULTRAFOOT_DISCO=C:/UF372-clone node scripts/deploy-tudo.mjs --publicar --so-jogo
```

⚠️ **O script é idempotente na parte do GitHub** (`publish-release.mjs` refaz o
upload com `--clobber`), então rodá-lo de novo é seguro: ele republica o que já
está certo e completa o que faltou.

⚠️ **Se `espelharNaVps` falhar com `curl (92) HTTP/2 PROTOCOL_ERROR`** — já
aconteceu na 1.0.244 —, repetir só o espelho com
`curl --http1.1 --retry 5 --retry-all-errors`, depois `mv .novo-<nome> <nome>`,
`chmod 644`, mandar o `latest.json` da VPS à mão e rodar
`node scripts/publicar-launcher-config.mjs --publicar` (ele vem DEPOIS no script,
então o changelog fica anunciando a versão velha se o deploy morreu no meio).

## Conferir pelo CORPO, nunca pelo status

O nginx deste site responde **200 com o index.html do jogo** para qualquer
caminho que não exista. Testar por "HTTP 200" já fez anunciar duas vezes que algo
estava no ar quando o servidor devolvia a página do jogo.

```bash
curl -s "https://ultrafoot.179-198-103-30.sslip.io/downloads/latest.json?cb=$(date +%s)" | head -c 200
```

Tem de vir JSON com `"version": "1.0.386"`.
