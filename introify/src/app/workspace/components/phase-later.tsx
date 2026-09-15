import Link from "next/link"

export function PhaseLater({ title }: { title: string }) {
    return (
        <div className="w-page">
            <div className="w-empty">
                <h1 className="w-h1">{title}</h1>
                <p>This surface belongs to a later Introify phase. Phase 1 is My AIs, Create, Jobs, and Profile showcase — no Bridge, marketplace, or hire checkout.</p>
                <Link href="/workspace" className="w-btn">Back to My AIs</Link>
            </div>
        </div>
    )
}
