# Ultrafoot Launcher

App desktop (Tauri) que **baixa, instala e atualiza** o Ultrafoot 26 na máquina do
jogador — em **modo silencioso** — sem precisar atualizar por dentro do jogo.

- UI: Next.js (export estático em `out/`), reaproveitando os componentes em `components/launcher/`.
- Backend nativo: Rust em `src-tauri/` (`src/lib.rs`).
- Dados do jogo: `lib/ultrafoot-data.ts` (versão/changelog/notícias). A **última versão real**
  é confirmada em runtime pelo `latest.json` do GitHub.

## O que o launcher faz

1. **Detecta** a versão instalada do jogo lendo o registro do Windows (`get_installed_game`).
2. **Consulta** a última versão publicada em
   `github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json` (`fetch_latest`).
3. **Baixa** o `setup.exe` com progresso real e **instala/atualiza em silêncio** rodando
   `setup.exe /S` (`download_and_install`).
4. **Abre** o jogo instalado (`launch_game`).

O botão único mostra **Instalar** / **Atualizar** / **Jogar** conforme o estado real.

## Atualização por arquivo (delta) — 1.0.26

Toda atualização do jogo baixava o **instalador inteiro**: uma correção de três
linhas custava ~630 MB para cada jogador, toda vez. Com o ritmo de publicação do
Ultrafoot, esse era o maior custo real do produto.

Agora a publicação pode gerar um **manifesto**: a lista de todos os arquivos da
versão, cada um com `sha256` e tamanho. Os conteúdos ficam num armazém
**endereçado por conteúdo** (`blobs/<2 primeiros do sha>/<sha>.gz`), então
arquivo que não mudou entre versões tem o mesmo nome — não sobe de novo e, o que
importa, **não desce de novo**.

```bash
# na máquina onde o jogo está INSTALADO (não a pasta de build)
node scripts/gerar-manifesto.mjs \
  --pasta "C:\Users\<voce>\AppData\Local\Ultrafoot 26" \
  --versao 1.0.258 \
  --saida .\dist-patch

rsync -av dist-patch/blobs/ vps:/var/www/ultrafoot/downloads/blobs/
scp dist-patch/manifesto-1.0.258.json vps:/var/www/ultrafoot/downloads/
```

E no `latest.json`:

```json
"platforms": { "windows-x86_64": { "url": "…", "manifesto": "https://…/downloads/manifesto-1.0.258.json" } }
```

**As três regras que não podem cair** (`src-tauri/src/patch.rs`):

1. **Nada é aplicado antes de TODOS os blobs estarem baixados e conferidos.** Um
   patch aplicado pela metade é instalação quebrada — pior do que não atualizar,
   e sem instalador para consertar.
2. **Caminho vindo do manifesto é dado de rede.** `..`, caminho absoluto e letra
   de unidade são recusados; sem isso um manifesto adulterado escreveria em
   qualquer lugar do disco.
3. **Falhou? Cai no instalador completo.** O delta é otimização, nunca o único
   caminho. Sem manifesto publicado, o launcher se comporta como sempre se
   comportou.

Nunca apague blobs de versões ainda no ar — o manifesto delas aponta para eles.

O mesmo manifesto alimenta o **verificar integridade** e o **reparar** de
verdade: em vez de rebaixar o instalador, o launcher confere arquivo por arquivo
e busca só os que não batem.

## Requisitos do sistema (1.0.28)

O instalador entregava os arquivos e ia embora. Faltando o **WebView2** ou o
**runtime do Visual C++** na máquina, o jogo instalava "com sucesso" e **não
abria** — e o relato que chegava era "instalei e não acontece nada".

Agora o launcher audita antes de baixar (`src-tauri/src/requisitos.rs`):

