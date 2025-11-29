import { redirect } from "next/navigation"
import { syncUser } from "@/lib/auth-sync"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await syncUser()

    if (!user) {
        redirect("/sign-in")
    }

    if (user.role !== "ADMIN") {
        redirect("/dashboard")
    }

    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
                <h1 className="font-bold">Admin Area</h1>
            </header>
            <main className="flex-1 p-6">
                {children}
            </main>
        </div>
    )
}
