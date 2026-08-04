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
