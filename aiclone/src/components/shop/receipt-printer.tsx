"use client"

import { useEffect } from "react"
import { openReceiptPdf, type ReceiptData } from "@/lib/receipt"

export function ReceiptPrinter({
    data,
    onClose,
}: {
    data: ReceiptData
    onClose: () => void
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8">
            <button type="button" className="absolute inset-0" aria-label="Close receipt" onClick={onClose} />
            <div className="relative z-[1] w-full max-w-[22rem]">
                <div className="relative mx-auto h-[7.5rem] w-full rounded-2xl bg-[#1b1b1b] shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-1 ring-black">
                    <div className="mx-auto mt-4 h-6 w-[88%] rounded-full bg-black shadow-inner ring-1 ring-[#111]" />
                    <p className="mt-3 text-center text-[10px] uppercase tracking-[0.22em] text-zinc-500">{data.shopName ? `${data.shopName} printer` : "Printer"}</p>
                </div>
                <div className="relative -mt-8 flex justify-center overflow-hidden pb-6 pt-2">
                    <article className="rcpt-paper w-[86%] bg-[#f7f4ea] px-4 pb-5 pt-6 text-[#1a1a1a] shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                        <div className="rcpt-shade pointer-events-none absolute inset-x-0 top-0 h-16" />
                        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em]">{data.shopName}</p>
                        <p className="mt-1 text-center text-[10px] uppercase tracking-[0.16em] text-zinc-500">Tax invoice · Receipt</p>
                        {data.gstin ? <p className="mt-1 text-center font-mono text-[10px] text-zinc-500">GSTIN {data.gstin}</p> : null}
                        {data.invoice ? <p className="mt-1 text-center font-mono text-[10px] text-zinc-500">{data.invoice}</p> : null}
                        <div className="my-3 border-t border-dashed border-zinc-400" />
                        <p className="font-mono text-[11px]">Order #{data.number}</p>
                        <p className="font-mono text-[11px] text-zinc-600">{data.tableLabel || "Takeaway"} · {data.guestName || "Guest"}</p>
                        <p className="font-mono text-[11px] text-zinc-600">{data.placedAt}</p>
                        <p className="font-mono text-[11px] text-zinc-600">{data.payMethod || "Pay later"} · {data.payStatus}</p>
                        <div className="my-3 border-t border-dashed border-zinc-400" />
                        <div className="space-y-1.5 font-mono text-[12px]">
                            {data.lines.map((line, i) => (
                                <div key={`${line.title}-${i}`} className="flex items-start justify-between gap-2">
                                    <span className="min-w-0">
                                        {line.qty}× {line.title}
                                        {line.modifiersLabel ? <span className="block text-[10px] text-zinc-500">{line.modifiersLabel}</span> : null}
                                    </span>
                                    <span className="shrink-0 tabular-nums">{line.lineTotal}</span>
                                </div>
                            ))}
                        </div>
                        <div className="my-3 border-t border-dashed border-zinc-400" />
                        <div className="flex justify-between font-mono text-[12px]"><span>Subtotal</span><span>{data.subtotal}</span></div>
                        {data.taxable ? <div className="flex justify-between font-mono text-[12px]"><span>Taxable</span><span>{data.taxable}</span></div> : null}
                        {(data.gstLines && data.gstLines.length > 0)
                            ? data.gstLines.map((g) => (
                                <div key={g.label} className="flex justify-between font-mono text-[12px]"><span>{g.label}</span><span>{g.amount}</span></div>
                            ))
                            : (data.tax ? <div className="flex justify-between font-mono text-[12px]"><span>Tax</span><span>{data.tax}</span></div> : null)}
                        <div className="mt-2 flex justify-between font-mono text-[15px] font-bold"><span>TOTAL</span><span>{data.total}</span></div>
                        {data.upiId ? <p className="mt-3 text-center font-mono text-[11px]">UPI {data.upiId}</p> : null}
                        <p className="mt-4 text-center text-[11px] text-zinc-500">Thank you · Visit again</p>
                        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
                            <button
                                type="button"
                                className="rounded-full bg-zinc-950 py-2 text-[12px] font-semibold text-white"
                                onClick={() => openReceiptPdf(data)}
                            >
                                Download PDF
                            </button>
                            <button type="button" className="rounded-full border border-zinc-300 py-2 text-[12px]" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </article>
                </div>
            </div>
            <style>{`
                .rcpt-paper {
                    position: relative;
                    animation: rcpt-print 1.15s cubic-bezier(.22,1,.36,1) both;
                    clip-path: inset(0 -8px -8px -8px);
                }
                .rcpt-paper::before,
                .rcpt-paper::after {
                    content: "";
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 8px;
                    background-image: radial-gradient(circle at 6px 0, transparent 6px, #f7f4ea 6.5px);
                    background-size: 12px 8px;
                    background-repeat: repeat-x;
                }
                .rcpt-paper::before { top: -8px; }
                .rcpt-paper::after { bottom: -8px; transform: rotate(180deg); }
                .rcpt-shade {
                    background: linear-gradient(180deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.45) 35%, transparent 100%);
                    animation: rcpt-shade .9s ease-out both;
                }
                @keyframes rcpt-print {
                    from { transform: translateY(-78%); opacity: .35; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes rcpt-shade {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .rcpt-paper, .rcpt-shade { animation: none; }
                }
            `}</style>
        </div>
    )
}
