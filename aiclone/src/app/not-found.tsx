import Link from "next/link"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="text-8xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          404
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">This PersonaLink is missing</h2>
          <p className="text-zinc-400">
            That page doesn&apos;t exist or the profile is no longer public.
          </p>
        </div>
        <Button asChild className="bg-purple-600 hover:bg-purple-500">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  )
}