| Componente | Papel | Ação |
| --- | --- | --- |
| Microsoft Edge WebView2 | o jogo É uma app Tauri: a interface roda dentro dele | **instala sozinho** |
| Visual C++ 2015-2022 x64 | runtime C do executável e do próprio WebView2 | **instala sozinho** |
| .NET Framework 4.8 | já vem no Win10 1903+; cobre instalação antiga | um clique em Gerenciar |
| DirectX (D3DCompiler) | aceleração gráfica da interface | um clique em Gerenciar |

Regras que valem a pena manter:

- **Detecta antes de instalar.** Rodar um redistribuível à toa custa minutos,
  pede UAC sem motivo e é o jeito mais rápido de o jogador achar que o launcher
  está fazendo besteira.
- **Usa o instalador que já veio com o jogo** (`prerequisites/vc_redist.x64.exe`)
  quando ele existe — não baixa de novo.
- **Nunca bloqueia o download.** Se um requisito falhar, o jogo vai para o disco
  do mesmo jeito e a pendência aparece na aba Gerenciar. Travar a instalação
  inteira por causa de um runtime seria pior.
- **Códigos 3010 e 1638 são sucesso** (reinício pendente / versão igual ou mais
  nova já instalada). Tratá-los como erro faria o launcher insistir para sempre
  num componente que já está lá.
- **Confere de novo na máquina depois de instalar.** O código de saída diz que o
  instalador rodou, não que a dependência ficou utilizável.

Dá para acrescentar um requisito sem lançar versão nova, pelo array `requisitos`
do `launcher-config.json` — mas **só com `sha256`**: isso baixa e executa um
programa, muitas vezes como administrador, e sem conferir a assinatura quem
alterasse a configuração mandaria o launcher rodar o que quisesse na máquina de
todo mundo. Extra sem `sha256` é ignorado de propósito.

O diagnóstico (`Gerenciar → Gerar diagnóstico`) já sai com a tabela preenchida —
é a primeira coisa a olhar quando alguém disser que o jogo não abre.

## O que a aba Gerenciar faz

Tudo isto existia só no backend e não tinha porta de entrada:

| Ação | Onde mora |
| --- | --- |
| Verificar arquivos / reparar | `patch.rs` → `verificar_arquivos` |
| Escolher o disco de instalação | `disco.rs` → `/D=` do NSIS, só antes da 1ª instalação |
| Espaço livre antes de baixar | `disco.rs` → `conferir_espaco` (2,2× o pacote + 300 MB) |
| Limite de velocidade | `controle.rs` → balde de fichas no loop de leitura |
| Pausar / cancelar | `controle.rs` → o pedaço baixado FICA no disco |
| Tempo de jogo e última sessão | `jogo.rs` → `%APPDATA%/Ultrafoot/tempo-de-jogo.json` |
| Desinstalar | `UninstallString` do registro + `/S _?=` |
| Canal beta e atalho | `canal.json` / WScript.Shell |
| Logs e diagnóstico | `diario.rs` → `%APPDATA%/Ultrafoot/logs` |

## O launcher continua vivo enquanto o jogo roda

`launch_game` terminava com `app.exit(0)`: o launcher se matava no instante em
que o jogo abria. Isso custava três coisas de uma vez — a presença no FC Hub
morria justo quando a pessoa começava a jogar, não havia como contar tempo de
jogo, e crash era indistinguível de fechar normalmente.

Agora ele **some para a bandeja** (configurável em Gerenciar) e supervisiona o
processo filho: conta a sessão, volta à tela quando o jogo sai e, se o código de
saída não for zero, notifica e oferece o *Verificar arquivos*.

## Diagnóstico: a linha que prova que a interface subiu

`%APPDATA%/Ultrafoot/logs/launcher-AAAA-MM-DD.log` (data em **UTC**, 7 dias):

```
2026-08-05 00:06:47Z INFO  launcher 1.0.26 iniciado (windows x86_64)
2026-08-05 00:06:48Z INFO  interface no ar — jogo instalado=true versão=1.0.255
```

