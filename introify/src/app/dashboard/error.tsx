"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export const dynamic = 'force-dynamic'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex items-center justify-center h-[60vh] p-4">
      <div className="text-center max-w-md space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{error.message || "An error occurred loading this page."}</p>
        <Button onClick={reset} className="bg-purple-600 hover:bg-purple-500">Try Again</Button>
      </div>
    </div>
  )
}
