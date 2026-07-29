# Plano — Separação do segredo de licença (Ed25519 + ativação online)

Status: **em execução** — todo o código está pronto (etapas 1–8; ver tabela em §6).
O que falta é operacional e **não é código**: levar a chave privada para a VPS,
rodar a reemissão lá, publicar a v1.0.202 e só então mergear o branch da etapa 6.
Decisões tomadas: formato **B** (chave curta + ativação online) e migração por
**corte imediato com reemissão automática para contas**.

---

## 1. O problema

Hoje um único segredo tem dois papéis incompatíveis:

```
~/.ultrafoot-keys/ultrafoot-license.secret
  │
  ├─► scripts/preparar-env-licenca.mjs
  │     └─► NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET
  │           └─► inlinado em texto puro no bundle JS  ⚠️  vai para o comprador
  │
  └─► services/auth-server/server.py:100
        └─► montar_codigo()  →  emite as chaves vendidas por R$ 30,00
```

`NEXT_PUBLIC_*` é substituído literalmente pelo Next no bundle. Um `grep` nos
`.js` do instalador devolve o segredo. Com ele, qualquer pessoa reimplementa
`montar_codigo()` (o algoritmo está documentado em `lib/license.ts`) e gera
chaves matematicamente válidas sem limite.

**Causa raiz:** HMAC é simétrico — verificar e assinar usam a mesma chave.
Enquanto a verificação for offline com HMAC, o segredo de emissão precisa
viajar dentro do app. Não é um erro de configuração; é a propriedade do
algoritmo escolhido.

`data/seeds/licencas-revogadas.json` está vazio: **nenhuma chave vazou ainda**.
Esta é uma correção preventiva, não resposta a incidente.

---

## 2. A solução

**Assinatura assimétrica (Ed25519).** Chave privada assina no servidor e nunca
sai da VPS; chave pública verifica no jogo e pode ir no binário sem risco.
Extrair a pública não permite forjar nada.

A chave vendida passa a ser um **identificador aleatório**, não um dado
assinado. A verdade sobre "esta chave é válida" mora no banco do servidor, não
na matemática do código. Consequência: **é impossível forjar por construção** —
nem com a chave privada vazada dá para adivinhar um identificador que exista no
banco.

### Fluxo

```
COMPRA          servidor sorteia identificador aleatório, grava em `licencas`
                  └─► UF26-ABCDE-FGHIJ-KLMNO   (mesmo formato de hoje)

1ª ATIVAÇÃO     jogo → POST /licenca/ativar {codigo, device_id}
                servidor confere no banco, marca a máquina e devolve
                  └─► certificado assinado com Ed25519 (privada)

DAÍ EM DIANTE   jogo verifica o certificado local com a chave PÚBLICA
                  └─► 100% offline, para sempre, sem rede
```

Requisitos preservados:

- Validação **offline** depois da primeira ativação (requisito do jogo desktop)
- O jogo **continua não travando** sem registro — decisão de produto registrada
  em `app/splash/page.tsx:191-193`, mantida integralmente
- Formato da chave **idêntico** ao atual (digitável, alfabeto Crockford)
- Revogação passa a funcionar de verdade (hoje depende de lista embutida no build)

---

## 3. Mudanças por arquivo

### 3.1 Novo: `lib/licenca-certificado.ts`

Verificação offline do certificado. Só a **chave pública**, embutida como
constante no código — não é segredo, não precisa de `.env`, não precisa de
`NEXT_PUBLIC_`.

```ts
const CHAVES_PUBLICAS: Record<string, string> = {
  "v1": "MCowBQYDK2VwAyEA...",   // Ed25519 SPKI, base64. Pública.
}

export interface Certificado {
  codigo: string      // UF26-ABCDE-FGHIJ-KLMNO
  device: string      // amarra o certificado a esta máquina
  kid: string         // qual chave pública confere este certificado
  emitidoEm: number
  serie: number
}

export async function verificarCertificado(bruto: string): Promise<Certificado | null>
```

#### ⚠️ Ed25519 no Web Crypto NÃO está garantido na webview

Verificado nesta máquina: `crypto.subtle.verify("Ed25519", …)` funciona no Node
22, mas emite `ExperimentalWarning`. No Chromium, Ed25519 só saiu do flag no
**Chrome 137 (2025)**. O jogo roda em **WebView2**, cuja versão é a que estiver
instalada na máquina do jogador — em Windows desatualizado pode ser bem mais
antiga.

Se `importKey` lançar, a verificação falha e **o comprador legítimo perde o
registro**. É exatamente o falso negativo que o projeto decidiu evitar.

