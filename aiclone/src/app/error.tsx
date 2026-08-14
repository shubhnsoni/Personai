"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
          <p className="text-zinc-400">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} className="bg-purple-600 hover:bg-purple-500">
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.location.href = "/"} className="border-zinc-700">
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}
