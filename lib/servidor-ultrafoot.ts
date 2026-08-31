// O ENDERECO DO SERVIDOR DO ULTRAFOOT — fonte unica.
//
// ⚠️ ELE ESTAVA COPIADO EM 27 LUGARES (1.0.382). Seis bibliotecas do jogo
// declaravam cada uma o seu `const BASE = "https://ultrafoot.<ip>.sslip.io"`,
// mais o launcher, os testes e os scripts. Trocar o endereco significava caçar
// as copias — e esquecer uma nao quebra a compilacao: quebra uma FUNCAO, em
// producao, na maquina do jogador.
//
// ⚠️ E O `sslip.io` TORNA ISSO PIOR, porque ele codifica o IP no proprio nome:
// `ultrafoot.179-198-103-30.sslip.io`. Se o provedor der outro endereco a VPS,
// o dominio inteiro morre junto — nao ha DNS para apontar para o lugar novo.
// Medido em 31/08/2026, com a VPS fora: ICMP, 22, 80, 443 e 8789 todos mudos.
//
// ⚠️ O LAUNCHER JA RESOLVIA ISSO E O JOGO NAO. `public/endpoints.json` existe
// desde 30/07 com o proposito escrito nele: "se a VPS trocar de IP ou de
// dominio, basta editar este arquivo e commitar: todos os launchers ja
// instalados encontram o servidor novo sozinhos". O Rust do launcher le esse
// ponteiro no `raw.githubusercontent` a cada abertura. O jogo nunca leu.
//
// Este modulo e o primeiro passo: uma copia so. O segundo — o jogo tambem ler
// o ponteiro e sobreviver a troca de IP sem build novo — precisa que os
// consumidores parem de montar URL no carregamento do modulo, e esta anotado
// como divida em `SERVIDOR_DINAMICO_PENDENTE` abaixo.

/**
 * Host do servidor proprio, compilado na build.
 *
 * ⚠️ TROCOU O IP? Mude AQUI e em `public/endpoints.json` — os dois, porque o
 * jogo le esta constante e o launcher le o ponteiro. O portao
 * `qa:endereco-unico` reprova qualquer copia nova espalhada pelo codigo.
 */
export const SERVIDOR_ULTRAFOOT = "https://ultrafoot.179-198-103-30.sslip.io"

/** Autenticacao, contas e licenca. */
export const SERVIDOR_AUTH = `${SERVIDOR_ULTRAFOOT}/auth`
/** Relay do multijogador. */
export const SERVIDOR_RELAY = `${SERVIDOR_ULTRAFOOT}/relay`
/** Instaladores e manifesto de atualizacao. */
export const SERVIDOR_DOWNLOADS = `${SERVIDOR_ULTRAFOOT}/downloads`
/** Canal de atualizacao de elencos, escudos e uniformes. */
export const SERVIDOR_ATUALIZACOES = `${SERVIDOR_ULTRAFOOT}/atualizacoes`

/**
 * ⚠️ DIVIDA CONHECIDA, escrita para nao virar surpresa.
 *
 * O jogo ainda resolve o endereco na COMPILACAO. Se o IP mudar, o launcher
 * encontra o servidor novo sozinho (ele le `endpoints.json` a cada abertura),
 * mas o jogo instalado so encontra depois de uma atualizacao — e a atualizacao
 * vem do proprio servidor que mudou de endereco. O GitHub e a reserva que
 * quebra esse circulo hoje.
 *
 * Fechar isto exige que os consumidores parem de montar URL no carregamento do
 * modulo e passem a pedir o endereco na hora do uso. Nao e refatoracao grande,
 * mas mexe em dezenas de chamadas e nao cabe junto com a troca de endereco.
 */
export const SERVIDOR_DINAMICO_PENDENTE = true
