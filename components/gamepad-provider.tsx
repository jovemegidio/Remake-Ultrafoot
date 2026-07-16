"use client"

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useGamepadNavigation, type GamepadState, type GamepadButtonName } from "@/hooks/use-gamepad"
import { useRouter, usePathname } from "next/navigation"
import { ControllerTypeContext } from "@/components/controller-buttons"
import { useGameState } from "@/lib/save-system"

interface GamepadContextType {
  gamepad: GamepadState
  registerFocusableElement: (id: string, element: HTMLElement, onSelect?: () => void) => void
  unregisterFocusableElement: (id: string) => void
  setFocusedElement: (id: string | null) => void
  focusedElementId: string | null
  isGamepadConnected: boolean
  controllerType: "xbox" | "playstation" | "generic"
}

const GamepadContext = createContext<GamepadContextType | null>(null)

export function useGamepadContext() {
  const context = useContext(GamepadContext)
  if (!context) {
    throw new Error("useGamepadContext must be used within a GamepadProvider")
  }
  return context
}

interface FocusableElement {
  id: string
  element: HTMLElement
  onSelect?: () => void
}

export function GamepadProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  
  const [focusableElements, setFocusableElements] = useState<Map<string, FocusableElement>>(new Map())
  const [focusedElementId, setFocusedElementId] = useState<string | null>(null)
  const [showConnectionToast, setShowConnectionToast] = useState(false)

  const findNearestElement = useCallback((
    direction: "up" | "down" | "left" | "right",
    currentElement: HTMLElement | null
  ): FocusableElement | null => {
    const elements = Array.from(focusableElements.values())
    if (elements.length === 0) return null

    if (!currentElement) {
      return elements[0] || null
    }

    const currentRect = currentElement.getBoundingClientRect()
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2,
    }

    let bestCandidate: FocusableElement | null = null
    let bestScore = Infinity

    for (const el of elements) {
      if (el.element === currentElement) continue

      const rect = el.element.getBoundingClientRect()
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }

      const dx = center.x - currentCenter.x
      const dy = center.y - currentCenter.y

      // Check if element is in the right direction
      let isInDirection = false
      switch (direction) {
        case "up":
          isInDirection = dy < -20
          break
        case "down":
          isInDirection = dy > 20
          break
        case "left":
          isInDirection = dx < -20
          break
        case "right":
          isInDirection = dx > 20
          break
      }

      if (!isInDirection) continue

      // Calculate score (distance with direction preference)
      const distance = Math.sqrt(dx * dx + dy * dy)
      const directionPenalty =
        direction === "up" || direction === "down"
          ? Math.abs(dx) * 2
          : Math.abs(dy) * 2

      const score = distance + directionPenalty

      if (score < bestScore) {
        bestScore = score
        bestCandidate = el
      }
    }

    return bestCandidate
  }, [focusableElements])

  const handleNavigate = useCallback((direction: "up" | "down" | "left" | "right") => {
    const currentElement = focusedElementId 
      ? focusableElements.get(focusedElementId)?.element 
      : null

    const nextElement = findNearestElement(direction, currentElement ?? null)
    
    if (nextElement) {
      setFocusedElementId(nextElement.id)
      nextElement.element.focus()
      nextElement.element.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [focusedElementId, focusableElements, findNearestElement])

  const handleSelect = useCallback(() => {
    if (focusedElementId) {
      const element = focusableElements.get(focusedElementId)
      if (element) {
        // Trigger click or custom action
        if (element.onSelect) {
          element.onSelect()
        } else {
          element.element.click()
        }
      }
    }
  }, [focusedElementId, focusableElements])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleAction = useCallback((action: "X" | "Y" | "LB" | "RB" | "LT" | "RT" | "START" | "SELECT" | "HOME") => {
    // Dispatch custom event for components to listen to
    const event = new CustomEvent("gamepad:action", { detail: { action } })
    window.dispatchEvent(event)
  }, [])

  const gamepad = useGamepadNavigation({
    onNavigate: handleNavigate,
    onSelect: handleSelect,
    onBack: handleBack,
    onAction: handleAction,
    repeatDelay: 200,
  })

  // Converte movimento do analogico esquerdo em eventos gamepad:button
  // (D-pad ja dispara por si so via useGamepad; este bloco cobre apenas o analogico)
  const stickRef = useRef(gamepad.leftStick)
  stickRef.current = gamepad.leftStick

  useEffect(() => {
    if (!gamepad.connected) return

    const THRESHOLD = 0.5
    const REPEAT_MS = 200
    let lastDir = ""
    let lastTime = 0

    const id = setInterval(() => {
      const now = Date.now()
      const { x, y } = stickRef.current

      let dir = ""
      if (Math.abs(y) > Math.abs(x)) {
        if (y < -THRESHOLD) dir = "DPAD_UP"
        else if (y > THRESHOLD) dir = "DPAD_DOWN"
      } else {
        if (x < -THRESHOLD) dir = "DPAD_LEFT"
        else if (x > THRESHOLD) dir = "DPAD_RIGHT"
      }

      if (dir && (dir !== lastDir || now - lastTime > REPEAT_MS)) {
        window.dispatchEvent(new CustomEvent("gamepad:button", { detail: { button: dir } }))
        lastTime = now
        lastDir = dir
      } else if (!dir) {
        lastDir = ""
      }
    }, 50)

    return () => clearInterval(id)
  }, [gamepad.connected])

  // Show connection toast
  useEffect(() => {
    if (gamepad.connected) {
      setShowConnectionToast(true)
      const timer = setTimeout(() => setShowConnectionToast(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [gamepad.connected])

  const registerFocusableElement = useCallback((id: string, element: HTMLElement, onSelect?: () => void) => {
    setFocusableElements(prev => {
      const next = new Map(prev)
      next.set(id, { id, element, onSelect })
      return next
    })
  }, [])

  const unregisterFocusableElement = useCallback((id: string) => {
    setFocusableElements(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Reset focus when pathname changes
  useEffect(() => {
    setFocusedElementId(null)
  }, [pathname])

  // Tipo de controle EFETIVO para os glifos de botao em todo o jogo:
  // - preferencia do usuario (Configuracoes) manda quando e xbox/playstation;
  // - "auto" (padrao) usa o controle detectado; sem controle, cai em xbox.
  const { state: gameState } = useGameState()
  const pref = gameState.controllerType
  const detected = gamepad.connected && gamepad.controllerType !== "generic" ? gamepad.controllerType : "xbox"
  const effectiveControllerType: "xbox" | "playstation" =
    pref === "xbox" || pref === "playstation" ? pref : detected

  return (
    <ControllerTypeContext.Provider value={effectiveControllerType}>
      <GamepadContext.Provider value={{
        gamepad,
        registerFocusableElement,
        unregisterFocusableElement,
        setFocusedElement: setFocusedElementId,
        focusedElementId,
        isGamepadConnected: gamepad.connected,
        controllerType: gamepad.controllerType,
      }}>
        {children}
      
      {/* Connection Toast */}
      {showConnectionToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#00ffc8] text-black shadow-lg">
            <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center">
              {gamepad.controllerType === "playstation" ? (
                /* PlayStation Logo - símbolo icônico */
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.501zm4.659 16.264l6.344-2.003c.725-.246 1.576-.795 1.576-1.753 0-.959-.775-1.261-1.576-1.016l-6.344 2.049v2.723zm-6.329-.423c-2.346-.746-4.315-.326-4.315 1.76 0 2.023 1.756 2.817 4.315 2.283l1.329-.381V19.4l-1.329.424v-1.387z"/>
                </svg>
              ) : (
                /* Xbox Logo - X no círculo */
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.898-2.967c1.058-1.074-.438-3.523-2.649-6.106-1.738 2.313-3.767 4.671-5.249 4.671-1.483 0-3.512-2.358-5.249-4.671-2.211 2.583-3.707 5.032-2.649 6.106zM12 0a11.94 11.94 0 0 0-7.898 2.967c-1.058 1.074.438 3.523 2.649 6.106C8.489 6.76 10.518 4.402 12 4.402c1.482 0 3.511 2.358 5.249 4.671 2.211-2.583 3.707-5.032 2.649-6.106A11.94 11.94 0 0 0 12 0zM2.313 18.986c-.945-.932-1.483-2.223-1.796-3.455-.527-2.074-.527-4.988 0-7.062.313-1.232.851-2.523 1.796-3.455.527 1.551 1.483 3.326 2.778 5.135v3.703c-1.295 1.809-2.251 3.583-2.778 5.134zm19.374 0c.945-.932 1.483-2.223 1.796-3.455.527-2.074.527-4.988 0-7.062-.313-1.232-.851-2.523-1.796-3.455-.527 1.551-1.483 3.326-2.778 5.135v3.703c1.295 1.809 2.251 3.583 2.778 5.134z"/>
                </svg>
              )}
            </div>
            <div>
              <div className="font-bold text-sm">Controle Conectado</div>
              <div className="text-xs opacity-80">
                {gamepad.controllerType === "playstation" ? "PlayStation" : gamepad.controllerType === "xbox" ? "Xbox" : "Controller"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Focus indicator styles */}
      <style jsx global>{`
        [data-gamepad-focused="true"] {
          outline: 2px solid #00ffc8 !important;
          outline-offset: 2px;
          box-shadow: 0 0 0 4px rgba(29, 185, 84, 0.3);
        }
      `}</style>
      </GamepadContext.Provider>
    </ControllerTypeContext.Provider>
  )
}

// Hook for making any element focusable with gamepad
export function useGamepadFocusable(
  id: string,
  ref: React.RefObject<HTMLElement | null>,
  onSelect?: () => void
) {
  const context = useContext(GamepadContext)
  
  // Use refs to store mutable values to avoid triggering re-renders
  const onSelectRef = useRef(onSelect)
  const contextRef = useRef(context)
  const idRef = useRef(id)
  
  // Update refs on every render
  onSelectRef.current = onSelect
  contextRef.current = context
  idRef.current = id
  
  // Stable callback that always calls the latest onSelect
  const stableOnSelect = useCallback(() => {
    onSelectRef.current?.()
  }, [])
  
  // Single registration effect - only runs on mount/unmount
  useEffect(() => {
    const ctx = contextRef.current
    const element = ref.current
    const currentId = idRef.current
    
    if (!ctx || !element) return
    
    ctx.registerFocusableElement(currentId, element, stableOnSelect)
    
    return () => {
      ctx.unregisterFocusableElement(currentId)
    }
  // Empty deps - only run on mount/unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isFocused = context?.focusedElementId === id

  return {
    isFocused,
    "data-gamepad-focused": isFocused ? "true" : "false",
    tabIndex: 0,
  }
}
