"use client"

import { safeLocalSet } from "@/lib/safe-storage"
import { useEffect } from "react"

export type PerformanceProfile = "economy" | "balanced" | "quality"
export const PERFORMANCE_STORAGE_KEY = "ultrafoot:performance-profile"

export function applyPerformanceProfile(profile: PerformanceProfile) {
  document.documentElement.dataset.performance = profile
  safeLocalSet(PERFORMANCE_STORAGE_KEY, profile)
}

export function PerformanceProfileBootstrap() {
  useEffect(() => {
    const stored = localStorage.getItem(PERFORMANCE_STORAGE_KEY)
    const nav = navigator as Navigator & { deviceMemory?: number }
    const lowSpec = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4
    const profile: PerformanceProfile = stored === "economy" || stored === "quality" || stored === "balanced"
      ? stored
      : lowSpec ? "economy" : "balanced"
    applyPerformanceProfile(profile)
  }, [])
  return null
}