Antes de escrever a etapa 3, medir:

```js
// rodar dentro da webview do Tauri, não no Node
await crypto.subtle.importKey("spki", bytes, { name: "Ed25519" }, false, ["verify"])
```

**DECIDIDO: verificação no Rust** (`src-tauri/src/licenca.rs`, implementado).
A crate `ed25519-dalek` verifica sem depender da webview; o TS chama por
`invoke("verificar_licenca")`. É o mesmo binário para todo jogador, então o
risco de WebView2 antiga desaparece por completo.

Alternativas descartadas: P-256 via Web Crypto (funciona há anos, mas troca o
algoritmo sem necessidade) e polyfill de Ed25519 em JS (mais código
criptográfico para manter).

O par gerado na etapa 1 serve sem mudança.

### 3.2 Novo: `services/auth-server/licenca.py`

Emissão e ativação. Chave **privada** só aqui, via
`ULTRAFOOT_LICENSE_PRIVATE_KEY` (variável de ambiente da VPS, nunca no repo).

```python
def emitir_licenca(con, conta_id: int) -> str:
    """Sorteia um identificador aleatório e grava. Idempotente por conta."""
    # secrets.token_bytes → base32 Crockford → UF26-ABCDE-FGHIJ-KLMNO

def ativar_licenca(con, codigo: str, device: str) -> str | None:
    """Confere no banco, amarra à máquina e devolve o certificado assinado."""
```

Ed25519 **não está na stdlib** do Python. O projeto tem a regra explícita de
"nada de pip na VPS" (`server.py:7`). Duas saídas, decidir na execução:

- **`cryptography`** via `apt install python3-cryptography` (pacote da distro,
  não pip) — respeita o espírito da regra
- **implementação pura** de Ed25519 em ~100 linhas de stdlib — sem dependência
  alguma, porém código criptográfico escrito à mão (não recomendado)

Recomendação: `python3-cryptography` pelo apt.

### 3.3 Schema — `services/auth-server/schema.sql`

```sql
CREATE TABLE IF NOT EXISTS licencas (
  codigo      TEXT PRIMARY KEY,      -- UF26-ABCDE-FGHIJ-KLMNO
  conta_id    INTEGER REFERENCES contas(id),
  serie       INTEGER NOT NULL,
  emitida_em  INTEGER NOT NULL,
  device      TEXT,                  -- NULL até a 1ª ativação
  ativada_em  INTEGER,
  revogada    INTEGER NOT NULL DEFAULT 0,
  motivo_revogacao TEXT
);
CREATE INDEX IF NOT EXISTS idx_licencas_conta ON licencas(conta_id);
```

`licencas_migradas` e `series_emitidas` permanecem — são o histórico que
alimenta a reemissão da fase 1.

### 3.4 Rotas novas em `server.py`

| Rota | Auth | O que faz |
|---|---|---|
| `POST /licenca/ativar` | nenhuma¹ | Recebe `{codigo, device}`, devolve certificado assinado |
| `POST /licenca/minha` | sessão | Devolve a licença da conta (recuperação pós-formatação) |
| `POST /admin/revogar-licenca` | sessão + admin | Marca `revogada = 1` |

¹ Sem sessão de propósito: quem comprou fora do launcher precisa ativar sem
conta. A proteção é o próprio identificador aleatório + rate limit por IP,
reaproveitando `excedeu_tentativas()` que já existe.

**Rate limit é obrigatório aqui.** Sem ele, `/licenca/ativar` vira oráculo de
força bruta contra o espaço de chaves.

### 3.5 `lib/license.ts` — o corte

Remover `SEGREDO`, `montarCodigo()` e o HMAC. O arquivo passa a só reconhecer o
**formato** e delegar a validade ao certificado.

Manter uma função que identifica o formato antigo, para a mensagem de
transição (ver §4).

### 3.6 `scripts/preparar-env-licenca.mjs` — **apagar**

É o script que injeta o segredo no bundle. Com Ed25519 a chave pública é
constante no código; não há nada a preparar. Apagar o arquivo e o `prebuild` que
o chama em `package.json`.

Verificar depois do build que o segredo sumiu:

```bash
grep -r "ULTRAFOOT_LICENSE_SECRET" out/ .next/    # deve não retornar nada
```

---

## 4. Migração — corte imediato com rede de proteção

Decisão: **só chave nova a partir da v1.0.202**. Chaves antigas (lotes 0–9,
HMAC) deixam de validar.

O risco desta escolha é o comprador legítimo que instalou e **nunca criou
conta**: ele não está em `licencas_migradas` e não é alcançável por reemissão
automática.

