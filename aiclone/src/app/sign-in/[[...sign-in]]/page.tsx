import { SignIn } from "@clerk/nextjs"
import { AuthShell } from "@/components/auth/auth-shell"
import { clerkAppearance } from "@/lib/clerk-appearance"

export default function SignInPage() {
    return (
        <AuthShell
            title="Welcome back"
            subtitle="Sign in to your account"
            altHref="/sign-up"
            altHint="Don't have an account?"
            altLabel="Sign up"
        >
            <SignIn appearance={clerkAppearance} fallbackRedirectUrl="/dashboard" signUpUrl="/sign-up" />
        </AuthShell>
    )
}
