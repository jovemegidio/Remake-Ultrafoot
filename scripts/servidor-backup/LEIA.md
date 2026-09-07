# Backup dos dados do Ultrafoot

O que roda **na VPS** (`31.97.64.102`), instalado em 07/09/2026.

| arquivo | vai para | o que faz |
|---|---|---|
| `ultrafoot-backup` | `/usr/local/bin/` | copia banco, saves e a chave da licenca |
| `ultrafoot-backup.service` | `/etc/systemd/system/` | executa o script |
| `ultrafoot-backup.timer` | `/etc/systemd/system/` | dispara todo dia as 04:10 |

Instalar (ou reinstalar num servidor novo):

```sh
install -m 755 ultrafoot-backup         /usr/local/bin/
install -m 644 ultrafoot-backup.service /etc/systemd/system/
install -m 644 ultrafoot-backup.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ultrafoot-backup.timer
/usr/local/bin/ultrafoot-backup          # roda uma vez para conferir
```

## Por que isto existe

Em 05/09/2026 o jogo mudou de servidor e o banco de contas nao veio junto:
`auth.db` nasceu vazio na maquina nova, e as contas, os saves na nuvem e a chave
privada da licenca ficaram na maquina antiga — que depois saiu do ar de vez.
**Nao havia copia em lugar nenhum**: nem no servidor, nem fora dele, nem no git.

O que salvou os compradores foi um CSV de emissao que por acaso vivia no
computador de casa. As 503 chaves ja vendidas foram reimportadas a partir dele.
Nada mais voltou.

## A outra metade

Este backup mora **na mesma maquina** que ele protege. Isso cobre erro humano e
corrupcao de arquivo; **nao cobre perder o servidor**, que foi justamente o que
aconteceu.

A metade de fora e `scripts/baixar-backup.sh`, no repositorio: ele traz a copia
para `~/.ultrafoot-keys/backups/` e **confere se ela restaura** — descompacta,
roda `integrity_check` e conta as linhas. Backup que ninguem testa e esperanca,
nao copia.

Rode-o de vez em quando, e leve o resultado para fora do computador tambem.