**O que torna o corte seguro:** o jogo não trava sem registro
(`app/splash/page.tsx:191-193`). Uma chave antiga que para de validar degrada
para "versão não registrada" — um lembrete, não um bloqueio. A pessoa continua
jogando.

Para não deixá-la sem explicação, `mensagemDeErro()` ganha um caso específico:

```ts
// Detecta o formato ANTIGO (15 caracteres, HMAC) e explica em vez de dizer
// só "código inválido" — quem pagou merece saber o que fazer.
case "formato-antigo":
  return "Sua chave é de uma versão anterior. Entre na sua conta Ultrafoot " +
         "para receber a nova chave, ou fale com o suporte."
```

Isso mantém o corte imediato **e** elimina o caso do comprador confuso.

### Passos

1. **Antes de publicar:** rodar reemissão para todas as contas com
   `ativado = 1`, gravando as novas licenças em `licencas`
2. **Publicar v1.0.202** com Ed25519 e a mensagem de transição
3. **Launcher:** ao detectar chave antiga, chamar `/licenca/minha` e depositar
   a nova automaticamente — a maioria dos compradores migra **sem perceber**
4. **Suporte:** quem comprou sem conta cria uma e o admin vincula a licença

### Script de reemissão

`services/auth-server/reemitir-licencas.py` — **implementado**. Roda na VPS,
idempotente:

```bash
python3 reemitir-licencas.py              # simulação: mostra o que faria
python3 reemitir-licencas.py --executar   # grava de verdade
python3 reemitir-licencas.py --conferir   # só relatório
```

**Em Python, não `.mjs` como este plano dizia.** O motivo: emitir licença exige a
lógica de `licenca.py` (alfabeto Crockford, `secrets`, tabela `licencas`).
Reescrevê-la em Node duplicaria código criptográfico em duas linguagens, e
qualquer divergência entre as duas produziria códigos malformados em silêncio.
O script importa `licenca.py` e reusa a mesma função que o servidor usa. Segue o
precedente do `tornar-admin.py`, que já é Python e mora ao lado do servidor.

Critério: `ativado = 1 AND bloqueada = 0`. Contas **banidas ficam de fora** —
reemitir para quem foi banido devolveria o acesso que o banimento tirou.

Não precisa da chave privada: o script só sorteia identificadores e grava. A
assinatura acontece depois, na primeira ativação de cada jogador. Dá para
reemitir antes mesmo de a privada estar na VPS.

---

## 5. Rotação da chave privada

O ponto que torna a solução **durável**: se a privada vazar, chaves já vendidas
**não são invalidadas**.

Certificados carregam `kid` (key id). O jogo embute um **mapa** de chaves
públicas, não uma só:

```ts
const CHAVES_PUBLICAS: Record<string, string> = {
  "v1": "MCowBQYDK2VwAyEA...",
  "v2": "MCowBQYDK2VwAyEA...",   // adicionada na rotação
}
```

Rotacionar = gerar novo par, publicar build com a pública nova adicionada (não
substituída), e passar a assinar com a privada nova. Certificados antigos
continuam verificando com a pública antiga. **Nenhum comprador é afetado.**

---

## 6. Ordem de execução

| # | Etapa | Estado | Depende de |
|---|---|---|---|
| 1 | Gerar par Ed25519; privada na VPS via env, pública commitada | ✅ código; **falta levar a privada para a VPS** | — |
| 2 | `licenca.py` + tabela `licencas` + rotas | ✅ feito | 1 |
| 3 | Verificação offline — `src-tauri/src/licenca.rs` (Rust, não TS) | ✅ feito | 1 |
| 4 | Testes: forja rejeitada, replay entre máquinas, revogação, offline pós-ativação | ✅ feito (`pnpm qa:licenca`) | 2, 3 |
| 5 | `reemitir-licencas.py` e execução na VPS | ✅ script pronto; **falta rodar na VPS** | 2 |
| 6 | Remover `preparar-env-licenca.mjs`, `SEGREDO` e o `prebuild` | ✅ **aplicado NESTE branch** | 3, 5 |
| 7 | Launcher: troca automática da chave antiga | ✅ feito (`migrarSePreciso()`) | 5 |
| 8 | Build do corte + verificar que o segredo sumiu do bundle | ⏳ verificador pronto (`pnpm qa:bundle-sem-segredo`); falta gerar a build | 6, 7 |
| 9 | Aposentar `ULTRAFOOT_LICENSE_SECRET` da VPS | ❌ ação na VPS | 8 |

