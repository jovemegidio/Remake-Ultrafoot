"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { hasSave } from "@/lib/save-system"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(hasSave() ? "/dashboard" : "/novo-jogo")
  }, [router])

  return <div className="min-h-screen bg-[#0a0a0a]" />
}
