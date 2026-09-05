# Matriz de paridade — reforma da camada visual

Gerada por `node scripts/gerar-matriz-de-paridade.mjs`, a partir do codigo — nao
escrita a mao. E o contrato contra perda de recurso: se uma tela sumir ou perder
acoes, a proxima geracao mostra o numero caindo.

A coluna **Acoes** conta tags interativas no FONTE, nao botoes na tela (um
`.map()` de dez jogadores conta como um). Serve como numero comparavel entre
versoes, nao como total absoluto.

- telas: **74**
- acoes declaradas (soma): **783**
- medidas e aprovadas pelo portao visual: **62**
- reprovadas: **0**

| Rota | Componente | Dados | Acoes | Tauri | Destino na nova UI | Status |
| --- | --- | --- | ---: | :---: | --- | --- |
| `/` | `app/page.tsx` | calendario, i18n, motor, save, selecao | 14 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/adversarios` | `app/adversarios/page.tsx` | clube, motor, save | 1 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/amistosos` | `app/amistosos/page.tsx` | clube, save | 7 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/analise-partida` | `app/analise-partida/page.tsx` | motor, save | 5 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/base` | `app/base/page.tsx` | calendario, clube, disco, motor, save | 13 | — | titulo condensado, veu unificado, superficie tokenizada | medida e aprovada |
| `/base/carreira` | `app/base/carreira/page.tsx` | calendario, i18n, motor, save | 8 | — | titulo condensado | medida e aprovada |
| `/calendario` | `app/calendario/page.tsx` | calendario, clube, disco, motor | 10 | — | titulo condensado, veu unificado, fundo atmosferico | medida e aprovada |
| `/campeao` | `app/campeao/page.tsx` | calendario, clube, save | 1 | — | fundo atmosferico | medida e aprovada |
| `/carreira/jogador` | `app/carreira/jogador/page.tsx` | calendario, i18n, save | 30 | — | sem mudanca visual | medida e aprovada |
| `/carreira/jogador/calendario` | `app/carreira/jogador/calendario/page.tsx` | i18n, save | 4 | — | sem mudanca visual | medida e aprovada |
| `/carreira/jogador/evolucao` | `app/carreira/jogador/evolucao/page.tsx` | i18n, save | 7 | — | sem mudanca visual | medida e aprovada |
| `/carreira/jogador/loja` | `app/carreira/jogador/loja/page.tsx` | i18n, save | 8 | — | sem mudanca visual | medida e aprovada |
| `/carreira/jogador/partida` | `app/carreira/jogador/partida/page.tsx` | i18n, save | 5 | — | titulo condensado, superficie tokenizada | medida e aprovada |
| `/carreira/jogador/trajetoria` | `app/carreira/jogador/trajetoria/page.tsx` | i18n, save | 1 | — | sem mudanca visual | medida e aprovada |
| `/carreira/jogador/vida` | `app/carreira/jogador/vida/page.tsx` | i18n, save | 6 | — | titulo condensado | medida e aprovada |
| `/central` | `app/central/page.tsx` | clube, motor, save | 8 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/clube` | `app/clube/page.tsx` | — | 0 | — | sem mudanca visual | medida e aprovada |
| `/clube-novo` | `app/clube-novo/page.tsx` | — | 20 | — | titulo condensado | medida e aprovada |
| `/comissao` | `app/comissao/page.tsx` | calendario, motor | 4 | — | superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/competicoes` | `app/competicoes/page.tsx` | calendario, clube, i18n, motor, save | 6 | — | superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/configuracoes` | `app/configuracoes/page.tsx` | clube, disco, i18n, motor, save | 23 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/contratos` | `app/contratos/page.tsx` | clube, motor, save | 13 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/dashboard` | `app/dashboard/page.tsx` | — | 0 | — | sem mudanca visual | nao medida (redireciona) |
| `/desafios` | `app/desafios/page.tsx` | clube, motor, save | 4 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/editar` | `app/editar/page.tsx` | disco | 58 | sim | titulo condensado, veu unificado, fundo atmosferico | medida e aprovada |
| `/editor` | `app/editor/page.tsx` | — | 0 | — | sem mudanca visual | medida e aprovada |
| `/elenco` | `app/elenco/page.tsx` | motor, save | 0 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/elenco/escalacoes` | `app/elenco/escalacoes/page.tsx` | motor, save | 4 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/elenco/gerenciamento` | `app/elenco/gerenciamento/page.tsx` | disco, i18n, motor, save | 61 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/elenco/taticas` | `app/elenco/taticas/page.tsx` | motor, save | 3 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/estatisticas` | `app/estatisticas/page.tsx` | calendario, clube, motor, save | 1 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/financas` | `app/financas/page.tsx` | calendario, clube, i18n, motor, save | 6 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/gestao-avancada` | `app/gestao-avancada/page.tsx` | motor, save | 23 | — | titulo condensado | medida e aprovada |
| `/historico` | `app/historico/page.tsx` | clube, i18n, save | 0 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/imprensa` | `app/imprensa/page.tsx` | motor | 4 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/infraestrutura` | `app/infraestrutura/page.tsx` | calendario, motor, save | 7 | — | titulo condensado, veu unificado, superficie tokenizada | medida e aprovada |
| `/legal` | `app/legal/page.tsx` | — | 1 | — | titulo condensado | medida e aprovada |
| `/leiloes` | `app/leiloes/page.tsx` | clube, motor, save | 3 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/mensagens` | `app/mensagens/page.tsx` | clube, motor, save | 11 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/mercado` | `app/mercado/page.tsx` | clube, disco, i18n, motor, save | 49 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/multiplayer-local` | `app/multiplayer-local/page.tsx` | — | 0 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/notificacoes` | `app/notificacoes/page.tsx` | calendario, clube, motor, save | 14 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/novo-jogo` | `app/novo-jogo/page.tsx` | calendario, disco, i18n, save | 61 | — | titulo condensado, veu unificado | medida e aprovada |
| `/olheiros` | `app/olheiros/page.tsx` | calendario, save | 22 | — | veu unificado, fundo atmosferico | medida e aprovada |
| `/online` | `app/online/page.tsx` | i18n, save | 2 | — | titulo condensado | medida e aprovada |
| `/online/amistoso` | `app/online/amistoso/page.tsx` | clube, i18n, save | 9 | — | titulo condensado | medida e aprovada |
| `/online/carreira` | `app/online/carreira/page.tsx` | clube, i18n, save | 16 | — | titulo condensado | medida e aprovada |
| `/online/champions` | `app/online/champions/page.tsx` | i18n, save | 4 | — | titulo condensado | medida e aprovada |
| `/online/draft` | `app/online/draft/page.tsx` | clube, i18n, save | 4 | — | titulo condensado | medida e aprovada |
| `/online/eventos` | `app/online/eventos/page.tsx` | i18n, save | 7 | — | titulo condensado | medida e aprovada |
| `/online/rivals` | `app/online/rivals/page.tsx` | i18n, save | 4 | — | titulo condensado | medida e aprovada |
| `/online/rush` | `app/online/rush/page.tsx` | i18n | 4 | — | titulo condensado | medida e aprovada |
| `/partida` | `app/partida/page.tsx` | calendario, clube, disco, motor, save | 10 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/partida/ao-vivo` | `app/partida/ao-vivo/page.tsx` | calendario, clube, disco, i18n, motor, save, selecao | 15 | — | veu unificado, fundo atmosferico | medida e aprovada |
| `/partida/escalacao` | `app/partida/escalacao/page.tsx` | i18n, motor, save | 34 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/performance` | `app/performance/page.tsx` | clube, disco, motor, save | 9 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/pre-office` | `app/pre-office/page.tsx` | calendario, i18n, motor, save | 8 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/rankings` | `app/rankings/page.tsx` | save | 0 | — | titulo condensado | medida e aprovada |
| `/relatorios` | `app/relatorios/page.tsx` | clube, motor | 3 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/reunioes` | `app/reunioes/page.tsx` | motor, save | 5 | — | titulo condensado, fundo atmosferico | medida e aprovada |
| `/salvar` | `app/salvar/page.tsx` | calendario, disco, save | 9 | — | fundo atmosferico | medida e aprovada |
| `/selecao` | `app/selecao/page.tsx` | clube, i18n, save, selecao | 15 | — | titulo condensado, superficie tokenizada, fundo atmosferico | medida e aprovada |
| `/selecao/amistosos` | `app/selecao/amistosos/page.tsx` | — | 0 | — | sem mudanca visual | nao medida (redireciona) |
| `/selecao/calendario` | `app/selecao/calendario/page.tsx` | motor, save | 2 | — | titulo condensado | medida e aprovada |
| `/selecao/competicoes` | `app/selecao/competicoes/page.tsx` | save, selecao | 0 | — | superficie tokenizada | nao medida (redireciona) |
| `/selecao/convocacao` | `app/selecao/convocacao/page.tsx` | — | 0 | — | sem mudanca visual | nao medida (redireciona) |
| `/sem-clube` | `app/sem-clube/page.tsx` | — | 0 | — | sem mudanca visual | nao medida (redireciona) |
| `/splash` | `app/splash/page.tsx` | disco, i18n, motor, save | 20 | sim | titulo condensado, superficie tokenizada | fora do portao |
| `/taticas` | `app/taticas/page.tsx` | motor, save | 31 | — | titulo condensado, superficie tokenizada, fundo atmosferico | nao medida (redireciona) |
| `/transferencias` | `app/transferencias/page.tsx` | — | 0 | — | sem mudanca visual | nao medida (redireciona) |
| `/transferroom` | `app/transferroom/page.tsx` | clube, motor, save | 16 | — | titulo condensado | nao medida (redireciona) |
| `/treinador` | `app/treinador/page.tsx` | calendario, clube, i18n, motor, save | 11 | — | titulo condensado, superficie tokenizada, fundo atmosferico | nao medida (redireciona) |
| `/treinamento` | `app/treinamento/page.tsx` | calendario, clube, motor | 15 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | nao medida (redireciona) |
| `/vestiario` | `app/vestiario/page.tsx` | clube, motor | 4 | — | titulo condensado, veu unificado, superficie tokenizada, fundo atmosferico | nao medida (redireciona) |
