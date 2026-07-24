Ultrafoot Launcher — staging para embutir no instalador do jogo
================================================================

Coloque aqui o instalador do launcher com o nome EXATO:

    UltrafootLauncher-setup.exe

Quando este arquivo existe, o instalador do jogo (NSIS) o executa em SILÊNCIO
(/S) no pós-instalação — assim todo jogador que instala/atualiza o jogo recebe o
Ultrafoot Launcher automaticamente, sem clicar em nada.

Se a pasta estiver vazia, o build do jogo funciona normalmente e o passo do
launcher é simplesmente ignorado (o hook NSIS confere a existência do arquivo).

Como preparar (a partir da raiz do projeto):

    node scripts/stage-launcher.mjs

ou, manualmente, copie o setup gerado em
    Launcher/src-tauri/target/release/bundle/nsis/Ultrafoot Launcher_<versão>_x64-setup.exe
para este diretório renomeando para UltrafootLauncher-setup.exe.