A segunda linha é o sinal de vida da UI. Se o log tem a primeira e **não** tem a
segunda, o processo subiu e a webview não — janela em branco (CSP bloqueando um
script, arquivo faltando no pacote). Sem ela, os dois casos geram o mesmo relato:
"não abre".

## Idiomas

126 idiomas em `lib/i18n/`. O português é a fonte (`catalogo.ts`); os pacotes são
`Partial<Catalogo>` de propósito, e o que faltar cai na cadeia
**idioma → idioma base → inglês → português**. Um idioma pela metade mostra a
frase em outro idioma; nunca mostra a chave crua. O seletor exibe a cobertura em
porcentagem — é mais honesto do que deixar o jogador descobrir sozinho.

Para saber onde continuar:

```bash
node scripts/qa-idiomas.mjs             # 48 completos, 78 parciais (05/08/2026)
node scripts/qa-idiomas.mjs --faltando  # as chaves que faltam, idioma a idioma
```

Completos hoje: as famílias ocidental (inglês, espanhol, francês, italiano,
neerlandês, galego, catalão e as variantes), germânica/nórdica (alemão, sueco,
dinamarquês, norueguês ×2, finlandês, islandês, feroês, africâner,
luxemburguês), eslava inteira (12), Oriente Médio (árabe, turco, hebraico,
persa, urdu, pashto, curdo ×2, sindi, azerbaijano) e leste asiático (chinês ×2,
cantonês, japonês, coreano). Os demais têm o núcleo — navegação, botões e
estados de download — e completar é só acrescentar chaves em `lib/i18n/textos/`.

⚠️ A janela abre **sem decoração do sistema** (`decorations: false`). Quem mexer
nisso precisa lembrar que a barra e as bordas de redimensionar passaram a ser
nossas: `components/launcher/barra-de-titulo.tsx`.

### Recibo da compra

Na aba da loja, todo pedido **já pago** ganha um botão de recibo. O launcher pede
`POST /recibo` ao servidor de contas e abre a página preenchida no navegador do
sistema — é lá que existe "Salvar como PDF" de verdade.

Duas coisas que **não** podem mudar:

- **O número é do servidor.** `recibos.pedido_id` é UNIQUE: o segundo clique
  devolve o mesmo recibo, não um número novo. Se a numeração passasse a nascer no
  launcher, cada máquina começaria a contar do zero.
- **Os dados vão depois do `#`, não do `?`.** O fragmento nunca é enviado ao
  servidor; com querystring, a chave de ativação de quem comprou iria parar no log
  de acesso do nginx a cada impressão.

### Uma instância por vez

O launcher tem várias portas de entrada — atalho na área de trabalho, "iniciar com
o Windows", ícone na bandeja — e ainda é reaberto pelo instalador do jogo. Abrir a
segunda **não** cria outro processo: o `tauri-plugin-single-instance` avisa o que já
está aberto, e ele traz a janela de volta e dá foco (`show_main`).

Por que isso importa: fechar no X apenas esconde a janela, então era fácil abrir
"mais um" sem perceber, e **dois launchers baixando a mesma atualização gravam no
mesmo arquivo temporário** — um corrompe o download do outro. É o mesmo tipo de
falha que já derrubou o auto-update antes (ver o bug do `%TEMP%` mais abaixo).

O plugin é registrado **primeiro**, antes de qualquer outro: ele decide se este
processo continua vivo, e isso tem de valer antes de a bandeja ou o autostart
reservarem recurso. O auto-update não é afetado — `self_update` chama `app.exit(0)`
antes de o `.bat` esperar os 2 s e reabrir o executável.

---

## Pré-requisitos (uma vez por máquina)

- Node + **pnpm** (já usado no projeto).
- **Rust** (stable) + toolchain MSVC — igual ao do jogo.
- **Importante:** compile a partir de um **disco local (C:)**. A pasta do Google Drive (`G:`)
  não builda (o Next/Tauri falha com `Get-Volume … DriveLetter G` e I/O lento). Copie o projeto
  para, por exemplo, `C:\ultrafoot-launcher` antes de buildar.

