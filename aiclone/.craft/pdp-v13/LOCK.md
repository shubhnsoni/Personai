# PersonaLink public shop PDP — craft lock v1.3

Engineer EMPTY. Frames only (not production). Tip-chase OFF.

## Brand (locked) — LIGHT MODE
- Page: fog `#f4f6f8` / white cards `#ffffff` — **never** dark `#07080a`
- Ink: `#0b1220` + fog gray `#5c6570` for secondary
- Primary CTA: cyan `#00d7ff` on `#061018` (pill) — premium light shop
- Accents: electric blue `#52E8FF` → `#1A4DFF` sparingly (mark only)
- Type: system-ui / Inter / Geist-like sans
- Radius ~0.75–1.1rem; CTAs always pill (`border-radius: 999px`)
- Soft borders + light shadows — Candii / More Labs / Amazon A+ hierarchy

## Content (E2E Sunrise Pharmacy sample)
- Header: `E2E Sunrise Pharmacy | MEDICINES` + Cart
- Kicker: `PHYSICAL · FEVER`
- Title: `Paracetamol 650`
- Stars → price `$0.32` → stock `40 in stock` → Order CTA (tight buy stack)
- Blurb + compact specs (Form / Strength / Category / Pack size)
- UI copy = real pharmacy OTC voice — **not** meta “merchants upload” essays
- Merchant upload / A+ module notes live **only in this LOCK.md**, not in the frame UI

## Layout v1.3 — LONG full page
### Top — conversion
- Desktop: 2-col — LEFT clean hero + thumbs; RIGHT kicker → title → stars → price → stock → Order
- Mobile: stacked hero + thumbs → same tight buy stack → sticky Order bar
- Generous vertical rhythm — do **not** cram into one viewport

### More details (below buy)
- Section label **More details**
- Stacked MORE deck: 3 offset rounded cards + cyan `MORE` badge; front uses `ref-stacked-more.png`
- Short lifestyle caption beside (desktop) / below (mobile)

### From the brand (Amazon A+ style)
- (a) Full-bleed lifestyle band + caption
- (b) 2-column image|copy sell block — light card, soft border
- (c) 3-up lifestyle tiles
- Merchants upload sellable lifestyle/product images (craft note only — not shown as UI copy)

### Reviews (optional strip)
- Light review cards — 3 quotes

### Footer
- Quiet watermark only: `PersonaLink craft v1.3 · light · not production`

## Frames (v1.3 deliverables)
- `desktop-light.html` → `desktop-light-full.png` (width 1280, full scroll height ~2000–3200+)
- `mobile-light.html` → `mobile-light-full.png` (width 390, full scroll height)
- Ref: `ref-stacked-more.png`
- Legacy dark v1.2 crops (`desktop-1280.*`, `mobile-390.*`) superseded — Ayoub rejected dark

## Quality bar
- Looks like a real retail PDP — not a labeled wireframe
- No dashed annotation boxes, no engineer-empty essays in the UI
- Light, scrollable, premium — breathing room between sections

## Out of scope
- Production components, tip-chase, real cart/checkout, API wiring
