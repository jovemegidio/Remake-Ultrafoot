// ETAPA 1 — GERA O PAR DE CHAVES Ed25519 DA LICENCA.
//
//   node scripts/gerar-par-licenca.mjs
//   node scripts/gerar-par-licenca.mjs --kid v2      (rotacao; ver o fim do arquivo)
//
// POR QUE Ed25519 E NAO O HMAC DE ANTES.
//
// HMAC e simetrico: a MESMA chave assina e confere. Como o jogo confere offline,
// o segredo precisava viajar dentro do app — e `NEXT_PUBLIC_*` o deixava em
// texto puro no bundle. Quem extraia a string emitia chaves a vontade, porque
// era exatamente a chave que o servidor usa para VENDER.
//
// Assimetrico separa os dois papeis:
//
//   PRIVADA  assina no servidor      → nunca sai da VPS
//   PUBLICA  confere no jogo         → pode ir no binario, nao serve para forjar
//
// Extrair a publica do bundle nao da poder nenhum: com ela so se VERIFICA.
//
// ─────────────────────────────────────────────────────────────────────────────
//
// ONDE CADA METADE VAI PARAR:
//
//   ~/.ultrafoot-keys/ultrafoot-licenca-<kid>.private.pem   ← NUNCA comitar
//        └─► copiar para a VPS como ULTRAFOOT_LICENSE_PRIVATE_KEY
//
//   ~/.ultrafoot-keys/ultrafoot-licenca-<kid>.public.pem    ← pode comitar
//        └─► colar em lib/licenca-certificado.ts (etapa 3)
//
// A pasta e a MESMA do segredo antigo e da chave do updater, de proposito: um
// lugar so para lembrar de fazer backup. Perder a privada nao invalida chave ja
// vendida (ver ROTACAO no fim), mas impede emitir chave nova.

import { generateKeyPairSync } from "node:crypto"
import { writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs"
import path from "node:path"
import os from "node:os"

const PASTA_CHAVES = path.join(os.homedir(), ".ultrafoot-keys")

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao
}

// O `kid` (key id) viaja DENTRO de cada certificado emitido e diz ao jogo qual
// chave publica usar para conferir. E o que torna a rotacao possivel sem quebrar
// quem ja comprou: o jogo guarda um MAPA de publicas, nao uma so.
const kid = String(arg("kid", "v1")).trim()

if (!/^v[0-9]+$/.test(kid)) {
  console.error(`--kid invalido: "${kid}". Use v1, v2, v3...`)
  console.error("O formato importa: ele vai dentro do certificado e indexa o mapa de chaves publicas.")
  process.exit(1)
}

const ARQ_PRIVADA = path.join(PASTA_CHAVES, `ultrafoot-licenca-${kid}.private.pem`)
const ARQ_PUBLICA = path.join(PASTA_CHAVES, `ultrafoot-licenca-${kid}.public.pem`)

// NUNCA sobrescrever em silencio. Regerar por cima de um par em uso invalidaria
// todo certificado ja emitido com ele — e sem backup nao ha como voltar.
if (existsSync(ARQ_PRIVADA) || existsSync(ARQ_PUBLICA)) {
  console.error(`\n  Ja existe um par com kid "${kid}":`)
  if (existsSync(ARQ_PRIVADA)) console.error(`    ${ARQ_PRIVADA}`)
  if (existsSync(ARQ_PUBLICA)) console.error(`    ${ARQ_PUBLICA}`)
  console.error("\n  Nao vou sobrescrever: os certificados ja assinados com essa chave")
  console.error("  parariam de ser reconhecidos pelo jogo.")
  console.error(`\n  Para rotacionar, use um kid novo:  node scripts/gerar-par-licenca.mjs --kid v${Number(kid.slice(1)) + 1}\n`)
  process.exit(1)
}

mkdirSync(PASTA_CHAVES, { recursive: true })

const { privateKey, publicKey } = generateKeyPairSync("ed25519")

