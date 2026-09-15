import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"
import { WorkspaceShell } from "./components/workspace-shell"
import "./globals.css"

export const dynamic = "force-dynamic"

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await syncUser()
  if (!user) redirect("/sign-in")
  if (!user.activeProfile) redirect("/onboarding")

  return (
    <WorkspaceShell
      name={user.activeProfile.displayName}
      slug={user.activeProfile.slug}
    >
      {children}
    </WorkspaceShell>
  )
}
