# Publicar o Ultrafoot 26 nas lojas

Steam, Epic, GOG e afins. Este documento é o caminho inteiro: o que muda no
build, o que sobe, e o que ainda depende de uma conta de desenvolvedor.

---

## A primeira coisa a entender

**As lojas não recebem o Ultrafoot Launcher — elas o substituem.**

O launcher existe para baixar, atualizar, reparar e abrir o jogo. Na Steam e na
Epic isso é trabalho da plataforma: elas são donas da pasta de instalação, do
patch e da verificação de integridade. Um jogo que se atualiza por fora, instala
outro programa em silêncio ou exige conta de terceiros para jogar é reprovado na
revisão — e mesmo que passasse, brigaria com o patch da loja.

Então o produto que sobe é **o jogo**, sem o launcher dentro. Os dois canais
convivem: a venda direta continua com launcher + instalador NSIS, e a loja
recebe uma pasta. É o mesmo desenho de qualquer jogo que vende no site próprio e
na Steam ao mesmo tempo.

---

## Gerar o pacote

```bash
node scripts/build-loja.mjs                 # steam (padrão)
node scripts/build-loja.mjs --loja epic
node scripts/build-loja.mjs --so-montar     # remonta sem recompilar
```

Saída: **`dist-loja/<loja>/`**. É essa pasta que vai para o depot.

### O que o script faz de diferente do build normal

| | build normal | build de loja |
|---|---|---|
| Empacotamento | instalador NSIS | pasta solta (`--no-bundle`) |
| Auto-updater | `plugins.updater` ativo | removido do `tauri.conf.json` |
| Aviso de "há versão nova" | ligado | desligado (`lib/updater.ts`) |
| Ultrafoot Launcher | vai dentro (`resources/launcher/*`) | **fica de fora** |
| Registro por código | pede código para os extras | já nasce registrado |
| `identifier` | `com.ultrafoot.remake` | `com.ultrafoot.remake.loja` |
| Escrita na pasta instalada | cria a junção `sav` | não escreve nada |

O `tauri.conf.json` é restaurado no `finally`, sempre — inclusive se a build
falhar no meio.

### Como o jogo sabe que é build de loja

Uma variável, lida em **um** lugar de cada lado:

- front: `NEXT_PUBLIC_ULTRAFOOT_LOJA` → [`lib/loja.ts`](lib/loja.ts) (`EM_LOJA`)
- Rust: `ULTRAFOOT_LOJA` → `em_loja()` em [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs)

O valor é **assado na compilação**. Não é um arquivo ao lado do executável, de
propósito: um `loja.json` seria algo que qualquer pessoa cria para destravar os
extras do build da venda direta. São dois binários diferentes.

`"1"` continua valendo como "sim, é loja" (era o valor histórico). `"0"` e vazio
valem como venda direta.

---

## ⚠️ WebView2 — a única coisa que falta decidir

O jogo **é** uma aplicação WebView2: sem esse runtime não existe tela, só uma
janela branca. No build normal quem resolve isso é o instalador NSIS
(`webviewInstallMode: offlineInstaller` + o hook em `src-tauri/windows/hooks.nsh`).

**Na loja não há instalador**, então ninguém instala o runtime. Windows 11
sempre tem; Windows 10 atualizado quase sempre tem; imagens LTSC e instalações
enxutas **não têm** — e nessas o comprador abre o jogo e vê uma janela branca,
sem explicação.

Há dois caminhos, e é preciso escolher um antes de submeter:

**A. Runtime de versão fixa (recomendado para Steam).** Baixe o
*WebView2 Fixed Version Runtime* (x64) em
<https://developer.microsoft.com/microsoft-edge/webview2/>, extraia a pasta para
dentro do pacote e aponte `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` para ela no
arranque. Não instala nada, não pede administrador, funciona offline e não
depende de aprovação da Valve. Custa ~180 MB no depot.

**B. Bootstrapper + script de instalação da loja.** O
`prerequisites/MicrosoftEdgeWebview2Setup.exe` (1,8 MB) já viaja no pacote — foi
acrescentado aos recursos justamente para isto. A Steam roda pré-requisitos por
`installscript.vdf`, que **a Valve revisa caso a caso**; a Epic tem mecanismo
equivalente. Mais leve, mas depende de aprovação.

Enquanto nenhum dos dois estiver feito, o pacote funciona em máquina com
WebView2 e falha em silêncio nas outras. O script de build avisa disso a cada
execução.

---

## Steam

Você ainda não tem conta. O que ela exige, na ordem:

1. **Steamworks** — cadastro de empresa/pessoa física, taxa Steam Direct de
   US$ 100 por aplicativo (recuperável em vendas), dados fiscais e bancários.
2. **App ID** e pelo menos um **Depot ID** (a Valve emite os dois).
3. **Página da loja** aprovada antes do lançamento.

