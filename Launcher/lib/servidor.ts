// O ENDERECO DO SERVIDOR DO LAUNCHER MORA AQUI, E SO AQUI.
//
// ⚠️ POR QUE ESTE ARQUIVO EXISTE. Em 07/09/2026 o launcher tinha o endereco
// copiado em quatro pontos, e a migracao de servidor de 05/09 so corrigiu UM
// deles (`lib/auth.ts`). O resultado: entrar na conta funcionava, mas a LOJA
// continuava falando com a maquina antiga, que saiu do ar — comprar dava erro
// e nada no codigo dizia por que.
//
// O jogo ja tinha aprendido essa licao: `lib/servidor-ultrafoot.ts` e o gate
// `qa-endereco-unico` existem exatamente por isso. O gate ignora `Launcher/`
// de proposito (projeto separado), e foi essa fresta que deixou as copias
// passarem. Aqui o launcher ganha a mesma fonte unica.
//
// Trocar o servidor de novo = mexer NESTA linha, mais o `public/endpoints.json`
// que os launchers ja instalados leem a cada abertura.
export const SERVIDOR = "https://ultrafoot.zyntraerp.com.br"

/** API de contas, loja e licenca. */
export const SERVIDOR_AUTH = `${SERVIDOR}/auth`

/** Painel web (recibo de compra, administracao). */
export const PAINEL = `${SERVIDOR}/painel`
