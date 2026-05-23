"use client"

import { useEffect } from "react"

export function NativeAppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => e.preventDefault()

    const disableBrowserShortcuts = (e: KeyboardEvent) => {
      const blocked =
        e.key === "F5" ||
        e.key === "F12" ||
        (e.ctrlKey && e.key === "r") ||
        (e.ctrlKey && e.key === "R") ||
        (e.ctrlKey && e.key === "u") ||
        (e.ctrlKey && e.key === "U") ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "i") ||
        (e.ctrlKey && e.shiftKey && e.key === "J") ||
        (e.ctrlKey && e.shiftKey && e.key === "j")

      if (blocked) e.preventDefault()
    }

    document.addEventListener("contextmenu", disableContextMenu)
    document.addEventListener("keydown", disableBrowserShortcuts)

    return () => {
      document.removeEventListener("contextmenu", disableContextMenu)
      document.removeEventListener("keydown", disableBrowserShortcuts)
    }
  }, [])

  return <>{children}</>
}