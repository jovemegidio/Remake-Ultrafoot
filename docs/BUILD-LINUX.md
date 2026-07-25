# Gerar a versão Linux do Ultrafoot 26 (.AppImage / .deb)

## Por que não dá pela CI da nuvem

Os assets pesados do jogo (`public/escudos`, `public/jogadores`, `public/camisas*`,
áudio, etc.) estão no **`.gitignore`** — não vão para o Git porque são grandes demais.
Um runner do GitHub baixa o repositório **sem** esses arquivos, então não consegue
montar o jogo completo (o build falha em "diretório obrigatório ausente: public/escudos").

Por isso o jogo é buildado **localmente**, onde os assets existem — o mesmo vale para o
Linux. Como seu PC é Windows, a forma mais prática é o **WSL2** (um Ubuntu dentro do
próprio Windows, que enxerga seus arquivos).

## Passo a passo (WSL2)

### 1. Instalar o WSL2 (uma vez)
No PowerShell **como administrador**:

```powershell
wsl --install -d Ubuntu-22.04
```

Reinicie se pedir, e crie usuário/senha do Ubuntu quando abrir.

### 2. Abrir o projeto no WSL2 com os assets

Opção rápida (usa os arquivos do Windows direto — mais lento em disco):

```bash
cd "/mnt/g/Outros computadores/Meu laptop/Trabalho/Ultrafoot - PC"
```

Opção recomendada (mais rápida): copie o projeto para o disco do Linux, **incluindo os
assets** (que estão só no seu Windows, não no Git):

```bash
mkdir -p ~/ultrafoot && cd ~/ultrafoot
cp -r "/mnt/g/Outros computadores/Meu laptop/Trabalho/Ultrafoot - PC/." .
```

> O importante é que `public/escudos` e `public/jogadores` estejam presentes e cheios.

### 3. Buildar

```bash
bash scripts/build-linux.sh
```

O script instala as dependências (webkit2gtk, Rust, etc.), confere os assets e gera:

- `src-tauri/target/release/bundle/appimage/*.AppImage`
- `src-tauri/target/release/bundle/deb/*.deb`

### 4. Distribuir

Publique o **`.AppImage`** (ex.: num release do GitHub) e mande o link. O jogador Linux:

```bash
chmod +x Ultrafoot*.AppImage
./Ultrafoot*.AppImage
```

Sem instalar nada.

## Alternativa: buildar na nuvem mesmo

Se preferir CI, é preciso **entregar os assets ao runner** antes do build — via Git LFS
ou baixando de um bucket/release de assets. O workflow `desktop-platforms.yml` já publica
o resultado num release `desktop-<versão>`; só falta a etapa de obter os assets. É mais
trabalho de infra (os assets têm GB+), mas evita depender de uma máquina local.
