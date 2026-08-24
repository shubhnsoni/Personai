"use client"

import { AuthScreen } from "@/components/auth/auth-screen"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <AuthScreen />
            <div hidden>{children}</div>
        </>
    )
}
