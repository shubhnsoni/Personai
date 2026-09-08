import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clerkAuthAppearance } from "@/lib/clerk-auth-appearance"

const clerkState = vi.hoisted(() => ({ loaded: true, mounted: true }))
const clerk = vi.hoisted(() => ({
    signIn: vi.fn(({ fallback }: { fallback?: ReactNode }) =>
        !clerkState.loaded || !clerkState.mounted ? fallback : <div>Sign-in form ready</div>),
    signUp: vi.fn(({ fallback }: { fallback?: ReactNode }) =>
        !clerkState.loaded || !clerkState.mounted ? fallback : <div>Sign-up form ready</div>),
}))

vi.mock("@clerk/nextjs", () => ({
    SignIn: clerk.signIn,
    SignUp: clerk.signUp,
}))

import SignInPage, { metadata as signInMetadata } from "@/app/(auth)/sign-in/[[...sign-in]]/page"
import SignUpPage, { metadata as signUpMetadata } from "@/app/(auth)/sign-up/[[...sign-up]]/page"

describe("standalone Clerk auth pages", () => {
    beforeEach(() => {
        clerkState.loaded = true
        clerkState.mounted = true
    })

    it("identifies each auth page without indexing login and verification routes", () => {
        expect(signInMetadata.title).toBe("Sign in | Introify")
        expect(signUpMetadata.title).toBe("Create your account | Introify")
        expect(signInMetadata.robots).toMatchObject({ index: false })
        expect(signUpMetadata.robots).toMatchObject({ index: false })
    })

    it("keeps sign-in path routing, dashboard redirects and the sign-up alternative while applying the scoped theme", () => {
        render(<SignInPage />)
        expect(clerk.signIn).toHaveBeenCalledWith({
            appearance: clerkAuthAppearance,
            fallback: expect.anything(),
            routing: "path",
            path: "/sign-in",
            forceRedirectUrl: "/dashboard",
            fallbackRedirectUrl: "/dashboard",
            signUpUrl: "/sign-up",
        }, undefined)
    })

    it("keeps sign-up path routing, onboarding redirects and the sign-in alternative while applying the scoped theme", () => {
        render(<SignUpPage />)
        expect(clerk.signUp).toHaveBeenCalledWith({
            appearance: clerkAuthAppearance,
            fallback: expect.anything(),
            routing: "path",
            path: "/sign-up",
            forceRedirectUrl: "/onboarding",
            fallbackRedirectUrl: "/onboarding",
            signInUrl: "/sign-in",
        }, undefined)
    })

    it.each([
        ["sign-in", SignInPage, "Sign-in form ready"],
        ["sign-up", SignUpPage, "Sign-up form ready"],
    ] as const)("provides a visible %s fallback until both the SDK and widget are ready", (_, Page, readyText) => {
        clerkState.loaded = false
        clerkState.mounted = false
        const { rerender } = render(<Page />)
        expect(screen.getByRole("status").textContent).toContain("Loading your account form")
        expect(screen.queryByText(readyText)).toBeNull()

        clerkState.loaded = true
        rerender(<Page />)
        expect(screen.getByRole("status").textContent).toContain("Loading your account form")
        expect(screen.queryByText(readyText)).toBeNull()

        clerkState.mounted = true
        rerender(<Page />)
        expect(screen.queryByRole("status")).toBeNull()
        expect(screen.getByText(readyText)).toBeTruthy()
    })
})
