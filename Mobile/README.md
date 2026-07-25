# Ultrafoot de Bolso (mobile)

Versão mobile do Ultrafoot 26 — um app **Expo / React Native** para **Android** (roda
no **Expo Go**), com a mesma identidade visual do jogo (escuro + verde neon) e a
estrutura de um manager de bolso.

> Scaffold funcional: navegação, tema e telas principais com dados de exemplo. É o
> ponto de partida para plugar os dados/engine reais do jogo.

## Como rodar (Expo Go)

1. No celular Android, instale o app **Expo Go** (Play Store).
2. No PC (de preferência num disco local, ex.: `C:`):
   ```bash
   cd Mobile
   npm install
   npx expo start
   ```
3. Abra o **Expo Go** e **escaneie o QR Code** que aparece no terminal. O app abre no celular.

> Dica: PC e celular precisam estar na **mesma rede Wi‑Fi**. Se não conectar, rode
> `npx expo start --tunnel`.

## Estrutura

- `src/app/` — rotas (expo-router). Abas: **Início**, **Elenco**, **Calendário**, **Táticas**.
  - `_layout.tsx` — navegação por abas (tema neon).
  - `index.tsx` — hub do clube (forma, próxima partida, novidades).
  - `elenco.tsx` — lista do elenco por posição e overall.
  - `calendario.tsx` — jogos e resultados.
  - `taticas.tsx` — campo com a formação (4‑3‑3).
- `src/uf/theme.ts` — cores do tema.
- `src/uf/data.ts` — **dados de exemplo** (clube, elenco, calendário). É aqui que se
  pluga os dados reais do jogo.
- `src/uf/ui.tsx` — componentes de UI reutilizáveis (Screen, Card, etc.).

## Próximos passos (evolução)

- Ligar os dados reais (elenco/competições) — a estrutura já espelha a do desktop.
- Simulação de partida simplificada para o bolso.
- Sincronização opcional com a carreira do desktop.
- Build de produção (APK/AAB) via EAS quando sair do Expo Go.
