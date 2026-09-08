"use client"

import Link from "next/link"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"

export function LandingAuthLinks() {
    return (
        <>
            <SignedOut>
                <Link href="/sign-in" className="ln-hide-xs">Sign in</Link>
            </SignedOut>
            <SignedIn>
                <Link href="/dashboard" className="ln-hide-xs">Studio</Link>
            </SignedIn>
        </>
    )
}

export function LandingAuthCta() {
    return (
        <>
            <SignedOut>
                <Link href="/sign-up" className="ln-go">Create</Link>
            </SignedOut>
            <SignedIn>
                <span className="ln-go inline-flex items-center">
                    <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
                </span>
            </SignedIn>
        </>
    )
}
