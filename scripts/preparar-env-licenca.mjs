// LIMPA o segredo de licenca do .env.local antes do build.
//
// ⚠️ ESTE SCRIPT FAZIA O CONTRARIO — E ERA O DEFEITO (corrigido na 1.0.379).
//
// Ele ESCREVIA o segredo como `NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET`. O prefixo
// `NEXT_PUBLIC_` nao significa "pode ser lido se alguem procurar": ele MANDA o
// Next inlinar o valor dentro do JavaScript que vai para o comprador. E como a
// conferencia era HMAC — simetrica —, a mesma chave que VALIDA um codigo
// tambem EMITE codigos. Qualquer pessoa que abrisse
// `out/_next/static/chunks/app/splash/*.js` gerava licenca ilimitada.
//
// O portao `scripts/verificar-bundle-sem-segredo.mjs` gritava isso ha versoes,
// em maiusculas, e nunca rodava: nao estava em cadeia nenhuma. Agora esta, em
// `npm run qa:loja`.
//
// O jogo passou a ativar pelo esquema Ed25519 (`lib/licenca-certificado`): a
// chave privada fica no servidor e o jogo guarda um certificado assinado, que
// nao serve para emitir nada. O build nao precisa mais de segredo algum.
//
// O script continua no `prebuild` de proposito: ele agora REMOVE a linha do
// segredo de um `.env.local` deixado por builds anteriores. Sem isso, a maquina
// de quem ja buildou antes continuaria injetando o segredo para sempre — e o
// vazamento voltaria em silencio, sem ninguem ter mexido em nada.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const envLocal = path.resolve(".env.local")
const CHAVE = "NEXT_PUBLIC_ULTRAFOOT_LICENSE_SECRET"

if (!existsSync(envLocal)) {
  console.log("sem .env.local — nada a limpar")
  process.exit(0)
}

const anterior = readFileSync(envLocal, "utf8")
const linhas = anterior.split("\n")
const semAChave = linhas.filter(l => !l.startsWith(`${CHAVE}=`))

if (semAChave.length === linhas.length) {
  console.log("`.env.local` ja esta sem o segredo de licenca")
  process.exit(0)
}

writeFileSync(envLocal, semAChave.filter(Boolean).join("\n") + "\n", "utf8")
console.log("segredo de licenca REMOVIDO do .env.local (ele nao pode ir para o pacote)")
