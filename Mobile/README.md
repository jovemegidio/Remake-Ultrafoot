# Ultrafoot de Bolso (mobile)

App Android (Expo) que é a **cópia perfeita do Ultrafoot 26**: ele carrega o **jogo
web** dentro de um WebView. Ou seja, é o mesmo jogo do PC, no celular.

- Roda no **Expo Go** (teste) e vira **APK** (via EAS) para instalar direto.
- O jogo em si roda a partir de uma **URL hospedada** (Vercel). O app só precisa apontar
  para essa URL — por isso o APK é leve.

## Passo 1 — O jogo já está hospedado

A versão web roda na VPS própria, em `https://ultrafoot.179-198-103-30.sslip.io`
(ver `scripts/deploy-web-vps.sh` na raiz). Não é mais a Vercel.

## Passo 2 — Conferir para onde o app aponta

`src/uf/config.ts` guarda o `GAME_URL`. **Ele já aponta para a VPS certa** — mas
confira antes de gerar APK.

⚠️ Isto já esteve errado: até 29/07/2026 o valor era o da VPS antiga, desligada
em 28/07, e o app abria numa tela que nunca carregava. Enquanto não houver
domínio próprio, toda troca de servidor exige mexer aqui e publicar APK novo.

## Passo 3 — Testar no Expo Go

```bash
cd Mobile
npm install
npx expo start          # escaneie o QR no app Expo Go (Android)
```

## Passo 4 — Gerar o APK (EAS)

```bash
cd Mobile
npm install -g eas-cli          # ou use: npx eas-cli@latest
eas login                        # >>> VOCÊ loga na SUA conta Expo <<<
eas build -p android --profile preview   # gera o APK na nuvem; sai um link p/ baixar
```

O perfil `preview` (em `eas.json`) produz um **APK** (`buildType: apk`) para instalação
direta. Para a Play Store depois, use o perfil `production` (gera `.aab`).

## Estrutura

- `src/app/index.tsx` — o WebView que carrega o jogo: tela de carregamento, tela de
  erro **com botão de tentar de novo**, botão físico "voltar" navegando dentro do
  jogo e recuperação de quando o Android mata o renderizador.
- `src/app/_layout.tsx` — stack simples, sem cabeçalho (o jogo ocupa a tela toda).
- `src/uf/config.ts` — **a URL do jogo** (é o que você configura).
- `src/uf/theme.ts` — cores da tela de carregamento.
- `eas.json` — perfis de build (APK/AAB).

## Observações

- Recursos nativos do desktop (anti-cheat UltraShield, Discord Rich Presence, atalhos)
  não existem no navegador/WebView — o jogo já tem fallback web para esses casos.
- **Salvamento na nuvem funciona** (29/07/2026). A carreira mora no `localStorage`
  da WebView — que some se o app for desinstalado ou os dados limpos —, mas a tela
  de salvar do jogo envia tudo para a VPS sob um código de 6 caracteres, e o mesmo
  código traz a carreira de volta em qualquer aparelho ou no PC. Ele chama
  `/save/...` **relativo**, ou seja, no mesmo servidor do `GAME_URL`: apontar o app
  para um host sem o cloud-save-server atrás quebra o salvamento em silêncio.
- Se a tela ficar em "Carregando o jogo…" e depois mostrar erro, há um botão
  **Tentar de novo**. Ele recria a WebView do zero — é o que recupera o caso em que
  o Android encerra o renderizador por falta de memória (antes disso, a tela ficava
  branca para sempre).

## 1.0.1 do app (30/07/2026)

Três acertos de uso, nenhum deles no jogo em si — só na casca:

- **A tela gira.** O `orientation` era `portrait` travado, e o Ultrafoot tem layout
  largo (escalação, radar, tabela). Agora é `default`: quem quiser joga deitado.
- **"Voltar" na raiz pede confirmação.** A carreira mora no `localStorage` da
  WebView; um toque errado no menu principal fechava o app na hora. Agora o
  primeiro toque só avisa (toast) e o segundo, dentro de 2s, sai.
- **Volta do segundo plano se recupera sozinha.** Quando o Android encerra o
  renderizador com o app em background, o app agora recarrega ao voltar em vez de
  esperar um toque em "Tentar de novo".
- A **versão do app** aparece na tela de carregamento/erro (`app 1.0.1`). É a
  primeira pergunta de qualquer suporte e não havia onde ler.
