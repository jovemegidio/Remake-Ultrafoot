# Ultrafoot online/offline e FC Hub Social

## Implementado até a build 1.0.81

- O modo offline continua independente de login e de servidor.
- O FC Hub abre com `Tab`, exibe tempo da sessão/total, amigos reais do Discord e Rich Presence contextual.
- `Ligar servidor` verifica primeiro se existe atualização oficial de jogo/elencos.
- O aplicativo inicia um servidor autoritativo embutido em Rust na rede local e gera endereço + código de seis caracteres.
- Cada participante recebe uma credencial de sessão; somente o host pode avançar a rodada.
- A rodada só avança depois que todos os técnicos confirmarem suas decisões.
- Entrada é recusada se versão do executável, versão de dados ou hash de clubes/regulamentos forem diferentes.
- O servidor mantém um log ordenado de ações. Ele nunca recebe nem substitui o save completo de um convidado.
- Teste nativo cobre entrada compatível e rejeição de banco divergente.

### Campeonato remoto para 20–32 técnicos (1.0.81)

- O FC Hub separa claramente a sala local/LAN do campeonato pela internet.
- O serviço em `services/multiplayer-relay` usa Worker + Durable Object persistente, WebSocket seguro, credenciais de reconexão, limitação de mensagens e limite de 64 KiB por comando.
- Cada sala aceita de 20 a 32 técnicos; um campeonato com 32 gera 31 rodadas, 496 jogos e 16 partidas simultâneas por rodada.
- Um clube só pode ser escolhido por um técnico, e versão/hash do banco precisam ser idênticos.
- A tabela e a classificação são mantidas pelo serviço; os dois adversários confirmam o resultado e divergências ficam marcadas para resolução do host.
- Se o host cair, a sala e a tabela continuam no serviço. Depois do prazo de segurança, o técnico conectado há mais tempo pode recuperar o papel de host.
- Testes locais do runtime Cloudflare cobrem criação de sala, 20 entradas remotas, proteção do snapshot, clube duplicado, tabela e paralelismo das rodadas.

O código do relay está pronto e validado localmente, mas ainda não está público: faltam conta, domínio/TLS e os segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. A URL implantada deve ser gravada na variável `NEXT_PUBLIC_ULTRAFOOT_RELAY_URL` antes de compilar o cliente distribuído.

Elencos, clubes, faces, escudos e kits permanecem dados da instalação. Atualizá-los não modifica um save existente; novas carreiras passam a usar a base nova, e saves antigos preservam seus snapshots.

## Competições revisadas nesta etapa

- Copa do Mundo: 48 seleções, 12 grupos, dois primeiros e oito melhores terceiros, seguida de fase de 32.
- Euro, CAN e Copa da Ásia: 24 seleções, seis grupos e quatro melhores terceiros nas oitavas.
- Copa Ouro: 16 seleções em quatro grupos.
- OFC Nations Cup: oito seleções em dois grupos.
- UEFA e Concacaf Nations League não compartilham mais a mesma regra genérica.
- Eliminatórias foram separadas em CONMEBOL, UEFA, AFC, CAF, Concacaf e OFC, incluindo turno/returno e caminhos de repescagem.
- Copinha, Brasileiro Sub-20 e Copa do Brasil Sub-20 agora possuem calendários independentes, progressão por fase e mata-mata; o motor anterior de 19 rodadas compartilhadas foi removido.

Fontes de validação: [FIFA — eliminatórias da Copa 2026](https://www.fifa.com/en/articles/road-to-world-cup-26-qualifiers-usa-canada-mexico), [UEFA Nations League 2026/27](https://www.uefa.com/uefanationsleague/news/0298-1d6ef1acfaef-b54fcf1da859-1000--2026-27-uefa-nations-league-all-you-need-to-know/), [UEFA — classificação Euro 2028](https://www.uefa.com/european-qualifiers/news/0299-1dcf3fef69a9-41405d004b47-1000--qualification-system-for-uefa-euro-2028-approved/), [CBF — Brasileiro Sub-20 2026](https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/sub-20/2026), [FPF — REC Copinha 2026](https://futebolpaulista.com.br/Repositorio/Competicao/Regulamento/1556/1556_639014790494633669.pdf) e [CBF — expansão da Copa do Brasil Sub-20 em 2026](https://www.cbf.com.br/futebol-brasileiro/noticias/competicoes-campeonato-brasileiro-sub20/a/cbf-anuncia-novidades-para-o-calendario-das-competicoes-masculinas-de-base-de-2025).

## O que ainda separa esta base de um multiplayer comercial completo

A sala LAN é um transporte funcional e testado, mas a campanha multiplayer completa pela internet ainda não pode ser chamada de 100% pronta. Faltam:

1. Implantar o relay público em domínio próprio e testar latência/capacidade com 32 máquinas reais. CGNAT deixa de afetar os convidados porque todos abrem conexões de saída WSS.
2. Consumir o log de ações em todos os módulos da campanha: escalação, tática, treino, transferências, imprensa e partida.
3. Adicionar snapshot atômico da campanha + replay do log após queda e testar o host encerrado durante salvamento.
4. Definir timeout, IA temporária, abandono, punições e substituição permanente de um técnico.
5. Ligar lobby e `join secret` do Discord ao código do relay; endereço IP local nunca deve aparecer no Rich Presence.
6. Acrescentar mata-mata, sorteios, potes, espectador e temporadas persistentes. A primeira entrega do relay implementa liga de pontos corridos.
7. Ampliar a validação autoritativa para saldo, janela, vínculo de atleta, escalação e sequência de cada comando.
8. Fazer teste de carga, segurança, moderação, privacidade e recuperação de desastre antes de venda como recurso online.

Sem um domínio/serviço de relay implantado, abrir a porta LAN diretamente para a internet não é uma distribuição segura.

## Próximas funções úteis do FC Hub Social

- salas persistentes de liga e copa, com calendário e classificação;
- convite pelo Discord e entrada com um clique;
- feed de amigos: títulos, transferências e resultados, com controles de privacidade;
- perfil do técnico com carreira, conquistas, clubes e horas jogadas;
- espectador de placar/eventos sem acesso ao save;
- compartilhamento de táticas e pacotes do editor, sempre assinados e moderados;
- chat/voz via Discord, sem armazenar áudio no servidor do jogo;
- lista de servidores por região, latência e compatibilidade da base;
- denúncias, bloqueio, lista de amigos e segurança para menores.

## Assinatura Windows

Os scripts `release:sign-windows` e `qa:authenticode` agora assinam e verificam o executável, NSIS e MSI. A máquina não possui certificado de assinatura de código instalado; portanto a build pública deve permanecer bloqueada até fornecer um certificado OV/EV ou Azure Trusted Signing. A chave privada e a senha nunca entram no jogo ou no repositório.
