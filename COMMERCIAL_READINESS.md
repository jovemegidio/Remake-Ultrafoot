# Ultrafoot 26 — prontidão comercial

Status atual: **não aprovado para comercialização pública**.

## Resultado da auditoria de 17/07/2026

- 39/39 telas abriram sem erro na auditoria automatizada.
- Elencos: 3.094 clubes auditados, sem erro estrutural de titulares/posições.
- Simulação: partidas e avanço de 60 semanas concluíram sem travamento no smoke test.
- Assets presentes: 3.753 arquivos de kits importados, 2.298 fotos, 3.405 escudos e 76 áudios de narração.
- Kits: 362/3.489 clubes do banco resolvem com segurança para o pacote importado (959 variantes); os demais continuam usando o uniforme padrão/editor. Os 882 nomes marcados como `CHECAR` não são associados automaticamente para evitar uniformes trocados.
- Bloqueio: 300 dos 542 clubes do catálogo principal não possuem um escudo local resolvível pelo mapeamento do jogo e dependem de URL externa/fallback.
- A auditoria estática atual encontrou 0 funções ativas lançando `not implemented` e 0 marcadores acionáveis. Os 103 termos restantes foram classificados como documentação histórica, registro de fases ou nomes legítimos de componentes.
- Saves: campanhas de 1, 3, 5, 10 e 20 temporadas aprovadas; gravação transacional, staging recuperável, duas gerações de backup, importação, migração legada e isolamento entre carreiras aprovados.
- Faces: primeiro lote físico consolidado com 2.297 fotos. Outras 10.336 referências planejadas foram retiradas da resolução em runtime até o arquivo existir, evitando requisições 404. O importador incremental aceita lotes de até 500 IDs confirmados.

## Hardware Windows auditado

- O aplicativo instalado abriu em 7 processos WebView/Tauri e consumiu aproximadamente 872 MB de working set e 632 MB de memória privada no cenário medido.
- Intel Core de 3ª geração (Ivy Bridge/LGA1155) atende às instruções de CPU exigidas pelo WebView2 moderno, desde que use Windows 10 64 bits compatível e o runtime WebView2 esteja instalado.
- **4 GB de RAM não é mínimo comercial aprovado**: pode iniciar no modo de baixo desempenho, mas deixa pouca margem para Windows, vídeo integrado e campanhas grandes, podendo paginar ou travar.
- Mínimo comercial recomendado: Windows 10 22H2 64 bits, CPU 4 threads com SSE3, 8 GB RAM, SSD e GPU compatível com DirectX 11. O perfil de 4 GB deve ser divulgado apenas como experimental até teste físico prolongado nessa máquina.

## Bloqueadores jurídicos e de conteúdo

- Não há, no repositório, comprovação de licença de redistribuição comercial para escudos, uniformes, fotografias de jogadores, narração, músicas ou outros arquivos coletados de terceiros.
- O arquivo externo `sortitoutsi_cutout_megapack_2026.07.rar` tem cerca de 14,69 GB e não possui, junto ao projeto, licença comercial nem tabela que relacione os IDs das fotos aos atletas do Ultrafoot. Ele não deve ser incluído no instalador; no máximo, pode ser suportado por um importador local executado pelo próprio usuário.
- Não há comprovação de autorização para uso comercial de marcas, nomes, identidades visuais e histórias dos clubes e competições.
- Dados obtidos de sites ou de outro jogo não devem ser revendidos ou redistribuídos sem autorização expressa e compatível com esse uso.
- É necessário manter um inventário por arquivo/fonte com titular, licença, território, duração e comprovante.

## Bloqueadores de produto e operação

- Linux e macOS ainda precisam de QA em hardware real; a existência de um pacote não comprova compatibilidade.
- macOS exige assinatura Developer ID e notarização antes da distribuição normal.
- O atualizador deve publicar artefatos distintos por plataforma no manifesto e ser testado com rollback.
- O FC Hub precisa de política de privacidade, termos de uso, fluxo de desconexão/exclusão e suporte ao usuário.
- Os fluxos automatizados principais (nova carreira em controles Xbox/PlayStation e rotas de dashboard, elenco, mercado, partida e calendário) foram aprovados. A matriz automatizada cobre campanhas longas, migração legada, corrupção/interrupção de escrita, recuperação por backup e isolamento de slots. A atualização assinada entre máquinas ainda depende da chave privada oficial do atualizador no ambiente de release.
- Faltam crash reporting consentido, canal de suporte, política de reembolso e processo de resposta a incidentes.

## Preparação técnica adicionada

- Configurações Tauri separadas para Windows, Linux e macOS.
- Pipeline Linux x64 para `.deb` e AppImage.
- Pipeline macOS universal para Intel e Apple Silicon, com `.app`/DMG.
- Resolução de recursos usando o diretório nativo de cada plataforma.
- Preflight que impede pacotes sem os conjuntos mínimos de assets.

## Critério para aprovação

Somente marcar como comercialmente pronto após:

1. regularização documental de todos os assets e dados;
2. assinatura/notarização e QA físico nas três plataformas;
3. campanha longa e atualização de saves aprovadas;
4. documentos legais, privacidade, suporte e reembolso publicados;
5. revisão final por advogado de propriedade intelectual e privacidade.
