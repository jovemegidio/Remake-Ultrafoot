; ─── COMPATIBILIDADE COM WINDOWS 10 ────────────────────────────────────────────
;
; O jogo É uma aplicação Tauri: sem o runtime do WebView2 não existe tela, só uma
; janela em branco. O Windows 11 sempre traz esse runtime; o Windows 10 recebeu
; ele por atualização do Edge a partir de 2021 — a maioria tem, mas imagens LTSC,
; instalações enxutas e máquinas sem atualizar NÃO têm.
;
; O `webviewInstallMode` do projeto é `offlineInstaller`: o runtime COMPLETO vem
; dentro do pacote e é instalado sem rede nenhuma. Antes era `embedBootstrapper`
; — só um baixador, que numa máquina sem internet (ou atrás de proxy corporativo)
; falhava e deixava o jogador com uma janela preta e nenhuma explicação. Custa
; ~130 MB a mais no instalador; é o preço de funcionar em Windows 10 offline.
;
; Este hook cuida do que o `offlineInstaller` NÃO resolve: um Windows velho
; demais para o runtime existir, e o diagnóstico quando algo assim mesmo falha.
;
; ⚠️ TUDO AQUI É GUARDADO POR `IfSilent`. O auto-updater roda o instalador em
; modo passivo/silencioso: um MessageBox nesse caminho fica esperando um clique
; numa janela que ninguém vê, e a atualização trava para sempre.
!macro NSIS_HOOK_PREINSTALL
  SetRegView 64

  ; A juncao `sav` sai ANTES de qualquer coisa tocar em $INSTDIR — o mesmo
  ; motivo detalhado no NSIS_HOOK_PREUNINSTALL la embaixo: um apagar recursivo
  ; atravessa o link e leva as carreiras junto. O jogo a recria no proximo
  ; arranque. Sem `/r`, de proposito.
  RMDir "$INSTDIR\sav"

  ; ── Versão mínima do Windows ────────────────────────────────────────────────
  ; O WebView2 exige Windows 10 1809 (build 17763) ou mais novo. Abaixo disso o
  ; jogo NÃO tem como funcionar, e instalar seria enganar o jogador.
  ClearErrors
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  ${IfNot} ${Errors}
    ; IntCmp: igual / menor / maior. Só barra quando é comprovadamente menor.
    ; IntCmp: igual / menor / maior. Só barra quando é comprovadamente menor.
    ; O `IfSilent +2` pula APENAS o diálogo — o Abort vale nos dois caminhos.
    ; Instalar em silêncio num Windows que não roda o jogo seria enganar o
    ; updater: ele reportaria sucesso e o jogador ficaria com a tela preta.
    IntCmp $0 17763 ultrafoot_so_ok ultrafoot_so_antigo ultrafoot_so_ok
    ultrafoot_so_antigo:
      DetailPrint "Windows build $0 e anterior a 17763 (Windows 10 1809)."
      IfSilent +2
      MessageBox MB_ICONSTOP|MB_OK "Este Windows é antigo demais para o Ultrafoot 26.$\n$\nO jogo precisa do Windows 10 versão 1809 (build 17763) ou mais recente, porque o runtime do Microsoft Edge WebView2 — que desenha todas as telas — não funciona em versões anteriores.$\n$\nSeu Windows informa a build $0. Atualize o Windows e tente de novo."
      Abort
    ultrafoot_so_ok:
  ${EndIf}

  ; ── Runtime do WebView2 ─────────────────────────────────────────────────────
  ; Mesmas três chaves que o launcher consulta (ver `requisitos.rs`): máquina
  ; 64 bits, máquina 32 bits e instalação por usuário. Olhar só uma delas dá
  ; falso negativo — o instalador do runtime escolhe uma dependendo de como foi
  ; executado.
  StrCpy $1 ""
  ReadRegStr $1 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $1 == ""
    ReadRegStr $1 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $1 == ""
    ReadRegStr $1 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}

  ; Sem WebView2 a instalação NÃO para: o runtime completo viaja dentro deste
  ; pacote (`offlineInstaller`) e o Tauri o instala sozinho, sem internet. O
  ; registro aqui existe para o log do instalador — quando alguém reportar tela
  ; preta, é a primeira linha a procurar.
  ${If} $1 == ""
    DetailPrint "WebView2 ausente — sera instalado a partir do runtime embutido no pacote."
  ${Else}
    DetailPrint "WebView2 presente (versao $1)."
  ${EndIf}
!macroend

