"use client"

export function PrintButton() {
    return (
        <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background"
        >
            Print
        </button>
    )
}
