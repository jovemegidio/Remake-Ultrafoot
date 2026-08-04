"use client"

// ESCUDO EM 3D DA TELA DE ESCOLHA DE CLUBE.
//
// O escudo vira uma placa no espaco: inclina seguindo o ponteiro, flutua devagar
// e ganha um brilho que varre a superficie conforme a inclinacao. Atras dele,
// particulas nas cores do clube com profundidade — sao elas que dao a sensacao
// de volume quando o jogador troca de time.
//
// ⚠️ TRES COISAS QUE ESTA TELA EXIGE E QUE UM EXEMPLO DE three NAO TEM:
//
//  1. ELA E ABERTA E FECHADA O TEMPO TODO, e o jogador troca de clube dezenas de
//     vezes. Sem descartar renderer, geometria, material E textura no unmount, a
//     memoria de video sobe a cada troca ate a janela engasgar. O `dispose` aqui
//     nao e capricho.
//  2. O JOGO TEM "REDUZIR MOVIMENTO" (lib/accessibility-store escreve
//     `data-a11y-reduce-motion` no <html>) e um modo economico para maquina
//     fraca. Nos dois casos desenhamos UM quadro parado em vez de animar — a
//     imagem continua certa, so nao se mexe.
//  3. SEM CONTEXTO WEBGL O JOGO NAO PODE QUEBRAR. Maquina antiga, driver velho
//     ou webview sem aceleracao devolvem `null` no getContext; aqui isso vira
//     `pronto = false` e quem chama mostra a imagem normal.

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

interface Props {
  /** URL do escudo — pode ser `data:`, `game-asset://` ou caminho do build. */
  src: string
  cor1?: string
  cor2?: string
  className?: string
}

