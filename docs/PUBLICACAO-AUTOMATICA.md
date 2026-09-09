# Publicacao automatica

`main` e a fonte unica da producao. Um `git push origin main` dispara o workflow
**Publicar Web e Windows**. Ele publica o mesmo commit nesta ordem:

1. instala dependencias e baixa o pacote versionado de assets;
2. valida e gera o site estatico;
3. publica a Web na VPS por troca atomica e exige HTTP 200;
4. calcula uma versao unica, compila e assina o instalador Windows;
5. publica o release do updater e espelha o instalador na VPS.

O desenvolvedor precisa somente clonar o repositorio, criar uma branch, testar e
abrir um pull request para `main`. Chaves de assinatura, token de release e SSH
ficam nos Actions Secrets; nunca devem ser copiadas para o codigo ou para a
maquina de outro desenvolvedor.

Segredos exigidos no repositorio:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `ULTRAFOOT_RELEASE_TOKEN`
- `VPS_SSH_PRIVATE_KEY`
- `VPS_KNOWN_HOSTS`

O numero da publicacao e automatico e compartilhado pela Web e pelo Windows. Um
push novo aguarda a publicacao anterior; nenhuma versao intermediaria e apagada
antes de a seguinte estar pronta.