**Você está no branch do corte.** A etapa 6 está aplicada aqui, e é daqui que a
build do corte deve sair — no `feat/launcher-desktop` o `SEGREDO` ainda existe, e
a build de lá sairia com ele dentro, exatamente o que a etapa 8 existe para
impedir.

O **bump de versão ainda não foi feito**. A versão acompanha o
`feat/launcher-desktop` (hoje **1.0.211**) e só deve subir quando a reemissão já
tiver rodado na VPS — antes disso, uma release marcada como "do corte" quebraria
quem ainda depende da chave antiga. O plano falava em "v1.0.202" quando foi
escrito; o número real será o próximo disponível na época do corte.

Etapas 2 e 3 são paralelizáveis. **A etapa 6 não pode vir antes da 5** — remover
o segredo antes de reemitir deixaria os compradores atuais sem caminho.

### Como aplicar a etapa 6, quando chegar a hora

O corte está pronto no branch `chore/licenca-etapa-6-corte-hmac`, **não mergeado
de propósito**. A ordem obrigatória:

1. Privada na VPS (etapa 1) — `scp` + `chmod 600` + systemd
2. Subir o auth-server novo uma vez (aplica o schema, cria a coluna `ativado`)
3. `python3 reemitir-licencas.py` e conferir a simulação
4. `python3 reemitir-licencas.py --executar`
5. Publicar a v1.0.202 **com a etapa 7** e confirmar que a migração silenciosa
   está funcionando para quem tem chave antiga
6. **Só então** mergear `chore/licenca-etapa-6-corte-hmac`
7. Etapa 9: remover `ULTRAFOOT_LICENSE_SECRET` do systemd da VPS

Mergear o branch antes do passo 4 tira a validação da chave antiga enquanto a
nova ainda não existe — o comprador legítimo vira "versão não registrada".

---

## 7. Testes obrigatórios

Estender `scripts/qa-licenca.ts`:

Implementados em `scripts/qa-licenca-ed25519.ts` (`pnpm qa:licenca`), nos testes
de `src-tauri/src/licenca.rs` e no verificador de bundle:

- [x] Certificado forjado (assinatura aleatória) → **rejeitado**
- [x] Certificado válido de OUTRA máquina → **rejeitado** (device confere)
- [x] Chave revogada no servidor → ativação **recusada**
- [x] Após ativar, **sem rede**: jogo reconhece registro
- [x] Chave no formato antigo → mensagem de transição, **não** "inválido"
      (`mensagemDeErro("formato-antigo")`)
- [x] `/licenca/ativar` sob força bruta → rate limit dispara (429)
- [x] Ativar a mesma chave duas vezes na mesma máquina → idempotente
- [x] Bundle sem o segredo → `pnpm qa:bundle-sem-segredo`, **roda depois do build**

Extras que os testes cobrem e não estavam nesta lista: adulterar um campo do
payload invalida a assinatura; reescrever o `device` dentro do certificado
também; a chave pública do jogo corresponde à privada do servidor (lida do
`licenca.rs`, não copiada); e os fluxos de conta reescritos (registro, login,
Google, compra) continuam vinculando licença corretamente.

### Sobre o `grep` que este plano pedia

A versão original dizia:

```bash
grep -r "ULTRAFOOT_LICENSE_SECRET" out/ .next/    # deve não retornar nada
```

Esse comando **passa quando não devia**, por dois motivos:

1. O Next substitui `process.env.NEXT_PUBLIC_*` pelo **valor**. O nome da
   variável não sobra no bundle — sai junto. Procurar o nome pode devolver vazio
   com o segredo ali, em texto puro.
2. Rodado antes do build, devolve vazio também. "Nenhum resultado" fica
   indistinguível de "não verifiquei nada".

`scripts/verificar-bundle-sem-segredo.mjs` procura o **valor** (além do nome) e
**falha** quando não há saída de build para inspecionar, em vez de aprovar no
silêncio.

---

## 8. O que este plano NÃO resolve

Honestidade sobre o alcance, para não gerar falsa sensação de segurança:

- **Não impede pirataria por patch do binário.** Quem edita o executável para
  pular a verificação continua conseguindo. Nenhum esquema client-side resolve
  isso — e como o jogo não trava sem registro, o ganho de piratear já é baixo.
- **O que resolve:** acaba com a **fabricação de chaves válidas**, que é o que
  destrói a receita — chave forjada é indistinguível de comprada e circula em
  fórum. Chave aleatória conferida no banco não tem esse problema.
- **Não cobre** os outros achados da análise (cloud-save sem autenticação, HSTS,
  CSP). São itens separados.
