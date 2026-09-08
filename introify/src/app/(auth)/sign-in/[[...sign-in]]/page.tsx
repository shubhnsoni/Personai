import { SignIn } from "@clerk/nextjs"
import type { Metadata } from "next"
import { clerkAuthAppearance } from "@/lib/clerk-auth-appearance"
import { AuthLoading } from "@/components/auth/auth-loading"

export const metadata: Metadata = {
    title: "Sign in | Introify",
    description: "Sign in to manage your Introify profile, offerings and bookings.",
    robots: { index: false, follow: true },
}

export default function SignInPage() {
    return (
        <SignIn
            appearance={clerkAuthAppearance}
            fallback={<AuthLoading />}
            routing="path"
            path="/sign-in"
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
            signUpUrl="/sign-up"
        />
    )
}
