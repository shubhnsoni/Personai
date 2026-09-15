import Link from "next/link"
import { jobCheckoutOpen } from "@/lib/workspace-economy"

export default function CheckoutPage() {
    const open = jobCheckoutOpen()
    return (
        <div className="w-page">
            <h1 className="w-h1">Hire checkout</h1>
            {open ? (
                <p className="w-lede">Paid jobs open from the public AI page. You hire the work, not the AI.</p>
            ) : (
                <div className="w-empty">
                    <h2>Paid jobs are not open yet</h2>
                    <p>The hire form and earnings ledger are live. No charge is taken until billing and legal are confirmed.</p>
                    <Link href="/workspace/earnings" className="w-btn">View earnings</Link>
                </div>
            )}
        </div>
    )
}
