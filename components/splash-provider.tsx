"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { SplashScreen } from "@/components/splash-screen"

interface SplashContextType {
  hasSeenSplash: boolean
  showSplash: boolean
}

const SplashContext = createContext<SplashContextType>({
  hasSeenSplash: false,
  showSplash: true,
})

export function useSplash() {
  return useContext(SplashContext)
}

export function SplashProvider({ children }: { children: ReactNode }) {
  const [showSplash, setShowSplash] = useState(true)
  const [hasSeenSplash, setHasSeenSplash] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if user has already seen splash in this session
    const seen = sessionStorage.getItem("ultrafoot_splash_seen")
    if (seen === "true") {
      setShowSplash(false)
      setHasSeenSplash(true)
    }
  }, [])

  const handleSplashComplete = () => {
    setShowSplash(false)
    setHasSeenSplash(true)
    sessionStorage.setItem("ultrafoot_splash_seen", "true")
  }

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <SplashContext.Provider value={{ hasSeenSplash, showSplash }}>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <div className={showSplash ? "opacity-0" : "opacity-100 transition-opacity duration-500"}>
        {children}
      </div>
    </SplashContext.Provider>
  )
}
