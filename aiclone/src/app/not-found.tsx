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
          <h2 className="text-2xl font-bold mb-2">Page not found</h2>
          <p className="text-zinc-400">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link href="/">
          <Button className="bg-purple-600 hover:bg-purple-500">
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  )
}
