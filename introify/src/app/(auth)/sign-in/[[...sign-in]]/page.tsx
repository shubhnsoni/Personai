import { SignIn } from "@clerk/nextjs"
import { clerkAppearance } from "@/lib/clerk-appearance"

export default function SignInPage() {
    return (
        <SignIn
            appearance={clerkAppearance}
            routing="path"
            path="/sign-in"
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
            signUpUrl="/sign-up"
        />
    )
}
