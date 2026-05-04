"use client"

import dynamic from "next/dynamic"

const MatchCenterClient = dynamic(() => import("./client"), { ssr: false })

export default function MatchCenterPage() {
  return <MatchCenterClient />
}
