import Link from "next/link"
import { notFound } from "next/navigation"
import { peekSaleToken } from "@/lib/metal/ledger"
import { touchPercent } from "@/lib/metal/touch"

export const dynamic = "force-dynamic"

export default async function LiftPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
    const { slug, token } = await params
    const bill = await peekSaleToken(token)
    if (!bill || bill.slug !== slug) notFound()

    return (
        <div className="dark min-h-dvh bg-zinc-950 text-zinc-100">
            <div className="mx-auto min-h-dvh max-w-md px-4 py-10">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Lift parcel</p>
                <h1 className="mt-1 text-2xl font-semibold">{bill.from}</h1>
                <p className="mt-4 text-sm text-zinc-400">
                    {bill.grams} g · {touchPercent(bill.touch)} touch
                </p>
                <ul className="mt-4 space-y-1 text-sm">
                    {bill.titles.map((t, i) => (
                        <li key={`${i}-${t}`}>{t}</li>
                    ))}
                </ul>
                {bill.lifted ? (
                    <p className="mt-6 text-sm text-amber-400">Already lifted.</p>
                ) : (
                    <p className="mt-6 text-sm text-zinc-400">
                        Open your jewellery store studio and paste this code on Buy stock:
                    </p>
                )}
                <p className="mt-2 rounded-2xl bg-zinc-900 px-3 py-2 font-mono text-sm">{bill.token}</p>
                <Link href="/dashboard/products" className="mt-6 inline-flex h-11 items-center rounded-full bg-cyan-400 px-5 text-sm font-medium text-zinc-950">
                    Open studio
                </Link>
                <p className="mt-3 text-[12px] text-zinc-500">Must be signed in as a jewellery store. Udhar on this bill stays with the wholesaler.</p>
            </div>
        </div>
    )
}
