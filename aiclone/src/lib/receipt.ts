export type ReceiptLine = {
    qty: number
    title: string
    modifiersLabel?: string | null
    lineTotal: string
}

export type ReceiptData = {
    shopName: string
    gstin?: string | null
    number: number | string
    tableLabel?: string | null
    guestName?: string | null
    guestEmail?: string | null
    status: string
    payStatus: string
    payMethod?: string | null
    placedAt: string
    lines: ReceiptLine[]
    subtotal: string
    tax?: string | null
    total: string
    upiId?: string | null
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

export function receiptPrintHtml(data: ReceiptData) {
    const lines = data.lines.map((line) => `
      <tr>
        <td>${line.qty}</td>
        <td>${escapeHtml(line.title)}${line.modifiersLabel ? `<div class="mod">${escapeHtml(line.modifiersLabel)}</div>` : ""}</td>
        <td class="r">${escapeHtml(line.lineTotal)}</td>
      </tr>`).join("")
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Receipt #${data.number}</title>
<style>
  @page { size: 80mm auto; margin: 6mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #111; font-family: ui-monospace, "Courier New", monospace; }
  .ticket { width: 72mm; margin: 0 auto; }
  .center { text-align: center; }
  .shop { font-size: 16px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .muted { color: #444; font-size: 11px; }
  .dash { border: 0; border-top: 1px dashed #111; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 3px 0; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  .mod { font-size: 10px; color: #555; }
  .total { font-size: 14px; font-weight: 700; }
  .thanks { margin-top: 12px; text-align: center; font-size: 11px; }
</style>
</head>
<body>
  <div class="ticket">
    <p class="center shop">${escapeHtml(data.shopName)}</p>
    <p class="center muted">TAX INVOICE / RECEIPT</p>
    ${data.gstin ? `<p class="center muted">GSTIN ${escapeHtml(data.gstin)}</p>` : ""}
    <hr class="dash"/>
    <p class="muted">Order #${escapeHtml(String(data.number))}</p>
    <p class="muted">${escapeHtml(data.tableLabel || "Takeaway")} · ${escapeHtml(data.guestName || "Guest")}</p>
    <p class="muted">${escapeHtml(data.placedAt)}</p>
    <p class="muted">${escapeHtml(data.payMethod || "Pay later")} · ${escapeHtml(data.payStatus)}</p>
    <hr class="dash"/>
    <table>
      <tr><td>Qty</td><td>Item</td><td class="r">Amt</td></tr>
      ${lines}
    </table>
    <hr class="dash"/>
    <table>
      <tr><td>Subtotal</td><td class="r">${escapeHtml(data.subtotal)}</td></tr>
      ${data.tax ? `<tr><td>Tax</td><td class="r">${escapeHtml(data.tax)}</td></tr>` : ""}
      <tr class="total"><td>TOTAL</td><td class="r">${escapeHtml(data.total)}</td></tr>
    </table>
    ${data.upiId ? `<p class="center muted" style="margin-top:10px">UPI ${escapeHtml(data.upiId)}</p>` : ""}
    <p class="thanks">Thank you · Visit again</p>
    <p class="center muted">${escapeHtml(data.status)}</p>
  </div>
  <script>window.onload=()=>window.print()</script>
</body>
</html>`
}

export function openReceiptPdf(data: ReceiptData) {
    const w = window.open("", "_blank", "width=420,height=720")
    if (!w) return
    w.document.write(receiptPrintHtml(data))
    w.document.close()
}