## Rodar em desenvolvimento

```bash
cd Launcher
pnpm install
pnpm tauri:dev
```

No navegador puro (`pnpm dev`) a UI abre com download **simulado** (fallback), útil para mexer no visual.

## Gerar os ícones (uma vez, opcional)

Os ícones do jogo já foram copiados para `src-tauri/icons`, então o build já funciona.
Para regenerar a partir da arte do launcher:

```bash
cd Launcher
pnpm tauri:icon         # usa ../public/games/ultrafoot-icon.png
```

## Buildar o instalador do launcher

```bash
cd Launcher
pnpm tauri:build
```

Saída (NSIS): `src-tauri/target/release/bundle/nsis/Ultrafoot Launcher_<versão>_x64-setup.exe`.
Esse instalador suporta modo silencioso: `"...setup.exe" /S`.

> Assinatura Authenticode (opcional): assine o `-setup.exe` do launcher com o mesmo
> certificado do jogo (`scripts/sign-installer.ps1` na raiz) antes de distribuir.

---

## Distribuir para os jogadores

### Quem ainda NÃO tem o jogo
Mande o **link estável** do launcher (release rolling `launcher`):

```
https://github.com/jovemegidio/Ultrafoot26/releases/download/launcher/Ultrafoot-Launcher-Setup.exe
```

Ao abrir, o launcher mostra **Instalar**, baixa o jogo do GitHub e instala em silêncio.

### O launcher se auto-atualiza
O launcher verifica, ao abrir, o `launcher.json` do release `launcher`
(`.../releases/download/launcher/launcher.json`). Se houver uma versão mais nova do
**próprio launcher**, ele baixa, instala e reabre sozinho — os players nunca precisam
reinstalar manualmente.

Para publicar uma nova versão do launcher:

```bash
# 1) bump da versao em Launcher/src-tauri/Cargo.toml e Launcher/package.json (ex.: 1.0.1)
# 2) build (em C:)
cd Launcher && pnpm tauri:build

# 3) sobe no release rolling "launcher" com nome de arquivo FIXO + o launcher.json:
#    - renomeie o setup para Ultrafoot-Launcher-Setup.exe
#    - atualize a "version" e a "url" no launcher.json
gh release upload launcher "Ultrafoot-Launcher-Setup.exe" "launcher.json" \
  --repo jovemegidio/Ultrafoot26 --clobber
```

Na próxima abertura, todos os launchers instalados detectam a nova versão e se atualizam.

### Config remota (notícias, banner, redes, status do servidor)
O launcher lê, ao abrir, um **`launcher-config.json`** do release `launcher`
(`.../releases/download/launcher/launcher-config.json`). Edite esse arquivo e
**todos os launchers atualizam na hora, sem rebuild**.

A fonte é **`services/cloud-save-server/launcher-config.json`**, no repositório —
não edite o arquivo direto no release. Ele era mantido só lá, à mão, e envelheceu
sozinho: o jogo chegou à 1.0.201 com o launcher anunciando a 1.0.175 como última
versão. Hoje o `deploy-tudo.mjs` publica esse arquivo junto e **reprova o deploy**
cujo changelog não fale da versão que está subindo.

Campos (todos opcionais):

```json
{
  "announcement": { "text": "Aviso no topo", "level": "info" },
  "news": [
    { "title": "Título", "category": "Novidades", "body": "Texto", "date": "2026-07-24", "pinned": true }
  ],
  "social": {
    "discord": "https://discord.gg/SEU_CONVITE",
    "youtube": "https://youtube.com/@SEU_CANAL",
    "tiktok": "https://tiktok.com/@SEU_PERFIL",
    "instagram": "https://instagram.com/SEU_PERFIL"
  },
  "serverStatusUrl": "https://SEU-RELAY.workers.dev"
}
```

