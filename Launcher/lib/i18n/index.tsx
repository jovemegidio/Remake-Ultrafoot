"use client"

/**
 * MOTOR DE IDIOMAS DO LAUNCHER.
 *
 * Três decisões que valem explicação:
 *
 * 1. NADA DE PACOTE GIGANTE. Cada família de idiomas vive num arquivo próprio,
 *    carregado sob demanda (`import()` dinâmico). São mais de 120 idiomas: se
 *    todos entrassem no pacote inicial, o launcher carregaria 120 traduções para
 *    mostrar uma — e a primeira tela ficaria mais lenta para todo mundo.
 *
 * 2. CADEIA DE RESERVA, NUNCA CHAVE CRUA NA TELA. `pt-BR` → idioma pedido →
 *    idioma base ("pt-PT" cai em "pt") → inglês → português. Uma tradução
 *    incompleta mostra a frase em outro idioma; ela nunca mostra
 *    "gerenciar.desinstalar" para o jogador. Isso é o que permite publicar um
 *    idioma pela metade sem medo.
 *
 * 3. O PRIMEIRO RENDER É SEMPRE EM PORTUGUÊS. A UI é exportada estaticamente
 *    (HTML pronto no disco): se o idioma salvo entrasse já no primeiro render, o
 *    HTML e o React discordariam e o React descartaria a árvore inteira
 *    (erro de hidratação). O idioma real entra logo depois, no efeito — é o
 *    mesmo desenho já usado pelas preferências visuais.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { PT_BR, type Chave, type PacoteDeIdioma } from "./catalogo"
import { IDIOMA_PADRAO, acharIdioma, ehRtl, idiomaDoSistema } from "./idiomas"
import { carregarPacote } from "./pacotes"

const CHAVE_SALVA = "ultrafoot-launcher:idioma"

export type Traduzir = (chave: Chave, valores?: Record<string, string | number>) => string

interface Contexto {
  idioma: string
  rtl: boolean
  trocarIdioma: (codigo: string) => void
  t: Traduzir
  /** 0 a 1 — quanto do catálogo este idioma tem traduzido. */
  cobertura: number
}

const TOTAL_DE_CHAVES = Object.keys(PT_BR).length

const ContextoDeIdioma = createContext<Contexto>({
  idioma: IDIOMA_PADRAO,
  rtl: false,
  trocarIdioma: () => {},
  t: (chave) => PT_BR[chave],
  cobertura: 1,
})

function preencher(texto: string, valores?: Record<string, string | number>): string {
  if (!valores) return texto
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) =>
    nome in valores ? String(valores[nome]) : inteiro,
  )
}

export function ProvedorDeIdioma({ children }: { children: React.ReactNode }) {
  const [idioma, setIdioma] = useState(IDIOMA_PADRAO)
  const [pacote, setPacote] = useState<PacoteDeIdioma>({})
  const [reserva, setReserva] = useState<PacoteDeIdioma>({})

  // Idioma escolhido (ou o do sistema, na primeira abertura).
  useEffect(() => {
    let escolhido = IDIOMA_PADRAO
    try {
      const salvo = localStorage.getItem(CHAVE_SALVA)
      escolhido = salvo && acharIdioma(salvo) ? salvo : idiomaDoSistema()
    } catch {
      escolhido = idiomaDoSistema()
    }
    setIdioma(escolhido)
  }, [])

  // Carrega o pacote do idioma + o do idioma base + o inglês (reserva).
  useEffect(() => {
    let vivo = true
    void (async () => {
      const base = idioma.split("-")[0]
      // O INGLÊS É RESERVA PARA QUEM NÃO FALA PORTUGUÊS.
      //
      // Em pt-PT (ou qualquer variante do português) pular o inglês é melhor: a
      // reserva final já é o pt-BR, que um falante de português lê sem esforço.
      // Sem esta exceção, uma chave sem tradução europeia apareceria em INGLÊS
      // no meio de uma tela em português — o pior dos dois mundos.
      const semIngles = base === "pt" || base === "en"
      const [doIdioma, doBase, doIngles] = await Promise.all([
        carregarPacote(idioma),
        base !== idioma ? carregarPacote(base) : Promise.resolve({}),
        semIngles ? Promise.resolve({}) : carregarPacote("en"),
      ])
      if (!vivo) return
      setPacote({ ...doBase, ...doIdioma })
      setReserva(doIngles)
    })()
    return () => {
      vivo = false
    }
  }, [idioma])

  // `lang` e `dir` no documento. O `dir` é o que vira a interface inteira nos
  // idiomas da direita para a esquerda — sem ele, árabe e hebraico ficam com o
  // layout espelhado ao contrário do texto.
  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.lang = idioma
    document.documentElement.dir = ehRtl(idioma) ? "rtl" : "ltr"
  }, [idioma])

  const trocarIdioma = useCallback((codigo: string) => {
    if (!acharIdioma(codigo)) return
    setIdioma(codigo)
    try {
      localStorage.setItem(CHAVE_SALVA, codigo)
    } catch {
      /* modo privado / storage cheio: a troca ainda vale nesta sessão */
    }
  }, [])

  const t = useCallback<Traduzir>(
    (chave, valores) => {
      const texto = pacote[chave] ?? reserva[chave] ?? PT_BR[chave]
      return preencher(texto, valores)
    },
    [pacote, reserva],
  )

  const valor = useMemo<Contexto>(
    () => ({
      idioma,
      rtl: ehRtl(idioma),
      trocarIdioma,
      t,
      // Variantes do português contam como completas: o que não estiver
      // traduzido cai no pt-BR, que já é português — nada aparece em outra
      // língua, e mostrar "12% traduzido" ali seria só assustar quem entende
      // cada palavra da tela.
      cobertura:
        idioma.split("-")[0] === "pt"
          ? 1
          : Object.keys(pacote).length / TOTAL_DE_CHAVES,
    }),
    [idioma, trocarIdioma, t, pacote],
  )

  return <ContextoDeIdioma.Provider value={valor}>{children}</ContextoDeIdioma.Provider>
}

export function useIdioma(): Contexto {
  return useContext(ContextoDeIdioma)
}

/** Atalho para quem só precisa traduzir. */
export function useT(): Traduzir {
  return useContext(ContextoDeIdioma).t
}

export { IDIOMAS, acharIdioma, type Idioma } from "./idiomas"
export type { Chave } from "./catalogo"
