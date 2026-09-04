export type ReceiptLine = {
    qty: number
    title: string
    modifiersLabel?: string | null
    /** HSN/SAC code for the line (invoice column). */
    hsn?: string | null
    /** Unit rate formatted (e.g. ₹120). */
    rate?: string | null
    /** Line taxable amount formatted. */
    taxable?: string | null
    /** Line tax amount formatted. */
    tax?: string | null
    lineTotal: string
}

export type ReceiptGstLine = {
    label: string
    amount: string
}

export type ReceiptData = {
    shopName: string
    /** Seller GSTIN */
    gstin?: string | null
    /** Buyer / dealer name (bill-to). */
    buyerName?: string | null
    /** Buyer GSTIN when known. */
    buyerGstin?: string | null
    /** Buyer place / location line. */
    buyerPlace?: string | null
    number: number | string
    tableLabel?: string | null
    guestName?: string | null
    guestEmail?: string | null
    status: string
    payStatus: string
    payMethod?: string | null
    placedAt: string
    /** Invoice date shown top-right (defaults to placedAt). */
    invoiceDate?: string | null
    lines: ReceiptLine[]
    subtotal: string
    /** Optional taxable amount (shown when GST breakup is present). */
    taxable?: string | null
    tax?: string | null
    /** Structured GST breakup lines (CGST/SGST, IGST, or single GST). */
    gstLines?: ReceiptGstLine[]
    total: string
    upiId?: string | null
    invoice?: string | null
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

/**
 * A4 tax-invoice print sheet (Designer bar):
 * white page, Geist Mono for numbers, seller header + GSTIN,
 * buyer block, HSN · desc · qty · rate · taxable · tax,
 * footer taxable / CGST+SGST|IGST / grand, invoice+date top-right.
 * No cyan chrome on the print sheet.
 */
export function receiptPrintHtml(data: ReceiptData) {
    const buyerName = data.buyerName || data.guestName || ""
    const buyerPlace = data.buyerPlace || data.tableLabel || ""
    const invoiceDate = data.invoiceDate || data.placedAt
    const lines = data.lines.map((line) => `
      <tr>
        <td class="mono">${escapeHtml(line.hsn || "—")}</td>
        <td>${escapeHtml(line.title)}${line.modifiersLabel ? `<div class="mod">${escapeHtml(line.modifiersLabel)}</div>` : ""}</td>
        <td class="r mono">${line.qty}</td>
        <td class="r mono">${escapeHtml(line.rate || line.lineTotal)}</td>
        <td class="r mono">${escapeHtml(line.taxable || line.lineTotal)}</td>
        <td class="r mono">${escapeHtml(line.tax || "—")}</td>
      </tr>`).join("")
    const gstRows = (data.gstLines || []).map((g) => `
      <tr><td>${escapeHtml(g.label)}</td><td class="r mono">${escapeHtml(g.amount)}</td></tr>`).join("")
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${data.invoice ? escapeHtml(data.invoice) : `Invoice #${escapeHtml(String(data.number))}`}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #fff;
    color: #111;
    font-family: "Geist", "Inter", system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.45;
  }
  .sheet { width: 100%; max-width: 182mm; margin: 0 auto; background: #fff; color: #111; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .seller-name { font-size: 18px; font-weight: 700; letter-spacing: .02em; margin: 0 0 4px; }
  .muted { color: #444; font-size: 11px; margin: 0; }
  .mono { font-family: "Geist Mono", ui-monospace, "Courier New", monospace; font-variant-numeric: tabular-nums; }
  .invoice-meta { text-align: right; }
  .invoice-meta .inv { font-size: 13px; font-weight: 600; margin: 0; }
  .rule { border: 0; border-top: 1px solid #111; margin: 14px 0; }
  .buyer { margin: 0; }
  .buyer h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: #555; font-weight: 600; margin: 0 0 4px; }
  .buyer .name { font-size: 13px; font-weight: 600; margin: 0 0 2px; }
  table.lines { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.lines th {
    text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
    color: #555; font-weight: 600; padding: 6px 4px; border-bottom: 1px solid #111;
  }
  table.lines th.r, table.lines td.r { text-align: right; }
  table.lines td { padding: 7px 4px; vertical-align: top; border-bottom: 1px solid #e5e5e5; }
  .mod { font-size: 10px; color: #666; margin-top: 2px; }
  table.totals { width: 100%; max-width: 280px; margin-left: auto; border-collapse: collapse; font-size: 12px; }
  table.totals td { padding: 4px 0; }
  table.totals .grand td { font-size: 14px; font-weight: 700; padding-top: 8px; border-top: 1px solid #111; }
  .foot { margin-top: 18px; font-size: 10px; color: #666; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <p class="seller-name">${escapeHtml(data.shopName)}</p>
        ${data.gstin ? `<p class="muted mono">GSTIN ${escapeHtml(data.gstin)}</p>` : ""}
        <p class="muted">TAX INVOICE</p>
      </div>
      <div class="invoice-meta">
        ${data.invoice ? `<p class="inv mono">${escapeHtml(data.invoice)}</p>` : `<p class="inv mono">Order #${escapeHtml(String(data.number))}</p>`}
        <p class="muted mono">${escapeHtml(invoiceDate)}</p>
      </div>
    </div>
    <hr class="rule"/>
    <div class="buyer">
      <h2>Bill to</h2>
      <p class="name">${escapeHtml(buyerName || "—")}</p>
      ${data.buyerGstin ? `<p class="muted mono">GSTIN ${escapeHtml(data.buyerGstin)}</p>` : ""}
      ${buyerPlace ? `<p class="muted">${escapeHtml(buyerPlace)}</p>` : ""}
    </div>
    <hr class="rule"/>
    <table class="lines">
      <thead>
        <tr>
          <th>HSN/SAC</th>
          <th>Description</th>
          <th class="r">Qty</th>
          <th class="r">Rate</th>
          <th class="r">Taxable</th>
          <th class="r">Tax</th>
        </tr>
      </thead>
      <tbody>
        ${lines}
      </tbody>
    </table>
    <hr class="rule"/>
    <table class="totals">
      ${data.taxable ? `<tr><td>Taxable</td><td class="r mono">${escapeHtml(data.taxable)}</td></tr>` : `<tr><td>Subtotal</td><td class="r mono">${escapeHtml(data.subtotal)}</td></tr>`}
      ${gstRows}
      ${!gstRows && data.tax ? `<tr><td>Tax</td><td class="r mono">${escapeHtml(data.tax)}</td></tr>` : ""}
      <tr class="grand"><td>Grand total</td><td class="r mono">${escapeHtml(data.total)}</td></tr>
    </table>
    ${data.upiId ? `<p class="foot mono">UPI ${escapeHtml(data.upiId)}</p>` : ""}
    <p class="foot">${escapeHtml(data.payMethod || "")}${data.payMethod ? " · " : ""}${escapeHtml(data.payStatus)} · ${escapeHtml(data.status)}</p>
  </div>
  <script>window.onload=()=>window.print()</script>
</body>
</html>`
}

export function openReceiptPdf(data: ReceiptData) {
    const w = window.open("", "_blank", "width=900,height=1200")
    if (!w) return
    w.document.write(receiptPrintHtml(data))
    w.document.close()
}