// PKCS#8 / SPKI em PEM: e o que a biblioteca `cryptography` do Python le direto
// no servidor (etapa 2) e o que o `crypto.subtle.importKey` aceita no jogo
// (etapa 3), sem conversao manual no meio.
const pemPrivada = privateKey.export({ type: "pkcs8", format: "pem" })
const pemPublica = publicKey.export({ type: "spki", format: "pem" })

writeFileSync(ARQ_PRIVADA, pemPrivada, "utf8")
writeFileSync(ARQ_PUBLICA, pemPublica, "utf8")

// 0600 = so o dono le. Em Windows o chmod e praticamente inocuo, mas o arquivo
// tambem vai para a VPS (Linux), e la isso vale: sem isso qualquer usuario da
// maquina leria a chave que emite as licencas vendidas.
try {
  chmodSync(ARQ_PRIVADA, 0o600)
} catch {
  // Windows sem suporte a permissao POSIX: segue, o aviso final cobre o risco.
}

// A publica em base64 de UMA linha e o formato que vai para o codigo do jogo na
// etapa 3 — cabe numa constante, sem cabecalho PEM e sem quebra de linha.
const publicaBase64 = pemPublica
  .replace(/-----BEGIN PUBLIC KEY-----/, "")
  .replace(/-----END PUBLIC KEY-----/, "")
  .replace(/\s+/g, "")

console.log(`\n  Par Ed25519 gerado (kid: ${kid}).\n`)
console.log(`  PRIVADA  ${ARQ_PRIVADA}`)
console.log(`  PUBLICA  ${ARQ_PUBLICA}\n`)
console.log("  ─────────────────────────────────────────────────────────────────\n")
console.log("  CHAVE PUBLICA (etapa 3 — vai em lib/licenca-certificado.ts):\n")
console.log(`    "${kid}": "${publicaBase64}",\n`)
console.log("  Pode comitar: com ela so se CONFERE assinatura, nunca se cria uma.\n")
console.log("  ─────────────────────────────────────────────────────────────────\n")
console.log("  PROXIMOS PASSOS\n")
console.log("  1. Backup da privada, FORA desta maquina. Sem ela nao se emite")
console.log("     licenca nova (as ja vendidas continuam valendo).\n")
console.log("  2. Levar a privada para a VPS — pelo terminal DELA, sem colar em")
console.log("     chat, ticket ou commit:\n")
console.log(`       scp "${ARQ_PRIVADA}" root@SEU_VPS:/etc/ultrafoot/licenca-${kid}.pem`)
console.log(`       ssh root@SEU_VPS chmod 600 /etc/ultrafoot/licenca-${kid}.pem\n`)
console.log("  3. No systemd do auth-server (ultrafoot-auth.service):\n")
console.log(`       Environment=ULTRAFOOT_LICENSE_KID=${kid}`)
console.log(`       Environment=ULTRAFOOT_LICENSE_PRIVATE_KEY=/etc/ultrafoot/licenca-${kid}.pem\n`)
console.log("     Caminho de ARQUIVO, nao o conteudo da chave: variavel de ambiente")
console.log("     vaza em `ps`, em log de crash e no journal.\n")
console.log("  4. NAO remova ainda o ULTRAFOOT_LICENSE_SECRET antigo. Ele so sai")
console.log("     depois da reemissao (etapa 5) — antes disso, quem ja comprou")
console.log("     ficaria sem caminho de migracao.\n")

// ─────────────────────────────────────────────────────────────────────────────
//
// ROTACAO — o que torna isto durável.
//
// Se a privada vazar, NAO e preciso invalidar o que ja foi vendido:
//
//   1. node scripts/gerar-par-licenca.mjs --kid v2
//   2. ADICIONAR a publica v2 ao mapa em lib/licenca-certificado.ts,
//      mantendo a v1 no lugar
//   3. publicar a build
//   4. apontar o servidor para a privada v2
//
// Certificados assinados com v1 continuam conferindo com a publica v1; os novos
// saem com v2. Nenhum comprador e afetado. Foi para isso que o `kid` existe.
//
// Se a v1 tiver sido usada para emitir chave FRAUDULENTA, ai sim se remove a
// publica v1 do mapa — mas antes disso reemita as licencas legitimas em v2,
// senao compradores de verdade perdem o registro junto com os forjados.
