import { NextResponse } from "next/server"
import { syncUser } from "@/lib/auth-sync"

export async function requireWorkspaceProfile() {
    const user = await syncUser()
    if (!user) return { error: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) }
    if (!user.activeProfile) return { error: NextResponse.json({ error: "Finish onboarding first." }, { status: 403 }) }
    return { user, profileId: user.activeProfile.id, profile: user.activeProfile }
}
