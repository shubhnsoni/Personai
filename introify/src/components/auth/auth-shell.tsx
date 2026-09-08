import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export function AuthShell({
    title,
    subtitle,
    altHref,
    altHint,
    altLabel,
    look,
    children,
}: {
    title: string
    subtitle?: string
    altHref?: string
    altHint?: string
    altLabel?: string
    look?: string
    children: React.ReactNode
}) {
    return (
        <div data-auth-look={look} className="auth-scene relative min-h-dvh overflow-hidden text-white">
            <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-[max(0.9rem,env(safe-area-inset-top))]">
                <Logo className="from-white to-white/70" />
                <Link href="/" className="text-sm text-white/35 hover:text-white">
                    Home
                </Link>
            </header>

            <main className="relative z-10 flex min-h-dvh items-center justify-center px-6 py-[max(4.5rem,env(safe-area-inset-top))]">
                <div className="auth-glass w-full max-w-[21rem] px-7 py-8">
                    <div className="relative z-10">
                        <div className="mb-6 flex flex-col items-center text-center">
                            <h1 className="text-[1.55rem] font-medium tracking-[-0.03em] text-white">{title}</h1>
                            {subtitle ? <p className="mt-1.5 text-[13px] text-white/38">{subtitle}</p> : null}
                        </div>
                        <div className="auth-clerk w-full">{children}</div>
                        {altHref && altLabel ? (
                            <p className="mt-6 text-center text-[12px] text-white/35">
                                {altHint ? `${altHint} ` : null}
                                <Link href={altHref} className="font-medium text-[#00D7FF] hover:text-white">
                                    {altLabel}
                                </Link>
                            </p>
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    )
}
