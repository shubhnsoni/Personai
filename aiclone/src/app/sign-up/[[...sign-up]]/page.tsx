import { SignUp } from "@clerk/nextjs"
import { AuthShell } from "@/components/auth/auth-shell"
import { clerkAppearance } from "@/lib/clerk-appearance"

export default function SignUpPage() {
    return (
        <AuthShell
            title="Create account"
            subtitle="Sign up to get started"
            altHref="/sign-in"
            altHint="Already have an account?"
            altLabel="Sign in"
        >
            <SignUp appearance={clerkAppearance} fallbackRedirectUrl="/onboarding" signInUrl="/sign-in" />
        </AuthShell>
    )
}
