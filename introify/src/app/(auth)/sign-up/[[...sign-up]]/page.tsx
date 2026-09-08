import { SignUp } from "@clerk/nextjs"
import type { Metadata } from "next"
import { clerkAuthAppearance } from "@/lib/clerk-auth-appearance"
import { AuthLoading } from "@/components/auth/auth-loading"

export const metadata: Metadata = {
    title: "Create your account | Introify",
    description: "Create an Introify account to bring your profile, offerings and bookings together.",
    robots: { index: false, follow: true },
}

export default function SignUpPage() {
    return (
        <SignUp
            appearance={clerkAuthAppearance}
            fallback={<AuthLoading />}
            routing="path"
            path="/sign-up"
            forceRedirectUrl="/onboarding"
            fallbackRedirectUrl="/onboarding"
            signInUrl="/sign-in"
        />
    )
}
