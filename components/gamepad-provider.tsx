"use client"

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react"
import { useGamepadNavigation, type GamepadState, type GamepadButtonName } from "@/hooks/use-gamepad"
import { useRouter, usePathname } from "next/navigation"
import { ControllerTypeContext } from "@/components/controller-buttons"

interface GamepadContextType {
  gamepad: GamepadState
  registerFocusableElement: (id: string, element: HTMLElement, onSelect?: () => void) => void
  unregisterFocusableElement: (id: string) => void
  setFocusedElement: (id: string | null) => void
  focusedElementId: string | null
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
      let directionPenalty = 0

      // Add penalty for elements not aligned with the main direction
      if (direction === "up" || direction === "down") {
        directionPenalty = Math.abs(dx) * 2
      } else {
        directionPenalty = Math.abs(dy) * 2
      }

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

    const nextElement = findNearestElement(direction, currentElement)
    
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

  const handleAction = useCallback((action: "X" | "Y" | "LB" | "RB" | "LT" | "RT" | "START" | "SELECT") => {
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

  const detectedControllerType = gamepad.connected ? gamepad.controllerType : "xbox"

  return (
    <ControllerTypeContext.Provider value={detectedControllerType === "generic" ? "xbox" : detectedControllerType}>
      <GamepadContext.Provider value={{
        gamepad,
        registerFocusableElement,
        unregisterFocusableElement,
        setFocusedElement: setFocusedElementId,
        focusedElementId,
      }}>
        {children}
      
      {/* Connection Toast */}
      {showConnectionToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1db954] text-black shadow-lg">
            <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
              {gamepad.controllerType === "playstation" ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M9.5 4.5c-1.5 0-2.5 1-2.5 2.5v10c0 1.5 1 2.5 2.5 2.5h5c1.5 0 2.5-1 2.5-2.5V7c0-1.5-1-2.5-2.5-2.5h-5zm2.5 3a1 1 0 100 2 1 1 0 000-2zm-2 3a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2zm-2 3a1 1 0 100 2 1 1 0 000-2z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M6 9h2v6H6zm10 0h2v6h-2zM4 7c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2H4zm0 2h16v6H4V9z"/>
                </svg>
              )}
            </div>
            <div>
              <div className="font-bold text-sm">Controle Conectado</div>
              <div className="text-xs opacity-80">
                {gamepad.controllerType === "playstation" ? "PlayStation" : "Xbox"} Controller
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Focus indicator styles */}
      <style jsx global>{`
        [data-gamepad-focused="true"] {
          outline: 2px solid #1db954 !important;
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
  
  useEffect(() => {
    if (!context || !ref.current) return
    
    context.registerFocusableElement(id, ref.current, onSelect)
    
    return () => {
      context.unregisterFocusableElement(id)
    }
  }, [context, id, ref, onSelect])

  const isFocused = context?.focusedElementId === id

  return {
    isFocused,
    "data-gamepad-focused": isFocused ? "true" : "false",
    tabIndex: 0,
  }
}