- `announcement`: barra no topo (`level`: `info` ou `warning`).
- `news`: substitui as notícias embutidas (as de `config` têm prioridade).
- `social`: botões de Discord/YouTube/TikTok/Instagram (só aparecem os preenchidos).
- `serverStatusUrl`: o launcher faz `GET {url}/health` e mostra "Servidor online/offline".

Para atualizar só a config (sem tocar no launcher):
```bash
node scripts/publicar-launcher-config.mjs              # confere e mostra o que subiria
node scripts/publicar-launcher-config.mjs --publicar   # sobe e confere no ar
```

### Assinatura (Authenticode / SmartScreen)
Sem assinatura, o Windows mostra "editor desconhecido". Para remover isso, assine o
`-setup.exe` do launcher com um **certificado de code signing** (OV/EV de uma CA —
certificado auto-assinado NÃO resolve o SmartScreen). Assine ANTES de subir no release:

```powershell
signtool sign /fd sha256 /td sha256 /tr http://timestamp.digicert.com `
  /f SEU_CERT.pfx /p SUA_SENHA `
  "src-tauri\target\release\bundle\nsis\Ultrafoot Launcher_<versao>_x64-setup.exe"
```

(É o mesmo certificado usado pelo jogo em `scripts/sign-installer.ps1`, via
`CERT_THUMBPRINT` ou `PFX_PATH`/`PFX_PASSWORD`.)

### Quem JÁ tem o jogo (launcher automático e silencioso)
O instalador do **jogo** passa a embutir o launcher e instalá-lo em silêncio no
pós-instalação (hook NSIS). Fluxo a cada nova build do jogo:

```bash
# 1) builda o launcher (em C:)
cd Launcher && pnpm tauri:build

# 2) coloca o setup do launcher dentro dos resources do jogo
cd ..                       # raiz do projeto
node scripts/stage-launcher.mjs        # copia p/ src-tauri/resources/launcher/UltrafootLauncher-setup.exe

# 3) builda o jogo normalmente
npm run tauri:build
```

Assim, quando o jogador atualizar o jogo **uma última vez** (pelo caminho atual), o
instalador do jogo instala o Ultrafoot Launcher em silêncio. Dali em diante, todas as
atualizações passam a ser feitas pelo launcher.

Se a pasta `src-tauri/resources/launcher/` estiver vazia, o build do jogo funciona
normalmente e o passo do launcher é ignorado.

---

## O que mudou no JOGO (resumo)

- **Abrir o jogo abre o launcher primeiro:** ao ser iniciado direto (atalho/`.exe`),
  o jogo procura o launcher instalado, abre-o e se encerra. O launcher abre o jogo com
  `--via-launcher`, e aí o jogo roda normalmente. Sem launcher instalado, o jogo abre
  direto (nunca trava o jogador). Ao clicar **Jogar** no launcher, ele fecha e o jogo assume.
- **Sem updater in-game:** o plugin `tauri-plugin-updater` não é mais registrado
  (`src-tauri/src/lib.rs`) e `updater:default` saiu das capabilities. O jogo não baixa
  nem instala atualização sozinho.
- **Checagem de versão preservada:** `lib/updater.ts` agora só lê o `latest.json` e compara
  a versão — isso mantém o **bloqueio do online** para clientes desatualizados e mostra um
  aviso orientando a atualizar pelo launcher.
- **latest.json intacto:** `createUpdaterArtifacts` e a assinatura (`.sig`) continuam sendo
  gerados, então `scripts/publish-release.mjs` segue funcionando sem mudanças.

## Publicar uma nova versão do jogo (inalterado)

```bash
npm run tauri:build
node scripts/publish-release.mjs --publish   # gera latest.json + cria o release no GitHub
```

O launcher (e o aviso de versão do jogo) enxergam a nova versão automaticamente pelo `latest.json`.
