# Certificação de regulamentos e perfil econômico — 2026

Data da execução: 18/07/2026.

## Regulamentos

- 70 de 70 competições do catálogo possuem ciclo, participantes, formato, critérios de desempate e fonte oficial cadastrados.
- O cadastro contém 77 regras ao incluir os estaduais detalhados que não são entradas separadas do catálogo.
- 74 regras apontam para uma fonte oficial específica da competição ou da temporada.
- As três entradas russas (`russian_prem`, `russian_first` e a regra associada) permanecem vinculadas ao índice oficial da entidade porque o regulamento 2026/27 específico ainda não estava publicado na data da auditoria.
- A validação automatizada rejeita divergência entre participantes do catálogo e do regulamento, fonte sem HTTPS, ciclo ausente e formato de pontos corridos incompatível.

Correções relevantes aplicadas:

- Série B: dois acessos diretos e playoffs entre 3º–6º.
- Série C: fase única, G8 em dois quadrangulares, quatro acessos e dois rebaixamentos.
- Série D: 96 clubes, 16 grupos e seis acessos.
- Copa do Brasil: 126 participantes.
- UEFA Champions/Europa: fase de liga de 36 clubes; AFC Champions League Elite: 32 clubes e oito jogos.
- US Open Cup: 80 clubes e sete rodadas; King Cup: 32 clubes.
- Primera Nacional: 36 clubes em duas zonas, dois acessos e quatro rebaixamentos.
- Torneo BetPlay: 16 clubes, quadrangulares e dois acessos.
- Liga AUF: Apertura, Intermedio e Clausura; Segunda uruguaia: 13 clubes e fase regular de 26 datas.
- Formatos de 2026 dos estaduais paulista, carioca, mineiro e gaúcho.
- Vagas continentais passaram a ser derivadas da liga; clubes de divisões inferiores não recebem vaga por uma regra G4 genérica.

Comandos de validação:

```text
npm run qa:competitions
npm run qa:campaigns
npm run qa:gameplay
npm run qa:saves
```

Todos passaram. As campanhas automatizadas cobriram 1, 3, 5, 10 e 20 temporadas.

## Perfil de computador fraco

O jogo agora seleciona o perfil `economy` antes da hidratação da interface quando detecta até 4 GB de memória informada pelo navegador ou até quatro processadores lógicos. Isso elimina animações e transições, desativa desfoques e ativa a redução de movimento antes de carregar as telas.

### Memória da INTERFACE, medida tela a tela (1.0.358)

O benchmark abaixo mede o motor no Node. O que faltava era o outro lado: quanto a
interface segura no navegador, que é onde o jogo roda de verdade. Medido em
19/08/2026 numa carreira criada pela interface, com coleta de lixo forçada antes
de cada leitura (`Runtime.getHeapUsage` via CDP):

| tela | antes | depois |
|---|---|---|
| escritório (logo após criar) | 259 MB | **183 MB** |
| /elenco | 191 MB | **130 MB** |
| /calendario | 380 MB | **154 MB** |
| /mercado | 116 MB | **116 MB** |
| /elenco/gerenciamento | 114 MB | **134 MB** |

O pico caiu de **380 MB para 183 MB**. A causa era o universo 286 ficar na
memória DUAS vezes — os ~42 MB de texto no cache do armazenamento e os ~74 MB do
objeto depois do `JSON.parse` —, e `lerUniverso` reler o texto a cada chamada só
para comparar com o que já tinha. Hoje o texto é solto assim que vira objeto
(`esquecerDoCache`, em lib/persistent-store) e quem tem o objeto não volta ao
armazenamento.

Isso é o que sustenta o requisito mínimo de **4 GB de RAM**: com Windows e a
WebView ocupando o seu, 183 MB de heap de interface deixam folga; 380 MB, não.

O número virou catraca: `npm run qa:memoria-telas` percorre escritório, elenco,
calendário, mercado e gerenciamento numa carreira real e reprova acima de
**300 MB** — folga para a variação da medida, apertado o bastante para pegar a
volta dos 380 MB. Ele só desce.

Resultado do benchmark de motor com heap limitado a 512 MB:

```text
20 temporadas: 1.511 ms
500 partidas: 107 ms
RSS: 275,5 MB
heap usado: 133,8 MB
status: PASS
```

Resultado da interface com CPU reduzida artificialmente em 4×:

- Rotas críticas testadas: início, elenco, calendário, mercado, competições e partida.
- Resolução principal: 1366×768.
- Layout mínimo: 1280×720, sem estouro horizontal relevante.
- Recursos locais: nenhuma falha.
- Resultado: 2/2 testes aprovados.

A compilação de produção (`npm run build:qa`) também foi concluída com sucesso, incluindo TypeScript, geração das 50 páginas estáticas e verificação dos aliases RSC do export.

## Limite da certificação

Os resultados acima constituem certificação laboratorial reproduzível. Eles não substituem um ensaio físico em Intel Core de 3ª geração, 4 GB, Intel HD, HD mecânico e Windows 10 limpo. A máquina disponível nesta auditoria possui Intel Core i5 de 12ª geração, 23,7 GB, Intel Iris Xe, SSD e Windows 11, portanto não representa o hardware-alvo. A certificação física final exige executar o instalador na máquina de terceira geração e registrar: tempo até o menu, pico de memória, tempo de abertura do save, estabilidade após cinco partidas e campanha longa. Não se deve anunciar esse hardware como oficialmente certificado antes desse ensaio.
