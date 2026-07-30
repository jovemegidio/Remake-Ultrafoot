'use client'

import { useEffect, useState } from 'react'

export type Tema = 'claro' | 'escuro' | 'sistema'

const CHAVE = 'ultrafoot-painel:tema'

/**
 * Tema do painel. Fica em localStorage (nao sessionStorage): preferencia visual
 * nao e segredo e reescolher a cada aba seria irritante.
 *
 * A leitura acontece dentro do efeito porque esta pagina e exportada estatica —
 * ler localStorage na renderizacao faria o HTML servido divergir do que o
 * navegador monta.
 */
export function usarTema(): [Tema, (tema: Tema) => void] {
  const [tema, setTema] = useState<Tema>('sistema')

  useEffect(() => {
    const guardado = window.localStorage.getItem(CHAVE) as Tema | null
    if (guardado === 'claro' || guardado === 'escuro' || guardado === 'sistema') setTema(guardado)
  }, [])

  useEffect(() => {
    const midia = window.matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => {
      const escuro = tema === 'escuro' || (tema === 'sistema' && midia.matches)
      document.documentElement.classList.toggle('dark', escuro)
      document.documentElement.style.colorScheme = escuro ? 'dark' : 'light'
    }
    aplicar()
    midia.addEventListener('change', aplicar)
    return () => midia.removeEventListener('change', aplicar)
  }, [tema])

  return [
    tema,
    (novo: Tema) => {
      window.localStorage.setItem(CHAVE, novo)
      setTema(novo)
    },
  ]
}