; Pré-requisito do Ultrafoot: Microsoft Visual C++ v14 x64 Runtime.
; Evita falhas MSVCP140.dll, VCRUNTIME140.dll e dependências nativas do Discord SDK.
!macro NSIS_HOOK_POSTINSTALL
  ; Builds locais/CI podem empacotar milhares de ativos em um unico ZIP para evitar
  ; que o Tauri/NSIS catalogue cada imagem duas vezes. Eles continuam dados globais do
  ; jogo no $INSTDIR (nunca dentro do save). Compatível também com instaladores antigos
  ; que ainda trazem as pastas individualmente.
  ${If} ${FileExists} "$INSTDIR\resources\install-game-assets.ps1"
    DetailPrint "Instalando escudos, uniformes, faces e narração..."
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\install-game-assets.ps1"' $9
    ${If} $9 == 0
      Delete "$INSTDIR\resources\install-game-assets.ps1"
    ${Else}
      ; IfSilent: numa atualizacao automatica nao ha ninguem para clicar.
      DetailPrint "Falha ao extrair os dados visuais (codigo $9)."
      IfSilent +2
      MessageBox MB_ICONEXCLAMATION|MB_OK "Não foi possível extrair os dados visuais do jogo (código $9). Verifique espaço livre, feche o jogo e execute o instalador novamente. Diagnóstico: $TEMP\ultrafoot-assets-install.log"
    ${EndIf}
  ${EndIf}

  SetRegView 64
  ClearErrors
  ReadRegDWord $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $0 == 1
    DetailPrint "Microsoft Visual C++ Runtime x64 já está instalado."
    Goto ultrafoot_vcredist_done
  ${EndIf}

  ${If} ${FileExists} "$INSTDIR\prerequisites\vc_redist.x64.exe"
    StrCpy $2 "$INSTDIR\prerequisites\vc_redist.x64.exe"
  ${ElseIf} ${FileExists} "$INSTDIR\resources\prerequisites\vc_redist.x64.exe"
    StrCpy $2 "$INSTDIR\resources\prerequisites\vc_redist.x64.exe"
  ${Else}
    DetailPrint "vc_redist.x64.exe nao encontrado no pacote."
    IfSilent +2
    MessageBox MB_ICONEXCLAMATION|MB_OK "O pré-requisito Microsoft Visual C++ não foi encontrado no instalador. Reinstale o Ultrafoot usando o instalador oficial."
    Goto ultrafoot_vcredist_done
  ${EndIf}

  DetailPrint "Instalando Microsoft Visual C++ Runtime x64..."
  CopyFiles /SILENT "$2" "$TEMP\ultrafoot-vc-redist.x64.exe"
  ExecWait '"$TEMP\ultrafoot-vc-redist.x64.exe" /install /passive /norestart /log "$TEMP\ultrafoot-vcredist.log"' $1
  Delete "$TEMP\ultrafoot-vc-redist.x64.exe"

  ; 0=instalado, 1638=versão igual/mais nova, 3010=instalado e reinício recomendado.
  ${If} $1 == 0
    DetailPrint "Microsoft Visual C++ Runtime instalado com sucesso."
  ${ElseIf} $1 == 1638
    DetailPrint "Microsoft Visual C++ Runtime compatível já estava instalado."
  ${ElseIf} $1 == 3010
    DetailPrint "Microsoft Visual C++ Runtime instalado; reinicie o Windows quando possível."
  ${Else}
    DetailPrint "Falha ao instalar o Visual C++ Runtime (codigo $1)."
    IfSilent +2
    MessageBox MB_ICONEXCLAMATION|MB_OK "Não foi possível instalar o Microsoft Visual C++ Runtime (código $1). O log está em $TEMP\ultrafoot-vcredist.log."
  ${EndIf}

  ultrafoot_vcredist_done:

  ; ─── Ultrafoot Launcher ─────────────────────────────────────────────────────
  ; Instala/atualiza o launcher em SILENCIO junto com o jogo. Assim, quem ja tem o
  ; Ultrafoot passa a ter o launcher automaticamente ao instalar esta build — sem
  ; clicar em nada. O launcher e quem baixa/atualiza o jogo daqui pra frente.
  StrCpy $7 ""
  ${If} ${FileExists} "$INSTDIR\launcher\UltrafootLauncher-setup.exe"
    StrCpy $7 "$INSTDIR\launcher\UltrafootLauncher-setup.exe"
  ${ElseIf} ${FileExists} "$INSTDIR\resources\launcher\UltrafootLauncher-setup.exe"
    StrCpy $7 "$INSTDIR\resources\launcher\UltrafootLauncher-setup.exe"
  ${EndIf}
  ${If} $7 != ""
    DetailPrint "Instalando o Ultrafoot Launcher..."
    ExecWait '"$7" /S' $8
    ${If} $8 == 0
      DetailPrint "Ultrafoot Launcher instalado."
    ${Else}
      DetailPrint "Aviso: o instalador do Ultrafoot Launcher retornou o codigo $8."
    ${EndIf}
  ${EndIf}

  ; ─── UM ICONE SO: o do Launcher ─────────────────────────────────────────────
  ;
  ; O instalador do jogo cria o atalho "Ultrafoot 26" e, logo acima, instala o
  ; Launcher — que cria o dele. O jogador ficava com DOIS icones para a mesma
  ; coisa, e o do jogo nem serve: abrir o ultrafoot.exe direto so redireciona
  ; para o Launcher (maybe_redirect_to_launcher, em src/lib.rs) e encerra.
  ;
  ; Este bloco roda em TODA instalacao, inclusive nas atualizacoes automaticas —
  ; e por isso ele tambem limpa o icone de quem ja tinha o jogo instalado, sem
  ; precisar de nenhuma acao do jogador.
  ;
  ; TRAVA DE SEGURANCA: so apaga se o atalho do Launcher EXISTIR. Se a instalacao
  ; do Launcher tiver falhado (o ExecWait acima pode retornar erro), apagar o
  ; atalho do jogo deixaria a pessoa sem NENHUMA forma de abrir o Ultrafoot pelo
  ; Windows. Melhor dois icones do que zero.
  ;
  ; Apaga apenas os arquivos com o nome EXATO que o nosso instalador cria; nada
  ; que o jogador tenha criado ou renomeado e tocado.
  StrCpy $3 ""
  ${If} ${FileExists} "$DESKTOP\Ultrafoot Launcher.lnk"
    StrCpy $3 "sim"
  ${ElseIf} ${FileExists} "$SMPROGRAMS\Ultrafoot Launcher.lnk"
    StrCpy $3 "sim"
  ${EndIf}

  ${If} $3 == "sim"
    DetailPrint "Mantendo apenas o icone do Ultrafoot Launcher..."
    ; Os tres caminhos que o template do Tauri usa (conferidos no installer.nsi
    ; gerado): area de trabalho, Menu Iniciar na raiz e Menu Iniciar dentro da
    ; pasta escolhida na instalacao — esta ultima e `$AppStartMenuFolder`, e NAO
    ; o nome do produto, que era o que eu tinha suposto.
    Delete "$DESKTOP\${PRODUCTNAME}.lnk"
    Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    ${If} $AppStartMenuFolder != ""
      Delete "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
      ; So remove a pasta se ela ficou VAZIA — RMDir sem /r nao apaga pasta com
      ; conteudo, entao um atalho que o jogador tenha posto ali sobrevive.
      RMDir "$SMPROGRAMS\$AppStartMenuFolder"
    ${EndIf}
  ${Else}
    DetailPrint "Atalho do Launcher nao encontrado; mantendo o icone do jogo."
  ${EndIf}

  SetRegView lastused