/** Deve animar? Junta a preferencia do jogo, a do sistema e o modo economico. */
function podeAnimar(): boolean {
  if (typeof window === "undefined") return false
  const root = document.documentElement
  if (root.hasAttribute("data-a11y-reduce-motion")) return false
  if (root.classList.contains("modo-economico")) return false
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

export function Escudo3D({ src, cor1 = "#22d3ee", cor2 = "#0ea5e9", className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || !src) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" })
    } catch {
      return // sem WebGL: quem chama fica com a imagem normal
    }
    if (!renderer.getContext()) return

    // Teto de 2x no pixel ratio: em tela 4K o custo triplica sem diferenca
    // visivel num escudo de 260px.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(host.clientWidth, host.clientHeight, false)
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    host.appendChild(renderer.domElement)

    const cena = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 100)
    camera.position.z = 5

    const descartaveis: { dispose(): void }[] = []
    const registrar = <T extends { dispose(): void }>(x: T) => { descartaveis.push(x); return x }

    // ── Particulas nas cores do clube ──────────────────────────────────────
    const QTD = 90
    const posicoes = new Float32Array(QTD * 3)
    const cores = new Float32Array(QTD * 3)
    const c1 = new THREE.Color(cor1)
    const c2 = new THREE.Color(cor2)
    for (let i = 0; i < QTD; i++) {
      posicoes[i * 3] = (Math.random() - 0.5) * 9
      posicoes[i * 3 + 1] = (Math.random() - 0.5) * 6
      posicoes[i * 3 + 2] = -1 - Math.random() * 6
      const c = Math.random() > 0.5 ? c1 : c2
      cores[i * 3] = c.r; cores[i * 3 + 1] = c.g; cores[i * 3 + 2] = c.b
    }
    const geoParticulas = registrar(new THREE.BufferGeometry())
    geoParticulas.setAttribute("position", new THREE.BufferAttribute(posicoes, 3))
    geoParticulas.setAttribute("color", new THREE.BufferAttribute(cores, 3))
    const matParticulas = registrar(new THREE.PointsMaterial({
      size: 0.075, vertexColors: true, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }))
    cena.add(new THREE.Points(geoParticulas, matParticulas))

    // ── A placa do escudo ─────────────────────────────────────────────────
    const grupo = new THREE.Group()
    cena.add(grupo)

    let vivo = true
    let raf = 0
    const alvo = { x: 0, y: 0 }   // inclinacao desejada (ponteiro)
    const atual = { x: 0, y: 0 }  // inclinacao suavizada

    // ⚠️ SEM `setCrossOrigin`. O escudo chega como `data:` (copia do canal) ou
    // `game-asset://` (protocolo proprio do Tauri); pedir CORS num protocolo que
    // nao o implementa faz a textura falhar — e a falha aqui e silenciosa, o
    // escudo simplesmente nao ganharia volume e ninguem saberia por que.
    const carregador = new THREE.TextureLoader()
    carregador.load(
      src,
      (textura) => {
        if (!vivo) { textura.dispose(); return }
        textura.colorSpace = THREE.SRGBColorSpace
        // O escudo nao e quadrado: a placa recebe a proporcao da imagem, senao
        // ele estica — que e exatamente o defeito que o `contain` do CSS evita.
        const prop = (textura.image?.width ?? 1) / (textura.image?.height ?? 1)
        const altura = 3.1
        const geo = registrar(new THREE.PlaneGeometry(altura * prop, altura))
        const mat = registrar(new THREE.MeshBasicMaterial({
          map: registrar(textura), transparent: true, side: THREE.DoubleSide,
        }))
        grupo.add(new THREE.Mesh(geo, mat))

        // Brilho que varre a placa. Fica NA FRENTE do escudo com blending
        // aditivo: e o reflexo, nao uma sombra.
        const geoBrilho = registrar(new THREE.PlaneGeometry(altura * prop * 0.42, altura * 1.35))
        const matBrilho = registrar(new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.07,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }))
        const brilho = new THREE.Mesh(geoBrilho, matBrilho)
        brilho.position.z = 0.02
        brilho.rotation.z = 0.35
        grupo.add(brilho)
        grupo.userData.brilho = brilho

        setPronto(true)
        desenhar()
      },
      undefined,
      () => { /* textura falhou: fica so a imagem normal de quem chama */ },
    )

    function desenhar() {
      const brilho = grupo.userData.brilho as THREE.Mesh | undefined
      const t = performance.now() / 1000
      atual.x += (alvo.x - atual.x) * 0.08
      atual.y += (alvo.y - atual.y) * 0.08
      grupo.rotation.y = atual.x * 0.5 + Math.sin(t * 0.5) * 0.04
      grupo.rotation.x = -atual.y * 0.4 + Math.cos(t * 0.42) * 0.03
      grupo.position.y = Math.sin(t * 0.7) * 0.06
      if (brilho) brilho.position.x = Math.sin(t * 0.6) * 1.1
      matParticulas.opacity = 0.42 + Math.sin(t * 0.9) * 0.12
      renderer.render(cena, camera)
    }

    const animar = () => {
      if (!vivo) return
      desenhar()
      raf = requestAnimationFrame(animar)
    }

    const aoMover = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      alvo.x = ((e.clientX - r.left) / r.width - 0.5) * 2
      alvo.y = ((e.clientY - r.top) / r.height - 0.5) * 2
    }
    const aoSair = () => { alvo.x = 0; alvo.y = 0 }

    let limpezaEventos: (() => void) | undefined
    const animando = podeAnimar()
    if (animando) {
      // O ponteiro e ouvido no PAI (o cartao inteiro), nao no canvas: seguir so
      // dentro do proprio escudo faz o efeito morrer justamente quando o mouse
      // se aproxima, que e quando ele deveria reagir.
      const area = host.parentElement ?? host
      area.addEventListener("pointermove", aoMover)
      area.addEventListener("pointerleave", aoSair)
      raf = requestAnimationFrame(animar)

      // Aba escondida nao desenha. Sem isto o jogo minimizado continua gastando
      // GPU nesta tela.
      const aoTrocarVisibilidade = () => {
        if (document.hidden) { cancelAnimationFrame(raf); raf = 0 }
        else if (!raf && vivo) raf = requestAnimationFrame(animar)
      }
      document.addEventListener("visibilitychange", aoTrocarVisibilidade)

      limpezaEventos = () => {
        area.removeEventListener("pointermove", aoMover)
        area.removeEventListener("pointerleave", aoSair)
        document.removeEventListener("visibilitychange", aoTrocarVisibilidade)
      }
    }

    const aoRedimensionar = () => {
      if (!host.clientWidth || !host.clientHeight) return
      camera.aspect = host.clientWidth / host.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(host.clientWidth, host.clientHeight, false)
      if (!animando) desenhar()
    }
    const observador = new ResizeObserver(aoRedimensionar)
    observador.observe(host)

    return () => {
      vivo = false
      cancelAnimationFrame(raf)
      observador.disconnect()
      limpezaEventos?.()
      for (const d of descartaveis) d.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [src, cor1, cor2])

  return (
    <div
      ref={hostRef}
      className={className}
      aria-hidden
      // Enquanto a textura nao carrega (ou se WebGL falhar) o canvas fica
      // invisivel e o escudo comum de quem chama continua na tela.
      style={{ opacity: pronto ? 1 : 0, transition: "opacity 400ms ease" }}
    />
  )
}
