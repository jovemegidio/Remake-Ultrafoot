// AS COMPETIÇÕES QUE UMA SALA ONLINE PODE DISPUTAR, POR MODALIDADE.
//
// ⚠️ ESTE ARQUIVO FOI RECONSTRUÍDO (1.0.356), e o motivo importa mais que o
// conteúdo. O commit `be0ac1b` ("launcher 1.0.36: amigos, codigo de amigo e
// conversa flutuante no FC Hub") publicou um `components/fc-hub.tsx` que importa
// este módulo — mas o módulo NUNCA foi commitado. Ele existia apenas no disco de
// quem publicou, e por isso o ramo remoto não compilava: `Cannot find module
// '@/lib/competicoes-online'`.
//
// É a terceira vez que este projeto tropeça no mesmo buraco (ver a memória "o
// remoto não compilava": quatro módulos e mais de cinquenta arquivos que
// existiam só em disco). O sintoma é sempre o mesmo — trabalho novo que passa no
// computador de quem escreveu e reprova em qualquer outro.
//
// A ASSINATURA aqui não foi inventada: ela é exatamente o que `fc-hub.tsx`
// consome — um tipo de modalidade e uma função que devolve `{ id, nome }`. Os
// DADOS saem das fontes reais do jogo, e não de uma lista escrita à mão.
//
// ⚠️ Se a versão original aparecer num push futuro, o conflito será NESTE
// arquivo, visível e resolvível — que é muito melhor do que um ramo que não
// compila e ninguém sabe por quê.

import { LIGAS_FEMININAS } from "@/lib/futebol-feminino"
import { YOUTH_COMPETITION_FORMATS_2026 } from "@/lib/youth-career-engine"

/** As quatro modalidades que uma sala online pode escolher. */
export type ModalidadeOnline = "profissional" | "feminino" | "sub20" | "selecao"

export interface CompeticaoOnline {
  id: string
  nome: string
}

/** As ligas de clube profissional que fazem sentido numa sala rápida. */
const PROFISSIONAL: CompeticaoOnline[] = [
  { id: "brasileirao_a", nome: "Brasileirão Série A" },
  { id: "brasileirao_b", nome: "Brasileirão Série B" },
  { id: "premier_league", nome: "Premier League" },
  { id: "la_liga", nome: "La Liga" },
  { id: "serie_a_ita", nome: "Serie A" },
  { id: "bundesliga", nome: "Bundesliga" },
  { id: "ligue_1", nome: "Ligue 1" },
  { id: "liga_portugal", nome: "Liga Portugal" },
]

/** Seleções: o recorte é por torneio, não por liga. */
const SELECAO: CompeticaoOnline[] = [
  { id: "copa_do_mundo", nome: "Copa do Mundo" },
  { id: "copa_america", nome: "Copa América" },
  { id: "eurocopa", nome: "Eurocopa" },
  { id: "amistoso_selecoes", nome: "Amistoso entre seleções" },
]

/**
 * As competições disponíveis para a modalidade escolhida.
 *
 * ⚠️ NUNCA DEVOLVE LISTA VAZIA. `fc-hub` usa o primeiro item como seleção
 * padrão (`competicoesDaModalidadeOnline(m)[0]`); uma lista vazia deixaria a
 * sala sem competição e o botão de criar sem efeito — o tipo de beco que não dá
 * erro nenhum e simplesmente não funciona.
 */
export function competicoesDaModalidadeOnline(modalidade: ModalidadeOnline): CompeticaoOnline[] {
  if (modalidade === "selecao") return SELECAO

  if (modalidade === "feminino") {
    // Sai das ligas femininas REAIS do jogo, e não de uma lista paralela: duas
    // listas para a mesma coisa é como um campeonato acaba oferecido no online
    // e inexistente no jogo.
    const doJogo = LIGAS_FEMININAS.map(liga => ({ id: liga.id, nome: liga.nome }))
    return doJogo.length > 0 ? doJogo : PROFISSIONAL
  }

  if (modalidade === "sub20") {
    // ⚠️ O formato da base NÃO tem `id` — a identidade dele é o `name`. Eu
    // presumi um campo que não existe e o type-check cobrou na hora.
    const daBase = YOUTH_COMPETITION_FORMATS_2026.map(formato => ({
      id: formato.name,
      nome: formato.name,
    }))
    return daBase.length > 0 ? daBase : PROFISSIONAL
  }

  return PROFISSIONAL
}