!macroend

; ─── A JUNCAO `sav` TEM DE SUMIR ANTES DO APAGAR RECURSIVO ─────────────────────
;
; ⚠️ ISTO PROTEGE A CARREIRA DE TODO MUNDO. A partir da 1.0.323 o jogo cria, na
; pasta instalada, uma juncao chamada `sav` que aponta para
; `%APPDATA%\com.ultrafoot.remake` — onde o save realmente mora (ver
; `criar_atalho_sav` em src-tauri/src/lib.rs). E conveniencia: quem abre a pasta
; do jogo acha o save.
;
; O perigo e o desinstalador. O template do Tauri termina com `RMDir /r
; "$INSTDIR"`, e o /r ENTRA na juncao: ele apagaria os arquivos do OUTRO lado do
; link — isto e, as carreiras — antes de remover a pasta. Desinstalar (ou uma
; atualizacao que desinstala a versao anterior) levaria o save junto, e sem
; nenhum aviso.
;
; `RMDir` SEM `/r` remove o ponto de reparo e nao toca no destino. Se por acaso
; `sav` for uma pasta de verdade com conteudo, o comando falha sozinho e nao
; apaga nada — que e o comportamento desejado nos dois casos.
!macro NSIS_HOOK_PREUNINSTALL
  RMDir "$INSTDIR\sav"
!macroend
