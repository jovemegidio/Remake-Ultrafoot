"use client"

/**
 * A PONTE entre o registro de clubes próprios e as listas de `lib/teams-data`.
 *
 * ⚠️ Existe como módulo separado por causa de um ciclo de importação. Se
 * `lib/clubes-personalizados.ts` chamasse `setClubesPersonalizados` direto, ele
 * importaria `teams-data`, que puxa o pool de 8,9 MB — e o módulo de clubes
 * próprios é lido pela tela de nova carreira ANTES de qualquer decisão de
 * elenco. O peso de abertura foi o que motivou separar `time-da-carreira` de
 * `save-system`; repetir o erro aqui devolveria os MB ao arranque.
 *
 * Aqui é o único ponto onde os dois lados se encontram, e quem o chama é o
 * componente de ponte montado no layout.
 */

import { listarClubesPersonalizados, comImagensResolvidas, prestigioDeClubeNovo, type ClubePersonalizado } from "@/lib/clubes-personalizados"
import { setClubesPersonalizados, type Team } from "@/lib/teams-data"

/**
 * Clube criado -> `Team`, a forma que o resto do jogo entende.
 *
 * `torcida` e `saldo` saem do prestígio pela mesma lógica das outras entradas do
 * catálogo: são consequências do tamanho do clube, não escolhas do jogador.
 * Deixá-los editáveis transformaria a tela de criação num editor de dificuldade
 * — quem quiser um clube rico já tem o editor de equipes para isso.
 */
export function clubeProprioComoTime(clube: ClubePersonalizado): Team {
  const resolvido = comImagensResolvidas(clube)
  const prestigio = prestigioDeClubeNovo(clube.divisao)
  return {
    nome: resolvido.nome,
    curto: resolvido.curto,
    cidade: resolvido.cidade,
    estado: resolvido.estado,
    cor1: resolvido.cor1,
    cor2: resolvido.cor2,
    prestigio,
    torcida: Math.round(prestigio * 1200),
    estadio_cap: resolvido.estadioCap,
    saldo: Math.max(250_000, Math.round((prestigio - 5) ** 2 * 50_000)),
    file_key: resolvido.fileKey,
    estadio_nome: resolvido.estadioNome,
    patrocinador: "",
    escudo_url: resolvido.logoUrl ?? "",
    divisao: resolvido.divisao as Team["divisao"],
  }
}

/** Relê o registro e publica os clubes em `teams-data`. Idempotente. */
export function sincronizarClubesProprios(): number {
  const clubes = listarClubesPersonalizados()
  setClubesPersonalizados(clubes.map(clubeProprioComoTime))
  return clubes.length
}