Com o App ID em mãos, o upload é o `steamcmd` lendo dois arquivos `.vdf`:

```
// scripts/steam/app_build_<APPID>.vdf
"appbuild"
{
  "appid"  "<APPID>"
  "desc"   "Ultrafoot 26 1.0.379"
  "buildoutput" "..\\output\\"
  "contentroot" "..\\..\\dist-loja\\steam\\"
  "setlive" ""            // vazio = não publica; "default" publica no branch padrão
  "depots" { "<DEPOTID>" "depot_build_<DEPOTID>.vdf" }
}
```

```
// scripts/steam/depot_build_<DEPOTID>.vdf
"DepotBuild"
{
  "DepotID" "<DEPOTID>"
  "contentroot" "..\\..\\dist-loja\\steam\\"
  "FileMapping" { "LocalPath" "*" "DepotPath" "." "recursive" "1" }
}
```

```bash
steamcmd +login <usuario> +run_app_build ../scripts/steam/app_build_<APPID>.vdf +quit
```

Na página do Steamworks, ainda:

- **Launch option**: executável `Ultrafoot 26.exe`, sistema Windows.
- **Steam Cloud** (auto-cloud): raiz `WinAppDataRoaming`, subpasta
  `com.ultrafoot.remake.loja`, padrão `*`. É onde o save mora — ele já fica fora
  da pasta de instalação, então sobrevive a qualquer patch.
- **Redistribuíveis**: o VC++ 2015-2022 está nos *Common Redistributables* da
  Steam e sai de graça. O WebView2 **não está** — ver a seção acima.

## Epic Games Store

Cadastro no Epic Dev Portal (sem taxa por aplicativo), aprovação do produto, e
então `BuildPatchTool` apontando para a mesma pasta:

```bash
BuildPatchTool.exe -OrganizationId=<org> -ProductId=<prod> -ArtifactId=<art> \
  -ClientId=<id> -ClientSecret=<segredo> \
  -mode=UploadBinary -BuildRoot="dist-loja\steam" \
  -CloudDir=<nuvem> -BuildVersion=1.0.379 \
  -AppLaunch="Ultrafoot 26.exe" -AppArgs=""
```

O conteúdo é o mesmo; só o empacotador muda. Se quiser separar, rode
`--loja epic` e use `dist-loja/epic`.

---

## Antes de subir — a conferência à mão

O script barra o que dá para automatizar (pasta `launcher` no pacote, recurso
vazio, DLL faltando, executável pequeno demais). O resto precisa de olho:

- [ ] O jogo abre a partir de `dist-loja/<loja>/`, com o Ultrafoot Launcher
      **desinstalado** da máquina.
- [ ] Abre **sem rede** (desligue o Wi-Fi) e chega ao menu.
- [ ] O menu **não** mostra "Registrar", e o selo ao lado do título diz
      "Registrado".
- [ ] **Nenhum** aviso de atualização aparece no arranque.
- [ ] Escudos, fotos de jogadores e camisas aparecem nas telas — se a montagem
      de recursos falhar, é aqui que se vê.
- [ ] Criar carreira, salvar, fechar, reabrir e carregar.
- [ ] A pasta de instalação **não** ganhou uma junção `sav` depois de abrir.
- [ ] O save apareceu em `%APPDATA%\com.ultrafoot.remake.loja`.

---

## O que ainda não está feito

**Assinatura de código (Authenticode).** Nem o jogo nem o launcher são
assinados. Fora de loja isso é o aviso do SmartScreen; para a Steam não é
bloqueio, mas é o item que mais pesa contra na primeira impressão. Precisa de um
certificado OV ou EV comprado.

**Integração com o SDK da loja.** Não há `steam_api64.dll`, nem conquistas, nem
entitlement real — de propósito: amarrar o executável ao Steamworks o tornaria
inutilizável fora da Steam, e hoje não há App ID. O adaptador de input em
[`lib/input/adapters/steam.ts`](lib/input/adapters/steam.ts) já reconhece o
gamepad virtual da Steam **sem** SDK, que é o que o jogador percebe. Conquistas
e Rich Presence da Steam entram depois, num adaptador novo.

**Saves não migram entre os dois canais.** O `identifier` diferente
(`.loja`) faz o save da build de loja morar em outra pasta. É o que impede as
duas instalações de se atropelarem na mesma máquina; se um dia a escolha for a
oposta, é a linha do `conf.identifier` em `scripts/build-loja.mjs` que muda.

**`tauri-plugin-updater` continua como dependência do Cargo.** Ele nunca é
inicializado (o jogo não tem updater desde que o launcher assumiu), mas ainda é
compilado. Removê-lo encolheria o binário; foi mantido porque a geração da
assinatura do instalador na esteira de publicação passa pela configuração do
updater, e mexer nisso arrisca o canal da venda direta por um ganho pequeno.
