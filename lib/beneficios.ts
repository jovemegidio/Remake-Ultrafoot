"use client"

// BENEFICIOS DE QUEM REGISTROU O JOGO.
//
// Ate aqui registrar nao mudava NADA: o codigo validado so trocava o rotulo do
// menu ("versao nao registrada" sumia). Quem comprou nao ganhava nada por isso.
//
// A regra que o usuario definiu (30/07/2026): **so beneficio, nunca trava**.
// Quem nao registrou joga a carreira inteira, todas as competicoes, todos os
// modos — nao existe tela de "compre para continuar" no meio de uma temporada.
// O registro LIBERA extras. Isso mantem a decisao antiga de que um falso
// negativo com comprador legitimo dói mais do que a pirataria que se evita.
//
// Quem for adicionar um beneficio novo: some um item em BENEFICIOS e use
// `<RecursoDeRegistrado>` (components/registro-necessario.tsx) na tela. NAO
// espalhe `lerRegistro()` pelas telas — o ponto unico e este arquivo.

import { useEffect, useState } from "react"
import { lerRegistro } from "@/lib/registration"

/** Quantas carreiras salvas cabem sem registro. Registrado = sem limite. */
export const LIMITE_SAVES_SEM_REGISTRO = 3

/**
 * PAISES DE CLUBE liberados sem registro.
 *
 * 30/07/2026: Brasil, Franca e Espanha.
 * 01/08/2026: **so o Brasil** — o futebol brasileiro inteiro (Serie A ate a D) e
 * a amostra de quem ainda nao registrou; o resto do mundo entra com o codigo.
 *
 * Continua valendo a regra da casa: nao e trava no meio do caminho. A carreira
 * escolhida vai ate o fim, e quem ja tinha uma carreira em clube estrangeiro
 * segue jogando — a lista so filtra a ESCOLHA de clube novo.
 */
export const PAISES_SEM_REGISTRO: readonly string[] = ["BRA"]

/**
 * As DIVISOES desses paises. Existe porque nem toda tela conhece o pais do
 * clube — as propostas de emprego, por exemplo, so tem a divisao na mao. Mantido
 * aqui, ao lado da lista de paises, para as duas regras nao se separarem.
 */
export const DIVISOES_SEM_REGISTRO: readonly string[] = [
  // A Divisao de Acesso e futebol brasileiro, entao entra na amostra livre pela
  // mesma regra das quatro Series — "o futebol brasileiro inteiro" continua
  // valendo depois que a piramide ganhou um quinto degrau.
  "serie_a", "serie_b", "serie_c", "serie_d", "divisao_acesso_br",
]

export type BeneficioId = "nuvem" | "hub" | "editor" | "atualizacoes" | "saves" | "ligas" | "clube-proprio"

export interface Beneficio {
  id: BeneficioId
  titulo: string
  descricao: string
}

/** A lista que a tela de registro e as telas bloqueadas mostram. */
export const BENEFICIOS: Beneficio[] = [
  {
    id: "ligas",
    titulo: "O mundo inteiro",
    descricao: "Sem registro você dirige o futebol brasileiro (Série A à D). O código abre as ligas dos outros países.",
  },
  {
    id: "clube-proprio",
    titulo: "Seu próprio clube",
    descricao: "Crie um clube do zero — nome, cores, escudo, os três uniformes e o estádio — e dirija a carreira com ele.",
  },
  {
    id: "nuvem",
    titulo: "Save na nuvem",
    descricao: "Sua carreira guardada fora do PC e recuperável em outra máquina pelo código.",
  },
  {
    id: "hub",
    titulo: "FC Hub",
    descricao: "Presença, chat e partidas com outros técnicos conectados.",
  },
  {
    id: "editor",
    titulo: "Editor de equipes",
    descricao: "Renomear clubes, importar escudo e uniforme, mexer em elenco e juniores.",
  },
  {
    id: "atualizacoes",
    titulo: "Central de Atualizações",
    descricao: "Elencos, times e correções novas baixados direto no jogo, sem esperar versão.",
  },
  {
    id: "saves",
    titulo: "Carreiras ilimitadas",
    descricao: `Sem registro o jogo guarda ${LIMITE_SAVES_SEM_REGISTRO} carreiras ao mesmo tempo.`,
  },
]

export function beneficio(id: BeneficioId): Beneficio {
  return BENEFICIOS.find(b => b.id === id) ?? BENEFICIOS[0]
}

/** Leitura direta (fora de componente). Em SSR devolve false. */
export function jogoRegistrado(): boolean {
  if (typeof window === "undefined") return false
  return lerRegistro().registrado
}

/**
 * O registro vive no persistent-store, que carrega o arquivo do disco de forma
 * ASSÍNCRONA — no primeiro render ele ainda não chegou. Sem esperar o evento
 * `ultrafoot:store:ready`, toda tela bloqueada piscaria "não registrado" na cara
 * de quem registrou (foi o mesmo tropeço que a splash já tinha resolvido).
 * Por isso o hook devolve `hidratado`: enquanto for false, não acuse ninguém.
 */
export function useJogoRegistrado(): { registrado: boolean; hidratado: boolean } {
  const [estado, setEstado] = useState({ registrado: false, hidratado: false })

  useEffect(() => {
    const aplicar = () => setEstado({ registrado: lerRegistro().registrado, hidratado: true })
    aplicar()
    window.addEventListener("ultrafoot:store:ready", aplicar)
    return () => window.removeEventListener("ultrafoot:store:ready", aplicar)
  }, [])

  return estado
}

/** Ainda cabe uma carreira nova? (registrado não tem teto) */
export function podeCriarCarreira(quantasJaExistem: number, registrado: boolean): boolean {
  return registrado || quantasJaExistem < LIMITE_SAVES_SEM_REGISTRO
}

/** Rota que abre a tela de registro direto no campo do código. */
export const ROTA_DE_REGISTRO = "/splash?registrar=1"
