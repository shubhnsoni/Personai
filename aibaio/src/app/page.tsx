import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
      <main className="flex flex-col items-center gap-8 text-center max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          PersonaLink
        </h1>
        <p className="text-lg text-muted-foreground">
          Your AI-powered professional profile. Clone yourself, automate your work, and scale your presence.
        </p>
        <div className="flex gap-4">
          <Link href="/dashboard">
            <Button size="lg">
              Go to Dashboard
            </Button>
          </Link>
          <Link href="/onboarding">
            <Button variant="outline" size="lg">
              Start Onboarding
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-8">
          Running in Development Mode (Mock Auth)
        </p>
      </main>
    </div>
  );
}
