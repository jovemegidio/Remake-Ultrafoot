# Ultrafoot de Bolso (mobile)

App Android (Expo) que é a **cópia perfeita do Ultrafoot 26**: ele carrega o **jogo
web** dentro de um WebView. Ou seja, é o mesmo jogo do PC, no celular.

- Roda no **Expo Go** (teste) e vira **APK** (via EAS) para instalar direto.
- O jogo em si roda a partir de uma **URL hospedada** (Vercel). O app só precisa apontar
  para essa URL — por isso o APK é leve.

## Passo 1 — Hospedar o jogo (Vercel)

O jogo é um app Next.js com `output: export`. No projeto do JOGO (raiz do Ultrafoot):

```bash
npm run build            # gera a versão web em out/  (rode em disco local, ex.: C:)
npx vercel deploy --prebuilt --prod   # publica o out/ na Vercel (faz login na 1ª vez)
```

Anote a URL final (ex.: `https://ultrafoot.vercel.app`).

## Passo 2 — Apontar o app para o jogo

Edite **`src/uf/config.ts`** e troque `GAME_URL` pela URL da Vercel.

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

- `src/app/index.tsx` — o WebView que carrega o jogo (com tela de carregamento/erro e
  botão físico "voltar" navegando dentro do jogo).
- `src/app/_layout.tsx` — stack simples, sem cabeçalho (o jogo ocupa a tela toda).
- `src/uf/config.ts` — **a URL do jogo** (é o que você configura).
- `src/uf/theme.ts` — cores da tela de carregamento.
- `eas.json` — perfis de build (APK/AAB).

## Observações

- Recursos nativos do desktop (anti-cheat UltraShield, Discord Rich Presence, atalhos)
  não existem no navegador/WebView — o jogo já tem fallback web para esses casos.
- Salvamentos usam o armazenamento do navegador dentro do app (WebView) — considere
  sincronização com a nuvem no futuro.
